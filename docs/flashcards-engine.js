/* Short-horizon recall scheduling. Pure functions: no clock, storage or DOM access. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FlashcardsEngine = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const DAY = 86400000;
  const ZONE = 'Asia/Jerusalem';
  const DEFAULT_EXAM = '2026-10-08';
  const RATINGS = ['again', 'hard', 'good'];
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  function instant(value) {
    const result = Date.parse(value);
    if (!Number.isFinite(result)) throw new TypeError('A valid timestamp is required.');
    return result;
  }
  function parts(formatter, value) {
    return Object.fromEntries(formatter.formatToParts(new Date(value)).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  }
  function dayKey(value) {
    const p = parts(dateFormatter, instant(value));
    return `${p.year}-${p.month}-${p.day}`;
  }
  function localInstant(day, hour) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) !== day) {
      throw new TypeError('Exam date must be a real YYYY-MM-DD date.');
    }
    const [y, m, d] = day.split('-').map(Number);
    const desired = Date.UTC(y, m - 1, d, hour);
    let guess = desired;
    // Convert a known, unambiguous afternoon wall time using the actual IANA offset.
    for (let i = 0; i < 3; i++) {
      const p = parts(timeFormatter, guess);
      const represented = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
      guess += desired - represented;
    }
    return guess;
  }
  function deadlineAt(examDateISO = DEFAULT_EXAM) {
    localInstant(examDateISO, 16); // Validate before doing calendar arithmetic.
    const previousDay = new Date(Date.parse(examDateISO + 'T00:00:00Z') - DAY).toISOString().slice(0, 10);
    return new Date(localInstant(previousDay, 20)).toISOString();
  }
  function blockedReasons(card, sessionUpdates = {}) {
    const requirements = Array.isArray(card.unlockAfter) ? card.unlockAfter : [];
    return requirements.filter(id => !sessionUpdates[id] || sessionUpdates[id].learned !== true);
  }
  function unlocked(card, sessionUpdates = {}) {
    // A missing gate is a content authoring error, never permission to quiz new material.
    return Array.isArray(card.unlockAfter) && card.unlockAfter.length > 0 && blockedReasons(card, sessionUpdates).length === 0;
  }
  function number(value, fallback = 0) {
    return Number.isInteger(value) && value >= 0 ? value : fallback;
  }
  function reviewed(record) {
    return Boolean(record && number(record.reviews) > 0 && record.lastReviewedAt);
  }
  function scheduleReview(previous, rating, nowISO, examDateISO = DEFAULT_EXAM) {
    if (!RATINGS.includes(rating)) throw new TypeError('Rating must be again, hard or good.');
    const now = instant(nowISO);
    const at = new Date(now).toISOString();
    const previousRecord = previous || {};
    const oldStage = Math.min(number(previousRecord.stage), 3);
    const stage = rating === 'again' ? 0 : rating === 'good' ? Math.min(oldStage + 1, 3) : oldStage;
    let delay = rating === 'again' ? 10 * 60000 : rating === 'hard' ? 6 * 3600000 : [DAY, 2 * DAY, 4 * DAY, 4 * DAY][oldStage];
    const daysLeft = Math.round((Date.parse(examDateISO + 'T00:00:00Z') - Date.parse(dayKey(at) + 'T00:00:00Z')) / DAY);
    if (daysLeft <= 7) delay = Math.min(delay, 2 * DAY);
    if (daysLeft <= 3) delay = Math.min(delay, DAY);
    const deadline = instant(deadlineAt(examDateISO));
    const horizonEnded = now >= deadline;
    const capped = !horizonEnded && now + delay > deadline;
    const history = (Array.isArray(previousRecord.history) ? previousRecord.history : []).filter(item => item && RATINGS.includes(item.rating) && Number.isFinite(Date.parse(item.at)));
    const firstReviewedAt = previousRecord.firstReviewedAt || (history[0] && history[0].at) || previousRecord.lastReviewedAt || at;
    return {
      dueAt: horizonEnded ? null : new Date(Math.min(now + delay, deadline)).toISOString(),
      lastReviewedAt: at,
      firstReviewedAt,
      stage,
      streak: rating === 'good' ? number(previousRecord.streak) + 1 : 0,
      lapses: number(previousRecord.lapses) + (rating === 'again' ? 1 : 0),
      reviews: number(previousRecord.reviews) + 1,
      lastRating: rating,
      finalReview: capped,
      reason: horizonEnded ? 'finished-horizon' : capped ? 'final-review' : 'scheduled',
      history: [...history, {at, rating}].slice(-100)
    };
  }
  function newToday(progress, nowISO) {
    const today = dayKey(nowISO);
    return Object.values(progress || {}).filter(record => {
      if (!reviewed(record)) return false;
      const first = record.firstReviewedAt || (record.history && record.history[0] && record.history[0].at) || record.lastReviewedAt;
      return Number.isFinite(Date.parse(first)) && dayKey(first) === today;
    }).length;
  }
  function dailyLimit(options = {}) {
    return Math.max(1, Math.min(20, number(options.dailyLimit, 6)));
  }
  function priority(card) {
    if (card.priority === 'core' || card.priority === 'high' || card.core === true) return 0;
    return card.priority === 'support' ? 2 : 1;
  }
  function dueCards(cards, progress = {}, sessionUpdates = {}, nowISO, options = {}) {
    const now = instant(nowISO);
    // At the final due time, previously scheduled reviews must still be usable.
    // Stop introducing cards, and let scheduleReview retire each final review.
    const horizonEnded = now >= instant(deadlineAt(options.examDateISO || DEFAULT_EXAM));
    const available = cards.filter(card => unlocked(card, sessionUpdates));
    const due = available.filter(card => {
      const record = progress[card.id];
      return reviewed(record) && record.dueAt && Number.isFinite(Date.parse(record.dueAt)) && instant(record.dueAt) <= now;
    }).sort((a, b) => number(progress[b.id].lapses) - number(progress[a.id].lapses) ||
      instant(progress[a.id].dueAt) - instant(progress[b.id].dueAt) || priority(a) - priority(b) || a.id.localeCompare(b.id));
    const newLimit = horizonEnded ? 0 : Math.max(0, dailyLimit(options) - newToday(progress, nowISO));
    const fresh = available.filter(card => !reviewed(progress[card.id]))
      .sort((a, b) => priority(a) - priority(b) || number(a.order, 999) - number(b.order, 999) || a.id.localeCompare(b.id))
      .slice(0, newLimit);
    return [...due, ...fresh];
  }
  function summary(cards, progress = {}, sessionUpdates = {}, nowISO, options = {}) {
    const now = instant(nowISO);
    const today = dayKey(nowISO);
    const available = cards.filter(card => unlocked(card, sessionUpdates));
    const fresh = available.filter(card => !reviewed(progress[card.id]));
    const newCount = newToday(progress, nowISO);
    const deadline = deadlineAt(options.examDateISO || DEFAULT_EXAM);
    const horizonEnded = now >= instant(deadline);
    const remainingDays = horizonEnded ? 0 : Math.max(1, Math.round((Date.parse(dayKey(deadline) + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / DAY) + 1);
    return {
      total: cards.length,
      unlocked: available.length,
      locked: cards.length - available.length,
      newAvailable: fresh.length,
      newUnseen: fresh.length,
      suggestedDailyNew: Math.min(12, Math.max(6, Math.ceil(fresh.length / Math.max(1, remainingDays)))),
      remainingDays,
      newRemainingToday: horizonEnded ? 0 : Math.max(0, dailyLimit(options) - newCount),
      dueReviews: available.filter(card => reviewed(progress[card.id]) && progress[card.id].dueAt && instant(progress[card.id].dueAt) <= now).length,
      reviewedToday: cards.filter(card => reviewed(progress[card.id]) && dayKey(progress[card.id].lastReviewedAt) === today).length,
      newToday: newCount,
      queueSize: dueCards(cards, progress, sessionUpdates, nowISO, options).length,
      deadlineAt: deadline,
      horizonEnded
    };
  }
  return Object.freeze({unlocked, blockedReasons, dueCards, scheduleReview, dueNext: scheduleReview, summary, dayKey, deadlineAt});
});
