"""Local-only package manifest and directory verification helpers."""
import hashlib
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def default_dest():
    return Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex'))).expanduser() / 'skills'

def manifest():
    return json.loads((ROOT / 'MANIFEST.json').read_text(encoding='utf-8'))

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def tree_files(root):
    return {p.relative_to(root).as_posix(): p for p in root.rglob('*')
            if p.is_file() and '__pycache__' not in p.parts and p.name != '.DS_Store'}

def verify_bundle(data):
    errors = []
    for name, info in data['skills'].items():
        root = ROOT / info['source']
        if root.is_symlink() or any(p.is_symlink() for p in root.rglob('*')):
            errors.append(name + ': unexpected symlink')
            continue
        got = tree_files(root)
        if set(got) != set(info['files']):
            errors.append(name + ': missing or extra files')
            continue
        for relative, expected in info['files'].items():
            if digest(got[relative]) != expected:
                errors.append(name + '/' + relative + ': checksum mismatch')
    return errors

def same_install(path, info):
    if not path.is_dir() or path.is_symlink():
        return False
    if any(p.is_symlink() for p in path.rglob('*')):
        return False
    got = tree_files(path)
    # Nuwa writes a local version-check date; never exempt its instructions or research.
    for relative in info.get('runtime_files', []):
        if relative != '.last-update-check':
            return False
        if relative in got:
            import datetime
            try:
                value = got[relative].read_text(encoding='utf-8').strip()
                if datetime.date.fromisoformat(value).isoformat() != value:
                    return False
            except (ValueError, UnicodeError):
                return False
            del got[relative]
    return set(got) == set(info['files']) and all(
        digest(got[name]) == expected for name, expected in info['files'].items())
