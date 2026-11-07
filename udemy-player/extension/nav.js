// Navbar tools shared by library + player: countdown timer.
(function(){
  const TK='zd:timer';
  const $=(s,r=document)=>r.querySelector(s);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ICO={
    clock:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>',
    chev:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>'
  };

  /* ---------- build UI ---------- */
  const nav=$('.nav'),sp=nav&&$('.nav .sp');if(!nav||!sp)return;
  const tools=document.createElement('div');tools.className='navtools';
  tools.innerHTML=
   `<div class="ntw" id="ntTim"><button class="ntbtn" id="timBtn" title="Countdown timer">${ICO.clock}<span id="timLbl">Timer</span>${ICO.chev}</button>
      <div class="ntpop glass-strong" id="timPop" hidden>
        <div class="tp-h">Countdown</div>
        <div class="tp-big" id="timBig">25:00</div>
        <label class="fld" for="timMin">Minutes</label>
        <input id="timMin" class="sinput" type="number" min="0.1" max="999" step="any" value="25" inputmode="decimal">
        <div class="chips tp-chips"><button class="chip" data-m="5">5</button><button class="chip" data-m="15">15</button><button class="chip" data-m="25">25</button><button class="chip" data-m="45">45</button><button class="chip" data-m="60">60</button></div>
        <div class="row"><button id="timGo" class="btn small primary">Start</button><button id="timReset" class="btn small">Reset</button><div class="sp"></div><button id="timTest" class="link">Test sound</button></div>
      </div></div>`;
  sp.before(tools);

  /* ---------- dropdown behaviour ---------- */
  const pops=[$('#timPop')];
  function toggle(p){const open=p.hidden;pops.forEach(x=>x.hidden=true);p.hidden=!open;return open}
  $('#timBtn').onclick=e=>{e.stopPropagation();if(toggle($('#timPop')))syncInputs()};
  document.addEventListener('click',e=>{if(!e.composedPath().some(n=>n.classList&&n.classList.contains('ntw')))pops.forEach(x=>x.hidden=true)});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')pops.forEach(x=>x.hidden=true)});
  // keep typing in the dropdowns from triggering player hotkeys
  tools.addEventListener('keydown',e=>e.stopPropagation(),true);

  /* ---------- sound ---------- */
  let ac=null,beeping=false,beepT=null;
  function unlock(){try{if(!ac)ac=new(window.AudioContext||window.webkitAudioContext)();if(ac.state==='suspended')ac.resume()}catch{}}
  ['pointerdown','keydown'].forEach(ev=>document.addEventListener(ev,unlock,{capture:true}));
  function tone(t0,f,dur){const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=f;
    g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(.35,t0+.02);g.gain.setValueAtTime(.35,t0+dur-.04);g.gain.linearRampToValueAtTime(0,t0+dur);
    o.connect(g).connect(ac.destination);o.start(t0);o.stop(t0+dur+.02)}
  function beepOnce(){unlock();if(!ac)return false;const t=ac.currentTime+.05;tone(t,880,.18);tone(t+.28,880,.18);tone(t+.56,1175,.32);return true}
  function startBeeping(){stopBeeping();beeping=true;let n=0;const run=()=>{if(!beeping)return;beepOnce();if(++n>=8){stopBeeping();return}beepT=setTimeout(run,1500)};run()}
  function stopBeeping(){beeping=false;clearTimeout(beepT);nav.classList.remove('t-done');renderTimer()}
  $('#timTest').onclick=()=>{if(!beepOnce())toast('Sound is blocked by the browser')};

  /* ---------- timer ---------- */
  // state: {total:seconds, endAt:ms|null (running), left:seconds (paused/idle), fired:bool}
  const loadT=()=>{try{return JSON.parse(localStorage[TK])||null}catch{return null}};
  const saveT=s=>{try{localStorage[TK]=JSON.stringify(s)}catch{}};
  const fmt=s=>{s=Math.max(0,Math.ceil(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60,p=n=>String(n).padStart(2,'0');return (h?h+':'+p(m):m)+':'+p(x)};
  function leftNow(T){return T.endAt?(T.endAt-Date.now())/1000:T.left}
  function renderTimer(){
    const T=loadT(),lbl=$('#timLbl'),big=$('#timBig'),go=$('#timGo'),btn=$('#timBtn');
    nav.classList.toggle('t-run',!!(T&&T.endAt));
    if(!T){lbl.textContent='Timer';big.textContent=fmt((+$('#timMin').value||25)*60);go.textContent='Start';return}
    const l=leftNow(T);
    if(T.endAt){lbl.textContent=fmt(l);big.textContent=fmt(l);go.textContent='Pause'}
    else if(T.fired){lbl.textContent='0:00';big.textContent='0:00';go.textContent='Start'}
    else{lbl.textContent=fmt(T.left)+' (paused)';big.textContent=fmt(T.left);go.textContent='Resume'}
    btn.classList.toggle('flash',!!T.fired&&beeping);
  }
  function syncInputs(){const T=loadT();if(T&&!T.endAt&&!T.fired)$('#timMin').value=+(T.total/60).toFixed(2);else if(T&&T.total)$('#timMin').value=+(T.total/60).toFixed(2);renderTimer()}
  function tick(){
    const T=loadT();
    if(T&&T.endAt&&leftNow(T)<=0&&!T.fired){
      saveT({total:T.total,endAt:null,left:0,fired:true});
      nav.classList.add('t-done');startBeeping();toast('Time is up!');
      try{document.title='⏰ '+document.title.replace(/^⏰ /,'')}catch{}
    }
    renderTimer();
  }
  $('#timGo').onclick=()=>{
    unlock();const T=loadT();
    if(T&&T.endAt){saveT({total:T.total,endAt:null,left:Math.max(0,leftNow(T)),fired:false});renderTimer();return}
    if(T&&!T.fired&&T.left>0&&+$('#timMin').value*60===T.total){saveT({total:T.total,endAt:Date.now()+T.left*1000,left:0,fired:false});stopBeeping();renderTimer();return}
    const mins=parseFloat($('#timMin').value);
    if(!(mins>0)){toast('Enter minutes first');return}
    const total=Math.round(mins*60);saveT({total,endAt:Date.now()+total*1000,left:0,fired:false});stopBeeping();
    document.title=document.title.replace(/^⏰ /,'');$('#timPop').hidden=true;renderTimer();
  };
  $('#timReset').onclick=()=>{try{localStorage.removeItem(TK)}catch{}stopBeeping();document.title=document.title.replace(/^⏰ /,'');renderTimer()};
  tools.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{$('#timMin').value=b.dataset.m;const T=loadT();if(T&&!T.endAt){try{localStorage.removeItem(TK)}catch{}}renderTimer()});
  $('#timMin').addEventListener('input',()=>{const T=loadT();if(T&&!T.endAt){try{localStorage.removeItem(TK)}catch{}}renderTimer()});
  // clicking anywhere on a ringing alarm silences it
  document.addEventListener('pointerdown',()=>{if(beeping)stopBeeping()},true);
  window.addEventListener('storage',e=>{if(e.key===TK)renderTimer()});

  function toast(t){const e=$('#toast');if(!e)return;e.textContent=t;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>e.hidden=true,3500)}

  setInterval(tick,250);tick();syncInputs();
  // timer already finished while no page was open (or while navigating): ring once on open
  const T0=loadT();if(T0&&T0.fired&&!T0.seen){saveT(Object.assign({},T0,{seen:true}));nav.classList.add('t-done');startBeeping()}
})();
