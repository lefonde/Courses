/* Synthetic, ephemeral examples. Never derived from the user's saved progress. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StudyRecommendationDemos = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  function create(id, schedule, curriculum) {
    if (!['prerequisite', 'review', 'difficulty', 'moved'].includes(id)) throw new Error('דוגמה לא מוכרת.');
    const state = {schemaVersion: 1, revision: 0, sessionUpdates: {}, problemProgress: {}, dayOverrides: {}, journal: [], settings: {}, learning: {version: 1, attempts: [], checkpoints: {}}};
    const update = (sid, values) => {state.sessionUpdates[sid] = {...state.sessionUpdates[sid], ...values};};
    const meeting = (eventId, at, outcome) => {
      const event = {id: eventId, sessionId: 'permutation-indicators', problemId: 'm12-q1', at, disposition: 'continue', outcome, help: 'none', obstacle: 'method', continuation: 'לחזור לחישוב ההסתברות המשותפת של שני אינדיקטורים.', note: '', evidence: '', minutes: 20, independentConfirmed: false};
      state.learning.attempts.push(event);
      state.learning.checkpoints[event.sessionId] = {attemptId: event.id, at: event.at, continuation: event.continuation, disposition: event.disposition};
    };
    if (id === 'prerequisite') {
      for (const s of schedule.sessions.filter(s => s.date < '2026-09-25')) update(s.id, {status: 'completed'});
      update('foundations-variance', {learned: false});
      return {state, now: '2026-09-25T06:55:00+03:00', label: 'תנאי קדם: המשימה סומנה כבוצעה, אבל החומר לא סומן כנלמד'};
    }
    const hostId = id === 'difficulty' ? 'tails-repair' : 'spaced-tails';
    const host = schedule.sessions.find(s => s.id === hostId);
    for (const s of schedule.sessions) {
      if (s.date < host.date || s.date === host.date && (s.start || '') < host.start) update(s.id, {status: 'completed', learned: true});
    }
    update('permutation-indicators', {learned: true});
    meeting('demo-attempt-1', '2026-09-23T08:00:00+03:00', 'stuck');
    if (id === 'difficulty') {
      meeting('demo-attempt-2', '2026-09-24T08:00:00+03:00', 'partial');
      return {state, now: `${host.date}T14:10:00+03:00`, label: 'קושי חוזר: שני ניסיונות מתועדים באותה שאלה'};
    }
    const reviewHost = schedule.sessions.find(s => s.id === 'spaced-tails');
    const dueAt = `${reviewHost.date}T${reviewHost.start}:00+03:00`, createdAt = '2026-10-02T08:00:00+03:00';
    // Use a question that belongs to this host, with its own learned gate and attempt.
    state.learning = {version: 1, attempts: [], checkpoints: {}};
    state.problemProgress['m12-q2'] = {status: 'guided', updatedAt: '2026-10-02T08:00:00+03:00'};
    update('tails-pairwise', {learned: true});
    state.settings.questionReviews = {version: 1, entries: [{id: 'demo-review', problemId: 'm12-q2', target: 'לשחזר את המעבר מהעומס בתא יחיד לחסם על כל התאים.', createdAt, dueAt, sessionId: reviewHost.id, status: 'planned', outcome: null, help: null, note: '', updatedAt: createdAt, history: []}]};
    if (id === 'moved') update(reviewHost.id, {start: '07:15'});
    return {state, now: `${reviewHost.date}T${id === 'moved' ? '07:15' : reviewHost.start}:00+03:00`, label: id === 'moved' ? 'שיבוץ שדורש בדיקה: שעת המשימה השתנתה אחרי אישור החזרה' : 'חזרה מאושרת: עשר דקות שכבר נכללות במפגש הבא'};
  }
  return {create};
});
