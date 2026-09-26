import { ItemView, Modal, Notice, Plugin, PluginSettingTab, Setting, requestUrl, normalizePath, setIcon, TFile } from 'obsidian';
import { exportOpml, mergeItems, normalizeHttpUrl, parseFeed, parseOpml, safeFilename, stableSourceId, yamlQuote } from './feed-core.js';

const VIEW = 'danta-rss-collector-view';
const STORE_FOLDER = '01_收件箱_Inbox/02_RSS_动态线索';
const DEFAULTS = { feeds: [], items: [], autoUpdate: false, intervalMinutes: 360 };
const MAX_FEEDS = 100;
const REQUEST_TIMEOUT_MS = 20_000;

export default class DantaRssCollector extends Plugin {
  async onload() {
    this.unloading = false;
    this.data = { ...DEFAULTS, ...(await this.loadData() || {}) };
    this.data.feeds = Array.isArray(this.data.feeds) ? this.data.feeds : [];
    this.data.items = Array.isArray(this.data.items) ? this.data.items : [];
    this.pending = new Map();
    this.registerView(VIEW, leaf => new RssView(leaf, this));
    this.addRibbonIcon('rss', '打开科研信息源', () => this.openView());
    this.addCommand({ id: 'open-rss', name: '打开科研信息源', callback: () => this.openView() });
    this.addCommand({ id: 'refresh-rss', name: '手动更新科研信息源', callback: () => this.refreshAll() });
    this.addSettingTab(new RssSettingsTab(this.app, this));
    this.registerInterval(window.setInterval(() => {
      if (this.data.autoUpdate) void this.refreshDue();
    }, 60_000));
    this.app.workspace.onLayoutReady(() => { if (this.data.autoUpdate) void this.refreshDue(); });
  }

  onunload() { this.unloading = true; this.app.workspace.detachLeavesOfType(VIEW); }

  async openView() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW)[0];
    if (!leaf) leaf = this.app.workspace.getRightLeaf(false);
    await leaf.setViewState({ type: VIEW, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  async persist() { await this.saveData(this.data); this.refreshViews(); }

  refreshViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) {
      if (leaf.view instanceof RssView) leaf.view.render();
    }
  }

  async addFeed(name, url, group) {
    const normalized = normalizeHttpUrl(url);
    if (!normalized) throw new Error('请使用有效的 HTTP 或 HTTPS RSS/Atom 地址');
    if (this.data.feeds.some(feed => feed.url === normalized)) throw new Error('这个地址已经添加过了');
    if (this.data.feeds.length >= MAX_FEEDS) throw new Error(`最多添加 ${MAX_FEEDS} 个来源`);
    this.data.feeds.push({
      id: await stableSourceId(normalized),
      name: String(name || new URL(normalized).hostname).trim().slice(0, 100),
      url: normalized,
      group: String(group || '未分组').trim().slice(0, 60) || '未分组',
      enabled: true,
      lastFetchedAt: 0,
      lastError: '',
    });
    await this.persist();
  }

  async removeFeed(id) {
    const feed = this.data.feeds.find(item => item.id === id);
    if (!feed) return;
    const confirmed = await new ConfirmModal(this.app, `移除订阅源“${feed.name}”？已保存到知识库的笔记会保留。`, '移除订阅源').openAndGetResult();
    if (!confirmed) return;
    this.data.feeds = this.data.feeds.filter(item => item.id !== id);
    await this.persist();
  }

  async refreshDue() {
    if (!this.data.autoUpdate) return;
    const everyMs = Math.max(30, Number(this.data.intervalMinutes) || 360) * 60_000;
    const due = this.data.feeds.filter(feed => feed.enabled !== false && Date.now() - Number(feed.lastFetchedAt || 0) >= everyMs);
    if (due.length) await this.refreshFeeds(due);
  }

  async refreshAll() { return this.refreshFeeds(this.data.feeds.filter(feed => feed.enabled !== false)); }

  async refreshFeeds(feeds) {
    if (!feeds.length) { new Notice('还没有订阅源。先在设置中添加 RSS/Atom 地址。'); return; }
    let successes = 0;
    const work = [...new Set(feeds.map(feed => feed.id))];
    const worker = async () => {
      while (work.length) {
        const id = work.shift();
        const feed = this.data.feeds.find(item => item.id === id);
        if (!feed) continue;
        let pending = this.pending.get(feed.id);
        if (!pending) {
          pending = this.fetchFeed(feed).finally(() => this.pending.delete(feed.id));
          this.pending.set(feed.id, pending);
        }
        try { await pending; successes++; }
        catch { /* A source's safe status is stored without exposing its URL or transport error. */ }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, work.length) }, worker));
    const failures = feeds.length - successes;
    new Notice(failures ? `更新完成：${successes} 个成功，${failures} 个失败；失败源保留上次内容。` : `更新完成：${successes} 个订阅源。`);
  }

  async fetchFeed(feed) {
    const request = requestUrl({
      url: feed.url,
      method: 'GET',
      throw: false,
      headers: { Accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5' },
    });
    let timer;
    try {
      const response = await Promise.race([
        request,
        new Promise((_, reject) => { timer = window.setTimeout(() => reject(new Error('请求超时')), REQUEST_TIMEOUT_MS); }),
      ]);
      if (this.unloading) return;
      if (response.status < 200 || response.status >= 300) throw new Error(`服务器返回 ${response.status}`);
      const entries = await parseFeed(response.text, feed);
      if (!this.data.feeds.includes(feed)) return;
      this.data.items = mergeItems(this.data.items, entries);
      feed.lastFetchedAt = Date.now();
      feed.lastError = '';
      await this.saveData(this.data);
      this.refreshViews();
    } catch (error) {
      if (this.unloading) return;
      if (!this.data.feeds.includes(feed)) return;
      feed.lastFetchedAt = Date.now();
      const message = String(error?.message || '');
      const safeMessages = ['订阅内容为空或超过 2.5 MB 限制', '订阅文件包含不支持的 XML 声明', '当前环境缺少 XML 解析器', '订阅文件不是有效的 RSS/Atom XML', '这个网址不是可识别的 RSS/Atom 订阅', '请求超时'];
      feed.lastError = safeMessages.includes(message) || /^服务器返回 \d{3}$/.test(message) ? message : '无法读取订阅；请检查地址或网络。';
      await this.saveData(this.data);
      this.refreshViews();
      throw new Error(feed.lastError);
    } finally { window.clearTimeout(timer); }
  }

  async importOpml(xml) {
    const parsed = parseOpml(xml);
    const existing = new Set(this.data.feeds.map(feed => feed.url));
    const add = parsed.feeds.filter(feed => { if (existing.has(feed.url)) return false; existing.add(feed.url); return true; });
    if (this.data.feeds.length + add.length > MAX_FEEDS) throw new Error(`导入后会超过 ${MAX_FEEDS} 个来源上限`);
    for (const feed of add) {
      this.data.feeds.push({ id: await stableSourceId(feed.url), ...feed, enabled: true, lastFetchedAt: 0, lastError: '' });
    }
    await this.persist();
    return { added: add.length, skipped: parsed.skipped + parsed.feeds.length - add.length };
  }

  async exportOpml() {
    const register = '02_原始资料_Sources/00_来源登记_Source-Register';
    await this.ensureFolder(register);
    const stem = `${register}/订阅源-OPML-${new Date().toISOString().slice(0, 10)}`;
    let path = `${stem}.opml`, suffix = 2;
    while (this.app.vault.getAbstractFileByPath(path)) path = `${stem}-${suffix++}.opml`;
    await this.app.vault.create(path, exportOpml(this.data.feeds));
    new Notice(`OPML 已导出到 ${path}。文件含订阅地址，请将其作为私密资料保存。`);
  }

  async updateItem(id, patch) {
    const item = this.data.items.find(entry => entry.id === id);
    if (!item) return;
    Object.assign(item, patch);
    await this.persist();
  }

  async saveToVault(item) {
    if (item.savedPath && this.app.vault.getAbstractFileByPath(item.savedPath)) {
      const file = this.app.vault.getAbstractFileByPath(item.savedPath);
      if (file instanceof TFile) { await this.app.workspace.getLeaf(true).openFile(file); return; }
    }
    await this.ensureFolder(STORE_FOLDER);
    const date = item.publishedAt ? item.publishedAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const fileName = normalizePath(`${STORE_FOLDER}/${date}_${safeFilename(item.title)}_${safeFilename(item.id, 16)}.md`);
    const body = [
      '---',
      `title: ${yamlQuote(item.title)}`,
      `source: ${yamlQuote(item.source)}`,
      `url: ${yamlQuote(item.url)}`,
      `published: ${yamlQuote(item.publishedAt)}`,
      `captured: ${yamlQuote(new Date().toISOString())}`,
      'status: to_review',
      'kind: rss-lead',
      '---', '',
      `# ${item.title.replace(/[\r\n]+/g, ' ')}`, '',
      `- 来源：${item.source}`,
      `- 发布：${item.publishedAt || '未注明'}`,
      `- 原文：${item.url}`, '',
      '## RSS 摘要（来源提供）', '',
      item.excerpt || '此订阅只提供标题和链接。', '',
      '## 阅读记录', '',
      '- 与当前课题的关系：待判断',
      '- 需要核对的信息：',
      '- 后续行动：', '',
      '> 仅保存订阅元数据和来源摘要，不自动抓取全文；请先打开原文并判断其研究价值。', '',
    ].join('\n');
    const file = await this.app.vault.create(fileName, body);
    item.savedPath = file.path;
    await this.updateItem(item.id, { savedPath: file.path, read: true });
    await this.app.workspace.getLeaf(true).openFile(file);
    new Notice('文献线索已归档到 RSS 收件箱。');
  }

  async ensureFolder(path) {
    const normalized = normalizePath(path);
    if (this.app.vault.getAbstractFileByPath(normalized)) return;
    const parts = normalized.split('/');
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
    }
  }
}

class RssView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.filter = 'all'; this.search = ''; this.feedId = 'all'; }
  getViewType() { return VIEW; }
  getDisplayText() { return '龚博士科研信息源'; }
  getIcon() { return 'rss'; }
  async onOpen() { this.render(); }

  render() {
    const root = this.containerEl.children[1];
    root.empty();
    root.addClass('danta-rss-view');
    const header = root.createDiv({ cls: 'danta-rss-header' });
    header.createEl('h2', { text: '科研信息源' });
    button(header, 'plus', '添加来源', () => new FeedModal(this.app, this.plugin).open());
    button(header, 'file-up', '导入 OPML', () => new ImportOpmlModal(this.app, this.plugin).open());
    button(header, 'refresh-cw', '现在更新', () => void this.plugin.refreshAll());

    const filters = root.createDiv({ cls: 'danta-rss-filters' });
    for (const [id, label] of [['all', '全部'], ['unread', '未读'], ['favorites', '收藏']]) {
      const b = filters.createEl('button', { text: label, cls: this.filter === id ? 'is-active' : '' });
      b.addEventListener('click', () => { this.filter = id; this.render(); });
    }
    const controls = root.createDiv({ cls: 'danta-rss-controls' });
    const selector = controls.createEl('select', { attr: { 'aria-label': '选择来源' } });
    selector.createEl('option', { text: '全部来源', value: 'all' });
    for (const group of [...new Set(this.plugin.data.feeds.map(feed => feed.group))]) {
      const optgroup = selector.createEl('optgroup', { attr: { label: group } });
      for (const feed of this.plugin.data.feeds.filter(item => item.group === group)) optgroup.createEl('option', { text: feed.name, value: feed.id });
    }
    selector.value = this.feedId;
    selector.addEventListener('change', () => { this.feedId = selector.value; this.render(); });
    const search = controls.createEl('input', { attr: { type: 'search', placeholder: '搜索标题或摘要…', 'aria-label': '搜索订阅文章' } });
    search.value = this.search;
    search.addEventListener('input', () => { this.search = search.value; this.renderList(list); });
    const list = root.createDiv({ cls: 'danta-rss-list' });
    this.renderList(list);
    const footer = root.createDiv({ cls: 'danta-rss-footer' });
    footer.setText(this.plugin.data.autoUpdate ? `自动更新已开启 · 每 ${this.plugin.data.intervalMinutes} 分钟` : '自动更新已关闭 · 可手动更新');
    footer.createEl('span', { text: ` · ${this.plugin.data.feeds.length} 个来源` });
  }

  renderList(list) {
    list.empty();
    let items = this.plugin.data.items;
    if (this.feedId !== 'all') items = items.filter(item => item.feedId === this.feedId);
    if (this.filter === 'unread') items = items.filter(item => !item.read);
    if (this.filter === 'favorites') items = items.filter(item => item.favorite);
    const needle = this.search.trim().toLocaleLowerCase();
    if (needle) items = items.filter(item => `${item.title} ${item.source} ${item.excerpt}`.toLocaleLowerCase().includes(needle));
    if (!items.length) {
      list.createEl('p', { cls: 'danta-rss-empty', text: this.plugin.data.feeds.length ? '这里还没有文章线索。可以刷新来源，或调整筛选条件。' : '先添加你信任的信息源；添加时不会自动连接，更新由你决定。' });
      return;
    }
    for (const item of items.slice(0, 200)) {
      const card = list.createDiv({ cls: `danta-rss-item ${item.read ? 'is-read' : 'is-unread'}` });
      const sourceRow = card.createDiv({ cls: 'danta-rss-item-meta' });
      sourceRow.createSpan({ text: item.source || '信息源' });
      sourceRow.createSpan({ text: item.publishedAt ? item.publishedAt.slice(0, 10) : '日期未注明' });
      const title = card.createEl('a', { text: item.title, href: item.url, cls: 'danta-rss-title' });
      title.addEventListener('click', event => { event.preventDefault(); window.open(item.url, '_blank', 'noopener,noreferrer'); void this.plugin.updateItem(item.id, { read: true }); });
      if (item.excerpt) card.createEl('p', { cls: 'danta-rss-excerpt', text: item.excerpt });
      const actions = card.createDiv({ cls: 'danta-rss-actions' });
      button(actions, item.favorite ? 'star' : 'star', item.favorite ? '取消收藏' : '收藏', () => void this.plugin.updateItem(item.id, { favorite: !item.favorite }));
      button(actions, item.read ? 'mail' : 'mail-open', item.read ? '标为未读' : '标为已读', () => void this.plugin.updateItem(item.id, { read: !item.read }));
      button(actions, 'archive', item.savedPath ? '已归档' : '存入知识库', () => void this.plugin.saveToVault(item));
    }
  }
}

class FeedModal extends Modal {
  constructor(app, plugin) { super(app); this.plugin = plugin; }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: '添加科研信息源' });
    contentEl.createEl('p', { text: '只接受 RSS/Atom 地址。保存后不会自动连接；你可以手动刷新或在设置中开启定时更新。' });
    const name = contentEl.createEl('input', { attr: { type: 'text', placeholder: '来源名称（可留空）' } });
    const url = contentEl.createEl('input', { attr: { type: 'url', placeholder: 'https://example.org/feed.xml' } });
    const group = contentEl.createEl('input', { attr: { type: 'text', placeholder: '分组，例如：病理学 / 期刊 / 课题组' } });
    const error = contentEl.createEl('p', { cls: 'danta-rss-error' });
    const add = contentEl.createEl('button', { text: '保存来源', cls: 'mod-cta' });
    add.addEventListener('click', async () => {
      try { await this.plugin.addFeed(name.value, url.value, group.value); this.close(); new Notice('来源已保存。'); }
      catch (e) { error.setText(String(e?.message || e)); }
    });
  }
  onClose() { this.contentEl.empty(); }
}

class ImportOpmlModal extends Modal {
  constructor(app, plugin) { super(app); this.plugin = plugin; }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: '导入订阅清单' });
    contentEl.createEl('p', { text: '选择 OPML 文件或粘贴 XML。导入只保存来源清单，不访问来源地址；重复项会跳过。' });
    const file = contentEl.createEl('input', { attr: { type: 'file', accept: '.opml,.xml,text/xml,application/xml' } });
    const text = contentEl.createEl('textarea', { cls: 'danta-rss-opml', attr: { placeholder: '也可以在此粘贴 OPML 内容' } });
    const status = contentEl.createEl('p', { cls: 'danta-rss-opml-status', attr: { role: 'status' } });
    const actions = contentEl.createDiv({ cls: 'modal-button-container' });
    const cancel = actions.createEl('button', { text: '取消' });
    const confirm = actions.createEl('button', { text: '预览导入', cls: 'mod-cta' });
    const showPreview = () => {
      try {
        const result = parseOpml(text.value);
        const duplicates = result.feeds.filter(feed => this.plugin.data.feeds.some(old => old.url === feed.url)).length;
        status.setText(`识别到 ${result.feeds.length} 个来源；当前库内重复 ${duplicates} 个，格式无效或清单内重复 ${result.skipped} 个。`);
      } catch (error) { status.setText(String(error?.message || error)); }
    };
    file.addEventListener('change', async () => {
      const selected = file.files?.[0];
      if (!selected) return;
      if (selected.size > 2_500_000) { status.setText('文件超过 2.5 MB 限制。'); return; }
      text.value = await selected.text();
      showPreview();
    });
    text.addEventListener('input', showPreview);
    cancel.addEventListener('click', () => this.close());
    confirm.addEventListener('click', async () => {
      try {
        const result = await this.plugin.importOpml(text.value);
        this.close();
        new Notice(`导入完成：新增 ${result.added} 个，跳过 ${result.skipped} 个。不会自动联网更新。`);
      } catch (error) { status.setText(String(error?.message || error)); }
    });
  }
  onClose() { this.contentEl.empty(); }
}

class ConfirmModal extends Modal {
  constructor(app, message, action) { super(app); this.message = message; this.action = action; this.result = false; }
  onOpen() {
    this.contentEl.createEl('p', { text: this.message });
    const row = this.contentEl.createDiv({ cls: 'modal-button-container' });
    const cancel = row.createEl('button', { text: '取消' });
    const yes = row.createEl('button', { text: this.action, cls: 'mod-warning' });
    cancel.addEventListener('click', () => { this.close(); });
    yes.addEventListener('click', () => { this.result = true; this.close(); });
  }
  onClose() { this.contentEl.empty(); this.resolve?.(this.result); }
  openAndGetResult() { return new Promise(resolve => { this.resolve = resolve; this.open(); }); }
}

class RssSettingsTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: '龚博士科研信息源' });
    containerEl.createEl('p', { text: '订阅地址和文章只保存在当前知识库。自动更新默认关闭；开启后，仅请求你添加的 RSS/Atom 地址。' });
    new Setting(containerEl).setName('定时自动更新').setDesc('关闭时不在后台访问网络；手动刷新仍可使用。')
      .addToggle(toggle => toggle.setValue(this.plugin.data.autoUpdate).onChange(async value => { this.plugin.data.autoUpdate = value; await this.plugin.persist(); this.display(); }));
    new Setting(containerEl).setName('更新间隔（分钟）').setDesc('建议 60–720 分钟；至少 30 分钟。')
      .addText(text => text.setValue(String(this.plugin.data.intervalMinutes)).onChange(async value => {
        const n = Math.max(30, Math.min(1440, Number(value) || 360));
        this.plugin.data.intervalMinutes = n;
        await this.plugin.saveData(this.plugin.data);
      }));
    containerEl.createEl('h3', { text: `已添加来源（${this.plugin.data.feeds.length}）` });
    const add = containerEl.createEl('button', { text: '添加来源' });
    add.addEventListener('click', () => new FeedModal(this.app, this.plugin).open());
    const importButton = containerEl.createEl('button', { text: '导入 OPML' });
    importButton.addEventListener('click', () => new ImportOpmlModal(this.app, this.plugin).open());
    const exportButton = containerEl.createEl('button', { text: '导出 OPML' });
    exportButton.addEventListener('click', () => void this.plugin.exportOpml());
    for (const feed of this.plugin.data.feeds) {
      new Setting(containerEl).setName(feed.name).setDesc(`${feed.group} · ${new URL(feed.url).host}${feed.lastError ? ` · 更新失败：${feed.lastError}` : ''}`)
        .addToggle(toggle => toggle.setValue(feed.enabled !== false).setTooltip('暂停/启用此来源').onChange(async value => { feed.enabled = value; await this.plugin.persist(); }))
        .addButton(button => button.setButtonText('移除').setWarning().onClick(() => void this.plugin.removeFeed(feed.id)));
    }
  }
}

function button(parent, icon, label, action) {
  const el = parent.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': label, title: label } });
  el.setAttribute('type', 'button');
  const span = el.createSpan();
  setIcon(span, icon);
  el.addEventListener('click', action);
  return el;
}
