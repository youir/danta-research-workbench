#!/usr/bin/env python3
"""Install the pinned offline skills without overwriting existing directories."""
import argparse
import os
import shutil
import sys
import tempfile
from pathlib import Path
from package_lib import ROOT, default_dest, manifest, verify_bundle, same_install

def main():
    if sys.version_info < (3, 9):
        print('需要 Python 3.9 或更新版本。', file=sys.stderr)
        return 1
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--dest', type=Path, default=default_dest())
    ap.add_argument('--verify', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--only', nargs='+', help='One or more skill names')
    args = ap.parse_args()
    data = manifest()
    errors = verify_bundle(data)
    if errors:
        print('完整性检查失败；未进行安装。\n' + '\n'.join(errors), file=sys.stderr)
        return 1
    print('安装源完整性检查通过；各模块固定来源见 MANIFEST.json。')
    if args.verify:
        return 0
    selected = args.only or list(data['skills'])
    unknown = set(selected) - set(data['skills'])
    if unknown:
        ap.error('Unknown skills: ' + ', '.join(sorted(unknown)))
    # Resolve sibling skill dependencies before changing the destination.
    ordered, visiting = [], set()
    def add(name):
        if name in ordered:
            return
        if name in visiting:
            raise ValueError('Cyclic skill dependency: ' + name)
        if name not in data['skills']:
            raise ValueError('Missing bundled dependency: ' + name)
        visiting.add(name)
        for dependency in data['skills'][name].get('dependencies', []):
            add(dependency)
        visiting.remove(name)
        ordered.append(name)
    for name in selected:
        add(name)
    selected = ordered
    dest = args.dest.expanduser().resolve()
    print('安装目标：' + str(dest))
    conflicts = [name for name in selected
                 if ((dest / name).exists() or (dest / name).is_symlink())
                 and not same_install(dest / name, data['skills'][name])]
    if conflicts:
        print('冲突，保留现有；本次未安装任何技能：' + ', '.join(conflicts))
        return 2
    for name in selected:
        info = data['skills'][name]
        target = dest / name
        if target.exists() or target.is_symlink():
            if same_install(target, info):
                print('[相同，跳过] ' + name)
            else:
                conflicts.append(name)
                print('[冲突，保留现有] ' + name)
            continue
        if args.dry_run:
            print('[计划安装] ' + name)
            continue
        dest.mkdir(parents=True, exist_ok=True)
        stage = Path(tempfile.mkdtemp(prefix='.danta-install-', dir=dest))
        try:
            shutil.copytree(ROOT / info['source'], stage / name,
                            ignore=shutil.ignore_patterns('__pycache__', '.DS_Store'))
            if not same_install(stage / name, info):
                raise ValueError('Staged files failed verification: ' + name)
            # Exclusive directory creation prevents replacing a concurrent install.
            target.mkdir()
            try:
                for child in (stage / name).iterdir():
                    shutil.move(str(child), str(target / child.name))
            except Exception:
                shutil.rmtree(target)
                raise
            print('[已安装] ' + name)
        finally:
            shutil.rmtree(stage)
    if conflicts:
        print('现有技能未被覆盖；请核对冲突版本：' + ', '.join(conflicts))
        return 2
    if not args.dry_run:
        print('安装完成。请在下一轮对话调用 $danta-proposal-guide；文件安装不等于扩展依赖已配置。')
    return 0

if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError) as exc:
        print('未能完成：' + str(exc), file=sys.stderr)
        sys.exit(1)
