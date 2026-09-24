#!/usr/bin/env python3
"""Check only the named workspace and skills directory; never use network."""
import argparse
from datetime import datetime
from pathlib import Path
import platform
import shutil
import sys
import tempfile
from package_lib import ROOT, default_dest, manifest, verify_bundle, same_install

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--skills-dir', type=Path, default=default_dest())
    ap.add_argument('--output', type=Path)
    args = ap.parse_args()
    data = manifest()
    dest = args.skills_dir.expanduser().resolve()
    errors = verify_bundle(data)
    lines = ['# 基础工具环境报告', '', '- 检查时间：' + datetime.now().astimezone().isoformat(),
             '- 系统：' + platform.system(), '- Python：' + platform.python_version(),
             '- 本包脚本要求 Python 3.9+：' + ('满足' if sys.version_info >= (3,9) else '不满足'),
             '- 部分上游校验脚本要求 Python 3.11+：' + ('满足' if sys.version_info >= (3,11) else '尚不满足（不阻碍访谈盘点）'),
             '- 检查的技能目录：' + str(dest),
             '- 安装源完整性：' + ('通过' if not errors else '失败：' + '; '.join(errors)), '',
             '## 技能文件状态', '', '| 技能 | 状态 |', '|---|---|']
    for name, info in data['skills'].items():
        target = dest / name
        status = ('与包内版本一致' if same_install(target, info) else
                  ('存在但不同，需核对' if target.exists() or target.is_symlink() else '未安装'))
        lines.append('| ' + name + ' | ' + status + ' |')
    lines += ['', '## 可选工具', '', '| 工具 | 是否可找到（不代表运行验证） |', '|---|---|']
    for name in ['git', 'Rscript', 'pandoc', 'pdftotext', 'tesseract']:
        lines.append('| ' + name + ' | ' + ('可找到' if shutil.which(name) else '未找到；按需配置') + ' |')
    try:
        with tempfile.TemporaryFile(dir=ROOT):
            pass
        writable = '通过'
    except OSError:
        writable = '失败，需选择可写工作区'
    lines += ['', '- 工作台临时文件写入检查：' + writable, '', '## 尚未验证的能力', '',
              '客户端是否发现技能、联网文献检索、引文核验、PDF/OCR 实际解析、科学计算依赖及真实数据分析均未验证。',
              '样本、实验平台、模型、经费和时间必须根据用户材料另行盘点。',
              '本脚本未读取密钥、未联网、未扫描其他研究资料；当前电脑的报告不代表其他电脑。']
    output = args.output or ROOT / '我的开题/02_盘点' / ('环境检查_' + datetime.now().strftime('%Y%m%d_%H%M%S_%f') + '.md')
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x', encoding='utf-8') as handle:
        handle.write('\n'.join(lines) + '\n')
    print('报告已写入：' + str(output.resolve()))
    return 1 if errors else 0

if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError) as exc:
        print('检查未完成：' + str(exc), file=sys.stderr)
        sys.exit(1)
