'use strict';

const assert = require('assert');
const fs = require('fs');
const Composer = require('./growth-report-composer');
const Ppt = require('./growth-report-ppt');

class MockSlide {
  constructor() { this.items = []; }
  addShape(type, options) { this.items.push({ type:'shape', options }); }
  addText(value, options) { this.items.push({ type:'text', value, options }); }
  addImage(options) { this.items.push({ type:'image', options }); }
  addNotes() {}
}

class MockPptxGenJS {
  constructor() { this.slides = []; this.ShapeType = { rect:'rect', ellipse:'ellipse', roundRect:'roundRect' }; }
  addSlide() { const slide = new MockSlide(); this.slides.push(slide); return slide; }
}

function reportWithGallery(images) {
  const model = Composer.buildReportModel({ child:{ id:'test-child', name:'测试孩子' },
    timeline:[], courses:[], activities:[], comments:[], achievements:[], photos:[], metadata:[], messages:[] });
  model.evidence = images.map((image, index) => ({
    id:`evidence-${index}`, recordId:'', url:`data:image/png;base64,ASPECT_${index}`,
    kind:image.kind, title:image.label, date:'2026-09-15'
  }));
  model.pages = [{ type:'gallery', items:model.evidence, pageNumber:1, index:1, total:1 }];
  return model;
}

async function verifyGallery(label, images) {
  const model = reportWithGallery(images);
  const assets = new Map(model.evidence.map((evidence, index) => [evidence.url, images[index]]));
  const result = await Ppt.composePpt(MockPptxGenJS, model, {
    resolveAsset: async url => ({ data:url, width:assets.get(url).width, height:assets.get(url).height })
  });
  const placed = result.pptx.slides[0].items.filter(item => item.type === 'image');
  assert.equal(result.failedAssets, 0, `${label}: failed assets`);
  assert.equal(placed.length, images.length, `${label}: image count`);
  const frames = Ppt.galleryFrames(images.length);
  placed.forEach((item, index) => {
    const options = item.options;
    const originalRatio = images[index].width / images[index].height;
    const assignedRatio = options.w / options.h;
    assert(Math.abs(originalRatio - assignedRatio) < 1e-9, `${label}: source ratio ${index}`);
    assert.equal(options.sizing.type, ['certificate','document'].includes(images[index].kind) ? 'contain' : 'cover');
    assert.equal(options.sizing.w, frames[index].w);
    assert.equal(options.sizing.h, frames[index].h);
    assert.equal(options.x, frames[index].x);
    assert.equal(options.y, frames[index].y);
  });
}

function verifyGalleryPagination() {
  const images = Array.from({ length:9 }, (_, index) => ({
    label:`gallery item ${index + 1}`,
    kind:index === 4 ? 'certificate' : 'photo',
    width:index % 2 ? 1600 : 900,
    height:index % 2 ? 900 : 1600
  }));
  const model = reportWithGallery(images);
  model.pages = Composer.buildPagePlan(model);
  const galleryPages = model.pages.filter(page => page.type === 'gallery');
  assert.deepEqual(galleryPages.map(page => page.items.length), [4, 4, 1], 'gallery pagination size');
  assert.deepEqual(galleryPages.map(page => page.index), [1, 2, 3], 'gallery pagination index');
  assert(galleryPages.every(page => page.total === 3), 'gallery pagination total');
  assert.equal(galleryPages.flatMap(page => page.items).length, images.length, 'gallery pagination loss');
}

async function run() {
  await verifyGallery('portrait', [{ label:'portrait photo', kind:'photo', width:900, height:1600 }]);
  await verifyGallery('landscape', [{ label:'landscape photo', kind:'photo', width:1600, height:900 }]);
  await verifyGallery('square', [{ label:'square photo', kind:'photo', width:1200, height:1200 }]);
  await verifyGallery('screenshot', [{ label:'screenshot', kind:'document', width:1440, height:2560 }]);
  await verifyGallery('certificate', [{ label:'certificate', kind:'certificate', width:2100, height:2970 }]);
  await verifyGallery('extreme-wide', [{ label:'panorama photo', kind:'photo', width:6400, height:640 }]);
  await verifyGallery('extreme-tall', [{ label:'long screenshot', kind:'document', width:640, height:6400 }]);
  await verifyGallery('1-image-layout', [{ label:'single photo', kind:'photo', width:1365, height:2048 }]);
  await verifyGallery('2-image', [
    { label:'portrait', kind:'photo', width:900, height:1600 },
    { label:'certificate', kind:'certificate', width:2100, height:2970 }
  ]);
  verifyGalleryPagination();
  await verifyGallery('3-image', [
    { label:'landscape', kind:'photo', width:1600, height:900 },
    { label:'square', kind:'photo', width:1200, height:1200 },
    { label:'document', kind:'document', width:1440, height:2560 }
  ]);
  await verifyGallery('4-image', [
    { label:'portrait', kind:'photo', width:900, height:1600 },
    { label:'landscape', kind:'photo', width:1600, height:900 },
    { label:'square', kind:'photo', width:1200, height:1200 },
    { label:'certificate', kind:'certificate', width:2100, height:2970 }
  ]);

  const childHtml = fs.readFileSync('child.html', 'utf8');
  assert.match(childHtml, /sourceWidth = image\.naturalWidth/);
  assert.match(childHtml, /sourceHeight = image\.naturalHeight/);
  assert.match(childHtml, /return \{ data, width:sourceWidth, height:sourceHeight \}/);
  assert.match(fs.readFileSync('growth-report-ppt.js', 'utf8'), /ASSET_DIMENSIONS_UNAVAILABLE/);
  console.log('P1.1 PPT IMAGE ASPECT RATIO PASS: 12 requirements');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
