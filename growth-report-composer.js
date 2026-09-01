(function (root, factory) {
  const adapter = typeof module === 'object' && module.exports
    ? require('./growth-record-adapter')
    : root.GrowthRecordAdapter;
  const api = factory(adapter);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GrowthReportComposer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (GrowthRecordAdapter) {
  'use strict';

  const REPORT_MODEL_VERSION = '1.0';
  const REPORT_TYPE = 'GROWTH_PORTFOLIO_LITE';
  const DEFAULT_THEME = 'sky';
  const TYPE = GrowthRecordAdapter && GrowthRecordAdapter.TYPES ? GrowthRecordAdapter.TYPES : {
    LEARNING:'LEARNING', PROJECT:'PROJECT', WORK:'WORK', ACTIVITY:'ACTIVITY', SKILL:'SKILL',
    INTEREST:'INTEREST', ACHIEVEMENT:'ACHIEVEMENT', TEACHER_OBSERVATION:'TEACHER_OBSERVATION',
    MILESTONE:'MILESTONE', OTHER:'OTHER'
  };

  const THEMES = Object.freeze({
    sky: Object.freeze({ id:'sky', label:'天空探索', eyebrow:'SKY EXPLORER', tagline:'自由想象，向光出发', primary:'315F91', secondary:'74B7E8', accent:'F1B84B', background:'F1F8FC', paper:'FFFFFF', ink:'153A64', muted:'6E8095', soft:'E4F4FC', motif:'☁', motifSecondary:'⌁' }),
    cosmic: Object.freeze({ id:'cosmic', label:'宇宙创客', eyebrow:'COSMIC MAKER', tagline:'保持好奇，勇敢抵达', primary:'493A8E', secondary:'7769D8', accent:'FFCA57', background:'F4F1FC', paper:'FFFFFF', ink:'1D174D', muted:'716C8D', soft:'ECE8FF', motif:'✦', motifSecondary:'◌' }),
    forest: Object.freeze({ id:'forest', label:'森林冒险', eyebrow:'FOREST ADVENTURE', tagline:'自然生长，温柔坚定', primary:'2E6650', secondary:'6EAD76', accent:'D9A94E', background:'F1F7F0', paper:'FFFFFF', ink:'173D32', muted:'667D72', soft:'E4F2E4', motif:'❧', motifSecondary:'⌁' }),
    sunshine: Object.freeze({ id:'sunshine', label:'阳光运动', eyebrow:'SUNSHINE MOTION', tagline:'热烈体验，快乐成长', primary:'C45B34', secondary:'F09A4A', accent:'FFD052', background:'FFF8ED', paper:'FFFFFF', ink:'71331F', muted:'8A7268', soft:'FFF0D5', motif:'☀', motifSecondary:'➜' }),
    blossom: Object.freeze({ id:'blossom', label:'花漾故事', eyebrow:'BLOSSOM STORY', tagline:'自信表达，向光盛放', primary:'A64F76', secondary:'DB86A8', accent:'E9B75F', background:'FFF5F7', paper:'FFFFFF', ink:'61334F', muted:'8D7180', soft:'FBE8EF', motif:'✿', motifSecondary:'❀' }),
    dream: Object.freeze({ id:'dream', label:'梦想画室', eyebrow:'DREAM STUDIO', tagline:'收藏灵感，闪闪发光', primary:'5367A4', secondary:'9A8BD4', accent:'E8B9CF', background:'F7F4FC', paper:'FFFFFF', ink:'30365F', muted:'757993', soft:'EEEBFA', motif:'◒', motifSecondary:'✦' })
  });

  const LEGACY_THEME_MAP = Object.freeze({
    boy_space:'cosmic', boy_forest:'forest', girl_garden:'blossom', girl_rainbow:'dream'
  });

  function text(value) {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  function array(value) {
    return Array.isArray(value) ? value : [];
  }

  function unique(values) {
    return [...new Set(array(values).map(text).filter(Boolean))];
  }

  function resolveTheme(themeId, legacyPreference) {
    const normalized = text(themeId).toLowerCase();
    const id = THEMES[normalized] ? normalized : (LEGACY_THEME_MAP[text(legacyPreference)] || DEFAULT_THEME);
    return THEMES[id];
  }

  function safeDate(value) {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function ageOn(birthday, now) {
    const birth = safeDate(birthday);
    const today = safeDate(now) || new Date();
    if (!birth) return null;
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1;
    return Math.max(0, age);
  }

  function growthStage(age) {
    if (age === null) return '成长探索期';
    if (age <= 3) return '启蒙发现期';
    if (age <= 6) return '好奇探索期';
    if (age <= 9) return '兴趣拓展期';
    if (age <= 12) return '自主进阶期';
    return '青春成长阶段';
  }

  function inferKeywords(profile, records) {
    const source = records.flatMap(record => [record.title, record.detail, record.teacherObservation]).filter(Boolean).join(' ');
    const rules = [
      [/表达|介绍|分享|语言|英语/, '自信表达'],
      [/合作|伙伴|小组|帮助/, '乐于合作'],
      [/创意|设计|想法|搭建|作品/, '创意探索'],
      [/观察|发现|自然|好奇/, '好奇观察'],
      [/专注|坚持|独立|完成/, '专注行动'],
      [/运动|体能|跑|跳|球/, '活力运动']
    ];
    const explicit = unique([
      ...array(profile && profile.child && profile.child.keywords),
      ...array(profile && profile.keywords)
    ]);
    return unique([...explicit, ...rules.filter(rule => rule[0].test(source)).map(rule => rule[1]), '成长进行时']).slice(0, 3);
  }

  function normalizeEvidence(evidence, record, resolveEvidenceUrl) {
    const originalUrl = text(evidence && evidence.url);
    const resolved = resolveEvidenceUrl ? text(resolveEvidenceUrl(evidence, record)) : originalUrl;
    if (!resolved) return null;
    const kind = text(evidence && evidence.kind).toLowerCase() || 'image';
    return {
      id: `${record ? record.id : 'gallery'}:${kind}:${resolved}`,
      kind,
      url: resolved,
      title: text(evidence && evidence.title) || text(record && record.title),
      date: text(evidence && evidence.date) || text(record && record.date),
      source: text(evidence && evidence.source) || text(record && record.source),
      featured: Boolean(record && record.featured),
      recordId: text(record && record.id),
      recordType: text(record && record.type)
    };
  }

  function selectEvidence(records, unlinkedEvidence, options) {
    const resolveEvidenceUrl = options && options.resolveEvidenceUrl;
    const maximum = Number(options && options.maximum) || 24;
    const linked = records.flatMap(record => array(record.evidence)
      .map(item => normalizeEvidence(item, record, resolveEvidenceUrl)).filter(Boolean));
    const unlinked = array(unlinkedEvidence)
      .map(item => normalizeEvidence(item, null, resolveEvidenceUrl)).filter(Boolean);
    const score = evidence => (evidence.featured ? 100 : 0)
      + (evidence.kind === 'certificate' || evidence.kind === 'document' ? 30 : 0)
      + ([TYPE.PROJECT, TYPE.WORK, TYPE.ACHIEVEMENT].includes(evidence.recordType) ? 20 : 0)
      + (evidence.source === 'PARENT_PROVIDED' ? 5 : 0)
      + (safeDate(evidence.date) ? safeDate(evidence.date).getTime() / 1e13 : 0);
    const seen = new Set();
    return [...linked, ...unlinked]
      .filter(item => ['image', 'photo', 'certificate', 'document', 'work'].includes(item.kind))
      .sort((a, b) => score(b) - score(a))
      .filter(item => !seen.has(item.url) && seen.add(item.url))
      .slice(0, maximum);
  }

  function paginate(items, pageSize) {
    const size = Math.max(1, Number(pageSize) || 1);
    const pages = [];
    for (let index = 0; index < array(items).length; index += size) pages.push(items.slice(index, index + size));
    return pages;
  }

  function sectionPages(type, items, pageSize, extra) {
    return paginate(items, pageSize).map((chunk, index, chunks) => ({
      type,
      index: index + 1,
      total: chunks.length,
      items: chunk,
      ...(extra || {})
    }));
  }

  function buildPagePlan(model) {
    const pages = [
      { type:'cover', items:[] },
      { type:'profile', items:[] }
    ];
    pages.push(...sectionPages('timeline', model.timeline, 5));
    pages.push(...sectionPages('project', model.projectsWorks, 2));
    pages.push(...sectionPages('gallery', model.evidence, 4));
    if (model.skills.length) pages.push({ type:'skills', items:model.skills.slice(0, 10) });
    pages.push(...sectionPages('achievement', model.achievements, 4));
    if (model.interests.length) pages.push({ type:'interest', items:model.interests.slice(0, 8) });
    pages.push(...sectionPages('teacher-observation', model.teacherObservations, 2));
    pages.push({ type:'summary', items:[] }, { type:'closing', items:[] });
    return pages.map((page, index) => ({ ...page, pageNumber:index + 1 }));
  }

  function recordView(record) {
    return {
      id:text(record.id), type:text(record.type), date:text(record.date), title:text(record.title),
      detail:text(record.detail), teacherObservation:text(record.teacherObservation),
      tags:unique(record.tags), featured:record.featured === true, source:text(record.source),
      status:text(record.status), evidence:array(record.evidence)
    };
  }

  function buildReportModel(profile, options) {
    if (!GrowthRecordAdapter || typeof GrowthRecordAdapter.adaptLegacyProfile !== 'function') {
      throw new Error('GROWTH_RECORD_ADAPTER_REQUIRED');
    }
    const data = profile || {};
    const child = data.child || {};
    const portfolio = GrowthRecordAdapter.adaptLegacyProfile(data);
    const published = portfolio.records.filter(record => record.status === 'PUBLISHED').map(recordView);
    const age = ageOn(child.birthday, options && options.now);
    const keywords = inferKeywords(data, published);
    const theme = resolveTheme(options && options.themeId, child.style_preference);
    const evidence = selectEvidence(published, portfolio.unlinkedEvidence, options);
    const timeline = [...published].sort((a, b) => text(a.date).localeCompare(text(b.date)));
    const projectsWorks = published.filter(record => [TYPE.PROJECT, TYPE.WORK, TYPE.ACTIVITY].includes(record.type));
    const achievements = published.filter(record => record.type === TYPE.ACHIEVEMENT);
    const teacherObservations = published.filter(record => record.type === TYPE.TEACHER_OBSERVATION || record.teacherObservation);
    const skillRecords = published.filter(record => [TYPE.LEARNING, TYPE.SKILL].includes(record.type));
    const skills = unique(skillRecords.flatMap(record => [record.title, ...record.tags])).map(name => ({
      name,
      evidenceCount: skillRecords.filter(record => record.title === name || record.tags.includes(name)).length
    }));
    const interests = unique([
      ...published.filter(record => record.type === TYPE.INTEREST).flatMap(record => [record.title, ...record.tags]),
      ...array(data.activities).map(item => item.activity_name),
      ...array(data.courses).map(item => item.course_name),
      ...keywords
    ]).slice(0, 8);
    const familyMessages = array(data.messages).map(item => ({
      text:text(item.message), author:text(item.sender_name) || '家长', relationship:text(item.relationship)
    })).filter(item => item.text);
    const introFocus = text(projectsWorks[0] && projectsWorks[0].title) || text(skillRecords[0] && skillRecords[0].title);
    const profileIntro = text(child.introduction) || `${text(child.name) || '孩子'}正处于${growthStage(age)}，喜欢通过观察、体验和表达积累自己的成长故事。${introFocus ? `最近正在探索“${introFocus}”。` : ''}`;
    const dates = published.map(record => safeDate(record.date)).filter(Boolean).sort((a, b) => a - b);
    const model = {
      version:REPORT_MODEL_VERSION,
      reportType:REPORT_TYPE,
      child:{
        id:text(child.id), name:text(child.name) || '成长中的我', gender:text(child.gender), birthday:text(child.birthday),
        age, stage:growthStage(age), className:text(child.class_name), enrollmentDate:text(child.enrollment_date),
        avatarUrl:text(child.avatar_url), keywords, introduction:profileIntro
      },
      summary:{
        teacherMessage:text(teacherObservations[0] && (teacherObservations[0].teacherObservation || teacherObservations[0].detail)),
        familyMessage:text(familyMessages[0] && familyMessages[0].text),
        counts:{ records:published.length, projects:projectsWorks.length, works:evidence.length, achievements:achievements.length, skills:skills.length }
      },
      timeline,
      projectsWorks,
      evidence,
      skills,
      achievements,
      interests,
      teacherObservations,
      familyMessages,
      theme,
      metadata:{
        generatedAt:text(options && options.generatedAt) || new Date().toISOString(),
        periodStart:dates.length ? dates[0].toISOString().slice(0, 10) : '',
        periodEnd:dates.length ? dates[dates.length - 1].toISOString().slice(0, 10) : '',
        source:'GrowthRecordAdapter + legacy profile',
        approvedParentRecords:published.filter(record => record.source === 'PARENT_PROVIDED').length,
        omittedPendingRecords:portfolio.records.filter(record => record.status !== 'PUBLISHED').length
      }
    };
    model.pages = buildPagePlan(model);
    return model;
  }

  return Object.freeze({
    REPORT_MODEL_VERSION,
    REPORT_TYPE,
    THEMES,
    resolveTheme,
    paginate,
    selectEvidence,
    buildPagePlan,
    buildReportModel
  });
});
