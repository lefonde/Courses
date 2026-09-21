/* One explainable next action. No clock reads, DOM, persistence, or schedule mutation. */
(function (root, factory) {
  const content = typeof module === 'object' && module.exports ? require('./review-content.js') : root.StudyReviewContent;
  const api = factory(content);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StudyRecommendationEngine = api;
})(typeof window === 'undefined' ? globalThis : window, function (content) {
  'use strict';
  const list = value => Array.isArray(value) ? value : [];
  const stamp = value => typeof value === 'string' ? Date.parse(value) : NaN;
  const clock = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : NaN;
  const sessions = (schedule, state) => [...list(schedule.sessions), ...list(state.settings?.customSessions)].map(s => ({...s, ...(state.sessionUpdates?.[s.id] || {})}));
  const dayOf = (date, schedule, state) => ({...list(schedule.days).find(d => d.date === date), ...(state.dayOverrides?.[date] || {}), date});
  const committed = (s, schedule, state) => !s.conditional || dayOf(s.date, schedule, state).confirmedOptional === true;
  const startOf = s => Number.isFinite(clock(s?.start)) && /^\d{4}-\d{2}-\d{2}$/.test(s?.date || '') ? stamp(`${s.date}T${s.start}:00+03:00`) : NaN;
  const compare = (a, b) => String(a.date).localeCompare(String(b.date)) || String(a.start || '23:59').localeCompare(String(b.start || '23:59')) || String(a.id).localeCompare(String(b.id));
  const displayDate = value => new Intl.DateTimeFormat('he-IL', {timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).format(new Date(value));
  const israelDay = value => new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(value));
  const learned = (id, state) => state.sessionUpdates?.[id]?.learned === true;
  const official = p => !p.optional && /^(?:m\d+-q\d+|sample-q\d+)$/.test(p.id);
  function reservedMinutes(sessionId, schedule, state) {
    const all = sessions(schedule, state), s = all.find(s => s.id === sessionId);
    if (!s) return {cards: 0, mixed: 0, reviews: 0, total: 0};
    const day = dayOf(s.date, schedule, state);
    const candidates = all.filter(x => x.date === s.date && !x.disabled && committed(x, schedule, state) && !['setup', 'mock'].includes(x.kind)).sort(compare);
    const cards = ['setup', 'mock'].includes(s.kind) || s.date === schedule.exam?.date || candidates.at(-1)?.id !== s.id ? 0 : Math.min(s.minutes, day.kind === 'deep' ? 10 : 5);
    const mixed = list(state.settings?.mixedPractice?.rounds).filter(r => r.budgetSessionId === sessionId).length * 10;
    const reviews = list(state.settings?.questionReviews?.entries).filter(r => r.sessionId === sessionId && r.status !== 'cancelled').length * 10;
    return {cards, mixed, reviews, total: cards + mixed + reviews};
  }
  function sessionIssues(s, schedule, state) {
    const reasons = [];
    if (!s) return ['המשימה שאליה הוקצה הזמן אינה נמצאת בתוכנית.'];
    if (s.disabled) reasons.push('המשימה שאליה הוקצה הזמן הושבתה.');
    if (s.status === 'completed') reasons.push('המשימה שאליה הוקצה הזמן כבר סומנה כבוצעה.');
    if (!committed(s, schedule, state)) reasons.push('חלון הלימוד של המשימה עדיין לא אושר.');
    const begin = clock(s.start), end = begin + s.minutes, day = dayOf(s.date, schedule, state);
    if (!Number.isFinite(startOf(s)) || !Number.isInteger(s.minutes) || s.minutes <= 0) reasons.push('למשימה חסרים מועד או משך תקינים.');
    else {
      const windows = list(day.windows).filter(w => !w.conditional || day.confirmedOptional === true);
      if (!windows.some(w => begin >= clock(w.start) && end <= clock(w.end))) reasons.push('המשימה אינה נכנסת בחלון לימוד מאושר ביום הזה.');
      const sameDay = sessions(schedule, state).filter(x => x.date === s.date && !x.disabled && committed(x, schedule, state));
      if (sameDay.some(x => x.id !== s.id && Number.isFinite(clock(x.start)) && begin < clock(x.start) + x.minutes && end > clock(x.start))) reasons.push('המשימה חופפת למשימה אחרת בתוכנית.');
      const capacity = Number(day.capacityMinutes || 0) + (day.confirmedOptional === true ? Number(day.optionalMinutes || 0) + Number(day.conditionalMinutes || 0) : 0);
      if (sameDay.reduce((n, x) => n + Number(x.minutes || 0), 0) > capacity) reasons.push('סך המשימות ביום הזה חורג מהזמן הזמין שנקבע.');
    }
    if (reservedMinutes(s.id, schedule, state).total > s.minutes) reasons.push('הכרטיסיות, התרגול המעורב והחזרות יחד חורגים מזמן המשימה.');
    return reasons;
  }
  function reviewIssues(review, schedule, state) {
    const s = sessions(schedule, state).find(s => s.id === review.sessionId), reasons = sessionIssues(s, schedule, state);
    if (s && Number.isFinite(startOf(s)) && stamp(review.dueAt) !== startOf(s)) reasons.push('מועד המשימה השתנה מאז שיבוץ החזרה; צריך לבחור מחדש את מועד החזרה.');
    if (!['practice', 'review'].includes(s?.kind)) reasons.push('החזרה צריכה להיות משובצת בתוך משימת תרגול או חזרה.');
    return reasons;
  }
  function problemAttempts(id, state, now) {
    return list(state.learning?.attempts).map((event, index) => ({...event, index})).filter(a => a.problemId === id && ['stuck', 'partial', 'solved'].includes(a.outcome) && Number.isFinite(stamp(a.at)) && stamp(a.at) <= now).sort((a, b) => stamp(b.at) - stamp(a.at) || b.index - a.index);
  }
  function attempted(id, state, now) {
    const old = state.problemProgress?.[id];
    return problemAttempts(id, state, now).length > 0 || !!(old && ['guided', 'independent', 'timed'].includes(old.status) && (!old.updatedAt || stamp(old.updatedAt) <= now));
  }
  function gates(id, state) {
    const item = content?.items?.find(x => x.problemId === id);
    return !!item && item.unlockAfter.every(id => learned(id, state));
  }
  function dependencyReady(s, state) {
    return !!s && (['setup', 'mock', 'review'].includes(s.kind) ? s.status === 'completed' : learned(s.id, state));
  }
  function missingPrerequisite(s, all, state, visited = new Set()) {
    if (visited.has(s.id)) return {missing: null, blocked: 'בתנאי הקדם יש מעגל תלות שדורש בדיקת תכנון.'};
    visited = new Set(visited).add(s.id);
    for (const id of list(s.dependsOn)) {
      const dep = all.find(x => x.id === id);
      if (!dep) return {missing: null, blocked: 'תנאי קדם של המשימה חסר בתוכנית.'};
      if (!dependencyReady(dep, state)) {
        const prior = missingPrerequisite(dep, all, state, visited);
        if (prior.blocked || prior.missing) return prior;
        return {missing: dep, blocked: null};
      }
    }
    return {missing: null, blocked: null};
  }
  function propose(input) {
    const {curriculum, schedule, state, now, availableMinutes, focus = 'focused', context = 'planned'} = input;
    if (!curriculum || !schedule || !state || !Number.isFinite(stamp(now)) || !/(?:Z|[+-]\d\d:\d\d)$/.test(now || '')) throw new Error('נדרשים נתוני תוכנית ומועד נוכחי הכולל אזור זמן.');
    if (!Number.isInteger(availableMinutes) || availableMinutes < 5 || availableMinutes > 300) throw new Error('הזמן הזמין צריך להיות בין 5 ל־300 דקות.');
    if (!['focused', 'light'].includes(focus) || !['planned', 'now'].includes(context)) throw new Error('אפשרות הזמן או הריכוז אינה נתמכת.');
    const time = stamp(now), today = israelDay(time), all = sessions(schedule, state).sort(compare);
    const pending = all.filter(s => !s.disabled && s.status !== 'completed' && committed(s, schedule, state));
    const problems = list(curriculum.problems).filter(official);
    let host = context === 'planned' ? pending.find(s => Number.isFinite(startOf(s)) && startOf(s) + s.minutes * 60000 > time) : null;
    const effectiveAt = context === 'planned' && host ? Math.max(time, startOf(host)) : time;
    const budget = context === 'planned' && host ? Math.min(availableMinutes, Math.floor((startOf(host) + host.minutes * 60000 - effectiveAt) / 60000)) : availableMinutes;
    const base = {context, plannedAt: context === 'planned' && host ? new Date(effectiveAt).toISOString() : null, budgetSessionId: host?.id || null, availableMinutes: budget, notices: []};
    const result = (kind, title, reason, evidence = [], extra = {}) => ({...base, kind, title, reason, evidence, sessionId: null, problemId: null, reviewId: null, minutes: null, actionLabel: 'צפייה בתוכנית', ...extra});
    if (time >= stamp(`${schedule.exam?.date || '2026-10-08'}T${schedule.exam?.start || '16:00'}:00+03:00`)) return result('finished', 'תקופת ההכנה לבחינה הסתיימה', 'אין המלצה למשימת הכנה אחרי תחילת הבחינה. סימון זה אינו הערכה של שליטה בחומר.');
    const underway = host?.status === 'in-progress' ? host : context === 'now' ? pending.find(s => s.status === 'in-progress') : null;
    const due = list(state.settings?.questionReviews?.entries).filter(r => r.status === 'planned' && stamp(r.dueAt) <= effectiveAt).sort((a, b) => stamp(a.dueAt) - stamp(b.dueAt) || a.id.localeCompare(b.id));
    // A due reservation can need repair even when every task was marked done.
    for (const review of due) {
      if (underway && review.sessionId !== underway.id) continue;
      const issues = reviewIssues(review, schedule, state);
      if (!gates(review.problemId, state) || !attempted(review.problemId, state, time)) issues.push('חזרה זו דורשת חומר שסומן כנלמד וניסיון קודם בשאלת המקור.');
      if (issues.length) return result('no-fit', 'צריך לבדוק חזרה שהגיעה זמנה', 'החזרה נשמרה, אבל תנאי השיבוץ או החומר השתנו. היא אינה מוצגת כפעולה מוכנה.', issues, {sessionId: review.sessionId, problemId: review.problemId, reviewId: review.id, actionLabel: 'בדיקת שיבוץ החזרה'});
    }
    if (!pending.length) return result('finished', 'אין משימה פתוחה בתוכנית המאושרת', 'כל המשימות המאושרות סומנו כבוצעות או הוסרו מהתוכנית. מצב זה אינו מוכיח שהשאלות נפתרו באופן עצמאי.');
    if (context === 'planned' && !host) return result('no-fit', 'צריך לבחור מועד לימוד חדש', 'נותרו משימות פתוחות, אבל אין להן חלון מאושר שטרם הסתיים.', ['חלונות מותנים אינם נספרים עד לאישור הזמינות.'], {sessionId: pending[0]?.id || null, actionLabel: 'בדיקת המשימה הפתוחה'});
    if (host) {
      const issues = sessionIssues(host, schedule, state);
      if (issues.length) return result('no-fit', 'צריך לבדוק את מועד המפגש הבא', 'השיבוץ הקיים אינו מאפשר הצעה שאפשר להסתמך עליה.', issues, {sessionId: host.id, actionLabel: 'בדיקת השיבוץ'});
    }
    const allowedTask = s => !s.disabled && committed(s, schedule, state) && (focus === 'focused' || ['setup', 'review'].includes(s.kind));
    const fit = s => {
      const replacing = host && host.id !== s.id;
      const hostReserved = replacing ? reservedMinutes(host.id, schedule, state).total : 0;
      // Keep one card period while preserving all mixed and approved review time.
      const ownCards = replacing ? Math.min(reservedMinutes(s.id, schedule, state).cards, reservedMinutes(host.id, schedule, state).cards) : 0;
      return Number.isInteger(s.minutes) && s.minutes > 0 && s.minutes - ownCards <= budget - hostReserved;
    };
    const contextEvidence = s => [context === 'planned' ? `חלון ההצעה: ${displayDate(effectiveAt)}, עד ${budget} דקות מתוך ״${host.title}״.` : `ציינת שיש לך עכשיו ${availableMinutes} דקות. הזמינות הנוספת לא נשמרה ביומן.`, ...(host && host.id !== s.id ? [...(reservedMinutes(host.id, schedule, state).total ? [`לפני הבחירה נשמרות ${reservedMinutes(host.id, schedule, state).total} דקות שכבר הוקצו לכרטיסיות, לתרגול מעורב ולחזרות.`] : []), 'זו הצעת עבודה בחלון הקיים; שום משימה אינה מועברת או מתקצרת ביומן.'] : [])];
    const taskResult = (kind, s, reason, evidence = [], problemId = null) => result(kind, s.title, reason, [...evidence, ...contextEvidence(s)], {sessionId: s.id, problemId, minutes: s.minutes, actionLabel: 'פתיחת המשימה'});
    for (const review of due) {
      if (underway && review.sessionId !== underway.id) {base.notices.push('יש חזרה שהגיעה זמנה במשימה אחרת; כדאי לבדוק אותה אחרי המפגש שכבר התחיל.'); continue;}
      const problem = problems.find(p => p.id === review.problemId);
      if (!problem) continue;
      const issues = reviewIssues(review, schedule, state);
      if (!gates(review.problemId, state) || !attempted(review.problemId, state, time)) issues.push('חזרה זו דורשת חומר שסומן כנלמד וניסיון קודם בשאלת המקור.');
      if (issues.length) return result('no-fit', 'צריך לבדוק חזרה שהגיעה זמנה', 'החזרה נשמרה, אבל תנאי השיבוץ או החומר השתנו. היא אינה מוצגת כפעולה מוכנה.', issues, {sessionId: review.sessionId, problemId: review.problemId, reviewId: review.id, actionLabel: 'בדיקת שיבוץ החזרה'});
      if (host && host.id !== review.sessionId) return result('no-fit', 'חזרה ממתינה לבחירת מועד חדש', 'מועד החזרה כבר הגיע, אבל היא מוקצית למשימה אחרת. אי אפשר להעביר את עשר הדקות בלי לבדוק את השיבוץ.', [`החזרה על ״${problem.title}״ נקבעה ל־${displayDate(stamp(review.dueAt))}.`], {sessionId: review.sessionId, problemId: review.problemId, reviewId: review.id, actionLabel: 'בדיקת שיבוץ החזרה'});
      if (budget >= 10) return result('review', `חזרה על ${problem.title}`, 'הגיעה חזרה שכבר בחרת ואישרת, על חלק משאלה שכבר ניסית.', [`מה לשחזר: ${review.target}`, `מועד החזרה שאישרת: ${displayDate(stamp(review.dueAt))}.`, 'עשר הדקות כבר מוקצות בתוך המשימה; אין כאן תוספת לזמן המתוכנן.'], {sessionId: review.sessionId, problemId: review.problemId, reviewId: review.id, minutes: 10, actionLabel: 'פתיחת החזרה'});
    }
    // Do not replace a meeting already in progress with an unrelated priority.
    if (underway) return fit(underway) && allowedTask(underway) ? taskResult('baseline', underway, 'המשימה כבר התחילה; כדאי להמשיך מנקודת העצירה שתיעדת לפני בחירת משימה אחרת.') : result('no-fit', 'המשימה שהתחלת אינה מתאימה לזמן הפנוי שבחרת', 'למשימה שהתחלת דרושים יותר זמן או ריכוז מאלה שבחרת כעת. אפשר לפתוח את פרטיה, לראות היכן עצרת ולהחליט אם להמשיך עכשיו או להזיז אותה למועד אחר.', contextEvidence(underway), {sessionId: underway.id, actionLabel: 'פתיחת נקודת ההמשך'});
    const relevant = context === 'planned' ? pending.filter(s => startOf(s) <= effectiveAt || s.id === host.id) : pending;
    const important = relevant.filter(s => list(s.problemIds).some(id => problems.some(p => p.id === id))).sort(compare);
    for (const dependent of important) {
      const found = missingPrerequisite(dependent, all, state);
      if (found.blocked) return result('no-fit', 'צריך לבדוק את תנאי הקדם', found.blocked, [], {sessionId: dependent.id, actionLabel: 'בדיקת המשימה'});
      const dep = found.missing;
      if (dep && allowedTask(dep) && fit(dep)) return taskResult('prerequisite', dep, `החומר הזה נדרש לפני ״${dependent.title}״, ועדיין לא סומן כנלמד.`, ['סיום משימה וסימון החומר כנלמד הם שני דברים נפרדים.', 'ההמלצה אינה קובעת שאינך יודע את החומר; היא מבוססת על התיעוד הקיים.']);
    }
    // A single difficult attempt never becomes a repeated-difficulty recommendation.
    for (const problem of problems) {
      const attempts = problemAttempts(problem.id, state, time), latest = attempts[0], previous = attempts[1];
      if (!latest || !previous || ![latest, previous].every(a => ['stuck', 'partial'].includes(a.outcome))) continue;
      const legacy = state.problemProgress?.[problem.id];
      if (legacy && ['guided', 'independent', 'timed'].includes(legacy.status) && stamp(legacy.updatedAt) >= stamp(latest.at) && stamp(legacy.updatedAt) <= time) continue;
      if (!gates(problem.id, state)) continue;
      const task = relevant.find(s => allowedTask(s) && list(s.problemIds).includes(problem.id) && !missingPrerequisite(s, all, state).missing && !missingPrerequisite(s, all, state).blocked && fit(s));
      const obstacleLabels = {knowledge: 'חסר ידע בנושא', memory: 'חומר שנשכח', notation: 'ניסוח או סימון לא ברורים', method: 'בחירת שיטה או בניית דרך פתרון', calculation: 'חישוב', time: 'הזמן נגמר'};
      const obstacle = obstacleLabels[latest.obstacle], continuation = typeof latest.continuation === 'string' ? latest.continuation.trim() : '';
      if (task) return taskResult('difficulty', task, `בשני הניסיונות האחרונים ב״${problem.title}״ תיעדת תקיעה או פתרון חלקי.`, [`הניסיונות נשמרו ב־${displayDate(stamp(previous.at))} וב־${displayDate(stamp(latest.at))}.`, ...(obstacle ? [`הקושי שסימנת בניסיון האחרון: ${obstacle}.`] : ['לא תועדה סיבה מוגדרת לקושי; כדאי לברר מה היה חסר לפני ניסיון נוסף.']), ...(continuation ? [`נקודת ההמשך שכתבת: ${continuation}`] : []), 'לא תועד אחריהם פתרון מלא. שני ניסיונות חלקיים אינם מוכיחים שהסיבה לקושי הייתה זהה.'], problem.id);
    }
    for (const task of relevant) {
      const prereq = missingPrerequisite(task, all, state);
      if (!allowedTask(task) || !fit(task) || prereq.missing || prereq.blocked) continue;
      const problem = problems.find(p => list(task.problemIds).includes(p.id) && !attempted(p.id, state, time) && gates(p.id, state));
      if (problem) return taskResult('official', task, `עדיין לא תועד ניסיון ב״${problem.title}״, והיא שאלת חובה בתוכנית.`, ['החומר המקדים סומן כנלמד. היעדר תיעוד אינו אומר שמעולם לא פתרת את השאלה.', 'אין כאן תחזית לשכיחות השאלה בבחינה.'], problem.id);
    }
    const baseline = (context === 'planned' ? [host] : pending).find(s => allowedTask(s) && fit(s) && !missingPrerequisite(s, all, state).missing && !missingPrerequisite(s, all, state).blocked);
    if (baseline) return taskResult('baseline', baseline, 'אין כרגע תיעוד שמצדיק שינוי סדר. ממשיכים במשימה הבאה בתוכנית הבסיס.', ['לא מסיקים שליטה ממספר לחיצות, מתאריך המשימה או מעצם השלמתה.']);
    const next = host || pending[0];
    return result('no-fit', 'אין כרגע משימה מלאה שמתאימה לזמן שבחרת', focus === 'light' ? 'בזמן של ריכוז מוגבל מוצעות רק חזרות קצרות שכבר נקבעו או משימות חזרה והתארגנות קיימות. לא נמצאה כעת משימה מתאימה.' : 'המשימה המתוכננת או תנאי הקדם שלה דורשים יותר זמן פנוי. אי אפשר להציג חלק ממנה כאילו הוא המשימה המלאה.', next ? contextEvidence(next) : [], {sessionId: next?.id || null, actionLabel: 'בדיקת המשימה המתוכננת'});
  }
  return {propose, reviewIssues, reservedMinutes};
});
