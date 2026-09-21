/* Confirmed learning records. No DOM, clock, storage, scheduling or mastery inference. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StudyLearningEngine = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const KEYS = ['id', 'sessionId', 'problemId', 'at', 'disposition', 'outcome', 'help', 'obstacle', 'continuation', 'note', 'evidence', 'minutes', 'independentConfirmed'];
  const ENUMS = {
    disposition: ['continue', 'complete'],
    outcome: ['not-attempted', 'stuck', 'partial', 'solved'],
    help: ['unknown', 'none', 'hint', 'guided', 'solution'],
    obstacle: ['unknown', 'knowledge', 'memory', 'notation', 'method', 'calculation', 'time', 'none']
  };
  const LABELS = {
    outcome: {'not-attempted': 'לא נרשם ניסיון פתרון', stuck: 'ניסיתי ונתקעתי', partial: 'פתרתי חלק מהשאלה', solved: 'הגעתי לפתרון מלא'},
    help: {unknown: 'לא צוין', none: 'ללא עזרה', hint: 'רמז', guided: 'פתרון עם הכוונה', solution: 'עיינתי בפתרון'},
    obstacle: {unknown: 'לא צוין', knowledge: 'חסר ידע בנושא', memory: 'חומר שנשכח', notation: 'ניסוח או סימון לא ברורים', method: 'בחירת שיטה או בניית דרך פתרון', calculation: 'חישוב', time: 'הזמן נגמר', none: 'לא נותר קושי שצוין'}
  };
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const copy = value => JSON.parse(JSON.stringify(value));
  function invalid(message) {throw Object.assign(new Error(message), {status: 400, code: 'invalid_learning'});}
  function record(value, label) {
    if (!value || typeof value !== 'object' || Object.prototype.toString.call(value) !== '[object Object]') invalid(`${label}: נדרש אובייקט נתונים.`);
  }
  function fields(value, keys, label) {
    record(value, label);
    if (Object.keys(value).length !== keys.length || keys.some(key => !own(value, key))) invalid(`${label}: שדות הרישום אינם תקינים.`);
  }
  function identifier(value, label) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value) || ['__proto__', 'prototype', 'constructor'].includes(value)) invalid(`${label}: מזהה לא תקין.`);
  }
  function timestamp(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) || !Number.isFinite(Date.parse(value))) invalid('מועד המפגש: נדרשים תאריך ושעה תקינים עם אזור זמן.');
    const day = value.slice(0, 10);
    if (new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) !== day || day < '0001-01-01') invalid('מועד המפגש: התאריך אינו קיים.');
    return Date.parse(value);
  }
  function validateEvent(value) {
    fields(value, KEYS, 'רישום מפגש');
    identifier(value.id, 'מפגש'); identifier(value.sessionId, 'משימה');
    if (value.problemId !== null) identifier(value.problemId, 'שאלה');
    timestamp(value.at);
    for (const [key, allowed] of Object.entries(ENUMS)) if (!allowed.includes(value[key])) invalid(`${key}: הערך שנבחר אינו נתמך.`);
    for (const [key, limit] of [['continuation', 1200], ['note', 3000], ['evidence', 3000]]) {
      if (typeof value[key] !== 'string' || value[key].length > limit) invalid(`${key}: נדרש טקסט באורך של עד ${limit} תווים.`);
    }
    if (value.minutes !== null && (!Number.isInteger(value.minutes) || value.minutes < 1 || value.minutes > 600)) invalid('משך המפגש צריך להיות מספר שלם בין 1 ל־600 דקות, או להישאר ריק.');
    if (typeof value.independentConfirmed !== 'boolean') invalid('אישור הפתרון העצמאי אינו תקין.');
    if (value.problemId === null && value.outcome !== 'not-attempted') invalid('כדי לתעד ניסיון פתרון צריך לבחור את השאלה שניסית.');
    if (value.independentConfirmed && (value.problemId === null || value.outcome !== 'solved' || value.help !== 'none' || value.evidence.trim().length < 8)) invalid('פתרון עצמאי דורש שאלה, פתרון מלא ללא עזרה ואישור עם תיאור קצר של בדיקת הפתרון.');
    return value;
  }
  function checkpoint(event) {
    return {attemptId: event.id, at: event.at, continuation: event.continuation, disposition: event.disposition};
  }
  function validateLearning(value) {
    fields(value, ['version', 'attempts', 'checkpoints'], 'רישומי לימוד');
    if (value.version !== 1) invalid('גרסת רישומי הלימוד אינה נתמכת.');
    if (!Array.isArray(value.attempts) || value.attempts.length > 1000) invalid('אפשר לשמור עד 1000 רישומי מפגש.');
    record(value.checkpoints, 'נקודות המשך');
    const ids = new Set(), latest = new Map();
    for (const event of value.attempts) {
      validateEvent(event);
      if (ids.has(event.id)) invalid('אותו מזהה מפגש מופיע יותר מפעם אחת.');
      ids.add(event.id);
      const previous = latest.get(event.sessionId);
      if (!previous || timestamp(event.at) >= timestamp(previous.at)) latest.set(event.sessionId, event);
    }
    if (Object.keys(value.checkpoints).length !== latest.size) invalid('נקודות ההמשך אינן תואמות את המפגשים שנשמרו.');
    for (const [sessionId, point] of Object.entries(value.checkpoints)) {
      identifier(sessionId, 'משימה בנקודת המשך');
      fields(point, ['attemptId', 'at', 'continuation', 'disposition'], 'נקודת המשך');
      const expected = latest.has(sessionId) ? checkpoint(latest.get(sessionId)) : null;
      if (!expected || Object.keys(expected).some(key => point[key] !== expected[key])) invalid('נקודת ההמשך חייבת להתאים למפגש האחרון של המשימה.');
    }
    return value;
  }
  function learningOf(state) {
    return own(state, 'learning') ? validateLearning(state.learning) : {version: 1, attempts: [], checkpoints: {}};
  }
  function recordMeeting(state, input, catalog) {
    record(state, 'מצב הלימוד'); record(input, 'עדכון מפגש'); record(catalog, 'רשימת משימות ושאלות');
    const event = {...input};
    if (!own(event, 'problemId')) event.problemId = null;
    validateEvent(event);
    for (const key of ['sessionIds', 'problemIds']) {
      if (!Array.isArray(catalog[key])) invalid('רשימת המשימות והשאלות אינה זמינה.');
      for (const id of catalog[key]) identifier(id, 'מזהה ברשימת הקורס');
    }
    if (!catalog.sessionIds.includes(event.sessionId)) invalid('המשימה שנבחרה אינה נמצאת בתוכנית.');
    if (event.problemId !== null && !catalog.problemIds.includes(event.problemId)) invalid('השאלה שנבחרה אינה נמצאת בחומרי הקורס.');
    const previous = learningOf(state);
    const duplicate = previous.attempts.find(item => item.id === event.id);
    if (duplicate) {
      if (KEYS.some(key => duplicate[key] !== event[key])) invalid('מזהה המפגש כבר נשמר עם פרטים אחרים. יש ליצור רישום חדש.');
      return copy(duplicate);
    }
    if (previous.attempts.length >= 1000) invalid('הגעת למגבלת 1000 רישומי מפגש.');
    const next = copy(previous);
    next.attempts.push(event);
    const existing = next.checkpoints[event.sessionId];
    if (!existing || timestamp(event.at) >= timestamp(existing.at)) next.checkpoints[event.sessionId] = checkpoint(event);
    validateLearning(next);
    let summary;
    if (event.problemId !== null && event.outcome !== 'not-attempted') {
      if (own(state, 'problemProgress')) record(state.problemProgress, 'התקדמות בשאלות');
      const current = state.problemProgress && state.problemProgress[event.problemId];
      const independent = event.independentConfirmed && event.outcome === 'solved' && event.help === 'none';
      const solvedWithHelp = event.outcome === 'solved' && ['hint', 'guided', 'solution'].includes(event.help);
      const alreadyIndependent = current && ['independent', 'timed'].includes(current.status);
      const newerSummary = current && current.updatedAt && Number.isFinite(Date.parse(current.updatedAt)) && timestamp(event.at) < Date.parse(current.updatedAt);
      if (!alreadyIndependent && (independent || solvedWithHelp && !newerSummary)) {
        summary = {
          status: independent ? 'independent' : 'guided',
          evidence: event.evidence, independentConfirmed: independent,
          obstacle: event.obstacle === 'method' ? 'model' : ['none', 'unknown'].includes(event.obstacle) ? '' : event.obstacle,
          minutes: event.minutes, updatedAt: event.at
        };
      }
    }
    // Commit only after every validation above has succeeded. Never infer learned,
    // completion, dates, scores, or a future schedule from a meeting report.
    state.learning = next;
    if (summary) {
      if (!state.problemProgress) state.problemProgress = {};
      state.problemProgress[event.problemId] = summary;
    }
    return copy(event);
  }
  function latestCheckpoint(state, sessionId) {
    identifier(sessionId, 'משימה');
    const point = learningOf(state).checkpoints[sessionId];
    return point ? copy(point) : null;
  }
  function attemptsFor(state, sessionId) {
    identifier(sessionId, 'משימה');
    return learningOf(state).attempts.map((event, index) => ({event, index}))
      .filter(item => item.event.sessionId === sessionId)
      .sort((a, b) => timestamp(b.event.at) - timestamp(a.event.at) || b.index - a.index)
      .map(item => copy(item.event));
  }
  function promptContext(state, sessionId) {
    const event = attemptsFor(state, sessionId)[0];
    if (!event) return '';
    const lines = [
      'עדכון אחרון שהלומד אישר במפורש באתר (דיווח עצמי; אינו בדיקה אוטומטית של נכונות):',
      `מועד: ${event.at}`,
      `מצב המשימה בסיום המפגש: ${event.disposition === 'complete' ? 'הלומד סימן שסיים את המשימה' : 'הלומד עצר ויחזור להמשך'}.`,
      `ניסיון פתרון: ${LABELS.outcome[event.outcome]}.`,
      `עזרה שניתנה: ${LABELS.help[event.help]}.`,
      `הקושי שדווח: ${LABELS.obstacle[event.obstacle]}.`
    ];
    if (event.problemId !== null) lines.push(`מזהה השאלה: ${event.problemId}.`);
    if (event.evidence.trim()) lines.push(`תיאור ניסיון הפתרון ובדיקתו: ${event.evidence}`);
    if (event.note.trim()) lines.push(`מה קרה במפגש: ${event.note}`);
    if (event.continuation.trim()) lines.push(`נקודת ההמשך שהלומד שמר: ${event.continuation}`);
    else lines.push('לא נשמרה נקודת המשך מפורטת; ברר בקצרה עם הלומד מאיפה מתאים להמשיך.');
    lines.push('השתמש בעדכון הזה לצד האבחון המקורי. אל תסיק שסימון סיום משימה מוכיח שליטה, ואל תניח שפרט שלא צוין כבר נבדק.');
    return lines.join('\n');
  }
  return {recordMeeting, validateLearning, latestCheckpoint, attemptsFor, promptContext};
});
