'use strict';
window.StudyMeetings = (() => {
  const enabled = () => window.STUDY_CONFIG?.learningPilot === true;
  const drafts = new Map();
  const imported = new Map();
  const outcomes = {'not-attempted':'לימוד ללא ניסיון בשאלה',stuck:'ניסיתי ולא הצלחתי להתחיל',partial:'הצלחתי בחלק מהשאלה',solved:'השלמתי פתרון'};
  const helps = {unknown:'לא ציינתי',none:'ללא עזרה',hint:'קיבלתי רמז',guided:'פתרתי עם הכוונה',solution:'נעזרתי בפתרון כתוב'};
  const obstacles = {unknown:'עוד לא ברור לי',knowledge:'חסר לי ידע בנושא',memory:'למדתי, אבל לא זכרתי',notation:'הסימון או הניסוח לא היו ברורים',method:'לא ידעתי לבחור או לבצע את השיטה',calculation:'טעות בחישוב',time:'נגמר הזמן או שהייתה הפרעה',none:'לא נשאר קושי'};
  const newId = () => 'meeting-'+crypto.randomUUID();
  const latest = id => StudyLearningEngine.latestCheckpoint(state,id);
  const history = id => StudyLearningEngine.attemptsFor(state,id);
  const when = at => new Date(at).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem',day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'});
  const options = (items,value) => Object.entries(items).map(([key,label])=>`<option value="${key}" ${key===value?'selected':''}>${esc(label)}</option>`).join('');
  const lessonFor = id => window.StudyScaffold?.enabled(id) ? window.StudyScaffoldContent : null;
  const canLearn = id => !['setup','mock'].includes(sessionOf(id)?.kind);
  const learnedScope = id => {
    const session=sessionOf(id),ids=session.topicIds?.length?session.topicIds:[session.topicId].filter(Boolean);
    const labels=ids.map(topicId=>curriculum.topics?.find(topic=>topic.id===topicId)?.title||topicId);
    return labels.length?`חומר המשימה בנושאים: ${labels.join(' · ')}.`:'';
  };
  const meetingEvent = ({remainingMinutes,learned,nextStageId,...event}) => event;
  function continuationFields(id,d){
    const lesson=lessonFor(id),current=lesson&&StudyScaffoldEngine.trackFor(state,lesson).currentStage;
    return `${lesson?`<div class="form-field"><label for="meeting-next-stage">באיזה שלב לפתוח בפעם הבאה?</label><select class="field-input" id="meeting-next-stage" name="nextStageId">${lesson.stages.map(step=>`<option value="${step.id}" ${d.nextStageId===step.id?'selected':''}>${esc(step.title)}${step.id===current?' — השלב השמור כרגע':''}</option>`).join('')}</select><span class="hint">בחר את השלב שבו תרצה להמשיך. הבקשה למורה ומסלול הלימוד ייפתחו באותו שלב.</span></div>`:''}
      <div class="form-field" id="meeting-remaining-field" ${d.disposition==='complete'?'hidden':''}><label for="meeting-remaining">כמה דקות להערכתך דרושות להשלמת המשימה?</label><input class="field-input" id="meeting-remaining" name="remainingMinutes" type="number" min="1" max="600" step="1" value="${d.remainingMinutes??''}" placeholder="אפשר להשאיר ריק" ${d.disposition==='complete'?'disabled':''}><span class="hint">הערכה שלך לגבי העבודה שנותרה. הזמן שכבר למדת אינו מופחת אוטומטית. ללא הערכה, התכנון ישמור מקום למשימה באורכה המקורי.</span></div>
      ${canLearn(id)?`<label class="learned-choice"><input type="checkbox" name="learned" ${d.learned?'checked':''}><span><strong>עברתי על כל החומר שתוכנן למשימה הזאת</strong><small>${esc(learnedScope(id))} גם אם עדיין דרוש תרגול. הסימון מאפשר חזרות על החומר ופותח כרטיסיות שתלויות בו; הוא אינו אישור לפתרון עצמאי.</small></span></label>`:''}`;
  }
  function initial(id,problemId){
    const lesson=lessonFor(id),session=sessionOf(id);
    return {id:newId(),sessionId:id,problemId:problemId||null,at:new Date().toISOString(),disposition:'continue',outcome:'not-attempted',help:'unknown',obstacle:'unknown',continuation:latest(id)?.disposition==='continue'?latest(id).continuation:'',note:'',evidence:'',minutes:null,independentConfirmed:false,remainingMinutes:session.remainingMinutes>0?session.remainingMinutes:null,learned:!!session.learned,nextStageId:lesson?StudyScaffoldEngine.trackFor(state,lesson).currentStage:null};
  }
  function capture(form){
    const old=drafts.get(form.dataset.session);
    if((form.elements.problemId.value||null)!==old.problemId){form.elements.outcome.value='not-attempted';form.elements.help.value='unknown';form.elements.evidence.value='';form.elements.independentConfirmed.checked=false;}
    const fields=Object.fromEntries(new FormData(form)),problemId=fields.problemId||null;
    const draft={...old,problemId,disposition:fields.disposition,continuation:fields.continuation.trim(),note:fields.note.trim(),minutes:fields.minutes===''?null:Number(fields.minutes),outcome:problemId?fields.outcome:'not-attempted',help:problemId?fields.help:'unknown',obstacle:fields.obstacle,evidence:problemId?fields.evidence.trim():'',independentConfirmed:!!problemId&&fields.outcome==='solved'&&fields.help==='none'&&!!fields.independentConfirmed,remainingMinutes:fields.remainingMinutes==null?old.remainingMinutes:fields.remainingMinutes===''?null:Number(fields.remainingMinutes),learned:form.elements.learned?!!fields.learned:old.learned,nextStageId:fields.nextStageId??old.nextStageId};
    drafts.set(form.dataset.session,draft);return draft;
  }
  function open(id,problemId,continuationOptions){
    if(!enabled())return;
    const session=sessionOf(id);if(!session)return;
    if(!drafts.has(id))drafts.set(id,initial(id,problemId));
    else if(problemId&&drafts.get(id).problemId!==problemId){Object.assign(drafts.get(id),{problemId,outcome:'not-attempted',help:'unknown',evidence:'',independentConfirmed:false});}
    const d=drafts.get(id);
    if(continuationOptions?.nextStageId&&lessonFor(id)?.stages.some(step=>step.id===continuationOptions.nextStageId))d.nextStageId=continuationOptions.nextStageId;
    openDialog('meeting',id,'עדכון מהמפגש',`
      <p class="meeting-session-title">${esc(session.title)}</p>
      <p>שמור מה עשית ומאיפה להמשיך. אפשר לתעד גם מפגש שנפסק באמצע.</p>
      ${window.StudyReports?.entry(id,imported.has(id))||''}
      ${importNotice(id)}
      <form id="meeting-form" data-session="${id}" class="meeting-form">
        <fieldset class="meeting-choice"><legend>מה מצב המשימה?</legend>
          <label><input type="radio" name="disposition" value="continue" ${d.disposition==='continue'?'checked':''}>עצרתי, אמשיך בהמשך</label>
          <label><input type="radio" name="disposition" value="complete" ${d.disposition==='complete'?'checked':''}>סיימתי את המשימה</label>
        </fieldset>
        <div class="form-field"><label for="meeting-continuation">מאיפה להמשיך בפעם הבאה?</label><textarea class="field-input" id="meeting-continuation" name="continuation" maxlength="1200" rows="2" placeholder="למשל: להמשיך מסעיף ב׳; לבקש הסבר על הזוגות התלויים.">${esc(d.continuation)}</textarea><span class="hint">אפשר להשאיר ריק אם סיימת או שעדיין לא ברור לך מה הצעד הבא.</span></div>
        ${continuationFields(id,d)}
        <div class="form-field"><label for="meeting-note">מה עשית ומה עדיין לא ברור? (לא חובה)</label><textarea class="field-input" id="meeting-note" name="note" maxlength="3000" rows="2" placeholder="למשל: עברתי על הדוגמה, אבל עדיין קשה לי לזהות מתי המשתנים תלויים.">${esc(d.note)}</textarea></div>
        <details class="task-details" ${d.problemId?'open':''}><summary>תיעוד ניסיון בשאלת מקור (לא חובה)</summary>
          <div class="form-field"><label for="meeting-problem">איזו שאלה ניסית?</label><select class="field-input" id="meeting-problem" name="problemId"><option value="">ללא שיוך לשאלה</option>${curriculum.problems.map(p=>`<option value="${esc(p.id)}" ${d.problemId===p.id?'selected':''}>${esc(p.title)} · ${esc(sourceOf(p.sourceId)?.label||p.id)}</option>`).join('')}</select></div>
          <div id="meeting-attempt-fields" ${d.problemId?'':'hidden'}>
            <div class="form-grid"><div class="form-field"><label for="meeting-outcome">עד איפה הגעת?</label><select class="field-input" id="meeting-outcome" name="outcome">${options(outcomes,d.outcome)}</select></div><div class="form-field"><label for="meeting-help">באיזו עזרה השתמשת?</label><select class="field-input" id="meeting-help" name="help">${options(helps,d.help)}</select></div></div>
            <div id="meeting-independent" ${d.outcome==='solved'&&d.help==='none'?'':'hidden'}><label class="check-line"><input type="checkbox" name="independentConfirmed" ${d.independentConfirmed?'checked':''}>פתרתי בלי רמזים ובלי להיעזר בפתרון במהלך הניסיון.</label><div class="form-field"><label for="meeting-evidence">איך בדקת שהפתרון נכון?</label><textarea class="field-input" id="meeting-evidence" name="evidence" maxlength="3000" rows="2" placeholder="למשל: השוויתי לאחר הפתרון למחוון ובדקתי את ההנחות ואת כל הסעיפים.">${esc(d.evidence)}</textarea></div><p class="hint">סימון פתרון עצמאי נשען על התיעוד שלך. האתר אינו בודק את ההוכחה.</p></div>
          </div>
        </details>
        <details class="task-details" ${d.obstacle!=='unknown'||d.minutes!==null?'open':''}><summary>רישום הקושי והזמן (לא חובה)</summary><div class="form-grid"><div class="form-field"><label for="meeting-obstacle">מה בעיקר עצר אותך?</label><select class="field-input" id="meeting-obstacle" name="obstacle">${options(obstacles,d.obstacle)}</select></div><div class="form-field"><label for="meeting-minutes">דקות במפגש הזה</label><input class="field-input" id="meeting-minutes" name="minutes" type="number" min="1" max="600" step="1" value="${d.minutes??''}"></div></div></details>
        <p id="meeting-error" class="error" role="alert"></p>
      </form><p class="hint">הטיוטה נשמרת כל עוד הלשונית פתוחה. רק אישור העדכון במסך הבא שומר אותו בהתקדמות.</p>
    `,'תוצאות ונקודת המשך');
    footer(`<button class="button primary" type="submit" form="meeting-form">בדיקת העדכון</button><button class="button" data-meeting-action="back" data-id="${id}">חזרה למשימה</button>`);
    window.StudyReports?.syncSubmit?.(id);
  }
  function footer(html){const node=document.createElement('div');node.className='task-fixed-actions meeting-fixed-actions';node.innerHTML=html;$('#dialog-content').append(node);}
  function importNotice(id){const item=imported.get(id);return item?`<aside class="report-notice"><strong>הטופס מולא מהדוח. עדיין לא נשמר דבר.</strong><p>בדוק את השאלה, התוצאה והעזרה שניתנה. רק אתה יכול לאשר פתרון עצמאי או לסמן שסיימת.</p>${item.warnings.map(w=>`<p>${esc(w)}</p>`).join('')}<button class="text-link" data-meeting-action="undo-import" data-id="${id}">ביטול המילוי וחזרה לטיוטה הקודמת</button></aside>`:'';}
  function proposeReport(id,parsed){
    if(!enabled()||!window.StudyReports?.enabled())return;
    const previous=drafts.get(id)||initial(id),eventId='import-'+parsed.reportId;
    if((state.learning?.attempts||[]).some(a=>a.id===eventId))throw new Error('הדוח הזה כבר נשמר. לא נוסף מפגש נוסף. אפשר לראות אותו בהיסטוריית המפגשים.');
    if(previous.id===eventId)throw new Error('הדוח הזה כבר מולא בטופס. אפשר לערוך את השדות למטה, או לבטל את המילוי לפני הדבקת גרסה מתוקנת.');
    const proposed={...previous,...parsed.proposal,id:eventId,independentConfirmed:false};
    // Validate the complete candidate before changing the editable draft.
    StudyLearningEngine.recordMeeting(clone(state),meetingEvent(proposed),{sessionIds:allSessions().map(s=>s.id),problemIds:curriculum.problems.map(p=>p.id)});
    imported.set(id,{warnings:parsed.warnings,previous:clone(previous),previousImport:imported.get(id)});
    drafts.set(id,proposed);open(id);
  }
  function undoImport(id){const item=imported.get(id);if(!item)return;drafts.set(id,item.previous);if(item.previousImport)imported.set(id,item.previousImport);else imported.delete(id);open(id);}
  function syncFields(form){
    const d=capture(form);$('#meeting-attempt-fields').hidden=!d.problemId;
    $('#meeting-independent').hidden=!(d.problemId&&d.outcome==='solved'&&d.help==='none');
    $('#meeting-remaining-field').hidden=d.disposition==='complete';
    if(form.elements.remainingMinutes)form.elements.remainingMinutes.disabled=d.disposition==='complete';
    if($('#meeting-independent').hidden)form.elements.independentConfirmed.checked=false;
  }
  function validate(d){
    if(d.problemId&&d.outcome==='solved'&&d.help==='none'&&(!d.independentConfirmed||d.evidence.length<8))throw new Error('כדי לתעד פתרון עצמאי, אשר שפתרת ללא עזרה וכתוב בקצרה כיצד בדקת את הפתרון.');
    if(d.disposition!=='complete'&&d.remainingMinutes!==null&&(!Number.isInteger(d.remainingMinutes)||d.remainingMinutes<1||d.remainingMinutes>600))throw new Error('הזמן שנותר צריך להיות בין 1 ל־600 דקות. אפשר להשאיר את ההערכה ריקה.');
    if(typeof d.learned!=='boolean')throw new Error('יש לבחור אם עברת על חומר המשימה.');
    const lesson=lessonFor(d.sessionId);
    if(lesson&&!lesson.stages.some(step=>step.id===d.nextStageId))throw new Error('בחר את השלב שבו תרצה להמשיך.');
    const copy=clone(state);applyUpdate(copy,d);
  }
  function applyUpdate(next,d){
    StudyLearningEngine.recordMeeting(next,meetingEvent(d),{sessionIds:allSessions().map(s=>s.id),problemIds:curriculum.problems.map(p=>p.id)});
    const update={...(next.sessionUpdates[d.sessionId]||{}),status:d.disposition==='complete'?'completed':'in-progress',remainingMinutes:d.disposition==='complete'?0:d.remainingMinutes,updatedAt:d.at};
    if(canLearn(d.sessionId)){
      update.learned=d.learned;
      if(d.learned)update.learnedAt=update.learnedAt||d.at;
      else delete update.learnedAt;
    }
    const lesson=lessonFor(d.sessionId);
    if(lesson){
      const saved=StudyScaffoldEngine.trackFor(next,lesson),stageId=saved.currentStage;
      StudyScaffoldEngine.record(next,{id:'resume-'+d.id,stageId,at:d.at,action:stageId===d.nextStageId?'pause':'continue',nextStageId:d.nextStageId,help:StudyScaffoldEngine.exposureFor(next,lesson,stageId),result:'not-checked',note:d.continuation},lesson);
    }
    next.sessionUpdates[d.sessionId]=update;
  }
  function review(id){
    const d=drafts.get(id);if(!d)return;
    d.at=new Date().toISOString();
    try{validate(d);}catch(error){$('#meeting-error').textContent=error.message;return;}
    const p=problemOf(d.problemId),previous=history(id),existingIndependent=d.problemId&&isIndependent(d.problemId);
    openDialog('meeting-review',id,'זה העדכון שיישמר',`
      <p>${esc(sessionOf(id).title)}</p>
      ${imported.has(id)?'<p class="notice neutral">זהו דוח מה־AI עם התיקונים שעשית. אישור השמירה מתעד את הדיווח שלך; האתר אינו בודק את נכונות הפתרון.</p>':''}
      <dl class="meeting-review"><div><dt>מצב המשימה</dt><dd>${d.disposition==='complete'?'המשימה תסומן כסיימתי':'המשימה תישאר בתהליך'}</dd></div><div><dt>נקודת ההמשך</dt><dd>${esc(d.continuation||'לא צוינה נקודת המשך')}</dd></div>${d.note?`<div><dt>סיכום המפגש</dt><dd>${esc(d.note)}</dd></div>`:''}${p?`<div><dt>השאלה</dt><dd>${esc(p.title)}</dd></div><div><dt>תוצאת הניסיון</dt><dd>${esc(outcomes[d.outcome])} · ${esc(helps[d.help])}${d.independentConfirmed?' · פתרון עצמאי לפי אישורך':''}</dd></div>`:''}${d.obstacle!=='unknown'?`<div><dt>הקושי העיקרי</dt><dd>${esc(obstacles[d.obstacle])}</dd></div>`:''}${d.evidence?`<div><dt>בדיקת הפתרון</dt><dd>${esc(d.evidence)}</dd></div>`:''}${d.minutes!==null?`<div><dt>זמן במפגש</dt><dd>${d.minutes} דקות</dd></div>`:''}</dl>
      <dl class="meeting-review">${lessonFor(id)?`<div><dt>השלב שייפתח במסלול ובבקשה למורה</dt><dd>${esc(lessonFor(id).stages.find(step=>step.id===d.nextStageId).title)}</dd></div>`:''}<div><dt>זמן שנותר למשימה</dt><dd>${d.disposition==='complete'?'המשימה הושלמה — לא נותר לה זמן מתוכנן':d.remainingMinutes===null?'לא הוערך; נשמר מקום למשימה באורכה המקורי':d.remainingMinutes+' דקות, לפי הערכתך'}</dd></div>${canLearn(id)?`<div><dt>החומר שלמדת</dt><dd>${d.learned?'החומר יסומן כנלמד ויאפשר חזרה על הכרטיסיות המתאימות':'החומר לא יסומן כנלמד; הכרטיסיות שתלויות בו יישארו סגורות'}</dd></div>`:''}</dl>
      <p class="hint">נוסף רישום חדש${previous.length?` לצד ${previous.length} רישומים קודמים`:''}. תאריך המשימה אינו משתנה. אפשר לתקן את נקודת ההמשך, הערכת הזמן וסימון החומר בכל עדכון נוסף.</p>
      ${existingIndependent&&!d.independentConfirmed?'<p class="notice neutral">הניסיון הזה יתווסף להיסטוריה. ההצלחה העצמאית שתיעדת בעבר תישאר מתועדת בנפרד.</p>':''}
      <p id="meeting-save-error" class="error" role="alert"></p>
    `,'לפני שמירה');
    footer(`<button class="button primary" data-meeting-action="confirm" data-id="${id}">אישור ושמירה</button><button class="button" data-meeting-action="edit" data-id="${id}">תיקון העדכון</button><button class="text-link" data-meeting-action="back" data-id="${id}">חזרה בלי לשמור</button>`);
  }
  async function confirm(id){
    const d=clone(drafts.get(id));validate(d);
    await save(next=>{
      if(d.id.startsWith('import-')&&(next.learning?.attempts||[]).some(a=>a.id===d.id))throw new Error('הדוח הזה כבר נשמר. לא נוסף מפגש נוסף.');
      applyUpdate(next,d);
    },'המפגש נשמר');
    drafts.delete(id);
    imported.delete(id);
    window.StudyReports?.clear(id);
    openDialog('meeting-saved',id,'המפגש נשמר',`<p>${d.disposition==='complete'?'המשימה סומנה כהושלמה.':'אפשר לחזור למשימה ולהמשיך מאותה נקודה.'}</p>${d.continuation?`<div class="finish-target"><strong>בפעם הבאה:</strong> ${esc(d.continuation)}</div>`:''}${lessonFor(id)?`<p><strong>השלב שייפתח:</strong> ${esc(lessonFor(id).stages.find(step=>step.id===d.nextStageId).title)}.</p>`:''}<p>הבקשה למורה כוללת עכשיו את העדכון הזה.</p>${d.disposition!=='complete'&&d.remainingMinutes!==null?`<p>הערכת הזמן שנותר: ${d.remainingMinutes} דקות.</p>`:''}<p class="hint">${d.minutes!==null?'הזמן שתיעדת נשמר במפגש הזה. ':''}${d.learned?'החומר סומן כנלמד, לפי בחירתך.':'החומר לא סומן כנלמד.'} תאריך המשימה לא השתנה.</p>`,'תוצאות ונקודת המשך');
    footer(`${d.disposition!=='complete'?`<button class="button primary task-copy-button" data-task-action="copy" data-id="${id}">העתקת בקשה להמשך</button>`:''}<button class="button" data-action="session" data-id="${id}">חזרה למשימה</button><button class="text-link" data-meeting-action="history" data-id="${id}">היסטוריית המפגשים</button>`);
  }
  function historyHtml(items){return items.length?items.map(d=>`<article class="meeting-history-item"><div class="row-between"><strong>${esc(when(d.at))}</strong><span>${d.minutes===null?'לא נרשם זמן':d.minutes+' דקות'}</span></div><p>${d.disposition==='complete'?'סיום המשימה':'עצירה להמשך'}${d.problemId?` · ${esc(problemOf(d.problemId)?.title||d.problemId)}`:''}</p>${d.problemId?`<p>${esc(outcomes[d.outcome])} · ${esc(helps[d.help])}${d.independentConfirmed?' · עצמאות אושרה':''}</p>`:''}${d.note?`<p>${esc(d.note)}</p>`:''}${d.continuation?`<p><strong>להמשך:</strong> ${esc(d.continuation)}</p>`:''}${d.obstacle!=='unknown'?`<p class="muted">${esc(obstacles[d.obstacle])}</p>`:''}${d.evidence?`<details><summary>איך נבדק הפתרון</summary><p>${esc(d.evidence)}</p></details>`:''}</article>`).join(''):'<p class="muted">עדיין לא נשמר עדכון מהמפגש. הרישומים הקיימים שלך לא הומרו לניסיונות שלא תיעדת.</p>';}
  function showHistory(id){openDialog('meeting-history',id,'היסטוריית המפגשים',`<p>${esc(sessionOf(id)?.title)}</p>${historyHtml(history(id))}`,'כל ניסיון נשמר בנפרד');footer(`<button class="button primary" data-meeting-action="open" data-id="${id}">עדכון מהמפגש</button><button class="button" data-action="session" data-id="${id}">חזרה למשימה</button>`);}
  function taskSummary(id){if(!enabled())return '';const checkpoint=latest(id),count=history(id).length;return `<div class="meeting-task-summary">${checkpoint?.continuation?`<div class="finish-target"><strong>ממשיכים מכאן:</strong> ${esc(checkpoint.continuation)}</div>`:''}${count?`<button class="text-link" data-meeting-action="history" data-id="${id}">${count===1?'מפגש אחד מתועד':count+' מפגשים מתועדים'}</button>`:''}</div>`;}
  function latestProblemAttempt(id){return enabled()?(state.learning?.attempts||[]).filter(a=>a.problemId===id&&a.outcome!=='not-attempted').sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).at(0):null;}
  function problemLabel(id,fallback){const a=latestProblemAttempt(id);if(!a)return fallback;if(a.independentConfirmed)return 'פתרתי עצמאית';if(a.outcome==='solved')return a.help==='unknown'?'השלמתי פתרון · העזרה לא צוינה':a.help==='none'?'השלמתי פתרון · ללא אישור עצמאות':'פתרתי בעזרה';return a.outcome==='partial'?'ניסיון חלקי':'ניסיתי ונתקעתי';}
  function problemContext(id){const a=latestProblemAttempt(id);return a?`\nהניסיון האחרון בשאלה, לפי עדכון שאישרתי ב־${when(a.at)}:\nתוצאה: ${outcomes[a.outcome]}. עזרה: ${helps[a.help]}.\nקושי: ${obstacles[a.obstacle]}.\n${a.note?'מה עשיתי: '+a.note+'\n':''}${a.continuation?'להמשך: '+a.continuation+'\n':''}${a.evidence?'בדיקת הפתרון שתיעדתי: '+a.evidence+'\n':''}זהו דיווח שלי; האתר לא בדק את נכונות הפתרון.\n`:'';}
  function decorateProblem(id){
    if(!enabled())return;
    const form=$('#problem-form'),associated=allSessions().filter(s=>arr(s.problemIds).includes(id));if(!form||!associated.length)return;
    const previous=state.problemProgress[id],legacy=previous&&previous.status!=='unseen'?`<details class="task-details"><summary>סיכום הפתרון ששמור באתר: ${esc(STATUS[previous.status]||previous.status)}</summary><p>${esc(previous.evidence||'לא נוסף פירוט בסימון הזה.')}</p></details>`:'';
    const container=document.createElement('div');container.innerHTML=`${legacy}<h3>ניסיונות מתועדים</h3>${historyHtml((state.learning?.attempts||[]).filter(a=>a.problemId===id).slice().reverse())}<div class="dialog-actions"><button class="button primary" data-meeting-action="problem" data-id="${associated[0].id}" data-problem="${id}">תיעוד ניסיון חדש</button><button class="button" data-action="problem-prompt" data-id="${id}">העתקת בקשה לתרגול</button></div>`;form.replaceWith(container);
  }
  function onReady(){
    if(!enabled()||!window.STUDY_CONFIG.preview)return;
    const banner=document.createElement('aside');banner.className='meeting-preview-banner';banner.setAttribute('aria-label','גרסת ניסיון');
    banner.innerHTML='<div><strong>גרסת ניסיון — התיעוד נשמר כאן בנפרד</strong><p>ללימוד השוטף ולהתקדמות שלך, פתח את האתר הראשי.</p></div><a class="button primary" href="./index.html">לאתר הלימוד הראשי</a>';
    main.before(banner);$('.local-tag').textContent='גרסת ניסיון';
  }
  document.addEventListener('input',event=>{if(enabled()&&event.target.form?.id==='meeting-form')capture(event.target.form);});
  document.addEventListener('change',event=>{if(enabled()&&event.target.form?.id==='meeting-form')syncFields(event.target.form);});
  document.addEventListener('submit',event=>{if(!enabled()||event.target.id!=='meeting-form')return;event.preventDefault();capture(event.target);const id=event.target.dataset.session;if(window.StudyReports?.pending?.(id)){StudyReports.apply(id);return;}review(id);});
  document.addEventListener('click',async event=>{
    const b=event.target.closest('[data-meeting-action]');if(!b||!enabled())return;b.disabled=true;
    const id=b.dataset.id;
    try{
      if(['open','edit'].includes(b.dataset.meetingAction))open(id);
      if(b.dataset.meetingAction==='problem')open(id,b.dataset.problem);
      if(b.dataset.meetingAction==='back'){const form=$('#meeting-form');if(form)capture(form);StudyTasks.open(id);}
      if(b.dataset.meetingAction==='history')showHistory(id);
      if(b.dataset.meetingAction==='undo-import')undoImport(id);
      if(b.dataset.meetingAction==='confirm')await confirm(id);
    }catch(error){const target=$('#meeting-save-error')||$('#meeting-error');if(target)target.textContent=error.message;else notify(error.message);}finally{b.disabled=false;}
  });
  return {enabled,open,taskSummary,decorateProblem,onReady,problemLabel,latestProblemAttempt,problemContext,proposeReport};
})();
