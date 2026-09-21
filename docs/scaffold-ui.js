'use strict';
window.StudyScaffold = (() => {
  const lesson=window.StudyScaffoldContent;
  const enabled=id=>window.STUDY_CONFIG?.scaffoldPilot===true&&lesson?.sessionId===id;
  const views=new Map(),hintCounts=new Map();
  const stageOf=id=>lesson.stages.find(s=>s.id===id);
  const track=()=>StudyScaffoldEngine.trackFor(state,lesson);
  const shown=id=>stageOf(views.get(id)||track().currentStage);
  const nextOf=stage=>lesson.stages[Math.min(lesson.stages.findIndex(s=>s.id===stage.id)+1,lesson.stages.length-1)];
  const exposure=stageId=>StudyScaffoldEngine.exposureFor(state,lesson,stageId);
  const helpLabels={none:'ללא עזרה בניסיון',hint:'רמז',guided:'הסבר או הכוונה',solution:'נעזרתי בפתרון'};
  const helpOrder=['none','hint','guided','solution'];
  const plain=items=>(items||[]).map(x=>typeof x==='string'?x:x.text||x.math||'').join('\n\n');
  function paragraphs(items){return (items||[]).map(item=>typeof item==='string'?`<p>${esc(item)}</p>`:item.math?`<div class="scaffold-math" dir="ltr">${item.mml||`<bdi>${esc(item.math)}</bdi>`}</div>`:`<p>${esc(item.text)}</p>`).join('');}
  function entry(id){
    if(!enabled(id))return '';
    const current=stageOf(track().currentStage);
    return `<section class="scaffold-entry"><span class="eyebrow">מסלול לשעה הזאת</span><h3>דוגמה → השלמה → ניסיון עצמאי</h3><p>חוזרים בקצרה לרקע, רואים דוגמה ואז מפחיתים את העזרה בהדרגה. כל המסלול נכנס בזמן המשימה, כולל חמש דקות לכרטיסיות.</p><p><strong>נקודת ההמשך:</strong> ${esc(current.title)}</p><button class="button primary" data-scaffold-action="resume" data-id="${id}">פתיחת מסלול הלימוד</button><p class="hint">אפשר לעיין בשלבים ולדלג לפי הצורך. עיון אינו מסמן לימוד או פתרון.</p></section>`;
  }
  function prompt(id,stageId){
    if(!enabled(id))return '';
    const step=stageOf(stageId||track().currentStage),s=sessionOf(id);
    const refs=lesson.sourceRefs.map(ref=>`${sourceOf(ref.sourceId)?.path||ref.sourceId}, עמודי PDF ${ref.pages.join(', ')}`).join('\n');
    return `אני עובד על המשימה: ${s.title}.\nמטרת היחידה: ${s.objective}\nזמן המשימה כולו: ${s.minutes} דקות. תקציב שלב זה: בערך ${step.minutes} דקות; אין להוסיף זמן ליומן. חמש הדקות האחרונות במשימה מיועדות לחזרה.\n\n${StudyScaffoldEngine.promptContext(state,lesson)}\n\nכעת עובדים רק על השלב: ${step.title}.\nמטרה: ${step.goal}\n\nמקורות לכלים: קרא אותם כשיש לך גישה לקובצי הקורס:\n${refs}\nהדוגמאות והתרגילים הבאים נכתבו לאימון על בסיס הכלים האלה; הם אינם שאלות מקור או ניחוש של נוסח הבחינה.\n\nרקע והנחיות:\n${plain(step.body)}\n\nהמשימה בשלב הזה:\n${plain(step.question)}\n\nהנחיות למורה:\n${step.tutorInstructions.join('\n')}\nלמד בעברית ברורה כמו מורה פרטי. הסבר כל סימון לפני השימוש בו, והפרד נוסחאות משמאל לימין. בדוק אם חסר ידע, זיכרון או פירוש לסימון לפני תיקון נקודתי. עצור לאחר שאלה אחת והמתן לתשובתי. אל תמשיך לשלבים אחרים ואל תציג פתרון של תרגיל עצמאי מראש. אם השלב קל לי, הצע פחות עזרה ותן לי לבחור. אם הזמן אוזל, סכם את נקודת העצירה.\n\n${step.id==='example'?'זהו שלב של דוגמה מוסברת. הסבר את הפתרון בהדרגה ובקש להצדיק שני מעברים.\n'+plain(step.solution):'רמזים ופתרון הבדיקה זמינים באתר. אל תחשוף אותם מראש; תן רמז רק לבקשתי ותעד שניתן.'}\n\nבדוח מהמפגש אל תייחס את התרגיל הזה לשאלת ממ״ן: problemId=null ו־outcome=not-attempted. תאר ב־note את השלב, הניסיון והעזרה בפועל. הצלחה בתרגיל הזה אינה אישור לשליטה בשאלת מקור.`;
  }
  function footer(html){const node=document.createElement('div');node.className='task-fixed-actions scaffold-fixed-actions';node.innerHTML=html;$('#dialog-content').append(node);}
  function render(id,stageId){
    if(!enabled(id))return;
    if(stageId)views.set(id,stageId);
    const step=shown(id),index=lesson.stages.indexOf(step),saved=track(),help=exposure(step.id),hintCount=hintCounts.get(step.id)||0;
    const triedAlone=saved.events.some(e=>e.stageId==='independent'&&e.result==='attempted-alone');
    openDialog('scaffold',id,'לומדים שונות צעד אחר צעד',`
      <nav class="scaffold-steps" aria-label="שלבי הלימוד">${lesson.stages.map((s,i)=>`<button class="${s.id===step.id?'selected':''}" ${s.id===step.id?'aria-current="step"':''} data-scaffold-action="stage" data-id="${id}" data-stage="${s.id}"><span>${i+1}</span>${esc(s.title)}<small>${s.minutes} דק׳</small></button>`).join('')}</nav>
      <div class="scaffold-stage-heading"><span class="eyebrow">שלב ${index+1} מתוך ${lesson.stages.length} · כ־${step.minutes} דקות</span><h3>${esc(step.title)}</h3><p>${esc(step.goal)}</p></div>
      <p class="hint">55 דקות למסלול וחמש דקות לכרטיסיות, בתוך השעה שכבר נקבעה. מעבר שלב אינו מדד לשליטה.</p>
      <div class="scaffold-content">${paragraphs(step.body)}${step.question?.length?`<section class="scaffold-question"><h3>${step.id==='independent'?'הניסיון שלך':step.id==='completion'?'מה להשלים':'נקודת המחשבה'}</h3>${paragraphs(step.question)}</section>`:''}${step.id==='example'?`<details class="task-details"><summary>הצגת ההסבר לשאלות</summary>${paragraphs(step.solution)}</details>`:''}</div>
      ${['completion','independent'].includes(step.id)?`<p class="hint">כתוב את הניסיון במחברת או בשיחה עם המורה. אלה תרגילי אימון חדשים; הם אינם מסמנים שאלת ממ״ן כפתורה.</p><div class="scaffold-help"><button class="button" data-scaffold-action="hint" data-id="${id}">${hintCount>=step.hints.length?'כל הרמזים מוצגים':'עוד הסבר או רמז'}</button><button class="text-link" data-scaffold-action="solution" data-id="${id}">פתיחת פתרון והסבר</button></div>${help!=='none'?`<p class="hint">העזרה שכבר תועדה בתרגיל: <strong>${esc(helpLabels[help])}</strong>. אפשר להמשיך לתרגל; הדיווח הבא ישמור גם את העזרה שכבר ניתנה.</p>`:''}${hintCount?`<aside class="scaffold-hint"><h3>רמז ממוקד</h3>${paragraphs(step.hints.slice(0,hintCount))}</aside>`:''}`:''}
      ${step.id==='wrapup'?`<button class="button" data-scaffold-action="check" data-id="${id}">בדיקת הפתרון של הניסיון העצמאי</button><p class="hint">${triedAlone?'הניסיון שכבר תיעדת נשאר בהיסטוריה. עכשיו אפשר לבדוק אותו מול הפתרון.':'אם עדיין לא ניסית את התרגיל, אפשר לחזור לשלב הקודם. פתיחת הפתרון תירשם כעזרה.'}</p>`:''}
      <details class="task-details"><summary>המקורות והקשר לבחינה</summary><p>הכלים נלקחו משיעורים 1–2: אינדיקטורים, לינאריות תוחלת ושונות של סכום. הדוגמאות כאן נכתבו לאימון; אחריהן ממשיכים לשאלות המקור בתוכנית.</p><div class="source-links">${lesson.sourceRefs.map(ref=>sourceLink(ref.sourceId,ref.pages)).join('')}</div></details>
      <details class="task-details"><summary>נקודות המשך שכבר שמרתי (${saved.events.filter(e=>!['hint','solution'].includes(e.action)).length})</summary>${saved.events.filter(e=>!['hint','solution'].includes(e.action)).slice().reverse().map(e=>`<p><strong>${esc(stageOf(e.stageId).title)}</strong> → ${esc(stageOf(e.nextStageId).title)}<br>${esc(resultLabel(e.result))} · ${esc(helpLabels[e.help])}${e.note?'<br>'+esc(e.note):''}</p>`).join('')||'<p>עדיין לא נשמרה נקודת המשך במסלול.</p>'}</details>
      <p id="scaffold-error" class="error" role="alert"></p>
    `,'מסלול לימוד · גרסת ניסיון');
    footer(`<button class="button primary task-copy-button" data-scaffold-action="copy" data-id="${id}">העתקת השלב למורה</button><button class="button" data-scaffold-action="checkpoint" data-id="${id}">שמירת נקודת המשך</button><button class="text-link" data-action="session" data-id="${id}">חזרה למשימה</button>`);
  }
  const resultLabel=value=>({'not-checked':'טרם בדקתי יכולת עצמאית','needs-explanation':'נדרש עוד הסבר','with-help':'עבדתי בעזרה','attempted-alone':'כתבתי ניסיון לבד; נכונותו טרם נבדקה'})[value];
  async function record(step,action,nextStageId,help,result,note=''){
    const event={id:'step-'+crypto.randomUUID(),stageId:step.id,at:new Date().toISOString(),action,nextStageId,help,result,note};
    await save(draft=>StudyScaffoldEngine.record(draft,event,lesson),['hint','solution'].includes(action)?'פתיחת העזרה תועדה; נקודת ההמשך לא השתנתה':'נקודת ההמשך נשמרה');
  }
  async function hint(id){
    const step=shown(id);if(!step.hints.length)return;
    if((hintCounts.get(step.id)||0)>=step.hints.length){render(id);return;}
    await record(step,'hint',track().currentStage,exposure(step.id)==='none'?'hint':exposure(step.id),'not-checked');
    hintCounts.set(step.id,Math.min((hintCounts.get(step.id)||0)+1,step.hints.length));render(id);
  }
  async function solution(id,check=false){
    const step=check?stageOf('independent'):shown(id);
    await record(step,'solution',track().currentStage,'solution','not-checked');
    openDialog('scaffold-solution',id,'פתרון לבדיקה והסבר',`<p>${esc(step.title)} · תרגיל אימון</p><div class="scaffold-content">${paragraphs(step.solution)}</div><h3>מה לבדוק בניסיון שלך</h3><ul class="step-list">${step.rubric.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p class="hint">הפתרון מאפשר לבדוק את העבודה שלך; האתר אינו בודק אותה אוטומטית.</p>`,'בדיקת התרגיל');
    footer(`<button class="button primary" data-scaffold-action="open" data-id="${id}">חזרה למסלול</button><button class="button" data-meeting-action="open" data-id="${id}">עדכון מהמפגש</button>`);
  }
  function checkpoint(id){
    const step=shown(id),help=exposure(step.id),next=nextOf(step);
    const results=['not-checked','needs-explanation','with-help',...(step.id==='independent'&&help==='none'?['attempted-alone']:[])];
    openDialog('scaffold-checkpoint',id,'מאיפה נמשיך בפעם הבאה?',`<p>השלב שבו עבדת: <strong>${esc(step.title)}</strong>.</p><form id="scaffold-checkpoint-form" data-id="${id}" data-stage="${step.id}" class="meeting-form"><div class="form-field"><label for="scaffold-result">מה עשית בשלב הזה?</label><select class="field-input" id="scaffold-result" name="result">${results.map(r=>`<option value="${r}">${resultLabel(r)}</option>`).join('')}</select></div><div class="form-field"><label for="scaffold-help">איזו עזרה הייתה?</label><select class="field-input" id="scaffold-help" name="help">${Object.entries(helpLabels).map(([v,l])=>`<option value="${v}" ${helpOrder.indexOf(v)<helpOrder.indexOf(help)?'disabled':''} ${help===v?'selected':''}>${l}</option>`).join('')}</select>${help!=='none'?`<p class="hint">כבר תועדה בשלב הזה עזרה: ${esc(helpLabels[help])}. הדיווח משמר אותה גם אם חזרת לפתור לבד.</p>`:''}</div><div class="form-field"><label for="scaffold-next">נקודת ההמשך שתישמר</label><select class="field-input" id="scaffold-next" name="nextStageId">${lesson.stages.map(s=>`<option value="${s.id}" ${s.id===next.id?'selected':''}>${esc(s.title)}${s.id===step.id?' — להישאר כאן':''}</option>`).join('')}</select></div><div class="form-field"><label for="scaffold-note">מה נשאר פתוח? (לא חובה)</label><textarea class="field-input" id="scaffold-note" name="note" rows="2" maxlength="1200" placeholder="איזה צעד נשאר פתוח או מה לבקש מהמורה?"></textarea></div><p class="hint">נשמרים השלב והדיווח שלך בלבד. סיום המשימה, פתיחת הכרטיסיות ושאלות המקור מתועדים בנפרד.</p><p id="scaffold-save-error" class="error" role="alert"></p></form>`,'שמירה לפי בחירתך');
    footer(`<button class="button primary" type="submit" form="scaffold-checkpoint-form">שמירה והמשך לשלב שבחרתי</button><button class="button" data-scaffold-action="open" data-id="${id}">חזרה בלי לשמור</button>`);
  }
  async function submit(form){
    const values=Object.fromEntries(new FormData(form)),step=stageOf(form.dataset.stage),id=form.dataset.id;
    if(values.result==='attempted-alone'&&values.help!=='none')throw new Error('אם הייתה עזרה במהלך הניסיון, בחר „עבדתי בעזרה”.');
    if(values.result==='with-help'&&values.help==='none')throw new Error('בחר גם איזה סוג עזרה קיבלת.');
    const action=values.result==='attempted-alone'?'continue':values.nextStageId===step.id?(values.result==='needs-explanation'?'retry':'pause'):'continue';
    await record(step,action,values.nextStageId,values.help,values.result,values.note.trim());
    views.set(id,values.nextStageId);render(id);
  }
  async function copy(id,button){
    const text=[StudyLearningEngine.promptContext(state,id),prompt(id,shown(id).id),window.StudyReports?.prompt(id)||''].filter(Boolean).join('\n\n');
    try{await navigator.clipboard.writeText(text);markPromptCopied(button);notify('השלב הועתק. הדבק בשיחה עם המורה.');}
    catch{openDialog('scaffold-prompt',id,'הבקשה לשלב שבחרת',`<textarea id="prompt-text" class="prompt-preview prompt-textarea" readonly rows="12">${esc(text)}</textarea>`);footer(`<button class="button primary" data-action="copy-prompt">העתקת הבקשה</button><button class="text-link" data-action="select-prompt">בחירת כל הטקסט</button><button class="button" data-scaffold-action="open" data-id="${id}">חזרה למסלול</button>`);}
  }
  document.addEventListener('submit',async event=>{
    if(event.target.id!=='scaffold-checkpoint-form'||!enabled(event.target.dataset.id))return;
    event.preventDefault();const button=document.querySelector('[form="scaffold-checkpoint-form"]');button.disabled=true;
    try{await submit(event.target);}catch(error){$('#scaffold-save-error').textContent=error.message;}finally{button.disabled=false;}
  });
  document.addEventListener('click',async event=>{
    const b=event.target.closest('[data-scaffold-action]');if(!b||!enabled(b.dataset.id))return;b.disabled=true;
    try{const id=b.dataset.id,a=b.dataset.scaffoldAction;if(a==='resume')render(id,track().currentStage);if(a==='open')render(id);if(a==='stage')render(id,b.dataset.stage);if(a==='hint')await hint(id);if(a==='solution')await solution(id);if(a==='check')await solution(id,true);if(a==='copy')await copy(id,b);if(a==='checkpoint')checkpoint(id);}
    catch(error){const target=$('#scaffold-error');if(target)target.textContent=error.message;else notify(error.message);}finally{b.disabled=false;}
  });
  return {enabled,entry,prompt,open:render};
})();
