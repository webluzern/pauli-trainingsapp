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
const templates=[['Alleinbleiben','Ruhiges Alleinsein in Mini-Schritten', '2–5 Min','Alleinsein'],['Dusche kennenlernen','Badewanne positiv verknüpfen, ohne Zwang','3 Min','Pflege'],['Ruhige Begrüssung','Vier Pfoten am Boden belohnen','3 Min','Begrüssung'],['Rückruf','Einmal rufen, sofort belohnen','5 Min','Grundsignale'],['Katzen auf Distanz','Distanz vergrössern und ruhiges Schauen belohnen','3 Min','Begegnungen']];
let state={tab:'home',user:null,house:null,plans:[],logs:[],reminders:[],daily:[],error:'',loading:false};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const day=()=>dateKey(new Date());const datetime=x=>new Date(x).toLocaleString('de-CH',{dateStyle:'medium',timeStyle:'short'});
function frame(content){root.innerHTML=`<main class="shell">${state.error?`<div class="notice">${esc(state.error)}</div>`:''}${content}</main>${state.user&&state.house?`<nav class="nav">${[['home','⌂','Heute'],['plans','▤','Übungen'],['progress','◷','Fortschritt'],['settings','⚙','Pauli']].map(([id,ico,t])=>`<button data-tab="${id}" class="${state.tab===id?'active':''}"><b>${ico}</b>${t}</button>`).join('')}</nav>`:''}`;document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;state.error='';render()})}
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
  frame(`<section class="today-summary">
    <div class="today-identity">${portrait}<div><p>${now.toLocaleDateString('de-CH',{weekday:'long',day:'numeric',month:'long'})}</p><h1>Paulis Training</h1>${age===null?'':`<p>${age} ${age===1?'Monat':'Monate'} alt</p>`}</div></div>
    ${exercises.length?`<progress aria-label="Tagesfortschritt" max="${exercises.length}" value="${done}"></progress><p>${done} von ${exercises.length} erledigt</p>`:''}
  </section>
  <section class="today-list"><div class="section"><h2>Heute</h2><button class="btn secondary" id="today-add">+ Übung</button></div>
  <div id="today-picker" hidden>${available.length?`<form class="card" id="schedule"><div class="field"><label for="schedule-plan">Für heute einplanen</label><select id="schedule-plan" name="plan_id">${available.map(p=>`<option value="${esc(p.id)}">${esc(p.title)}</option>`).join('')}</select></div><button class="btn">Hinzufügen</button></form>`:`<button id="new-training" class="btn secondary">Neue Übung erstellen</button>`}</div>
  ${exercises.length?[...open,...exercises.filter(p=>completed.has(p.id))].map(p=>`<article class="exercise">
    <div class="exercise-row"><input type="checkbox" data-check="${esc(p.id)}" aria-label="${esc(p.title)} als erledigt markieren" ${completed.has(p.id)?'checked':''}>
    <button class="exercise-detail" data-detail="${esc(p.id)}" aria-expanded="false"><span><strong>${esc(p.title)}</strong><small>${esc(p.duration)}</small></span><span aria-hidden="true">›</span></button></div>
    <p class="exercise-instructions" id="detail-${esc(p.id)}" hidden>${esc(p.description)}</p>
  </article>`).join(''):'<p class="empty">Heute ist keine Übung geplant.</p>'}</section>`);
  $('#today-add').onclick=()=>{$('#today-picker').hidden=!$('#today-picker').hidden};
  $('#new-training')?.addEventListener('click',()=>{state.tab='plans';render();$('#addplan')?.scrollIntoView()});
  $('#schedule')?.addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.currentTarget;
    form.querySelector('button').disabled=true;
    try{
      const plan_id=new FormData(form).get('plan_id');
      const {error}=await sb.from('daily_exercises').upsert({
        household_id:state.house.id,plan_id,scheduled_on:date
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
        const record=logs.find(log=>log.plan_id===plan_id&&!log.note);
        if(record){
          const {error}=await sb.from('training_logs').delete().eq('id',record.id);
          if(error)throw error;
        }
      }
      await loadData();render();
    }catch(error){fail(error)}
  });
}
function plans(){frame(`<div class="section"><h2>Trainingspläne</h2></div>${state.plans.map(p=>`<div class="card"><div class="row"><h3>${esc(p.title)}</h3><span class="tag">${esc(p.category)}</span></div><p>${esc(p.description)}</p><div class="actions"><span class="muted small">⏱ ${esc(p.duration)}</span><button class="btn secondary" data-log="${p.id}">Einheit protokollieren</button><button class="btn danger" data-delete="${p.id}">Entfernen</button></div></div>`).join('')}<div class="card"><h3>Neues Training</h3><form id="addplan"><div class="field"><label>Titel</label><input name="title" required placeholder="z. B. Türklingel üben"></div><div class="field"><label>Beschreibung</label><textarea name="description" required></textarea></div><div class="field"><label>Kategorie</label><select name="category">${['Alleinsein','Pflege','Begrüssung','Grundsignale','Begegnungen','Sonstiges'].map(c=>`<option>${c}</option>`).join('')}</select></div><div class="field"><label>Dauer</label><input name="duration" value="3 Min" required></div><button class="btn">Training hinzufügen</button></form></div>${state.plans.length===0?`<button class="btn secondary" id="seed">5 Pauli-Trainingsvorlagen laden</button>`:''}`);$('#addplan').onsubmit=async e=>{e.preventDefault();try{let o=Object.fromEntries(new FormData(e.target));let {error}=await sb.from('training_plans').insert({...o,household_id:state.house.id});if(error)throw error;await loadData();render()}catch(err){fail(err)}};$('#seed')?.addEventListener('click',async()=>{try{let {error}=await sb.from('training_plans').insert(templates.map(([title,description,duration,category])=>({household_id:state.house.id,title,description,duration,category})));if(error)throw error;await loadData();render()}catch(err){fail(err)}});document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Training und zugehörige Protokolle löschen?'))return;try{let {error}=await sb.from('training_plans').delete().eq('id',b.dataset.delete);if(error)throw error;await loadData();render()}catch(err){fail(err)}});document.querySelectorAll('[data-log]').forEach(b=>b.onclick=async()=>{let note=prompt('Wie lief es? Kurze Notiz (optional):','');if(note===null)return;try{let {error}=await sb.from('training_logs').insert({household_id:state.house.id,plan_id:b.dataset.log,user_id:state.user.id,note});if(error)throw error;await loadData();render()}catch(err){fail(err)}})}
function progress(){let last7=Array.from({length:7},(_,i)=>{let d=new Date();d.setDate(d.getDate()-6+i);return dateKey(d)});let max=Math.max(1,...last7.map(d=>state.logs.filter(l=>dateKey(new Date(l.done_at))===d).length));frame(`<div class="section"><h2>Fortschritt</h2></div><div class="card"><h3>Einheiten in den letzten 7 Tagen</h3><div style="display:flex;align-items:end;gap:9px;height:150px;margin-top:20px">${last7.map(d=>{let n=state.logs.filter(l=>dateKey(new Date(l.done_at))===d).length;return `<div style="flex:1;text-align:center"><div style="height:${Math.max(4,100*n/max)}px;background:#69b88b;border-radius:7px 7px 2px 2px"></div><small class="muted">${d.slice(8)}</small></div>`}).join('')}</div></div><div class="card"><h3>Trainingshäufigkeit</h3>${state.plans.map(p=>{let n=state.logs.filter(l=>l.plan_id===p.id).length;return `<div style="margin:14px 0"><div class="row"><span>${esc(p.title)}</span><b>${n}×</b></div><div class="progress"><div style="width:${Math.min(100,n*10)}%"></div></div></div>`}).join('')||'<p>Noch keine Einträge.</p>'}</div><div class="section"><h2>Trainingsjournal</h2></div>${state.logs.slice(0,30).map(l=>`<div class="card"><div class="row"><strong>${esc(state.plans.find(p=>p.id===l.plan_id)?.title||'Training')}</strong><span class="muted small">${datetime(l.done_at)}</span></div><p>${esc(l.note||'Erfolgreich abgehakt')}</p></div>`).join('')||'<p class="muted">Noch keine Einheiten protokolliert.</p>'}`)}
function settings(){frame(`${dogProfile()}<div class="card"><h3>Erinnerungen</h3><p>Bei geöffneter App erscheint eine Erinnerung. Für Hinweise bei geschlossener App importiere die Termine in deinen Kalender.</p><form id="remind"><div class="field"><label>Erinnerung</label><input name="title" placeholder="Abendtraining" required></div><div class="field"><label>Uhrzeit</label><input type="time" name="time" value="18:00" required></div><fieldset class="weekdays"><legend>Wochentage</legend>${displayDays.map(d=>`<label><input type="checkbox" name="weekdays" value="${d}" checked> ${weekdayNames[d]}</label>`).join('')}</fieldset><button class="btn">Erinnerung hinzufügen</button></form>${state.reminders.map(r=>`<div class="card row"><span>${esc(r.title)} · ${reminderDays(r)} ${esc(r.time.slice(0,5))}</span><button class="btn danger" data-delrem="${r.id}">Löschen</button></div>`).join('')}<div class="actions"><button class="btn secondary" id="calendar" ${state.reminders.length?'':'disabled'}>Kalenderdatei laden</button></div></div><div class="card"><h3>Zugang</h3><div class="actions"><button class="btn secondary" id="logout">Link auf diesem Gerät vergessen</button></div></div>`);$('#logout').onclick=()=>{localStorage.removeItem(linkKey);location.reload()};$('#calendar').onclick=calendarFile;$('#remind').onsubmit=async e=>{e.preventDefault();try{const form=new FormData(e.target);const weekdays=form.getAll('weekdays').map(Number);if(!weekdays.length)throw new Error('Wähle mindestens einen Wochentag.');let {error}=await sb.from('reminders').insert({title:form.get('title'),time:form.get('time'),weekdays,household_id:state.house.id});if(error)throw error;await loadData();render()}catch(err){fail(err)}};document.querySelectorAll('[data-delrem]').forEach(b=>b.onclick=async()=>{try{let {error}=await sb.from('reminders').delete().eq('id',b.dataset.delrem);if(error)throw error;await loadData();render()}catch(err){fail(err)}})}
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
if(sb){reload();setInterval(()=>{if(!state.user||!state.house)return;let now=new Date(),hm=now.toTimeString().slice(0,5),key=day()+hm;for(let r of state.reminders){if(document.visibilityState==='visible'&&r.weekdays.includes(now.getDay())&&r.time.slice(0,5)===hm&&localStorage.getItem('reminder-'+r.id)!==key){localStorage.setItem('reminder-'+r.id,key);alert('🐾 Pauli: '+r.title)}}},30000)}else render();
