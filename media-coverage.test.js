const assert = require('node:assert/strict');
const fs = require('node:fs');

const Adapter = require('./growth-record-adapter.js');
global.GrowthRecordAdapter = Adapter;
const Composer = require('./growth-report-composer.js');

function profileWithEvidence(count) {
  const evidence = Array.from({ length:Math.max(0, count - 1) }, (_, index) => ({
    evidence_type:index === 1 ? 'certificate' : 'image',
    existing_media_reference:`https://example.com/evidence-${index + 2}.jpg`,
    title:`成长素材 ${index + 2}`
  }));
  return {
    child:{ id:'child-1', name:'果果' },
    timeline:[], courses:[], comments:[], achievements:[], photos:[], messages:[],
    activities:[{
      id:'activity-1', child_id:'child-1', activity_name:'四季观察项目',
      date:'2026-09-01', description:'用连续影像记录观察过程。',
      photo_url:'https://example.com/evidence-1.jpg'
    }],
    metadata:[{
      child_id:'child-1', source_table:'activity_records', source_record_id:'activity-1',
      record_type:'PROJECT', status:'PUBLISHED', evidence
    }]
  };
}

for (const count of [1, 2, 4, 5, 9]) {
  const report = Composer.buildReportModel(profileWithEvidence(count));
  const galleryPages = report.pages.filter(page => page.type === 'gallery');
  assert.equal(report.evidence.length, count, `${count} images must all reach the report model`);
  assert.equal(galleryPages.flatMap(page => page.items).length, count, `${count} images must all reach export pages`);
  assert.deepEqual(galleryPages.map(page => page.items.length),
    Array.from({ length:Math.ceil(count / 4) }, (_, index) => Math.min(4, count - index * 4)));
}

const many = Composer.buildReportModel({
  child:{ id:'child-1', name:'果果' }, timeline:[], courses:[], comments:[], achievements:[],
  activities:[], metadata:[], messages:[],
  photos:Array.from({ length:30 }, (_, index) => ({
    id:`photo-${index}`, child_id:'child-1', photo_url:`https://example.com/photo-${index}.jpg`
  }))
});
assert.equal(many.evidence.length, 30, 'evidence selection must not silently cap at 24');
assert.equal(many.pages.filter(page => page.type === 'gallery').length, 8);

const duplicate = Composer.selectEvidence([], [
  { kind:'image', url:'https://example.com/same.jpg' },
  { kind:'image', url:'https://example.com/same.jpg' },
  { kind:'image', url:'https://example.com/unique.jpg' }
]);
assert.deepEqual(duplicate.map(item => item.url), [
  'https://example.com/same.jpg',
  'https://example.com/unique.jpg'
], 'only exact duplicate URLs may be removed');

const childHtml = fs.readFileSync('child.html', 'utf8');
assert.match(childHtml, /const portfolioEvidence = GrowthReportComposer\.selectEvidence\(publishedRecords, portfolio\.unlinkedEvidence/);
assert.match(childHtml, /renderProjectGallery\(portfolioEvidence\)/);
assert.doesNotMatch(childHtml, /renderProjectGallery\(profile\.photos\)/);

console.log('R4.1 MEDIA COVERAGE PASS');
