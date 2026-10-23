/* Ranked exam preparation: explicit self-reports, independent of the legacy course plan. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StudyExamDashboardEngine = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const badKeys = new Set(['__proto__', 'prototype', 'constructor']);
  const fail = message => {throw new Error(message);};
  function record(value, message) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(message);
  }
  function identifier(id) {
    if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id) || badKeys.has(id)) fail('מזהה משפחת השאלות אינו תקין.');
  }
  function timestamp(at) {
    if (typeof at !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(at) || !Number.isFinite(Date.parse(at))) fail('מועד סימון הלמידה אינו תקין.');
    const day = at.slice(0, 10), parsed = Date.parse(day + 'T00:00:00Z');
    if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== day) fail('מועד סימון הלמידה אינו תקין.');
  }
  function validate(value) {
    record(value, 'המעקב אחר מפת השאלות אינו תקין.');
    if (value.schemaVersion !== 1) fail('גרסת המעקב אחר מפת השאלות אינה נתמכת.');
    if (Object.keys(value).sort().join(',') !== 'learned,schemaVersion') fail('שדות המעקב אחר מפת השאלות אינם נתמכים.');
    record(value.learned, 'סימוני הלמידה במפת השאלות אינם תקינים.');
    for (const [id, item] of Object.entries(value.learned)) {
      identifier(id);
      record(item, 'סימון הלמידה במפת השאלות אינו תקין.');
      if (Object.keys(item).sort().join(',') !== 'learned,origin,updatedAt' || typeof item.learned !== 'boolean' || item.origin !== 'self-report') fail('סימון הלמידה חייב להיות דיווח עצמי מפורש.');
      timestamp(item.updatedAt);
    }
    return value;
  }
  function getLearned(state, id) {
    return own(state?.examPreparation?.learned || {}, id) && state.examPreparation.learned[id].learned === true;
  }
  function setLearned(state, id, learned, at) {
    identifier(id);
    if (typeof learned !== 'boolean') fail('סימון הלמידה חייב להיות כן או לא.');
    timestamp(at);
    if (own(state, 'examPreparation')) validate(state.examPreparation);
    else state.examPreparation = {schemaVersion: 1, learned: {}};
    state.examPreparation.learned[id] = {learned, updatedAt: at, origin: 'self-report'};
    return state;
  }
  const percentage = (part, total) => total ? Math.round(part / total * 100) : 0;
  function summary(rows, state, {priorityMinimum = 40} = {}) {
    const result = {total: rows.length, learned: 0, remaining: 0, percent: 0, priorityTotal: 0, priorityLearned: 0, priorityPercent: 0, totalScore: 0, learnedScore: 0, weightedPercent: 0, readyCount: 0, byBand: {}};
    for (const row of rows) {
      const learned = getLearned(state, row.id), score = Number.isFinite(row.score) ? Math.max(0, row.score) : 0;
      result.learned += Number(learned);
      result.totalScore += score;
      result.learnedScore += learned ? score : 0;
      if (score >= priorityMinimum) {result.priorityTotal++; result.priorityLearned += Number(learned);}
      if (row.lessonUrl && row.contentStatus === 'ready') result.readyCount++;
      if (!own(result.byBand, row.band)) Object.defineProperty(result.byBand, row.band, {value: {total: 0, learned: 0, percent: 0}, enumerable: true});
      const group = result.byBand[row.band]; group.total++; group.learned += Number(learned);
    }
    result.remaining = result.total - result.learned;
    result.percent = percentage(result.learned, result.total);
    result.priorityPercent = percentage(result.priorityLearned, result.priorityTotal);
    result.weightedPercent = percentage(result.learnedScore, result.totalScore);
    for (const group of Object.values(result.byBand)) group.percent = percentage(group.learned, group.total);
    return result;
  }
  const normalized = value => String(value ?? '').normalize('NFKC').replace(/[\u0591-\u05c7\u200e\u200f\u2066-\u2069]/g, '').toLocaleLowerCase('he-IL').trim();
  function filterPagination(rows, state, filters = {}) {
    const search = normalized(filters.search), terms = search.split(/\s+/).filter(Boolean);
    const matches = rows.filter(row => {
      if (filters.theme && filters.theme !== 'all' && row.theme !== filters.theme) return false;
      if (filters.band && filters.band !== 'all' && row.band !== filters.band) return false;
      const learned = getLearned(state, row.id);
      if (filters.status === 'learned' && !learned || filters.status === 'remaining' && learned) return false;
      if (!terms.length) return true;
      const text = normalized([row.title, row.themeLabel, row.id, ...(row.tasks || []), ...(row.techniques || [])].join(' '));
      return terms.every(term => text.includes(term));
    }).sort((a, b) => b.score - a.score || (a.ordinal || 0) - (b.ordinal || 0) || String(a.id).localeCompare(String(b.id), 'en'));
    const requestedSize = Number(filters.pageSize), pageSize = Number.isInteger(requestedSize) && requestedSize >= 1 && requestedSize <= 100 ? requestedSize : 12;
    const requestedPage = Number(filters.page), pageCount = Math.ceil(matches.length / pageSize);
    const page = Math.max(1, Math.min(Number.isInteger(requestedPage) ? requestedPage : 1, Math.max(pageCount, 1)));
    const offset = (page - 1) * pageSize;
    return {items: matches.slice(offset, offset + pageSize), total: rows.length, filteredCount: matches.length,
      page, pageSize, pageCount, from: matches.length ? offset + 1 : 0, to: Math.min(offset + pageSize, matches.length),
      hasPrevious: page > 1, hasNext: page < pageCount};
  }
  return Object.freeze({validate, getLearned, setLearned, summary, filterPagination, query: filterPagination});
});
