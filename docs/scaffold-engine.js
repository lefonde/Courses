/* Explicit checkpoints for a guided lesson. No automatic learning or exam credit. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StudyScaffoldEngine = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const STAGES = ['background', 'example', 'completion', 'independent', 'wrapup'];
  const ACTIONS = ['continue', 'retry', 'skip', 'pause', 'hint', 'solution'];
  const HELPS = ['none', 'hint', 'guided', 'solution'];
  const RESULTS = ['not-checked', 'needs-explanation', 'with-help', 'attempted-alone'];
  const EVENT_KEYS = ['id', 'stageId', 'at', 'action', 'nextStageId', 'help', 'result', 'note'];
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const clone = value => JSON.parse(JSON.stringify(value));
  function invalid(message) {throw Object.assign(new Error(message), {status: 400, code: 'invalid_scaffold'});}
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
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) || !Number.isFinite(Date.parse(value))) invalid('מועד העדכון צריך להיות תאריך ושעה תקינים עם אזור זמן.');
    const day = value.slice(0, 10);
    if (day < '0001-01-01' || new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) !== day) invalid('תאריך העדכון אינו קיים.');
    return Date.parse(value);
  }
  function validateEvent(event) {
    exact(event, EVENT_KEYS, 'עדכון במסלול'); identifier(event.id, 'עדכון'); instant(event.at);
    if (!STAGES.includes(event.stageId) || !STAGES.includes(event.nextStageId)) invalid('השלב בעדכון אינו נתמך.');
    if (!ACTIONS.includes(event.action) || !HELPS.includes(event.help) || !RESULTS.includes(event.result)) invalid('הפעולה, העזרה או תוצאת הניסיון אינן נתמכות.');
    if (typeof event.note !== 'string' || event.note.length > 1200) invalid('ההערה צריכה להיות טקסט באורך של עד 1200 תווים.');
    if (event.result === 'attempted-alone' && (event.stageId !== 'independent' || event.help !== 'none' || event.action !== 'continue')) invalid('אפשר לציין ניסיון ללא עזרה רק בשלב הניסיון העצמאי, ללא עזרה ובפעולת המשך.');
    if (event.result === 'with-help' && event.help === 'none') invalid('תוצאה עם עזרה דורשת לציין איזו עזרה ניתנה.');
    if (event.action === 'solution' && event.help !== 'solution') invalid('פתיחת פתרון חייבת להירשם כעזרה מסוג פתרון.');
    if (event.action === 'hint' && event.help === 'none') invalid('פתיחת רמז חייבת להירשם עם העזרה שניתנה.');
    return event;
  }
  function validateTracks(value) {
    exact(value, ['version', 'sessions'], 'מסלולי לימוד');
    if (value.version !== 1) invalid('גרסת מסלולי הלימוד אינה נתמכת.');
    object(value.sessions, 'מסלולים לפי משימה');
    const ids = new Set();
    for (const [sessionId, track] of Object.entries(value.sessions)) {
      identifier(sessionId, 'משימה'); exact(track, ['lessonId', 'currentStage', 'events'], 'מסלול משימה');
      identifier(track.lessonId, 'יחידת הוראה');
      if (!STAGES.includes(track.currentStage)) invalid('נקודת ההמשך במסלול אינה שלב מוכר.');
      if (!Array.isArray(track.events) || track.events.length > 200) invalid('אפשר לשמור עד 200 עדכונים בכל מסלול.');
      let previous = null;
      const exposure = new Map();
      for (const event of track.events) {
        validateEvent(event);
        if (ids.has(event.id)) invalid('אותו מזהה עדכון מופיע יותר מפעם אחת במסלולים.');
        ids.add(event.id);
        const at = instant(event.at);
        if (previous !== null && at < previous) invalid('עדכוני המסלול חייבים להיות מסודרים לפי זמן.');
        previous = at;
        const knownHelp = exposure.get(event.stageId) || 'none';
        if (event.result === 'attempted-alone' && knownHelp !== 'none') invalid('בשלב הזה כבר נחשפו רמז או פתרון. אפשר לתעד את התרגול, אך לא כניסיון ללא עזרה.');
        if (HELPS.indexOf(event.help) < HELPS.indexOf(knownHelp)) invalid('אי אפשר למחוק מעדכון חדש עזרה שכבר תועדה באותו שלב.');
        exposure.set(event.stageId, event.help);
      }
      if (track.events.length && track.currentStage !== track.events[track.events.length - 1].nextStageId) invalid('נקודת ההמשך אינה תואמת לעדכון האחרון במסלול.');
    }
    return value;
  }
  function lessonStages(lesson) {
    object(lesson, 'יחידת ההוראה'); identifier(lesson.id, 'יחידת הוראה'); identifier(lesson.sessionId, 'משימה');
    if (!Array.isArray(lesson.stages) || !lesson.stages.length) invalid('ביחידת ההוראה חסרים שלבי הלימוד.');
    const ids = lesson.stages.map(stage => {object(stage, 'שלב לימוד'); if (!STAGES.includes(stage.id)) invalid('יחידת ההוראה כוללת שלב שאינו מוכר.'); return stage.id;});
    if (new Set(ids).size !== ids.length) invalid('שלב לימוד מופיע יותר מפעם אחת ביחידת ההוראה.');
    return ids;
  }
  function tracksOf(state) {
    object(state, 'מצב הלימוד');
    if (!own(state, 'settings')) return {version: 1, sessions: {}};
    object(state.settings, 'הגדרות הלימוד');
    return own(state.settings, 'scaffoldTracks') ? validateTracks(state.settings.scaffoldTracks) : {version: 1, sessions: {}};
  }
  function checkedTrack(tracks, lesson, stages) {
    const track = tracks.sessions[lesson.sessionId];
    if (!track) return {lessonId: lesson.id, currentStage: stages[0], events: []};
    if (track.lessonId !== lesson.id) invalid('נקודת ההמשך שייכת לגרסה אחרת של יחידת ההוראה. אין להחליף את ההיסטוריה הקודמת.');
    if (!stages.includes(track.currentStage) || track.events.some(event => !stages.includes(event.stageId) || !stages.includes(event.nextStageId))) invalid('המסלול שנשמר מפנה לשלב שאינו נמצא ביחידת ההוראה.');
    return track;
  }
  function trackFor(state, lesson) {
    const stages = lessonStages(lesson), tracks = tracksOf(state);
    return clone(checkedTrack(tracks, lesson, stages));
  }
  function record(state, input, lesson) {
    const stages = lessonStages(lesson), previous = tracksOf(state);
    validateEvent(input);
    if (!stages.includes(input.stageId) || !stages.includes(input.nextStageId)) invalid('העדכון מפנה לשלב שאינו נמצא ביחידת ההוראה.');
    const track = checkedTrack(previous, lesson, stages);
    for (const [sessionId, stored] of Object.entries(previous.sessions)) {
      const duplicate = stored.events.find(event => event.id === input.id);
      if (duplicate) {
        if (sessionId !== lesson.sessionId || EVENT_KEYS.some(key => duplicate[key] !== input[key])) invalid('מזהה העדכון כבר נשמר עם פרטים אחרים. יש ליצור עדכון חדש.');
        return clone(duplicate);
      }
    }
    if (track.events.length >= 200) invalid('הגעת למגבלת 200 העדכונים במסלול הזה.');
    if (track.events.length && instant(input.at) < instant(track.events[track.events.length - 1].at)) invalid('העדכון קודם לנקודת ההמשך שכבר נשמרה. בדוק את שעת המכשיר לפני שמירה.');
    const next = clone(previous), event = clone(input);
    next.sessions[lesson.sessionId] = {...clone(track), currentStage: event.nextStageId, events: [...clone(track.events), event]};
    validateTracks(next);
    // This is the sole mutation. No official problem, schedule, flashcard gate,
    // completed task, or learned-material flag is inferred from this self-report.
    if (!own(state, 'settings')) state.settings = {};
    state.settings.scaffoldTracks = next;
    return clone(event);
  }
  function exposureFor(state, lesson, stageId) {
    const stages = lessonStages(lesson);
    if (!stages.includes(stageId)) invalid('השלב המבוקש אינו נמצא ביחידת ההוראה.');
    return trackFor(state, lesson).events.filter(event => event.stageId === stageId)
      .reduce((help, event) => HELPS.indexOf(event.help) > HELPS.indexOf(help) ? event.help : help, 'none');
  }
  function promptContext(state, lesson) {
    const track = trackFor(state, lesson);
    if (!track.events.length) return '';
    const last = track.events.slice().reverse().find(event => !['hint', 'solution'].includes(event.action));
    const stages = {background: 'רקע וסימון', example: 'דוגמה מוסברת', completion: 'השלמת צעדים', independent: 'ניסיון ללא הכוונה', wrapup: 'סיכום ונקודת המשך'};
    const results = {'not-checked': 'לא נבדק ביצוע', 'needs-explanation': 'נדרש הסבר נוסף', 'with-help': 'עבודה עם עזרה', 'attempted-alone': 'הלומד דיווח שניסה ללא עזרה; נכונות הפתרון לא אומתה'};
    const help = {none: 'לא דווחה עזרה במעבר הזה', hint: 'רמז', guided: 'הכוונה לצעדי הפתרון', solution: 'עיון בפתרון'};
    const lines = [
      'נקודת המשך שנשמרה במפורש במסלול הלימוד המדורג:',
      `יחידת הוראה: ${lesson.id}; משימה: ${lesson.sessionId}.`,
      `להמשיך מהשלב: ${stages[track.currentStage]}.`
    ];
    if (last) {
      lines.push(`עדכון נקודת ההמשך: ${last.at}. תוצאה מדווחת: ${results[last.result]}.`, `עזרה במעבר שתועד: ${help[last.help]}.`);
      if (last.note.trim()) lines.push(`הערת הלומד: ${last.note}`);
    } else lines.push('עד כה תועדה חשיפה לעזרה בלבד; לא נשמר דיווח של הלומד על תוצאת ניסיון או על השלמת שלב.');
    const exposure = track.events.slice().reverse().find(event => ['hint', 'solution'].includes(event.action));
    if (exposure) lines.push(`בנפרד, תועדה חשיפה לעזרה בשלב ${stages[exposure.stageId]}: ${help[exposure.help]} (${exposure.at}). חשיפה זו אינה דיווח על הצלחה.`);
    if (track.events.some(event => event.stageId === 'independent' && event.help !== 'none')) lines.push('תועדה בעבר עזרה בשלב הניסיון העצמאי במסלול הזה. אל תציג חזרה על אותו פתרון כווריאציה חדשה שלא נראתה.');
    lines.push('מעבר בין שלבים ודיווח עצמי אינם הוכחה לשליטה או לפתרון עצמאי של שאלת מקור. המשך בהתאם לצורך בהסבר בלי לשנות את תוכנית הלימוד אוטומטית.');
    return lines.join('\n');
  }
  return {record, trackFor, validateTracks, promptContext, exposureFor};
});
