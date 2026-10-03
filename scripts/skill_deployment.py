"""Deployment receipts are outside skill discovery; no research or credentials are included."""
import copy
import datetime
import json
import os
from pathlib import Path
import tempfile
from package_lib import ROOT


def content_version():
    return json.loads((ROOT / 'content-version.json').read_text(encoding='utf-8'))['content_version']


def receipt_path(dest):
    return dest.parent / '.danta-skill-receipt.json'


def read_receipt(dest):
    path = receipt_path(dest)
    if path.is_symlink():
        raise ValueError('Receipt cannot be a symlink.')
    if not path.exists():
        return {'schema_version': 1, 'skills': {}}
    data = json.loads(path.read_text(encoding='utf-8'))
    if data.get('schema_version') != 1 or not isinstance(data.get('skills'), dict):
        raise ValueError('Invalid deployment receipt.')
    return data


def write_receipt(dest, data):
    path = receipt_path(dest)
    if path.is_symlink():
        raise ValueError('Receipt cannot be a symlink.')
    fd, name = tempfile.mkstemp(prefix='.danta-receipt-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
            handle.write('\n')
        os.replace(name, path)
    finally:
        Path(name).unlink(missing_ok=True)


def updated_receipt(dest, data, names):
    receipt = copy.deepcopy(read_receipt(dest))
    for name in names:
        info = data['skills'][name]
        receipt['skills'][name] = {
            'content_version': content_version(),
            'files': info['files'],
            'runtime_files': info.get('runtime_files', []),
        }
    receipt['updated_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    return receipt
