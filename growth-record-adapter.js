(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GrowthRecordAdapter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TYPES = Object.freeze({
    LEARNING: 'LEARNING',
    PROJECT: 'PROJECT',
    WORK: 'WORK',
    ACTIVITY: 'ACTIVITY',
    SKILL: 'SKILL',
    INTEREST: 'INTEREST',
    ACHIEVEMENT: 'ACHIEVEMENT',
    TEACHER_OBSERVATION: 'TEACHER_OBSERVATION',
    MILESTONE: 'MILESTONE',
    OTHER: 'OTHER'
  });

  const SOURCE = Object.freeze({
    INSTITUTION_RECORD: 'INSTITUTION_RECORD',
    PARENT_PROVIDED: 'PARENT_PROVIDED'
  });

  const MEDIA_GOVERNANCE = Object.freeze({
    uploadImplemented: true,
    numericLimitsFrozen: true,
    requiresHumanDecision: false,
    imageLimitPerRecord: 3,
    sourceImageLimitMb: 5,
    childQuotaMb: 20,
    videoFileUpload: false,
    note: '家长图片使用私有 parent-uploads；视频仅允许 HTTPS 外链。'
  });

  function text(value) {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  function legacyId(table, item, index) {
    return `${table}:${text(item && item.id) || index}`;
  }

  function evidenceFromUrl(url, options) {
    if (!text(url)) return null;
    return {
      kind: (options && options.kind) || 'image',
      url: text(url),
      title: text(options && options.title),
      date: text(options && options.date),
      source: text(options && options.source) || SOURCE.INSTITUTION_RECORD,
      legacy: options && options.legacy ? options.legacy : null
    };
  }

  function recordBase(table, item, index, childId, values) {
    const directEvidence = evidenceFromUrl(item && item.photo_url, {
      title: values.title,
      date: values.date,
      legacy: { table, id: text(item && item.id) }
    });
    return {
      id: legacyId(table, item, index),
      childReference: text(item && item.child_id) || text(childId),
      type: values.type,
      date: text(values.date),
      title: text(values.title),
      detail: text(values.detail),
      evidence: directEvidence ? [directEvidence] : [],
      tags: [],
      teacherObservation: text(values.teacherObservation),
      featured: false,
      source: SOURCE.INSTITUTION_RECORD,
      status: 'PUBLISHED',
      createdAt: text(item && item.created_at),
      updatedAt: text(item && item.updated_at),
      legacy: { table, id: text(item && item.id), raw: item || {} }
    };
  }

  function inferActivityType(item) {
    const declared = text(item && item.record_type).toUpperCase();
    if (declared === TYPES.PROJECT) return TYPES.PROJECT;
    if (declared === TYPES.ACTIVITY) return TYPES.ACTIVITY;
    return /(^|[\s·：:])项目([\s·：:]|$)|PROJECT/i.test(text(item && item.activity_name))
      ? TYPES.PROJECT
      : TYPES.ACTIVITY;
  }

  function buildMetadataIndex(data, childId) {
    const index = new Map();
    (data.metadata || []).forEach(item => {
      const metadataChild = text(item && item.child_id);
      if (metadataChild && text(childId) && metadataChild !== text(childId)) return;
      const table = text(item && item.source_table);
      const recordId = text(item && item.source_record_id);
      if (!table || !recordId) return;
      index.set(`${table}:${recordId}`, item);
    });
    return index;
  }

  function enrichRecord(record, metadataIndex) {
    const metadata = metadataIndex.get(`${record.legacy.table}:${record.legacy.id}`);
    if (!metadata) return record;
    const allowedTypes = Object.values(TYPES);
    const allowedSources = Object.values(SOURCE);
    const evidence = Array.isArray(metadata.evidence) ? metadata.evidence.map(item => ({
      kind: text(item && (item.evidence_type || item.kind || item.type)) || 'document',
      url: text(item && (item.existing_media_reference || item.url || item.reference || item.path)),
      title: text(item && (item.title || item.label)),
      date: text(item && item.date),
      source: allowedSources.includes(text(metadata.source)) ? text(metadata.source) : SOURCE.INSTITUTION_RECORD,
      legacy: { table: record.legacy.table, id: record.legacy.id }
    })).filter(item => item.url) : [];
    record.type = allowedTypes.includes(text(metadata.record_type)) ? text(metadata.record_type) : record.type;
    record.source = allowedSources.includes(text(metadata.source)) ? text(metadata.source) : record.source;
    record.status = ['PUBLISHED', 'PENDING_REVIEW'].includes(text(metadata.status)) ? text(metadata.status) : record.status;
    record.tags = Array.isArray(metadata.tags) ? metadata.tags.map(text).filter(Boolean) : [];
    record.featured = metadata.featured === true;
    record.evidence.push(...evidence);
    record.metadataId = text(metadata.id);
    return record;
  }

  function adaptLegacyProfile(profile) {
    const data = profile || {};
    const childId = data.child && data.child.id;
    const metadataIndex = buildMetadataIndex(data, childId);
    const records = [];

    (data.timeline || []).forEach((item, index) => records.push(recordBase('growth_timeline', item, index, childId, {
      type: TYPES.MILESTONE,
      date: item.event_date,
      title: item.title || item.description || '成长里程碑',
      detail: item.description
    })));

    (data.courses || []).forEach((item, index) => records.push(recordBase('course_records', item, index, childId, {
      type: TYPES.LEARNING,
      date: item.date,
      title: item.course_name || '学习经历',
      detail: item.performance,
      teacherObservation: item.performance
    })));

    (data.comments || []).forEach((item, index) => {
      const record = recordBase('teacher_comments', item, index, childId, {
        type: TYPES.TEACHER_OBSERVATION,
        date: item.date,
        title: item.semester ? `${item.semester}教师观察` : '教师观察',
        detail: item.comment,
        teacherObservation: item.comment
      });
      const audio = evidenceFromUrl(item.audio_url, {
        kind: 'audio', title: record.title, date: record.date,
        legacy: { table: 'teacher_comments', id: text(item.id) }
      });
      if (audio) record.evidence.push(audio);
      records.push(record);
    });

    (data.activities || []).forEach((item, index) => records.push(recordBase('activity_records', item, index, childId, {
      type: inferActivityType(item),
      date: item.date,
      title: item.activity_name || '活动经历',
      detail: item.description
    })));

    (data.achievements || []).forEach((item, index) => records.push(recordBase('achievements', item, index, childId, {
      type: TYPES.ACHIEVEMENT,
      date: item.date,
      title: item.title || '成长荣誉',
      detail: item.description
    })));

    records.forEach(record => enrichRecord(record, metadataIndex));
    records.sort((a, b) => {
      const dateOrder = text(b.date).localeCompare(text(a.date));
      if (dateOrder) return dateOrder;
      return text(b.createdAt).localeCompare(text(a.createdAt));
    });

    const unlinkedEvidence = (data.photos || []).map((item, index) => evidenceFromUrl(item.photo_url, {
      kind: 'image',
      title: item.caption,
      date: item.taken_date,
      source: item.source === 'parent' ? SOURCE.PARENT_PROVIDED : SOURCE.INSTITUTION_RECORD,
      legacy: { table: 'photo_records', id: text(item.id) || String(index) }
    })).filter(Boolean);

    const byType = {};
    Object.keys(TYPES).forEach(key => { byType[TYPES[key]] = []; });
    records.forEach(record => { byType[record.type].push(record); });

    return {
      records,
      byType,
      unlinkedEvidence,
      counts: {
        records: records.length,
        projects: byType[TYPES.PROJECT].length + byType[TYPES.WORK].length + byType[TYPES.ACTIVITY].length,
        learning: byType[TYPES.LEARNING].length + byType[TYPES.SKILL].length,
        achievements: byType[TYPES.ACHIEVEMENT].length,
        evidence: unlinkedEvidence.length + records.reduce((sum, record) => sum + record.evidence.length, 0)
      },
      mediaGovernance: MEDIA_GOVERNANCE,
      metadataApplied: records.filter(record => record.metadataId).length
    };
  }

  return Object.freeze({
    TYPES,
    SOURCE,
    MEDIA_GOVERNANCE,
    inferActivityType,
    buildMetadataIndex,
    adaptLegacyProfile
  });
});
