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
        for script, name, count in [(primary, 'danta-proposal-guide', len(json.loads((ROOT / 'MANIFEST.json').read_text())['skills'])), (secondary, 'danta-research-mentor', 1)]:
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
        # Nuwa's own date cache must not break repeat installs; other changes still conflict.
        nuwa_dest = tmp / 'nuwa-only'
        call(primary, ['--dest', nuwa_dest, '--only', 'huashu-nuwa'])
        nuwa = nuwa_dest / 'huashu-nuwa'
        assert (nuwa / 'references/skill-template.md').exists()
        marker = nuwa / '.last-update-check'
        marker.write_text('2026-09-24\n')
        call(primary, ['--dest', nuwa_dest, '--only', 'huashu-nuwa'])
        assert marker.read_text() == '2026-09-24\n'
        marker.write_text('not-a-date')
        call(primary, ['--dest', nuwa_dest, '--only', 'huashu-nuwa'], ok=False)
        marker.write_text('2026-09-24\n')
        extra = nuwa / 'unexpected.txt'; extra.write_text('custom content')
        call(primary, ['--dest', nuwa_dest, '--only', 'huashu-nuwa'], ok=False)
        extra.unlink()
        (nuwa / 'SKILL.md').write_text('User-edited skill')
        call(primary, ['--dest', nuwa_dest, '--only', 'huashu-nuwa'], ok=False)
        assert (nuwa / 'SKILL.md').read_text() == 'User-edited skill'
        # Smoke-test upstream deterministic helpers with synthetic, non-personal inputs.
        upstream = ROOT / 'vendor/skills/huashu-nuwa/scripts'
        subtitles = tmp / 'sample.srt'
        subtitles.write_text('1\n00:00:00,000 --> 00:00:01,000\nHello.\n\n2\n00:00:01,000 --> 00:00:02,000\nHello.\n')
        transcript = tmp / 'transcript.txt'
        call(upstream / 'srt_to_transcript.py', [subtitles, transcript])
        assert transcript.read_text().strip() == 'Hello.'
        empty = tmp / 'empty.md'; empty.write_text('Synthetic empty fixture')
        call(upstream / 'quality_check.py', [empty], ok=False)
        fictional = tmp / 'fictional'; (fictional / 'references/research').mkdir(parents=True)
        output = call(upstream / 'merge_research.py', [fictional])
        assert '缺失' in output
        # Selecting the reader installs the shared package; dependency conflict is atomic.
        reader_dest = tmp / 'reader-only'
        call(primary, ['--dest', reader_dest, '--only', 'nature-reader'])
        assert {p.name for p in reader_dest.iterdir()} == {'nature-reader', 'nature-shared'}
        assert (reader_dest / 'nature-shared/core/terminology-ledger.md').is_file()
        call(primary, ['--dest', reader_dest, '--only', 'nature-reader'])
        conflict_dest = tmp / 'dependency-conflict'
        shared = conflict_dest / 'nature-shared'; shared.mkdir(parents=True)
        (shared / 'SKILL.md').write_text('Existing customized support package')
        call(primary, ['--dest', conflict_dest, '--only', 'nature-reader'], ok=False)
        assert not (conflict_dest / 'nature-reader').exists()
        assert (shared / 'SKILL.md').read_text() == 'Existing customized support package'
        copy = tmp / 'work'
        call(ROOT / 'scripts/start_project.py', ['--dest', copy])
        assert (copy / '.codex/agents/danta_evidence.toml').exists()
        assert not (copy / '.git').exists() and not (copy / '.local').exists()
        # Idempotent from the distribution and from inside a marked workspace.
        call(ROOT / 'scripts/start_project.py', ['--dest', copy])
        call(copy / 'scripts/start_project.py', [])
        assert not (copy / '.local').exists()
        call(copy / 'scripts/start_project.py', ['--dest', tmp / 'nested'], ok=False)
        call(ROOT / 'scripts/start_project.py', ['--dest', ''], ok=False)
        # Marked workspaces are preserved; arbitrary existing targets are refused.
        other = tmp / 'occupied';other.mkdir()
        call(ROOT / 'scripts/start_project.py', ['--dest', other], ok=False)
        # Unexpected files and symlinks cannot escape the explicit copy boundary.
        source = tmp / 'distribution'
        shutil.copytree(ROOT, source, ignore=shutil.ignore_patterns('.git','.local','__pycache__'))
        (source / '.env').write_text('FAKE_TEST_VALUE=not-a-secret')
        (source / 'unexpected-notes.txt').write_text('FICTIONAL private note')
        clean = tmp / 'clean'
        call(source / 'scripts/start_project.py', ['--dest', clean])
        assert not (clean / '.env').exists() and not (clean / 'unexpected-notes.txt').exists()
        linked = source / '00_从这里开始.md';linked.unlink()
        try:
            linked.symlink_to(source / 'README.md')
        except OSError:
            print('NOT RUN: symlink-source rejection (platform does not permit creating symlinks)')
        else:
            call(source / 'scripts/start_project.py', ['--dest', tmp / 'bad-source'], ok=False)
            assert not (tmp / 'bad-source').exists()
        call(copy / 'scripts/install_skills.py', ['--verify'])
        (copy / 'skills/danta-proposal-guide/SKILL.md').write_text('Tampered')
        call(copy / 'scripts/install_skills.py', ['--dest', tmp / 'blocked'], ok=False)
        assert not (tmp / 'blocked').exists()
    print(call(ROOT / 'tests/test_research_vault.py', []).strip())
    print('PASS: installers, staging integrity, conflict protection, bounded/idempotent copy, empty target, source symlink, integrity rejection')
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
