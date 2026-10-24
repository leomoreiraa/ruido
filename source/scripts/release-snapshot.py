"""Release transport for immutable public snapshots (invoke with python -I)."""
import argparse
import gzip
import shutil
import json
import os
from pathlib import Path
import re
import subprocess
import sys

SNAPSHOT = Path(__file__).with_name('sqlite-snapshot.py')
CLEAN_TAG = re.compile(r'rebuilt-v2-\d+-\d+')


def gh(*args):
    return subprocess.check_output(['gh', *args], text=True)


def validate(database, manifest, destination=None):
    args = [sys.executable, '-I', str(SNAPSHOT), 'restore' if destination else 'verify',
            '--database', str(database), '--manifest', str(manifest)]
    if destination:
        args += ['--destination', str(destination)]
    subprocess.run(args, check=True)


def unpack(work_dir):
    """Read legacy public.sqlite or unpack the gzip successor, fail closed on corruption."""
    raw = work_dir / 'public.sqlite'
    compressed = work_dir / 'public.sqlite.gz'
    if raw.is_file():
        return raw
    if not compressed.is_file() or compressed.is_symlink():
        raise ValueError('No official SQLite asset found')
    temp = work_dir / 'public.sqlite.partial'
    if temp.exists() or raw.exists():
        raise ValueError('Unexpected existing SQLite output')
    count = 0
    try:
        with gzip.open(compressed, 'rb') as src, temp.open('xb') as dst:
            while True:
                block = src.read(1024 * 1024)
                if not block:
                    break
                count += len(block)
                if count > 2_000_000_000:
                    raise ValueError('Uncompressed snapshot exceeds safety limit')
                dst.write(block)
        temp.replace(raw)
    except Exception:
        temp.unlink(missing_ok=True)
        raise
    return raw


def pack(database, destination):
    """Stream immutable SQLite bytes; manifest SHA remains for raw contents."""
    with database.open('rb') as src, destination.open('xb') as dst:
        with gzip.GzipFile(fileobj=dst, mode='wb', compresslevel=3, mtime=0, filename='') as out:
            shutil.copyfileobj(src, out, 1024 * 1024)
    return destination


def latest_published(repository):
    """Only canonical, fully published generation-v2 Releases are eligible."""
    pages = json.loads(gh('api', '--paginate', '--slurp',
                          f'repos/{repository}/releases?per_page=100'))
    snapshots = [r for page in pages for r in page
                 if isinstance(r, dict) and 'tag_name' in r and CLEAN_TAG.fullmatch(r['tag_name'])]
    published = [r for r in snapshots
                 if not r.get('draft') and not r.get('prerelease') and r.get('published_at')]
    return (max(published, key=lambda r: (r['published_at'], r['id']))
            if published else None), bool(snapshots)


def assert_baseline(repository, baseline_tag):
    """Optimistic version check. Actions shared concurrency is the primary lock."""
    latest, _ = latest_published(repository)
    actual = latest['tag_name'] if latest else ''
    if actual != baseline_tag:
        raise ValueError(
            f'STALE_SNAPSHOT: expected baseline {baseline_tag or "<empty>"}, '
            f'but the newest official Release is {actual or "<empty>"}. '
            'Do not publish or overwrite; restore the latest snapshot and re-run the collector.'
        )


def restore(args):
    latest, existing_snapshots = latest_published(args.repository)
    if not latest:
        if os.environ.get('BOOTSTRAP') != 'true' or existing_snapshots:
            raise ValueError('No clean-generation snapshot available; fresh initialization must be explicitly enabled')
        if args.destination.exists():
            raise ValueError('Bootstrap destination already exists')
        with args.github_output.open('a', encoding='utf-8') as output:
            output.write('previous=\n')
            output.write('previous_published_at=\n')
            output.write('previous_tag=\n')
        print('Clean-generation first bootstrap authorized. Legacy public-data snapshots will NOT be read.')
        return
    args.work_dir.mkdir(parents=True, exist_ok=False)
    gh('release', 'download', latest['tag_name'], '--repo', args.repository,
       '--pattern', 'public.sqlite*', '--pattern', 'manifest.json', '--dir', str(args.work_dir))
    database, manifest = unpack(args.work_dir), args.work_dir / 'manifest.json'
    validate(database, manifest, args.destination)
    with args.github_output.open('a', encoding='utf-8') as output:
        output.write(f'previous={database}\n')
        output.write(f'previous_published_at={latest["published_at"]}\n')
        output.write(f'previous_tag={latest["tag_name"]}\n')
    print(f'Restored CLEAN rebuild generation release {latest["tag_name"]}. Legacy releases ignored.')


def publish(args):
    if not CLEAN_TAG.fullmatch(args.tag):
        raise ValueError('Invalid immutable snapshot tag')
    database, manifest = args.candidate / 'public.sqlite', args.candidate / 'manifest.json'
    validate(database, manifest)
    if args.baseline_tag is None:
        raise ValueError('Explicit --baseline-tag required (use empty string only for bootstrap)')
    assert_baseline(args.repository, args.baseline_tag)
    if args.baseline_manifest and args.baseline_manifest.is_file():
        current = json.loads(manifest.read_text(encoding='utf-8'))
        baseline = json.loads(args.baseline_manifest.read_text(encoding='utf-8'))
        if current.get('sha256') == baseline.get('sha256') and current.get('schema_sha256') == baseline.get('schema_sha256'):
            if os.environ.get('GITHUB_OUTPUT'):
                with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as out:
                    out.write('changed=false\n')
            print('Unchanged verified SQLite: no new Release required')
            return
    gh('release', 'create', args.tag, '--repo', args.repository, '--target', args.commit,
       '--draft', '--title', args.tag, '--notes',
       'Rebuilt from official APIs (generation rebuilt-v2). No legacy SQLite imports. '
       'Coverage describes observed records, not historical completeness.')
    compressed = pack(database, args.candidate / 'public.sqlite.gz')
    gh('release', 'upload', args.tag, str(compressed), str(manifest), '--repo', args.repository)
    assert_baseline(args.repository, args.baseline_tag)
    gh('release', 'edit', args.tag, '--repo', args.repository, '--draft=false', '--latest=false')
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as out:
            out.write('changed=true\n')
    print(f'Published clean-generation snapshot {args.tag}.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    load = commands.add_parser('restore')
    load.add_argument('--repository', required=True)
    load.add_argument('--destination', type=Path, required=True)
    load.add_argument('--work-dir', type=Path, required=True)
    load.add_argument('--github-output', type=Path, required=True)
    extract = commands.add_parser('unpack')
    extract.add_argument('--work-dir', type=Path, required=True)
    compact = commands.add_parser('pack')
    compact.add_argument('--work-dir', type=Path, required=True)
    save = commands.add_parser('publish')
    save.add_argument('--repository', required=True)
    save.add_argument('--candidate', type=Path, required=True)
    save.add_argument('--tag', required=True)
    save.add_argument('--commit', required=True)
    save.add_argument('--baseline-manifest', type=Path)
    save.add_argument('--baseline-tag', required=True,
                      help='Tag restored at start of the run; empty only for bootstrap')
    args = parser.parse_args()
    if args.command == 'unpack':
        unpack(args.work_dir)
        return
    if args.command == 'pack':
        pack(args.work_dir / 'public.sqlite', args.work_dir / 'public.sqlite.gz')
        return
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', args.repository):
        raise ValueError('Invalid repository')
    (restore if args.command == 'restore' else publish)(args)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Release snapshot failed: {error}', file=sys.stderr)
        sys.exit(1)
