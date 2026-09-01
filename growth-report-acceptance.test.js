'use strict';

const assert = require('assert');
const Composer = require('./growth-report-composer');
const Ppt = require('./growth-report-ppt');
const Print = require('./growth-report-print');

class MockSlide {
  constructor() { this.items = []; }
  addShape(type, options) { this.items.push({ kind:'shape', type, options }); }
  addText(value, options) { this.items.push({ kind:'text', value, options }); }
  addImage(options) { this.items.push({ kind:'image', options }); }
  addNotes(value) { this.notes = value; }
}

class MockPptxGenJS {
  constructor() {
    this.slides = [];
    this.ShapeType = { rect:'rect', ellipse:'ellipse', roundRect:'roundRect' };
  }
  addSlide() {
    const slide = new MockSlide();
    this.slides.push(slide);
    return slide;
  }
}

function art(index) {
  return `data:image/png;base64,TEST_IMAGE_${index}`;
}

function profile(overrides) {
  return {
    child:{ id:'child-1', name:'果果', birthday:'2020-05-18', class_name:'星星探索班' },
    timeline:[], courses:[], activities:[], comments:[], achievements:[], photos:[], metadata:[], messages:[],
    ...(overrides || {})
  };
}

function timeline(count) {
  return Array.from({ length:count }, (_, index) => ({
    id:`timeline-${index}`,
    child_id:'child-1',
    event_date:`2026-${String((index % 9) + 1).padStart(2, '0')}-01`,
    title:`成长节点 ${index + 1}`,
    description:'完成一次真实的观察、表达与合作。'
  }));
}

function photos(count) {
  return Array.from({ length:count }, (_, index) => ({
    id:`photo-${index}`,
    child_id:'child-1',
    photo_url:art(index),
    caption:`成长作品 ${index + 1}`
  }));
}

function model(data, themeId) {
  return Composer.buildReportModel(data, {
    themeId:themeId || 'sky',
    now:'2026-09-01',
    generatedAt:'2026-09-01T00:00:00.000Z'
  });
}

function assertCore(report) {
  const types = report.pages.map(page => page.type);
  assert.equal(types[0], 'cover');
  assert.equal(types[1], 'profile');
  assert.equal(types.at(-2), 'summary');
  assert.equal(types.at(-1), 'closing');
  assert.equal(report.pages.filter(page => ['timeline','project','gallery','achievement','teacher-observation'].includes(page.type) && !page.items.length).length, 0);
  const html = Print.renderReportHtml(report);
  assert.equal((html.match(/class="gpr-print-page/g) || []).length, report.pages.length);
  assert(!/onclick|<button|class="fab|class="nav/.test(html));
}

async function assertPpt(report) {
  const result = await Ppt.composePpt(MockPptxGenJS, report);
  assert.equal(result.slideCount, report.pages.length);
  assert.equal(result.pptx.slides.length, report.pages.length);
  assert(result.pptx.slides.every(slide => slide.items.length > 0));
  return result;
}

async function run() {
  const results = [];

  // A. Sparse record: no empty business section pages.
  const sparse = model(profile());
  assert.deepEqual(sparse.pages.map(page => page.type), ['cover','profile','interest','summary','closing']);
  assertCore(sparse);
  results.push(['A', 'sparse', sparse.pages.length]);

  // B. Rich record: dynamic sections and pagination remain bounded.
  const rich = model(profile({
    timeline:timeline(14),
    courses:Array.from({ length:7 }, (_, index) => ({ id:`course-${index}`, date:'2026-06-01', course_name:`成长技能 ${index + 1}`, performance:'持续积累。' })),
    activities:Array.from({ length:5 }, (_, index) => ({ id:`activity-${index}`, date:'2026-07-01', activity_name:`项目：主题探索 ${index + 1}`, description:'完整项目经历。' })),
    comments:Array.from({ length:5 }, (_, index) => ({ id:`comment-${index}`, date:'2026-08-01', comment:`教师观察 ${index + 1}` })),
    achievements:Array.from({ length:6 }, (_, index) => ({ id:`achievement-${index}`, date:'2026-08-20', title:`成长荣誉 ${index + 1}` })),
    photos:photos(14)
  }), 'cosmic');
  assert(rich.pages.length > 15);
  assert(rich.pages.filter(page => page.type === 'gallery').length === 4);
  assertCore(rich);
  results.push(['B', 'rich', rich.pages.length]);

  // C. No photo: gallery is omitted, export still has cover/profile.
  const noPhoto = model(profile({ timeline:timeline(2) }));
  assert(!noPhoto.pages.some(page => page.type === 'gallery'));
  assertCore(noPhoto);
  results.push(['C', 'no-photo', noPhoto.pages.length]);

  // D. One photo: single-image composition is selected.
  const onePhoto = model(profile({ photos:photos(1) }));
  assert.equal(onePhoto.pages.filter(page => page.type === 'gallery').length, 1);
  assert.equal(Ppt.galleryFrames(1).length, 1);
  assertCore(onePhoto);
  results.push(['D', 'one-photo', onePhoto.pages.length]);

  // E. Many photos: evidence is curated to 24 and paginated four per page.
  const manyPhotos = model(profile({ photos:photos(30) }));
  assert.equal(manyPhotos.evidence.length, 24);
  assert.equal(manyPhotos.pages.filter(page => page.type === 'gallery').length, 6);
  assertCore(manyPhotos);
  results.push(['E', 'many-photos', manyPhotos.pages.length]);

  // F. No honors: no achievement-only page is produced.
  const noHonors = model(profile({ courses:[{ id:'course-1', date:'2026-05-01', course_name:'创意表达' }] }));
  assert(!noHonors.pages.some(page => ['achievement','skills-achievements'].includes(page.type)));
  assert(noHonors.pages.some(page => page.type === 'skills'));
  assertCore(noHonors);
  results.push(['F', 'no-honors', noHonors.pages.length]);

  // G. Multiple projects: two project records per page.
  const multiProject = model(profile({ activities:Array.from({ length:5 }, (_, index) => ({ id:`project-${index}`, date:'2026-06-01', activity_name:`项目：作品 ${index + 1}` })) }));
  assert.equal(multiProject.pages.filter(page => page.type === 'project').length, 3);
  assertCore(multiProject);
  results.push(['G', 'multiple-projects', multiProject.pages.length]);

  // H. Long timeline: five records per page with no loss.
  const longTimeline = model(profile({ timeline:timeline(23) }));
  assert.equal(longTimeline.pages.filter(page => page.type === 'timeline').length, 5);
  assert.equal(longTimeline.pages.filter(page => page.type === 'timeline').flatMap(page => page.items).length, 23);
  assertCore(longTimeline);
  results.push(['H', 'long-timeline', longTimeline.pages.length]);

  // I. Long Chinese name: model preserves the full name and export stays valid.
  const longName = model(profile({ child:{ id:'child-1', name:'一位名字非常非常长的测试小朋友', birthday:'2018-09-01' } }), 'blossom');
  assert.equal(longName.child.name, '一位名字非常非常长的测试小朋友');
  assert(Print.renderReportHtml(longName).includes(longName.child.name));
  assertCore(longName);
  results.push(['I', 'long-name', longName.pages.length]);

  // J. Approved parent contribution is included; pending contribution is excluded.
  const parentRecords = profile({
    timeline:[
      { id:'parent-approved', child_id:'child-1', event_date:'2026-07-01', title:'家庭自然观察' },
      { id:'parent-pending', child_id:'child-1', event_date:'2026-07-02', title:'待审核记录' }
    ],
    metadata:[
      { child_id:'child-1', source_table:'growth_timeline', source_record_id:'parent-approved', source:'PARENT_PROVIDED', status:'PUBLISHED', record_type:'PROJECT', featured:true },
      { child_id:'child-1', source_table:'growth_timeline', source_record_id:'parent-pending', source:'PARENT_PROVIDED', status:'PENDING_REVIEW', record_type:'PROJECT' }
    ]
  });
  const parentModel = model(parentRecords);
  assert.equal(parentModel.metadata.approvedParentRecords, 1);
  assert.equal(parentModel.metadata.omittedPendingRecords, 1);
  assert(parentModel.projectsWorks.some(record => record.title === '家庭自然观察'));
  assert(!parentModel.timeline.some(record => record.title === '待审核记录'));
  assertCore(parentModel);
  results.push(['J', 'approved-parent', parentModel.pages.length]);

  // K. Six themes resolve; sky/cosmic/blossom are composed through the real code path.
  for (const themeId of Object.keys(Composer.THEMES)) {
    const themed = model(profile({ timeline:timeline(2), photos:photos(2) }), themeId);
    assert.equal(themed.theme.id, themeId);
    assert(themed.theme.eyebrow && themed.theme.motif && themed.theme.motifSecondary);
    assertCore(themed);
    if (['sky','cosmic','blossom'].includes(themeId)) await assertPpt(themed);
  }
  results.push(['K', 'six-themes', Object.keys(Composer.THEMES).length]);

  // Sparse skills and honors share one page instead of creating two low-density pages.
  const combined = model(profile({
    courses:[{ id:'course-1', date:'2026-05-01', course_name:'创意表达' }],
    achievements:[{ id:'achievement-1', date:'2026-06-01', title:'表达之星' }]
  }));
  assert.equal(combined.pages.filter(page => page.type === 'skills-achievements').length, 1);
  assert(!combined.pages.some(page => page.type === 'skills' || page.type === 'achievement'));
  await assertPpt(combined);
  assertCore(combined);

  console.log('GP-L4.5 ACCEPTANCE PASS');
  results.forEach(result => console.log(result.join(' | ')));
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
