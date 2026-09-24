#!/usr/bin/env python3
"""Create an untracked working copy; do not overwrite existing research."""
import argparse
from pathlib import Path
import shutil
import sys
ROOT = Path(__file__).resolve().parent.parent

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--dest', type=Path, default=ROOT / '.local' / 'research-workbench')
    args = ap.parse_args()
    dest = args.dest.expanduser().resolve()
    if dest.exists():
        ap.error('Target exists; choose a new folder. Nothing overwritten.')
    if dest == ROOT or (ROOT in dest.parents and ROOT / '.local' not in dest.parents):
        ap.error('Inside this repository, use a new folder under .local/.')
    # Exclude .local everywhere so a copy inside this repository cannot recurse.
    shutil.copytree(ROOT, dest, ignore=shutil.ignore_patterns('.git', '.local', '__pycache__', '.DS_Store'))
    print('Open this working copy in your AI client: ' + str(dest))
    print('Research files belong here, not in the published template repository.')
    return 0
if __name__ == '__main__':
    try:
        sys.exit(main())
    except OSError as exc:
        print('Could not create working copy: ' + str(exc), file=sys.stderr)
        sys.exit(1)
