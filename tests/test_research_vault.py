#!/usr/bin/env python3
"""Isolated vault initialization and record-preservation regression tests."""
from pathlib import Path
import json
import shutil
import subprocess
import sys
import tempfile
ROOT=Path(__file__).resolve().parent.parent


def run(script,*args,ok=True):
    r=subprocess.run([sys.executable,str(script),*map(str,args)],capture_output=True,text=True)
    assert (r.returncode==0)==ok,r.stdout+r.stderr
    return r.stdout


def main():
    init=ROOT/'scripts/create_research_vault.py'
    with tempfile.TemporaryDirectory(prefix='danta-vault-test-') as t:
        temp=Path(t); dest=temp/'00_科研知识库_Research-Vault'
        run(init,'--dest',dest,'--dry-run'); assert not dest.exists()
        run(init,'--dest',dest)
        assert (dest/'.agents/skills/danta-proposal-guide/references/knowledge-vault.md').exists()
        assert (dest/'.agents/skills/danta-research-ppt/SKILL.md').exists()
        assert (dest/'.agents/skills/danta-research-ppt/scripts/install_ppt_master.py').exists()
        assert not (dest/'.agents/skills/ppt-master').exists()
        assert (dest/'12_笔记模板_Templates/14_科研图_Figure.md').exists()
        assert (dest/'08_成果输出_Outputs/03_图表_Figures/00_index.md').exists()
        assert (dest/'08_成果输出_Outputs/04_科研汇报与答辩_Presentations/00_index.md').exists()
        assert (dest/'.codex/agents/danta_evidence.toml').exists()
        assert not (dest/'我的开题').exists()
        run(ROOT/'scripts/validate_research_vault.py',dest)
        # A broken local reference or a path escaping the vault must fail validation.
        home=dest/'00_index.md'; saved=home.read_text()
        home.write_text(saved+'\n[broken](missing.md)\n')
        run(ROOT/'scripts/validate_research_vault.py',dest,ok=False)
        home.write_text(saved)
        mapping_file=dest/'00_系统_System/03_路径映射_Path-Map.json'
        mapping_text=mapping_file.read_text(); bad=json.loads(mapping_text)
        bad['roles']['current_state']='../outside.md'
        mapping_file.write_text(json.dumps(bad))
        run(ROOT/'scripts/validate_research_vault.py',dest,ok=False)
        mapping_file.write_text(mapping_text)
        # Simulated real user edits must survive repeated initialization.
        current=json.loads((dest/'00_系统_System/03_路径映射_Path-Map.json').read_text())['roles']['current_state']
        (dest/current).write_text('FICTIONAL user research -- keep this exact file',encoding='utf-8')
        (dest/'.obsidian/app.json').write_text('{"custom":true}')
        run(init,'--dest',dest)
        assert (dest/current).read_text()=='FICTIONAL user research -- keep this exact file'
        assert (dest/'.obsidian/app.json').read_text()=='{"custom":true}'
        occupied=temp/'occupied'; occupied.mkdir();(occupied/'keep.md').write_text('keep')
        run(init,'--dest',occupied,ok=False)
        assert list(occupied.iterdir())==[occupied/'keep.md']
        run(init,'--dest','',ok=False)
        alias=temp/'alias'
        try:
            alias.symlink_to(dest,target_is_directory=True)
        except OSError:
            print('NOT RUN: target symlink test (platform permission)')
        else:
            run(init,'--dest',alias,ok=False)
        # Reject tampered template or symlink without a partially-created target.
        clone=temp/'distribution'
        shutil.copytree(ROOT,clone,ignore=shutil.ignore_patterns('.git','.local','__pycache__'))
        template=clone/'templates/00_科研知识库_Research-Vault'
        file=template/'00_index.md'; original=file.read_bytes()
        file.write_text('Tampered')
        run(clone/'scripts/create_research_vault.py','--dest',temp/'tampered',ok=False)
        assert not (temp/'tampered').exists()
        file.write_bytes(original); file.unlink()
        try:
            file.symlink_to(occupied/'keep.md')
        except OSError:
            print('NOT RUN: source symlink test (platform permission)')
        else:
            run(clone/'scripts/create_research_vault.py','--dest',temp/'linked',ok=False)
            assert not (temp/'linked').exists()
    print('PASS: fresh vault, no-write preview, paths/links, preserved records/config, occupied and symlink refusal, template integrity')

if __name__=='__main__':main()
