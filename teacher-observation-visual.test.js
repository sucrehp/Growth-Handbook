'use strict';

const assert = require('assert');
const fs = require('fs');
const Composer = require('./growth-report-composer');
const Ppt = require('./growth-report-ppt');

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

const quotes = [
  '能够主动观察材料特征，尝试不同连接方式，并清楚表达自己的设计思路。',
  '愿意使用完整句子进行角色表达，语言自然，参与感很强。',
  '果果对新鲜事物始终保持好奇。比答案更珍贵的，是她已经开始相信自己的观察与判断。'
];
const profile = {
  child:{ id:'child-visual', name:'果果' }, timeline:[], activities:[], achievements:[], photos:[], messages:[],
  courses:[
    { id:'course-1', course_name:'森林建造师 PBL', teacher_name:'森林搭建老师', date:'2026-07-18', performance:quotes[0] },
    { id:'course-2', course_name:'故事英语剧场', teacher_name:'英语老师', date:'2026-07-11', performance:quotes[1] }
  ],
  comments:[{ id:'comment-1', date:'', semester:'2026夏季', teacher_name:'白雪老师', comment:quotes[2] }]
};

async function run() {
  assert.equal(Ppt.OBSERVATION_ART.length, 2);
  Ppt.OBSERVATION_ART.forEach(asset => {
    assert(asset.startsWith('report-assets/'));
    assert(fs.existsSync(asset), `missing illustration ${asset}`);
  });
  quotes.forEach(quote => assert.equal(Ppt.observationSegments(quote).join(''), quote));
  const lengthy = '孩子在课堂中保持好奇，'.repeat(9) + '愿意表达自己的观察。';
  assert.equal(Ppt.observationSegments(lengthy).join(''), lengthy);

  for (const themeId of ['sky','cosmic','forest','sunshine','blossom','dream']) {
    const model = Composer.buildReportModel(profile, { themeId });
    const observationPages = model.pages.filter(page => page.type === 'teacher-observation');
    assert.deepEqual(observationPages.map(page => page.items.length), [2, 1]);
    const resolved = [];
    const output = await Ppt.composePpt(MockPptxGenJS, model, { resolveAsset:async url => {
      resolved.push(url);
      return { data:'data:image/png;base64,ILLUSTRATION', width:1024, height:1536 };
    } });
    assert.equal(output.slideCount, model.pages.length);
    assert.equal(output.failedAssets, 0);
    assert(Ppt.OBSERVATION_ART.every(url => resolved.includes(url)));
    const slides = observationPages.map(page => output.pptx.slides[model.pages.indexOf(page)]);
    slides.forEach(slide => {
      const illustration = slide.items.find(item => item.kind === 'image');
      assert(illustration, 'observation page needs an illustration');
      assert.equal(illustration.options.sizing.type, 'contain');
      assert(Math.abs(illustration.options.w / illustration.options.h - 1024 / 1536) < 1e-6,
        'illustration must preserve image ratio');
      assert(!slide.items.some(item => item.kind === 'shape' && item.type === 'roundRect'),
        'teacher quotes should not become repeated UI cards');
    });
    assert(slides[0].items.some(item => item.kind === 'text' && item.value === Ppt.observationSegments(quotes[0])[0]));
    assert(slides[0].items.some(item => item.kind === 'text' && item.value === Ppt.observationSegments(quotes[1])[0]));
    assert(slides[1].items.some(item => item.kind === 'text' && item.value === Ppt.observationSegments(quotes[2])[0]));
    assert(slides[1].items.some(item => item.kind === 'text' && item.value === Ppt.observationSegments(quotes[2])[1]));
    assert(!slides[1].items.some(item => item.kind === 'text' && / · $/.test(item.value)),
      'missing dates must not leave a dangling separator');
  }
  const longModel = Composer.buildReportModel({ ...profile, comments:profile.comments.map(item => ({ ...item, comment:lengthy })) });
  const longPage = longModel.pages.find(page => page.type === 'teacher-observation' && page.items.length === 1);
  const longResult = await Ppt.composePpt(MockPptxGenJS, longModel);
  const longSlide = longResult.pptx.slides[longModel.pages.indexOf(longPage)];
  assert(longSlide.items.some(item => item.kind === 'text' && item.value === lengthy
    && item.options.fontSize >= 17 && item.options.h >= 2));
  console.log('TEACHER OBSERVATION PPT VISUAL PASS: 2 layouts x 6 themes');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
