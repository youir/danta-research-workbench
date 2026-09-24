#!/usr/bin/env python3
"""Offline integration checks. Never writes to the real skills directory."""
from pathlib import Path
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
ROOT = Path(__file__).resolve().parent.parent

def call(script, args, ok=True):
    result = subprocess.run([sys.executable, str(script), *map(str, args)], capture_output=True, text=True)
    if (result.returncode == 0) != ok:
        raise AssertionError(result.stdout + result.stderr)
    return result.stdout

def main():
    primary = ROOT / 'scripts/install_skills.py'
    secondary = ROOT / 'variants/mentor-agent/install_agent.py'
    with tempfile.TemporaryDirectory(prefix='danta-release-') as tmp:
        tmp = Path(tmp)
        for script, name, count in [(primary, 'danta-proposal-guide', 8), (secondary, 'danta-research-mentor', 1)]:
            dest = tmp / name
            call(script, ['--dest', dest, '--dry-run'])
            assert not dest.exists()
            call(script, ['--dest', dest])
            assert len(list(dest.iterdir())) == count
            call(script, ['--dest', dest])
            changed = dest / name / 'SKILL.md'
            changed.write_text('Existing custom skill', encoding='utf-8')
            call(script, ['--dest', dest], ok=False)
            assert changed.read_text() == 'Existing custom skill'
        copy = tmp / 'work'
        call(ROOT / 'scripts/start_project.py', ['--dest', copy])
        assert (copy / '.codex/agents/danta_evidence.toml').exists()
        assert not (copy / '.git').exists() and not (copy / '.local').exists()
        call(ROOT / 'scripts/start_project.py', ['--dest', copy], ok=False)
        call(copy / 'scripts/install_skills.py', ['--verify'])
        (copy / 'skills/danta-proposal-guide/SKILL.md').write_text('Tampered')
        call(copy / 'scripts/install_skills.py', ['--dest', tmp / 'blocked'], ok=False)
        assert not (tmp / 'blocked').exists()
    print('PASS: both installers, no-write dry run, repeat, conflict protection, isolated copy, integrity rejection')
    checked = 0
    for file in ROOT.rglob('*.md'):
        if any(part in file.parts for part in ('.git', '.local', 'vendor', '__pycache__')):
            continue
        for target in re.findall(r'\]\(([^)]+)\)', file.read_text(encoding='utf-8')):
            if '://' in target or target.startswith('#'):
                continue
            assert (file.parent / target.split('#')[0]).exists(), (file, target)
            checked += 1
    print('PASS: local authored documentation links', checked)
    try:
        import tomllib
    except ImportError:
        try:
            import tomli as tomllib
        except ImportError:
            print('NOT RUN: TOML parsing needs Python 3.11+ or tomli; installation still works with Python 3.9+.')
            return 0
    configs = [ROOT / '.codex', ROOT / 'variants/mentor-agent/研究工作区/.codex']
    for base in configs:
        settings = tomllib.loads((base / 'config.toml').read_text())
        assert settings['agents']['max_concurrent_threads_per_session'] == 3
        for file in (base / 'agents').glob('*.toml'):
            data = tomllib.loads(file.read_text())
            assert all(data.get(k) for k in ['name', 'description', 'developer_instructions'])
            assert data['sandbox_mode'] == 'read-only'
            assert 'model' not in data
    print('PASS: TOML syntax and required role fields; this is not a live subagent execution test')
    return 0

if __name__ == '__main__':
    sys.exit(main())
