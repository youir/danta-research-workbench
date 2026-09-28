#!/bin/zsh
set -e

APP_DIR="${0:A:h}"
cd "$APP_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "请先安装 Node.js 20.19 或更新版本，再重新双击此文件。"
  echo "下载地址：https://nodejs.org/"
  read -k 1 "REPLY?按任意键退出。"
  exit 1
fi

if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 20 || (major === 20 && minor >= 19) ? 0 : 1)'; then
  echo "当前 Node.js 版本过旧。请升级到 20.19 或更新版本。"
  read -k 1 "REPLY?按任意键退出。"
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "首次启动：正在安装前端依赖……"
  npm install
fi

npm run start
