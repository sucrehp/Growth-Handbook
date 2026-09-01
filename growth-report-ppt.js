(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GrowthReportPpt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FONT = 'Microsoft YaHei';
  const W = 13.333;
  const H = 7.5;

  function text(value) {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  function short(value, maximum) {
    const valueText = text(value);
    return valueText.length > maximum ? `${valueText.slice(0, Math.max(1, maximum - 1))}…` : valueText;
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return text(value);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  }

  function addNotes(slide) {
    if (typeof slide.addNotes === 'function') {
      slide.addNotes('[Sources]\n- Growth Portfolio records supplied by the institution and family.');
    }
  }

  function addShape(slide, pptx, shape, options) {
    slide.addShape(pptx.ShapeType[shape] || shape, options);
  }

  function addThemeAtmosphere(slide, theme, dark) {
    const color = dark ? 'FFFFFF' : theme.secondary;
    const accents = {
      sky:[['☁',10.8,.35,30],['⌁',9.75,6.18,30]],
      cosmic:[['✦',10.9,.35,25],['◌',9.82,6.2,28],['·',12.15,1.25,30]],
      forest:[['❧',10.85,.38,28],['⌁',9.7,6.18,28]],
      sunshine:[['☀',10.82,.35,28],['➜',9.72,6.22,26]],
      blossom:[['✿',10.82,.38,27],['❀',9.72,6.18,26]],
      dream:[['◒',10.85,.36,29],['✦',9.74,6.18,26]]
    };
    (accents[theme.id] || accents.sky).forEach(item => slide.addText(item[0], {
      x:item[1], y:item[2], w:.8, h:.48, fontFace:FONT, fontSize:item[3], color, transparency:dark ? 55 : 35, margin:0, align:'center'
    }));
  }

  function addBackground(slide, pptx, theme, dark) {
    slide.background = { color: dark ? theme.primary : theme.background };
    addShape(slide, pptx, 'rect', { x:0, y:0, w:0.09, h:H, line:{ color:theme.accent, transparency:100 }, fill:{ color:theme.accent } });
    addShape(slide, pptx, 'ellipse', { x:10.65, y:0, w:2.68, h:2.25, line:{ color:dark ? theme.secondary : theme.soft, transparency:100 }, fill:{ color:dark ? theme.secondary : theme.soft, transparency:dark ? 78 : 10 } });
    addShape(slide, pptx, 'ellipse', { x:0, y:5.95, w:1.65, h:1.55, line:{ color:theme.accent, transparency:100 }, fill:{ color:theme.accent, transparency:dark ? 82 : 72 } });
    addThemeAtmosphere(slide, theme, dark);
  }

  function addFooter(slide, model, page) {
    slide.addText('阿墨逗儿童成长中心  ·  Growth Portfolio', { x:.55, y:7.08, w:8.8, h:.18, fontFace:FONT, fontSize:8.5, color:model.theme.muted, margin:0 });
    slide.addText(`${page.pageNumber} / ${model.pages.length}`, { x:11.75, y:7.08, w:1, h:.18, fontFace:FONT, fontSize:8.5, color:model.theme.muted, align:'right', margin:0 });
  }

  function addHeader(slide, pptx, model, page, title, subtitle) {
    addBackground(slide, pptx, model.theme, false);
    slide.addText(title, { x:.58, y:.38, w:8.9, h:.52, fontFace:FONT, fontSize:35, bold:true, color:model.theme.ink, margin:0, breakLine:false, fit:'shrink' });
    if (subtitle) slide.addText(subtitle, { x:.6, y:1.02, w:9.6, h:.3, fontFace:FONT, fontSize:16, color:model.theme.muted, margin:0 });
    addShape(slide, pptx, 'rect', { x:.6, y:1.43, w:1.35, h:.055, line:{ color:model.theme.accent, transparency:100 }, fill:{ color:model.theme.accent } });
    addFooter(slide, model, page);
    addNotes(slide);
  }

  function addPill(slide, pptx, label, x, y, theme, width) {
    const w = width || Math.max(1.1, Math.min(2.2, .38 + text(label).length * .18));
    addShape(slide, pptx, 'roundRect', { x, y, w, h:.42, rectRadius:.08, line:{ color:theme.secondary, transparency:65, width:1 }, fill:{ color:theme.soft } });
    slide.addText(short(label, 12), { x:x + .08, y:y + .09, w:w - .16, h:.2, fontFace:FONT, fontSize:12, bold:true, color:theme.primary, align:'center', margin:0, fit:'shrink' });
    return w;
  }

  function imageOptions(asset, frame, mode) {
    const source = asset && asset.data ? { data:asset.data } : { path:asset && asset.path ? asset.path : '' };
    return { ...source, x:frame.x, y:frame.y, w:frame.w, h:frame.h, sizing:{ type:mode || 'cover', w:frame.w, h:frame.h } };
  }

  function addImageFrame(slide, pptx, asset, frame, theme, mode, label) {
    addShape(slide, pptx, 'roundRect', { x:frame.x, y:frame.y, w:frame.w, h:frame.h, rectRadius:.08, line:{ color:theme.soft, width:1 }, fill:{ color:theme.soft } });
    if (asset && (asset.data || asset.path)) {
      slide.addImage(imageOptions(asset, frame, mode));
      return;
    }
    slide.addText(label || '成长影像', { x:frame.x + .15, y:frame.y + frame.h / 2 - .15, w:frame.w - .3, h:.3, fontFace:FONT, fontSize:14, color:theme.muted, align:'center', margin:0 });
  }

  function galleryFrames(count) {
    if (count <= 1) return [{ x:.65, y:1.75, w:12, h:4.75 }];
    if (count === 2) return [{ x:.65, y:1.75, w:5.85, h:4.75 }, { x:6.82, y:1.75, w:5.85, h:4.75 }];
    if (count === 3) return [{ x:.65, y:1.75, w:7.5, h:4.75 }, { x:8.45, y:1.75, w:4.22, h:2.23 }, { x:8.45, y:4.27, w:4.22, h:2.23 }];
    return [{ x:.65, y:1.75, w:5.85, h:2.22 }, { x:6.82, y:1.75, w:5.85, h:2.22 }, { x:.65, y:4.28, w:5.85, h:2.22 }, { x:6.82, y:4.28, w:5.85, h:2.22 }];
  }

  function collectUrls(model) {
    return [...new Set([
      text(model.child.avatarUrl),
      ...model.evidence.map(item => text(item.url)),
      ...model.projectsWorks.flatMap(item => (item.evidence || []).map(evidence => text(evidence.url)))
    ].filter(Boolean))];
  }

  async function prepareAssets(model, resolver) {
    const urls = collectUrls(model);
    const assets = new Map();
    let cursor = 0;
    const workers = Array.from({ length:Math.min(4, urls.length) }, async () => {
      while (cursor < urls.length) {
        const index = cursor++;
        const url = urls[index];
        try {
          const asset = resolver ? await resolver(url) : (/^data:/i.test(url) ? { data:url } : { path:url });
          if (asset && (asset.data || asset.path)) assets.set(url, asset);
        } catch (error) {
          assets.set(url, { error:text(error && error.message) || 'ASSET_LOAD_FAILED' });
        }
      }
    });
    await Promise.all(workers);
    return assets;
  }

  function renderCover(pptx, model, page, assets) {
    const slide = pptx.addSlide();
    addBackground(slide, pptx, model.theme, true);
    slide.addText(model.theme.motif, { x:.75, y:.55, w:1, h:.75, fontFace:FONT, fontSize:40, color:model.theme.accent, margin:0 });
    slide.addText(`${model.theme.eyebrow} · GROWTH PORTFOLIO`, { x:.8, y:1.55, w:6.8, h:.34, fontFace:FONT, fontSize:16, bold:true, color:model.theme.accent, charSpacing:2.1, margin:0, fit:'shrink' });
    slide.addText(`${short(model.child.name, 16)}的成长履历`, { x:.78, y:2.05, w:7.15, h:1.2, fontFace:FONT, fontSize:52, bold:true, color:'FFFFFF', margin:0, breakLine:false, fit:'shrink' });
    slide.addText(model.child.introduction, { x:.82, y:3.5, w:6.65, h:1.1, fontFace:FONT, fontSize:18, color:'FFFFFF', breakLine:false, fit:'shrink', margin:0, transparency:12 });
    let x = .8;
    model.child.keywords.forEach(keyword => { x += addPill(slide, pptx, keyword, x, 5.15, model.theme) + .16; });
    const avatar = assets.get(model.child.avatarUrl);
    addImageFrame(slide, pptx, avatar, { x:8.5, y:1.12, w:3.65, h:4.9 }, model.theme, 'cover', model.child.name);
    slide.addText('阿墨逗儿童成长中心', { x:.8, y:6.72, w:5, h:.3, fontFace:FONT, fontSize:12, color:'FFFFFF', margin:0 });
    addNotes(slide);
  }

  function renderProfile(pptx, model, page, assets) {
    const slide = pptx.addSlide();
    addHeader(slide, pptx, model, page, '这是独一无二的我', '一页读懂成长阶段、兴趣关键词与成长积累');
    addImageFrame(slide, pptx, assets.get(model.child.avatarUrl), { x:.7, y:1.78, w:3.1, h:3.55 }, model.theme, 'cover', model.child.name);
    slide.addText(short(model.child.name, 18), { x:4.25, y:1.75, w:7.9, h:.75, fontFace:FONT, fontSize:40, bold:true, color:model.theme.primary, margin:0, fit:'shrink' });
    slide.addText(`${model.child.age === null ? '' : `${model.child.age}岁 · `}${model.child.stage}${model.child.className ? ` · ${model.child.className}` : ''}`, { x:4.28, y:2.58, w:7.7, h:.35, fontFace:FONT, fontSize:17, color:model.theme.muted, margin:0 });
    slide.addText(model.child.introduction, { x:4.28, y:3.15, w:7.7, h:1.1, fontFace:FONT, fontSize:18, color:model.theme.ink, breakLine:false, fit:'shrink', margin:0 });
    let x = 4.28;
    model.child.keywords.forEach(keyword => { x += addPill(slide, pptx, keyword, x, 4.65, model.theme) + .18; });
    const stats = [
      [model.summary.counts.records, '成长记录'], [model.summary.counts.works, '作品影像'],
      [model.summary.counts.achievements, '荣誉高光'], [model.summary.counts.skills, '技能积累']
    ];
    stats.forEach((item, index) => {
      const sx = .78 + index * 3.05;
      slide.addText(String(item[0]), { x:sx, y:5.72, w:1, h:.55, fontFace:FONT, fontSize:30, bold:true, color:model.theme.primary, margin:0 });
      slide.addText(item[1], { x:sx + .82, y:5.88, w:1.7, h:.28, fontFace:FONT, fontSize:13, color:model.theme.muted, margin:0 });
    });
  }

  function renderTimeline(pptx, model, page) {
    const slide = pptx.addSlide();
    addHeader(slide, pptx, model, page, '成长从来不是一条直线', `成长轨迹${page.total > 1 ? ` · ${page.index}/${page.total}` : ''}`);
    page.items.forEach((item, index) => {
      const y = 1.78 + index * .98;
      addShape(slide, pptx, 'ellipse', { x:.8, y:y + .12, w:.24, h:.24, line:{ color:model.theme.accent, transparency:100 }, fill:{ color:model.theme.accent } });
      if (index < page.items.length - 1) addShape(slide, pptx, 'rect', { x:.89, y:y + .36, w:.045, h:.72, line:{ color:model.theme.secondary, transparency:100 }, fill:{ color:model.theme.secondary, transparency:45 } });
      slide.addText(formatDate(item.date), { x:1.25, y, w:1.45, h:.3, fontFace:FONT, fontSize:13, bold:true, color:model.theme.secondary, margin:0 });
      slide.addText(short(item.title, 28), { x:2.8, y, w:4.1, h:.36, fontFace:FONT, fontSize:18, bold:true, color:model.theme.ink, margin:0, fit:'shrink' });
      slide.addText(short(item.detail || item.teacherObservation, 70), { x:7.0, y, w:5.55, h:.58, fontFace:FONT, fontSize:14, color:model.theme.muted, margin:0, breakLine:false, fit:'shrink' });
    });
  }

  function evidenceForRecord(model, recordId) {
    return model.evidence.filter(item => item.recordId === recordId).slice(0, 3);
  }

  function renderProjects(pptx, model, page, assets) {
    const slide = pptx.addSlide();
    addHeader(slide, pptx, model, page, '想法在作品里慢慢长大', `作品与项目${page.total > 1 ? ` · ${page.index}/${page.total}` : ''}`);
    page.items.forEach((record, index) => {
      const y = 1.72 + index * 2.55;
      const evidence = evidenceForRecord(model, record.id)[0];
      addImageFrame(slide, pptx, evidence && assets.get(evidence.url), { x:.72, y, w:3.65, h:2.15 }, model.theme, evidence && ['certificate','document'].includes(evidence.kind) ? 'contain' : 'cover', record.title);
      slide.addText(short(record.title, 30), { x:4.72, y:y + .05, w:7.55, h:.4, fontFace:FONT, fontSize:21, bold:true, color:model.theme.primary, margin:0, fit:'shrink' });
      slide.addText(formatDate(record.date), { x:4.74, y:y + .58, w:2, h:.25, fontFace:FONT, fontSize:12, color:model.theme.secondary, margin:0 });
      slide.addText(short(record.detail, 120), { x:4.74, y:y + .98, w:7.55, h:.88, fontFace:FONT, fontSize:16, color:model.theme.ink, margin:0, fit:'shrink' });
      if (record.source === 'PARENT_PROVIDED') addPill(slide, pptx, '家长补充 · 已审核', 10.1, y + 1.75, model.theme, 2.18);
    });
  }

  function renderGallery(pptx, model, page, assets) {
    const slide = pptx.addSlide();
    addHeader(slide, pptx, model, page, '每一份证据都值得被认真收藏', `成长影像与作品${page.total > 1 ? ` · ${page.index}/${page.total}` : ''}`);
    const frames = galleryFrames(page.items.length);
    page.items.forEach((evidence, index) => {
      const certificate = ['certificate','document'].includes(evidence.kind);
      addImageFrame(slide, pptx, assets.get(evidence.url), frames[index], model.theme, certificate ? 'contain' : 'cover', evidence.title);
      if (evidence.title) slide.addText(short(evidence.title, 22), { x:frames[index].x + .12, y:frames[index].y + frames[index].h - .46, w:frames[index].w - .24, h:.28, fontFace:FONT, fontSize:12, bold:true, color:certificate ? model.theme.ink : 'FFFFFF', fill:{ color:certificate ? model.theme.paper : model.theme.ink, transparency:certificate ? 10 : 30 }, margin:.05, fit:'shrink' });
    });
  }

  function renderSkills(pptx, model, page) {
    const slide = pptx.addSlide();
    addHeader(slide, pptx, model, page, '技能不是标签，而是一次次真实积累', '技能成长');
    page.items.forEach((skill, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = .75 + col * 6.15;
      const y = 1.78 + row * .93;
      addShape(slide, pptx, 'roundRect', { x, y, w:5.72, h:.7, rectRadius:.06, line:{ color:model.theme.soft, width:1 }, fill:{ color:model.theme.paper } });
      slide.addText(short(skill.name, 24), { x:x + .25, y:y + .18, w:4.25, h:.27, fontFace:FONT, fontSize:16, bold:true, color:model.theme.ink, margin:0, fit:'shrink' });
      slide.addText(`${skill.evidenceCount} 条记录`, { x:x + 4.45, y:y + .2, w:1, h:.24, fontFace:FONT, fontSize:11, color:model.theme.secondary, align:'right', margin:0 });
    });
  }

  function renderAchievements(pptx, model, page) {
    const slide = pptx.addSlide();
    addHeader(slide, pptx, model, page, '高光时刻，也记录背后的坚持', `成就与荣誉${page.total > 1 ? ` · ${page.index}/${page.total}` : ''}`);
    page.items.forEach((item, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = .72 + col * 6.2;
      const y = 1.78 + row * 2.35;
      addShape(slide, pptx, 'roundRect', { x, y, w:5.75, h:1.92, rectRadius:.08, line:{ color:model.theme.accent, transparency:40, width:1.2 }, fill:{ color:model.theme.paper } });
      slide.addText(model.theme.motif, { x:x + .25, y:y + .2, w:.55, h:.48, fontFace:FONT, fontSize:24, color:model.theme.accent, margin:0 });
      slide.addText(short(item.title, 26), { x:x + .9, y:y + .22, w:4.55, h:.4, fontFace:FONT, fontSize:19, bold:true, color:model.theme.primary, margin:0, fit:'shrink' });
      slide.addText(formatDate(item.date), { x:x + .9, y:y + .73, w:2, h:.25, fontFace:FONT, fontSize:11, color:model.theme.secondary, margin:0 });
      slide.addText(short(item.detail, 72), { x:x + .9, y:y + 1.08, w:4.45, h:.52, fontFace:FONT, fontSize:14, color:model.theme.ink, margin:0, fit:'shrink' });
    });
  }

  function renderSkillsAchievements(pptx, model, page) {
    const slide = pptx.addSlide();
    addHeader(slide, pptx, model, page, '积累与高光，构成完整的成长证据', 'SKILLS & ACHIEVEMENTS');
    slide.addText('技能积累', { x:.75, y:1.78, w:4.9, h:.4, fontFace:FONT, fontSize:20, bold:true, color:model.theme.primary, margin:0 });
    page.skills.slice(0, 4).forEach((skill, index) => {
      const y = 2.42 + index * .86;
      addShape(slide, pptx, 'roundRect', { x:.75, y, w:5.65, h:.65, rectRadius:.05, line:{ color:model.theme.soft, width:1 }, fill:{ color:model.theme.paper } });
      slide.addText(short(skill.name, 24), { x:1.02, y:y + .17, w:4.2, h:.26, fontFace:FONT, fontSize:15, bold:true, color:model.theme.ink, margin:0, fit:'shrink' });
      slide.addText(`${skill.evidenceCount} 条`, { x:5.25, y:y + .18, w:.75, h:.23, fontFace:FONT, fontSize:10, color:model.theme.secondary, align:'right', margin:0 });
    });
    slide.addText('荣誉高光', { x:6.92, y:1.78, w:4.9, h:.4, fontFace:FONT, fontSize:20, bold:true, color:model.theme.primary, margin:0 });
    page.achievements.slice(0, 2).forEach((item, index) => {
      const y = 2.42 + index * 1.82;
      addShape(slide, pptx, 'roundRect', { x:6.92, y, w:5.65, h:1.48, rectRadius:.07, line:{ color:model.theme.accent, transparency:45, width:1 }, fill:{ color:model.theme.paper } });
      slide.addText(model.theme.motif, { x:7.2, y:y + .25, w:.5, h:.4, fontFace:FONT, fontSize:22, color:model.theme.accent, margin:0 });
      slide.addText(short(item.title, 24), { x:7.82, y:y + .25, w:4.3, h:.34, fontFace:FONT, fontSize:17, bold:true, color:model.theme.primary, margin:0, fit:'shrink' });
      slide.addText(`${formatDate(item.date)}  ${short(item.detail, 48)}`, { x:7.82, y:y + .78, w:4.25, h:.38, fontFace:FONT, fontSize:11, color:model.theme.muted, margin:0, fit:'shrink' });
    });
  }

  function renderInterests(pptx, model, page) {
    const slide = pptx.addSlide();
    addHeader(slide, pptx, model, page, '好奇心正在画出自己的星图', '兴趣与成长');
    slide.addText(short(model.child.name, 12), { x:5.25, y:2.55, w:2.8, h:.75, fontFace:FONT, fontSize:30, bold:true, color:'FFFFFF', align:'center', margin:0, fill:{ color:model.theme.primary }, fit:'shrink' });
    page.items.forEach((interest, index) => {
      const angle = (Math.PI * 2 * index / page.items.length) - Math.PI / 2;
      const x = 5.75 + Math.cos(angle) * 4.25;
      const y = 2.78 + Math.sin(angle) * 1.65;
      addPill(slide, pptx, interest, x, y, model.theme, 2.1);
    });
  }

  function renderObservations(pptx, model, page) {
    const slide = pptx.addSlide();
    addHeader(slide, pptx, model, page, '被看见，是成长最温暖的礼物', `教师观察${page.total > 1 ? ` · ${page.index}/${page.total}` : ''}`);
    page.items.forEach((item, index) => {
      const y = 1.82 + index * 2.28;
      addShape(slide, pptx, 'roundRect', { x:.78, y, w:11.75, h:1.82, rectRadius:.08, line:{ color:model.theme.soft, width:1 }, fill:{ color:model.theme.paper } });
      addShape(slide, pptx, 'rect', { x:.78, y, w:.08, h:1.82, line:{ color:model.theme.accent, transparency:100 }, fill:{ color:model.theme.accent } });
      slide.addText('“', { x:1.1, y:y + .1, w:.6, h:.65, fontFace:FONT, fontSize:42, bold:true, color:model.theme.accent, margin:0 });
      slide.addText(short(item.teacherObservation || item.detail, 150), { x:1.72, y:y + .28, w:9.95, h:.92, fontFace:FONT, fontSize:18, color:model.theme.ink, margin:0, fit:'shrink' });
      slide.addText(`${short(item.title, 22)} · ${formatDate(item.date)}`, { x:8.2, y:y + 1.34, w:3.4, h:.24, fontFace:FONT, fontSize:11, color:model.theme.muted, align:'right', margin:0 });
    });
  }

  function renderSummary(pptx, model, page) {
    const slide = pptx.addSlide();
    addHeader(slide, pptx, model, page, '这一程，成长有迹可循', '成长报告摘要');
    const stats = [
      [model.summary.counts.records, '成长记录'], [model.summary.counts.projects, '项目经历'],
      [model.summary.counts.works, '作品证据'], [model.summary.counts.achievements, '荣誉高光']
    ];
    stats.forEach((item, index) => {
      const x = .72 + index * 3.1;
      addShape(slide, pptx, 'roundRect', { x, y:1.82, w:2.72, h:1.5, rectRadius:.08, line:{ color:model.theme.soft, width:1 }, fill:{ color:model.theme.paper } });
      slide.addText(String(item[0]), { x:x + .2, y:2.05, w:2.3, h:.55, fontFace:FONT, fontSize:32, bold:true, color:model.theme.primary, align:'center', margin:0 });
      slide.addText(item[1], { x:x + .2, y:2.7, w:2.3, h:.25, fontFace:FONT, fontSize:13, color:model.theme.muted, align:'center', margin:0 });
    });
    const message = model.summary.teacherMessage || model.summary.familyMessage || model.child.introduction;
    slide.addText(short(message, 190), { x:1.15, y:4.05, w:11, h:1.25, fontFace:FONT, fontSize:22, color:model.theme.ink, italic:true, align:'center', margin:0, fit:'shrink' });
    slide.addText(`${model.metadata.periodStart || '成长起点'} — ${model.metadata.periodEnd || '持续记录中'}`, { x:3.8, y:5.75, w:5.7, h:.3, fontFace:FONT, fontSize:13, color:model.theme.secondary, align:'center', margin:0 });
  }

  function renderClosing(pptx, model) {
    const slide = pptx.addSlide();
    addBackground(slide, pptx, model.theme, true);
    slide.addText(`${model.theme.motif}  ${model.theme.motifSecondary}`, { x:5.28, y:1.05, w:2.8, h:1, fontFace:FONT, fontSize:48, color:model.theme.accent, align:'center', margin:0 });
    slide.addText('愿每一次好奇，都被温柔收藏', { x:1.1, y:2.5, w:11.1, h:.9, fontFace:FONT, fontSize:42, bold:true, color:'FFFFFF', align:'center', margin:0, fit:'shrink' });
    slide.addText(`${short(model.child.name, 16)} · ${model.theme.tagline}`, { x:2, y:3.7, w:9.3, h:.42, fontFace:FONT, fontSize:18, color:model.theme.accent, align:'center', margin:0 });
    slide.addText('阿墨逗儿童成长中心', { x:2, y:5.85, w:9.3, h:.3, fontFace:FONT, fontSize:14, color:'FFFFFF', align:'center', margin:0 });
    addNotes(slide);
  }

  async function composePpt(PptxGenJS, model, options) {
    if (typeof PptxGenJS !== 'function') throw new Error('PPTXGENJS_REQUIRED');
    if (!model || !Array.isArray(model.pages)) throw new Error('REPORT_MODEL_REQUIRED');
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = '阿墨逗儿童成长中心';
    pptx.company = '阿墨逗儿童成长中心';
    pptx.subject = '儿童成长履历';
    pptx.title = `${model.child.name}的成长履历`;
    pptx.theme = { headFontFace:FONT, bodyFontFace:FONT };
    const assets = await prepareAssets(model, options && options.resolveAsset);
    model.pages.forEach(page => {
      if (page.type === 'cover') renderCover(pptx, model, page, assets);
      else if (page.type === 'profile') renderProfile(pptx, model, page, assets);
      else if (page.type === 'timeline') renderTimeline(pptx, model, page);
      else if (page.type === 'project') renderProjects(pptx, model, page, assets);
      else if (page.type === 'gallery') renderGallery(pptx, model, page, assets);
      else if (page.type === 'skills') renderSkills(pptx, model, page);
      else if (page.type === 'skills-achievements') renderSkillsAchievements(pptx, model, page);
      else if (page.type === 'achievement') renderAchievements(pptx, model, page);
      else if (page.type === 'interest') renderInterests(pptx, model, page);
      else if (page.type === 'teacher-observation') renderObservations(pptx, model, page);
      else if (page.type === 'summary') renderSummary(pptx, model, page);
      else if (page.type === 'closing') renderClosing(pptx, model, page);
    });
    return { pptx, slideCount:model.pages.length, assetCount:assets.size, failedAssets:[...assets.values()].filter(asset => asset.error).length };
  }

  return Object.freeze({
    FONT,
    galleryFrames,
    prepareAssets,
    composePpt
  });
});
