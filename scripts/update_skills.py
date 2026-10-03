#!/usr/bin/env python3
"""Update only unchanged managed skills, with backups and rollback; never merge research."""
import argparse
import datetime
import json
from pathlib import Path
import shutil
import sys
import tempfile
import uuid
from package_lib import ROOT, default_dest, manifest, same_install, verify_bundle
from skill_deployment import content_version, read_receipt, receipt_path, updated_receipt, write_receipt


def selected_skills(data, names):
    ordered, visiting = [], set()
    def add(name):
        if name in ordered:
            return
        if name in visiting or name not in data['skills']:
            raise ValueError('Unknown or cyclic dependency: ' + name)
        visiting.add(name)
        for child in data['skills'][name].get('dependencies', []):
            add(child)
        visiting.remove(name)
        ordered.append(name)
    for name in names:
        add(name)
    return ordered


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--dest', type=Path, default=default_dest())
    ap.add_argument('--only', nargs='+', default=['danta-proposal-guide'])
    ap.add_argument('--apply', action='store_true', help='Apply the displayed plan; default is read-only')
    ap.add_argument('--baseline', type=Path, help='Reviewed old MANIFEST.json for legacy receipt-less installs')
    args = ap.parse_args()
    requested = args.dest.expanduser().absolute()
    if requested.is_symlink() or any(p.is_symlink() for p in requested.parents):
        raise ValueError('Skill destination cannot contain symlinks.')
    dest = requested.resolve()
    data = manifest()
    errors = verify_bundle(data)
    if errors:
        raise ValueError('Distribution integrity failed: ' + '; '.join(errors))
    selected = selected_skills(data, args.only)
    receipt = read_receipt(dest)
    baseline = {}
    if args.baseline:
        baseline = json.loads(args.baseline.read_text(encoding='utf-8'))['skills']
    changes, conflicts = [], []
    old_infos = {}
    print('Distribution content version: ' + content_version())
    for name in selected:
        target = dest / name
        info = data['skills'][name]
        if same_install(target, info):
            print('[current ' + content_version() + '] ' + name)
            continue
        if not target.exists() and not target.is_symlink():
            print('[install] ' + name)
            changes.append(name)
            old_infos[name] = None
            continue
        old = receipt['skills'].get(name) or baseline.get(name)
        if old is None or not same_install(target, old):
            conflicts.append(name)
            print('[preserve: untracked version or local edits] ' + name)
        else:
            old_infos[name] = old
            changes.append(name)
            print('[update ' + old.get('content_version', 'legacy verified baseline') + ' -> ' + content_version() + '] ' + name)
    if conflicts:
        print('No skills changed. Review conflicts individually; no force overwrite is provided.')
        return 2
    if not args.apply:
        print('Plan only. Use --apply after requesting this update. Research, AGENTS and personal config are excluded.')
        return 0
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.mkdir(exist_ok=True)
    lock = dest.parent / '.danta-skill-update.lock'
    with lock.open('x', encoding='utf-8'):
        pass
    stage = None
    backup = None
    completed = []
    moved_old = []
    try:
        # Do not proceed with a receipt changed after the preflight.
        if read_receipt(dest) != receipt:
            raise ValueError('Deployment changed concurrently; retry.')
        stage = Path(tempfile.mkdtemp(prefix='.danta-update-', dir=dest.parent))
        for name in changes:
            shutil.copytree(ROOT / data['skills'][name]['source'], stage / name,
                            ignore=shutil.ignore_patterns('__pycache__', '.DS_Store'))
            if not same_install(stage / name, data['skills'][name]):
                raise ValueError('Staging checksum failed: ' + name)
        if changes:
            backups = dest.parent / 'danta-skill-backups'
            if backups.is_symlink():
                raise ValueError('Backup directory cannot be a symlink.')
            stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
            backup = backups / (stamp + '-' + uuid.uuid4().hex[:8])
            backup.mkdir(parents=True)
            if receipt_path(dest).exists():
                shutil.copyfile(receipt_path(dest), backup / 'receipt-before.json')
            for name in changes:
                target = dest / name
                old = old_infos[name]
                if old is not None:
                    if not same_install(target, old):
                        raise ValueError('Skill changed during update: ' + name)
                    target.rename(backup / name)
                    moved_old.append(name)
                elif target.exists() or target.is_symlink():
                    raise ValueError('Concurrent installation: ' + name)
                (stage / name).rename(target)
                completed.append(name)
        for name in selected:
            if not same_install(dest / name, data['skills'][name]):
                raise ValueError('Post-copy integrity failed: ' + name)
        write_receipt(dest, updated_receipt(dest, data, selected))
    except Exception:
        # Restore already replaced directories, including a failed replacement after the old move.
        for name in reversed(completed):
            shutil.rmtree(dest / name)
        for name in reversed(moved_old):
            (backup / name).rename(dest / name)
        raise
    finally:
        if stage is not None:
            shutil.rmtree(stage)
        lock.unlink(missing_ok=True)
    print('Managed skills updated. Start a new conversation to load them.')
    if backup:
        print('Backup retained outside skill discovery: ' + str(backup))
    print('Private notes, grants, Path-Map, AGENTS and Codex/Jev configuration were not replaced.')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print('Could not update skills: ' + str(exc), file=sys.stderr)
        sys.exit(1)
