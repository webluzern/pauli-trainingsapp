import {SUPABASE_URL,SUPABASE_ANON_KEY} from './config.js';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const $=selector=>document.querySelector(selector);
const root=$('#app');
const linkKey='pauli-private-link-v1';
const hashParameters=new URLSearchParams(location.hash.slice(1));
const incomingToken=hashParameters.get('zugang');
if(incomingToken!==null)history.replaceState(null,'',location.pathname+location.search);
const validToken=token=>typeof token==='string'&&/^[a-f0-9]{64}$/.test(token);
let token=validToken(incomingToken)?incomingToken:localStorage.getItem(linkKey);
const sb=validToken(token)?createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{headers:{'x-pauli-link':token}}
}):null;
const templates=[
  ['Alleinbleiben','Übe eine Dauer, bei der Pauli ruhig bleibt. Komm zurück, bevor er unruhig wird. Notiere, wie lange er entspannt war.','1–2 Min','Alleinsein'],
  ['Freiwillig ins Badezimmer','Lege eine rutschfeste Matte in die Nähe der Tür. Belohne freiwilliges Annähern und lass Pauli jederzeit wieder hinaus. Ziel: Er geht entspannt bis zur Matte.','1–2 Min','Pflege'],
  ['Dusche kennenlernen','Starte trocken und mit Abstand. Belohne ruhiges Schauen zur Dusche. Übe Wassergeräusche erst separat, leise und kurz, wenn der Raum entspannt klappt. Bei Bellen, Schreien oder Fluchtversuchen abbrechen und beim nächsten Mal mehr Abstand wählen.','1–2 Min','Pflege'],
  ['Nach dem Spaziergang: Pfoten abtrocknen','Zeig das Tuch. Belohne ruhiges Bleiben. Berühre kurz eine Pfote, wenn Pauli freiwillig stehen bleibt. Ziel: eine entspannte Berührung.','1 Min','Pflege'],
  ['Bettli beim Essen','Übe zuerst ohne Essen auf dem Tisch. Belohne ruhiges Liegen auf dem Bettli. Wenn das klappt, setzt euch kurz an den Tisch und belohnt weiter auf dem Bettli. Ziel: 15 entspannte Sekunden.','2–3 Min','Alltag'],
  ['Kurz warten','Übe in einer ruhigen Situation. Belohne eine Sekunde Warten und löse dann klar auf. Erhöhe die Dauer erst nach mehreren ruhigen Wiederholungen.','1–2 Min','Grundsignale'],
  ['Ruhige Begrüssung','Begrüsst Pauli, sobald vier Pfoten am Boden sind. Haltet die erste Begrüssung kurz und belohnt ruhiges Verhalten.','2–3 Min','Begrüssung'],
  ['Rückruf','Ruf Pauli einmal aus kurzer Distanz. Belohne ihn direkt bei dir. Übe zunächst mit wenig Ablenkung.','3 Min','Grundsignale'],
  ['Katzen auf Distanz','Vergrössere den Abstand, wenn Pauli fixiert oder bellt. Belohne ruhiges Schauen oder freiwilliges Abwenden.','2–3 Min','Begegnungen']
];
let state={tab:'home',user:null,house:null,plans:[],logs:[],reminders:[],daily:[],error:'',loading:false};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const day=()=>dateKey(new Date());const datetime=x=>new Date(x).toLocaleString('de-CH',{dateStyle:'medium',timeStyle:'short'});
function frame(content){root.innerHTML=`<main class="shell">${state.error?`<div class="notice">${esc(state.error)}</div>`:''}${content}</main>${state.user&&state.house?`<nav class="nav">${[['home','⌂','Heute'],['plans','▤','Übungen'],['progress','◷','Fortschritt'],['settings','◷','Erinnerungen'],['ai','✦','KI fragen']].map(([id,ico,t])=>`<button data-tab="${id}" class="${state.tab===id?'active':''}"><b>${ico}</b>${t}</button>`).join('')}</nav>`:''}`;document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;state.error='';render();window.scrollTo(0,0)})}
function render(){
  if(!state.house){
    const message=state.loading?'Tagesliste wird geladen …':'Öffne den privaten Zugangslink für Paulis Tagesliste.';
    frame(`<section class="card"><h1>Paulis Training</h1><p>${message}</p>${sb&&!state.loading?'<button class="btn" id="retry">Erneut laden</button>':''}</section>`);
    $('#retry')?.addEventListener('click',reload);
    return;
  }
  if(state.tab==='home')home();
  if(state.tab==='plans')plans();
  if(state.tab==='progress')progress();
  if(state.tab==='settings')settings();
  if(state.tab==='ai')aiQuestions();
}
const weekdayNames=['So','Mo','Di','Mi','Do','Fr','Sa'];
const displayDays=[1,2,3,4,5,6,0];
const reminderDays=r=>displayDays.filter(d=>r.weekdays.includes(d)).map(d=>weekdayNames[d]).join(', ');
const dateKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
function dogProfile(){
  const dog=state.dog;
  if(!dog)return '';
  const image=dog.portrait&&/^[A-Za-z0-9+/=]+$/.test(dog.portrait)?`<img src="data:image/jpeg;base64,${dog.portrait}" alt="Pauli" class="dog-photo">`:'';
  const [y,m,d]=dog.birthday.split('-');
  return `<section class="card dog-profile">${image}<div><h2>${esc(dog.name)}</h2><p class="muted">Geboren am ${esc(d)}.${esc(m)}.${esc(y)}</p></div></section>`;
}
function nextReminders(){
  const now=new Date();
  return state.reminders.map(reminder=>{
    const next=new Date(now);
    const [hour,minute]=reminder.time.split(':').map(Number);
    next.setHours(hour,minute,0,0);
    while(next<=now||!reminder.weekdays.includes(next.getDay()))next.setDate(next.getDate()+1);
    return {...reminder,next};
  }).sort((a,b)=>a.next-b.next);
}
function calendarFile(){
  const icsDays=['SU','MO','TU','WE','TH','FR','SA'];
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Pauli Training//Erinnerungen//DE','CALSCALE:GREGORIAN'];
  const stamp=new Date().toISOString().replace(/[-:]|\.\d{3}/g,'');
  for(const r of nextReminders()){
    const title=r.title.replaceAll('\\','\\\\').replace(/\r?\n/g,'\\n').replace(/[,;]/g,'\\$&');
    const start=dateKey(r.next).replaceAll('-','')+'T'+r.time.slice(0,5).replace(':','')+'00';
    lines.push('BEGIN:VEVENT',`UID:${r.id}@pauli-training`,`DTSTAMP:${stamp}`,`DTSTART:${start}`,'DURATION:PT5M',`RRULE:FREQ=WEEKLY;BYDAY=${r.weekdays.map(d=>icsDays[d]).join(',')}`,`SUMMARY:${title}`,'BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:PT0M',`DESCRIPTION:${title}`,'END:VALARM','END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  const link=document.createElement('a');
  link.href=URL.createObjectURL(new Blob([lines.join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'}));
  link.download='Pauli-Training.ics';
  link.click();
  setTimeout(()=>URL.revokeObjectURL(link.href),30000);
}
function plannedToday(plan, now){
  const title=plan.title.toLowerCase().trim();
  return state.reminders.some(r=>r.weekdays.includes(now.getDay()) &&
    [title,title+' üben','«'+title+'» üben'].includes(r.title.toLowerCase().trim()));
}
function home(){
  const now=new Date();
  const date=dateKey(now);
  const logs=state.logs.filter(log=>dateKey(new Date(log.done_at))===date);
  const completed=new Set(logs.map(log=>log.plan_id));
  const journalled=new Set(logs.filter(log=>log.note).map(log=>log.plan_id));
  const scheduled=new Set(state.daily.filter(entry=>entry.scheduled_on===date).map(entry=>entry.plan_id));
  const exercises=state.plans.filter(plan=>scheduled.has(plan.id)||completed.has(plan.id)||plannedToday(plan,now));
  const open=exercises.filter(plan=>!completed.has(plan.id));
  const available=state.plans.filter(plan=>!exercises.includes(plan));
  const dog=state.dog;
  const portrait=dog?.portrait&&/^[A-Za-z0-9+/=]+$/.test(dog.portrait)
    ? `<img class="today-portrait" src="data:image/jpeg;base64,${dog.portrait}" alt="Pauli">` : '';
  const birth=dog?.birthday?.split('-').map(Number);
  const age=birth?Math.max(0,(now.getFullYear()-birth[0])*12+now.getMonth()+1-birth[1]-(now.getDate()<birth[2]?1:0)):null;
  const done=exercises.length-open.length;
  const next=nextReminders()[0];
  frame(`<section class="today-summary">
    <div class="today-identity">${portrait}<div><p>${now.toLocaleDateString('de-CH',{weekday:'long',day:'numeric',month:'long'})}</p><h1>Paulis Training</h1>${age===null?'':`<p>${age} ${age===1?'Monat':'Monate'} alt</p>`}</div></div>
    ${exercises.length?`<progress aria-label="Tagesfortschritt" max="${exercises.length}" value="${done}"></progress><p>${done} von ${exercises.length} erledigt</p>`:''}
  </section>
  <section class="today-list"><div class="section"><h2>Heute</h2><button class="btn secondary" id="today-add" aria-expanded="false" aria-controls="today-picker">+ Übung</button></div>
  <div id="today-picker" class="card quick-picker" hidden>
    <h3>Für heute einplanen</h3>
    ${available.map(p=>`<button class="quick-plan" data-schedule="${esc(p.id)}"><span>${esc(p.title)}<small>${esc(p.duration)}</small></span><span aria-hidden="true">+</span></button>`).join('')}
    <button id="new-training" class="btn secondary">Neue Übung erstellen</button>
  </div>
  ${exercises.length?[...open,...exercises.filter(p=>completed.has(p.id))].map(p=>`<article class="exercise">
    <div class="exercise-row"><input type="checkbox" data-check="${esc(p.id)}" aria-label="${esc(p.title)} als erledigt markieren" ${completed.has(p.id)?'checked':''} ${journalled.has(p.id)?'disabled aria-description="Im Trainingsjournal erfasst"':''}>
    <button class="exercise-detail" data-detail="${esc(p.id)}" aria-expanded="false"><span><strong>${esc(p.title)}</strong><small>${esc(p.duration)}</small></span><span aria-hidden="true">›</span></button></div>
    <p class="exercise-instructions" id="detail-${esc(p.id)}" hidden>${esc(p.description)}</p>
  </article>`).join(''):'<p class="empty">Heute ist keine Übung geplant.</p>'}</section>
  ${next?`<button class="reminder-shortcut" id="today-reminder"><span><strong>Nächste Erinnerung</strong><small>${esc(next.title)} · ${esc(next.next.toLocaleDateString('de-CH',{weekday:'short'}))}, ${esc(next.time.slice(0,5))}</small></span><span aria-hidden="true">›</span></button>`:''}`);
  $('#today-add').onclick=()=>{
    const picker=$('#today-picker');
    picker.hidden=!picker.hidden;
    $('#today-add').setAttribute('aria-expanded',String(!picker.hidden));
    if(!picker.hidden)picker.querySelector('button')?.focus();
  };
  $('#new-training').onclick=()=>{state.tab='plans';render();$('#addplan').hidden=false;$('#addplan').scrollIntoView();$('#plan-title').focus()};
  $('#today-reminder')?.addEventListener('click',()=>{state.tab='settings';render();window.scrollTo(0,0)});
  document.querySelectorAll('[data-schedule]').forEach(button=>button.onclick=async()=>{
    $('#today-picker').querySelectorAll('button').forEach(control=>control.disabled=true);
    try{
      const {error}=await sb.from('daily_exercises').upsert({
        household_id:state.house.id,plan_id:button.dataset.schedule,scheduled_on:date
      },{ignoreDuplicates:true});
      if(error)throw error;
      await loadData();render();
    }catch(error){fail(error)}
  });
  document.querySelectorAll('[data-detail]').forEach(button=>button.onclick=()=>{
    const detail=document.getElementById('detail-'+button.dataset.detail);
    detail.hidden=!detail.hidden;
    button.setAttribute('aria-expanded',String(!detail.hidden));
  });
  document.querySelectorAll('[data-check]').forEach(input=>input.onchange=async()=>{
    input.disabled=true;
    try{
      const plan_id=input.dataset.check;
      if(input.checked){
        const {error}=await sb.from('training_logs').insert({household_id:state.house.id,plan_id,user_id:state.user.id,note:''});
        if(error)throw error;
      }else{
        const records=logs.filter(log=>log.plan_id===plan_id&&!log.note);
        for(const record of records){
          const {error}=await sb.from('training_logs').delete().eq('id',record.id);
          if(error)throw error;
        }
      }
      await loadData();render();
    }catch(error){fail(error)}
  });
}
function plans(){
  const existing=new Set(state.plans.map(plan=>plan.title.trim().toLowerCase()));
  const available=templates.map((item,index)=>({item,index})).filter(({item})=>!existing.has(item[0].toLowerCase()));
  frame(`<header class="page-heading"><h1>Übungen</h1><button class="btn secondary" id="show-new-plan">+ Eigene Übung</button></header>
    <details id="plan-templates" class="card section-fold" ${state.plans.length?'':'open'}>
      <summary>Übungsvorlagen <span>${available.length}</span></summary>
      <div class="template-list">${available.map(({item,index})=>`<details class="template-item">
        <summary><strong>${esc(item[0])}</strong><small>${esc(item[3])} · ${esc(item[2])}</small></summary>
        <p>${esc(item[1])}</p><button class="btn secondary" data-template="${index}">Zu meinen Übungen</button>
      </details>`).join('')||'<p class="muted">Alle Vorlagen sind bereits in deiner Liste.</p>'}</div>
    </details>
    <form id="addplan" class="card" hidden><h2>Eigene Übung</h2>
      <div class="field"><label for="plan-title">Titel</label><input id="plan-title" name="title" required placeholder="z. B. Türklingel üben"></div>
      <div class="field"><label for="plan-description">Anleitung</label><textarea id="plan-description" name="description" required></textarea></div>
      <div class="field"><label for="plan-category">Kategorie</label><select id="plan-category" name="category">${['Alleinsein','Pflege','Begrüssung','Grundsignale','Begegnungen','Alltag','Sonstiges'].map(c=>`<option>${c}</option>`).join('')}</select></div>
      <div class="field"><label for="plan-duration">Dauer</label><input id="plan-duration" name="duration" value="3 Min" required></div>
      <button class="btn">Übung speichern</button><p id="plan-form-error" class="small" role="alert"></p>
    </form>
    <h2>Meine Übungen</h2>
    ${state.plans.map(p=>`<details class="card section-fold"><summary><strong>${esc(p.title)}</strong><small>${esc(p.duration)} · ${esc(p.category)}</small></summary>
      <p class="plan-description">${esc(p.description)}</p><div class="actions"><button class="btn secondary" data-log="${esc(p.id)}">Einheit protokollieren</button><button class="btn danger" data-delete="${esc(p.id)}">Entfernen</button></div>
    </details>`).join('')||'<p class="empty">Wähle eine Vorlage oder erstelle eine eigene Übung.</p>'}`);
  $('#show-new-plan').onclick=()=>{
    $('#addplan').hidden=!$('#addplan').hidden;
    if(!$('#addplan').hidden)$('#plan-title').focus();
  };
  $('#addplan').onsubmit=async event=>{
    event.preventDefault();
    const form=event.currentTarget;
    form.querySelector('button').disabled=true;
    try{
      const plan=Object.fromEntries(new FormData(form));
      if(!plan.title.trim()||!plan.description.trim())throw new Error('Bitte gib einen Titel und eine Anleitung ein.');
      await savePlan(plan);
    }catch(error){form.querySelector('button').disabled=false;$('#plan-form-error').textContent=error.message}
  };
  document.querySelectorAll('[data-template]').forEach(button=>button.onclick=async()=>{
    button.disabled=true;
    try{
      const [title,description,duration,category]=templates[Number(button.dataset.template)];
      await savePlan({title,description,duration,category},true);
    }catch(error){fail(error)}
  });
  document.querySelectorAll('[data-delete]').forEach(button=>button.onclick=async()=>{
    if(!confirm('Training und zugehörige Protokolle löschen?'))return;
    try{
      const {error}=await sb.from('training_plans').delete().eq('id',button.dataset.delete);
      if(error)throw error;
      await loadData();render();
    }catch(error){fail(error)}
  });
  document.querySelectorAll('[data-log]').forEach(button=>button.onclick=async()=>{
    const note=prompt('Wie lief es? Kurze Notiz (optional):','');
    if(note===null)return;
    try{
      const {error}=await sb.from('training_logs').insert({household_id:state.house.id,plan_id:button.dataset.log,user_id:state.user.id,note});
      if(error)throw error;
      await loadData();render();
    }catch(error){fail(error)}
  });
}
async function savePlan(plan,keepTemplatesOpen=false){
  const {error}=await sb.from('training_plans').insert({...plan,household_id:state.house.id});
  if(error)throw error;
  state.error='';
  await loadData();render();
  if(keepTemplatesOpen&&state.tab==='plans')$('#plan-templates').open=true;
}
const questionIdeas=[
  ['Badezimmer','Wie übe ich mit Pauli den freiwilligen Gang ins Badezimmer, wenn er bei der Dusche bellt, schreit und weg will?'],
  ['Dusche','Wie gewöhne ich Pauli in sehr kleinen Schritten an Dusche und Wassergeräusche?'],
  ['Beim Essen','Wie trainiere ich mit Pauli, dass er während unseres Essens entspannt auf seinem Bettli bleibt?'],
  ['Alleinbleiben','Pauli ist anfangs ruhig und bellt erst später. Wie finde ich eine passende Dauer für die nächste Trainingseinheit?']
];
function aiQuestions(){
  frame(`<header class="page-heading"><h1>KI fragen</h1></header>
    <div class="card">
      <div class="question-chips" aria-label="Fragevorschläge">${questionIdeas.map(([label],index)=>`<button class="btn secondary" data-question="${index}">${label}</button>`).join('')}</div>
      <div class="field"><label for="ai-question">Deine Trainingsfrage</label><textarea id="ai-question" rows="5" placeholder="Was ist passiert und was hast du schon versucht?"></textarea></div>
      <div class="actions"><button class="btn" id="ai-copy">Frage für ChatGPT kopieren</button><a class="btn secondary ai-link" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">ChatGPT öffnen ↗</a></div>
      <p id="ai-status" class="muted small" role="status">Füge die kopierte Frage in ChatGPT ein. Deine Trainingsdaten bleiben in der App.</p>
    </div>`);
  const field=$('#ai-question');
  document.querySelectorAll('[data-question]').forEach(button=>button.onclick=()=>{
    field.value=questionIdeas[Number(button.dataset.question)][1];
    field.focus();
  });
  $('#ai-copy').onclick=async()=>{
    const question=field.value.trim();
    if(!question){$('#ai-status').textContent='Schreib eine Frage oder wähle oben ein Thema.';field.focus();return}
    const message=`Es geht um meinen English Cocker Spaniel Pauli. Gib mir einen kurzen, belohnungsbasierten nächsten Trainingsschritt mit einem beobachtbaren Erfolgskriterium und sag mir, wann ich die Übung abbrechen soll. Frage nach, falls wichtige Angaben fehlen.\n\n${question}`;
    try{
      await navigator.clipboard.writeText(message);
      $('#ai-status').textContent='Kopiert. Öffne ChatGPT und füge die Frage ein.';
    }catch{
      field.value=message;field.focus();field.select();
      $('#ai-status').textContent='Die Frage ist markiert. Kopiere sie und füge sie in ChatGPT ein.';
    }
  };
}
function progress(){let last7=Array.from({length:7},(_,i)=>{let d=new Date();d.setDate(d.getDate()-6+i);return dateKey(d)});let max=Math.max(1,...last7.map(d=>state.logs.filter(l=>dateKey(new Date(l.done_at))===d).length));frame(`<div class="section"><h2>Fortschritt</h2></div><div class="card"><h3>Letzte 7 Tage</h3><p><strong>${state.logs.filter(log=>last7.includes(dateKey(new Date(log.done_at)))).length}</strong> Trainingseinheiten</p><div style="display:flex;align-items:end;gap:9px;height:150px;margin-top:20px">${last7.map(d=>{let n=state.logs.filter(l=>dateKey(new Date(l.done_at))===d).length;return `<div style="flex:1;text-align:center"><div style="height:${Math.max(4,100*n/max)}px;background:#69b88b;border-radius:7px 7px 2px 2px"></div><small class="muted">${d.slice(8)}</small></div>`}).join('')}</div></div><div class="card"><h3>Trainingshäufigkeit</h3>${state.plans.map(p=>{let n=state.logs.filter(l=>l.plan_id===p.id).length;return `<div style="margin:14px 0"><div class="row"><span>${esc(p.title)}</span><b>${n}×</b></div><div class="progress"><div style="width:${Math.min(100,n*10)}%"></div></div></div>`}).join('')||'<p>Noch keine Einträge.</p>'}</div><div class="section"><h2>Trainingsjournal</h2></div>${state.logs.slice(0,30).map(l=>`<div class="card"><div class="row"><strong>${esc(state.plans.find(p=>p.id===l.plan_id)?.title||'Training')}</strong><span class="muted small">${datetime(l.done_at)}</span></div><p>${esc(l.note||'Erfolgreich abgehakt')}</p></div>`).join('')||'<p class="muted">Noch keine Einheiten protokolliert.</p>'}`)}
function settings(){frame(`${dogProfile()}<div class="card"><h3>Erinnerungen</h3><p>Bei geöffneter App erscheint eine Erinnerung. Für Hinweise bei geschlossener App importiere die Termine in deinen Kalender.</p><form id="remind"><div class="field"><label>Erinnerung</label><input name="title" placeholder="Abendtraining" required></div><div class="field"><label>Uhrzeit</label><input type="time" name="time" value="18:00" required></div><fieldset class="weekdays"><legend>Wochentage</legend>${displayDays.map(d=>`<label><input type="checkbox" name="weekdays" value="${d}" checked> ${weekdayNames[d]}</label>`).join('')}</fieldset><button class="btn">Erinnerung hinzufügen</button></form>${state.reminders.map(r=>`<div class="card row"><span>${esc(r.title)} · ${reminderDays(r)} ${esc(r.time.slice(0,5))}</span><button class="btn danger" data-delrem="${r.id}">Löschen</button></div>`).join('')}<div class="actions"><button class="btn secondary" id="calendar" ${state.reminders.length?'':'disabled'}>Kalenderdatei laden</button></div></div><details class="card section-fold"><summary>Gerätezugang</summary><div class="actions"><button class="btn secondary" id="logout">Link auf diesem Gerät vergessen</button></div></details>`);$('#logout').onclick=()=>{localStorage.removeItem(linkKey);location.reload()};$('#calendar').onclick=calendarFile;$('#remind').onsubmit=async e=>{e.preventDefault();try{const form=new FormData(e.target);const weekdays=form.getAll('weekdays').map(Number);if(!weekdays.length)throw new Error('Wähle mindestens einen Wochentag.');let {error}=await sb.from('reminders').insert({title:form.get('title'),time:form.get('time'),weekdays,household_id:state.house.id});if(error)throw error;await loadData();render()}catch(err){fail(err)}};document.querySelectorAll('[data-delrem]').forEach(b=>b.onclick=async()=>{try{let {error}=await sb.from('reminders').delete().eq('id',b.dataset.delrem);if(error)throw error;await loadData();render()}catch(err){fail(err)}})}
function fail(err){state.error=err.message||String(err);render()}
async function loadData(){let [p,l,r,d]=await Promise.all([sb.from('training_plans').select('*').eq('household_id',state.house.id).order('created_at'),sb.from('training_logs').select('*').eq('household_id',state.house.id).order('done_at',{ascending:false}).limit(500),sb.from('reminders').select('*').eq('household_id',state.house.id).order('time'),sb.from('daily_exercises').select('plan_id,scheduled_on').eq('household_id',state.house.id).eq('scheduled_on',day())]);for(let x of [p,l,r,d])if(x.error)throw x.error;state.plans=p.data;state.logs=l.data;state.reminders=r.data;state.daily=d.data}
async function reload(){
  if(!sb||state.loading){render();return}
  state.loading=true;
  state.error='';
  render();
  try{
    const {data:identity,error}=await sb.rpc('pauli_link_identity').maybeSingle();
    if(error)throw error;
    if(!identity){
      localStorage.removeItem(linkKey);
      state.house=null;
      state.user=null;
      throw new Error('Der Zugangslink ist ungültig oder abgelaufen.');
    }
    const {data:dog,error:profileError}=await sb.from('dog_profile').select('name,birthday,portrait').maybeSingle();
    if(profileError)throw profileError;
    state.user={id:identity.user_id};
    state.house={id:identity.household_id};
    state.dog=dog;
    await loadData();
    localStorage.setItem(linkKey,token);
  }catch(error){state.error=error.message||'Die Tagesliste konnte nicht geladen werden.'}
  finally{state.loading=false;render()}
}
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
if(sb){reload();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.house&&state.tab==='home'&&$('#today-picker')?.hidden&&!document.querySelector('[aria-expanded="true"]')&&!document.querySelector('[data-check]:disabled:not(:checked)'))reload()});setInterval(()=>{if(!state.user||!state.house)return;let now=new Date(),hm=now.toTimeString().slice(0,5),key=day()+hm;for(let r of state.reminders){if(document.visibilityState==='visible'&&r.weekdays.includes(now.getDay())&&r.time.slice(0,5)===hm&&localStorage.getItem('reminder-'+r.id)!==key){localStorage.setItem('reminder-'+r.id,key);alert('🐾 Pauli: '+r.title)}}},30000)}else render();
