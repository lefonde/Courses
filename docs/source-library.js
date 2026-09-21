/* Course PDFs stay in this browser's IndexedDB. No file data is sent to a server. */
(function (root) {
  'use strict';
  const DB_NAME = 'study-compass-course-sources-v1';
  const STORE_NAME = 'pdfs';
  let databasePromise, cataloguePromise, importRunning = false;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalizedPath = value => String(value || '').replace(/\\/g, '/').normalize('NFC').replace(/^\.\//, '');
  const normalizedKey = value => normalizedPath(value).toLocaleLowerCase('en-US');
  function catalogue(value) {
    const sources = value?.sources || value;
    return Object.values(sources || {}).filter(source => typeof source.path === 'string' && /\.pdf$/i.test(source.path));
  }
  function init(value) {
    if (value) cataloguePromise = Promise.resolve(catalogue(value));
    return getSources();
  }
  function getSources() {
    if (!cataloguePromise) cataloguePromise = fetch('./data/curriculum.json', {cache:'no-store'}).then(response => {
      if (!response.ok) throw new Error('לא הצלחנו לטעון את רשימת חומרי הקורס. נסה לרענן את העמוד.');
      return response.json();
    }).then(catalogue).catch(error => { cataloguePromise = null; throw error; });
    return cataloguePromise;
  }
  function openDatabase() {
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
    if (typeof root.openDialog !== 'function') { root.location.href = './#library'; return; }
    root.openDialog('source-library', 'course-files', 'חיבור תיקיית חומרי הקורס', `
      <p>כדי לפתוח את קובצי הקורס מתוך האתר, בחר את התיקייה <bdi>Probabilistic Algorithms</bdi> שבה נמצאות התיקיות <bdi>Lectures</bdi>, <bdi>Mamans</bdi> ו־<bdi>Test</bdi>.</p>
      <p class="notice neutral">קובצי ה־PDF נשמרים רק בדפדפן הזה במחשב שלך. הם אינם נשלחים לשרת או ל־GitHub. מתוך התיקייה שבחרת נשמרים רק הקבצים שמופיעים ברשימת מקורות הקורס באתר.</p>
      <div class="form-field" style="margin:20px 0"><label for="source-folder-input">בחירת תיקיית חומרי הקורס</label><input class="field-input" id="source-folder-input" type="file" webkitdirectory directory multiple ${importRunning ? 'disabled' : ''}></div>
      <p id="source-library-status" role="status" aria-live="polite">בודקים אילו קבצים כבר זמינים…</p>
      <p id="source-library-feedback" class="hint" role="status" aria-live="polite">${importRunning ? 'שמירת הקבצים שנבחרו עדיין נמשכת. אפשר להמתין כאן.' : 'בחירה חוזרת מעדכנת קבצים תואמים ואינה מוחקת קבצים שכבר חיברת.'}</p>
      <div id="source-library-missing"></div>
      <p class="hint" style="margin-top:20px">הקבצים נשמרים לרענון ולביקורים הבאים. במכשיר או בדפדפן אחר צריך לבחור את התיקייה מחדש. ניקוי נתוני האתר, גלישה פרטית או פינוי אחסון בידי הדפדפן עלולים להסיר את העותקים; הקבצים המקוריים במחשב אינם משתנים.</p>
      <div class="dialog-actions"><button class="button" data-action="close">סיום</button></div>`, 'קובצי הקורס שלך');
    try { await refreshManager(); }
    catch (error) { const status = document.getElementById('source-library-status'); if (status) status.textContent = errorText(error); }
  }
  async function importSelection(files) {
    if (importRunning) return;
    importRunning = true;
    const input = document.getElementById('source-folder-input');
    if (input) input.disabled = true;
    const feedback = message => { const node = document.getElementById('source-library-feedback'); if (node) node.textContent = message; };
    try {
      const sources = await getSources();
      const candidates = new Map();
      for (const file of files) {
        const relative = normalizedKey(file.webkitRelativePath || file.name);
        for (const source of sources) {
          const expected = normalizedKey(source.path);
          if (relative !== expected && !relative.endsWith('/' + expected)) continue;
          const matches = candidates.get(source.path) || [];
          matches.push(file); candidates.set(source.path, matches);
        }
      }
      const matches = [...candidates].filter(([, list]) => list.length === 1);
      const duplicateCount = [...candidates.values()].filter(list => list.length > 1).length;
      if (!matches.length) {
        await refreshManager(duplicateCount ? 'נמצאו כמה עותקים של אותם מקורות. בחר את תיקיית הקורס עצמה, ללא תיקיות גיבוי, כדי לדעת באילו קבצים להשתמש.' : 'לא נמצאו קבצים תואמים. בחר את תיקיית הקורס עצמה, שבה נמצאות Lectures, Mamans ו־Test; אין צורך לבחור את תיקיית האתר.');
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
      if (failures.length) message += ` ${failures[0].name}: ${errorText(failures[0].error)}`;
      await refreshManager(message);
      root.dispatchEvent(new CustomEvent('course-sources-updated', {detail:{saved}}));
    } catch (error) { feedback(errorText(error)); }
    finally { importRunning = false; const current = document.getElementById('source-folder-input'); if (current) { current.disabled = false; current.value = ''; } }
  }
  document.addEventListener('change', event => {
    if (event.target.id === 'source-folder-input') importSelection([...event.target.files]);
  });
  root.SourceLibrary = Object.freeze({init, openManager, getSources, getFile, savedPaths, databaseName:DB_NAME});
})(window);
