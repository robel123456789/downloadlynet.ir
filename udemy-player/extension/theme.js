// Two themes: "dark" (near-black, minimal) and "cosmic" (nebula + stars + glass).
// Applies the saved theme before paint and wires every [data-theme-toggle] button (click = switch).
(function(){
  var K='zd:theme2',r=document.documentElement,T=['dark','cosmic'],NAME={dark:'Dark',cosmic:'Cosmic'};
  var ICON={
    dark:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    cosmic:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9z"/><path d="M19 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></svg>'};
  function get(){try{var v=localStorage.getItem(K);return T.indexOf(v)>-1?v:'cosmic'}catch(e){return'cosmic'}}
  function paint(t){document.querySelectorAll('[data-theme-toggle]').forEach(function(b){
    var next=T[(T.indexOf(t)+1)%T.length];
    b.innerHTML=ICON[t]+(b.classList.contains('hbtn')?'&nbsp;'+NAME[t].toUpperCase():'');
    b.title='Theme: '+NAME[t]+' — click for '+NAME[next];b.setAttribute('aria-label',b.title)})}
  function apply(t){r.setAttribute('data-theme',t);paint(t)}
  apply(get());
  document.addEventListener('DOMContentLoaded',function(){
    apply(get());
    document.addEventListener('click',function(e){
      var b=e.target.closest('[data-theme-toggle]');if(!b)return;
      var t=T[(T.indexOf(r.getAttribute('data-theme'))+1)%T.length];
      try{localStorage.setItem(K,t)}catch(x){}apply(t)});
  });
  // keep every open extension page in sync
  window.addEventListener('storage',function(e){if(e.key===K)apply(get())});
})();
