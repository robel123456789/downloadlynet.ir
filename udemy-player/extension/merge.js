'use strict';
/* Merge subtitles: talks to the native helper (com.zeroday.merge) which runs merge_course_subs.py */
(()=>{
const HOST='com.zeroday.merge',KEY='zd:merge';
const S={port:null,ready:false,info:null,log:[],running:false,done:0,total:0,summary:'',err:''};
const pref=()=>{try{return Object.assign({src:'',out:'',inPlace:false,dryRun:false,skipExisting:true,deleteOriginals:false,subCodec:'srt'},JSON.parse(localStorage[KEY]||'{}'))}catch{return{}}};
const setPref=p=>{try{localStorage[KEY]=JSON.stringify(p)}catch{}};
const el=id=>document.getElementById(id);
let waiter=null;                                   // one pending request (ping / pick)

function connect(){
  if(S.port)return;
  try{S.port=chrome.runtime.connectNative(HOST)}catch(e){S.err=String(e.message||e);return}
  S.port.onMessage.addListener(onMsg);
  S.port.onDisconnect.addListener(()=>{
    const m=chrome.runtime.lastError&&chrome.runtime.lastError.message||'';
    S.port=null;S.ready=false;
    if(S.running){S.running=false;addLog('e','Helper disconnected: '+m)}
    S.info=null;S.err=m||'Helper not reachable';
    if(waiter){waiter(null);waiter=null}
    render();
  });
  S.port.postMessage({cmd:'ping'});
}
function ask(msg){return new Promise(res=>{if(!S.port)connect();if(!S.port)return res(null);waiter=res;S.port.postMessage(msg)})}

function addLog(c,t){S.log.push([c,t]);if(S.log.length>3000)S.log.splice(0,500);const L=el('mgLog');if(L){const d=document.createElement('div');d.className=c;d.textContent=t;L.appendChild(d);while(L.children.length>2000)L.firstChild.remove();L.scrollTop=L.scrollHeight}}
const cls=l=>/^MERGE/.test(l)?'m':/^COPY/.test(l)?'c':/^SKIP/.test(l)?'s':/^DELETE/.test(l)?'d':/FAILED|ERROR|Traceback/i.test(l)?'e':/^Done\./.test(l)?'ok':'c';

function onMsg(m){
  if(m.type==='pong'){S.info=m;S.ready=true;S.err='';if(m.busy)S.running=true;if(waiter){waiter(m);waiter=null}render();if(autoStart&&!S.running){autoStart=false;const g=el('mgGo');if(g)g.click()}}
  else if(m.type==='picked'){if(m.error)toast(m.error);if(waiter){waiter(m);waiter=null}}
  else if(m.type==='start'){S.total=m.total;S.done=0;S.log=[];const L=el('mgLog');if(L)L.innerHTML='';addLog('c','> merge_course_subs.py '+m.cmd);addLog('c','Found '+m.total+' video+subtitle pair(s) to merge.');prog()}
  else if(m.type==='log'){if(/^(MERGE|SKIP)/.test(m.line))S.done++;addLog(cls(m.line),m.line);prog()}
  else if(m.type==='error'){S.running=false;S.summary='';addLog('e',m.message);S.err='';busy(false);setSum('<span style="color:var(--color-error)">'+esc(m.message)+'</span>')}
  else if(m.type==='done'){
    S.running=false;busy(false);
    const t=m.cancelled?'Cancelled.':m.dryRun?`Dry run finished - would merge ${m.merged||0} file(s). Nothing was written.`:m.failed?`Finished with ${m.failed} failure(s): merged ${m.merged}, copied ${m.copied}, skipped ${m.skipped}.`:`Done - merged ${m.merged}, copied ${m.copied}, skipped ${m.skipped}.`;
    S.summary=t;setSum(esc(t));if(el('mgBar'))el('mgBar').style.width=m.cancelled?el('mgBar').style.width:'100%';
    if(!el('mgLog'))toast(t);
    const a=el('mgAdd');if(a&&!m.dryRun&&!m.cancelled&&!m.failed)a.hidden=false;
  }
}
function prog(){const b=el('mgBar');if(b)b.style.width=(S.total?Math.min(100,S.done/S.total*100):0)+'%';const c=el('mgCount');if(c)c.textContent=S.running?`${S.done} / ${S.total}`:''}
const setSum=h=>{const e=el('mgSum');if(e)e.innerHTML=h};
function busy(on){['mgGo','mgSrcB','mgOutB','mgSrc','mgOut'].forEach(i=>{const e=el(i);if(e)e.disabled=on});const c=el('mgCancel');if(c)c.hidden=!on;const g=el('mgGo');if(g)g.hidden=on}

function pathBox(id,label,val,ph){return `<label class="fld">${label}</label><div class="mg-path"><input id="${id}" class="sinput" value="${esc(val)}" placeholder="${ph}" spellcheck="false"><button id="${id}B" class="btn small">Browse...</button></div>`}
function render(){
  if(!el('mgRoot'))return;
  const P=pref(),root=el('mgRoot');
  if(!S.ready){
    root.innerHTML=S.err?`<div class="mg-warn"><b>The merge helper is not installed yet.</b><br>One-time setup (10 seconds):<br>1. Open the <code>native-host</code> folder that came with this extension.<br>2. Double-click <code>install_lock.bat</code> (asks for administrator rights once).<br>3. Fully restart Chrome, then open this window again.<br><span class="muted">Chrome said: ${esc(S.err)}</span></div><div class="row"><div class="sp"></div><button id="mgRetry" class="btn small">Check again</button></div>`:'<p class="muted">Connecting to helper...</p>';
    const r=el('mgRetry');if(r)r.onclick=()=>{S.err='';S.info=null;S.port=null;render();connect()};
    return;
  }
  root.innerHTML=`<div class="mg-st">Helper v${esc(S.info.version)} &middot; Python ${esc(S.info.python)} &middot; ffmpeg ${S.info.ffmpeg?'<span class="ok">found</span>':'<span class="bad">NOT found</span> - run <code>winget install Gyan.FFmpeg</code> and restart Chrome'}</div>
  <p class="muted" style="margin:4px 0">Finds every video that has a same-named subtitle in the same folder and merges them into one .mkv with a selectable subtitle track (no re-encoding, fast). Everything else is copied unchanged.</p>
  ${pathBox('mgSrc','Course folder (source)',P.src,'D:\\Courses\\My Course')}
  <div class="mg-seg"><label><input type="radio" name="mgMode" value="out" ${P.inPlace?'':'checked'}> Write to a separate output folder</label><label><input type="radio" name="mgMode" value="in" ${P.inPlace?'checked':''}> In-place (next to originals)</label></div>
  <div id="mgOutWrap" ${P.inPlace?'hidden':''}>${pathBox('mgOut','Output folder',P.out,'D:\\Courses\\My Course MERGED')}</div>
  <div class="mg-opts">
    <label><input type="checkbox" id="mgSkip" ${P.skipExisting?'checked':''}> Skip files already merged (resume)</label>
    <label><input type="checkbox" id="mgDry" ${P.dryRun?'checked':''}> Dry run (preview only)</label>
    <label class="danger"><input type="checkbox" id="mgDel" ${P.deleteOriginals?'checked':''}> Delete originals after success</label>
    <label>Subtitle format <select id="mgCodec">${['srt','webvtt','ass','copy'].map(c=>`<option ${c===P.subCodec?'selected':''}>${c}</option>`).join('')}</select></label>
  </div>
  <div class="row"><span id="mgCount" class="muted"></span><div class="sp"></div><button id="mgAdd" class="btn small" hidden>Add merged folder as course</button><button id="mgCancel" class="btn small" hidden>Cancel</button><button id="mgGo" class="btn small primary">Start merge</button></div>
  <div class="mg-bar"><i id="mgBar"></i></div><div id="mgSum" class="mg-sum">${esc(S.summary)}</div>
  <div id="mgLog" class="mg-log"></div>`;
  const L=el('mgLog');S.log.forEach(([c,t])=>{const d=document.createElement('div');d.className=c;d.textContent=t;L.appendChild(d)});L.scrollTop=L.scrollHeight;
  wire();busy(S.running);prog();
}
function read(){const P={src:el('mgSrc').value.trim().replace(/^"|"$/g,''),out:(el('mgOut')?el('mgOut').value:'').trim().replace(/^"|"$/g,''),inPlace:document.querySelector('input[name=mgMode]:checked').value==='in',skipExisting:el('mgSkip').checked,dryRun:el('mgDry').checked,deleteOriginals:el('mgDel').checked,subCodec:el('mgCodec').value};setPref(P);return P}
function wire(){
  document.querySelectorAll('input[name=mgMode]').forEach(r=>r.onchange=()=>{el('mgOutWrap').hidden=read().inPlace});
  el('mgSrc').onchange=()=>{const P=read();if(P.src&&!el('mgOut').value){el('mgOut').value=P.src.replace(/[\\\/]+$/,'')+' MERGED';read()}};
  const pick=async(id,title)=>{const r=await ask({cmd:'pick',title,initial:el(id).value});if(r&&r.path){el(id).value=r.path;el(id).onchange&&el(id).onchange();read()}};
  el('mgSrcB').onclick=()=>pick('mgSrc','Choose the course folder');
  el('mgOutB').onclick=()=>pick('mgOut','Choose the output folder');
  el('mgAdd').onclick=()=>{closeModal();addFlow()};
  el('mgCancel').onclick=()=>{S.port&&S.port.postMessage({cmd:'cancel'});setSum('Cancelling...')};
  el('mgGo').onclick=()=>{
    const P=read();
    if(!P.src)return setSum('<span style="color:var(--color-error)">Choose the source folder first.</span>');
    if(!P.inPlace&&!P.out)return setSum('<span style="color:var(--color-error)">Choose an output folder, or switch to in-place.</span>');
    if(P.deleteOriginals&&!P.dryRun&&!confirm('Originals (video + subtitle) will be PERMANENTLY DELETED after each successful merge. Continue?'))return;
    S.running=true;S.summary='';S.done=0;S.total=0;setSum('');const a=el('mgAdd');if(a)a.hidden=true;busy(true);prog();
    S.port.postMessage(Object.assign({cmd:'merge'},P));
  };
}
let autoStart=false;
function open(opts){
  openModal('Merge subtitles into videos','<div id="mgRoot"></div>');
  if(opts&&opts.src){const P=pref();P.src=opts.src;if(opts.autoStart)P.inPlace=true;setPref(P)}
  autoStart=!!(opts&&opts.autoStart);
  S.err=S.ready?'':S.err;render();
  if(S.ready&&autoStart){autoStart=false;const g=el('mgGo');if(g)g.click()}
  if(!S.port){S.info=null;S.ready=false;S.err='';connect()}else if(!S.ready)S.port.postMessage({cmd:'ping'});
}
document.getElementById('mergeBtn').onclick=()=>open();
window.openMergeSubs=open;   // exposed so extract.js can hand off straight into this step; pass {src,autoStart:true} to chain automatically
})();
