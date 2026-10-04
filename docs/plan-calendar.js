/* Course calendar. Wall times use Israel's IANA zone, including winter time. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StudyPlanCalendar = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const HISTORY_START = '2026-09-21', START = '2026-10-04', EXAM = '2026-11-23', END = EXAM;
  const ZONE = 'Asia/Jerusalem', DAY = 86400000;
  const formatter = new Intl.DateTimeFormat('en-GB', {timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'});
  const parts = value => Object.fromEntries(formatter.formatToParts(new Date(value)).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  function dateValid(day) {
    return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day + 'T00:00:00Z')) && new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) === day;
  }
  function dayKey(value) {
    const at = typeof value === 'number' ? value : Date.parse(value);
    if (!Number.isFinite(at)) throw new TypeError('A valid timestamp is required.');
    const p = parts(at); return `${p.year}-${p.month}-${p.day}`;
  }
  function localStamp(day, time = '00:00') {
    if (!dateValid(day) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new TypeError('A real date and HH:mm wall time are required.');
    const [year, month, date] = day.split('-').map(Number), [hour, minute] = time.split(':').map(Number);
    const desired = Date.UTC(year, month - 1, date, hour, minute);
    let guess = desired;
    for (let i = 0; i < 4; i++) {
      const p = parts(guess);
      const represented = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
      guess += desired - represented;
    }
    const p = parts(guess);
    if (`${p.year}-${p.month}-${p.day}` !== day || `${p.hour}:${p.minute}` !== time) throw new TypeError('This wall time does not exist in Israel.');
    return new Date(guess).toISOString();
  }
  function deadlineAt(examDate = EXAM) {
    if (!dateValid(examDate)) throw new TypeError('A real exam date is required.');
    const previous = new Date(Date.parse(examDate + 'T00:00:00Z') - DAY).toISOString().slice(0, 10);
    return localStamp(previous, '20:00');
  }
  return Object.freeze({HISTORY_START, START, EXAM, END, ZONE, DEADLINE: deadlineAt(), dateValid, dayKey, localStamp, deadlineAt});
});
