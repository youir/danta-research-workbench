import { Archive, BookOpenText, House, Notebook, ShareNetwork, FolderOpen, Newspaper } from '@phosphor-icons/react';

export const NAV_ITEMS = [
  { id: 'start', label: '开始', Icon: House },
  { id: 'records', label: '研究记录', Icon: Notebook },
  { id: 'mechanism', label: '机制图', Icon: ShareNetwork },
  { id: 'literature', label: '文献与信息源', Icon: BookOpenText },
  { id: 'daily-briefs', label: '科研日报', Icon: Newspaper },
  { id: 'archive', label: '历史归档', Icon: Archive },
  { id: 'vault', label: '知识库', Icon: FolderOpen },
];
