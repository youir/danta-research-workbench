# 给 Codex 的更新与启动指令

在龚博士自己的 Windows 电脑上，在 Codex 里发送这句话：

> 请检查并安全更新龚博士科研工作台的 Git 仓库，然后在我的 Windows 电脑上配置并打开最新的网页前端。按仓库说明操作，只启动 `apps/danta-workbench-ui`；保留所有本地改动，不扫描 GY。

Codex 应确认仓库地址为 `https://github.com/youir/danta-research-workbench.git`，检查并安全获取更新，安装前端依赖，再运行本目录中的 `启动工作台.bat`。服务启动后会在龚博士自己的 Windows 浏览器打开 `http://127.0.0.1:5173/`。

如果 Codex 还没有这个仓库，可在 `Documents` 下克隆。若已有仓库里存在会被更新覆盖的本地改动，Codex 应暂停更新并先说明，不得重置、删除或覆盖。

前端需要 Node.js 20.19 或更新版本。当前这版尚未连接 Codex agent、GY 知识库和 RSS，也不会扫描研究资料。
