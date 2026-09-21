/* Short mixed-practice rounds. Selection and explicit records, never mastery or scheduling. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StudyMixedEngine = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const ACTIONS = ['hint', 'solution', 'attempt', 'skip', 'draft'];
  const OUTCOMES = ['started', 'stuck', 'skipped', 'not-checked'];
  const HELP = ['none', 'hint', 'solution'];
  const EVENT_KEYS = ['id', 'itemId', 'at', 'action', 'answer', 'outcome', 'help', 'note'];
  const ROUND_KEYS = ['id', 'startedAt', 'closedAt', 'budgetSessionId', 'itemIds', 'events'];
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const copy = value => JSON.parse(JSON.stringify(value));
  function invalid(message) {throw Object.assign(new Error(message), {status: 400, code: 'invalid_mixed'});}
  function object(value, label) {
    if (!value || typeof value !== 'object' || Object.prototype.toString.call(value) !== '[object Object]') invalid(`${label}: נדרש אובייקט נתונים.`);
  }
  function exact(value, fields, label) {
    object(value, label);
    if (Object.keys(value).length !== fields.length || fields.some(key => !own(value, key))) invalid(`${label}: שדות הרישום אינם תקינים.`);
  }
  function identifier(value, label) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value) || ['__proto__', 'prototype', 'constructor'].includes(value)) invalid(`${label}: מזהה לא תקין.`);
  }
  function instant(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) || !Number.isFinite(Date.parse(value))) invalid('מועד התרגול צריך להיות תאריך ושעה תקינים עם אזור זמן.');
    const day = value.slice(0, 10);
    if (day < '0001-01-01' || new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) !== day) invalid('תאריך התרגול אינו קיים.');
    return Date.parse(value);
  }
  function validateEvent(event) {
    exact(event, EVENT_KEYS, 'ניסיון בתרגול'); identifier(event.id, 'ניסיון'); identifier(event.itemId, 'שאלה'); instant(event.at);
    if (!ACTIONS.includes(event.action) || !OUTCOMES.includes(event.outcome) || !HELP.includes(event.help)) invalid('הפעולה, תוצאת הניסיון או העזרה אינן נתמכות.');
    if (typeof event.answer !== 'string' || event.answer.length > 2000 || typeof event.note !== 'string' || event.note.length > 1000) invalid('תשובה יכולה להכיל עד 2000 תווים והערה עד 1000 תווים.');
    if (event.action === 'attempt' && (!['started', 'stuck'].includes(event.outcome) || event.outcome === 'started' && event.answer.trim().length < 8)) invalid('כדי לשמור התחלת פתרון, כתוב לפחות 8 תווים. אם לא הצלחת להתחיל, אפשר לציין שנתקעת ולהשאיר את התשובה ריקה.');
    if (!['attempt', 'draft', 'skip'].includes(event.action) && event.answer !== '') invalid('תשובה נשמרת רק כחלק מניסיון, טיוטה או דילוג השומר עבודה חלקית.');
    if (event.action === 'draft' && event.outcome !== 'not-checked') invalid('שמירת טיוטה אינה בדיקת ניסיון.');
    if (event.action === 'skip' && event.outcome !== 'skipped') invalid('דילוג צריך להירשם כדילוג.');
    if (['hint', 'solution'].includes(event.action) && event.outcome !== 'not-checked') invalid('חשיפת עזרה אינה בדיקת הצלחה.');
    if (event.action === 'hint' && event.help === 'none') invalid('פתיחת רמז חייבת להישמר ברישום העזרה.');
    if (event.action === 'solution' && event.help !== 'solution') invalid('פתיחת פתרון חייבת להישמר ברישום העזרה.');
    return event;
  }
  function covered(round, itemId) {return round.events.some(event => event.itemId === itemId && ['attempt', 'skip'].includes(event.action));}
  function validatePractice(value) {
    exact(value, ['version', 'rounds'], 'תרגול מעורב');
    if (value.version !== 1) invalid('גרסת התרגול המעורב אינה נתמכת.');
    if (!Array.isArray(value.rounds) || value.rounds.length > 100) invalid('אפשר לשמור עד 100 סבבי תרגול.');
    const roundIds = new Set(), eventIds = new Set(), exposure = new Map();
    let previousClosed = null;
    for (let index = 0; index < value.rounds.length; index++) {
      const round = value.rounds[index];
      exact(round, ROUND_KEYS, 'סבב תרגול'); identifier(round.id, 'סבב'); identifier(round.budgetSessionId, 'משימת התרגול');
      if (roundIds.has(round.id)) invalid('מזהה סבב מופיע יותר מפעם אחת.');
      roundIds.add(round.id);
      const started = instant(round.startedAt), closed = round.closedAt === null ? null : instant(round.closedAt);
      if (index && previousClosed === null) invalid('אפשר להשאיר רק סבב פתוח אחד, אחרי כל הסבבים שנסגרו.');
      if (index && started < previousClosed || closed !== null && closed < started) invalid('מועדי סבבי התרגול אינם מסודרים לפי זמן.');
      if (!Array.isArray(round.itemIds) || round.itemIds.length < 2 || round.itemIds.length > 3 || new Set(round.itemIds).size !== round.itemIds.length) invalid('בסבב נדרשות שתיים או שלוש שאלות שונות.');
      round.itemIds.forEach(id => identifier(id, 'שאלה בסבב'));
      if (!Array.isArray(round.events) || round.events.length > 25) invalid('אפשר לשמור עד 25 פעולות בכל סבב.');
      let preceding = started;
      for (const event of round.events) {
        validateEvent(event);
        if (eventIds.has(event.id)) invalid('מזהה ניסיון מופיע יותר מפעם אחת.');
        eventIds.add(event.id);
        if (!round.itemIds.includes(event.itemId)) invalid('הניסיון אינו שייך לשאלות הסבב.');
        const at = instant(event.at);
        if (at < preceding || closed !== null && at > closed) invalid('מועד הניסיון אינו נמצא במקומו בסבב.');
        preceding = at;
        const priorHelp = exposure.get(event.itemId) || 'none';
        if (HELP.indexOf(event.help) < HELP.indexOf(priorHelp)) invalid('אי אפשר למחוק רמז או פתרון שכבר נחשפו בשאלה הזאת, גם מסבב קודם.');
        exposure.set(event.itemId, event.help);
      }
      const unfinished = round.itemIds.filter(id => !covered(round, id)).length;
      if (round.events.length + unfinished > 25) invalid('נשמר מקום לניסיון או לדילוג בכל שאלה שנותרה. לפני שמירה נוספת, תעד ניסיון או דלג על שאלה.');
      if (closed !== null && !round.itemIds.every(id => covered(round, id))) invalid('לפני סגירת סבב יש לתעד ניסיון או דילוג בכל שאלה.');
      previousClosed = closed;
    }
    return value;
  }
  function practiceOf(state) {
    object(state, 'מצב הלימוד');
    if (!own(state, 'settings')) return {version: 1, rounds: []};
    object(state.settings, 'הגדרות הלימוד');
    return own(state.settings, 'mixedPractice') ? validatePractice(state.settings.mixedPractice) : {version: 1, rounds: []};
  }
  function catalog(content) {
    object(content, 'מאגר התרגול');
    if (!Array.isArray(content.items)) invalid('מאגר שאלות התרגול אינו זמין.');
    const ids = new Set();
    for (const item of content.items) {
      object(item, 'שאלת תרגול'); identifier(item.id, 'שאלת תרגול'); identifier(item.familyId, 'משפחת שאלות');
      if (ids.has(item.id)) invalid('מזהה שאלה מופיע יותר מפעם אחת במאגר.');
      ids.add(item.id);
      if (!Array.isArray(item.unlockAfter) || !item.unlockAfter.length) invalid('לשאלת תרגול חסרים תנאי למידה מפורשים.');
      item.unlockAfter.forEach(id => identifier(id, 'משימת לימוד נדרשת'));
    }
    return content.items;
  }
  function learned(item, state) {return item.unlockAfter.every(id => state.sessionUpdates?.[id]?.learned === true);}
  function eligibleItems(content, state) {
    object(state, 'מצב הלימוד');
    return catalog(content).filter(item => learned(item, state)).map(copy);
  }
  function planRound(content, state, max = 3) {
    if (!Number.isInteger(max) || max < 2 || max > 3) invalid('סבב יכול לכלול שתיים או שלוש שאלות.');
    const practice = practiceOf(state);
    if (practice.rounds.some(round => round.closedAt === null)) return [];
    const seen = new Map();
    for (const round of practice.rounds) for (const id of round.itemIds) {
      const last = Math.max(instant(round.startedAt), ...round.events.filter(event => event.itemId === id).map(event => instant(event.at)));
      seen.set(id, Math.max(seen.get(id) || 0, last));
    }
    const familyUse = new Map();
    for (const item of catalog(content)) if (seen.has(item.id)) familyUse.set(item.familyId, Math.max(familyUse.get(item.familyId) || 0, seen.get(item.id)));
    const eligible = eligibleItems(content, state), families = new Map();
    for (let index = 0; index < eligible.length; index++) {
      const item = eligible[index];
      if (!families.has(item.familyId)) families.set(item.familyId, {last: familyUse.get(item.familyId) ?? null, index, items: []});
      const family = families.get(item.familyId); family.items.push(item);
      if (seen.has(item.id)) family.last = Math.max(family.last || 0, seen.get(item.id));
    }
    // Rotate families before selecting a variant so a family cannot be starved
    // merely because the content bank lists many fresh variants of another one.
    const selected = [...families.values()].sort((a, b) => Number(a.last !== null) - Number(b.last !== null) || (a.last || 0) - (b.last || 0) || a.index - b.index)
      .slice(0, max).map(family => family.items.sort((a, b) => Number(seen.has(a.id)) - Number(seen.has(b.id)) || (seen.get(a.id) || 0) - (seen.get(b.id) || 0))[0].id);
    return selected.length >= 2 ? selected : [];
  }
  function commit(state, value) {
    validatePractice(value);
    if (!own(state, 'settings')) state.settings = {};
    state.settings.mixedPractice = value;
  }
  function startRound(state, input, content) {
    exact(input, ['id', 'at', 'itemIds', 'budgetSessionId'], 'פתיחת סבב');
    identifier(input.id, 'סבב'); identifier(input.budgetSessionId, 'משימת התרגול'); instant(input.at);
    const items = catalog(content), previous = practiceOf(state);
    if (!Array.isArray(input.itemIds) || input.itemIds.length < 2 || input.itemIds.length > 3 || new Set(input.itemIds).size !== input.itemIds.length) invalid('בסבב נדרשות שתיים או שלוש שאלות שונות.');
    const chosen = input.itemIds.map(id => {identifier(id, 'שאלה'); const item = items.find(item => item.id === id); if (!item) invalid('השאלה אינה נמצאת במאגר התרגול.'); return item;});
    if (new Set(chosen.map(item => item.familyId)).size !== chosen.length) invalid('יש לבחור שאלות ממשפחות שונות.');
    if (chosen.some(item => !learned(item, state))) invalid('אפשר להתחיל רק בשאלות שכל החומר הדרוש להן סומן כנלמד.');
    const duplicate = previous.rounds.find(round => round.id === input.id);
    if (duplicate) {
      if (duplicate.startedAt !== input.at || duplicate.budgetSessionId !== input.budgetSessionId || JSON.stringify(duplicate.itemIds) !== JSON.stringify(input.itemIds)) invalid('מזהה הסבב כבר נשמר עם פרטים אחרים.');
      return copy(duplicate);
    }
    if (previous.rounds.some(round => round.closedAt === null)) invalid('כבר יש סבב פתוח. אפשר להמשיך אותו לפני פתיחת סבב חדש.');
    const round = {id: input.id, startedAt: input.at, closedAt: null, budgetSessionId: input.budgetSessionId, itemIds: [...input.itemIds], events: []};
    const next = copy(previous); next.rounds.push(round); commit(state, next);
    return copy(round);
  }
  function record(state, roundId, event, content) {
    identifier(roundId, 'סבב'); validateEvent(event);
    const items = catalog(content), previous = practiceOf(state), round = previous.rounds.find(round => round.id === roundId);
    if (!round) invalid('סבב התרגול לא נמצא.');
    if (!round.itemIds.includes(event.itemId)) invalid('השאלה אינה חלק מהסבב הזה.');
    const item = items.find(item => item.id === event.itemId);
    if (!item && event.action !== 'skip') invalid('השאלה אינה נמצאת במאגר התרגול הנוכחי. אפשר לדלג עליה בלי לפתוח תוכן חסר.');
    for (const stored of previous.rounds) {
      const duplicate = stored.events.find(item => item.id === event.id);
      if (duplicate) {
        if (stored.id !== roundId || EVENT_KEYS.some(key => duplicate[key] !== event[key])) invalid('מזהה הניסיון כבר נשמר עם פרטים אחרים.');
        return copy(duplicate);
      }
    }
    if (round.closedAt !== null) invalid('אי אפשר להוסיף ניסיון לסבב שכבר נסגר.');
    if (event.action !== 'skip' && !learned(item, state)) invalid('החומר הדרוש לשאלה כבר אינו מסומן כנלמד. אפשר לדלג עליה בלי לפתוח את תוכנה.');
    const next = copy(previous); next.rounds.find(item => item.id === roundId).events.push(copy(event)); commit(state, next);
    return copy(event);
  }
  function closeRound(state, roundId, at, content) {
    identifier(roundId, 'סבב'); instant(at); catalog(content);
    const previous = practiceOf(state), round = previous.rounds.find(round => round.id === roundId);
    if (!round) invalid('סבב התרגול לא נמצא.');
    if (round.closedAt !== null) {
      if (round.closedAt !== at) invalid('הסבב כבר נסגר במועד אחר.');
      return copy(round);
    }
    if (!round.itemIds.every(id => covered(round, id))) invalid('לפני סגירת הסבב יש לתעד ניסיון או דילוג בכל שאלה.');
    const next = copy(previous), target = next.rounds.find(item => item.id === roundId); target.closedAt = at; commit(state, next);
    return copy(target);
  }
  function activeRound(state) {const round = practiceOf(state).rounds.find(round => round.closedAt === null); return round ? copy(round) : null;}
  function historyFor(state, itemId) {
    identifier(itemId, 'שאלה');
    return practiceOf(state).rounds.flatMap(round => round.events).filter(event => event.itemId === itemId).slice().reverse().map(copy);
  }
  function exposureFor(state, itemId) {return historyFor(state, itemId).reduce((help, event) => HELP.indexOf(event.help) > HELP.indexOf(help) ? event.help : help, 'none');}
  function allocatedMinutes(state, sessionId) {identifier(sessionId, 'משימת תרגול'); return practiceOf(state).rounds.filter(round => round.budgetSessionId === sessionId).length * 10;}
  return {eligibleItems, planRound, startRound, record, closeRound, activeRound, validatePractice, exposureFor, historyFor, allocatedMinutes};
});
