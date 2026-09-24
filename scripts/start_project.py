#!/usr/bin/env python3
"""Create a bounded research working copy, or return the current marked copy."""
import argparse
import json
from pathlib import Path
import shutil
import sys
import tempfile
ROOT = Path(__file__).resolve().parent.parent
MARKER = '.danta-workspace.json'

def plan():
    data = json.loads((ROOT / 'project-files.json').read_text(encoding='utf-8'))
    files = data['files']
    for relative in files:
        rel = Path(relative)
        if rel.is_absolute() or '..' in rel.parts:
            raise ValueError('Invalid project file path: ' + relative)
        source = ROOT / rel
        if source.is_symlink() or any(p.is_symlink() for p in source.parents if p != ROOT and ROOT in p.parents):
            raise ValueError('Symlink in published project files: ' + relative)
        if not source.is_file():
            raise ValueError('Published project file missing: ' + relative)
    return files

def marked(folder):
    try:
        data = json.loads((folder / MARKER).read_text(encoding='utf-8'))
        return data.get('kind') == 'danta-research-workspace' and data.get('version') == 1
    except (OSError, ValueError):
        return False

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--dest', help='New directory outside the checkout or under its .local/.')
    args = ap.parse_args()
    if args.dest is None and marked(ROOT):
        print('Already a research working copy: ' + str(ROOT))
        return 0
    if args.dest is not None and not args.dest.strip():
        ap.error('--dest must not be empty.')
    dest = Path(args.dest).expanduser().absolute() if args.dest is not None else ROOT / '.local/research-workbench'
    if dest.is_symlink():
        ap.error('Target is a symbolic link; nothing changed.')
    dest = dest.resolve()
    if dest.exists():
        if marked(dest):
            print('Existing research working copy preserved: ' + str(dest))
            return 0
        ap.error('Target exists and is not a marked working copy; choose a new directory.')
    if dest == ROOT or (ROOT in dest.parents and ROOT / '.local' not in dest.parents):
        ap.error('Inside this repository, use a directory under .local/.')
    if marked(ROOT):
        ap.error('This is already a working copy. Create fresh templates from the distribution, not from research records.')
    files = plan()  # Validate every source before creating the target.
    dest.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix='.danta-copy-', dir=dest.parent))
    claimed = False
    try:
        for relative in files:
            source = ROOT / relative
            output = stage / relative
            output.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, output)
        (stage / MARKER).write_text(json.dumps({'kind':'danta-research-workspace','version':1},indent=2)+'\n',encoding='utf-8')
        dest.mkdir()  # Exclusive claim: do not replace a concurrently-created target.
        claimed = True
        for child in stage.iterdir():
            shutil.move(str(child), str(dest / child.name))
    except Exception:
        if claimed:
            shutil.rmtree(dest)
        raise
    finally:
        shutil.rmtree(stage)
    print('Open this research working copy: ' + str(dest))
    print('Only distribution files copied; unrelated files and existing research remain untouched.')
    return 0

if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError) as exc:
        print('Could not create working copy: ' + str(exc), file=sys.stderr)
        sys.exit(1)
