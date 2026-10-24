"""Prepublication safety gate for a clean, source-only Congressional SQLite generation.

This is an audit, NOT a claim of exhaustive coverage. It blocks empty/obviously
inconsistent rebuilds; it never imports data from earlier releases or Git LFS.
Invoke only against the already-sanitized candidate snapshot.
"""
import argparse
import json
import sqlite3
import sys
from pathlib import Path


def audit(path: Path, require_amendments: bool, checkpoint_only: bool = False) -> dict:
    if not path.is_file():
        raise ValueError("Clean candidate SQLite does not exist")
    with path.open("rb") as stream:
        if stream.read(16) != b"SQLite format 3\x00":
            raise ValueError("Candidate is not an SQLite database")
    db = sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)
    try:
        db.execute("PRAGMA trusted_schema=OFF")
        if db.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
            raise ValueError("Corrupt SQLite candidate")
        foreign_violations = db.execute("PRAGMA foreign_key_check").fetchmany(5)
        if foreign_violations:
            raise ValueError(f"Broken foreign keys: {foreign_violations}")
        counts = {name: db.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0]
                  for name in ("Parlamentar", "Proposicao", "Votacao", "Voto", "Presenca", "EmendaParlamentar", "BemDeclarado")}
        roster = dict(db.execute("SELECT casa, COUNT(*) FROM Parlamentar WHERE ativo=1 GROUP BY casa").fetchall())
        if not checkpoint_only and not (400 <= roster.get("CAMARA", 0) <= 550):
            raise ValueError(f"Active Câmara roster inconsistent: {roster.get('CAMARA')}")
        if not checkpoint_only and not (70 <= roster.get("SENADO", 0) <= 90):
            raise ValueError(f"Active Senado roster inconsistent: {roster.get('SENADO')}")
        if checkpoint_only and sum(counts.values()) < 10:
            raise ValueError("Checkpoint empty; nothing official to persist")
        if not checkpoint_only and counts["Votacao"] < 10:
            raise ValueError("Too few verified votes; refusing to publish an empty rebuild")
        if not checkpoint_only and counts["Voto"] < 10:
            raise ValueError("Too few individual voting records")
        if not checkpoint_only and require_amendments and counts["EmendaParlamentar"] == 0:
            raise ValueError("CGU API configured but no amendments imported")
        checks = {casa: db.execute(
            "SELECT COUNT(*) FROM SyncExecution WHERE status='SUCESSO' AND id LIKE ?",
            (f"history:v1:{casa}:2022-%",),
        ).fetchone()[0] for casa in ("camara", "senado")}
        if not checkpoint_only and min(checks.values()) == 0:
            raise ValueError(f"2022 backfill missing for at least one house: {checks}")
        if db.execute("""SELECT COUNT(*) FROM Votacao
              WHERE placarSim<0 OR placarNao<0 OR placarAbstencao<0
                    OR placarObstrucao<0 OR placarOutros<0""").fetchone()[0]:
            raise ValueError("Negative recorded voting tallies")
        if db.execute("SELECT COUNT(*) FROM EmendaParlamentar WHERE ano<2022 OR ano>strftime('%Y','now')+0").fetchone()[0]:
            raise ValueError("Invalid fiscal year in amendments")
        years = dict(db.execute(
            """SELECT CASE WHEN typeof(dataHora) IN ('integer','real')
                       THEN strftime('%Y',dataHora/1000,'unixepoch')
                       ELSE substr(dataHora,1,4) END AS ano,
                      COUNT(*) FROM Votacao GROUP BY ano"""
        ).fetchall())
        last_vote = db.execute("SELECT MAX(dataHora) FROM Votacao").fetchone()[0]
        return {
            "generation": "rebuilt-v2",
            "validation": "durable_checkpoint" if checkpoint_only else "public_deployment",
            "counts": counts,
            "active_roster": roster,
            "windows_2022_completed": checks,
            "vote_years": years,
            "latest_vote": last_vote,
            "coverage_warning": "Observed source records, not all legislative actions or nominal votes.",
        }
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True, type=Path)
    parser.add_argument("--require-amendments", action="store_true")
    parser.add_argument("--checkpoint-only", action="store_true")
    args = parser.parse_args()
    try:
        report = audit(args.database, args.require_amendments, args.checkpoint_only)
        print(json.dumps(report, ensure_ascii=False, indent=2))
    except Exception as error:
        print(f"CLEAN REBUILD REFUSED: {error}", file=sys.stderr)
        sys.exit(1)
