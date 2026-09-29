function wrapText(context, text, maxWidth) {
  const lines = [];
  for (const paragraph of String(text || '').split('\n')) {
    if (!paragraph) { lines.push(''); continue; }
    let line = '';
    for (const character of paragraph) {
      const next = line + character;
      if (line && context.measureText(next).width > maxWidth) {
        lines.push(line);
        line = character;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

function drawWrapped(context, lines, x, y, lineHeight, color) {
  context.fillStyle = color;
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
  return lines.length * lineHeight;
}

function roundedRect(context, x, y, width, height, radius, fill) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
}

export async function renderDailyBriefPoster(report) {
  const width = 1080;
  const margin = 68;
  const contentWidth = width - margin * 2;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = '28px "Songti SC", "Noto Serif SC", "Source Han Serif SC", serif';

  const bodyItems = report.sections.flatMap(section => section.items.map(item => ({ section: section.title, ...item })));
  const sectioned = report.sections.filter(section => section.items.length);
  const layout = [];
  let cursor = 0;
  const headerIntro = report.intro || report.scope || '根据本次日报中实际记录的线索整理。';
  const introLines = wrapText(context, headerIntro, contentWidth);
  const scopeLines = report.scope && report.scope !== headerIntro ? wrapText(context, report.scope.replace(/^监测范围：\s*/, ''), contentWidth) : [];
  cursor = 300 + introLines.length * 44 + scopeLines.length * 33 + 48;

  for (const section of sectioned) {
    cursor += 48;
    layout.push({ type: 'section', title: section.title, y: cursor });
    cursor += 76;
    for (const item of section.items) {
      const summaryLines = wrapText(context, item.summary, contentWidth - 64);
      const relevanceLines = item.relevance ? wrapText(context, `为什么可能相关：${item.relevance}`, contentWidth - 72) : [];
      const questionLines = item.question ? wrapText(context, `可继续追问：${item.question}`, contentWidth - 72) : [];
      const sourceLabel = [item.source, item.published, item.evidence, item.readDepth].filter(Boolean).join(' · ') || '来源信息见原始日报';
      const sourceLines = wrapText(context, sourceLabel, contentWidth - 64);
      const urlLines = item.url ? wrapText(context, item.url.replace(/^https?:\/\//, ''), contentWidth - 64) : [];
      const titleLines = wrapText(context, item.title, contentWidth - 64);
      const itemHeight = 150 + titleLines.length * 45 + summaryLines.length * 41 + relevanceLines.length * 34 + questionLines.length * 34 + sourceLines.length * 30 + urlLines.length * 27;
      const number = layout.filter(entry => entry.type === 'item').length + 1;
      layout.push({ type: 'item', item, sectionTitle: section.title, number, titleLines, summaryLines, relevanceLines, questionLines, sourceLines, urlLines, y: cursor, height: itemHeight });
      cursor += itemHeight + 24;
    }
  }

  const footerLines = wrapText(context, '日报用于研究动态导航；证据等级与阅读范围请以原始来源为准。', contentWidth);
  const height = Math.max(850, cursor + footerLines.length * 30 + 200);
  if (height > 32000) throw new Error('日报内容超过单张长图的高度上限；请先精简日报后再导出。');
  canvas.width = width;
  canvas.height = height;
  context.fillStyle = '#faf9f6';
  context.fillRect(0, 0, width, height);

  context.fillStyle = '#5b4b8a';
  context.fillRect(margin, 62, 9, 116);
  context.textBaseline = 'top';
  context.font = '600 26px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillStyle = '#77716b';
  context.fillText('科研动态日报', margin + 28, 62);
  context.font = '700 48px "Songti SC", "Noto Serif SC", "Source Han Serif SC", serif';
  context.fillStyle = '#282623';
  context.font = '700 48px "Songti SC", "Noto Serif SC", "Source Han Serif SC", serif';
  const titleLines = wrapText(context, report.title || '科研日报', contentWidth - 70).slice(0, 2);
  drawWrapped(context, titleLines, margin + 28, 102, 58, '#282623');
  context.textAlign = 'right';
  context.font = '600 27px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillStyle = '#5b4b8a';
  context.fillText(report.date.replaceAll('-', '.'), width - margin, 68);
  context.textAlign = 'left';
  context.strokeStyle = '#b8b2a8';
  context.lineWidth = 2;
  context.beginPath(); context.moveTo(margin, 204); context.lineTo(width - margin, 204); context.stroke();
  let y = 228;
  context.font = '26px "Songti SC", "Noto Serif SC", "Source Han Serif SC", serif';
  y += drawWrapped(context, introLines, margin, y, 44, '#57534e');
  if (scopeLines.length) {
    y += 15;
    context.font = '21px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    y += drawWrapped(context, scopeLines, margin, y, 33, '#77716b');
  }
  const detailTop = y + 48;
  const itemCount = bodyItems.length;
  roundedRect(context, margin, detailTop, contentWidth, 64, 18, '#efeaf7');
  context.font = '600 23px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillStyle = '#5b4b8a';
  context.fillText(`${sectioned.length} 个版块  ·  ${itemCount} 条线索`, margin + 24, detailTop + 20);

  const offset = detailTop + 64 + 48 - layout.find(entry => entry.type === 'section')?.y;
  for (const entry of layout) {
    const top = entry.y + offset;
    if (entry.type === 'section') {
      context.font = '700 29px "Songti SC", "Noto Serif SC", "Source Han Serif SC", serif';
      context.fillStyle = '#302d29';
      context.fillText(entry.title, margin, top);
      context.fillStyle = '#5b4b8a';
      context.fillRect(margin, top + 43, 54, 4);
      continue;
    }
    roundedRect(context, margin, top, contentWidth, entry.height, 18, '#ffffff');
    context.strokeStyle = '#e8e3da';
    context.lineWidth = 1;
    context.beginPath(); context.roundRect(margin, top, contentWidth, entry.height, 18); context.stroke();
    context.font = '700 27px Georgia, serif';
    context.fillStyle = '#5b4b8a';
    context.fillText(String(entry.number).padStart(2, '0'), margin + 24, top + 26);
    context.font = '600 19px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    context.fillStyle = '#7b7191';
    context.fillText(entry.sectionTitle || entry.item.evidence || '', margin + 88, top + 29);
    let textY = top + 68;
    context.font = '700 29px "Songti SC", "Noto Serif SC", "Source Han Serif SC", serif';
    textY += drawWrapped(context, entry.titleLines, margin + 88, textY, 45, '#282623') + 12;
    context.font = '24px "Songti SC", "Noto Serif SC", "Source Han Serif SC", serif';
    textY += drawWrapped(context, entry.summaryLines, margin + 88, textY, 41, '#393632') + 10;
    if (entry.relevanceLines.length) {
      roundedRect(context, margin + 80, textY - 2, contentWidth - 104, entry.relevanceLines.length * 34 + 20, 10, '#f4f2ec');
      textY += drawWrapped(context, entry.relevanceLines, margin + 96, textY + 8, 34, '#625a69') + 24;
    }
    if (entry.questionLines.length) {
      context.font = '23px "Songti SC", "Noto Serif SC", serif';
      textY += drawWrapped(context, entry.questionLines, margin + 88, textY, 34, '#6d554d') + 14;
    }
    context.font = '20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    textY += drawWrapped(context, entry.sourceLines, margin + 88, textY, 30, '#77716b') + 5;
    if (entry.urlLines.length) {
      context.font = '18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      drawWrapped(context, entry.urlLines, margin + 88, textY, 27, '#6a5a91');
    }
  }

  const footerY = height - footerLines.length * 30 - 58;
  context.strokeStyle = '#817c73';
  context.lineWidth = 2;
  context.beginPath(); context.moveTo(margin, footerY - 24); context.lineTo(width - margin, footerY - 24); context.stroke();
  context.font = '18px "Songti SC", "Noto Serif SC", serif';
  drawWrapped(context, footerLines, margin, footerY, 30, '#807b72');

  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('浏览器未能生成 PNG。')), 'image/png'));
}
