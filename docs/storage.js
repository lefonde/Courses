/* Persistence adapter. Public hosting uses only this browser's private storage. */
(function (root, factory) {
  const learning = typeof module === 'object' && module.exports ? require('./learning-engine.js') : root && root.StudyLearningEngine;
  const api = factory(learning);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) root.StudyStorage = api.createStorage(root, root.STUDY_CONFIG || {});
})(typeof window === 'undefined' ? globalThis : window, function (learning) {
  'use strict';
  const MAX_BYTES = 1024 * 1024;
  const START = '2026-09-21', END = '2026-10-08';
  const DEADLINE = Date.parse('2026-10-07T20:00:00+03:00');
  const BAD_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
  const SESSION_STATUSES = ['planned', 'in-progress', 'completed'];
  const PROBLEM_STATUSES = ['unseen', 'read', 'guided', 'independent', 'timed'];
  const KINDS = ['setup', 'study', 'practice', 'review', 'mock'];
  const RATINGS = ['again', 'hard', 'good'];
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const clone = object => JSON.parse(JSON.stringify(object));
  const integer = value => Number.isInteger(value) && value >= 0;
  function failure(message, status = 400, code = 'invalid_state') {
    return Object.assign(new Error(message), {status, code});
  }
  function invalid(message) {throw failure(message);}
  function defaultState() {
    return {schemaVersion: 1, revision: 0, sessionUpdates: {}, problemProgress: {}, dayOverrides: {}, journal: [], settings: {}};
  }
  function record(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`${label}: נדרש אובייקט נתונים.`);
  }
  function identifier(value, label) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value) || BAD_KEYS.has(value)) invalid(`${label}: מזהה לא תקין.`);
  }
  function date(value, label, inPlan = false) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + 'T00:00:00Z')) || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) invalid(`${label}: תאריך לא תקין.`);
    if (inPlan && (value < START || value > END)) invalid(`${label}: התאריך נמצא מחוץ לתקופת ההכנה.`);
  }
  function timestamp(value, label) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) invalid(`${label}: נדרש תאריך ושעה עם אזור זמן.`);
    date(value.slice(0, 10), label);
    return Date.parse(value);
  }
  function fields(value, strings = [], booleans = [], lists = []) {
    for (const key of strings) if (own(value, key) && typeof value[key] !== 'string') invalid(`${key}: נדרש טקסט.`);
    for (const key of booleans) if (own(value, key) && typeof value[key] !== 'boolean') invalid(`${key}: נדרש ערך אמת או שקר.`);
    for (const key of lists) if (own(value, key) && (!Array.isArray(value[key]) || value[key].some(item => typeof item !== 'string'))) invalid(`${key}: נדרשת רשימת טקסטים.`);
  }
  function minutes(value, key, minimum = 0, nullable = false) {
    if (!own(value, key) || nullable && value[key] === null) return;
    if (!integer(value[key]) || value[key] < minimum || value[key] > 600) invalid(`${key}: משך הזמן אינו תקין.`);
  }
  function session(value, custom = false) {
    record(value, 'יחידת לימוד');
    if (custom && ['id', 'title', 'date', 'minutes', 'kind'].some(key => !own(value, key))) invalid('ליחידה חדשה חסרים פרטים נדרשים.');
    if (own(value, 'id')) identifier(value.id, 'יחידה');
    fields(value, ['title', 'objective', 'note', 'updatedAt', 'priority', 'stage'], ['conditional', 'optional', 'disabled', 'learned'], ['dependsOn', 'problemIds', 'sourceIds', 'steps']);
    if (own(value, 'doneWhen') && typeof value.doneWhen !== 'string') fields(value, [], [], ['doneWhen']);
    if (own(value, 'date')) date(value.date, 'תאריך היחידה', true);
    if (value.learnedAt != null) timestamp(value.learnedAt, 'מועד למידת החומר');
    if (own(value, 'start') && value.start !== null && (typeof value.start !== 'string' || value.start !== '' && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.start))) invalid('שעת ההתחלה אינה תקינה.');
    if (own(value, 'status') && !SESSION_STATUSES.includes(value.status)) invalid('מצב היחידה אינו נתמך.');
    if (own(value, 'kind') && !KINDS.includes(value.kind)) invalid('סוג היחידה אינו נתמך.');
    if (value.topicId != null) identifier(value.topicId, 'נושא');
    minutes(value, 'minutes', 1); minutes(value, 'actualMinutes', 0, true);
    if (own(value, 'mock')) {
      record(value.mock, 'סימולציה'); fields(value.mock, [], ['uninterrupted', 'noHelp', 'newQuestions']);
      if (own(value.mock, 'scores') && (!Array.isArray(value.mock.scores) || value.mock.scores.length !== 3 || value.mock.scores.some(score => score !== null && (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100)))) invalid('בסימולציה נדרשים שלושה ציונים תקינים או ערכים ריקים.');
    }
  }
  function flashcards(value) {
    record(value, 'הגדרות כרטיסיות');
    if (own(value, 'dailyLimit') && (!integer(value.dailyLimit) || value.dailyLimit < 1 || value.dailyLimit > 20)) invalid('מכסת הכרטיסיות צריכה להיות בין 1 ל־20.');
    const progress = value.progress || {};
    if (own(value, 'progress')) record(value.progress, 'התקדמות בכרטיסיות');
    for (const [id, review] of Object.entries(progress)) {
      identifier(id, 'כרטיסייה'); record(review, 'חזרה בכרטיסייה');
      fields(review, ['reason'], ['finalReview']);
      for (const key of ['stage', 'streak', 'lapses', 'reviews']) if (own(review, key) && !integer(review[key])) invalid(`כרטיסייה: ${key} אינו מספר שלם תקין.`);
      if ((review.stage || 0) > 3 || own(review, 'lastRating') && !RATINGS.includes(review.lastRating)) invalid('נתוני החזרה בכרטיסייה אינם תקינים.');
      const first = own(review, 'firstReviewedAt') ? timestamp(review.firstReviewedAt, 'חזרה ראשונה') : null;
      const last = own(review, 'lastReviewedAt') ? timestamp(review.lastReviewedAt, 'חזרה אחרונה') : null;
      const due = review.dueAt != null ? timestamp(review.dueAt, 'החזרה הבאה') : null;
      if (review.reviews > 0 && (last === null || !own(review, 'lastRating'))) invalid('לחזרה מתועדת נדרשים מועד ודירוג.');
      if (first !== null && last !== null && first > last) invalid('סדר התאריכים בכרטיסייה אינו תקין.');
      if (due !== null && (due > DEADLINE || last !== null && due <= last)) invalid('החזרה הבאה חייבת להיות אחרי הקודמת ועד 7.10 בשעה 20:00.');
      if (own(review, 'history')) {
        if (!Array.isArray(review.history) || review.history.length > 100) invalid('היסטוריית הכרטיסייה אינה תקינה.');
        let preceding = null;
        for (const item of review.history) {
          record(item, 'רישום חזרה');
          if (!RATINGS.includes(item.rating)) invalid('דירוג החזרה אינו נתמך.');
          const at = timestamp(item.at, 'מועד חזרה');
          if (preceding !== null && at < preceding || last !== null && at > last) invalid('היסטוריית החזרות אינה מסודרת לפי זמן.');
          preceding = at;
        }
      }
    }
  }
  function validateState(value) {
    record(value, 'קובץ התקדמות');
    for (const key of Object.keys(defaultState())) if (!own(value, key)) invalid('בקובץ ההתקדמות חסרים שדות נדרשים.');
    if (value.schemaVersion !== 1) throw failure('גרסת קובץ ההתקדמות אינה נתמכת.', 400, 'unsupported_schema');
    if (!integer(value.revision)) invalid('מספר גרסת השמירה אינו תקין.');
    let remaining = 50000;
    function visit(item, depth = 0) {
      if (--remaining < 0 || depth > 16) invalid('קובץ ההתקדמות מורכב מדי.');
      if (item === null || typeof item === 'boolean') return;
      if (typeof item === 'number') {if (!Number.isFinite(item)) invalid('קובץ ההתקדמות מכיל מספר לא תקין.'); return;}
      if (typeof item === 'string') {if (item.length > 100000) invalid('אחד משדות הטקסט ארוך מדי.'); return;}
      if (!item || typeof item !== 'object') invalid('קובץ ההתקדמות מכיל נתון שאינו נתמך.');
      if (Array.isArray(item)) {for (const child of item) visit(child, depth + 1); return;}
      for (const [key, child] of Object.entries(item)) {
        if (key.length > 256 || BAD_KEYS.has(key)) invalid('בקובץ ההתקדמות יש שם שדה שאינו מותר.');
        visit(child, depth + 1);
      }
    }
    visit(value);
    if (own(value, 'learning')) {
      if (!learning) invalid('אימות רישומי הלימוד אינו זמין. יש לרענן את האתר ולנסות שוב.');
      try {learning.validateLearning(value.learning);} catch (error) {invalid(error.message);}
    }
    for (const key of ['sessionUpdates', 'problemProgress', 'dayOverrides', 'settings']) record(value[key], key);
    if (!Array.isArray(value.journal)) invalid('יומן ההתקדמות חייב להיות רשימה.');
    for (const [id, update] of Object.entries(value.sessionUpdates)) {
      identifier(id, 'יחידה'); session(update);
      if (own(update, 'id') && update.id !== id) invalid('אי אפשר לשנות מזהה של יחידה קיימת.');
    }
    for (const [id, progress] of Object.entries(value.problemProgress)) {
      identifier(id, 'שאלה'); record(progress, 'התקדמות בשאלה');
      fields(progress, ['evidence', 'updatedAt'], ['independentConfirmed']);
      const status = own(progress, 'status') ? progress.status : 'unseen';
      if (!PROBLEM_STATUSES.includes(status)) invalid('מצב השאלה אינו נתמך.');
      if (own(progress, 'date')) date(progress.date, 'תאריך התרגול');
      minutes(progress, 'minutes', 1, true);
      if (own(progress, 'obstacle') && !['', 'knowledge', 'memory', 'notation', 'model', 'calculation', 'time'].includes(progress.obstacle)) invalid('סוג הקושי אינו נתמך.');
      if (['independent', 'timed'].includes(status) && (progress.independentConfirmed !== true || (progress.evidence || '').trim().length < 8)) invalid('תיעוד פתרון עצמאי דורש אישור ותיאור קצר של בדיקת הפתרון.');
      if (status === 'timed' && !progress.minutes) invalid('פתרון בזמן דורש את משך התרגול שנמדד.');
    }
    for (const [day, availability] of Object.entries(value.dayOverrides)) {
      date(day, 'תאריך זמינות', true); record(availability, 'זמינות');
      fields(availability, ['label', 'kind', 'energy'], ['confirmedOptional', 'confirmedConditional']);
      for (const key of ['capacityMinutes', 'optionalMinutes', 'conditionalMinutes', 'reserveMinutes']) minutes(availability, key);
      if (own(availability, 'notes') && typeof availability.notes !== 'string') fields(availability, [], [], ['notes']);
    }
    for (const entry of value.journal) {
      record(entry, 'רישום ביומן'); fields(entry, ['title', 'text', 'note', 'at']);
      if (own(entry, 'date')) date(entry.date, 'תאריך היומן');
    }
    const settings = value.settings;
    if (own(settings, 'activeDate')) date(settings.activeDate, 'תאריך העבודה', true);
    if (own(settings, 'theme') && !['dark', 'light'].includes(settings.theme)) invalid('ערכת הנושא אינה נתמכת.');
    fields(settings, ['fallbackApplied']);
    if (own(settings, 'flashcards')) flashcards(settings.flashcards);
    if (own(settings, 'customSessions')) {
      if (!Array.isArray(settings.customSessions)) invalid('יחידות נוספות חייבות להיות רשימה.');
      const ids = new Set();
      for (const item of settings.customSessions) {
        session(item, true);
        if (ids.has(item.id)) invalid('יש שתי יחידות עם אותו מזהה.');
        ids.add(item.id);
      }
    }
    const encoded = JSON.stringify(value);
    if (new TextEncoder().encode(encoded).length > MAX_BYTES) throw failure('קובץ ההתקדמות גדול מהמותר (1 MB).', 413, 'too_large');
    return JSON.parse(encoded);
  }
  function createStorage(environment, configuration = {}) {
    const mode = configuration.mode === 'static' ? 'static' : 'local';
    const key = configuration.storageKey || 'matzpen:22902:2026-s3:progress:v1';
    let serial = Promise.resolve();
    async function request(url, options = {}) {
      let response;
      try {response = await environment.fetch(url, options);} catch (error) {
        throw failure(mode === 'local' ? 'לא ניתן להגיע לשרת המקומי. ההתקדמות לא הוחלפה.' : 'לא ניתן לטעון את הקובץ. בדוק את החיבור ונסה שוב.', 503, 'network_error');
      }
      let result;
      try {result = await response.json();} catch (error) {throw failure('התקבלה תשובה שאינה קובץ נתונים תקין.', response.status || 502, 'invalid_response');}
      if (!response.ok) throw failure(result.error || 'לא ניתן להשלים את הבקשה.', response.status, result.code || 'request_failed');
      return result;
    }
    function localStorage() {
      try {
        if (!environment.localStorage) throw new Error('unavailable');
        return environment.localStorage;
      } catch (error) {throw failure('הדפדפן אינו מאפשר שמירה מקומית. יש לאפשר אחסון לאתר לפני תיעוד התקדמות.', 503, 'storage_unavailable');}
    }
    function readEnvelope() {
      let raw;
      try {raw = localStorage().getItem(key);} catch (error) {
        if (typeof error.code === 'string') throw error;
        throw failure('לא ניתן לקרוא את ההתקדמות השמורה בדפדפן.', 503, 'storage_unavailable');
      }
      if (raw === null) return {formatVersion: 1, state: defaultState(), backups: []};
      try {
        const envelope = JSON.parse(raw);
        if (!envelope || envelope.formatVersion !== 1 || !Array.isArray(envelope.backups) || envelope.backups.length > 10) throw new Error('envelope');
        envelope.state = validateState(envelope.state);
        // Retain historical copies exactly; never silently discard a recovery copy.
        for (const backup of envelope.backups) validateState(backup);
        return envelope;
      } catch (error) {
        throw failure('ההתקדמות השמורה אינה ניתנת לקריאה. הנתונים לא נמחקו ולא הוחלפו; אפשר לשחזר מקובץ גיבוי.', 500, 'stored_state_unreadable');
      }
    }
    function staticSave(value, expectedRevision) {
      const state = validateState(value);
      if (!integer(expectedRevision)) throw failure('מספר גרסת השמירה אינו תקין.', 400, 'invalid_revision');
      const envelope = readEnvelope();
      if (envelope.state.revision !== expectedRevision) throw failure('ההתקדמות השתנתה בלשונית אחרת. רענן את הדף לפני השמירה כדי לשמור גם את השינויים שלה.', 409, 'revision_conflict');
      state.revision = expectedRevision + 1;
      const next = {formatVersion: 1, state, backups: envelope.state.revision === 0 ? envelope.backups : [...envelope.backups, envelope.state].slice(-10)};
      try {localStorage().setItem(key, JSON.stringify(next));} catch (error) {
        if (typeof error.code === 'string') throw error;
        throw failure('אין אפשרות לשמור בדפדפן. ההתקדמות הקודמת נשמרה; יצא גיבוי לפני סגירת הלשונית.', 507, 'save_failed');
      }
      return clone(state);
    }
    async function mutate(value, expectedRevision, endpoint) {
      if (mode === 'local') {
        const body = JSON.stringify({state: value, expectedRevision});
        const result = serial.catch(() => {}).then(() => request(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'}, body}));
        serial = result;
        return result;
      }
      // Snapshot before waiting: later UI edits cannot leak into this save operation.
      const snapshot = validateState(value);
      const action = () => staticSave(snapshot, expectedRevision);
      const work = () => environment.navigator && environment.navigator.locks && typeof environment.navigator.locks.request === 'function'
        ? environment.navigator.locks.request(key + ':write', {mode: 'exclusive'}, action) : action();
      const result = serial.catch(() => {}).then(work);
      serial = result;
      return result;
    }
    async function bootstrap() {
      if (mode === 'local') return request('/api/bootstrap', {cache: 'no-store'});
      const [curriculum, schedule, flashcards] = await Promise.all([
        request('./data/curriculum.json', {cache: 'no-store'}),
        request('./data/schedule.json', {cache: 'no-store'}),
        request('./data/flashcards.json', {cache: 'no-store'}).catch(error => {if (error.status === 404) return {cards: []}; throw error;})
      ]);
      return {curriculum, schedule, flashcards, state: readEnvelope().state};
    }
    async function exportState() {
      await serial.catch(() => {});
      return mode === 'local' ? request('/api/export', {cache: 'no-store'}) : clone(readEnvelope().state);
    }
    async function downloadExport() {
      const state = await exportState();
      const blob = new environment.Blob([JSON.stringify(state, null, 2) + '\n'], {type: 'application/json;charset=utf-8'});
      const url = environment.URL.createObjectURL(blob);
      const anchor = environment.document.createElement('a');
      anchor.href = url; anchor.download = 'study-progress.json';
      environment.document.body.append(anchor); anchor.click(); anchor.remove();
      environment.setTimeout(() => environment.URL.revokeObjectURL(url), 1000);
      return state;
    }
    function sourceUrl(source, page = 1) {
      const path = (typeof source === 'string' ? source : source && source.path || '').replace(/\\/g, '/');
      if (!path || path.startsWith('/') || path.includes(':') || path.split('/').some(part => part === '..' || part.startsWith('.'))) throw failure('נתיב המקור אינו תקין.', 400, 'invalid_source');
      const parsedPage = Math.floor(Number(page));
      const pageNumber = Number.isFinite(parsedPage) ? Math.max(1, parsedPage || 1) : 1;
      return mode === 'static' ? `./source.html?file=${encodeURIComponent(path)}#page=${pageNumber}` : '/sources/' + path.split('/').map(encodeURIComponent).join('/') + '#page=' + pageNumber;
    }
    return Object.freeze({
      mode, storageKey: key, bootstrap, exportState, downloadExport, sourceUrl, validateState,
      save: (value, expectedRevision) => mutate(value, expectedRevision, '/api/state'),
      importState: (value, expectedRevision) => mutate(value, expectedRevision, '/api/import'),
      backups: async () => mode === 'static' ? clone(readEnvelope().backups) : []
    });
  }
  return Object.freeze({createStorage, validateState, defaultState});
});
