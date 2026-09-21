'use strict';
window.StudyMixed = (() => {
  const enabled=()=>window.STUDY_CONFIG?.mixedPilot===true;
  const content=window.StudyMixedContent;
  let demoState=null,shownId=null,pendingHint=null;
  const drafts=new Map();
  const current=()=>demoState||state;
  const rounds=()=>current().settings?.mixedPractice?.rounds||[];
  const active=()=>StudyMixedEngine.activeRound(current());
  const itemOf=id=>content.items.find(item=>item.id===id);
  const events=(round,id)=>round.events.filter(e=>e.itemId===id);
  const attempt=(round,id)=>events(round,id).filter(e=>['attempt','skip'].includes(e.action)).at(-1);
  const eligible=id=>StudyMixedEngine.eligibleItems(content,current()).some(i=>i.id===id);
  const helpLabel={none:'ללא רמז או פתרון',hint:'רמז או הכוונה',solution:'עיון בפתרון'};
  const strongestHelp=(a,b)=>['none','hint','solution'][Math.max(['none','hint','solution'].indexOf(a),['none','hint','solution'].indexOf(b),0)];
  const resultLabel={started:'כתבתי דרך התחלה',stuck:'ניסיתי ונתקעתי',skipped:'דילגתי'};
  const html=blocks=>(blocks||[]).map(b=>b.math?`<div class="scaffold-math" dir="ltr">${b.mml}</div>`:`<p>${esc(b.text)}</p>`).join('');
  const plain=blocks=>(blocks||[]).map(b=>b.text||b.math).join('\n\n');
  const badge=()=>demoState?'<p class="mixed-demo-note" role="status">מצב הדגמה · הנתונים כאן זמניים. אין שינוי בחומר שסימנת כנלמד או בהתקדמות השמורה.</p>':'';
  const remainingBudget=(s,snapshot=current())=>s.minutes-StudyMixedEngine.allocatedMinutes(snapshot,s.id)-(window.StudyTasks?.recallBudget(s,snapshot)||0)-(window.StudyReviews?.allocatedMinutes(s.id,snapshot)||0);
  function budgetChoices(snapshot=current()){return [...schedule.sessions,...(snapshot.settings.customSessions||[])].map(s=>({...s,...(snapshot.sessionUpdates[s.id]||{})})).filter(s=>!s.disabled&&(!s.conditional||({...schedule.days.find(d=>d.date===s.date),...(snapshot.dayOverrides[s.date]||{})}).confirmedOptional)&&!isDone(s)&&['practice','review'].includes(s.kind)&&arr(s.problemIds).length&&remainingBudget(s,snapshot)>=10);}
  function footer(text){const n=document.createElement('div');n.className='task-fixed-actions mixed-actions';n.innerHTML=text;$('#dialog-content').append(n);}
  function button(action,label,primary=false,extra=''){return `<button class="button ${primary?'primary':''}" data-mixed-action="${action}" ${extra}>${label}</button>`;}
  function panel(){
    if(!enabled())return '';
    const count=new Set(StudyMixedEngine.eligibleItems(content,current()).map(i=>i.familyId)).size;
    const saved=active();
    return `<section class="panel section mixed-entry"><div>${badge()}<span class="eyebrow">בחירת דרך פתרון</span><h2>תרגול מעורב · 10 דקות</h2><p>שתי שאלות קצרות מחומר שכבר למדת. בוחרים כלי, בודקים את התנאים שלו וכותבים צעד ראשון; אחר כך משווים להסבר.</p><p class="hint">${saved?'יש סבב ששמרת באמצע. אפשר להמשיך מאותה רשימת שאלות.':count>=2?'אפשר לפתוח סבב מתוך זמן התרגול הקיים.':'הסבב ייפתח אחרי סימון החומר הבסיסי כנלמד. עיון במשימה או סיום שלה לבדם אינם פותחים שאלות.'}</p></div><div class="mixed-entry-actions">${button('intro',saved?'המשך הסבב ששמרתי':count>=2?'בחירת זמן ופתיחת סבב':'מה צריך ללמוד קודם?',true)}${demoState?button('end-demo','יציאה מההדגמה'):window.STUDY_CONFIG.preview?button('demo','בדיקת הממשק בנתוני דמה'):''}${rounds().filter(r=>r.closedAt).length?button('history','הסבבים שתיעדתי'):''}</div></section>`;
  }
  async function change(mutate,message){
    if(demoState){const draft=clone(demoState);mutate(draft);demoState=draft;notify('הדגמה בלבד: '+message);}
    else await save(mutate,message);
  }
  function showIntro(){
    if(!enabled())return;
    if(active()){showRound();return;}
    const ids=StudyMixedEngine.planRound(content,current(),2),choices=budgetChoices();
    const missing=[...new Set(content.items.flatMap(i=>i.unlockAfter).filter(id=>current().sessionUpdates[id]?.learned!==true))];
    openDialog('mixed-intro','mixed','תרגול מעורב · 10 דקות',`${badge()}<p>בסבב הזה כותבים דרך התחלה לשתי שאלות: איזה כלי מתאים, למה מותר להשתמש בו ומה החישוב הראשון. מקדישים כשלוש דקות לניסיון ועוד כשתי דקות לבדיקה בכל שאלה.</p><p>השאלות נכתבו לתרגול. הן אינן שאלות מקור, והשלמת הסבב אינה מסמנת שאלות ממ״ן כפתורות.</p>${ids.length>=2?`<form id="mixed-start-form"><div class="form-field"><label for="mixed-budget">מאיזו משימת תרגול לקחת את עשר הדקות?</label><select class="field-input" id="mixed-budget" name="budgetSessionId" required>${choices.map(s=>`<option value="${esc(s.id)}">${esc(fmtDate(s.date))} · ${esc(s.title)} · ${remainingBudget(s)} דק׳ לתרגול</option>`).join('')}</select></div><p class="hint">הסבב מחליף עשר דקות מתוך המשימה שנבחרה. הוא אינו נוסף לזמן ביומן ואינו מחליף את הכרטיסיות. זמן הסבב ייכלל בזמן המשימה אם תתעד אותו בהמשך.</p>${!choices.length?'<p class="notice">אין כרגע משימת תרגול פתוחה עם עשר דקות פנויות לסבב. אפשר לערוך את התוכנית ולחזור.</p>':''}<p id="mixed-error" class="error" role="alert"></p></form>`:`<div class="notice neutral">עוד לא סומנו כנלמדות מספיק דרכי פתרון לסבב מעורב. כשתלמד את יחידת השונות, סמן בה „למדתי את החומר”.</div><h3>משימות שפותחות את התרגול</h3><div class="source-links">${missing.map(id=>`<button class="source-link" data-action="session" data-id="${esc(id)}">${esc(sessionOf(id)?.title||id)}<span>למשימה ←</span></button>`).join('')}</div><p id="mixed-error" class="error" role="alert"></p>`}`,'בחירת זמן לתרגול');
    footer(`${ids.length>=2&&choices.length?'<button class="button primary" type="submit" form="mixed-start-form">פתיחת סבב של שתי שאלות</button>':''}${demoState?button('end-demo','יציאה מההדגמה'):button('close','חזרה לשאלות')}`);
  }
  async function start(form){
    const budgetSessionId=new FormData(form).get('budgetSessionId');
    if(!budgetChoices().some(s=>s.id===budgetSessionId))throw new Error('משימת התרגול שנבחרה אינה זמינה כרגע. חזור ובחר משימה אחרת.');
    const itemIds=StudyMixedEngine.planRound(content,current(),2);
    await change(draft=>{if(!budgetChoices(draft).some(s=>s.id===budgetSessionId))throw new Error('הזמן הזמין השתנה. חזור ובחר משימת תרגול.');StudyMixedEngine.startRound(draft,{id:'mix-'+crypto.randomUUID(),at:new Date().toISOString(),itemIds,budgetSessionId},content);},'הסבב נשמר; אפשר לעצור ולחזור אליו');
    shownId=itemIds[0];showItem(shownId);
  }
  function showRound(){
    const round=active();if(!round){showIntro();return;}
    const answered=round.itemIds.filter(id=>attempt(round,id)).length;
    openDialog('mixed-round',round.id,'הסבב שלך',`${badge()}<p>עשר דקות מתוך <strong>${esc(sessionOf(round.budgetSessionId)?.title||'משימת התרגול שבחרת')}</strong>. בסבב נשמרו ${answered} מתוך ${round.itemIds.length} ניסיונות או דילוגים; זהו תיעוד עבודה, ולא ציון.</p><div class="mixed-round-list">${round.itemIds.map((id,i)=>{const a=attempt(round,id);return `<button class="source-link" data-mixed-action="item" data-id="${id}"><strong>שאלה ${i+1}</strong><span>${a?esc(resultLabel[a.outcome]):'ממתינה לניסיון'} ←</span></button>`;}).join('')}</div><p class="hint">אפשר להמשיך בשאלה פתוחה, לבדוק ניסיון שכבר שמרת או לעצור ולחזור לסבב מאוחר יותר.</p><p id="mixed-error" class="error" role="alert"></p>`,'תרגול קצר');
    footer(`${answered===round.itemIds.length?button('finish','סיום הסבב',true):button('next','המשך לשאלה פתוחה',true)}${button('pause','עצירה וחזרה לשאלות')}${demoState?button('end-demo','יציאה מההדגמה'):''}`);
  }
  function draftFor(round,id){
    const saved=events(round,id).filter(e=>['draft','attempt'].includes(e.action)).at(-1);
    return drafts.get(round.id+':'+id)||{answer:saved?.answer||'',outcome:saved?.outcome==='stuck'?'stuck':'started',note:saved?.note||'',help:''};
  }
  function capture(){
    const form=$('#mixed-answer-form');if(!form)return null;
    const values=Object.fromEntries(new FormData(form)),round=active();
    if(round)drafts.set(round.id+':'+form.dataset.item,values);return values;
  }
  const attemptHelp=(id)=>StudyMixedEngine.attemptHelpFor(current(),active().id,id);
  function laterHelp(round,id){const list=events(round,id),index=list.findIndex(e=>e.action==='attempt');return index<0?'none':list.slice(index+1).filter(e=>['hint','solution'].includes(e.action)).reduce((h,e)=>strongestHelp(h,e.help),'none');}
  function seenBefore(round,id){return rounds().some(r=>r.id!==round.id&&r.itemIds.includes(id));}
  function showItem(id){
    const round=active();if(!round){showIntro();return;}if(!round.itemIds.includes(id))throw new Error('השאלה אינה בסבב הנוכחי.');
    shownId=id;const item=itemOf(id),a=attempt(round,id),help=attemptHelp(id),afterHelp=laterHelp(round,id),index=round.itemIds.indexOf(id);
    if(!eligible(id)){
      openDialog('mixed-locked',id,'השאלה ממתינה ללימוד החומר',`${badge()}<p>החומר הנדרש לשאלה אינו מסומן כעת כנלמד. השאלה וההסבר יישארו סגורים עד שהסימון יתעדכן.</p><p>אפשר לדלג על השאלה ולסיים את הסבב בלי לסמן שהיא נפתרה.</p><p id="mixed-error" class="error" role="alert"></p>`);
      footer(button('locked-skip','דילוג: החומר טרם נלמד',true)+button('round','חזרה לסבב'));return;
    }
    const values=draftFor(round,id),hintOpened=StudyMixedEngine.historyFor(current(),id).some(e=>e.action==='hint'),selectedHelp=!values.help&&help==='none'?'':strongestHelp(help,values.help);
    openDialog('mixed-item',id,`שאלה ${index+1} מתוך ${round.itemIds.length}`,`${badge()}<p class="mixed-timing">כ־3 דקות לניסיון ועוד כ־2 דקות לבדיקה</p>${seenBefore(round,id)?'<p class="hint">השאלה כבר נכללה בסבב קודם. זו חזרה על נוסח מוכר.</p>':''}${!a&&help!=='none'?`<p class="hint">עזרה בזמן הניסיון הנוכחי: ${esc(helpLabel[help])}.</p>`:''}${a&&afterHelp!=='none'?`<p class="hint">לאחר שמירת התשובה פתחת עזרה לצורך עיון. הדיווח על העזרה בזמן הניסיון ששמרת נשאר כפי שהיה.</p>`:''}<div class="scaffold-content mixed-question">${html(item.question)}</div>${a?`<section class="mixed-answer-saved"><h3>הניסיון ששמרת</h3><p>${esc(resultLabel[a.outcome])}</p>${a.answer?`<p class="mixed-written">${esc(a.answer)}</p>`:''}${a.note?`<p>${esc(a.note)}</p>`:''}<p class="hint">${esc(helpLabel[a.help])} בזמן הניסיון. נכונות הפתרון אינה נבדקת אוטומטית.</p></section><details class="task-details"><summary>הכלי והמקורות לתרגול</summary><p>${esc(item.familyLabel)} · תרגיל שנכתב על בסיס כלי הקורס</p><div class="source-links">${item.sourceRefs.map(ref=>sourceLink(ref.sourceId,ref.pages)).join('')}</div></details>`:`<form id="mixed-answer-form" data-item="${id}" class="meeting-form"><div class="form-field"><label for="mixed-answer">איזו דרך תנסה, למה היא מתאימה ומה הצעד הראשון?</label><textarea class="field-input" id="mixed-answer" name="answer" rows="4" maxlength="2000" placeholder="אפשר לכתוב גם ניסיון חלקי או לציין בדיוק היכן נתקעת.">${esc(values.answer)}</textarea></div><div class="form-field"><label for="mixed-outcome">איך לתעד את הניסיון?</label><select class="field-input" id="mixed-outcome" name="outcome">${Object.entries(resultLabel).map(([v,l])=>`<option value="${v}" ${values.outcome===v?'selected':''}>${l}</option>`).join('')}</select></div><div class="form-field"><label for="mixed-help">איזו עזרה קיבלת, באתר או מהמורה?</label><select class="field-input" id="mixed-help" name="help" required><option value="" ${selectedHelp===''?'selected':''} disabled>בחר את העזרה שקיבלת</option>${Object.entries(helpLabel).map(([v,l])=>`<option value="${v}" ${['none','hint','solution'].indexOf(v)<['none','hint','solution'].indexOf(help)?'disabled':''} ${selectedHelp===v?'selected':''}>${esc(l)}</option>`).join('')}</select>${help!=='none'?'<p class="hint">כאן מתועדת העזרה בזמן הניסיון הזה בלבד.</p>':''}</div><div class="form-field"><label for="mixed-note">מה עצר אותך? (חובה רק בדילוג)</label><input class="field-input" id="mixed-note" name="note" maxlength="1000" value="${esc(values.note)}" placeholder="למשל: חסר זמן, או שהסימון עדיין לא ברור."></div><p class="hint">אם אינך יודע להתחיל, בחר „ניסיתי ונתקעתי”; אין צורך להמציא תשובה. הטיוטה נשמרת כשתבחר שמירה, רמז או עצירה.</p></form>`}${!a||a.outcome!=='skipped'?`<div class="scaffold-help">${button('hint',hintOpened?'הצגת הרמז שוב':'רמז לפי בקשה')}${a?button('solution','פתיחת דרך הפתרון והבדיקה'):''}</div>`:''}<p id="mixed-error" class="error" role="alert"></p>`,'בחירת דרך פתרון');
    footer(`${!a?'<button class="button primary" type="submit" form="mixed-answer-form">שמירת הניסיון</button>':button('next',round.itemIds.every(i=>attempt(round,i))?'לסיכום הסבב':'לשאלה הבאה',true)}${button('copy',a?'העתקת בקשה למשוב':'העתקת השאלה למורה')}${button('pause',a?'עצירה וחזרה לשאלות':'שמירת טיוטה ועצירה')}${button('round','לרשימת השאלות')}`);
  }
  function makeEvent(id,action,fields={}){return {id:'mix-event-'+crypto.randomUUID(),itemId:id,at:new Date().toISOString(),action,answer:'',outcome:'not-checked',help:attemptHelp(id),note:'',...fields};}
  function draftEvent(round,id,values){
    if(!values||attempt(round,id))return null;
    const previous=events(round,id).filter(e=>e.action==='draft').at(-1);
    const help=strongestHelp(values.help,attemptHelp(id));
    if(!values.answer&&!values.note&&!previous&&help==='none')return null;
    if(previous?.answer===values.answer&&previous?.note===values.note&&strongestHelp(previous?.help,attemptHelp(id))===help)return null;
    return makeEvent(id,'draft',{answer:values.answer||'',note:values.note||'',help});
  }
  async function persistDraft(){const round=active(),values=capture();if(!round||!shownId||!eligible(shownId))return;const event=draftEvent(round,shownId,values);if(event)await change(d=>StudyMixedEngine.record(d,round.id,event,content),'הטיוטה נשמרה');}
  async function submitAnswer(form){
    const values=Object.fromEntries(new FormData(form)),id=form.dataset.item,round=active();
    if(!round)throw new Error('לא נמצא סבב פתוח.');
    if(values.outcome==='started'&&values.answer.trim().length<8)throw new Error('כתוב בקצרה את הדרך או הצעד הראשון. אם אינך יודע להתחיל, בחר „ניסיתי ונתקעתי”.');
    if(!Object.hasOwn(helpLabel,values.help))throw new Error('בחר איזו עזרה קיבלת, גם אם היא ניתנה בשיחה עם המורה.');
    if(values.outcome==='skipped'&&!values.note.trim())throw new Error('כתוב בקצרה מדוע בחרת לדלג, כדי שתדע מה נשאר להמשך.');
    const skipped=values.outcome==='skipped';
    const event=makeEvent(id,skipped?'skip':'attempt',{answer:values.answer.trim(),outcome:values.outcome,note:values.note.trim(),help:values.help});
    await change(d=>StudyMixedEngine.record(d,round.id,event,content),'הניסיון נשמר בלי לשנות את מצב שאלות המקור');
    drafts.delete(round.id+':'+id);showItem(id);
  }
  async function requestHint(){
    const round=active(),id=shownId,values=capture();
    if(!round||attempt(round,id)||events(round,id).some(e=>e.action==='hint')||!values?.answer?.trim()){await reveal('hint');return;}
    pendingHint={roundId:round.id,id,values:{...values}};
    const help=strongestHelp(attemptHelp(id),values.help);
    openDialog('mixed-before-hint',id,'לשמור את התשובה לפני פתיחת הרמז?',`${badge()}<p>כבר כתבת ניסיון. אם סיימת אותו, אפשר לשמור את התשובה עכשיו ולפתוח את הרמז לעיון בלבד. במקרה הזה הרמז לא ישנה את תיעוד העזרה בניסיון ששמרת.</p><p>אם אתה עדיין עובד על התשובה, פתח רמז להמשך הניסיון.</p><div class="mixed-written">${esc(values.answer)}</div><p class="hint">העזרה שתירשם אם תשמור עכשיו: ${esc(helpLabel[help])}.</p><p id="mixed-error" class="error" role="alert"></p>`,'התשובה לפני הרמז');
    footer(button('hint-save',help==='none'?'שמור ניסיון ללא עזרה ופתח רמז':'שמור את הניסיון ופתח רמז',true)+button('hint-continue','אני עדיין עובד — פתח רמז')+button('item','חזרה בלי לפתוח',false,`data-id="${id}"`));
  }
  async function saveBeforeHint(){
    const snapshot=pendingHint,round=active();
    if(!snapshot||round?.id!==snapshot.roundId||shownId!==snapshot.id)throw new Error('הסבב השתנה. חזור לשאלה ופתח שוב את הרמז.');
    const values=snapshot.values,id=snapshot.id;
    if(values.answer.trim().length<8)throw new Error('כדי לשמור ניסיון כתוב, הוסף משפט קצר. אפשר גם לפתוח את הרמז להמשך העבודה.');
    const event=makeEvent(id,'attempt',{answer:values.answer.trim(),outcome:values.outcome==='stuck'?'stuck':'started',help:strongestHelp(attemptHelp(id),values.help),note:values.note.trim()});
    const reviewEvent={...makeEvent(id,'hint',{help:'hint'}),at:new Date().toISOString()};
    await change(d=>{StudyMixedEngine.record(d,round.id,event,content);StudyMixedEngine.record(d,round.id,reviewEvent,content);},'התשובה נשמרה לפני הרמז. העיון בו אינו משנה את הניסיון');
    pendingHint=null;drafts.delete(round.id+':'+id);await reveal('hint');
  }
  async function reveal(kind){
    const round=active(),id=shownId;if(!round||!eligible(id))throw new Error('קודם צריך ללמוד את החומר הנדרש לשאלה.');
    const values=capture()||draftFor(round,id),draft=draftEvent(round,id,values),oldHelp=attemptHelp(id),help=strongestHelp(kind==='solution'?'solution':'hint',strongestHelp(oldHelp,values?.help));
    const list=events(round,id),attemptIndex=list.findIndex(e=>e.action==='attempt');
    const alreadyOpened=(attemptIndex<0?list:list.slice(attemptIndex+1)).some(e=>e.action===kind);
    const event=alreadyOpened?null:makeEvent(id,kind,{help});
    if(draft||event)await change(d=>{if(draft)StudyMixedEngine.record(d,round.id,draft,content);if(event)StudyMixedEngine.record(d,round.id,event,content);},attempt(round,id)?'העיון תועד בנפרד; הניסיון ששמרת לא השתנה':kind==='hint'?'הרמז תועד והטיוטה נשמרה':'פתיחת הפתרון תועדה');
    const item=itemOf(id);
    openDialog('mixed-help',id,kind==='hint'?'רמז לשאלה':'דרך הפתרון והבדיקה',`${badge()}<div class="scaffold-content">${html(kind==='hint'?item.hint:item.solution)}</div>${kind==='solution'?`<h3>השווה לניסיון שלך</h3><ul class="step-list">${item.rubric.map(r=>`<li>${esc(r)}</li>`).join('')}</ul><p class="hint">בדוק את בחירת הכלי, את התנאים ואת הצעד הראשון. הסבב בודק דרך התחלה, ואינו מעיד שפתרת הוכחה מלאה.</p><div class="source-links">${item.sourceRefs.map(ref=>sourceLink(ref.sourceId,ref.pages)).join('')}</div>`:''}<p id="mixed-error" class="error" role="alert"></p>`,'עזרה שבחרת לפתוח');
    footer(button('item','חזרה לשאלה',true,`data-id="${id}"`)+button('round','לרשימת השאלות'));
  }
  function prompt(){
    const round=active(),id=shownId;if(!round||!eligible(id))return '';
    const item=itemOf(id),a=attempt(round,id),values=draftFor(round,id),knownHelp=attemptHelp(id);
    const promptHelp=a?helpLabel[a.help]+(laterHelp(round,id)!=='none'?' בזמן הניסיון. לאחר השמירה נפתחה עזרה לעיון; היא לא שימשה בכתיבת התשובה שנשמרה.':''):values.help?'טיוטת דיווח שלי: '+helpLabel[strongestHelp(knownHelp,values.help)]:knownHelp!=='none'?helpLabel[knownHelp]:'טרם דיווחתי על עזרה בשיחה עם המורה; באתר לא תועדה פתיחת עזרה.';
    return `אני מתרגל בחירת דרך פתרון באלגוריתמים אקראיים. זו וריאציה קצרה שנכתבה לאימון, ולא שאלת מקור. כל הסבב כולל שתי שאלות בעשר דקות מתוך משימת תרגול קיימת. לשאלה הזאת כשלוש דקות ניסיון ושתי דקות בדיקה.\n\nהשאלה:\n${plain(item.question)}\n\n${a?'ניסיון שאישרתי באתר:\n'+(a.answer||resultLabel[a.outcome])+(a.note?'\n'+a.note:''):'טיוטה שעוד לא אישרתי:\n'+(values.answer||'טרם כתבתי ניסיון.')+(values.note?'\nהקושי שכתבתי: '+values.note:'')}\nעזרה בנוסח הזה: ${promptHelp}.\n\n${a?'תן משוב על הדרך והתנאים, ולא רק על התוצאה. הסבר סימון לא מוכר ובדוק אם חסר רקע. מקורות הכלים, אם הקבצים זמינים אצלך: '+item.sourceRefs.map(ref=>(sourceOf(ref.sourceId)?.path||ref.sourceId)+' עמ׳ '+ref.pages.join(', ')).join('; '):'אל תגלה את שם השיטה, המקור, רמז או פתרון לפני שאנסה. בקש לבחור כלי, לציין את תנאיו ולכתוב צעד ראשון; המתן לתשובתי. רמז רק לבקשתי.'}\nלמד בעברית בהירה כמו מורה פרטי; נוסחאות בנפרד ומשמאל לימין. אל תניח שטעות נובעת רק מחשיבה: ייתכן שחסרים ידע, זיכרון או פירוש לסימון. אל תייחס את הניסיון לשאלת ממ״ן ואל תסיק ממנו פתרון עצמאי של שאלה מלאה. בסוף תן סיכום קצר של מה הצלחתי להתחיל, היכן נתקעתי ואיזו עזרה ניתנה.`;
  }
  async function copy(buttonNode){
    capture();const text=prompt();if(!text)throw new Error('השאלה אינה זמינה לתרגול.');
    try{await navigator.clipboard.writeText(text);markPromptCopied(buttonNode);notify('השאלה וההקשר הועתקו למורה.');}
    catch{openDialog('mixed-prompt','mixed','השאלה להעתקה למורה',`${badge()}<textarea id="prompt-text" class="prompt-preview prompt-textarea" readonly rows="12">${esc(text)}</textarea>`);footer('<button class="button primary" data-action="copy-prompt">העתקת הבקשה</button><button class="text-link" data-action="select-prompt">בחירת כל הטקסט</button>'+button('item','חזרה לשאלה',false,`data-id="${shownId}"`));}
  }
  async function finish(){
    const round=active();if(!round)return;
    await change(d=>StudyMixedEngine.closeRound(d,round.id,new Date().toISOString(),content),'הסבב סומן כהסתיים; מצב שאלות המקור נשאר בנפרד');
    showHistory(round.id);
  }
  function showHistory(roundId){
    const list=rounds().filter(r=>r.closedAt&&(!roundId||r.id===roundId)).slice().reverse();
    openDialog('mixed-history','mixed',roundId?'סיכום הסבב':'הסבבים שתיעדתי',`${badge()}${list.map(r=>`<section class="mixed-history"><h3>${esc(fmtDate(new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jerusalem'}).format(new Date(r.startedAt))))} · ${r.itemIds.length} שאלות קצרות</h3><p class="hint">עשר דקות הוקצו מתוך ${esc(sessionOf(r.budgetSessionId)?.title||'משימת תרגול')}.</p>${r.itemIds.map((id,i)=>{const a=attempt(r,id);return `<details class="task-details"><summary>שאלה ${i+1} · ${esc(resultLabel[a?.outcome]||'טרם תועד ניסיון')}</summary>${eligible(id)?`<div class="scaffold-content">${html(itemOf(id).question)}</div><p class="hint">${esc(itemOf(id).familyLabel)}</p>`:'<p class="hint">החומר אינו מסומן כעת כנלמד; נוסח השאלה נשאר סגור.</p>'}<p>${esc(helpLabel[a?.help]||'')}</p>${a?.answer?`<p class="mixed-written">${esc(a.answer)}</p>`:''}${a?.note?`<p>${esc(a.note)}</p>`:''}<p class="hint">${laterHelp(r,id)!=='none'?'לאחר שמירת התשובה נפתחה עזרה לעיון. הניסיון המקורי נשמר.':'לא נרשם עיון נוסף לאחר התשובה בסבב הזה.'}</p></details>`;}).join('')}</section>`).join('')||'<p>עדיין לא הסתיים סבב.</p>'}<p>הניסיונות עוזרים לזהות מה צריך לתרגל. הם אינם מסמנים שאלות מקור כפתורות, והאתר אינו בודק נכונות אוטומטית.</p>`,'תיעוד התרגול');
    footer(demoState?button('end-demo','סיום ההדגמה',true):button('close','חזרה לשאלות',true));
  }
  function demo(){
    if(!window.STUDY_CONFIG.preview)return;
    demoState=clone(state);delete demoState.settings.mixedPractice;demoState.sessionUpdates||={};
    for(const id of new Set(content.items.flatMap(i=>i.unlockAfter)))demoState.sessionUpdates[id]={...(demoState.sessionUpdates[id]||{}),learned:true};
    drafts.clear();shownId=null;showIntro();
  }
  async function action(a,id,b){
    if(a==='intro')showIntro();if(a==='demo')demo();
    if(a==='item'){await persistDraft();showItem(id);}
    if(a==='round'){await persistDraft();showRound();}
    if(a==='next'){await persistDraft();const r=active(),next=r?.itemIds.find(i=>!attempt(r,i));if(next)showItem(next);else showRound();}
    if(a==='hint')await requestHint();if(a==='solution')await reveal(a);if(a==='hint-continue'){pendingHint=null;await reveal('hint');}if(a==='hint-save')await saveBeforeHint();
    if(a==='copy')await copy(b);
    if(a==='pause'){await persistDraft();closeDialog();location.hash='questions';render();notify(demoState?'ההדגמה עדיין פתוחה; הנתונים זמניים בלבד.':'הסבב נשמר להמשך.');}
    if(a==='close'){closeDialog();location.hash='questions';render();}
    if(a==='end-demo'){demoState=null;shownId=null;drafts.clear();closeDialog();location.hash='questions';render();notify('ההדגמה הסתיימה. ההתקדמות השמורה לא השתנתה.');}
    if(a==='finish')await finish();if(a==='history')showHistory();
    if(a==='locked-skip'){const r=active(),event=makeEvent(shownId,'skip',{outcome:'skipped',note:'החומר הנדרש אינו מסומן כנלמד.'});await change(d=>StudyMixedEngine.record(d,r.id,event,content),'הדילוג תועד');showRound();}
  }
  document.addEventListener('input',event=>{if(enabled()&&event.target.form?.id==='mixed-answer-form')capture();});
  document.addEventListener('change',event=>{if(enabled()&&event.target.form?.id==='mixed-answer-form')capture();});
  document.addEventListener('submit',async event=>{
    if(!enabled()||!['mixed-start-form','mixed-answer-form'].includes(event.target.id))return;
    event.preventDefault();const buttonNode=document.querySelector(`[form="${event.target.id}"]`);if(buttonNode)buttonNode.disabled=true;
    try{if(event.target.id==='mixed-start-form')await start(event.target);else await submitAnswer(event.target);}catch(error){$('#mixed-error').textContent=error.message;}finally{if(buttonNode)buttonNode.disabled=false;}
  });
  document.addEventListener('click',async event=>{
    const b=event.target.closest('[data-mixed-action]');if(!b||!enabled())return;b.disabled=true;
    try{await action(b.dataset.mixedAction,b.dataset.id,b);}catch(error){const target=$('#mixed-error');if(target)target.textContent=error.message;else notify(error.message);}finally{b.disabled=false;}
  });
  return {enabled,panel,open:showIntro,prompt};
})();
