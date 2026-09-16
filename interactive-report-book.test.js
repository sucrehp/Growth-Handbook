'use strict';

const assert = require('assert');
const fs = require('fs');

const child = fs.readFileSync('child.html', 'utf8');

assert.match(child, /class="report-book" id="report-book"/);
assert.match(child, /class="report-book-inside" aria-hidden="true" inert/);
assert.match(child, /class="report-cover-face report-cover-front"/);
assert.match(child, /class="report-cover-face report-cover-back" aria-hidden="true" inert/);
assert.match(child, /\.report-book\.is-open \.report-cover \{ transform:rotateY\(-172deg\)/);
assert.match(child, /@media\(max-width:900px\)[\s\S]*rotateY\(-179\.5deg\)/);
assert.match(child, /@media \(prefers-reduced-motion:reduce\)/);

assert.match(child, /function toggleReportBook\(force\)/);
assert.match(child, /function buildInteractiveBookPages\(context\)/);
assert.match(child, /function renderReportBookSpread\(direction\)/);
assert.match(child, /function turnReportBookPage\(direction\)/);
assert.match(child, /function startReportBookSwipe\(event\)/);
assert.match(child, /function endReportBookSwipe\(event\)/);
assert.match(child, /book\.classList\.toggle\('is-open', open\)/);
assert.match(child, /element\.inert = hidden/);
assert.match(child, /setAttribute\('aria-expanded', String\(open\)\)/);

for (const section of ['我的成长关键词', '成长轨迹', '作品与成长故事', '技能与兴趣', '荣誉与高光', '老师眼中的闪光']) {
  assert(child.includes(section), `${section} book page missing`);
}
assert.match(child, /record\.status === 'PUBLISHED'/);
assert.match(child, /chunkReportBookItems\(timeline, 3\)/);
assert.match(child, /chunkReportBookItems\(projects, 2\)/);
assert.match(child, /chunkReportBookItems\(achievements, 3\)/);
assert.match(child, /reportBookMobileMode\(\) \? 1 : 2|mobile \? 1 : 2/);
assert.match(child, /id="report-book-indicator"/);
assert.match(child, /event\.key === 'ArrowLeft'/);
assert.match(child, /event\.key === 'ArrowRight'/);
assert.match(child, /Math\.abs\(distance\) < 44/);
assert.equal((child.match(/onclick="downloadPPT\(\)"/g) || []).length, 1, 'PPT export must only remain in the page export actions');
assert.equal((child.match(/onclick="downloadPDF\(\)"/g) || []).length, 1, 'PDF export must only remain in the page export actions');
assert.doesNotMatch(child, /report-inside-actions|class="report-actions"/);
assert.match(child, /\.fab \{ position:static; width:min\(520px,calc\(100% - 32px\)\)/, 'mobile export actions must join document flow');
assert.equal((child.match(/class="nav-item" onclick="scrollTo2/g) || []).length, 6, 'top navigation must not grow');

console.log('R4.4 MULTI-PAGE INTERACTIVE BOOK PASS');
console.log('Dynamic content pages, desktop spreads, mobile single pages, controls, swipe and reduced motion verified');
