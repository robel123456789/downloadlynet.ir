'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const VID=new Set(['mkv','mp4','webm','m4v','mov','avi','ts','wmv','flv']);
const col=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
const ext=n=>{const i=n.lastIndexOf('.');return i<0?'':n.slice(i+1).toLowerCase()};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmtLong=s=>{if(!s)return '';const m=Math.round(s/60);return m>=60?Math.floor(m/60)+'hr '+(m%60)+'min':(m<1?'<1':m)+'min'};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const clean=n=>n.replace(/\s*MERGED\d*$/i,'').trim();
const COLORS=['#8a8a96','#34d399','#fbbf24','#f87171','#60a5fa','#c4b5fd','#f9a8d4','#67e8f9'];
const ICO={search:'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',close:'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',edit:'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z'};
const ico=(k,z=20)=>`<svg viewBox="0 0 24 24" width="${z}" height="${z}" fill="currentColor"><path d="${ICO[k]}"/></svg>`;
function toast(t){const e=$('#toast');e.textContent=t;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>e.hidden=true,3500)}

/* ---------- storage (folder handles live in IndexedDB) ---------- */
const idb=()=>new Promise((res,rej)=>{const r=indexedDB.open('coursedeck',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
async function kv(mode,fn){const db=await idb();return new Promise((res,rej)=>{const tx=db.transaction('kv',mode);const q=fn(tx.objectStore('kv'));tx.oncomplete=()=>res(q&&q.result);tx.onerror=()=>rej(tx.error)})}
const kvGet=k=>kv('readonly',s=>s.get(k)),kvSet=(k,x)=>kv('readwrite',s=>s.put(x,k));
let L={cats:[],courses:[]},UI={sel:'all',sort:'manual',view:'grid',q:''},perm={};
const save=()=>kvSet('lib',L).then(()=>{if(typeof autoMeasure==='function')autoMeasure()}).catch(e=>toast('Could not save: '+e.message));
const saveUI=()=>{localStorage['zd:libui']=JSON.stringify({sel:UI.sel,sort:UI.sort,view:UI.view})};
const byOrder=(a,b)=>(a.order??0)-(b.order??0);
const catOf=c=>L.cats.find(k=>k.id===c.catId);
const catName=c=>(catOf(c)||{name:'Uncategorized'}).name;
function prog(c){try{return JSON.parse(localStorage['cd:'+c.id]||localStorage['cd:'+c.handle.name]||'{}')}catch{return{}}}
function stat(c){
  const p=prog(c),dp=p.dupe||{},dn=Object.keys(dp).length,dur=p.dur||{};
  const done=Object.keys(p.done||{}).filter(k=>!dp[k]),total=Math.max(0,(p.total||c.count||0)-dn);
  const durs=Object.entries(dur).filter(([k])=>!dp[k]).map(x=>x[1]);
  const doneSec=done.reduce((a,k)=>a+(dur[k]||0),0),allSec=durs.reduce((a,b)=>a+b,0);
  /* watched time: tracked value if present, else estimate (finished lectures + saved position of the rest) */
  const posSec=Object.entries(p.pos||{}).filter(([k])=>!(p.done||{})[k]&&!dp[k]).reduce((a,[,v])=>a+(v||0),0);
  const watchSec=Math.max(p.watchSec||0,doneSec+posSec);
  const known=durs.filter(x=>x>0).length,unk=total?Math.max(0,total-known):0;
  return{done:done.length,total,pct:total?Math.round(done.length/total*100):0,doneSec,allSec,watchSec,known,unk,dupes:dn,pruned:p.pruned===2,lastAt:p.lastAt||0,lastTitle:p.lastTitle||'',started:!!p.lastAt};
}

/* ---------- scanning (directory listings only, no file reads) ---------- */
async function scan(dir){let videos=0,direct=0;
  const walk=async(d,top)=>{for await(const[n,h]of d.entries()){if(h.kind==='directory')await walk(h,false);else if(VID.has(ext(n))){videos++;if(top)direct++}}};
  await walk(dir,true);return{videos,direct}}
async function isDup(h){for(const c of L.courses){try{if(await c.handle.isSameEntry(h))return c}catch{}}return null}

/* ---------- modal helpers ---------- */
function openModal(title,html,wire){$('#mtitle').textContent=title;$('#mbody').innerHTML=html;$('#modal').hidden=false;if(wire)wire($('#mbody'))}
const closeModal=()=>{$('#modal').hidden=true};
$('#mclose').onclick=closeModal;$('#modal').onclick=e=>{if(e.target.id==='modal')closeModal()};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
const catOpts=sel=>'<option value="">Uncategorized</option>'+L.cats.map(k=>`<option value="${k.id}" ${k.id===sel?'selected':''}>${esc(k.name)}</option>`).join('');
function resolveCat(sel,nw){nw=(nw||'').trim();if(nw){let k=L.cats.find(x=>x.name.toLowerCase()===nw.toLowerCase());if(!k){k={id:uid(),name:nw,color:COLORS[L.cats.length%COLORS.length]};L.cats.push(k)}return k.id}return sel||null}
const defCat=()=>['all','none'].includes(UI.sel)?'':UI.sel;

/* ---------- add / edit course ---------- */
async function addFlow(){
  let h;try{h=await showDirectoryPicker({id:'zd-add',mode:'read'})}catch{return}
  if(await isDup(h))return toast('That folder is already in your library');
  openModal('Add course','<p class="muted">Scanning folder...</p>');
  const info=await scan(h);
  if(!info.videos){openModal('Add course','<p>No video files were found in that folder.</p>');return}
  courseModal({h,name:clean(h.name),catId:defCat(),count:info.videos},null);
}
function courseModal(d,c){
  const edit=!!c;
  openModal(edit?'Edit course':'Add course',`<label class="fld">Course name</label><input id="fn" class="sinput" value="${esc(d.name)}"><label class="fld">Category</label><select id="fc" style="width:100%">${catOpts(d.catId)}</select><input id="fnc" class="sinput" style="margin-top:8px" placeholder="...or type a new category (e.g. Kernel, Assembly)"><div class="muted" style="margin:6px 0 4px">Folder: <b>${esc(d.h.name)}</b>${d.count?` &middot; ${d.count} video files`:''}</div><div class="row">${edit?'<button id="relink" class="btn small">Re-link folder</button><button id="rm" class="link">Remove from library</button>':''}<div class="sp"></div><button id="cs" class="btn small primary">${edit?'Save':'Add to library'}</button></div>`,B=>{
    $('#fn').focus();
    $('#cs').onclick=async()=>{
      const name=$('#fn').value.trim()||clean(d.h.name),catId=resolveCat($('#fc').value,$('#fnc').value);
      if(edit){c.name=name;c.catId=catId;c.handle=d.h;if(d.count)c.count=d.count}
      else L.courses.push({id:uid(),name,catId,handle:d.h,added:Date.now(),order:L.courses.length,count:d.count});
      perm[(c||L.courses[L.courses.length-1]).id]='granted';
      await save();closeModal();render();
    };
    if(edit){
      $('#rm').onclick=async()=>{if(confirm(`Remove "${c.name}" from your library? Your folder and files are not touched.`)){L.courses=L.courses.filter(x=>x!==c);await save();closeModal();render()}};
      $('#relink').onclick=async()=>{try{const h=await showDirectoryPicker({id:'zd-add',mode:'read'});const i=await scan(h);if(!i.videos)return toast('No video files in that folder');d.h=h;d.count=i.videos;courseModal(d,c)}catch{}};
    }
  });
}

/* ---------- import many folders at once ---------- */
async function importFlow(){
  let root;try{root=await showDirectoryPicker({id:'zd-import',mode:'read'})}catch{return}
  openModal('Import folders','<p class="muted">Scanning folders...</p>');
  const subs=[];for await(const[n,h]of root.entries())if(h.kind==='directory')subs.push({name:n,h});
  subs.sort((a,b)=>col.compare(a.name,b.name));
  if(!subs.length)return openModal('Import folders','<p>That folder has no subfolders. Use "Add course" for a single course folder.</p>');
  for(const s of subs)s.info=await scan(s.h);
  let mode='courses',l2=false;
  const ensureL2=async()=>{if(l2)return;l2=true;for(const s of subs){s.kids=[];for await(const[n,h]of s.h.entries())if(h.kind==='directory')s.kids.push({name:n,h});s.kids.sort((a,b)=>col.compare(a.name,b.name));for(const k of s.kids)k.info=await scan(k.h)}};
  const draw=async()=>{
    if(mode==='cats'){$('#mbody').innerHTML='<p class="muted">Scanning inside each folder...</p>';await ensureL2()}
    let list='';
    if(mode==='courses')list=subs.map((s,i)=>pickRow(`c${i}`,s)).join('');
    else list=subs.map((s,i)=>{const kids=s.kids.filter(k=>k.info.videos);const own=s.info.direct?[s]:[];return `<div class="grp">${esc(s.name)} <span class="muted" style="font-weight:400">(category)</span></div>`+((kids.length?kids:own).map((k,j)=>pickRow(`k${i}_${j}`,k)).join('')||'<div class="muted pad">No courses inside</div>')}).join('');
    $('#mbody').innerHTML=`<p class="muted">Pick what to import from <b>${esc(root.name)}</b>.</p><div class="radio"><label><input type="radio" name="m" value="courses" ${mode==='courses'?'checked':''}> Each subfolder is a course</label><label><input type="radio" name="m" value="cats" ${mode==='cats'?'checked':''}> Each subfolder is a category that holds courses</label></div>${mode==='courses'?`<label class="fld">Category for these courses</label><select id="ic" style="width:100%">${catOpts(defCat())}</select><input id="inc" class="sinput" style="margin-top:8px" placeholder="...or a new category">`:''}<div style="max-height:44vh;overflow:auto;margin-top:10px">${list}</div><div class="row"><div class="sp"></div><button id="go" class="btn small primary">Import selected</button></div>`;
    $$('input[name=m]').forEach(r=>r.onchange=()=>{mode=r.value;draw()});
    $('#go').onclick=doImport;
  };
  const pickRow=(id,s)=>`<label class="pick ${s.info.videos?'':'dis'}"><input type="checkbox" data-id="${id}" ${s.info.videos?'checked':'disabled'}><span>${esc(clean(s.name))}</span><small>${s.info.videos?s.info.videos+(s.info.videos===1?' video':' videos'):'no videos'}</small></label>`;
  const doImport=async()=>{
    let added=0;const picked=id=>$(`[data-id="${id}"]`)&&$(`[data-id="${id}"]`).checked;
    const add=async(s,catId)=>{if(await isDup(s.h))return;L.courses.push({id:uid(),name:clean(s.name),catId,handle:s.h,added:Date.now(),order:L.courses.length,count:s.info.videos});added++};
    if(mode==='courses'){const catId=resolveCat($('#ic').value,$('#inc').value);for(let i=0;i<subs.length;i++)if(picked('c'+i))await add(subs[i],catId)}
    if(mode==='cats'){for(let i=0;i<subs.length;i++){const s=subs[i],kids=s.kids.filter(k=>k.info.videos),own=s.info.direct?[s]:[],list=kids.length?kids:own;const catId=resolveCat('',s.name);for(let j=0;j<list.length;j++)if(picked(`k${i}_${j}`))await add(list[j],catId)}}
    await save();closeModal();render();toast(added?`Imported ${added} course${added>1?'s':''}`:'Nothing new to import');
  };
  draw();
}

/* ---------- categories ---------- */
function catModal(k){
  const edit=!!k;let color=k?k.color:COLORS[L.cats.length%COLORS.length];
  openModal(edit?'Edit category':'New category',`<label class="fld">Name</label><input id="cn" class="sinput" value="${edit?esc(k.name):''}" placeholder="e.g. Kernel, Assembly, Security"><label class="fld">Color</label><div class="sw" id="sw">${COLORS.map(c=>`<button data-c="${c}" class="${c===color?'on':''}" style="background:${c}"></button>`).join('')}</div><div class="row">${edit?'<button id="cdel" class="link">Delete category</button>':''}<div class="sp"></div><button id="cok" class="btn small primary">${edit?'Save':'Create'}</button></div>`,()=>{
    $('#cn').focus();
    $('#sw').onclick=e=>{const b=e.target.closest('button');if(!b)return;color=b.dataset.c;$$('#sw button').forEach(x=>x.classList.toggle('on',x===b))};
    $('#cok').onclick=async()=>{const name=$('#cn').value.trim();if(!name)return;if(edit){k.name=name;k.color=color}else{const n={id:uid(),name,color};L.cats.push(n);UI.sel=n.id;saveUI()}await save();closeModal();render()};
    if(edit)$('#cdel').onclick=async()=>{if(confirm(`Delete category "${k.name}"? Its courses move to Uncategorized.`)){L.courses.forEach(c=>{if(c.catId===k.id)c.catId=null});L.cats=L.cats.filter(x=>x!==k);if(UI.sel===k.id)UI.sel='all';await save();saveUI();closeModal();render()}};
  });
}
$('#addCat').onclick=()=>catModal(null);

/* ---------- opening a course ---------- */
async function openCourse(c){
  try{
    let p=await c.handle.queryPermission({mode:'read'});
    if(p!=='granted')p=await c.handle.requestPermission({mode:'read'});
    if(p!=='granted')return toast('Access to that folder was not granted');
    location.href='player.html?c='+encodeURIComponent(c.id);
  }catch(e){toast('Folder not available: '+e.message+'. Use Edit > Re-link folder.')}
}

/* ---------- rendering ---------- */
function visible(){
  let a=L.courses.slice();
  if(UI.sel==='none')a=a.filter(c=>!c.catId);else if(UI.sel!=='all')a=a.filter(c=>c.catId===UI.sel);
  const q=UI.q.trim().toLowerCase();if(q)a=a.filter(c=>(c.name+' '+catName(c)).toLowerCase().includes(q));
  const S=new Map(a.map(c=>[c,stat(c)]));
  const cmp={manual:byOrder,recent:(x,y)=>S.get(y).lastAt-S.get(x).lastAt,progress:(x,y)=>S.get(y).pct-S.get(x).pct,name:(x,y)=>col.compare(x.name,y.name),added:(x,y)=>(y.added||0)-(x.added||0)}[UI.sort]||byOrder;
  return a.sort(cmp);
}
function initials(n){const w=n.replace(/[^A-Za-z0-9 ]/g,' ').split(/\s+/).filter(Boolean);return(w.length>1?w[0][0]+w[1][0]:(w[0]||'?').slice(0,2)).toUpperCase()}
function cardHTML(c,drag){
  const s=stat(c),k=catOf(c),colr=k?k.color:'#5a6068',needs=perm[c.id]&&perm[c.id]!=='granted';
  return `<div class="ccard" data-id="${c.id}" ${drag?'draggable="true"':''}><div class="cover" data-act="open" style="background:linear-gradient(135deg,${colr},var(--bg-base) 90%)"><span class="ini">${esc(initials(c.name))}</span><span class="badge">${esc(catName(c))}</span><button class="ib ed" data-act="edit" title="Edit">${ico('edit',18)}</button></div><div class="cbody"><div><div class="cname">${esc(c.name)}</div><div class="cmeta">${s.total?s.total+' lectures':'Not scanned yet'}${s.allSec?' &middot; '+fmtLong(s.allSec)+(s.unk?'+':''):''}${s.unk&&s.allSec?`<span class="need" title="${s.unk} lectures have no measured length yet - measuring automatically">partial</span>`:''}${needs?'<span class="need">Needs access</span>':''}</div></div><div class="pbar"><i style="width:${s.pct}%"></i></div><div class="cfoot"><span>${s.started||s.done?s.pct+'% complete':'Not started'}</span><span>${s.lastTitle?'Last: '+esc(s.lastTitle):''}</span></div><button class="btn small ${s.started?'primary':''}" data-act="open">${s.started?'Continue':'Start'}</button></div></div>`;
}
function renderCats(){
  const counts={all:L.courses.length,none:L.courses.filter(c=>!c.catId).length};
  const row=(id,name,colr,n,drag,edit)=>`<div class="cat ${UI.sel===id?'on':''}" data-id="${id}" ${drag?'draggable="true"':''}><span class="dot" style="background:${colr}"></span><span>${esc(name)}</span><span class="n">${n}</span>${edit?`<button class="ib ce" data-edit="${id}" title="Edit category">${ico('edit',15)}</button>`:''}</div>`;
  $('#cats').innerHTML=row('all','All courses','#8a8a96',counts.all)+L.cats.map(k=>row(k.id,k.name,k.color,L.courses.filter(c=>c.catId===k.id).length,true,true)).join('')+(counts.none&&L.cats.length?row('none','Uncategorized','#5a6068',counts.none):'')+(L.cats.length?'<div class="cat-hint">Drag categories to reorder them. Drag a course card onto a category to move it.</div>':'');
}

/* ---------- daily goal, streak and weekly chart ---------- */
const dKey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const readDaily=()=>{try{return JSON.parse(localStorage['zd:daily']||'{}')}catch{return{}}};
const getGoal=()=>{const g=parseInt(localStorage['zd:goalMin']);return g>0?g:120};
function dailyHTML(){
  const D=readDaily(),goal=getGoal(),goalSec=goal*60,now=new Date(),today=D[dKey(now)]||0;
  const day=n=>{const d=new Date(now);d.setDate(d.getDate()-n);return d};
  /* streak: consecutive days with >=1 min watched; today may still be empty */
  let streak=0,i=(D[dKey(now)]||0)>=60?0:1;for(;(D[dKey(day(i))]||0)>=60;i++)streak++;
  let best=0,run=0;const ks=Object.keys(D).sort();let prev=null;
  ks.forEach(k=>{if(D[k]>=60){const t=new Date(k+'T00:00:00');run=prev&&Math.round((t-prev)/864e5)===1?run+1:1;prev=t;best=Math.max(best,run)}else{run=0;prev=null}});
  best=Math.max(best,streak);
  const week=[...Array(7)].map((_,n)=>{const d=day(6-n);return{d,s:D[dKey(d)]||0}});
  const wTot=week.reduce((a,x)=>a+x.s,0),max=Math.max(goalSec,...week.map(x=>x.s),1);
  const pct=Math.min(1,today/goalSec),R=44,C=2*Math.PI*R;
  const bars=week.map((x,n)=>`<div class="dbar ${n===6?'today':''}" title="${x.d.toDateString()}: ${fmtLong(x.s)||'0min'}"><div class="dcol"><i style="height:${Math.max(x.s?4:0,x.s/max*100)}%" class="${x.s>=goalSec?'hit':''}"></i><u style="bottom:${goalSec/max*100}%"></u></div><span>${x.d.toLocaleDateString('en',{weekday:'short'}).slice(0,3)}</span></div>`).join('');
  return `<div class="dpanel"><div class="dring" data-goal="1" title="Click to change your daily goal"><svg viewBox="0 0 100 100" width="118" height="118"><circle cx="50" cy="50" r="${R}" class="rbg"/><circle cx="50" cy="50" r="${R}" class="rfg ${pct>=1?'full':''}" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-pct)}" transform="rotate(-90 50 50)"/></svg><div class="rin"><b>${fmtLong(today)||'0min'}</b><span>of ${goal>=60&&goal%60===0?goal/60+'hr':goal+'min'} goal</span></div></div>
  <div class="dmid"><div class="dh">Today${pct>=1?' &middot; goal reached 🎉':''}</div><div class="dnums"><div><b>🔥 ${streak}</b><span>day streak</span></div><div><b>${best}</b><span>best streak</span></div><div><b>${fmtLong(wTot)||'0min'}</b><span>last 7 days</span></div></div><button class="btn small" data-goal="1">Set daily goal</button></div>
  <div class="dweek">${bars}</div></div>`}
function render(){
  renderCats();
  const vis=visible(),manual=UI.sort==='manual'&&!UI.q.trim(),all=L.courses.map(stat);
  const doneN=all.reduce((a,s)=>a+s.done,0),totN=all.reduce((a,s)=>a+s.total,0),hrs=all.reduce((a,s)=>a+s.doneSec,0),allHrs=all.reduce((a,s)=>a+s.allSec,0),watchHrs=all.reduce((a,s)=>a+s.watchSec,0),scanned=all.filter(s=>s.allSec).length,unkN=all.reduce((a,s)=>a+s.unk,0);
  const sel=UI.sel==='all'?{name:'All courses'}:UI.sel==='none'?{name:'Uncategorized'}:L.cats.find(k=>k.id===UI.sel)||{name:'All courses'};
  let h=`<div class="stats4"><div class="stat"><b>${L.courses.length}</b><span>Courses</span></div><div class="stat"><b>${L.cats.length}</b><span>Categories</span></div><div class="stat"><b>${doneN} / ${totN||'-'}</b><span>Lectures completed</span></div><div class="stat"><b>${fmtLong(hrs)||'0min'}</b><span>Time completed</span></div><div class="stat"><b>${fmtLong(allHrs)||'0min'}</b><span>Total course hours${unkN?` &middot; ${unkN} of ${totN} lectures not measured`:''}</span></div><div class="stat"><b>${fmtLong(watchHrs)||'0min'}</b><span>Hours watched${allHrs?' &middot; '+Math.min(100,Math.round(watchHrs/allHrs*100))+'% of total':''}</span></div></div>${measureHTML()}`;
  if(!L.courses.length){
    h+=`<div class="big-empty"><h2>Your library is empty</h2><p>Add a course folder once and it stays here. No more choosing folders every time.</p><button class="btn primary" data-act="add">+ Add course</button> <button class="btn" data-act="import">Import folders</button><div class="chips">${['Kernel','Assembly','C Programming','Security'].map(n=>`<button class="chip" data-quick="${n}">+ ${n}</button>`).join('')}</div></div>`;
  }else{
    if(UI.sel==='all'&&!UI.q.trim()){
      h+=dailyHTML();
      const rec=L.courses.map(c=>[c,stat(c)]).filter(([,s])=>s.started).sort((a,b)=>b[1].lastAt-a[1].lastAt).slice(0,3).map(x=>x[0]);
      if(rec.length)h+=`<div class="h2">Continue learning</div><div class="grid">${rec.map(c=>cardHTML(c,false)).join('')}</div>`;
    }
    h+=`<div class="bar2"><div class="h2" style="margin:0">${esc(sel.name)}</div><div class="sp"></div><select id="sort"><option value="manual">My order (drag to reorder)</option><option value="recent">Last watched</option><option value="progress">Most progress</option><option value="name">Name A-Z</option><option value="added">Recently added</option></select><div class="seg"><button data-view="grid" class="${UI.view==='grid'?'on':''}">Grid</button><button data-view="list" class="${UI.view==='list'?'on':''}">List</button></div></div>`;
    const gc=`grid ${UI.view==='list'?'list':''}`;
    if(UI.sel==='all'&&manual){
      const groups=[...L.cats.map(k=>({id:k.id,name:k.name,color:k.color})),{id:'',name:'Uncategorized',color:'#5a6068'}];
      groups.forEach(g=>{const items=vis.filter(c=>(c.catId||'')===g.id);if(!items.length&&!g.id)return;
        h+=`<div class="sech"><span class="dot" style="background:${g.color}"></span>${esc(g.name)} <small>${items.length} course${items.length===1?'':'s'}</small></div><div class="${gc}" data-cat="${g.id}">${items.map(c=>cardHTML(c,true)).join('')||'<div class="empty-cat">Drop a course here</div>'}</div>`});
    }else{
      h+=vis.length?`<div class="${gc}" data-cat="${['all','none'].includes(UI.sel)?'':UI.sel}">${vis.map(c=>cardHTML(c,manual)).join('')}</div>`:'<p class="muted">No courses match.</p>';
    }
  }
  $('#lib').innerHTML=h;const s=$('#sort');if(s)s.value=UI.sort;
}

/* ---------- events ---------- */
$('#lib').addEventListener('click',e=>{
  if(e.target.closest('[data-grant]')){grantAll();return}
  if(e.target.closest('[data-goal]')){const v=prompt('Daily watch goal in minutes (e.g. 120 = 2 hours):',getGoal());if(v!==null){const n=parseInt(v);if(n>0&&n<=1440){localStorage['zd:goalMin']=n;render()}else toast('Enter a number between 1 and 1440')}return}
  const q=e.target.closest('[data-quick]');if(q){const n={id:uid(),name:q.dataset.quick,color:COLORS[L.cats.length%COLORS.length]};L.cats.push(n);UI.sel=n.id;save();saveUI();render();return}
  const v=e.target.closest('[data-view]');if(v){UI.view=v.dataset.view;saveUI();render();return}
  const a=e.target.closest('[data-act]');if(!a)return;
  const card=a.closest('.ccard'),c=card&&L.courses.find(x=>x.id===card.dataset.id);
  if(a.dataset.act==='add')addFlow();else if(a.dataset.act==='import')importFlow();
  else if(a.dataset.act==='edit'){e.stopPropagation();courseModal({h:c.handle,name:c.name,catId:c.catId||'',count:c.count},c)}
  else if(a.dataset.act==='open')openCourse(c);
});
$('#lib').addEventListener('change',e=>{if(e.target.id==='sort'){UI.sort=e.target.value;saveUI();render()}});
$('#cats').addEventListener('click',e=>{
  const ed=e.target.closest('[data-edit]');if(ed){catModal(L.cats.find(k=>k.id===ed.dataset.edit));return}
  const r=e.target.closest('.cat');if(r){UI.sel=r.dataset.id;saveUI();render()}
});
$('#addBtn').onclick=addFlow;$('#importBtn').onclick=importFlow;
$('#q').oninput=e=>{UI.q=e.target.value;render()};

/* drag and drop: reorder courses, move between categories, reorder categories */
let drag=null;
function moveCourse(id,beforeId,catId){
  const arr=L.courses.slice().sort(byOrder),i=arr.findIndex(x=>x.id===id);if(i<0)return;
  const[c]=arr.splice(i,1);if(catId!==undefined)c.catId=catId||null;
  let j=beforeId?arr.findIndex(x=>x.id===beforeId):arr.length;if(j<0)j=arr.length;arr.splice(j,0,c);
  arr.forEach((x,k)=>x.order=k);save();render();
}
document.addEventListener('dragstart',e=>{
  const c=e.target.closest&&e.target.closest('.ccard[draggable]'),k=e.target.closest&&e.target.closest('.cat[draggable]');
  if(c){drag={t:'course',id:c.dataset.id};c.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',c.dataset.id)}
  else if(k){drag={t:'cat',id:k.dataset.id};e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',k.dataset.id)}
});
document.addEventListener('dragend',()=>{drag=null;$$('.dragging,.over,.drop').forEach(x=>x.classList.remove('dragging','over','drop'))});
document.addEventListener('dragover',e=>{
  if(!drag)return;
  const card=e.target.closest('.ccard'),cat=e.target.closest('.cat'),grid=e.target.closest('.grid[data-cat]');
  $$('.over,.drop').forEach(x=>x.classList.remove('over','drop'));
  if(drag.t==='course'){if(card&&card.dataset.id!==drag.id){card.classList.add('over');e.preventDefault()}else if(cat&&cat.dataset.id!=='all'){cat.classList.add('over');e.preventDefault()}else if(grid){grid.classList.add('drop');e.preventDefault()}}
  else if(drag.t==='cat'&&cat&&!['all','none'].includes(cat.dataset.id)&&cat.dataset.id!==drag.id){cat.classList.add('over');e.preventDefault()}
});
document.addEventListener('drop',e=>{
  if(!drag)return;e.preventDefault();
  const card=e.target.closest('.ccard'),cat=e.target.closest('.cat'),grid=e.target.closest('.grid[data-cat]');
  if(drag.t==='course'){
    if(card&&card.dataset.id!==drag.id){const t=L.courses.find(x=>x.id===card.dataset.id);moveCourse(drag.id,t.id,t.catId||'')}
    else if(cat&&cat.dataset.id!=='all')moveCourse(drag.id,null,cat.dataset.id==='none'?'':cat.dataset.id);
    else if(grid)moveCourse(drag.id,null,grid.dataset.cat);
  }else if(drag.t==='cat'&&cat){
    const a=L.cats.findIndex(k=>k.id===drag.id),b=L.cats.findIndex(k=>k.id===cat.dataset.id);
    if(a>=0&&b>=0){const[k]=L.cats.splice(a,1);L.cats.splice(b,0,k);save();render()}
  }
  drag=null;
});

/* ---------- start ---------- */
(async()=>{
  $$('[data-ico]').forEach(e=>e.innerHTML=ico(e.dataset.ico,+e.dataset.sz||20));
  try{Object.assign(UI,JSON.parse(localStorage['zd:libui']||'{}'))}catch{}
  try{L=(await kvGet('lib'))||{cats:[],courses:[]}}catch{}
  if(!L.courses.length){try{const h=await kvGet('handle');if(h){const i=await scan(h);L.courses.push({id:uid(),name:clean(h.name),catId:null,handle:h,added:Date.now(),order:0,count:i.videos});await save()}}catch{}}
  if(UI.sel!=='all'&&UI.sel!=='none'&&!L.cats.some(k=>k.id===UI.sel))UI.sel='all';
  render();
  for(const c of L.courses){try{perm[c.id]=await c.handle.queryPermission({mode:'read'})}catch{perm[c.id]='denied'}}
  render();autoMeasure();
})();


/* the same lecture present twice (original .mp4 + merged .mkv with the same name and length): count it once */
function dupeMap(ids,dur){
  const g=new Map(),pref={mkv:0,mp4:1,m4v:2,webm:3,mov:4};
  for(const id of ids){const i=id.lastIndexOf('/'),nm=id.slice(i+1),x=nm.lastIndexOf('.'),k=id.slice(0,i+1)+(x<0?nm:nm.slice(0,x)).toLowerCase();
    if(!g.has(k))g.set(k,[]);g.get(k).push(id)}
  const out={};
  for(const arr of g.values()){if(arr.length<2)continue;
    arr.sort((a,b)=>(pref[ext(a)]??9)-(pref[ext(b)]??9));
    const kd=dur[arr[0]]||0;
    for(const id of arr.slice(1)){const d=dur[id]||0;if(kd&&d&&Math.abs(d-kd)<=Math.max(2,kd*0.015))out[id]=arr[0]}}
  return out}
/* ---------- automatic exact lengths: runs by itself for every course that has unmeasured lectures ---------- */
const measuring=new Set(),measured=new Set(),mProg={};let mRender=0;
const mSoon=()=>{if(mRender)return;mRender=setTimeout(()=>{mRender=0;render()},700)};
async function measureCourse(c){
  if(measuring.has(c.id)||measured.has(c.id))return;
  try{if(await c.handle.queryPermission({mode:'read'})!=='granted')return}catch{return}   // never prompts; granted courses only
  measuring.add(c.id);measured.add(c.id);
  try{
    const files=[];
    const w=async(d,path)=>{for await(const[n,h]of d.entries()){if(h.kind==='directory')await w(h,[...path,n]);else if(VID.has(ext(n)))files.push({id:[...path,n].join('/'),h})}};
    await w(c.handle,[]);
    const key='cd:'+c.id,get=()=>{try{return JSON.parse(localStorage[key]||localStorage['cd:'+c.handle.name]||'{}')}catch{return{}}};
    const q0=get(),force=q0.pruned!==2,have=q0.dur||{},todo=force?files:files.filter(f=>!(have[f.id]>0)),batch=new Map();   // first run per course: re-read EVERYTHING (cheap), so old wrong values are replaced
    mProg[c.id]={n:0,t:todo.length};
    const flush=()=>{const q=get();q.dur=q.dur||{};for(const[k,v]of batch)q.dur[k]=v;batch.clear();q.total=files.length;localStorage[key]=JSON.stringify(q)};
    let next=0;
    const worker=async()=>{while(next<todo.length){const f=todo[next++];
      try{const d=await ZD_dur(await f.h.getFile());if(d>0)batch.set(f.id,d)}catch{}
      mProg[c.id].n++;if(batch.size>=20){flush()}mSoon()}};
    await Promise.all(Array.from({length:Math.min(6,todo.length)},worker));
    flush();
    {const q=get(),keep={};for(const f of files)if(q.dur&&q.dur[f.id]>0)keep[f.id]=q.dur[f.id];   // drop stale / renamed / removed entries
      q.dur=keep;q.dupe=dupeMap(files.map(f=>f.id),keep);q.total=files.length;q.pruned=2;localStorage[key]=JSON.stringify(q)}
  }catch(e){console.warn('measure failed',c.name,e)}
  finally{measuring.delete(c.id);delete mProg[c.id];render()}
}
function autoMeasure(){for(const c of L.courses){const s=stat(c);if(!s.pruned||s.unk>0||!s.total)measureCourse(c)}}
async function grantAll(){
  for(const c of L.courses){if(!stat(c).unk)continue;
    try{let p=await c.handle.queryPermission({mode:'read'});if(p!=='granted')p=await c.handle.requestPermission({mode:'read'});perm[c.id]=p}catch{perm[c.id]='denied'}}
  render();autoMeasure()}
function measureHTML(){
  const act=Object.values(mProg);
  if(act.length){const n=act.reduce((a,x)=>a+x.n,0),t=act.reduce((a,x)=>a+x.t,0);
    return `<div class="mstat"><span class="spin"></span>Measuring exact video lengths&hellip; ${n} / ${t}</div>`}
  const need=L.courses.filter(c=>stat(c).unk>0&&perm[c.id]!=='granted'&&!measuring.has(c.id)).length;
  return need?`<div class="mstat">${need} course${need===1?'':'s'} need folder access before their lengths can be read. <button class="btn small" data-grant="1">Allow &amp; measure</button></div>`:''}


/* ---------- "Check lengths": re-measure EVERYTHING from scratch, overwrite saved values, explain every gap ---------- */
async function checkAll(onTick){
  const rep=[];rep.twins=[];
  for(let i=0;i<L.courses.length;i++)for(let j=i+1;j<L.courses.length;j++){try{if(await L.courses[i].handle.isSameEntry(L.courses[j].handle))rep.twins.push([L.courses[i].name,L.courses[j].name])}catch{}}
  for(const c of L.courses){
    const row={id:c.id,name:c.name,files:0,header:0,browser:0,kept:0,bad:[],oldSec:stat(c).allSec,newSec:0,access:true,other:{}};
    try{let p=await c.handle.queryPermission({mode:'read'});if(p!=='granted')p=await c.handle.requestPermission({mode:'read'});perm[c.id]=p;if(p!=='granted')throw 0}
    catch{row.access=false;rep.push(row);continue}
    measuring.add(c.id);
    try{
      const files=[];
      const w=async(d,path)=>{for await(const[n,h]of d.entries()){if(h.kind==='directory')await w(h,[...path,n]);
        else if(VID.has(ext(n)))files.push({id:[...path,n].join('/'),h});else{const e=ext(n)||'(none)';row.other[e]=(row.other[e]||0)+1}}};
      await w(c.handle,[]);
      row.files=files.length;
      const key='cd:'+c.id,get=()=>{try{return JSON.parse(localStorage[key]||localStorage['cd:'+c.handle.name]||'{}')}catch{return{}}};
      const old=get().dur||{},fresh={};let next=0,n=0;
      const worker=async()=>{while(next<files.length){const f=files[next++];let r={sec:0,via:'none'};
        try{r=await ZD_durx(await f.h.getFile())}catch{}
        if(r.sec>0){fresh[f.id]=r.sec;row[r.via]++}
        else if(old[f.id]>0){fresh[f.id]=old[f.id];row.kept++;row.bad.push(f.id+'  (kept old value)')}
        else row.bad.push(f.id);
        n++;onTick&&onTick(c.name,n,files.length)}};
      await Promise.all(Array.from({length:Math.min(6,files.length)},worker));
      const dupe=dupeMap(files.map(f=>f.id),fresh),q=get();q.dur=fresh;q.dupe=dupe;q.total=files.length;q.pruned=2;localStorage[key]=JSON.stringify(q);   // stale / removed files are dropped too
      row.dupes=Object.keys(dupe).length;row.dupList=Object.keys(dupe);row.dupSec=row.dupList.reduce((a,k)=>a+(fresh[k]||0),0);
      row.newSec=Object.values(fresh).reduce((a,b)=>a+b,0)-row.dupSec;
    }catch(e){row.err=String(e&&e.message||e)}
    finally{measuring.delete(c.id);measured.add(c.id)}
    rep.push(row);
  }
  return rep}
function reportText(rep){
  const ver=(chrome&&chrome.runtime&&chrome.runtime.getManifest)?chrome.runtime.getManifest().version:'?';
  const tot=rep.reduce((a,r)=>a+r.newSec,0);
  let t=`udemy player length report - extension v${ver} - total ${fmtLong(tot)||'0min'}\n`;
  (rep.twins||[]).forEach(([a,b])=>t+=`\n!! SAME FOLDER ADDED TWICE: "${a}" and "${b}" - every hour is counted twice. Delete one of them.\n`);
  for(const r of rep){
    t+=`\n${r.name}\n  video files: ${r.files} | measured: ${r.header+r.browser+r.kept} (header ${r.header}, browser ${r.browser}, old value kept ${r.kept}) | NOT measured: ${r.bad.length-r.kept}\n  before: ${fmtLong(r.oldSec)||'0min'}  ->  now: ${fmtLong(r.newSec)||'0min'}${r.access?'':'  (no folder access)'}\n`;
    if(r.dupes)t+=`  DUPLICATE COPIES: ${r.dupes} lecture${r.dupes===1?'':'s'} exist twice (same name and length, e.g. original .mp4 + merged .mkv) - counted once, ${fmtLong(r.dupSec)} removed from the total.\n`;
    const o=Object.entries(r.other).sort((a,b)=>b[1]-a[1]).slice(0,6);if(o.length)t+=`  other files ignored: ${o.map(([e,n])=>'.'+e+' x'+n).join(', ')}\n`;
    r.bad.slice(0,25).forEach(b=>t+=`  - ${b}\n`);if(r.bad.length>25)t+=`  ... and ${r.bad.length-25} more\n`;
    if(r.err)t+=`  error: ${r.err}\n`}
  return t}
$('#chkBtn').onclick=async()=>{
  if(!L.courses.length)return toast('No courses yet');
  openModal('Checking video lengths','<div id="chkp" class="muted">Starting&hellip;</div>');
  let last=0;
  const rep=await checkAll((nm,n,t)=>{const now=Date.now();if(now-last<150&&n<t)return;last=now;const e=$('#chkp');if(e)e.textContent=`${nm}: ${n} / ${t}`});
  render();const txt=reportText(rep);
  const rows=rep.map(r=>`<tr><td>${esc(r.name)}</td><td>${r.files}</td><td>${r.header+r.browser+r.kept}</td><td>${r.bad.length-r.kept?`<b style="color:#f5b301">${r.bad.length-r.kept}</b>`:'0'}</td><td>${fmtLong(r.oldSec)||'0min'}</td><td><b>${r.access?(fmtLong(r.newSec)||'0min'):'no access'}</b></td></tr>`).join('');
  $('#mtitle').textContent='Length report';
  const warn=(rep.twins||[]).map(([a,b])=>`<p style="color:#f5b301"><b>Same folder added twice:</b> ${esc(a)} and ${esc(b)} &mdash; hours are counted twice. Delete one.</p>`).join('')+rep.filter(r=>r.dupes).map(r=>`<p style="color:#f5b301"><b>${esc(r.name)}:</b> ${r.dupes} lecture${r.dupes===1?'':'s'} exist twice (${fmtLong(r.dupSec)}), counted once.</p>`).join('');
  $('#mbody').innerHTML=warn+`<table class="chk"><tr><th>Course</th><th>Videos</th><th>Measured</th><th>Not measured</th><th>Before</th><th>Now</th></tr>${rows}</table><pre class="chkpre">${esc(txt)}</pre><button class="btn small primary" id="chkcopy">Copy report</button>`;
  $('#chkcopy').onclick=()=>navigator.clipboard.writeText(txt).then(()=>toast('Report copied'))};
/* refresh when returning from the player */
window.addEventListener('storage',e=>{if(e.key==='zd:daily')render()});
window.addEventListener('focus',()=>{render();autoMeasure()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
