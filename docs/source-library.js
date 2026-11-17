/* Course PDFs stay in this browser's IndexedDB. No file data is sent to a server. */
(function (root) {
  'use strict';
  let course, contextError;
  try {
    course = root.StudyCourses ? root.StudyCourses.current() : root.STUDY_CONFIG?.course;
    if (root.StudyCourses && !course) throw new Error('הקורס שבקישור אינו מוכר. חזור לבחירת הקורס.');
  } catch (error) { contextError = error; }
  const DB_NAME = course?.sourceDatabase || 'study-compass-course-sources-v1';
  const STORE_NAME = 'pdfs';
  const INPUT_IDS = ['source-folder-input', 'source-files-input'];
  let databasePromise, cataloguePromise, importRunning = false;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalizedPath = value => String(value || '').replace(/\\/g, '/').normalize('NFC').replace(/^\.\//, '');
  const normalizedKey = value => normalizedPath(value).toLocaleLowerCase('en-US');
  const isScoped = !!course && (course.id !== 'random-algorithms' || course.offeringId !== '2026-s3');
  if (isScoped && (!course.sourceDatabase || course.sourceDatabase === 'study-compass-course-sources-v1')) contextError = new Error('לקורס נדרש אחסון מקורות נפרד. לא נטענו קבצים של קורס אחר.');
  const libraryUrl = () => contextError ? './' : isScoped ? `./?course=${encodeURIComponent(course.id)}&offering=${encodeURIComponent(course.offeringId)}#library` : './#library';
  function requireCourse() { if (contextError) throw contextError; }
  function catalogue(value) {
    const sources = value?.sources || value;
    return Object.values(sources || {}).filter(source => typeof source.path === 'string' && /\.pdf$/i.test(source.path));
  }
  function init(value) {
    requireCourse();
    if (value) cataloguePromise = Promise.resolve(catalogue(value));
    return getSources();
  }
  function getSources() {
    requireCourse();
    if (!cataloguePromise) cataloguePromise = fetch(course?.data?.sourceCatalog || course?.data?.curriculum || './data/curriculum.json', {cache:'no-store'}).then(response => {
      if (!response.ok) throw new Error('לא הצלחנו לטעון את רשימת חומרי הקורס. נסה לרענן את העמוד.');
      return response.json();
    }).then(catalogue).catch(error => { cataloguePromise = null; throw error; });
    return cataloguePromise;
  }
  function openDatabase() {
    requireCourse();
    if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
      if (!root.indexedDB) { reject(new Error('הדפדפן הזה אינו מאפשר לשמור קובצי קורס. אפשר לנסות Chrome או Edge בחלון רגיל.')); return; }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, {keyPath:'path'});
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => { database.close(); databasePromise = null; };
        resolve(database);
      };
      request.onerror = () => reject(request.error || new Error('לא ניתן לפתוח את אחסון הקבצים בדפדפן.'));
      request.onblocked = () => reject(new Error('לשונית אחרת חוסמת את פתיחת אחסון הקבצים. סגור לשוניות ישנות של האתר ונסה שוב.'));
    }).catch(error => { databasePromise = null; throw error; });
    return databasePromise;
  }
  async function readRecord(path) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(path);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
      transaction.onabort = () => reject(transaction.error || new Error('קריאת הקובץ נעצרה.'));
    });
  }
  async function getFile(path) {
    const sources = await getSources();
    const source = sources.find(item => normalizedKey(item.path) === normalizedKey(path));
    if (!source) return null;
    const record = await readRecord(source.path);
    return record?.blob instanceof Blob ? {...record, source} : null;
  }
  async function savedPaths() {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).getAllKeys();
      request.onsuccess = () => resolve(new Set(request.result));
      request.onerror = () => reject(request.error);
      transaction.onabort = () => reject(transaction.error || new Error('קריאת רשימת הקבצים נעצרה.'));
    });
  }
  async function storeFile(path, file) {
    // This function is reached only for a selected file matched to the course catalogue.
    const header = await file.slice(0, 1024).text();
    if (!header.includes('%PDF-')) throw new Error('הקובץ שנבחר אינו מזוהה כקובץ PDF תקין.');
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const request = transaction.objectStore(STORE_NAME).put({
        path, name:file.name, size:file.size,
        blob:file.slice(0, file.size, 'application/pdf'), savedAt:new Date().toISOString()
      });
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error || request.error || new Error('שמירת הקובץ בדפדפן נכשלה.'));
    });
  }
  function errorText(error) {
    if (error?.name === 'QuotaExceededError') return 'אין מספיק מקום פנוי באחסון האתר בדפדפן. הקבצים שכבר נשמרו נשארו זמינים; אפשר לפנות מקום ולבחור שוב את התיקייה.';
    if (error?.name === 'SecurityError' || error?.name === 'InvalidStateError') return 'הדפדפן חסם אחסון מקומי. נסה חלון רגיל ובדוק שאחסון נתוני האתר מותר.';
    return error?.message || 'לא ניתן לשמור את קובצי הקורס בדפדפן הזה.';
  }
  async function refreshManager(message = '') {
    const status = document.getElementById('source-library-status');
    if (!status) return;
    const sources = await getSources(), stored = await savedPaths();
    const missing = sources.filter(source => !stored.has(source.path));
    status.textContent = `${sources.length - missing.length} מתוך ${sources.length} קובצי הקורס זמינים בדפדפן הזה.`;
    const details = document.getElementById('source-library-missing');
    if (details) details.innerHTML = missing.length ? `<details class="task-details"><summary>אילו קבצים עדיין חסרים? (${missing.length})</summary><ul class="step-list">${missing.map(source => `<li>${escape(source.label)}<br><small dir="ltr" style="unicode-bidi:isolate;overflow-wrap:anywhere">${escape(source.path)}</small></li>`).join('')}</ul></details>` : '<p class="notice neutral">כל הקבצים שברשימת המקורות זמינים. אפשר לחזור ללימוד ולפתוח אותם מהקישורים במשימות.</p>';
    const feedback = document.getElementById('source-library-feedback');
    if (feedback && message) feedback.textContent = message;
  }
  async function openManager() {
    requireCourse();
    if (typeof root.openDialog !== 'function') { root.location.href = libraryUrl(); return; }
    root.openDialog('source-library', 'course-files', 'חיבור תיקיית חומרי הקורס', `
      <p>${isScoped ? 'בחר תיקיית חומרי קורס או קובצי PDF מהמחשב. הקבצים יזוהו לפי תוכנם, גם אם שמם שונה. קובץ מגרסה אחרת לא יחליף מקור תואם.' : 'כדי לפתוח את קובצי הקורס מתוך האתר, בחר את התיקייה <bdi>Probabilistic Algorithms</bdi> שבה נמצאות התיקיות <bdi>Lectures</bdi>, <bdi>Mamans</bdi> ו־<bdi>Test</bdi>.'}</p>
      <p class="notice neutral">קובצי ה־PDF נשמרים רק בדפדפן הזה במחשב שלך. הם אינם נשלחים לשרת או ל־GitHub. מתוך הבחירה שלך נשמרים רק הקבצים שמופיעים ברשימת מקורות הקורס באתר.</p>
      <div class="form-field" style="margin:20px 0"><label for="source-folder-input">בחירת תיקיית חומרי הקורס</label><input class="field-input" id="source-folder-input" type="file" webkitdirectory directory multiple ${importRunning ? 'disabled' : ''}></div>
      <div class="form-field" style="margin:20px 0"><label for="source-files-input">בחירת קובצי PDF</label><input class="field-input" id="source-files-input" type="file" accept="application/pdf,.pdf" multiple ${importRunning ? 'disabled' : ''}></div>
      <p id="source-library-status" role="status" aria-live="polite">בודקים אילו קבצים כבר זמינים…</p>
      <p id="source-library-feedback" class="hint" role="status" aria-live="polite">${importRunning ? 'שמירת הקבצים שנבחרו עדיין נמשכת. אפשר להמתין כאן.' : 'בחירה חוזרת מעדכנת קבצים תואמים ואינה מוחקת קבצים שכבר חיברת.'}</p>
      <div id="source-library-missing"></div>
      <p class="hint" style="margin-top:20px">הקבצים נשמרים לרענון ולביקורים הבאים. במכשיר או בדפדפן אחר צריך לקשר את הקבצים מחדש. ניקוי נתוני האתר, גלישה פרטית או פינוי אחסון בידי הדפדפן עלולים להסיר את העותקים; הקבצים המקוריים במחשב אינם משתנים.</p>
      <div class="dialog-actions"><button class="button" data-action="close">סיום</button></div>`, 'קובצי הקורס שלך');
    try { await refreshManager(); }
    catch (error) { const status = document.getElementById('source-library-status'); if (status) status.textContent = errorText(error); }
  }
  async function matchSelection(files, sources, feedback = () => {}, {individualFiles = false} = {}) {
    const candidates = new Map(), hashFailures = [];
    let ambiguousCount = 0;
    for (const file of files) {
      const relative = normalizedKey(file.webkitRelativePath || file.name);
      let possible = sources.filter(source => source.sha256
        ? /\.pdf$/i.test(file.name) && (!source.bytes || source.bytes === file.size)
        : relative === normalizedKey(source.path) || relative.endsWith('/' + normalizedKey(source.path)) ||
          individualFiles && !file.webkitRelativePath && relative === normalizedKey(source.path).split('/').pop());
      if (individualFiles && !file.webkitRelativePath && possible.filter(source => !source.sha256).length > 1) {
        // Individual file pickers omit directories. Do not guess between equal basenames.
        ambiguousCount++;
        possible = possible.filter(source => source.sha256);
      }
      if (!possible.length) continue;
      let digest;
      if (possible.some(source => source.sha256)) {
        try {
          if (!root.crypto?.subtle) throw new Error('הדפדפן אינו מאפשר לזהות קבצים לפי תוכנם. פתח את האתר בחיבור מאובטח ונסה שוב.');
          feedback('בודקים את זהות הקובץ במחשב: ' + file.name);
          // Hash sequentially. A failure never falls back to a filename match for hashed sources.
          digest = [...new Uint8Array(await root.crypto.subtle.digest('SHA-256', await file.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('');
        } catch (error) { hashFailures.push({name:file.name, error}); }
      }
      for (const source of possible) {
        if (source.sha256 && digest !== source.sha256.toLowerCase()) continue;
        const matches = candidates.get(source.path) || [];
        // Byte-identical selected copies represent one source, regardless of their filenames.
        if (!source.sha256 || !matches.length) matches.push(file);
        candidates.set(source.path, matches);
      }
    }
    return {matches:[...candidates].filter(([, list]) => list.length === 1), duplicateCount:[...candidates.values()].filter(list => list.length > 1).length, ambiguousCount, hashFailures};
  }
  async function importSelection(files, options = {}) {
    if (importRunning) return;
    importRunning = true;
    for (const id of INPUT_IDS) { const input = document.getElementById(id); if (input) input.disabled = true; }
    const feedback = message => { const node = document.getElementById('source-library-feedback'); if (node) node.textContent = message; };
    try {
      const sources = await getSources();
      const {matches, duplicateCount, ambiguousCount, hashFailures} = await matchSelection(files, sources, feedback, options);
      if (!matches.length) {
        await refreshManager(hashFailures.length ? errorText(hashFailures[0].error) : ambiguousCount ? 'שם הקובץ מתאים לכמה מקורות. בחר את תיקיית הקורס כדי לזהות את הקובץ לפי מיקומו.' : duplicateCount ? 'נמצאו כמה עותקים של אותם מקורות. בחר את תיקיית הקורס עצמה, ללא תיקיות גיבוי, כדי לדעת באילו קבצים להשתמש.' : isScoped ? 'לא נמצאו קובצי PDF שתוכנם תואם לרשימת המקורות. בחר את תיקיית חומרי הקורס ובדוק שיש בה את גרסאות המקור המתאימות.' : 'לא נמצאו קבצים תואמים. בחר את תיקיית הקורס עצמה, שבה נמצאות Lectures, Mamans ו־Test; אין צורך לבחור את תיקיית האתר.');
        return;
      }
      let saved = 0, failures = [];
      for (const [path, [file]] of matches) {
        feedback(`שומרים בדפדפן ${saved + failures.length + 1} מתוך ${matches.length}: ${file.name}`);
        try { await storeFile(path, file); saved++; }
        catch (error) {
          failures.push({name:file.name, error});
          if (error?.name === 'QuotaExceededError') break;
        }
      }
      let message = `נשמרו ${saved} קבצים בדפדפן. קבצים שאינם ברשימת המקורות לא נשמרו.`;
      if (duplicateCount) message += ` על ${duplicateCount} מקורות עם כמה עותקים דילגנו; אפשר לבחור שוב תיקייה מדויקת יותר.`;
      if (ambiguousCount) message += ` על ${ambiguousCount} קבצים עם שמות שמתאימים לכמה מקורות דילגנו; בחר את תיקיית הקורס כדי לזהות את מיקומם.`;
      if (failures.length) message += ` ${failures[0].name}: ${errorText(failures[0].error)}`;
      if (hashFailures.length) message += ` על ${hashFailures.length} קבצים דילגנו כי לא ניתן היה לבדוק את תוכנם: ${errorText(hashFailures[0].error)}`;
      await refreshManager(message);
      root.dispatchEvent(new CustomEvent('course-sources-updated', {detail:{saved}}));
    } catch (error) { feedback(errorText(error)); }
    finally {
      importRunning = false;
      for (const id of INPUT_IDS) { const current = document.getElementById(id); if (current) { current.disabled = false; current.value = ''; } }
    }
  }
  document.addEventListener('change', event => {
    if (INPUT_IDS.includes(event.target.id)) return importSelection([...event.target.files], {individualFiles:event.target.id === 'source-files-input'});
  });
  root.SourceLibrary = Object.freeze({init, openManager, getSources, getFile, savedPaths, matchSelection, importSelection, libraryUrl, databaseName:DB_NAME});
})(window);
