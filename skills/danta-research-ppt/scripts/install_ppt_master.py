#!/usr/bin/env python3
"""Install the pinned, unmodified PPT Master skill into this private workspace."""
from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import subprocess
import sys
import tempfile
from urllib.request import Request, urlopen
import zipfile


VERSION = "6.6.0"
ARCHIVE_URL = (
    "https://github.com/hugohe3/ppt-master/releases/download/v6.6.0/"
    "ppt-master-skill-v6.6.0.zip"
)
ARCHIVE_SHA256 = "4e239ac3c11036c8c9d3bb987f5ccbd02a176d6832f2404f8a067414d834d2a1"
ARCHIVE_SIZE = 62_010_414
MAX_UNPACKED_SIZE = 250 * 1024 * 1024
MAX_FILES = 20_000
ARCHIVE_PREFIX = PurePosixPath("ppt-master/skills/ppt-master")
REQUIRED_FILES = (
    "SKILL.md",
    "LICENSE",
    "SPONSORS.md",
    "SPONSORS_CN.md",
    "scripts/attribution_guard.py",
    "scripts/svg_to_pptx.py",
    "references/image-type-templates/flowchart.md",
)


def skill_root() -> Path:
    return Path(__file__).resolve().parent.parent


def private_skills_dir(explicit: Path | None) -> Path:
    if explicit is None:
        candidate = skill_root().parent
    else:
        candidate = explicit.expanduser().absolute()
        if candidate.is_symlink():
            raise ValueError("技能目录是符号链接；停止，不在链接目标写入。")
        candidate = candidate.resolve()
    if candidate.name != "skills" or candidate.parent.name != ".agents":
        raise ValueError(
            "安装位置必须是当前私有工作区的 .agents/skills。若本技能是全局安装，"
            "请显式传入该知识库的 .agents/skills 路径。"
        )
    if candidate.is_symlink() or candidate.parent.is_symlink() or not candidate.is_dir():
        raise ValueError("当前私有工作区 .agents/skills 不存在或包含符号链接。")
    return candidate


def run_guard(skill: Path) -> bool:
    guard = skill / "scripts/attribution_guard.py"
    if not guard.is_file():
        print("PPT Master 安装不完整；按上游规定停止，不修补或绕过。", file=sys.stderr)
        return False
    result = subprocess.run([sys.executable, str(guard)], text=True)
    return result.returncode == 0


def download(path: Path) -> None:
    request = Request(ARCHIVE_URL, headers={"User-Agent": "danta-research-workbench"})
    size = 0
    with urlopen(request, timeout=90) as response, path.open("wb") as output:
        declared = response.headers.get("Content-Length")
        if declared and int(declared) != ARCHIVE_SIZE:
            raise ValueError("GitHub 返回的安装包大小与固定版本记录不符。")
        while True:
            block = response.read(1024 * 1024)
            if not block:
                break
            size += len(block)
            if size > ARCHIVE_SIZE:
                raise ValueError("安装包超过固定大小上限。")
            output.write(block)
    if size != ARCHIVE_SIZE:
        raise ValueError("安装包未完整下载；请保持原文件不变并稍后重试。")


def check_archive(path: Path) -> None:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != ARCHIVE_SHA256:
        raise ValueError("安装包 SHA-256 与固定官方版本不符。")
    with zipfile.ZipFile(path) as archive:
        infos = archive.infolist()
        if len(infos) > MAX_FILES:
            raise ValueError("安装包文件数量超出安全上限。")
        total = sum(info.file_size for info in infos)
        if total > MAX_UNPACKED_SIZE:
            raise ValueError("安装包解压体积超出安全上限。")
        seen = set()
        for info in infos:
            name = info.filename
            posix = PurePosixPath(name)
            if "\\" in name or posix.is_absolute() or ".." in posix.parts:
                raise ValueError("安装包包含不安全的路径。")
            if name.rstrip("/") in ("ppt-master", "ppt-master/skills"):
                continue
            try:
                relative = posix.relative_to(ARCHIVE_PREFIX)
            except ValueError as exc:
                raise ValueError("安装包内容不符合固定技能包目录结构。") from exc
            if relative == PurePosixPath("."):
                continue
            mode = info.external_attr >> 16
            if stat.S_ISLNK(mode):
                raise ValueError("安装包包含符号链接；拒绝解压。")
            if not info.is_dir():
                seen.add(relative.as_posix())
        missing = sorted(set(REQUIRED_FILES) - seen)
        if missing:
            raise ValueError("固定技能包缺少必要文件：" + ", ".join(missing))


def extract_archive(path: Path, destination: Path) -> None:
    destination.mkdir()
    with zipfile.ZipFile(path) as archive:
        for info in archive.infolist():
            posix = PurePosixPath(info.filename)
            if info.filename.rstrip("/") in ("ppt-master", "ppt-master/skills"):
                continue
            relative = posix.relative_to(ARCHIVE_PREFIX)
            if relative == PurePosixPath("."):
                continue
            output = destination.joinpath(*relative.parts)
            if info.is_dir():
                output.mkdir(parents=True, exist_ok=True)
            else:
                output.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(info) as src, output.open("wb") as dst:
                    shutil.copyfileobj(src, dst)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="只检查已安装版本，不联网、不写文件")
    parser.add_argument("--archive", type=Path, help="使用已有官方压缩包；仍校验固定 SHA-256")
    parser.add_argument("--skills-dir", type=Path, help="当前私有工作区的 .agents/skills 绝对路径")
    args = parser.parse_args()

    skills_dir = private_skills_dir(args.skills_dir)
    target = skills_dir / "ppt-master"
    if target.exists() or target.is_symlink():
        if target.is_symlink() or not target.is_dir():
            print("发现同名文件/链接；为保护已有内容，未覆盖。", file=sys.stderr)
            return 2
        if not run_guard(target):
            return 2
        skill_md = target / "SKILL.md"
        if not skill_md.is_file() or f'version: "{VERSION}"' not in skill_md.read_text(encoding="utf-8"):
            print("已有 PPT Master 版本与固定版本不一致；未覆盖，请人工核对。", file=sys.stderr)
            return 2
        print(f"PPT Master v{VERSION} 已安装并通过上游完整性检查：{target}")
        return 0

    if args.check:
        print(f"未检测到工作区级 PPT Master v{VERSION}；没有下载或更改文件。", file=sys.stderr)
        return 1

    with tempfile.TemporaryDirectory(prefix=".ppt-master-install-", dir=skills_dir) as scratch:
        scratch_path = Path(scratch)
        archive_path = args.archive.expanduser().resolve() if args.archive else scratch_path / "upstream.zip"
        try:
            if not args.archive:
                print(f"正在下载 PPT Master v{VERSION}（约 62 MB）到临时目录；研究文件不会上传。")
                download(archive_path)
            check_archive(archive_path)
            staged = scratch_path / "ppt-master"
            extract_archive(archive_path, staged)
            if not run_guard(staged):
                print("PPT Master 上游完整性检查未通过；停止，未安装。", file=sys.stderr)
                return 2
            skill_md = staged / "SKILL.md"
            if f'version: "{VERSION}"' not in skill_md.read_text(encoding="utf-8"):
                raise ValueError("已校验的压缩包内部版本不符合固定版本记录。")
            try:
                os.rename(staged, target)
            except FileExistsError:
                print("安装期间出现同名目录；保留已有内容，未覆盖。", file=sys.stderr)
                return 2
        except (OSError, ValueError, zipfile.BadZipFile) as exc:
            print("安装失败：" + str(exc), file=sys.stderr)
            return 1
    print(f"已安装 PPT Master v{VERSION}：{target}")
    print("首次运行前请在下一轮读取上游 SKILL.md，按其加载顺序继续。")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError) as exc:
        print("未能完成：" + str(exc), file=sys.stderr)
        raise SystemExit(1)
