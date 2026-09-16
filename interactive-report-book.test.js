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
assert.match(child, /function animateReportBookTurn\(direction, targetIndex\)/);
assert.match(child, /leaf\.className = `report-page-leaf /);
assert.match(child, /leaf\.classList\.add\('is-turning'\)/);
assert.match(child, /function startReportBookSwipe\(event\)/);
assert.match(child, /function endReportBookSwipe\(event\)/);
assert.match(child, /book\.classList\.toggle\('is-open', open\)/);
assert.match(child, /element\.inert = hidden/);
assert.match(child, /setAttribute\('aria-expanded', String\(open\)\)/);

for (const section of ['ABOUT ME · 基本信息', '你好，我是', '我的成长关键词', '成长轨迹', '作品与成长故事', '技能与兴趣', '荣誉与高光', '老师眼中的闪光']) {
  assert(child.includes(section), `${section} book page missing`);
}
assert.match(child, /child\.enrollment_date \? `\$\{formatDate\(child\.enrollment_date\)\}加入机构`/);
assert.match(child, /profileIntro:getProfileIntro\(c, growthStage, profile\)/);
assert.match(child, /const teacherObservations = getTeacherObservationItems\(publishedRecords\)/);
assert.match(child, /teacherObservations,/);
assert.match(child, /function renderTeacherObservationShowcase\(items\)/);
assert.match(child, /class="teacher-observation-art"/);
assert.match(child, /class="report-page-observation-art"/);
assert.match(child, /report-assets\/teacher-observation-explore\.png/);
assert.match(child, /report-assets\/teacher-observation-curiosity\.png/);
assert.match(child, /record\.status === 'PUBLISHED'/);
assert.match(child, /chunkReportBookItems\(timeline, 3\)/);
assert.match(child, /chunkReportBookItems\(projects, 2\)/);
assert.match(child, /chunkReportBookItems\(achievements, 3\)/);
assert.match(child, /reportBookMobileMode\(\) \? 1 : 2|mobile \? 1 : 2/);
assert.match(child, /id="report-book-indicator"/);
assert.match(child, /event\.key === 'ArrowLeft'/);
assert.match(child, /event\.key === 'ArrowRight'/);
assert.match(child, /Math\.abs\(distance\) < 44/);
assert.match(child, /class="report-book-return" aria-label="返回成长册封面"/);
assert.match(child, /\.report-book-return::before \{ content:"↙"/);
assert.match(child, /class="report-page-corner-next" id="report-book-next" aria-label="翻到下一页"/);
assert.match(child, /\.report-page-corner-next::after \{ content:"›"/);
assert.doesNotMatch(child, /report-inside-close|← 合上成长册/);
assert.equal((child.match(/onclick="downloadPPT\(\)"/g) || []).length, 1, 'PPT export must only remain in the page export actions');
assert.equal((child.match(/onclick="downloadPDF\(\)"/g) || []).length, 1, 'PDF export must only remain in the page export actions');
assert.doesNotMatch(child, /report-inside-actions|class="report-actions"/);
assert.match(child, /\.fab \{ position:static; width:min\(520px,calc\(100% - 32px\)\)/, 'mobile export actions must join document flow');
assert.equal((child.match(/class="nav-item" onclick="scrollTo2/g) || []).length, 6, 'top navigation must not grow');

console.log('R4.5 INTERACTIVE BOOK POLISH PASS');
console.log('Dynamic pages, responsive navigation, swipe, reduced motion and subtle return control verified');
