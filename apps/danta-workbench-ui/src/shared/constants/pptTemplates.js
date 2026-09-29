const templateFile = name => `/ppt-templates/${name}`;

export const PPT_TEMPLATES = [
  {
    id: 'red-white',
    title: '红白参考复刻',
    style: '经典院系汇报',
    description: '红白主色、醒目章节编号与分区内容，沿用参考图的组会汇报结构。',
    preview: '/ppt-templates/previews/red-white.jpg',
    fileName: '龚博士组会模板_红白参考复刻版_可编辑模板_PPTX_2026-09-29.pptx',
    accent: '#9c171b',
  },
  {
    id: 'technology',
    title: '科技病理风',
    style: '影像与数据展示',
    description: '冷色影像质感和清晰的信息层级，适合呈现病理影像、流程与结果图。',
    preview: '/ppt-templates/previews/technology.png',
    fileName: '龚博士组会模板_科技病理风_图片版式复刻_PPTX_2026-09-29.pptx',
    accent: '#245f83',
  },
  {
    id: 'journal',
    title: '简约期刊风',
    style: '论文与图表导读',
    description: '留白充足、文字克制，突出文献信息、研究问题和关键图表。',
    preview: '/ppt-templates/previews/journal.png',
    fileName: '龚博士组会模板_简约期刊风_图片版式复刻_PPTX_2026-09-29.pptx',
    accent: '#66677c',
  },
  {
    id: 'life-science',
    title: '生命科学病理风',
    style: '组织与实验结果',
    description: '自然的生命科学色彩与图像版式，突出组织学观察和实验结果证据。',
    preview: '/ppt-templates/previews/life-science.png',
    fileName: '龚博士组会模板_生命科学病理风_图片版式复刻_PPTX_2026-09-29.pptx',
    accent: '#557a68',
  },
].map(template => ({
  ...template,
  assetPath: `apps/danta-workbench-ui/public${templateFile(template.fileName)}`,
  downloadUrl: templateFile(template.fileName),
}));
