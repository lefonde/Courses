(function () {
  'use strict';
  let objectUrl;
  const byId = id => document.getElementById(id);
  function message(title, paragraphs, connect = false) {
    const panel = document.createElement('div'); panel.className = 'source-message panel';
    const heading = document.createElement('h2'); heading.textContent = title; panel.append(heading);
    for (const text of paragraphs) { const p = document.createElement('p'); p.textContent = text; panel.append(p); }
    if (connect) {
      const link = document.createElement('a'); link.className = 'button primary';
      link.href = './#library'; link.textContent = 'חיבור תיקיית חומרי הקורס'; panel.append(link);
    }
    byId('source-view').replaceChildren(panel);
  }
  async function openSource() {
    try {
      const params = new URLSearchParams(location.search), path = params.get('file');
      const sources = await SourceLibrary.getSources();
      const source = sources.find(item => item.path === path);
      if (!source) {
        byId('source-title').textContent = 'הקובץ אינו ברשימת המקורות';
        message('לא נמצא קישור מוכר לקובץ', ['חזור לרשימת המקורות ופתח את הקובץ משם.'], true); return;
      }
      const pageMatch = location.hash.match(/(?:^#|&)page=(\d+)(?:&|$)/);
      const page = Math.max(1, Math.min(10000, Number(pageMatch?.[1] || 1)));
      document.title = `${source.label} · מצפן`;
      byId('source-title').textContent = source.label;
      byId('source-detail').textContent = `עמוד PDF ${page} · הקובץ נשאר בדפדפן שלך`;
      const record = await SourceLibrary.getFile(source.path);
      if (!record) {
        message('חבר את תיקיית חומרי הקורס', [
          'הקובץ הזה עדיין לא נשמר בדפדפן הנוכחי. במסך המקורות לחץ על חיבור תיקיית חומרי הקורס ובחר את התיקייה במחשב שלך.',
          'הקבצים נשמרים מקומית בדפדפן ואינם מועלים לשרת. אחרי החיבור אפשר לחזור לכאן ולרענן.'
        ], true); return;
      }
      objectUrl = URL.createObjectURL(record.blob);
      const open = document.createElement('a'); open.className = 'button small'; open.href = `${objectUrl}#page=${page}`;
      open.target = '_blank'; open.rel = 'noopener'; open.textContent = 'פתיחת PDF בלשונית';
      const download = document.createElement('a'); download.className = 'button small'; download.href = objectUrl;
      download.download = record.name || source.path.split('/').pop(); download.textContent = 'שמירת עותק';
      byId('source-actions').replaceChildren(open, download);
      const frame = document.createElement('iframe'); frame.className = 'source-pdf';
      frame.title = `${source.label} — עמוד PDF ${page}`; frame.src = `${objectUrl}#page=${page}`;
      frame.referrerPolicy = 'no-referrer'; byId('source-view').replaceChildren(frame);
      byId('source-detail').textContent += ' · אם התצוגה ריקה, השתמש ב״פתיחת PDF בלשונית״';
    } catch (error) {
      byId('source-title').textContent = 'לא הצלחנו לפתוח את הקובץ';
      message('אחסון הקבצים בדפדפן אינו זמין כרגע', [error?.message || 'נסה לרענן או לפתוח את האתר בחלון רגיל.'], true);
    }
  }
  window.addEventListener('pagehide', event => { if (objectUrl && !event.persisted) URL.revokeObjectURL(objectUrl); });
  openSource();
})();
