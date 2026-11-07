'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const VID=new Set(['mkv','mp4','webm','m4v','mov','avi','ts','wmv','flv']);
const SUBX=new Set(['srt','vtt','ass','ssa','sub']);
const TXT=new Set(['txt','md','json','js','c','h','asm','py','html','css','log','ld','sh','cfg','ini','csv','xml','yml','yaml','s','mk','']);
const col=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
const ext=n=>{const i=n.lastIndexOf('.');return i<0?'':n.slice(i+1).toLowerCase()};
const stem=n=>{const i=n.lastIndexOf('.');return i<0?n:n.slice(0,i)};
const numOf=n=>(n.match(/^(\d+)\s*[.\-_)]/)||[])[1];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmtT=s=>{s=Math.max(0,Math.floor(s||0));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0')};
const fmtLong=s=>{if(!s)return '';const m=Math.round(s/60);return m>=60?Math.floor(m/60)+'hr '+(m%60)+'min':(m<1?'<1':m)+'min'};
const I={star:'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',share:'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z',more:'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',search:'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',close:'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',left:'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',right:'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',gear:'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1112 8.4a3.6 3.6 0 010 7.2z',edit:'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',split:'M3 5v14h18V5H3zm7 12H5V7h5v10zm9 0h-7V7h7v10z',replay:'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z',lec:'M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM10 8v8l6-4z',play:'M8 5v14l11-7z',pause:'M6 19h4V5H6v14zm8-14v14h4V5h-4z',vol:'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z',mute:'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z',full:'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z',cc:'M19 4H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-4a1 1 0 011-1h3a1 1 0 011 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1a1 1 0 01-1 1h-3a1 1 0 01-1-1v-4a1 1 0 011-1h3a1 1 0 011 1v1z',pip:'M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z',check:'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',chev:'M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z',menu:'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',file:'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 7V3.5L18.5 9H13z'};
const ico=(k,z=24)=>`<svg viewBox="0 0 24 24" width="${z}" height="${z}" fill="currentColor"><path d="${I[k]}"/></svg>`;
const v=$('#v');
const S={sections:[],lessons:[],cur:null,tab:'overview',stab:'toc',side:true,p:{},cues:[],tok:0,files:[]};

/* ---------- tiny IndexedDB store for the folder handle ---------- */
const idb=()=>new Promise((res,rej)=>{const r=indexedDB.open('coursedeck',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
async function kv(mode,fn){const db=await idb();return new Promise((res,rej)=>{const tx=db.transaction('kv',mode);const q=fn(tx.objectStore('kv'));tx.oncomplete=()=>res(q&&q.result);tx.onerror=()=>rej(tx.error)})}
const kvGet=k=>kv('readonly',s=>s.get(k)),kvSet=(k,x)=>kv('readwrite',s=>s.put(x,k));

/* ---------- progress store ---------- */
const pkey=()=>'cd:'+(S.cid||S.root);
const CID=new URLSearchParams(location.search).get('c');
function loadP(){if(S.cid&&localStorage[pkey()]===undefined&&localStorage['cd:'+S.root]!==undefined)localStorage[pkey()]=localStorage['cd:'+S.root];try{S.p=JSON.parse(localStorage[pkey()]||'{}')}catch{S.p={}}S.p.done||={};S.p.pos||={};S.p.dur||={};S.p.notes||={};if(S.p.cc===undefined)S.p.cc=true}
/* daily watch log: localStorage['zd:daily'] = {'YYYY-MM-DD': seconds} (local dates, last 400 days kept) */
const dayKey=(d=new Date())=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function flushDay(){const a=S.dayAcc||0;if(a<=0)return;S.dayAcc=0;
  try{const D=JSON.parse(localStorage['zd:daily']||'{}'),k=dayKey();D[k]=(D[k]||0)+a;
    const ks=Object.keys(D).sort();if(ks.length>400)ks.slice(0,ks.length-400).forEach(x=>delete D[x]);
    localStorage['zd:daily']=JSON.stringify(D)}catch{}}
let saveT;const saveP=()=>{clearTimeout(saveT);saveT=setTimeout(()=>{localStorage[pkey()]=JSON.stringify(S.p)},300)};
function toast(t){const e=$('#toast');e.textContent=t;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>e.hidden=true,3500)}

/* ---------- MKV subtitle reader (no re-encode, reads the embedded track) ---------- */
async function mkvSubs(file){
  const SZ=file.size;let ws=0,win=new Uint8Array(0);
  const ensure=async(p,n)=>{const e=Math.min(p+n,SZ);if(p>=ws&&e<=ws+win.length)return;ws=p;win=new Uint8Array(await file.slice(p,Math.min(SZ,p+Math.max(n,4<<20))).arrayBuffer())};
  const vint=async(p,keep)=>{await ensure(p,8);let b=win[p-ws];if(b===undefined)return null;let l=1,m=0x80;while(l<=8&&!(b&m)){l++;m>>=1}if(l>8)return null;await ensure(p,l);let val=keep?b:(b&(m-1)),ones=(b&(m-1))===m-1;for(let i=1;i<l;i++){const c=win[p-ws+i];val=val*256+c;if(c!==255)ones=false}return{v:val,len:l,unk:!keep&&ones}};
  const uint=async(p,n)=>{await ensure(p,n);let x=0;for(let i=0;i<n;i++)x=x*256+win[p-ws+i];return x};
  const MAS=new Set([0x18538067,0x1F43B675,0xA0,0x1654AE6B,0xAE,0x1549A966]);
  let pos=0,scale=1e6,tracks=[],tr=null,sub=null,cl=0,cues=[],grp=null,inClusters=false;
  const dec=new TextDecoder('utf-8');
  while(pos<SZ){
    const id=await vint(pos,true);if(!id)break;
    const sz=await vint(pos+id.len,false);if(!sz)break;
    const ds=pos+id.len+sz.len,T=id.v;
    if(MAS.has(T)){
      if(T===0xAE){tr={};tracks.push(tr)}
      if(T===0xA0)grp=null;
      if(T===0x1F43B675&&!inClusters){inClusters=true;sub=tracks.find(t=>t.type===17);if(!sub)return{cues:[],codec:'none'}}
      pos=ds;continue;
    }
    if(sz.unk)break;
    const end=ds+sz.v;
    if(T===0x2AD7B1)scale=await uint(ds,sz.v);
    else if(T===0xD7&&tr)tr.num=await uint(ds,sz.v);
    else if(T===0x83&&tr)tr.type=await uint(ds,sz.v);
    else if(T===0x86&&tr){await ensure(ds,sz.v);tr.codec=dec.decode(win.subarray(ds-ws,ds-ws+sz.v))}
    else if(T===0xE7)cl=await uint(ds,sz.v);
    else if(T===0x9B&&grp){grp.end=grp.start+(await uint(ds,sz.v))*scale/1e9}
    else if((T===0xA3||T===0xA1)&&sub){
      const t=await vint(ds,false);
      if(t&&t.v===sub.num){
        await ensure(ds,sz.v);const o=ds-ws+t.len;
        const rel=((win[o]<<8|win[o+1])<<16)>>16;
        let txt=dec.decode(win.subarray(o+3,ds-ws+sz.v));
        if(/ASS|SSA/.test(sub.codec))txt=txt.split(',').slice(8).join(',').replace(/\{[^}]*\}/g,'').replace(/\\N/gi,'\n');
        else if(/WEBVTT/.test(sub.codec))txt=txt.split('\n').slice(2).join('\n');
        else if(!/UTF8/.test(sub.codec))return{cues:[],codec:sub.codec};
        const start=(cl+rel)*scale/1e9;
        grp={start,end:start+3,text:txt.replace(/\r/g,'').trim()};
        if(grp.text)cues.push(grp);
        if(T===0xA3)grp=null;
      }
    }
    pos=end;
  }
  cues.sort((a,b)=>a.start-b.start);
  return{cues,codec:sub?sub.codec:'none'};
}

/* ---------- folder scan ---------- */
async function walk(dir,path,out){for await(const[name,h]of dir.entries()){if(h.kind==='directory')await walk(h,[...path,name],out);else out.push({name,path,h})}}
function buildCourse(root,files){
  const vids=files.filter(f=>VID.has(ext(f.name)));
  if(!vids.length)throw new Error('No video files found in that folder. Pick the folder that contains your lessons.');
  let pre=vids[0].path.slice();
  for(const f of vids){let i=0;while(i<pre.length&&i<f.path.length&&pre[i]===f.path[i])i++;pre.length=i}
  const dk=p=>p.join('/'),groups=new Map();
  for(const f of vids){const k=dk(f.path);if(!groups.has(k))groups.set(k,{path:f.path,vids:[]});groups.get(k).vids.push(f)}
  const rel=g=>g.path.slice(pre.length).join('/');
  const gs=[...groups.values()].sort((a,b)=>col.compare(rel(a),rel(b)));
  const extra=files.filter(f=>!VID.has(ext(f.name))&&!SUBX.has(ext(f.name)));
  S.sections=[];S.lessons=[];
  gs.forEach((g,si)=>{
    const raw=g.path.slice(pre.length).join(' / ')||pre[pre.length-1]||root;
    const sec={i:si,raw,title:raw.replace(/^\d+[.\s_-]+/,''),lessons:[],open:false};
    g.vids.sort((a,b)=>col.compare(a.name,b.name)).forEach(f=>{
      const L={id:[...f.path,f.name].join('/'),name:f.name,title:stem(f.name),h:f.h,sec,res:[],n:S.lessons.length};
      sec.lessons.push(L);S.lessons.push(L)});
    extra.filter(f=>dk(f.path)===dk(g.path)).sort((a,b)=>col.compare(a.name,b.name)).forEach(f=>{
      const n=numOf(f.name);
      const hit=sec.lessons.find(L=>stem(L.name)===stem(f.name))||(n&&sec.lessons.find(L=>numOf(L.name)===n))||sec.lessons[0];
      hit.res.push(f)});
    S.sections.push(sec);
  });
  S.files=extra.filter(f=>!groups.has(dk(f.path)));
  S.title=(pre[pre.length-1]||root).replace(/\s*MERGED\d*$/i,'');
}

/* Same lecture twice in one folder (e.g. "1. Intro.mp4" + "1. Intro.mkv"): show it once, prefer .mkv (it has the subtitles).
   Decided from the file names alone, so it needs no saved data. If both lengths are known and clearly differ they are NOT treated as copies. */
function hideDupes(files){
  const isV=f=>VID.has(ext(f.name)),idOf=f=>[...f.path,f.name].join('/'),pref={mkv:0,mp4:1,m4v:2,webm:3,mov:4},
    stem=f=>{const x=f.name.lastIndexOf('.');return f.path.join('/')+'/'+(x<0?f.name:f.name.slice(0,x)).toLowerCase()};
  const g=new Map();for(const f of files)if(isV(f)){const k=stem(f);if(!g.has(k))g.set(k,[]);g.get(k).push(f)}
  const hide=new Set(),dur=(S.p&&S.p.dur)||{};let moved=false;
  for(const arr of g.values()){if(arr.length<2)continue;
    arr.sort((a,b)=>(pref[ext(a.name)]??9)-(pref[ext(b.name)]??9));
    const k=idOf(arr[0]),kd=dur[k]||0;
    for(const f of arr.slice(1)){const id=idOf(f),d=dur[id]||0;
      if(kd&&d&&Math.abs(d-kd)>Math.max(2,kd*0.015))continue;   // different videos, keep both
      hide.add(id);
      if(S.p.done[id]&&!S.p.done[k]){S.p.done[k]=1;moved=true}
      if((S.p.pos[id]||0)>(S.p.pos[k]||0)){S.p.pos[k]=S.p.pos[id];moved=true}}}
  S.hid=hide.size;
  if(moved)localStorage[pkey()]=JSON.stringify(S.p);   // progress made on the hidden copy moves to the visible one
  return hide.size?files.filter(f=>!(isV(f)&&hide.has(idOf(f)))):files}

/* ---------- open / restore ---------- */
async function openCourse(h,auto){
  $('#werr').textContent='Scanning folder...';
  try{
    const files=[];await walk(h,[],files);
    S.root=h.name;S.handle=h;loadP();buildCourse(h.name,hideDupes(files));if(S.course)S.title=S.course.name;
    $('#werr').textContent='';$('#welcome').hidden=true;$('#app').hidden=false;
    $('#ctitle').textContent=S.title;document.title=S.title+' - udemy player';
    S.readme=null;S.annos=[];
    (async()=>{for(const f of S.files){if(!TXT.has(ext(f.name)))continue;try{const x=await f.h.getFile();if(x.size<200000)S.annos.push({name:f.name,text:await x.text()})}catch{}}
      S.readme=(S.annos.find(a=>/readme|about|description/i.test(a.name))||{}).text||null;if(['overview','ann'].includes(S.tab))renderPanel()})();
    applyCapSize();S.tab='overview';
    setSide(innerWidth>=1000,true);
    const last=S.lessons.find(l=>l.id===S.p.last)||S.lessons.find(l=>!S.p.done[l.id])||S.lessons[0];
    S.tok++;durQueue(S.tok);
    await play(last.n,{auto});
  }catch(e){$('#werr').textContent=e.message;console.error(e)}
}
$('#cont').onclick=async()=>{const h=S.saved;if(await h.requestPermission({mode:'read'})==='granted')openCourse(h,true);else $('#werr').textContent='Permission to read the folder was not granted.'};
(async()=>{
  $$('[data-ico]').forEach(e=>e.innerHTML=ico(e.dataset.ico,+e.dataset.sz||24));
  const set=(id,k,z)=>$(id).innerHTML=ico(k,z);
  set('#pp','play');set('#cc','cc');set('#mute','vol');set('#side','split');set('#fs','full');set('#gear','gear');set('#resb','file');set('#addnote','edit');set('#sclose','close');
  set('#prevL','right');set('#nextL','right');set('#openSide','left');
  $('#prevL svg').style.transform='scaleX(-1)';
  $('#back').innerHTML=ico('replay');$('#fwd').innerHTML=ico('replay');$('#fwd svg').style.transform='scaleX(-1)';
  $('#tabs [data-t=search]').innerHTML=ico('search',22);
  if(!CID){location.replace('library.html');return}
  try{
    const lib=await kvGet('lib'),c=lib&&lib.courses.find(x=>x.id===CID);
    if(!c){location.replace('library.html');return}
    S.cid=c.id;S.course=c;S.saved=c.handle;$('#contName').textContent=c.name;$('#cont').hidden=false;
    if(await c.handle.queryPermission({mode:'read'})==='granted')openCourse(c.handle,true);
  }catch(e){$('#werr').textContent=e.message}
})();

/* ---------- header: rating, share, menu ---------- */
$('#more').onclick=e=>{e.stopPropagation();const m=$('#mmenu');const o=m.hidden;closeMenus();m.hidden=!o};
$('#mmenu').onclick=e=>{const a=e.target.dataset.m;if(a==='folder'){location.href='library.html'}
  if(a==='reset'&&confirm('Reset all progress, notes and saved positions for this course?')){S.p={done:{},pos:{},dur:S.p.dur,notes:{},cc:S.p.cc,watchSec:S.p.watchSec};saveP();renderToc();renderPanel()}};
const closeMenus=()=>$$('.mpop').forEach(m=>m.hidden=true);
document.addEventListener('click',closeMenus);

/* ---------- sidebar + course content (dynamic) ---------- */
const doneCount=()=>S.lessons.filter(l=>S.p.done[l.id]).length;
function lecHTML(L){
  const cur=S.cur===L,dn=S.p.done[L.id],d=S.p.dur[L.id];
  return `<div class="lec ${cur?'cur':''}" data-n="${L.n}"><label class="chk"><input type="checkbox" ${dn?'checked':''}><span class="box">${ico('check',14)}</span></label><div class="lec-b"><div class="lec-t">${esc(L.title)}</div><div class="lec-m">${ico(cur&&!v.paused?'pause':'lec',14)}${fmtLong(d)}${L.res.length?`<button class="rbtn" data-res>${ico('file',14)} Resources</button>`:''}</div></div></div>`}
function tocHTML(){return S.sections.map(sec=>{
  const dn=sec.lessons.filter(l=>S.p.done[l.id]).length,tot=sec.lessons.reduce((a,l)=>a+(S.p.dur[l.id]||0),0);
  return `<div class="sec ${sec.open?'open':''}" data-s="${sec.i}"><button class="sec-h"><div><div class="sec-t">Section ${sec.i+1}: ${esc(sec.title)}</div><div class="sec-m">${dn} / ${sec.lessons.length}${tot?' | '+fmtLong(tot):''}</div></div><span class="chev">${ico('chev',20)}</span></button><div class="sec-b">${sec.lessons.map(lecHTML).join('')}</div></div>`}).join('')}
let tocQ;const updateToc=()=>{clearTimeout(tocQ);tocQ=setTimeout(renderToc,150)};
function renderToc(){
  const h=tocHTML();$('#toc').innerHTML=h;const w=$('#cwide');if(w)w.innerHTML=h;
  const t=doneCount(),n=S.lessons.length;
  $('#ring').style.strokeDashoffset=94.25*(1-(n?t/n:0));$('#popTxt').textContent=`${t} of ${n} lectures complete.`;
}
function tocClick(e){
  const sh=e.target.closest('.sec-h');
  if(sh){const s=S.sections[+sh.parentElement.dataset.s];s.open=!s.open;renderToc();return}
  const row=e.target.closest('.lec');if(!row)return;
  const L=S.lessons[+row.dataset.n];
  if(e.target.closest('.chk')){setDone(L,!S.p.done[L.id]);return}
  if(e.target.closest('[data-res]')){openResources(L);return}
  play(L.n,{auto:true});
}
$('#toc').onclick=tocClick;
$('#panel').addEventListener('click',e=>{if(e.target.closest('.sec,.lec'))tocClick(e)});
function setDone(L,val){if(val)S.p.done[L.id]=1;else delete S.p.done[L.id];saveP();renderToc();if(S.tab==='overview')renderPanel()}
function setSide(open,init){
  S.side=open;$('#layout').classList.toggle('nosb',!open);$('#tabContent').hidden=open;$('#openSide').hidden=open;
  if(!open)S.tab='content';else if(S.tab==='content')S.tab='overview';
  if(S.cur)renderPanel();
}
$('#sclose').onclick=()=>setSide(false);$('#openSide').onclick=()=>setSide(true);$('#side').onclick=()=>setSide(!S.side);
$('#stabs').onclick=e=>{const k=e.target.dataset.st;if(!k)return;S.stab=k;$$('#stabs button').forEach(b=>b.classList.toggle('on',b.dataset.st===k));$('#toc').hidden=k!=='toc';$('#trans').hidden=k!=='tr';if(k==='tr')renderTrans()};

/* ---------- playback ---------- */
let blobUrl;
async function play(n,o={}){
  const L=S.lessons[n];if(!L)return;
  hideUpnext();S.cur=L;S.p.last=L.id;S.p.total=S.lessons.length+(S.hid||0);S.p.lastAt=Date.now();S.p.lastTitle=L.title;saveP();L.sec.open=true;
  $('#verr').hidden=true;$('#vtitle').textContent=L.title;
  $('#prevL').hidden=!S.lessons[n-1];$('#nextL').hidden=!S.lessons[n+1];$('#resb').classList.toggle('off',!L.res.length);
  try{
    const f=await L.h.getFile();if(S.cur!==L)return;
    if(blobUrl)URL.revokeObjectURL(blobUrl);
    blobUrl=URL.createObjectURL(f.slice(0,f.size,'video/webm'));
    S.auto=o.auto!==false;S.startAt=o.seek??(S.p.pos[L.id]||0);S.lastSave=0;S.lastT=null;
    v.src=blobUrl;loadSubs(f,L);
  }catch(e){toast('Could not open file: '+e.message)}
  renderToc();renderPanel();
  const row=$(`#toc .lec[data-n="${n}"]`);if(row)row.scrollIntoView({block:'nearest'});
}
v.onloadedmetadata=()=>{
  const d=v.duration;if(isFinite(d)){S.p.dur[S.cur.id]=d;updateToc()}
  if(S.startAt>0&&S.startAt<d-5)v.currentTime=S.startAt;
  v.playbackRate=S.p.rate||1;$('#rate').textContent=(S.p.rate||1)+'x';
  v.volume=S.p.vol??1;$('#vol').value=v.volume;
  if(S.auto)v.play().catch(()=>{});
};
v.onerror=()=>{const e=$('#verr');e.hidden=false;e.innerHTML='<div><b>Chrome could not play this file.</b><br>It probably uses an audio/video codec Chrome cannot decode. Re-encode the audio to AAC (ffmpeg -i in.mkv -c:v copy -c:a aac out.mkv).</div>'};
v.onplay=v.onpause=()=>{
  $('#pp').innerHTML=ico(v.paused?'play':'pause');$('#big').hidden=!v.paused;$('#vw').classList.toggle('vw-paused',v.paused);
  document.querySelectorAll('.lec.cur .lec-m svg:first-child').forEach(m=>m.outerHTML=ico(v.paused?'lec':'pause',14));
  if(v.paused){flushDay();S.lastT=null}
  if(v.paused&&S.cur){S.p.pos[S.cur.id]=v.currentTime;saveP()}};
v.onprogress=()=>{if(v.buffered.length&&v.duration)$('#buf').style.width=v.buffered.end(v.buffered.length-1)/v.duration*100+'%'};
v.ontimeupdate=()=>{
  const d=v.duration||0,t=v.currentTime;if(!d||!S.cur)return;
  const pc=t/d*100;$('#played').style.width=pc+'%';$('#knob').style.left=pc+'%';
  $('#time').textContent=fmtT(t)+' / '+fmtT(d);
  /* watch-time tracking: count only small forward steps while playing (ignores seeks) */
  if(!v.paused&&S.lastT!=null){const dt=t-S.lastT;if(dt>0&&dt<2.5){S.p.watchSec=(S.p.watchSec||0)+dt;S.dayAcc=(S.dayAcc||0)+dt}}
  S.lastT=t;
  if(S.dayAcc>=5)flushDay();
  if(Math.abs(t-S.lastSave)>4){S.lastSave=t;S.p.pos[S.cur.id]=t;saveP()}
  if(t/d>0.9&&!S.p.done[S.cur.id])setDone(S.cur,true);
  hiliteCue(t);
};
v.onended=()=>{
  if(!S.p.done[S.cur.id])setDone(S.cur,true);
  S.p.pos[S.cur.id]=0;saveP();
  const nx=S.lessons[S.cur.n+1];if(nx&&S.p.auto!==false)showUpnext(nx);
};
window.addEventListener('beforeunload',()=>{flushDay();if(S.cur){S.p.pos[S.cur.id]=v.currentTime;localStorage[pkey()]=JSON.stringify(S.p)}});
let unT;
function showUpnext(nx){
  let c=5;$('#unT').textContent=nx.title;$('#unC').textContent=c;$('#upnext').hidden=false;
  unT=setInterval(()=>{c--;$('#unC').textContent=c;if(c<=0){hideUpnext();play(nx.n,{auto:true})}},1000);
  $('#unPlay').onclick=()=>{hideUpnext();play(nx.n,{auto:true})};
}
function hideUpnext(){clearInterval(unT);$('#upnext').hidden=true}
$('#unX').onclick=hideUpnext;

/* ---------- controls ---------- */
const vw=$('#vw'),bar=$('#bar');
const toggle=()=>v.paused?v.play().catch(()=>{}):v.pause();
v.onclick=toggle;$('#pp').onclick=toggle;
const toggleFs=()=>document.fullscreenElement?document.exitFullscreen():vw.requestFullscreen();
v.ondblclick=toggleFs;$('#fs').onclick=toggleFs;
$('#back').onclick=()=>v.currentTime-=5;$('#fwd').onclick=()=>v.currentTime+=5;
$('#prevL').onclick=()=>play(S.cur.n-1);$('#nextL').onclick=()=>play(S.cur.n+1);
function seekEv(e){const r=bar.getBoundingClientRect();v.currentTime=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width))*(v.duration||0)}
bar.onpointerdown=e=>{bar.setPointerCapture(e.pointerId);seekEv(e);bar.onpointermove=seekEv};
bar.onpointerup=()=>{bar.onpointermove=null};
$('#vol').oninput=e=>{v.volume=+e.target.value;v.muted=false;S.p.vol=v.volume;saveP()};
v.onvolumechange=()=>{$('#mute').innerHTML=ico(v.muted||v.volume===0?'mute':'vol')};
$('#mute').onclick=()=>{v.muted=!v.muted};
const RATES=[0.5,0.75,1,1.25,1.5,1.75,2];
$('#rate').onclick=e=>{e.stopPropagation();const m=$('#rmenu'),o=m.hidden;closeMenus();m.innerHTML=RATES.slice().reverse().map(r=>`<button data-r="${r}" class="${(S.p.rate||1)===r?'cur':''}">${r}x</button>`).join('');m.hidden=!o};
$('#rmenu').onclick=e=>{const r=+e.target.dataset.r;if(r)setRate(r)};
function setRate(r){S.p.rate=r;v.playbackRate=r;$('#rate').textContent=r+'x';saveP()}
const tt=v.addTextTrack('subtitles','English','en');
const capFmt=t=>esc(t).replace(/&lt;(\/?)(i|b|u)&gt;/gi,'<$1$2>').replace(/&lt;[^&]*?&gt;/g,'').replace(/\n/g,'</span></div><div><span>');
function showCap(){const el=$('#caps');if(!S.p.cc){el.innerHTML='';return}const a=Array.from(tt.activeCues||[]);el.innerHTML=a.map(c=>`<div><span>${capFmt(c.text)}</span></div>`).join('')}
tt.oncuechange=showCap;
function applyCC(){tt.mode='hidden';$('#cc').classList.toggle('off',!S.p.cc);showCap()}
$('#cc').onclick=()=>{S.p.cc=!S.p.cc;saveP();applyCC()};
const CAPS=[['Small',16],['Medium',22],['Large',30]];
const applyCapSize=()=>document.documentElement.style.setProperty('--cap',CAPS[S.p.cap??1][1]+'px');
const gearHTML=()=>`<button data-g="cap">Caption size: ${CAPS[S.p.cap??1][0]}</button><button data-g="auto">Auto-play next: ${S.p.auto===false?'Off':'On'}</button><button data-g="pip">Mini player</button>`;
$('#gear').onclick=e=>{e.stopPropagation();const m=$('#gmenu'),o=m.hidden;closeMenus();m.innerHTML=gearHTML();m.hidden=!o};
$('#gmenu').onclick=e=>{e.stopPropagation();const g=e.target.dataset.g;
  if(g==='cap'){S.p.cap=((S.p.cap??1)+1)%3;applyCapSize()}
  else if(g==='auto')S.p.auto=S.p.auto===false;
  else if(g==='pip'){document.pictureInPictureElement?document.exitPictureInPicture():v.requestPictureInPicture().catch(()=>{});closeMenus()}
  saveP();if(g!=='pip')$('#gmenu').innerHTML=gearHTML()};
$('#resb').onclick=()=>{if(S.cur.res.length)openResources(S.cur);else toast('This lecture has no resources')};
$('#addnote').onclick=()=>{S.noteT=v.currentTime;v.pause();S.compose=true;S.tab='notes';renderPanel();$('#main').scrollTo({top:vw.offsetHeight,behavior:'smooth'})};
let hideT;
vw.onmousemove=()=>{vw.classList.remove('hide-ui');clearTimeout(hideT);hideT=setTimeout(()=>{if(!v.paused)vw.classList.add('hide-ui')},2500)};
vw.onmouseleave=()=>{if(!v.paused)vw.classList.add('hide-ui')};

document.addEventListener('keydown',e=>{
  if(e.key==='Escape')$('#modal').hidden=true;
  if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)&&e.target.type!=='range'&&e.target.type!=='checkbox')return;
  if(e.ctrlKey||e.metaKey||e.altKey||$('#app').hidden)return;
  const k=e.key;let h=true;
  if(k===' '||k==='k')toggle();
  else if(k==='ArrowLeft')v.currentTime-=5;
  else if(k==='ArrowRight')v.currentTime+=5;
  else if(k==='j')v.currentTime-=10;
  else if(k==='l')v.currentTime+=10;
  else if(k==='ArrowUp'){v.volume=Math.min(1,v.volume+.05);$('#vol').value=v.volume}
  else if(k==='ArrowDown'){v.volume=Math.max(0,v.volume-.05);$('#vol').value=v.volume}
  else if(k==='m')v.muted=!v.muted;
  else if(k==='f')toggleFs();
  else if(k==='c')$('#cc').click();
  else if(k==='>'){const i=RATES.indexOf(S.p.rate||1);if(i<RATES.length-1)setRate(RATES[i+1])}
  else if(k==='<'){const i=RATES.indexOf(S.p.rate||1);if(i>0)setRate(RATES[i-1])}
  else if(k==='N'&&S.lessons[S.cur.n+1])play(S.cur.n+1);
  else if(k==='P'&&S.lessons[S.cur.n-1])play(S.cur.n-1);
  else h=false;
  if(h)e.preventDefault();
});

/* ---------- subtitles + transcript (sidebar tab) ---------- */
async function loadSubs(file,L){
  S.cues=[];Array.from(tt.cues||[]).forEach(c=>tt.removeCue(c));applyCC();renderTrans();
  try{
    const r=await mkvSubs(file);if(S.cur!==L)return;
    S.cues=r.cues;S.subInfo=r.codec;
    r.cues.forEach(c=>{try{tt.addCue(new VTTCue(c.start,c.end,c.text))}catch{}});
    applyCC();
  }catch(e){console.warn('subtitle read failed',e)}
  renderTrans();
}
const clean=t=>t.replace(/<[^>]+>/g,'');
function renderTrans(){
  const T=$('#trans');lastCue=-1;
  if(!S.cues.length){T.innerHTML=`<p class="pad muted">${S.subInfo&&S.subInfo!=='none'&&!/UTF8|ASS|SSA|WEBVTT/.test(S.subInfo)?'This lecture has image-based subtitles, which cannot be shown as a transcript.':'No embedded text subtitles were found in this lecture (or they are still loading).'}</p>`;return}
  T.innerHTML=`<div class="pad"><input id="tq" class="sinput" placeholder="Search the transcript"></div><div id="tlist">${S.cues.map((c,i)=>`<div class="cue" data-i="${i}"><span class="ct">${fmtT(c.start)}</span><span>${esc(clean(c.text)).replace(/\n/g,' ')}</span></div>`).join('')}</div>`;
  $('#tlist').onclick=e=>{const c=e.target.closest('.cue');if(c)v.currentTime=S.cues[+c.dataset.i].start};
  $('#tq').oninput=e=>{const q=e.target.value.toLowerCase();$$('#tlist .cue').forEach(c=>c.hidden=q&&!c.textContent.toLowerCase().includes(q))};
}
let lastCue=-1;
function hiliteCue(t){
  if(S.stab!=='tr'||!S.side||!S.cues.length)return;
  let lo=0,hi=S.cues.length-1,ix=-1;
  while(lo<=hi){const m=(lo+hi)>>1;if(S.cues[m].start<=t){ix=m;lo=m+1}else hi=m-1}
  if(ix===lastCue)return;lastCue=ix;
  const list=$('#tlist');if(!list)return;
  list.querySelector('.cue.on')?.classList.remove('on');
  const el=list.querySelector(`.cue[data-i="${ix}"]`);
  if(el){el.classList.add('on');const a=$('#sbody');a.scrollTop=el.offsetTop-a.clientHeight/2}
}

/* ---------- resources modal ---------- */
async function openResources(L){
  $('#mtitle').textContent='Resources - '+L.title;const B=$('#mbody');B.innerHTML='';$('#modal').hidden=false;
  for(const f of L.res){
    const file=await f.h.getFile();
    const isT=TXT.has(ext(f.name))&&file.size<300000,card=document.createElement('div');card.className='card';
    card.innerHTML=`<div class="card-h">${ico('file',20)}<span>${esc(f.name)}</span><span class="muted" style="font-weight:400">${Math.max(1,Math.round(file.size/1024))} KB</span>${isT?'<button class="btn small" data-c>Copy</button>':''}<button class="btn small" data-d>Download</button></div>`;
    if(isT){const text=await file.text(),pre=document.createElement('pre');pre.textContent=text;card.appendChild(pre);card.querySelector('[data-c]').onclick=()=>navigator.clipboard.writeText(text).then(()=>toast('Copied to clipboard'))}
    card.querySelector('[data-d]').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=f.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)};
    B.appendChild(card);
  }
}
$('#mclose').onclick=()=>$('#modal').hidden=true;
$('#modal').onclick=e=>{if(e.target.id==='modal')$('#modal').hidden=true};

/* ---------- main tabs ---------- */
$('#tabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.tab=b.dataset.t;renderPanel()};
const dl=(name,text)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/markdown'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)};
function renderPanel(){
  $$('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===S.tab));
  const P=$('#panel'),L=S.cur;if(!L)return;
  const T=S.tab;
  if(T==='content'){
    P.innerHTML=`<div class="wide"><div class="wide-h"><button class="link" id="expAll">${S.sections.every(s=>s.open)?'Collapse':'Expand'} all sections</button></div><div id="cwide">${tocHTML()}</div></div>`;
    $('#expAll').onclick=()=>{const o=!S.sections.every(s=>s.open);S.sections.forEach(s=>s.open=o);renderPanel()};
  }else if(T==='overview'){
    const tot=S.lessons.reduce((a,l)=>a+(S.p.dur[l.id]||0),0);
    P.innerHTML=`<h2>${esc(S.title)}</h2><div class="stats"><div><b>${S.lessons.length}</b>Lectures</div><div><b>${S.sections.length}</b>Sections</div><div><b>${fmtLong(tot)||'-'}</b>Total length</div><div><b>${doneCount()} / ${S.lessons.length}</b>Completed</div></div><h3>Now playing</h3><div class="muted">Section ${L.sec.i+1}: ${esc(L.sec.title)} &rsaquo; ${esc(L.title)}</div>${S.readme?`<h3>About this course</h3><pre>${esc(S.readme)}</pre>`:''}`;
  }else if(T==='search'){
    P.innerHTML=`<input id="sq" class="sinput" placeholder="Search lectures, sections and this lecture's transcript" autofocus><div id="sres"></div>`;
    const run=()=>{const q=$('#sq').value.trim().toLowerCase();if(!q){$('#sres').innerHTML='';return}
      const hits=S.lessons.filter(l=>(l.title+' '+l.sec.title).toLowerCase().includes(q)).slice(0,40);
      const cs=S.cues.map((c,i)=>[c,i]).filter(([c])=>clean(c.text).toLowerCase().includes(q)).slice(0,30);
      $('#sres').innerHTML=(hits.length?'<h3>Lectures</h3>':'')+hits.map(l=>`<button class="hit" data-n="${l.n}">${esc(l.title)}<small>Section ${l.sec.i+1}: ${esc(l.sec.title)}</small></button>`).join('')+(cs.length?'<h3>In this lecture</h3>':'')+cs.map(([c,i])=>`<button class="hit" data-t="${c.start}">${esc(clean(c.text)).replace(/\n/g,' ')}<small>${fmtT(c.start)}</small></button>`).join('')||'<p class="muted">No results.</p>'};
    $('#sq').oninput=run;$('#sq').focus();
    $('#sres').onclick=e=>{const b=e.target.closest('.hit');if(!b)return;if(b.dataset.n!==undefined)play(+b.dataset.n,{auto:true});else{v.currentTime=+b.dataset.t;v.play().catch(()=>{})}};
  }else if(T==='qa'){
    const qs=S.p.qa||=[];
    P.innerHTML=`<h2>Questions &amp; answers</h2><p class="muted">Keep your own questions for this course and write the answers when you find them.</p><textarea id="qt" rows="3" placeholder="Write a question for this lecture..."></textarea><div class="row end"><button id="qadd" class="btn small primary">Add question</button></div>${qs.map(q=>`<div class="card"><div class="muted">${esc(q.lec)} &middot; ${fmtT(q.t)}</div><div style="margin:6px 0"><b>${esc(q.q)}</b></div><textarea data-a="${q.id}" rows="2" placeholder="Your answer...">${esc(q.a||'')}</textarea><div class="row end"><button class="link" data-qd="${q.id}">Delete</button></div></div>`).reverse().join('')}`;
    $('#qadd').onclick=()=>{const t=$('#qt').value.trim();if(!t)return;qs.push({id:Date.now(),lec:L.title,t:v.currentTime,q:t,a:''});saveP();renderPanel()};
    P.querySelectorAll('[data-a]').forEach(a=>a.onchange=()=>{qs.find(q=>q.id==a.dataset.a).a=a.value;saveP()});
    P.querySelectorAll('[data-qd]').forEach(b=>b.onclick=()=>{S.p.qa=qs.filter(q=>q.id!=b.dataset.qd);saveP();renderPanel()});
  }else if(T==='notes'){
    let items=[];for(const l of S.lessons){if(!S.notesAll&&l!==L)continue;for(const n of S.p.notes[l.id]||[])items.push({...n,l})}
    items.sort((a,b)=>a.l.n-b.l.n||a.t-b.t);
    P.innerHTML=`<button id="nn" class="newnote">Create a new note at <b>${fmtT(v.currentTime)}</b></button><div id="nform" hidden><textarea id="ntxt" rows="4" placeholder="Write your note..."></textarea><div class="row end"><button id="ncancel" class="btn small">Cancel</button><button id="nsave" class="btn small primary">Save note</button></div></div><div class="row"><select id="nsel"><option value="0" ${S.notesAll?'':'selected'}>Current lecture</option><option value="1" ${S.notesAll?'selected':''}>All lectures</option></select></div>${items.length?'':'<p class="muted">Notes are saved with a timestamp, so you can jump back to the exact moment.</p>'}${items.map(n=>`<div class="note"><span class="pill" data-n="${n.l.n}" data-t="${n.t}">${fmtT(n.t)}</span><div class="nb"><div class="nl">${esc(n.l.title)}</div><div class="nt">${esc(n.text)}</div></div><button class="link" data-del="${n.id}" data-l="${esc(n.l.id)}">Delete</button></div>`).join('')}`;
    const openForm=()=>{$('#nform').hidden=false;$('#nn').hidden=true;$('#ntxt').focus()};
    $('#nn').onclick=()=>{S.noteT=v.currentTime;v.pause();openForm()};
    if(S.compose){S.compose=false;openForm()}
    $('#ncancel').onclick=renderPanel;
    $('#nsave').onclick=()=>{const t=$('#ntxt').value.trim();if(!t)return;(S.p.notes[L.id]||=[]).push({id:Date.now(),t:S.noteT||0,text:t});saveP();renderPanel()};
    $('#nsel').onchange=e=>{S.notesAll=e.target.value==='1';renderPanel()};
    P.querySelectorAll('.pill').forEach(p=>p.onclick=()=>{const l=S.lessons[+p.dataset.n],t=+p.dataset.t;if(l===S.cur){v.currentTime=t;v.play().catch(()=>{})}else play(l.n,{auto:true,seek:t})});
    P.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{S.p.notes[b.dataset.l]=S.p.notes[b.dataset.l].filter(n=>n.id!=b.dataset.del);saveP();renderPanel()});
  }else if(T==='ann'){
    P.innerHTML=`<h2>Announcements</h2>${S.annos&&S.annos.length?S.annos.map(a=>`<div class="card"><div class="card-h">${ico('file',20)}<span>${esc(a.name)}</span></div><pre>${esc(a.text)}</pre></div>`).join(''):'<p class="muted">No announcements. Text files stored next to your course folders (like Readme.txt) show up here.</p>'}`;
  }else if(T==='reviews'){
    const r=S.p.rating||0;
    P.innerHTML=`<h2>Your review</h2><p class="muted">Saved on this computer only.</p><div class="stars" id="stars">${[1,2,3,4,5].map(i=>`<button data-r="${i}" class="${i<=r?'on':''}">${ico('star',34)}</button>`).join('')}</div><textarea id="rtxt" rows="5" placeholder="What did you think of this course?">${esc(S.p.review||'')}</textarea><div class="row end"><button id="rsave" class="btn small primary">Save review</button></div>`;
    $('#stars').onclick=e=>{const b=e.target.closest('button');if(b){S.p.rating=+b.dataset.r;saveP();renderPanel()}};
    $('#rsave').onclick=()=>{S.p.review=$('#rtxt').value;saveP();toast('Review saved')};
  }else{
    P.innerHTML=`<h2>Learning tools</h2><div class="card"><div class="card-h">Export your notes<button class="btn small" id="exn">Download .md</button></div><p class="muted">All notes from every lecture, with timestamps.</p></div><div class="card"><div class="card-h">Progress<span class="muted" style="font-weight:400">${doneCount()} of ${S.lessons.length} lectures complete</span></div></div><h3>Keyboard shortcuts</h3><div class="muted">Space / K play-pause &middot; Left / Right &plusmn;5s &middot; J / L &plusmn;10s &middot; Up / Down volume &middot; M mute &middot; F fullscreen &middot; C captions &middot; &lt; / &gt; speed &middot; Shift+N / Shift+P next / previous lecture</div>`;
    $('#exn').onclick=()=>{let md=`# Notes - ${S.title}\n`;for(const l of S.lessons){const ns=S.p.notes[l.id];if(ns&&ns.length){md+=`\n## ${l.sec.title} / ${l.title}\n`;ns.slice().sort((a,b)=>a.t-b.t).forEach(n=>md+=`- [${fmtT(n.t)}] ${n.text.replace(/\n/g,' ')}\n`)}}dl('notes.md',md)};
  }
}

/* ---------- lecture durations (background, one at a time) ---------- */
/* one video's real length: read from the file header by dur.js (fast, exact), browser probe only as fallback */
async function probeDur(L){try{return await ZD_dur(await L.h.getFile())}catch{return 0}}
async function durQueue(tok){
  for(const L of S.lessons){
    if(tok!==S.tok)return;if(S.p.dur[L.id])continue;
    const d=await probeDur(L);
    if(d>0){S.p.dur[L.id]=d;saveP();updateToc()}
  }
}

