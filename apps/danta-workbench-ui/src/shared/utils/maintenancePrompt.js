export const DESKTOP_MAINTENANCE_PROMPT = `请在我这台 Windows 电脑上检查并更新“龚博士科研工作台”，随后核对相关路径。不要克隆源码到我的科研库，不要清空应用数据。
1. 先确认当前已安装的工作台版本和安装位置；从 https://github.com/youir/danta-research-workbench/releases 中选最高版本的正式 workbench-v* 桌面版，下载 x64-Setup.exe 与 SHA256SUMS.txt，校验一致后安装并从桌面图标打开独立窗口。没有更新就保留当前版本。
2. 工作台打开后先查询 http://127.0.0.1:48921/__danta/vault/status 与 /__danta/artifacts/status，以及 /__danta/codex/status（同源 Origin 为 http://127.0.0.1:48921）。只核对名称、路径、授权范围和 Codex 已登记工作区，不读笔记内容或历史聊天。沿用已有有效绑定和授权，不要求我重复选择 GY 或勾选全部权限。
3. 未找到绑定时，只查看工作台本机 vault-location.json、artifact-location.json 与 %APPDATA%\\obsidian\\obsidian.json 的路径元数据；可使用该发行源码里的 scripts/inspect_local_paths.py。已有明确确认的唯一库先核对；多个候选或冲突只让我确认有歧义的路径。不得遍历整盘、云盘或个人文件，不以 GY 名称推断根目录。
4. 区分软件安装位置、Codex 工作区、Obsidian 知识库、活动课题和成果目录；在已确认库中只读取 .danta-vault.json 指定的 Path-Map 元数据，核对活动课题。成果目录沿用工作台保存的位置，不另建第二份输出库。没有 Path-Map 就如实记录旧版结构，不用空白模板覆盖我的资料。
5. 新版研究步骤还需要更新 Codex 实际加载的主技能。只在临时目录取得与已安装桌面 tag 对应的发行源码，查看 content-version.json 与 MANIFEST.json；先运行 scripts/update_skills.py --dest "<核对出的唯一私有工作区>/.agents/skills" 做只读比较，再按其计划 --apply。保留本人修改、私有授权、Path-Map、研究笔记和 API 密钥；有冲突只列具体文件，不强制覆盖、不同时安装两份同名技能。没有 Python 或旧版安装记录时按该版本 references/content-updates.md 的兼容流程处理，不凭目录存在声称已更新。
6. 新开该工作区的 Codex 对话确认主技能已加载新版。在工作台已有研究记录授权内同步实际步骤；可打开任务查看当前步骤、过程记录与成果预览。不要为了检查建立虚构科研步骤或移动原始材料。
最后用简短表格告诉我：桌面版本、内容版本、安装位置、Codex 工作区、知识库路径、活动课题、成果目录、已恢复授权、未完成项。不要回显任何密钥。`;
