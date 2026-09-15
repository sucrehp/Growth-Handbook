'use strict';

const assert = require('assert');
const fs = require('fs');
const Composer = require('./growth-report-composer');
const Ppt = require('./growth-report-ppt');
const Print = require('./growth-report-print');

class MockSlide {
  constructor() { this.items = []; }
  addShape(type, options) { this.items.push({ kind:'shape', type, options }); }
  addText(value, options) { this.items.push({ kind:'text', value, options }); }
  addImage(options) { this.items.push({ kind:'image', options }); }
  addNotes() {}
}
class MockPptxGenJS {
  constructor() { this.slides = []; this.ShapeType = { rect:'rect', ellipse:'ellipse', roundRect:'roundRect' }; }
  addSlide() { const slide = new MockSlide(); this.slides.push(slide); return slide; }
}

function profile(activities, metadata) {
  return { child:{ id:'child-1', name:'果果' }, timeline:[], courses:[], comments:[],
    activities, achievements:[], photos:[], metadata:metadata || [], messages:[] };
}

async function run() {
  const evidence = { kind:'image', url:'data:image/png;base64,STORY_IMAGE', title:'项目照片' };
  const source = { title:'自然观察项目', date:'2026-07-20', detail:'观察树叶并制作色彩地图。',
    teacherObservation:'老师记录了孩子主动介绍作品的过程。', tags:['自然观察','表达'],
    source:'INSTITUTION_RECORD', evidence:[evidence] };
  const story = Composer.growthStoryView(source);
  assert(story);
  assert.equal(story.title, source.title);
  assert.equal(story.detail, source.detail);
  assert.equal(story.teacherObservation, source.teacherObservation);
  assert.deepEqual(story.tags, source.tags);
  assert.deepEqual(story.evidence, [evidence]);
  assert.equal(Object.hasOwn(story, 'challenge'), false, 'missing context must not be fabricated');
  assert.equal(Composer.growthStoryView({ ...source, evidence:[] }), null);
  assert.equal(Composer.growthStoryView({ ...source, detail:'', teacherObservation:'' }), null);
  assert.equal(Composer.growthStoryView({ ...source, teacherObservation:source.detail }).teacherObservation, '');
  assert.equal(Composer.growthStoryView({ ...source, evidence:[{kind:'video_link', url:'https://example.com/video'}] }), null);
  assert.equal(Composer.growthStoryView({ ...source, source:'PARENT_PROVIDED' }).source, 'PARENT_PROVIDED');

  const rich = Composer.buildReportModel(profile([{
    id:'activity-rich', child_id:'child-1', activity_name:'自然观察项目', date:'2026-07-20',
    description:'观察树叶并制作色彩地图。', photo_url:evidence.url
  }], [{ id:'metadata-rich', child_id:'child-1', source_table:'activity_records', source_record_id:'activity-rich',
    record_type:'PROJECT', source:'INSTITUTION_RECORD', status:'PUBLISHED', tags:['自然观察','表达'] }]));
  rich.projectsWorks[0].teacherObservation = source.teacherObservation;
  const projectPage = rich.pages.find(page => page.type === 'project');
  assert(projectPage);
  const html = Print.renderReportHtml(rich);
  assert.match(html, /gpr-growth-story/);
  assert.match(html, /gpr-story-featured/);
  assert.match(html, /老师观察：老师记录了孩子主动介绍作品的过程/);
  assert.match(html, /自然观察/);
  const ppt = await Ppt.composePpt(MockPptxGenJS, rich, {
    resolveAsset:async url => ({ data:url, width:1600, height:900 })
  });
  const projectSlide = ppt.pptx.slides[rich.pages.indexOf(projectPage)];
  assert(projectSlide.items.some(item => item.kind === 'text' && item.value === 'GROWTH STORY'));
  assert(projectSlide.items.some(item => item.kind === 'text' && item.value.includes('老师观察：')));
  assert(projectSlide.items.some(item => item.kind === 'image' && item.options.sizing.type === 'cover'));
  assert(projectSlide.items.some(item => item.kind === 'image' && item.options.sizing.w > 7 && item.options.sizing.h > 4));

  const sparse = Composer.buildReportModel(profile([{
    id:'activity-sparse', child_id:'child-1', activity_name:'普通活动', date:'2026-07-21', description:'参加活动。'
  }]));
  assert.equal(Composer.growthStoryView(sparse.projectsWorks[0]), null);
  assert.doesNotMatch(Print.renderReportHtml(sparse), /class="gpr-growth-story"/);
  const sparsePpt = await Ppt.composePpt(MockPptxGenJS, sparse);
  const sparsePage = sparse.pages.find(page => page.type === 'project');
  assert(!sparsePpt.pptx.slides[sparse.pages.indexOf(sparsePage)].items
    .some(item => item.kind === 'text' && item.value === 'GROWTH STORY'));

  const pending = Composer.buildReportModel(profile([{
    id:'activity-pending', child_id:'child-1', activity_name:'待审核项目', photo_url:evidence.url,
    description:'待审核内容。'
  }], [{ child_id:'child-1', source_table:'activity_records', source_record_id:'activity-pending', status:'PENDING_REVIEW' }]));
  assert.equal(pending.projectsWorks.length, 0);

  const childHtml = fs.readFileSync('child.html', 'utf8');
  assert.match(childHtml, /作品与成长故事/);
  assert.match(childHtml, /renderPortfolioProjects\(portfolio\.records\)/);
  assert.match(childHtml, /GrowthReportComposer\.growthStoryView\(record/);
  assert.match(childHtml, /record\.status === 'PUBLISHED'/);
  assert.match(childHtml, /record\.source !== 'PARENT_PROVIDED'/);
  assert.match(childHtml, /family-record family-growth-story/);
  assert.equal((childHtml.match(/class="nav-item" onclick="scrollTo2/g) || []).length, 6,
    'main navigation must not grow');
  assert.match(fs.readFileSync('growth-report-print.css', 'utf8'), /\.gpr-growth-story \.gpr-project-image/);
  console.log('P1.2 GROWTH STORY PRESENTATION PASS');
  console.log('rich record: WEB/PPT/PDF story; sparse record: ordinary card; pending: omitted');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
