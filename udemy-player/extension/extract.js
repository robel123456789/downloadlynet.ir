'use strict';
/* Extract .rar archives (WinRAR, multi-part or legacy split) found anywhere in a folder,
   then hand off into the existing "Merge subtitles" step. Talks to the same native helper
   (com.zeroday.merge) which runs extract_course_rars.py. */
(()=>{
const HOST='com.zeroday.merge',KEY='zd:extract',MKEY='zd:merge';
const S={port:null,ready:false,info:null,log:[],running:false,done:0,total:0,summary:'',err:''};
const pref=()=>{try{return Object.assign({src:'',dryRun:false,deleteOriginals:false,autoMerge:true},JSON.parse(localStorage[KEY]||'{}'))}catch{return{}}};
const setPref=p=>{try{localStorage[KEY]=JSON.stringify(p)}catch{}};
const el=id=>document.getElementById(id);
let waiter=null;

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

function addLog(c,t){S.log.push([c,t]);if(S.log.length>3000)S.log.splice(0,500);const L=el('xLog');if(L){const d=document.createElement('div');d.className=c;d.textContent=t;L.appendChild(d);while(L.children.length>2000)L.firstChild.remove();L.scrollTop=L.scrollHeight}}
const cls=l=>/^EXTRACT/.test(l)?'m':/^DELETE/.test(l)?'d':/FAILED|ERROR|Traceback/i.test(l)?'e':/^Done\./.test(l)?'ok':/^----/.test(l)?'s':'c';

function onMsg(m){
  if(m.type==='pong'){S.info=m;S.ready=true;S.err='';if(m.busy)S.running=true;if(waiter){waiter(m);waiter=null}render()}
  else if(m.type==='picked'){if(m.error)toast(m.error);if(waiter){waiter(m);waiter=null}}
  else if(m.type==='xstart'){S.total=m.total;S.done=0;S.log=[];const L=el('xLog');if(L)L.innerHTML='';addLog('c','> extract_course_rars.py '+m.cmd);addLog('c','Found '+m.total+' archive set(s) to extract.');prog()}
  else if(m.type==='xlog'){if(/^EXTRACT/.test(m.line))S.done++;addLog(cls(m.line),m.line);prog()}
  else if(m.type==='xerror'){S.running=false;S.summary='';addLog('e',m.message);S.err='';busy(false);setSum('<span style="color:var(--color-error)">'+esc(m.message)+'</span>')}
  else if(m.type==='xdone'){
    S.running=false;busy(false);
    const t=m.cancelled?'Cancelled.':m.dryRun?`Dry run finished - would extract ${m.extracted||0} archive set(s). Nothing was written.`:m.failed?`Finished with ${m.failed} failure(s): extracted ${m.extracted||0}.`:`Done - extracted ${m.extracted||0} archive set(s).`;
    S.summary=t;setSum(esc(t));if(el('xBar'))el('xBar').style.width=m.cancelled?el('xBar').style.width:'100%';
    if(!el('xLog'))toast(t);
    const srcPath=m.src||(el('xSrc')?read().src:pref().src);
    if(!m.dryRun&&!m.cancelled&&(m.extracted||0)>0){
      if(pref().autoMerge&&window.openMergeSubs){
        addLog('ok','Handing off to Merge subtitles automatically...');
        window.openMergeSubs({src:srcPath,autoStart:true});
        return;
      }
      const a=el('xNext');
      if(a){a.hidden=false;a.dataset.src=srcPath}
    }
  }
}
function prog(){const b=el('xBar');if(b)b.style.width=(S.total?Math.min(100,S.done/S.total*100):0)+'%';const c=el('xCount');if(c)c.textContent=S.running?`${S.done} / ${S.total}`:''}
const setSum=h=>{const e=el('xSum');if(e)e.innerHTML=h};
function busy(on){['xGo','xSrcB','xSrc'].forEach(i=>{const e=el(i);if(e)e.disabled=on});const c=el('xCancel');if(c)c.hidden=!on;const g=el('xGo');if(g)g.hidden=on}
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function render(){
  if(!el('xRoot'))return;
  const P=pref(),root=el('xRoot');
  if(!S.ready){
    root.innerHTML=S.err?`<div class="mg-warn"><b>The helper is not installed yet.</b><br>One-time setup (10 seconds):<br>1. Open the <code>native-host</code> folder that came with this extension.<br>2. Double-click <code>install_lock.bat</code> (asks for administrator rights once).<br>3. Fully restart Chrome, then open this window again.<br><span class="muted">Chrome said: ${esc(S.err)}</span></div><div class="row"><div class="sp"></div><button id="xRetry" class="btn small">Check again</button></div>`:'<p class="muted">Connecting to helper...</p>';
    const r=el('xRetry');if(r)r.onclick=()=>{S.err='';S.info=null;S.port=null;render();connect()};
    return;
  }
  const winrarLine=S.info.winrar?'<span class="ok">found</span>':'<span class="bad">NOT found</span> - install it from <a href="https://www.win-rar.com/" target="_blank" rel="noopener">win-rar.com</a> (the free trial works) and restart Chrome';
  root.innerHTML=`<div class="mg-st">Helper v${esc(S.info.version)} &middot; WinRAR ${winrarLine}</div>
  <p class="muted" style="margin:4px 0">Finds every multi-part (<code>.part1.rar</code> ...), legacy split (<code>.rar</code> + <code>.r00</code> ...), and standalone .rar archive anywhere in the folder below and extracts each one in place, right next to its parts. Everything else is left untouched.</p>
  <label class="fld">Folder to scan (e.g. the course folder with the .rar parts)</label>
  <div class="mg-path"><input id="xSrc" class="sinput" value="${esc(P.src)}" placeholder="D:\\myCourse\\Course Name" spellcheck="false"><button id="xSrcB" class="btn small">Browse...</button></div>
  <div class="mg-opts">
    <label><input type="checkbox" id="xDry" ${P.dryRun?'checked':''}> Dry run (preview only)</label>
    <label class="danger"><input type="checkbox" id="xDel" ${P.deleteOriginals?'checked':''}> Delete .rar parts after success</label>
    <label><input type="checkbox" id="xAuto" ${P.autoMerge!==false?'checked':''}> Also merge subtitles automatically when done</label>
  </div>
  <div class="row"><span id="xCount" class="muted"></span><div class="sp"></div><button id="xNext" class="btn small primary" hidden>Now merge subtitles &rarr;</button><button id="xCancel" class="btn small" hidden>Cancel</button><button id="xGo" class="btn small primary">Start extracting</button></div>
  <div class="mg-bar"><i id="xBar"></i></div><div id="xSum" class="mg-sum">${esc(S.summary)}</div>
  <div id="xLog" class="mg-log"></div>`;
  const L=el('xLog');S.log.forEach(([c,t])=>{const d=document.createElement('div');d.className=c;d.textContent=t;L.appendChild(d)});L.scrollTop=L.scrollHeight;
  wire();busy(S.running);prog();
}

function read(){const P={src:el('xSrc').value.trim().replace(/^"|"$/g,''),dryRun:el('xDry').checked,deleteOriginals:el('xDel').checked,autoMerge:el('xAuto').checked};setPref(P);return P}

function wire(){
  el('xSrc').onchange=()=>read();
  el('xAuto').onchange=()=>read();
  const pick=async(id,title)=>{const r=await ask({cmd:'pick',title,initial:el(id).value});if(r&&r.path){el(id).value=r.path;read()}};
  el('xSrcB').onclick=()=>pick('xSrc','Choose the folder to scan for .rar archives');
  el('xCancel').onclick=()=>{S.port&&S.port.postMessage({cmd:'cancel'});setSum('Cancelling...')};
  el('xGo').onclick=()=>{
    const P=read();
    if(!P.src)return setSum('<span style="color:var(--color-error)">Choose a folder first.</span>');
    if(P.deleteOriginals&&!P.dryRun&&!confirm('The .rar part files will be PERMANENTLY DELETED after each successful extraction. Continue?'))return;
    S.running=true;S.summary='';S.done=0;S.total=0;setSum('');const a=el('xNext');if(a)a.hidden=true;busy(true);prog();
    S.port.postMessage({cmd:'extract',src:P.src,dryRun:P.dryRun,deleteOriginals:P.deleteOriginals});
  };
  const nx=el('xNext');
  if(nx)nx.onclick=()=>{
    const src=nx.dataset.src||read().src;
    try{const M=Object.assign({src:'',out:'',inPlace:false,dryRun:false,skipExisting:true,deleteOriginals:false,subCodec:'srt'},JSON.parse(localStorage[MKEY]||'{}'));M.src=src;localStorage[MKEY]=JSON.stringify(M)}catch{}
    closeModal();
    if(window.openMergeSubs)window.openMergeSubs();
  };
}

function open(){
  openModal('Extract .rar archives','<div id="xRoot"></div>');
  S.err=S.ready?'':S.err;render();
  if(!S.port){S.info=null;S.ready=false;S.err='';connect()}else if(!S.ready)S.port.postMessage({cmd:'ping'});
}
document.getElementById('extractBtn').onclick=open;
})();
