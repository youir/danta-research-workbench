#!/usr/bin/env python3
"""Read-only structural checks; does not assess scientific correctness or Obsidian UI."""
import argparse
import json
from pathlib import Path
import re
from urllib.parse import unquote


def check(root):
    root = root.resolve()
    marker = json.loads((root / '.danta-vault.json').read_text(encoding='utf-8'))
    assert marker['kind'] == 'danta-research-vault'
    def within(relative):
        path = root / relative
        assert not Path(relative).is_absolute() and '..' not in Path(relative).parts, relative
        assert not path.is_symlink(), relative
        resolved = path.resolve()
        assert resolved == root or root in resolved.parents, relative
        assert resolved.exists(), relative
        return resolved
    mapping = json.loads(within(marker['path_map']).read_text(encoding='utf-8'))
    assert marker['active_project'] == mapping['active_project']
    within(mapping['active_project'])
    assert len(set(mapping['paths'].values())) == len(mapping['paths'])
    for path in list(mapping['paths'].values()) + list(mapping['roles'].values()):
        within(path)
    ids = {}; links = 0; notes = 0
    for folder in root.rglob('*'):
        rel = folder.relative_to(root)
        if any(part.startswith('.') for part in rel.parts):
            continue
        assert not folder.is_symlink(), rel
        if folder.is_dir():
            # Advisor generated packages preserve upstream names and are separate self-contained assets.
            advisor = Path(mapping['roles']['advisor_profiles'])
            if advisor in rel.parents:
                continue
            assert re.match(r'^\d{2}_', folder.name), rel
            assert (folder / '00_index.md').is_file(), rel
    for file in root.rglob('*.md'):
        rel = file.relative_to(root)
        if any(part.startswith('.') for part in rel.parts):
            continue
        advisor = Path(mapping['roles']['advisor_profiles'])
        if advisor in rel.parents and file.parent != root / advisor:
            continue
        text = file.read_text(encoding='utf-8'); notes += 1
        if file.name != 'AGENTS.md':
            assert text.startswith('---\n'), rel
            header = text.split('---',2)[1]
            for key in ('title','tags','created','type','summary'):
                assert re.search(r'^'+key+r':',header,re.M), (rel,key)
            match = re.search(r'^id:\s*[\"\']?([A-Z]+-[0-9]+)[\"\']?\s*$',header,re.M)
            if match:
                ident=match.group(1)
                assert ident not in ids, (ident,rel,ids.get(ident))
                ids[ident]=rel
        prose = re.sub(r'```.*?```','',text,flags=re.S)
        for target in re.findall(r'\]\(([^)]+)\)',prose):
            if '://' in target or target.startswith('#'):
                continue
            path = (file.parent / unquote(target.split('#')[0])).resolve()
            assert root in path.parents and path.exists(), (rel,target)
            links += 1
    if (root / '.obsidian').exists():
        for file in (root / '.obsidian').glob('*.json'):
            json.loads(file.read_text(encoding='utf-8'))
    return notes,links


if __name__ == '__main__':
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('vault',type=Path)
    args=ap.parse_args()
    n,l=check(args.vault)
    print('PASS: %s notes, %s local links, indexes, metadata, canonical path map and JSON. No UI/scientific verification.' % (n,l))
