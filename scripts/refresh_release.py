#!/usr/bin/env python3
"""Maintainer tool: rebuild manifests from reviewed, tracked distribution files."""
import hashlib
import json
from pathlib import Path
import subprocess
ROOT = Path(__file__).resolve().parent.parent

def hashes(root, tracked_files):
    """Hash only explicitly Git-tracked files; never sweep personal/untracked files into a release."""
    root = root.resolve()
    result = {}
    for repo_path in sorted(tracked_files):
        path = ROOT / repo_path
        if path.is_file() and not path.is_symlink() and (path == root or root in path.parents):
            result[path.relative_to(root).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result

def main():
    tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    tracked_set = {x for x in tracked if x}
    files = sorted(set(x for x in tracked_set if x != '.gitignore'))
    # No local research or symlinks are distribution files.
    for name in files:
        path = ROOT / name
        if name.startswith('.local/') or path.is_symlink() or not path.is_file():
            raise ValueError('Invalid tracked distribution file: ' + name)
    files = sorted(set(files + ['project-files.json']))
    (ROOT / 'project-files.json').write_text(json.dumps({'version':1,'files':files},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    path = ROOT / 'MANIFEST.json';data = json.loads(path.read_text())
    for item in data['skills'].values():item['files'] = hashes(ROOT / item['source'], tracked_set)
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    base = ROOT / 'variants/mentor-agent';path = base / 'skill-manifest.json';data = json.loads(path.read_text())
    data['files'] = hashes(base / 'skills/danta-research-mentor', tracked_set)
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    vault = ROOT / 'templates/00_科研知识库_Research-Vault'
    if vault.exists():
        (ROOT / 'vault-template.json').write_text(json.dumps({'version': 1, 'source': vault.relative_to(ROOT).as_posix(), 'files': hashes(vault, tracked_set)}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Refreshed skill hashes and',len(files),'explicit project files. Review the diff before release.')

if __name__ == '__main__':main()
