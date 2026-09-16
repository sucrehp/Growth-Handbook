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
assert.match(child, /book\.classList\.toggle\('is-open', open\)/);
assert.match(child, /element\.inert = hidden/);
assert.match(child, /setAttribute\('aria-expanded', String\(open\)\)/);

for (const section of ['成长轨迹', '作品项目', '技能积累', '兴趣画像', '荣誉高光']) {
  assert(child.includes(`label:'${section}'`), `${section} summary missing`);
}
assert.match(child, /record\.status === 'PUBLISHED'/);
assert.match(child, /profile\.comments\?\.\[0\]\?\.comment/);
assert.equal((child.match(/onclick="downloadPPT\(\)"/g) || []).length, 1, 'PPT export must only remain in the page export actions');
assert.equal((child.match(/onclick="downloadPDF\(\)"/g) || []).length, 1, 'PDF export must only remain in the page export actions');
assert.doesNotMatch(child, /report-inside-actions|class="report-actions"/);
assert.match(child, /\.fab \{ position:static; width:min\(520px,calc\(100% - 32px\)\)/, 'mobile export actions must join document flow');
assert.equal((child.match(/class="nav-item" onclick="scrollTo2/g) || []).length, 6, 'top navigation must not grow');

console.log('V1.1-P1-R3 INTERACTIVE PORTFOLIO BOOK PASS');
console.log('3D cover, evidence-backed section highlights, responsive fallback, reduced motion and export actions verified');
