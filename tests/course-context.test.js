'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const courses = require('../docs/course-context.js');

test('unscoped saved URLs retain Random Algorithms identity and legacy storage', () => {
  for (const url of ['https://example.test/Courses/#exam-map', 'https://example.test/Courses/#exam-problem/example', 'https://example.test/Courses/source.html?file=Course%20Book.pdf#page=3']) {
    const context = courses.createContext(new URL(url).search);
    assert.equal(context.current().id, 'random-algorithms');
    assert.equal(context.current().offeringId, '2026-s3');
    assert.equal(context.current().storageKey, 'matzpen:22902:2026-s3:progress:v1');
    assert.equal(context.current().sourceDatabase, 'study-compass-course-sources-v1');
    assert.equal(context.dataPath('curriculum'), './data/curriculum.json');
  }
});

test('explicit course links round trip and maintain context in fragment navigation', () => {
  for (const course of courses.all()) {
    const link = courses.href(course.id, '#library', course.offeringId);
    const url = new URL(link, 'https://example.test/Courses/');
    const context = courses.createContext(url.search);
    assert.equal(context.current(), course);
    assert.equal(context.error(), null);
    const glossary = new URL('#reference/example', url);
    assert.equal(courses.resolve(glossary.search).course.id, course.id);
  }
  assert.equal(courses.resolve('?course=advanced-algorithms').course.offeringId, 'exam-prep');
});

test('invalid contexts fail closed without legacy progress or data access', () => {
  const queries = [
    '?course=missing', '?course=', '?offering=2026-s3',
    '?course=advanced-algorithms&offering=2026-s3', '?course=random-algorithms&offering=',
    '?course=random-algorithms&course=advanced-algorithms',
    '?course=random-algorithms&%63ourse=random-algorithms',
    '?course=advanced-algorithms&offering=exam-prep&offering=exam-prep',
    '?course=%', '?course=%C3%28', '?course=..%2Frandom-algorithms',
    '?course=%20random-algorithms', '?Course=advanced-algorithms',
    '?course=random-algorithms#exam-map', null
  ];
  for (const search of queries) {
    const result = courses.resolve(search), context = courses.createContext(search);
    assert.equal(result.course, null, String(search));
    assert.ok(result.error.code, String(search));
    assert.equal(context.current(), null);
    assert.equal(context.dataPath('curriculum'), null);
    assert.equal(context.supports('exam-map'), false);
  }
});

test('the second course isolates storage and enables only available routes', () => {
  const random = courses.createContext(''), advanced = courses.createContext('?course=advanced-algorithms');
  assert.notEqual(random.current().storageKey, advanced.current().storageKey);
  assert.notEqual(random.current().sourceDatabase, advanced.current().sourceDatabase);
  assert.equal(advanced.current().planner, false);
  assert.equal(advanced.current().examSummary, null);
  assert.equal(advanced.current().offeringKind, 'setup');
  for (const page of ['exam-map', 'library', 'readiness']) assert.equal(advanced.supports(page), true);
  for (const page of ['schedule', 'lessons', 'lesson/example', 'reference', 'exam-problem/example', 'flashcards']) assert.equal(advanced.supports(page), false);
  assert.equal(random.supports('#exam-problem/example'), true);
  assert.equal(advanced.dataPath('schedule'), null);
  assert.equal(advanced.dataPath('constructor'), null);
  assert.equal(advanced.dataPath('../data/curriculum.json'), null);
});

test('link creation refuses unknown identities and executable or external destinations', () => {
  assert.throws(() => courses.href('missing'), TypeError);
  assert.throws(() => courses.href('random-algorithms', '#exam-map', 'exam-prep'), TypeError);
  for (const fragment of ['https://example.test/', 'javascript:alert(1)', '#library" onclick="x', '\n#library']) {
    assert.throws(() => courses.href('advanced-algorithms', fragment), TypeError);
  }
});

test('browser bootstrap needs neither storage nor network and fixes identity for the page lifetime', () => {
  const window = {location: {search: '?course=advanced-algorithms&offering=exam-prep'}};
  Object.defineProperty(window, 'localStorage', {get() { throw new Error('must not access progress'); }});
  window.fetch = () => { throw new Error('must not fetch during bootstrap'); };
  const sandbox = vm.createContext({window, URLSearchParams});
  for (const file of ['course-manifests.js', 'course-context.js']) vm.runInContext(fs.readFileSync(require.resolve('../docs/' + file), 'utf8'), sandbox);
  assert.equal(window.StudyCourses.current().id, 'advanced-algorithms');
  window.location.search = '?course=random-algorithms';
  assert.equal(window.StudyCourses.current().id, 'advanced-algorithms');
  assert.equal(window.StudyCourses.resolve(window.location.search).course.id, 'random-algorithms');
});

test('manifests are deeply immutable so one feature cannot redirect another course', () => {
  const random = courses.all()[0];
  assert.throws(() => { random.data.curriculum = './other.json'; }, TypeError);
  assert.throws(() => { random.features.push('unexpected'); }, TypeError);
  assert.throws(() => { courses.all().pop(); }, TypeError);
});
