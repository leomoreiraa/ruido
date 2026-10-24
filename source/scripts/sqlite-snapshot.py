"""Public SQLite snapshots. Always invoke with python -I; never from download directories."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import sys

PUBLIC = {'Parlamentar', 'Proposicao', 'Votacao', 'Voto', 'Presenca',
          'EmendaParlamentar', 'BemDeclarado', 'Discurso', 'ResumoIA', 'FrequenciaPlenario'}
INTERNAL = {'SyncLease', 'SyncExecution', '_prisma_migrations'}
DATES = {'Votacao': 'dataHora', 'Presenca': 'dataSessao', 'Discurso': 'dataHora',
         'Proposicao': 'dataApresentacao'}

ALLOWED_PARAMS = {'tipo', 'collectorRevision', 'fonte', 'mes', 'dataInicio', 'dataFim', 'encerrada', 'ano', 'pagina'}
ALLOWED_RESUMO = {'votacoesSincronizadas', 'votosSincronizados', 'presencas', 'cobertura', 'emendasSincronizadas', 'associadas', 'semCorrespondencia'}


def connect(path):
    if not path.is_file() or path.is_symlink():
        raise ValueError('Missing or unsafe SQLite file')
    db = sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)
    db.execute('PRAGMA trusted_schema=OFF')
    return db


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def inspect(db):
    if db.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
        raise ValueError('SQLite integrity check failed')
    if db.execute('PRAGMA foreign_key_check').fetchone():
        raise ValueError('Foreign key check failed')
    objects = db.execute("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").fetchall()
    if any(kind in ('view', 'trigger') for kind, _, _ in objects):
        raise ValueError('Views and triggers are not accepted in public snapshots')
    tables = {name for kind, name, _ in objects if kind == 'table'}
    if tables - PUBLIC - INTERNAL or not {'Parlamentar', 'Votacao', 'Voto', 'Presenca'} <= tables:
        raise ValueError('Unexpected or missing tables')
    counts = {t: db.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0] for t in sorted(tables)}
    coverage = {}
    for table, column in DATES.items():
        if table not in tables:
            continue
        columns = {r[1] for r in db.execute(f'PRAGMA table_info("{table}")')}
        if 'casa' in columns:
            rows = db.execute(f'SELECT casa,MIN("{column}"),MAX("{column}"),COUNT(*) FROM "{table}" GROUP BY casa').fetchall()
        else:
            rows = db.execute(f'SELECT p.casa,MIN(d."{column}"),MAX(d."{column}"),COUNT(*) FROM "{table}" d JOIN Parlamentar p ON p.id=d.parlamentarId GROUP BY p.casa').fetchall()
        coverage[table] = [dict(casa=r[0], first=r[1], last=r[2], count=r[3]) for r in rows]
    return {'schema_sha256': hashlib.sha256(json.dumps(objects, ensure_ascii=True).encode()).hexdigest(),
            'schema_version': db.execute('PRAGMA user_version').fetchone()[0],
            'counts': counts, 'coverage': coverage}


def sanitized(db):
    tables = inspect(db)['counts']
    for table in ('SyncLease', '_prisma_migrations'):
        if tables.get(table, 0):
            raise ValueError('Private operational rows present')
    if tables.get('SyncExecution', 0):
        for exec_id, status, erro, parametros, resumo in db.execute('SELECT id,status,erro,parametros,resumo FROM SyncExecution'):
            if status != 'SUCESSO' or erro is not None:
                raise ValueError('Unsuccessful execution retained or error not sanitized')
            if not (exec_id.startswith('history:v1:camara:') or exec_id.startswith('history:v1:senado:') or exec_id.startswith('history:v1:emendas:')):
                raise ValueError(f'Non-historical execution row retained: {exec_id}')
            if parametros is not None:
                parsed_params = json.loads(parametros)
                if not isinstance(parsed_params, dict) or set(parsed_params.keys()) - ALLOWED_PARAMS:
                    raise ValueError('Unsanitized parameters keys')
                if parsed_params.get('tipo') != 'historico-v1':
                    raise ValueError('Unknown parameter format')
            if resumo is not None:
                parsed_resumo = json.loads(resumo)
                if not isinstance(parsed_resumo, dict) or set(parsed_resumo.keys()) - ALLOWED_RESUMO:
                    raise ValueError('Unsanitized summary keys')


def verify(database, manifest):
    data = json.loads(manifest.read_text(encoding='utf-8'))
    if data.get('generation') != 'rebuilt-v2':
        raise ValueError('Legacy snapshot generation refused')
    if data.get('format') != 1 or data.get('sha256') != digest(database):
        raise ValueError('Snapshot hash/format mismatch')
    with connect(database) as db:
        actual = inspect(db)
        sanitized(db)
    if any(data.get(k) != v for k, v in actual.items()):
        raise ValueError('Snapshot manifest does not describe this database')
    return data


def preserve_history(database, previous):
    with connect(previous) as old, connect(database) as new:
        old_counts, new_counts = inspect(old)['counts'], inspect(new)['counts']
        uri = previous.resolve().as_uri() + '?mode=ro'
        new.execute('ATTACH DATABASE ? AS previous', (uri,))
        for table in PUBLIC & old_counts.keys():
            if table not in new_counts or new_counts[table] < old_counts[table]:
                raise ValueError(f'History shrank: {table}')
            missing = new.execute(
                f'SELECT 1 FROM previous."{table}" old '
                f'WHERE NOT EXISTS (SELECT 1 FROM main."{table}" current '
                f'WHERE current.id=old.id) LIMIT 1'
            ).fetchone()
            if missing:
                raise ValueError(f'Historical identity removed: {table}')


def snapshot(source, directory, previous=None):
    directory.mkdir(parents=True, exist_ok=False)
    target = directory / 'public.sqlite'
    with connect(source) as src, sqlite3.connect(target) as dst:
        inspect(src)
        src.backup(dst)
        dst.execute('PRAGMA trusted_schema=OFF')
        dst.execute('PRAGMA secure_delete=ON')
        tables = inspect(dst)['counts']
        for table in ('SyncLease', '_prisma_migrations'):
            if table in tables:
                dst.execute(f'DELETE FROM "{table}"')
        if 'SyncExecution' in tables:
            rows = dst.execute('SELECT id,status,iniciadoEm,finalizadoEm,parametros,resumo FROM SyncExecution').fetchall()
            dst.execute('DELETE FROM SyncExecution')
            for row in rows:
                exec_id, status, iniciado, finalizado, raw_params, raw_resumo = row
                if status != 'SUCESSO':
                    continue
                if not (exec_id.startswith('history:v1:camara:') or exec_id.startswith('history:v1:senado:') or exec_id.startswith('history:v1:emendas:')):
                    continue
                clean_params = None
                if raw_params:
                    try:
                        p = json.loads(raw_params)
                        if isinstance(p, dict) and p.get('tipo') == 'historico-v1':
                            clean_params = json.dumps({k: p[k] for k in p if k in ALLOWED_PARAMS}, sort_keys=True)
                    except Exception:
                        clean_params = None
                clean_resumo = None
                if raw_resumo:
                    try:
                        r = json.loads(raw_resumo)
                        if isinstance(r, dict):
                            clean_resumo = json.dumps({k: r[k] for k in r if k in ALLOWED_RESUMO}, sort_keys=True)
                    except Exception:
                        clean_resumo = None
                dst.execute('INSERT INTO SyncExecution (id,iniciadoEm,finalizadoEm,status,erro,parametros,resumo) VALUES (?,?,?,?,NULL,?,?)',
                            (exec_id, iniciado, finalizado, status, clean_params, clean_resumo))
        dst.commit()
        dst.execute('VACUUM')
    if previous:
        preserve_history(target, previous)
    with connect(target) as db:
        sanitized(db)
        metadata = inspect(db)
    metadata.update(format=1, generation='rebuilt-v2', sha256=digest(target), created_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    coverage_note='Observed records only; min/max do not prove continuous or complete coverage.',
                    retention='Rebuilt from official APIs; no legacy SQLite imported.')
    manifest = directory / 'manifest.json'
    manifest.write_text(json.dumps(metadata, indent=2, ensure_ascii=True) + '\n', encoding='utf-8')
    verify(target, manifest)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    create = commands.add_parser('create')
    create.add_argument('--source', required=True, type=Path)
    create.add_argument('--output-dir', required=True, type=Path)
    create.add_argument('--previous', type=Path)
    check = commands.add_parser('verify')
    check.add_argument('--database', required=True, type=Path)
    check.add_argument('--manifest', required=True, type=Path)
    restore = commands.add_parser('restore')
    restore.add_argument('--database', required=True, type=Path)
    restore.add_argument('--manifest', required=True, type=Path)
    restore.add_argument('--destination', required=True, type=Path)
    args = parser.parse_args()
    if args.command == 'create':
        snapshot(args.source, args.output_dir, args.previous)
    else:
        verify(args.database, args.manifest)
        if args.command == 'restore':
            if args.destination.exists() or any(Path(str(args.destination) + suffix).exists() for suffix in ('-wal', '-shm')):
                raise ValueError('Refusing to overwrite an existing database')
            args.destination.parent.mkdir(parents=True, exist_ok=True)
            with connect(args.database) as src, sqlite3.connect(args.destination) as dst:
                src.backup(dst)
    print('Snapshot validation successful')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Snapshot refused: {error}', file=sys.stderr)
        sys.exit(1)
