import { ItemView, Plugin, TFile, setIcon } from 'obsidian';

const VIEW = 'danta-workbench-dashboard-view';
const DIRS = [
  ['00_系统_System', '系统与索引 / System'],
  ['01_收件箱_Inbox', '收件箱 / Inbox'],
  ['02_原始资料_Sources', '原始资料 / Sources'],
  ['03_文献证据_Literature-Evidence', '文献证据 / Literature'],
  ['04_知识百科_Wiki', '知识百科 / Wiki'],
  ['05_课题项目_Projects', '课题项目 / Projects'],
  ['06_方法流程_Methods', '方法流程 / Methods'],
  ['07_数据分析_Data-Analysis', '数据与分析 / Data'],
  ['08_成果输出_Outputs', '成果输出 / Outputs'],
  ['09_专家顾问_Advisors', '专家顾问 / Advisors'],
  ['10_日志复盘_Journal', '日志复盘 / Journal'],
  ['11_长期记忆_Memory', '长期记忆 / Memory'],
  ['12_笔记模板_Templates', '笔记模板 / Templates'],
  ['13_附件资源_Attachments', '附件资源 / Attachments'],
  ['14_历史归档_Archive', '历史归档 / Archive'],
];
const OPEN_STATUSES = new Set(['open', 'in_progress', 'in progress', 'to_review', 'needs_review', 'draft', 'planned', 'unread']);

export default class DantaWorkbenchDashboard extends Plugin {
  async onload() {
    this.registerView(VIEW, leaf => new DashboardView(leaf, this));
    this.addRibbonIcon('layout-dashboard', '打开科研工作台面板', () => this.openView());
    this.addCommand({ id: 'open-dashboard', name: '打开科研工作台面板', callback: () => this.openView() });
    this.addCommand({ id: 'refresh-dashboard', name: '刷新科研工作台面板', callback: () => this.refreshViews() });
    this.registerEvent(this.app.vault.on('create', () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on('modify', () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on('delete', () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on('rename', () => this.scheduleRefresh()));
    this.timer = null;
  }

  onunload() {
    if (this.timer) window.clearTimeout(this.timer);
    this.app.workspace.detachLeavesOfType(VIEW);
  }

  async openView() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW)[0];
    if (!leaf) leaf = this.app.workspace.getRightLeaf(false);
    await leaf.setViewState({ type: VIEW, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  scheduleRefresh() {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.refreshViews(), 450);
  }

  refreshViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) {
      if (leaf.view instanceof DashboardView) leaf.view.render();
    }
  }
}

class DashboardView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW; }
  getDisplayText() { return '科研工作台'; }
  getIcon() { return 'layout-dashboard'; }
  async onOpen() { this.render(); }

  render() {
    const root = this.containerEl.children[1];
    root.empty();
    root.addClass('danta-dashboard');
    const files = this.app.vault.getMarkdownFiles().filter(file =>
      DIRS.some(([path]) => file.path.startsWith(`${path}/`))
    );
    const frontmatter = file => this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    const pending = files.filter(file => OPEN_STATUSES.has(String(frontmatter(file).status || '').toLowerCase()));
    const rssNotes = files.filter(file => String(frontmatter(file).kind || '') === 'rss-lead');
    const unreviewedRss = rssNotes.filter(file => String(frontmatter(file).status || '').toLowerCase() === 'to_review');

    const top = root.createDiv({ cls: 'danta-dashboard-top' });
    const identity = top.createDiv();
    identity.createEl('div', { cls: 'danta-dashboard-eyebrow', text: '龚博士的私有研究档案' });
    identity.createEl('h2', { text: '科研工作台' });
    identity.createEl('p', { text: '只读取当前 Obsidian 知识库；研究判断与取舍由你掌握。' });
    iconButton(top, 'refresh-cw', '刷新', () => this.render());

    const stats = root.createDiv({ cls: 'danta-dashboard-stats' });
    stat(stats, `${files.length}`, '库内笔记');
    stat(stats, `${pending.length}`, '待跟进记录');
    stat(stats, `${unreviewedRss.length}`, '待复核信息源');

    const latest = [...files].filter(file => !file.basename.toLowerCase().includes('index') &&
      !file.path.startsWith('00_系统_System/') && !file.path.startsWith('12_笔记模板_Templates/'))
      .sort((a, b) => b.stat.mtime - a.stat.mtime).slice(0, 8);
    section(root, '最近更新', '只显示本知识库中的 Markdown 记录');
    const recents = root.createDiv({ cls: 'danta-dashboard-list' });
    if (!latest.length) recents.createEl('p', { text: '知识库目前是空的。', cls: 'danta-dashboard-muted' });
    for (const file of latest) {
      const row = recents.createDiv({ cls: 'danta-dashboard-row' });
      const link = row.createEl('a', { text: file.basename, href: '#' });
      link.addEventListener('click', event => { event.preventDefault(); void this.app.workspace.getLeaf(true).openFile(file); });
      row.createSpan({ text: new Date(file.stat.mtime).toLocaleDateString() });
      row.createEl('small', { text: file.parent?.path || '' });
    }

    section(root, '工作台目录', '点开索引即可进入对应资料区');
    const grid = root.createDiv({ cls: 'danta-dashboard-grid' });
    for (const [path, label] of DIRS) {
      const folderFiles = files.filter(file => file.path === path || file.path.startsWith(`${path}/`));
      const count = folderFiles.length;
      const card = grid.createDiv({ cls: 'danta-dashboard-card' });
      card.createEl('strong', { text: label });
      card.createEl('span', { text: `${count} 篇记录` });
      const index = this.app.vault.getAbstractFileByPath(`${path}/00_index.md`);
      if (index instanceof TFile) {
        const open = card.createEl('a', { text: '打开索引 →', href: '#' });
        open.addEventListener('click', event => { event.preventDefault(); void this.app.workspace.getLeaf(true).openFile(index); });
      }
    }

    section(root, '待复核信息源', '订阅条目只进入本地收件箱，不自动写入选题或证据结论');
    const rssList = root.createDiv({ cls: 'danta-dashboard-list' });
    if (!unreviewedRss.length) rssList.createEl('p', { text: rssNotes.length ? '当前没有待复核的 RSS 条目。' : '添加并更新来源后，保存的文献线索会在这里汇总。', cls: 'danta-dashboard-muted' });
    for (const file of unreviewedRss.slice(0, 8)) {
      const fm = frontmatter(file);
      const row = rssList.createDiv({ cls: 'danta-dashboard-row danta-dashboard-rss' });
      const link = row.createEl('a', { text: String(fm.title || file.basename), href: '#' });
      link.addEventListener('click', event => { event.preventDefault(); void this.app.workspace.getLeaf(true).openFile(file); });
      row.createSpan({ text: String(fm.source || 'RSS') });
      row.createEl('small', { text: String(fm.published || '').slice(0, 10) });
    }

    root.createEl('p', { cls: 'danta-dashboard-privacy', text: '面板不读取知识库以外的文件，不上传笔记，不修改记录。' });
  }
}

function section(parent, title, subtitle) {
  const wrap = parent.createDiv({ cls: 'danta-dashboard-section-heading' });
  wrap.createEl('h3', { text: title });
  wrap.createEl('span', { text: subtitle });
}

function stat(parent, value, label) {
  const card = parent.createDiv({ cls: 'danta-dashboard-stat' });
  card.createEl('strong', { text: value });
  card.createEl('span', { text: label });
}

function iconButton(parent, icon, title, action) {
  const button = parent.createEl('button', { cls: 'clickable-icon', attr: { title, 'aria-label': title, type: 'button' } });
  setIcon(button, icon);
  button.addEventListener('click', action);
  return button;
}
