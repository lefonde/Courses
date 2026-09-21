(function () {
  'use strict';
  let objectUrl, pdfDocument, renderTask, renderVersion = 0, currentPage = 1, zoom = 1, sourceLabel = '', resizeTimer;
  const byId = id => document.getElementById(id);
  const requestedPage = () => Math.max(1, Math.min(10000, Number(location.hash.match(/(?:^#|&)page=(\d+)(?:&|$)/)?.[1] || 1)));
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
  function updateNavigation() {
    byId('pdf-page-number').value = currentPage;
    byId('pdf-previous').disabled = currentPage <= 1;
    byId('pdf-next').disabled = currentPage >= pdfDocument.numPages;
    byId('source-detail').textContent = `עמוד PDF ${currentPage} מתוך ${pdfDocument.numPages} · הקובץ נשאר בדפדפן שלך`;
    byId('native-pdf-open').href = `${objectUrl}#page=${currentPage}`;
  }
  function goToPage(value, updateHash = true) {
    if (!pdfDocument) return;
    const page = Number.isFinite(Number(value)) ? Math.round(Number(value)) : currentPage;
    currentPage = Math.max(1, Math.min(pdfDocument.numPages, page));
    if (updateHash) history.replaceState(null, '', `${location.pathname}${location.search}#page=${currentPage}`);
    updateNavigation(); renderPage();
  }
  async function renderPage() {
    const version = ++renderVersion, pageNumber = currentPage;
    if (renderTask) { renderTask.cancel(); renderTask = null; }
    const stage = byId('pdf-stage');
    if (!stage) return;
    stage.setAttribute('aria-busy', 'true');
    byId('pdf-status').textContent = `מציגים עמוד ${pageNumber}…`;
    try {
      const page = await pdfDocument.getPage(pageNumber);
      if (version !== renderVersion) return;
      const original = page.getViewport({scale:1});
      const available = Math.max(240, Math.min(stage.clientWidth - 32, 1200));
      const viewport = page.getViewport({scale:available / original.width * zoom});
      const outputScale = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(6000000 / (viewport.width * viewport.height)));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
      canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
      canvas.style.width = Math.floor(viewport.width) + 'px';
      canvas.style.height = Math.floor(viewport.height) + 'px';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', sourceLabel + ' — עמוד PDF ' + pageNumber);
      stage.replaceChildren(canvas);
      const task = page.render({canvasContext:canvas.getContext('2d'), viewport, transform:[outputScale,0,0,outputScale,0,0], background:'rgb(255,255,255)'});
      renderTask = task;
      await task.promise;
      if (version !== renderVersion) return;
      renderTask = null;
      stage.setAttribute('aria-busy', 'false');
      byId('pdf-status').textContent = 'עמוד ' + pageNumber + ' מתוך ' + pdfDocument.numPages;
    } catch (error) {
      if (version !== renderVersion || error?.name === 'RenderingCancelledException') return;
      stage.setAttribute('aria-busy', 'false');
      byId('pdf-status').textContent = 'העמוד לא הוצג. אפשר לנסות לעבור עמוד ולחזור, או להשתמש ב״שמירת עותק״ כדי לפתוח את ה־PDF במחשב.';
    }
  }
  function buildViewer() {
    byId('source-view').innerHTML = '<div class="pdf-toolbar" aria-label="ניווט במסמך"><button class="button small" id="pdf-previous">עמוד קודם</button><form class="pdf-page-form" id="pdf-page-form"><label for="pdf-page-number">עמוד PDF</label><input class="field-input" id="pdf-page-number" type="number" min="1" max="' + pdfDocument.numPages + '" value="' + currentPage + '" aria-label="מספר עמוד PDF"><span>מתוך ' + pdfDocument.numPages + '</span><button class="button small" type="submit">מעבר</button></form><button class="button small" id="pdf-next">עמוד הבא</button><label class="pdf-zoom" for="pdf-zoom">גודל תצוגה<select class="field-input" id="pdf-zoom"><option value="1">התאמה לרוחב</option><option value="1.25">125%</option><option value="1.5">150%</option><option value="2">200%</option></select></label></div><p class="pdf-status" id="pdf-status" role="status" aria-live="polite"></p><div class="pdf-stage" id="pdf-stage" aria-busy="true"></div>';
    byId('pdf-previous').addEventListener('click', () => goToPage(currentPage - 1));
    byId('pdf-next').addEventListener('click', () => goToPage(currentPage + 1));
    byId('pdf-page-form').addEventListener('submit', event => { event.preventDefault(); goToPage(byId('pdf-page-number').value); });
    byId('pdf-zoom').addEventListener('change', event => { zoom = Number(event.target.value) || 1; renderPage(); });
    goToPage(currentPage);
  }
  async function openSource() {
    try {
      const path = new URLSearchParams(location.search).get('file');
      const sources = await SourceLibrary.getSources();
      const source = sources.find(item => item.path === path);
      if (!source) {
        byId('source-title').textContent = 'הקובץ אינו ברשימת המקורות';
        message('לא נמצא קישור מוכר לקובץ', ['חזור לרשימת המקורות ופתח את הקובץ משם.'], true); return;
      }
      currentPage = requestedPage(); sourceLabel = source.label;
      document.title = source.label + ' · מצפן';
      byId('source-title').textContent = source.label;
      const record = await SourceLibrary.getFile(source.path);
      if (!record) {
        message('חבר את תיקיית חומרי הקורס', [
          'הקובץ הזה עדיין לא נשמר בדפדפן הנוכחי. במסך המקורות לחץ על חיבור תיקיית חומרי הקורס ובחר את התיקייה במחשב שלך.',
          'הקבצים נשמרים מקומית בדפדפן ואינם מועלים לשרת. אחרי החיבור אפשר לחזור לכאן ולרענן.'
        ], true); return;
      }
      objectUrl = URL.createObjectURL(record.blob);
      const open = document.createElement('a'); open.className = 'button small'; open.id = 'native-pdf-open';
      open.href = objectUrl + '#page=' + currentPage; open.target = '_blank'; open.rel = 'noopener'; open.textContent = 'פתיחת PDF בלשונית';
      const download = document.createElement('a'); download.className = 'button small'; download.href = objectUrl;
      download.download = record.name || source.path.split('/').pop(); download.textContent = 'שמירת עותק';
      byId('source-actions').replaceChildren(open, download);
      message('פותחים את המסמך', ['העמוד מוצג מתוך הקובץ שנשמר בדפדפן. בהמשך אפשר לעבור בין עמודים ולהגדיל את התצוגה.']);
      const pdfjs = await import('./vendor/pdfjs/pdf.min.mjs');
      const assetRoot = new URL('./vendor/pdfjs/', document.baseURI);
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', assetRoot).href;
      const bytes = new Uint8Array(await record.blob.arrayBuffer());
      // PDF bytes stay local; only vendored code, fonts and decoders are fetched.
      const loadingTask = pdfjs.getDocument({data:bytes,
        cMapUrl:new URL('cmaps/', assetRoot).href, cMapPacked:true,
        standardFontDataUrl:new URL('standard_fonts/', assetRoot).href,
        wasmUrl:new URL('wasm/', assetRoot).href, isEvalSupported:false});
      pdfDocument = await loadingTask.promise;
      currentPage = Math.min(currentPage, pdfDocument.numPages);
      buildViewer();
    } catch (error) {
      byId('source-detail').textContent = 'הצגת המסמך נתקלה בקושי';
      message('לא הצלחנו להציג את המסמך בתוך האתר', [
        objectUrl ? 'הקובץ זמין: אפשר להשתמש ב״שמירת עותק״ או ב״פתיחת PDF בלשונית״ למעלה. אפשר גם לרענן ולנסות שוב.' : 'נסה לרענן או לחבר שוב את תיקיית חומרי הקורס במסך המקורות.',
        error?.name === 'PasswordException' ? 'לקובץ הזה נדרשת סיסמה. יש לפתוח את העותק בתוכנת PDF במחשב.' : ''
      ].filter(Boolean), !objectUrl);
    }
  }
  window.addEventListener('hashchange', () => { if (pdfDocument) goToPage(requestedPage(), false); });
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (pdfDocument) renderPage(); }, 180); });
  window.addEventListener('pagehide', event => {
    if (!event.persisted) {
      renderVersion++; if (renderTask) renderTask.cancel();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (pdfDocument) pdfDocument.destroy();
    }
  });
  openSource();
})();
