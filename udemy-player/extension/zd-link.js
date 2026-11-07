// Links between the two pages: udemy player library <-> Curriculum.
window.openLibrary=()=>{location.href='library.html'};
window.openCurriculum=()=>{location.href='curriculum.html'};
document.addEventListener('DOMContentLoaded',()=>{
  const l=document.getElementById('toLib'),c=document.getElementById('toCurr');
  if(l)l.onclick=window.openLibrary;
  if(c)c.onclick=window.openCurriculum;
});
