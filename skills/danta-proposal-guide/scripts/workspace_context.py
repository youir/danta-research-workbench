#!/usr/bin/env python3
"""Resolve the active project; explicit register/activate changes only Path-Map metadata."""
import argparse
import copy
import datetime
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
import uuid


def within(root, name):
    rel = Path(name)
    if not name or rel.is_absolute() or '..' in rel.parts or '\\' in name:
        raise ValueError('Expected a vault-relative POSIX path: ' + str(name))
    target = root / rel
    if any(p.is_symlink() for p in [target, *target.parents] if p == root or root in p.parents):
        raise ValueError('Symlink not allowed: ' + name)
    if root not in target.resolve().parents:
        raise ValueError('Path escapes the vault: ' + name)
    return target


def context(workspace):
    root = workspace.expanduser().resolve()
    marker = json.loads(within(root, '.danta-vault.json').read_text(encoding='utf-8'))
    if marker.get('kind') != 'danta-research-vault':
        raise ValueError('Not a marked research vault.')
    path = within(root, marker['path_map'])
    data = json.loads(path.read_text(encoding='utf-8'))
    if data.get('schema_version') not in (1, 2):
        raise ValueError('Unsupported Path-Map schema.')
    for section in ('roles', 'paths'):
        for value in data[section].values():
            within(root, value)
    within(root, data['active_project'])
    return root, path, data


def registry(root, data):
    projects = data.setdefault('projects', {})
    for key, entry in projects.items():
        if not re.fullmatch(r'P[0-9]{3,}', key):
            raise ValueError('Invalid project ID: ' + key)
        within(root, entry['root'])
    active = data['active_project']
    matches = [key for key, entry in projects.items() if entry['root'] == active]
    if not projects:
        projects['P001'] = {'root': active, 'title': 'Existing project'}
        matches = ['P001']
    if len(matches) != 1:
        raise ValueError('Active project must match exactly one registered root.')
    if data.get('active_project_id', matches[0]) != matches[0]:
        raise ValueError('Active project ID and root disagree; repair metadata before writing.')
    data['active_project_id'] = matches[0]
    if len({Path(entry['root']) for entry in projects.values()}) != len(projects):
        raise ValueError('Project roots must be distinct.')
    roots = [Path(entry['root']) for entry in projects.values()]
    if any(a in b.parents for a in roots for b in roots if a != b):
        raise ValueError('Nested project roots are not allowed.')


def save(path, data, original):
    # Serialize only this metadata file. Refuse simultaneous edits and retain the old map.
    lock = path.with_name(path.name + '.lock')
    with lock.open('x', encoding='utf-8'):
        pass
    temp = None
    try:
        if path.read_bytes() != original:
            raise ValueError('Path-Map changed concurrently; retry after reading it.')
        backup_dir = path.parent / '.path-map-backups'
        if backup_dir.is_symlink():
            raise ValueError('Path-Map backup directory cannot be a symlink.')
        backup_dir.mkdir(exist_ok=True)
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        shutil.copyfile(path, backup_dir / (stamp + '-' + uuid.uuid4().hex[:8] + '.json'))
        fd, name = tempfile.mkstemp(prefix='.path-map-', dir=path.parent)
        temp = Path(name)
        with os.fdopen(fd, 'w', encoding='utf-8') as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
            handle.write('\n')
        os.replace(temp, path)
    finally:
        if temp is not None:
            temp.unlink(missing_ok=True)
        lock.unlink(missing_ok=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--workspace', type=Path, required=True)
    group = ap.add_mutually_exclusive_group()
    group.add_argument('--register', metavar='P002')
    group.add_argument('--activate', metavar='P002')
    ap.add_argument('--project-root')
    ap.add_argument('--title')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()
    root, path, data = context(args.workspace)
    original = path.read_bytes()
    # Recheck the read used for this transaction, not just the later snapshot.
    if json.loads(original) != data:
        raise ValueError('Path-Map changed while reading; retry.')
    registry(root, data)
    if args.register:
        if not re.fullmatch(r'P[0-9]{3,}', args.register) or not args.project_root or not args.title:
            ap.error('Registration requires Pxxx, --project-root and --title.')
        if args.register in data['projects']:
            ap.error('Project ID already exists; nothing replaced.')
        directory = within(root, args.project_root)
        if not directory.is_dir():
            ap.error('Project directory does not exist; create blank records first.')
        data['projects'][args.register] = {'root': args.project_root.rstrip('/'), 'title': args.title}
        registry(root, data)
    elif args.project_root or args.title:
        ap.error('--project-root and --title apply only to --register.')
    if args.activate:
        if args.activate not in data['projects']:
            ap.error('Unknown project ID.')
        old = data['active_project'].rstrip('/')
        new = data['projects'][args.activate]['root'].rstrip('/')
        if not within(root, new).is_dir():
            raise ValueError('Target project directory is unavailable.')
        for section in ('roles', 'paths'):
            for key, value in data[section].items():
                if value == old or value.startswith(old + '/'):
                    data[section][key] = new + value[len(old):]
        data['active_project'] = new
        data['active_project_id'] = args.activate
    missing = [key for key, value in data['roles'].items() if not within(root, value).exists()]
    missing_paths = [key for key, value in data['paths'].items() if not within(root, value).exists()]
    if args.activate and any(key in missing for key in ('current_state', 'idea_canvas', 'decision_log', 'ogsm')):
        raise ValueError('Target project lacks required records: ' + ', '.join(missing))
    if args.register or args.activate:
        data['schema_version'] = 2
        if not args.dry_run:
            save(path, data, original)
    output = copy.deepcopy(data)
    output['missing_roles'] = missing
    output['missing_paths'] = missing_paths
    output['written'] = bool((args.register or args.activate) and not args.dry_run)
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print('Could not resolve workspace: ' + str(exc), file=sys.stderr)
        sys.exit(1)
