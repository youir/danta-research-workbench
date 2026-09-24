#!/usr/bin/env python3
"""Install the bundled skill offline. Standard library, Python 3.9+."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile

NAME = 'danta-research-mentor'
ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'skills' / NAME


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inventory(folder):
    result = {}
    for item in sorted(folder.rglob('*')):
        if item.is_symlink():
            raise ValueError('Symbolic links are not supported: ' + str(item))
        if item.is_file():
            result[item.relative_to(folder).as_posix()] = digest(item)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dest', type=Path, help='Skills parent directory; existing skills are never overwritten.')
    parser.add_argument('--dry-run', action='store_true', help='Verify package and print destination without writing.')
    args = parser.parse_args()
    expected = json.loads((ROOT / 'skill-manifest.json').read_text(encoding='utf-8'))
    if not SOURCE.is_dir() or SOURCE.is_symlink():
        raise ValueError('Bundled skill is missing or is a symbolic link.')
    current = inventory(SOURCE)
    if current != expected['files']:
        raise ValueError('Bundled skill differs from its manifest; installation stopped.')
    base = args.dest or Path(os.environ.get('CODEX_HOME') or (Path.home() / '.codex')) / 'skills'
    base = base.expanduser().absolute()
    target = base / NAME
    if target.is_symlink():
        raise ValueError('Destination is a symbolic link; installation stopped.')
    if target.exists():
        if target.is_dir() and inventory(target) == current:
            print('Already installed with identical files: ' + str(target))
            return 0
        raise ValueError('A different skill already exists. Nothing overwritten: ' + str(target))
    if base.exists() and not base.is_dir():
        raise ValueError('Destination parent is not a directory: ' + str(base))
    print(('Would install: ' if args.dry_run else 'Installing: ') + str(target))
    if args.dry_run:
        return 0
    base.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix='.danta-install-', dir=base))
    try:
        copy = staging / NAME
        shutil.copytree(SOURCE, copy)
        if inventory(copy) != current:
            raise ValueError('Copied files failed verification.')
        # Avoid replacing an existing target, including one created during copying.
        if target.exists() or target.is_symlink():
            raise ValueError('Destination appeared during installation; nothing overwritten.')
        copy.rename(target)
    finally:
        shutil.rmtree(staging)
    print('Installed and verified. Try $danta-research-mentor on your next turn.')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError) as exc:
        print('Installation stopped: ' + str(exc), file=sys.stderr)
        sys.exit(1)
