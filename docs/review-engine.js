/* Explicitly approved ten-minute question reviews. Pure functions return fresh values.
   Intervals are a planning heuristic for this exam horizon, not a mastery measure. */
(function (root, factory) {
  const content = typeof module === 'object' && module.exports ? require('./review-content.js') : root.StudyReviewContent;
  const api = factory(content);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StudyReviewEngine = api;
})(typeof window === 'undefined' ? globalThis : window, function (content) {
  'use strict';
  const DAY = 86400000;
  const DEADLINE = '2026-10-07T20:00:00+03:00';
  const MINUTES = 10;
  const ENTRY_KEYS = ['id', 'problemId', 'target', 'createdAt', 'dueAt', 'sessionId', 'status', 'outcome', 'help', 'note', 'updatedAt', 'history'];
  const INPUT_KEYS = ['id', 'problemId', 'target', 'createdAt', 'dueAt', 'sessionId'];
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const copy = value => JSON.parse(JSON.stringify(value));
  const empty = () => ({version: 1, entries: []});
  function invalid(message) {throw Object.assign(new Error(message), {status: 400, code: 'invalid_reviews'});}
  function object(value, label) {
    if (!value || typeof value !== 'object' || Object.prototype.toString.call(value) !== '[object Object]') invalid(`${label}: נדרש אובייקט נתונים.`);
  }
  function exact(value, keys, label) {
    object(value, label);
    if (Object.keys(value).length !== keys.length || keys.some(key => !own(value, key))) invalid(`${label}: שדות הרישום אינם תקינים.`);
  }
  function identifier(value, label) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value) || ['__proto__', 'prototype', 'constructor'].includes(value)) invalid(`${label}: מזהה לא תקין.`);
  }
  function instant(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) || !Number.isFinite(Date.parse(value))) invalid('מועד החזרה צריך לכלול תאריך ושעה תקינים עם אזור זמן.');
    const day = value.slice(0, 10);
    if (day < '0001-01-01' || new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) !== day) invalid('תאריך החזרה אינו קיים.');
    return Date.parse(value);
  }
  function metadata(problemId) {
    identifier(problemId, 'שאלה');
    const item = content?.items?.find(item => item.problemId === problemId);
    if (!item) invalid('חזרה זו מיועדת רק לשאלות החובה בממ״נים ולשלוש דוגמאות המרצה.');
    return item;
  }
  function due(value, earliest) {
    const at = instant(value);
    if (at > instant(DEADLINE)) invalid('יש לקבוע את החזרה עד 7 באוקטובר ב־20:00, לפני הבחינה.');
    if (at < earliest) invalid('מועד החזרה אינו יכול להיות לפני מועד אישור התכנון.');
    return at;
  }
  function validateReviews(value) {
    exact(value, ['version', 'entries'], 'חזרות על שאלות');
    if (value.version !== 1) invalid('גרסת החזרות אינה נתמכת.');
    if (!Array.isArray(value.entries) || value.entries.length > 100) invalid('אפשר לשמור עד 100 חזרות על שאלות.');
    const ids = new Set(), planned = new Set();
    for (const entry of value.entries) {
      exact(entry, ENTRY_KEYS, 'חזרה');
      identifier(entry.id, 'חזרה'); metadata(entry.problemId); identifier(entry.sessionId, 'משימת התקציב');
      if (ids.has(entry.id)) invalid('מזהה חזרה מופיע יותר מפעם אחת.');
      ids.add(entry.id);
      if (typeof entry.target !== 'string' || entry.target.trim().length < 3 || entry.target.length > 400) invalid('תאר את הסעיף או שלד ההוכחה לחזרה ב־3 עד 400 תווים.');
      if (typeof entry.note !== 'string' || entry.note.length > 1200) invalid('הערת החזרה יכולה לכלול עד 1200 תווים.');
      const created = instant(entry.createdAt), updated = instant(entry.updatedAt);
      due(entry.dueAt, created);
      if (updated < created) invalid('עדכון החזרה אינו יכול להיות לפני יצירתה.');
      if (!['planned', 'done', 'cancelled'].includes(entry.status)) invalid('מצב החזרה אינו נתמך.');
      if (entry.status === 'done') {
        if (!['recalled', 'needs-work', 'skipped'].includes(entry.outcome) || !['none', 'hint', 'solution'].includes(entry.help)) invalid('יש לציין את תוצאת החזרה ואת העזרה שניתנה.');
      } else if (entry.outcome !== null || entry.help !== null || entry.note !== '') invalid('תוצאה, עזרה והערה נרשמות רק בחזרה שבוצעה.');
      if (entry.status === 'planned') {
        if (planned.has(entry.problemId)) invalid('כבר קיימת חזרה מתוכננת לשאלה הזאת.');
        planned.add(entry.problemId);
        due(entry.dueAt, updated);
      }
      if (!Array.isArray(entry.history) || entry.history.length > 20) invalid('אפשר לשמור עד 20 שינויי תכנון לכל חזרה.');
      if (entry.status === 'planned' && entry.history.length > 19) invalid('בחזרה מתוכננת נשמר מקום לרישום סיום או ביטול.');
      let previous = created;
      for (let index = 0; index < entry.history.length; index++) {
        const change = entry.history[index];
        exact(change, ['at', 'action', 'dueAt', 'sessionId'], 'שינוי בתכנון החזרה');
        const at = instant(change.at);
        if (at < previous || at > updated) invalid('שינויי התכנון צריכים להישמר לפי סדר זמנם.');
        previous = at;
        if (!['move', 'done', 'cancel'].includes(change.action)) invalid('פעולת שינוי התכנון אינה נתמכת.');
        if (change.action !== 'move' && index !== entry.history.length - 1) invalid('אי אפשר לשנות חזרה לאחר סיום או ביטול.');
        due(change.dueAt, created); identifier(change.sessionId, 'משימת תקציב קודמת');
      }
      const last = entry.history.at(-1);
      if (!last) {
        if (entry.status !== 'planned' || entry.updatedAt !== entry.createdAt) invalid('חזרה חדשה צריכה להיות מתוכננת וללא שינויי עבר.');
      } else {
        if (entry.updatedAt !== last.at) invalid('מועד העדכון אינו תואם את השינוי האחרון.');
        const expected = entry.status === 'done' ? 'done' : entry.status === 'cancelled' ? 'cancel' : 'move';
        if (last.action !== expected) invalid('מצב החזרה אינו תואם את הפעולה האחרונה.');
        if (entry.status !== 'planned' && (last.dueAt !== entry.dueAt || last.sessionId !== entry.sessionId)) invalid('סיום או ביטול אינם משנים את הקצאת הזמן של החזרה.');
      }
    }
    return value;
  }
  function normalize(value) {return value === undefined ? empty() : copy(validateReviews(value));}
  function reviewsOf(state) {object(state, 'מצב הלימוד'); return normalize(state.settings?.questionReviews);}
  function attemptEvidence(problemId, state) {
    const attempts = Array.isArray(state.learning?.attempts) ? state.learning.attempts : [];
    const genuine = attempts.filter(attempt => attempt.problemId === problemId && ['stuck', 'partial', 'solved'].includes(attempt.outcome));
    const legacy = state.problemProgress?.[problemId];
    const legacyEligible = legacy && ['guided', 'independent', 'timed'].includes(legacy.status);
    const known = genuine.filter(attempt => Number.isFinite(Date.parse(attempt.at))).map(attempt => ({at: attempt.at, outcome: attempt.outcome, help: attempt.help || 'unknown'}));
    if (legacyEligible && Number.isFinite(Date.parse(legacy.updatedAt))) known.push({at: legacy.updatedAt, outcome: 'solved', help: legacy.status === 'guided' ? 'guided' : 'none'});
    known.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    return {eligible: genuine.length > 0 || !!legacyEligible, latest: known[0] || null, latestDifficulty: known.find(attempt => ['stuck', 'partial'].includes(attempt.outcome)) || null};
  }
  function eligible(problemId, state) {
    object(state, 'מצב הלימוד');
    return metadata(problemId).unlockAfter.every(id => state.sessionUpdates?.[id]?.learned === true) && attemptEvidence(problemId, state).eligible;
  }
  function eligibleQuestions(curriculum, state) {
    object(curriculum, 'חומרי הקורס'); object(state, 'מצב הלימוד');
    if (!Array.isArray(curriculum.problems)) invalid('רשימת שאלות הקורס אינה זמינה.');
    return content.items.filter(item => eligible(item.problemId, state)).map(item => {
      const question = curriculum.problems.find(question => question.id === item.problemId);
      if (!question) return null;
      return {...copy(question), ...copy(item), priorAttemptAt: attemptEvidence(item.problemId, state).latest?.at || null};
    }).filter(Boolean);
  }
  function cutoff(examDate = '2026-10-08') {
    if (typeof examDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(examDate)) invalid('תאריך הבחינה אינו תקין.');
    const midnight = instant(examDate + 'T00:00:00Z');
    const previousDay = new Date(midnight - DAY).toISOString().slice(0, 10);
    // This course's September–October preparation window is UTC+03:00.
    return Math.min(instant(DEADLINE), instant(previousDay + 'T20:00:00+03:00'));
  }
  function proposeNextDate(problemId, state, now, examDate = '2026-10-08') {
    const current = instant(now), deadline = cutoff(examDate), reviews = reviewsOf(state);
    if (!eligible(problemId, state) || current >= deadline || reviews.entries.some(entry => entry.problemId === problemId && entry.status === 'planned')) return null;
    const completed = reviews.entries.filter(entry => entry.problemId === problemId && entry.status === 'done').sort((a, b) => instant(b.updatedAt) - instant(a.updatedAt));
    const evidence = attemptEvidence(problemId, state), attempt = evidence.latest;
    let intervalDays = 2, reason = 'הצעה לחזרה בעוד יומיים בעקבות ניסיון קודם בשאלה.';
    if (attempt && (!completed.length || instant(attempt.at) > instant(completed[0].updatedAt))) {
      if (['stuck', 'partial'].includes(attempt.outcome)) {intervalDays = 1; reason = 'בניסיון האחרון נותר קושי; מוצעת חזרה קצרה מחר.';}
    } else if (completed.length) {
      const latest = completed[0];
      if (latest.outcome !== 'recalled' || latest.help !== 'none') {intervalDays = 1; reason = 'בחזרה האחרונה נדרש חיזוק, ניתנה עזרה או שהניסיון דולג; מוצעת חזרה מחר.';}
      else {
        let streak = 0;
        for (const entry of completed) {
          if (entry.outcome !== 'recalled' || entry.help !== 'none' || evidence.latestDifficulty && instant(entry.updatedAt) <= instant(evidence.latestDifficulty.at)) break;
          streak++;
        }
        intervalDays = streak >= 2 ? 4 : 2;
        reason = intervalDays === 4 ? 'אחרי שתי חזרות רצופות שנזכרו ללא עזרה, מוצע מרווח של ארבעה ימים.' : 'אחרי חזרה שנזכרה ללא עזרה, מוצע מרווח של יומיים.';
      }
    }
    const proposed = current + intervalDays * DAY, capped = proposed > deadline;
    if (capped) reason += ' המועד קוצר כדי להישאר לפני ערב הבחינה.';
    return {dueAt: new Date(Math.min(proposed, deadline)).toISOString(), intervalDays, capped, reason, minutes: MINUTES};
  }
  function addReview(value, input, state) {
    exact(input, INPUT_KEYS, 'תכנון חזרה');
    const next = normalize(value);
    if (!eligible(input.problemId, state)) invalid('אפשר לתכנן חזרה רק אחרי סימון החומר כנלמד ותיעוד ניסיון בשאלה המקורית.');
    const duplicate = next.entries.find(entry => entry.id === input.id);
    if (duplicate) {
      if (INPUT_KEYS.some(key => duplicate[key] !== input[key])) invalid('מזהה החזרה כבר נשמר עם פרטים אחרים.');
      return next;
    }
    next.entries.push({...copy(input), status: 'planned', outcome: null, help: null, note: '', updatedAt: input.createdAt, history: []});
    validateReviews(next);
    return next;
  }
  function plannedEntry(value, id, at) {
    identifier(id, 'חזרה'); instant(at);
    const next = normalize(value), entry = next.entries.find(entry => entry.id === id);
    if (!entry) invalid('החזרה לא נמצאה.');
    if (entry.status !== 'planned') invalid('אפשר לשנות רק חזרה שעדיין מתוכננת.');
    if (instant(at) < instant(entry.updatedAt)) invalid('השינוי אינו יכול להקדים את העדכון האחרון.');
    return {next, entry};
  }
  function saveHistory(entry, action, at) {
    entry.history.push({at, action, dueAt: entry.dueAt, sessionId: entry.sessionId});
    entry.updatedAt = at;
  }
  function moveReview(value, id, input) {
    exact(input, ['dueAt', 'sessionId', 'at'], 'העברת חזרה');
    const {next, entry} = plannedEntry(value, id, input.at);
    due(input.dueAt, instant(input.at)); identifier(input.sessionId, 'משימת התקציב');
    if (entry.dueAt === input.dueAt && entry.sessionId === input.sessionId) return next;
    if (entry.history.length >= 19) invalid('אפשר להעביר חזרה עד 19 פעמים; נשמר מקום לרישום סיום או ביטול.');
    saveHistory(entry, 'move', input.at);
    entry.dueAt = input.dueAt; entry.sessionId = input.sessionId;
    validateReviews(next); return next;
  }
  function completeReview(value, id, input) {
    exact(input, ['outcome', 'help', 'note', 'at'], 'סיום חזרה');
    const {next, entry} = plannedEntry(value, id, input.at);
    saveHistory(entry, 'done', input.at);
    entry.status = 'done'; entry.outcome = input.outcome; entry.help = input.help; entry.note = input.note;
    validateReviews(next); return next;
  }
  function cancelReview(value, id, input) {
    exact(input, ['at'], 'ביטול חזרה');
    const {next, entry} = plannedEntry(value, id, input.at);
    saveHistory(entry, 'cancel', input.at); entry.status = 'cancelled';
    validateReviews(next); return next;
  }
  function allocations(value) {
    const result = {};
    for (const entry of normalize(value).entries) if (entry.status !== 'cancelled') result[entry.sessionId] = (result[entry.sessionId] || 0) + MINUTES;
    return result;
  }
  function allocatedMinutes(value, sessionId) {identifier(sessionId, 'משימת התקציב'); return allocations(value)[sessionId] || 0;}
  return {MINUTES, DEADLINE, validateReviews, normalize, eligibleQuestions, proposeNextDate, addReview, moveReview, completeReview, cancelReview, allocations, allocatedMinutes};
});
