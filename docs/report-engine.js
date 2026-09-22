/* Import an external tutor's proposal. Parsing grants no learning or scheduling authority. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StudyReportEngine = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const LIMIT = 16 * 1024;
  const KEYS = ['version', 'reportId', 'sessionId', 'problemId', 'outcome', 'help', 'obstacle', 'continuation', 'note', 'evidence', 'minutes', 'claimsIndependent'];
  const PROPOSAL_KEYS = ['problemId', 'outcome', 'help', 'obstacle', 'continuation', 'note', 'evidence', 'minutes'];
  const ENUMS = {
    outcome: ['not-attempted', 'stuck', 'partial', 'solved'],
    help: ['unknown', 'none', 'hint', 'guided', 'solution'],
    obstacle: ['unknown', 'knowledge', 'memory', 'notation', 'method', 'calculation', 'time', 'none']
  };
  const BAD_KEYS = ['__proto__', 'prototype', 'constructor'];
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  function invalid(message) {
    throw Object.assign(new Error(message + ' אפשר לתקן את הדוח או למלא עדכון ידני.'), {status: 400, code: 'invalid_report'});
  }
  function record(value, label) {
    if (!value || typeof value !== 'object' || Object.prototype.toString.call(value) !== '[object Object]') invalid(`${label}: נדרש אובייקט נתונים.`);
  }
  function identifier(value, label, limit = 128) {
    if (typeof value !== 'string' || value.length > limit || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value) || BAD_KEYS.includes(value)) invalid(`${label}: מזהה לא תקין.`);
  }
  function checkContext(context) {
    record(context, 'משימת היעד');
    identifier(context.sessionId, 'משימת היעד');
    if (!Array.isArray(context.problemIds)) invalid('רשימת שאלות המקור אינה זמינה.');
    context.problemIds.forEach(id => identifier(id, 'שאלת מקור'));
  }
  function sourceText(text) {
    if (typeof text !== 'string' || !text.trim()) invalid('יש להדביק דוח מהמורה.');
    if (new TextEncoder().encode(text).length > LIMIT) invalid('הדוח גדול מדי. יש להדביק דוח קצר בגודל של עד 16 ק״ב.');
    const input = text.trim();
    try {return {json: input, value: JSON.parse(input), warnings: []};} catch (error) { /* Try the documented fenced format only. */ }
    const fences = [...input.matchAll(/^[ \t]*```[^\r\n]*$/gm)];
    const blocks = [...input.matchAll(/^[ \t]*```json[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*```[ \t]*(?=\r?\n|$)/gmi)];
    if (fences.length !== 2 || blocks.length !== 1) invalid('יש להדביק אובייקט JSON אחד או מקטע קוד יחיד המסומן json. אין להדביק כמה דוחות יחד.');
    const block = blocks[0], outside = (input.slice(0, block.index) + input.slice(block.index + block[0].length)).trim();
    // Prose may explain a report, but another object outside it is ambiguous.
    if (outside.includes('{') || outside.includes('}')) invalid('נמצא תוכן דמוי דוח נוסף מחוץ למקטע. יש להדביק רק דוח אחד.');
    let value;
    try {value = JSON.parse(block[1]);} catch (error) {invalid('מקטע ה־JSON אינו תקין.');}
    return {json: block[1], value, warnings: outside ? ['הטקסט שמחוץ למקטע ה־JSON לא ייובא. יש לבדוק שכל הפרטים החשובים מופיעים בעדכון.'] : []};
  }
  function uniqueTopKeys(json) {
    // JSON.parse keeps the last duplicate key. Reject that ambiguity explicitly.
    let depth = 0;
    const seen = new Set();
    for (let index = 0; index < json.length; index++) {
      const char = json[index];
      if (char === '{' || char === '[') {depth++; continue;}
      if (char === '}' || char === ']') {depth--; continue;}
      if (char !== '"') continue;
      const start = index++;
      for (; index < json.length; index++) {
        if (json[index] === '\\') {index++; continue;}
        if (json[index] === '"') break;
      }
      let next = index + 1;
      while (/\s/.test(json[next] || '') && next < json.length) next++;
      if (depth !== 1 || json[next] !== ':') continue;
      const key = JSON.parse(json.slice(start, index + 1));
      if (seen.has(key)) invalid(`השדה ${key} מופיע יותר מפעם אחת בדוח.`);
      seen.add(key);
    }
  }
  function parse(text, context) {
    checkContext(context);
    const {json, value, warnings} = sourceText(text);
    record(value, 'דוח המורה');
    uniqueTopKeys(json);
    const fields = Object.keys(value);
    if (fields.some(key => BAD_KEYS.includes(key))) invalid('הדוח מכיל שם שדה שאינו מותר.');
    if (fields.length !== KEYS.length || KEYS.some(key => !own(value, key))) invalid('בדוח חסרים שדות נדרשים או שנוספו שדות שאינם חלק מהתבנית. יש לבקש מהמורה להשתמש בתבנית שבבקשה.');
    if (value.version !== 1) invalid('גרסת דוח המורה אינה נתמכת.');
    identifier(value.reportId, 'דוח', 100);
    identifier(value.sessionId, 'משימה');
    if (value.sessionId !== context.sessionId) invalid('הדוח שייך למשימה אחרת. יש לפתוח את המשימה המתאימה או לבקש מהמורה דוח למשימה הזאת.');
    if (value.problemId !== null) {
      identifier(value.problemId, 'שאלה');
      if (!context.problemIds.includes(value.problemId)) invalid('מזהה השאלה בדוח אינו נמצא ברשימת שאלות המקור המותרות.');
    }
    for (const [key, allowed] of Object.entries(ENUMS)) if (!allowed.includes(value[key])) invalid(`${key}: הערך בדוח אינו נתמך.`);
    for (const [key, limit] of [['continuation', 1200], ['note', 3000], ['evidence', 3000]]) {
      if (typeof value[key] !== 'string' || value[key].length > limit) invalid(`${key}: נדרש טקסט באורך של עד ${limit} תווים.`);
    }
    if (value.minutes !== null && (!Number.isInteger(value.minutes) || value.minutes < 1 || value.minutes > 600)) invalid('משך המפגש צריך להיות מספר שלם בין 1 ל־600 דקות, או null אם לא נמדד.');
    if (typeof value.claimsIndependent !== 'boolean') invalid('claimsIndependent צריך להיות true או false.');
    if (value.problemId === null && value.outcome !== 'not-attempted') invalid('בלי שיוך לשאלת מקור, outcome חייב להיות not-attempted. אפשר לתאר עבודה על דוגמה או וריאציה בשדה note.');
    if (value.claimsIndependent) {
      if (['hint', 'guided', 'solution'].includes(value.help)) warnings.push('המורה טען לפתרון עצמאי, אך גם ציין שניתנה עזרה. העזרה נשמרת כפי שדווחה, ופתרון עצמאי לא יסומן.');
      else if (value.help === 'unknown') warnings.push('המורה טען לפתרון עצמאי, אך לא ציין אם ניתנה עזרה. העזרה תישאר ״לא צוין״; אין כאן אישור לפתרון עצמאי.');
      else warnings.push('המורה טען לפתרון עצמאי ללא עזרה. זו הצעה לבדיקה בלבד: נדרשים אישור מפורש שלך ותיאור כיצד בדקת את הפתרון.');
      if (value.problemId === null || value.outcome !== 'solved') warnings.push('הדוח אינו מתאר פתרון מלא של שאלת מקור מזוהה, ולכן אינו יכול לשמש לתיעוד פתרון עצמאי שלה.');
    }
    return {reportId: value.reportId, proposal: Object.fromEntries(PROPOSAL_KEYS.map(key => [key, value[key]])), warnings};
  }
  function prompt(input) {
    record(input, 'פרטי הבקשה');
    identifier(input.sessionId, 'משימה'); identifier(input.reportId, 'דוח', 100);
    if (!Array.isArray(input.problems)) invalid('רשימת שאלות המקור אינה זמינה.');
    const ids = new Set();
    for (const problem of input.problems) {
      record(problem, 'שאלת מקור'); identifier(problem.id, 'שאלת מקור');
      if (ids.has(problem.id)) invalid('מזהה שאלת מקור מופיע יותר מפעם אחת.');
      ids.add(problem.id);
      if (typeof problem.title !== 'string' || problem.title.length > 500) invalid('שם שאלת המקור אינו תקין.');
    }
    const template = {
      version: 1, reportId: input.reportId, sessionId: input.sessionId, problemId: null,
      outcome: 'not-attempted', help: 'unknown', obstacle: 'unknown',
      continuation: '', note: '', evidence: '', minutes: null, claimsIndependent: false
    };
    const catalog = input.problems.map(problem => `${problem.id}: ${problem.title.replace(/[\r\n]+/g, ' ')}`).join('\n') || 'אין שאלות מקור מזוהות ברשימה הזאת.';
    return [
      'עצרתי את הלימוד כרגע ואני מבקש לסכם את העבודה שכבר נעשתה בשיחה הזאת. הכן עכשיו דוח שאוכל להדביק באתר הלימוד ולבדוק לפני שמירה. זו בקשה נפרדת לסיכום; אל תתחיל שיעור או תרגיל חדש.',
      'דווח רק על מה שקרה בשיחה הזאת. אל תנחש ידע, עזרה, משך זמן או הצלחה שלא נצפו. אני אבדוק ואתקן את הדוח; הוא אינו מוסמך לסמן שסיימתי משימה, שלמדתי חומר או שפתרתי עצמאית.',
      `זהות הדוח שנוצרה באתר: ${input.reportId}. זהות המשימה: ${input.sessionId}. העתק את שני המזהים בדיוק, בלי ליצור מזהים חדשים.`,
      '',
      'שאלות המקור שאפשר לשייך לדוח (מזהה ואז כותרת):', catalog,
      '',
      'כללי התיעוד:',
      '• בחר לכל היותר שאלת מקור אחת: הניסיון האחרון בשאלה מקורית מתוך הרשימה, ורק אם אכן ראית את נוסחה וזיהית שהניסיון מתייחס אליה. אל תשייך וריאציה שנוצרה בשיחה למזהה של שאלה מקורית.',
      '• אם עבדנו על דוגמה, על וריאציה חדשה, או ללא שאלת מקור מזוהה: problemId יהיה null ו־outcome יהיה not-attempted. תאר את העבודה ב־note. זה מתייחס לשיוך לשאלת מקור בלבד ואינו אומר שלא למדנו.',
      '• אם ניסינו כמה שאלות, בחר אחת לפי הכלל לעיל והזכר את האחרות ב־note. אין לתת להן אישור ביצוע דרך הדוח הזה.',
      '• outcome: not-attempted אם לא ניסיתי את שאלת המקור; stuck אם ניסיתי ונתקעתי; partial אם פתרתי חלק; solved רק אם הגעתי לפתרון מלא. זיהוי הנושא או הבנת פתרון מוצג אינם פתרון מלא שלי.',
      '• help: unknown כשלא ידוע; none רק כשלא ניתנה עזרה במהלך הניסיון; hint כשניתן רמז; guided כשקיבלתי הכוונה לצעדים; solution אם נעזרתי בפתרון כתוב. דוגמה פתורה, השלמת צעדים או פתרון משותף אינם ניסיון עצמאי.',
      '• obstacle: unknown כשעוד לא ברור; knowledge לחוסר ידע; memory לשכחה; notation לניסוח או סימון; method לבחירת שיטה או בניית הפתרון; calculation לחישוב; time למחסור בזמן; none רק אם לא נותר קושי שדווח.',
      '• continuation: הצעד הקונקרטי שממנו כדאי להמשיך, עד 1200 תווים. note: מה נעשה ומה עוד לא ברור, עד 3000 תווים. evidence: כיצד נבדק הפתרון בפועל, עד 3000 תווים; השאר ריק אם לא נבדק.',
      '• minutes: מספר שלם בין 1 ל־600 רק אם משך המפגש נמדד או נמסר; אחרת null. אל תעתיק את תקציב הזמן המתוכנן כאילו בוצע.',
      '• claimsIndependent הוא טענת המורה בלבד, לא אישור שלי. השאר false אם קיבלתי הכוונה, השלמתי פתרון מודרך או אם אינך בטוח. גם true ידרוש בדיקה ואישור מפורש שלי באתר.',
      '• החזר את כל שדות התבנית בדיוק. אל תוסיף תאריכים, סימון סיום, learned, independentConfirmed, ציונים, פעולות, קוד או שינויים ביומן.',
      '',
      'החזר מקטע JSON יחיד, בלי דוחות נוספים. כתוב את ההסברים בשדות הטקסט בעברית ברורה:',
      '```json', JSON.stringify(template, null, 2), '```'
    ].join('\n');
  }
  return {parse, prompt};
});
