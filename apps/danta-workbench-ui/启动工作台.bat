@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto node_missing

node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major > 20 || (major === 20 && minor >= 19) ? 0 : 1)"
if errorlevel 1 goto node_old

if not exist "node_modules\vite\bin\vite.js" (
  echo 首次启动：正在安装工作台依赖，请保持窗口打开……
  call npm install
  if errorlevel 1 goto install_failed
)

call npm run start
goto end

:node_missing
echo 没有检测到 Node.js。请先安装 Node.js 20.19 或更新版本，然后重新启动。
echo 下载地址：https://nodejs.org/
goto pause_end

:node_old
echo 当前 Node.js 版本过旧。请安装 20.19 或更新版本，然后重新启动。
echo 下载地址：https://nodejs.org/
goto pause_end

:install_failed
echo 依赖安装失败。请检查网络后重试，或把此窗口中的错误信息发给 Codex。
goto pause_end

:pause_end
pause

:end
endlocal
