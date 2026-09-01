(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GrowthReportPrint = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function text(value) {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  function escapeHtml(value) {
    return text(value).replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character]));
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function img(url, alt, extraClass) {
    if (!url) return `<div class="gpr-image-empty">${escapeHtml(alt || '成长影像')}</div>`;
    return `<img class="${extraClass || ''}" src="${escapeHtml(url)}" alt="${escapeHtml(alt || '成长影像')}">`;
  }

  function pageShell(model, page, body, className) {
    return `<article class="gpr-print-page ${className || ''}" data-page="${page.pageNumber}" data-type="${escapeHtml(page.type)}">
      <header class="gpr-page-header"><span>${escapeHtml(model.theme.eyebrow)}</span><strong>${escapeHtml(model.child.name)}的成长履历</strong></header>
      <main>${body}</main>
      <footer><span>阿墨逗儿童成长中心 · Growth Portfolio</span><span>${page.pageNumber} / ${model.pages.length}</span></footer>
    </article>`;
  }

  function heading(title, subtitle) {
    return `<div class="gpr-heading"><p>${escapeHtml(subtitle)}</p><h2>${escapeHtml(title)}</h2><i></i></div>`;
  }

  function renderCover(model, page) {
    const stats = [
      [model.summary.counts.records, '成长记录'], [model.summary.counts.works, '作品影像'],
      [model.summary.counts.achievements, '荣誉高光'], [model.summary.counts.skills, '技能积累']
    ];
    const body = `<div class="gpr-cover-copy">
        <div class="gpr-cover-motif">${escapeHtml(model.theme.motif)}</div>
        <p>${escapeHtml(model.theme.eyebrow)} · GROWTH PORTFOLIO</p>
        <h1>${escapeHtml(model.child.name)}的<br>成长履历</h1>
        <blockquote>${escapeHtml(model.child.introduction)}</blockquote>
        <div class="gpr-keywords">${model.child.keywords.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>
      </div>
      <div class="gpr-cover-photo">${img(model.child.avatarUrl, model.child.name)}</div>
      <div class="gpr-cover-stats">${stats.map(item => `<span><strong>${item[0]}</strong>${item[1]}</span>`).join('')}</div>
      <div class="gpr-cover-brand">阿墨逗儿童成长中心<br><small>${escapeHtml(model.theme.tagline)}</small></div>`;
    return pageShell(model, page, body, 'gpr-cover');
  }

  function renderProfile(model, page) {
    const stats = [
      [model.summary.counts.records, '成长记录'], [model.summary.counts.projects, '项目经历'],
      [model.summary.counts.works, '作品证据'], [model.summary.counts.achievements, '荣誉高光']
    ];
    const body = `${heading('这是独一无二的我', 'ABOUT ME')}
      <section class="gpr-profile">
        <div class="gpr-profile-photo">${img(model.child.avatarUrl, model.child.name)}</div>
        <div class="gpr-profile-copy"><h3>${escapeHtml(model.child.name)}</h3>
          <p class="gpr-stage">${model.child.age === null ? '' : `${model.child.age}岁 · `}${escapeHtml(model.child.stage)}${model.child.className ? ` · ${escapeHtml(model.child.className)}` : ''}</p>
          <p>${escapeHtml(model.child.introduction)}</p>
          <div class="gpr-keywords">${model.child.keywords.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>
        </div>
      </section>
      <div class="gpr-stat-row">${stats.map(item => `<span><strong>${item[0]}</strong>${item[1]}</span>`).join('')}</div>`;
    return pageShell(model, page, body);
  }

  function renderTimeline(model, page) {
    const body = `${heading('成长从来不是一条直线', `GROWTH TIMELINE${page.total > 1 ? ` · ${page.index}/${page.total}` : ''}`)}
      <ol class="gpr-timeline">${page.items.map(item => `<li><time>${formatDate(item.date)}</time><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.detail || item.teacherObservation)}</p></div></li>`).join('')}</ol>`;
    return pageShell(model, page, body);
  }

  function evidenceForRecord(model, recordId) {
    return model.evidence.filter(item => item.recordId === recordId).slice(0, 3);
  }

  function renderProjects(model, page) {
    const body = `${heading('想法在作品里慢慢长大', `PROJECTS & WORKS${page.total > 1 ? ` · ${page.index}/${page.total}` : ''}`)}
      <div class="gpr-projects">${page.items.map(record => {
        const evidence = evidenceForRecord(model, record.id)[0];
        const contain = evidence && ['certificate','document'].includes(evidence.kind) ? 'gpr-contain' : '';
        return `<section><div class="gpr-project-image">${img(evidence && evidence.url, record.title, contain)}</div><div><time>${formatDate(record.date)}</time><h3>${escapeHtml(record.title)}</h3><p>${escapeHtml(record.detail)}</p>${record.source === 'PARENT_PROVIDED' ? '<small>家长补充 · 机构已审核</small>' : ''}</div></section>`;
      }).join('')}</div>`;
    return pageShell(model, page, body);
  }

  function renderGallery(model, page) {
    const body = `${heading('每一份证据都值得被认真收藏', `GROWTH EVIDENCE${page.total > 1 ? ` · ${page.index}/${page.total}` : ''}`)}
      <div class="gpr-gallery gpr-gallery-${page.items.length}">${page.items.map(item => `<figure>${img(item.url, item.title, ['certificate','document'].includes(item.kind) ? 'gpr-contain' : '')}<figcaption>${escapeHtml(item.title || '成长影像')}</figcaption></figure>`).join('')}</div>`;
    return pageShell(model, page, body);
  }

  function renderSkills(model, page) {
    const body = `${heading('技能不是标签，而是一次次真实积累', 'SKILLS & GROWTH')}
      <div class="gpr-skills">${page.items.map((item, index) => `<section><b>${String(index + 1).padStart(2, '0')}</b><h3>${escapeHtml(item.name)}</h3><p>${item.evidenceCount} 条成长记录</p></section>`).join('')}</div>`;
    return pageShell(model, page, body);
  }

  function renderAchievements(model, page) {
    const body = `${heading('高光时刻，也记录背后的坚持', `ACHIEVEMENTS${page.total > 1 ? ` · ${page.index}/${page.total}` : ''}`)}
      <div class="gpr-achievements">${page.items.map(item => `<section><b>${escapeHtml(model.theme.motif)}</b><time>${formatDate(item.date)}</time><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.detail)}</p></section>`).join('')}</div>`;
    return pageShell(model, page, body);
  }

  function renderInterests(model, page) {
    const body = `${heading('好奇心正在画出自己的星图', 'INTERESTS & GROWTH')}
      <div class="gpr-interest-map"><strong>${escapeHtml(model.child.name)}<small>兴趣星图</small></strong>${page.items.map((item, index) => `<span style="--i:${index};--n:${page.items.length}">${escapeHtml(item)}</span>`).join('')}</div>`;
    return pageShell(model, page, body);
  }

  function renderObservations(model, page) {
    const body = `${heading('被看见，是成长最温暖的礼物', `TEACHER OBSERVATION${page.total > 1 ? ` · ${page.index}/${page.total}` : ''}`)}
      <div class="gpr-observations">${page.items.map(item => `<blockquote><i>“</i><p>${escapeHtml(item.teacherObservation || item.detail)}</p><footer>${escapeHtml(item.title)} · ${formatDate(item.date)}</footer></blockquote>`).join('')}</div>`;
    return pageShell(model, page, body);
  }

  function renderSummary(model, page) {
    const stats = [
      [model.summary.counts.records, '成长记录'], [model.summary.counts.projects, '项目经历'],
      [model.summary.counts.works, '作品证据'], [model.summary.counts.achievements, '荣誉高光']
    ];
    const message = model.summary.teacherMessage || model.summary.familyMessage || model.child.introduction;
    const body = `${heading('这一程，成长有迹可循', 'GROWTH REPORT SUMMARY')}
      <div class="gpr-stat-row">${stats.map(item => `<span><strong>${item[0]}</strong>${item[1]}</span>`).join('')}</div>
      <blockquote class="gpr-summary-quote">${escapeHtml(message)}</blockquote>
      <p class="gpr-report-period">${escapeHtml(model.metadata.periodStart || '成长起点')} — ${escapeHtml(model.metadata.periodEnd || '持续记录中')}</p>`;
    return pageShell(model, page, body);
  }

  function renderClosing(model, page) {
    const body = `<div class="gpr-closing-copy"><div>${escapeHtml(model.theme.motif)}　${escapeHtml(model.theme.motifSecondary)}</div><h2>愿每一次好奇，<br>都被温柔收藏</h2><p>${escapeHtml(model.child.name)} · ${escapeHtml(model.theme.tagline)}</p><small>阿墨逗儿童成长中心</small></div>`;
    return pageShell(model, page, body, 'gpr-closing');
  }

  function renderPage(model, page) {
    if (page.type === 'cover') return renderCover(model, page);
    if (page.type === 'profile') return renderProfile(model, page);
    if (page.type === 'timeline') return renderTimeline(model, page);
    if (page.type === 'project') return renderProjects(model, page);
    if (page.type === 'gallery') return renderGallery(model, page);
    if (page.type === 'skills') return renderSkills(model, page);
    if (page.type === 'achievement') return renderAchievements(model, page);
    if (page.type === 'interest') return renderInterests(model, page);
    if (page.type === 'teacher-observation') return renderObservations(model, page);
    if (page.type === 'summary') return renderSummary(model, page);
    if (page.type === 'closing') return renderClosing(model, page);
    return '';
  }

  function renderReportHtml(model) {
    if (!model || !Array.isArray(model.pages)) throw new Error('REPORT_MODEL_REQUIRED');
    const themeStyle = `--gpr-primary:#${model.theme.primary};--gpr-secondary:#${model.theme.secondary};--gpr-accent:#${model.theme.accent};--gpr-bg:#${model.theme.background};--gpr-paper:#${model.theme.paper};--gpr-ink:#${model.theme.ink};--gpr-muted:#${model.theme.muted};--gpr-soft:#${model.theme.soft}`;
    return `<section class="gpr-print-root" id="growth-report-print-root" data-theme="${escapeHtml(model.theme.id)}" style="${themeStyle}">${model.pages.map(page => renderPage(model, page)).join('')}</section>`;
  }

  function waitForImages(root, timeoutMs) {
    const pending = [...root.querySelectorAll('img')].filter(image => !image.complete);
    if (!pending.length) return Promise.resolve();
    return new Promise(resolve => {
      let remaining = pending.length;
      const done = () => { remaining -= 1; if (remaining <= 0) resolve(); };
      pending.forEach(image => { image.addEventListener('load', done, { once:true }); image.addEventListener('error', done, { once:true }); });
      setTimeout(resolve, timeoutMs || 5000);
    });
  }

  async function printReport(model) {
    if (typeof document === 'undefined' || typeof window === 'undefined') throw new Error('BROWSER_REQUIRED');
    document.getElementById('growth-report-print-root')?.remove();
    document.body.insertAdjacentHTML('beforeend', renderReportHtml(model));
    const root = document.getElementById('growth-report-print-root');
    await waitForImages(root, 6000);
    document.body.classList.add('growth-report-printing');
    const cleanup = () => {
      document.body.classList.remove('growth-report-printing');
      root?.remove();
    };
    window.addEventListener('afterprint', cleanup, { once:true });
    window.print();
    setTimeout(cleanup, 60000);
    return { pageCount:model.pages.length };
  }

  return Object.freeze({
    renderReportHtml,
    waitForImages,
    printReport
  });
});
