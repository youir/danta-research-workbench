#!/usr/bin/env python3
"""Create a fresh private Obsidian research vault from verified distribution files."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile
from package_lib import manifest, verify_bundle

ROOT = Path(__file__).resolve().parent.parent
MARKER = '.danta-vault.json'


def marked(path):
    try:
        info = json.loads((path / MARKER).read_text(encoding='utf-8'))
        return info.get('kind') == 'danta-research-vault' and info.get('version') == 1
    except (ValueError, OSError):
        return False


def source_plan():
    data = json.loads((ROOT / 'vault-template.json').read_text(encoding='utf-8'))
    base = ROOT / data['source']
    if base.is_symlink():
        raise ValueError('Template source is a symlink.')
    got = {p.relative_to(base).as_posix() for p in base.rglob('*') if p.is_file() and p.name != '.DS_Store' and '__pycache__' not in p.parts}
    if got != set(data['files']):
        raise ValueError('Template files differ from the reviewed distribution.')
    plan = []
    for name, expected in data['files'].items():
        rel = Path(name)
        if rel.is_absolute() or '..' in rel.parts:
            raise ValueError('Invalid template path: ' + name)
        src = base / rel
        if src.is_symlink() or any(p.is_symlink() for p in src.parents if p == ROOT or ROOT in p.parents):
            raise ValueError('Symlink in template: ' + name)
        if hashlib.sha256(src.read_bytes()).hexdigest() != expected:
            raise ValueError('Template checksum mismatch: ' + name)
        plan.append((src, rel))
    data = manifest()
    errors = verify_bundle(data)
    if errors:
        raise ValueError('Skill integrity check failed: ' + '; '.join(errors))
    # Include the selected primary skill and its transitive support modules.
    selected, visiting = [], set()
    def add_skill(name):
        if name in selected:
            return
        if name in visiting:
            raise ValueError('Cyclic skill dependency: ' + name)
        if name not in data['skills']:
            raise ValueError('Missing bundled dependency: ' + name)
        visiting.add(name)
        for dependency in data['skills'][name].get('dependencies', []):
            add_skill(dependency)
        visiting.remove(name)
        selected.append(name)
    add_skill('danta-proposal-guide')
    for skill in selected:
        info = data['skills'][skill]
        for name in info['files']:
            plan.append((ROOT / info['source'] / name, Path('.agents/skills') / skill / name))
    # Roles are copied from the same reviewed project distribution, never global configuration.
    listed = json.loads((ROOT / 'project-files.json').read_text(encoding='utf-8'))['files']
    for name in listed:
        if name.startswith('.codex/'):
            src = ROOT / name
            if src.is_symlink() or any(p.is_symlink() for p in src.parents if ROOT in p.parents):
                raise ValueError('Symlink in project role configuration.')
            plan.append((src, Path(name)))
    return plan


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--dest', help='New vault path; defaults to .local/research-vault in the distribution.')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()
    if args.dest is not None and not args.dest.strip():
        ap.error('--dest must not be empty.')
    requested = Path(args.dest).expanduser().absolute() if args.dest is not None else ROOT / '.local/research-vault'
    if requested.is_symlink():
        ap.error('Target is a symlink; nothing changed.')
    dest = requested.resolve()
    if dest == ROOT or (ROOT in dest.parents and ROOT / '.local' not in dest.parents):
        ap.error('Within the public distribution, use only .local/.')
    if dest.exists():
        if marked(dest):
            print('Existing vault preserved (no upgrade or merge): ' + str(dest))
            return 0
        ap.error('Target already exists. Choose a new directory; nothing overwritten.')
    plan = source_plan()
    if args.dry_run:
        print('Would copy %s files to %s; no files written.' % (len(plan), dest))
        return 0
    dest.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix='.danta-vault-', dir=dest.parent))
    claimed = False
    try:
        for source, relative in plan:
            out = stage / relative
            out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, out)
        dest.mkdir()  # Exclusive claim, preserving a concurrent creator's files.
        claimed = True
        for child in stage.iterdir():
            shutil.move(str(child), str(dest / child.name))
    except Exception:
        if claimed:
            shutil.rmtree(dest)
        raise
    finally:
        shutil.rmtree(stage)
    print('Open this same folder in Obsidian and Codex: ' + str(dest))
    print('Start with 00_index.md. No existing vault, global config or research data was modified.')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError) as exc:
        print('Could not create vault: ' + str(exc), file=sys.stderr)
        sys.exit(1)
