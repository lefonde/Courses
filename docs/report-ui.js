'use strict';
window.StudyReports = (() => {
  const enabled=()=>window.STUDY_CONFIG?.learningPilot===true&&window.STUDY_CONFIG?.reportImport===true;
  const buffers=new Map(),requests=new Map(),handled=new Map();
  const pending=id=>enabled()&&!!buffers.get(id)?.trim()&&buffers.get(id)!==handled.get(id);
  function syncSubmit(id){const button=document.querySelector('button[form="meeting-form"]');if(button)button.textContent=pending(id)?'מילוי הטופס מהדוח':'בדיקת העדכון';}
  function requestId(id){
    const checkpoint=StudyLearningEngine.latestCheckpoint(state,id)?.attemptId||'initial';
    const previous=requests.get(id);
    if(!previous||previous.checkpoint!==checkpoint)requests.set(id,{checkpoint,id:'r-'+crypto.randomUUID()});
    return requests.get(id).id;
  }
  function prompt(id){
    if(!enabled())return '';
    const session=sessionOf(id);if(!session||['setup','mock'].includes(session.kind))return '';
    return StudyReportEngine.prompt({sessionId:id,reportId:requestId(id),problems:curriculum.problems.map(p=>({id:p.id,title:p.title}))});
  }
  function entry(id,filled=false){
    if(!enabled())return '';
    return `<details class="task-details report-entry" ${buffers.get(id)&&!filled?'open':''}>
      <summary>מילוי העדכון בעזרת AI (לא חובה)</summary>
      <p>כשעוצרים או מסיימים ללמוד, אפשר לבקש מה־AI לסכם מה תרגלת, מה היה קשה ומאיפה להמשיך. כך נחסכת הקלדה בטופס. אפשר גם למלא את העדכון בעצמך בהמשך העמוד.</p>
      <h3>1. מבקשים סיכום בשיחה שבה למדת</h3>
      <div class="report-actions"><button class="button small" data-report-action="copy" data-id="${id}">העתקת בקשה לסיכום הלימוד</button><button class="text-link" data-report-action="show" data-id="${id}">הצגת הבקשה</button></div>
      <p class="hint">מדביקים את הבקשה באותה שיחה עם ה־AI. התשובה תהיה בלוק נתונים (JSON) שהאתר יודע לקרוא. אין צורך להבין או לערוך את הקוד.</p>
      <h3>2. מחזירים לכאן את התשובה</h3>
      <label class="prompt-label" for="report-paste">הדוח שקיבלת מה־AI</label><textarea class="field-input report-paste" id="report-paste" data-session="${id}" rows="5" spellcheck="false" maxlength="16384" placeholder="מדביקים כאן את תשובת ה־AI לבקשת הסיכום.">${esc(buffers.get(id)||'')}</textarea>
      <div class="report-actions"><button class="button" data-report-action="apply" data-id="${id}">מילוי הטופס מהדוח</button>${window.STUDY_CONFIG.preview?`<button class="text-link" data-report-action="sample" data-id="${id}">טעינת דוגמה לבדיקה</button>`:''}</div>
      <h3>3. בודקים את העדכון לפני השמירה</h3>
      <p class="hint">הכפתור ימלא את שדות התוצאה, העזרה והסיכום בטופס למטה. עדיין לא יישמר דבר. אפשר לתקן אותם או לבטל את המילוי, ואז לבחור „בדיקת העדכון” ו„אישור ושמירה”.</p>
      <button class="text-link" data-report-action="clear" data-id="${id}">ניקוי הדוח שהודבק</button><p id="report-error" class="error" role="alert"></p><button class="text-link" data-meeting-action="history" data-id="${id}">היסטוריית המפגשים</button></details>`;
  }
  function showPrompt(id){
    openDialog('report-prompt',id,'בקשה לסיכום הלימוד',`<p>כשעוצרים או מסיימים ללמוד, מדביקים את הבקשה בשיחה שבה למדת. ה־AI יחזיר דוח נתונים (JSON). מעתיקים את תשובתו, חוזרים ל„עדכון מהמפגש” ומדביקים בשדה „הדוח שקיבלת מה־AI”. האתר ימלא טופס קריא לבדיקה ולתיקון לפני שמירה.</p><textarea class="prompt-preview prompt-textarea" id="prompt-text" rows="12" readonly spellcheck="false">${esc(prompt(id))}</textarea>`,'סיכום אופציונלי בסיום הלימוד');
    const actions=document.createElement('div');actions.className='task-fixed-actions prompt-fixed-actions';actions.innerHTML=`<button class="button primary task-copy-button" data-action="copy-prompt">העתקת הבקשה</button><button class="text-link" data-action="select-prompt">בחירת כל הטקסט</button><button class="button" data-meeting-action="open" data-id="${id}">חזרה לעדכון המפגש</button>`;$('#dialog-content').append(actions);
  }
  async function copy(id,button){try{await navigator.clipboard.writeText(prompt(id));markPromptCopied(button);notify('הבקשה הועתקה. הדבק אותה בשיחה שבה למדת.');}catch{showPrompt(id);}}
  function sample(id){
    // Deliberately contradictory synthetic report, exposed only in the preview.
    const question=curriculum.problems.find(p=>p.id==='m12-q1')||curriculum.problems[0];
    const data={version:1,reportId:'demo-'+id,sessionId:id,problemId:question?.id||null,outcome:question?'solved':'not-attempted',help:'hint',obstacle:'notation',continuation:'נתוני דמה: לנסות שוב את סעיף ב׳ בלי רמז ולנמק אילו משתנים תלויים.',note:'נתוני דמה בלבד: ניתן רמז בזיהוי המשתנים התלויים. הטענה לעצמאות בדוח הזה שגויה בכוונה.',evidence:'נתוני דמה: הפתרון הושווה להסבר המורה לאחר שניתן רמז.',minutes:25,claimsIndependent:true};
    const text=JSON.stringify(data,null,2);buffers.set(id,text);$('#report-paste').value=text;
    $('#report-error').textContent='נטענה דוגמה עם טעות מכוונת: המורה טוען לעצמאות למרות שניתן רמז. בחר „מילוי הטופס מהדוח” כדי לבדוק ולתקן. עדיין לא נשמר דבר.';syncSubmit(id);
  }
  function apply(id){
    const text=$('#report-paste').value;buffers.set(id,text);
    try{
      const parsed=StudyReportEngine.parse(text,{sessionId:id,problemIds:curriculum.problems.map(p=>p.id)});
      StudyMeetings.proposeReport(id,parsed);
      handled.set(id,text);syncSubmit(id);
    }catch(error){$('#report-error').textContent=error.message;}
  }
  function clear(id){buffers.delete(id);requests.delete(id);handled.delete(id);}
  document.addEventListener('input',event=>{if(enabled()&&event.target.id==='report-paste'){buffers.set(event.target.dataset.session,event.target.value);syncSubmit(event.target.dataset.session);}});
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-report-action]');if(!button||!enabled())return;
    const id=button.dataset.id;button.disabled=true;
    try{if(button.dataset.reportAction==='copy')await copy(id,button);if(button.dataset.reportAction==='show')showPrompt(id);if(button.dataset.reportAction==='sample'&&window.STUDY_CONFIG.preview)sample(id);if(button.dataset.reportAction==='apply')apply(id);if(button.dataset.reportAction==='clear'){buffers.delete(id);handled.delete(id);$('#report-paste').value='';$('#report-error').textContent='הדוח שהודבק נוקה. אפשר להמשיך לערוך את הטופס.';syncSubmit(id);}}
    finally{button.disabled=false;}
  });
  return {enabled,entry,prompt,clear,pending,apply,syncSubmit};
})();
