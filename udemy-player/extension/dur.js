/* dur.js - exact video length straight from the container header (no decoding, a few KB per file).
   MP4/M4V/MOV (mvhd), MKV/WebM (Segment Info), AVI (avih), FLV (onMetaData). Anything else, or a header
   without a length, falls back to asking a <video> element. window.ZD_dur(file) -> seconds, or 0 if unknown. */
(function(){
const rd=async(f,a,b)=>new Uint8Array(await f.slice(a,Math.max(a,Math.min(b,f.size))).arrayBuffer());
const be=(a,o,n)=>{let v=0;for(let i=0;i<n;i++)v=v*256+a[o+i];return v};
const le=(a,o,n)=>{let v=0;for(let i=n-1;i>=0;i--)v=v*256+a[o+i];return v};
const tag=(a,o)=>String.fromCharCode(a[o],a[o+1],a[o+2],a[o+3]);

/* ---- MP4 / MOV ---- */
async function mp4(f){
  let pos=0;
  for(let g=0;g<200&&pos+8<=f.size;g++){
    const h=await rd(f,pos,pos+16);let sz=be(h,0,4),hl=8;const t=tag(h,4);
    if(sz===1){sz=be(h,8,8);hl=16}else if(sz===0)sz=f.size-pos;
    if(sz<hl)return 0;
    if(t==='moov')return mvhd(f,pos+hl,Math.min(f.size,pos+sz));
    pos+=sz}
  return 0}
async function mvhd(f,s,e){
  let pos=s;
  for(let g=0;g<64&&pos+8<=e;g++){
    const h=await rd(f,pos,pos+8),sz=be(h,0,4),t=tag(h,4);
    if(t==='mvhd'){const b=await rd(f,pos+8,pos+40),v=b[0],ts=v===1?be(b,20,4):be(b,12,4),du=v===1?be(b,24,8):be(b,16,4);return ts&&du?du/ts:0}
    if(sz<8)return 0;pos+=sz}
  return 0}

/* ---- Matroska / WebM ---- */
function vid(a,o){const b=a[o];if(!b)return null;let l=1,m=0x80;while(l<=4&&!(b&m)){l++;m>>=1}if(l>4||o+l>a.length)return null;let v=0;for(let i=0;i<l;i++)v=v*256+a[o+i];return{v,l}}
function vsz(a,o){const b=a[o];if(b===undefined||!b)return null;let l=1,m=0x80;while(l<=8&&!(b&m)){l++;m>>=1}if(l>8||o+l>a.length)return null;let v=b&(m-1),all=v===m-1;for(let i=1;i<l;i++){v=v*256+a[o+i];if(a[o+i]!==255)all=false}return{v:all?-1:v,l}}
function kids(a,s,e,cb){let p=s;while(p<e){const i=vid(a,p);if(!i)return;const z=vsz(a,p+i.l);if(!z)return;const ds=p+i.l+z.l,de=z.v<0?e:Math.min(e,ds+z.v);if(cb(i.v,ds,de)===false)return;p=de}}
async function mkv(f){
  const hd=await rd(f,0,64);if(be(hd,0,4)!==0x1A45DFA3)return 0;
  let i=vid(hd,0),z=vsz(hd,i.l);let pos=i.l+z.l+z.v;
  const sh=await rd(f,pos,pos+16);i=vid(sh,0);if(!i||i.v!==0x18538067)return 0;z=vsz(sh,i.l);
  const segS=pos+i.l+z.l,segE=z.v<0?f.size:Math.min(f.size,segS+z.v);
  let p=segS;
  for(let g=0;g<500&&p+2<segE;g++){
    const h=await rd(f,p,p+16),e=vid(h,0);if(!e)return 0;const s=vsz(h,e.l);if(!s)return 0;const ds=p+e.l+s.l;
    if(e.v===0x1549A966)return info(await rd(f,ds,ds+(s.v<0?8192:Math.min(s.v,65536))));   // Info
    if(e.v===0x114D9B74&&s.v>0){                                                         // SeekHead -> jump straight to Info
      const a=await rd(f,ds,ds+Math.min(s.v,4096));let to=null;
      kids(a,0,a.length,(id,s2,e2)=>{if(id===0x4DBB){let sid=0,sp=null;kids(a,s2,e2,(i2,s3,e3)=>{if(i2===0x53AB)sid=be(a,s3,e3-s3);if(i2===0x53AC)sp=be(a,s3,e3-s3)});if(sid===0x1549A966&&sp!=null)to=segS+sp}});
      if(to!=null&&to>p){p=to;continue}}
    if(e.v===0x1F43B675)break;                                                           // Cluster before Info: give up
    if(s.v<0)return 0;p=ds+s.v}
  return 0}
function info(a){
  let scale=1e6,dur=0;
  kids(a,0,a.length,(id,s,e)=>{
    if(id===0x2AD7B1)scale=be(a,s,e-s);
    if(id===0x4489){const dv=new DataView(a.buffer,a.byteOffset+s,e-s);dur=e-s===4?dv.getFloat32(0):e-s===8?dv.getFloat64(0):0}});
  return dur>0?dur*scale/1e9:0}

/* ---- AVI ---- */
async function avi(f){
  const a=await rd(f,0,8192);if(tag(a,0)!=='RIFF'||tag(a,8)!=='AVI ')return 0;
  for(let i=12;i<a.length-40;i++)if(tag(a,i)==='avih'){const d=i+8,us=le(a,d,4),fr=le(a,d+16,4);return us&&fr?us*fr/1e6:0}
  return 0}

/* ---- FLV (onMetaData "duration") ---- */
async function flv(f){
  const a=await rd(f,0,16384);if(tag(a,0).slice(0,3)!=='FLV')return 0;
  const k=[100,117,114,97,116,105,111,110];                                              // "duration"
  for(let i=0;i<a.length-20;i++){let ok=true;for(let j=0;j<8;j++)if(a[i+j]!==k[j]){ok=false;break}
    if(ok&&a[i+8]===0)return new DataView(a.buffer,a.byteOffset+i+9,8).getFloat64(0)}
  return 0}

/* ---- last resort: let the browser read it ---- */
function probe(f,ms){return new Promise(r=>{
  if(typeof document==='undefined')return r(0);
  let u,end=false,to;const e=document.createElement('video');e.preload='metadata';
  const fin=x=>{if(end)return;end=true;clearTimeout(to);try{e.removeAttribute('src');e.load();URL.revokeObjectURL(u)}catch{}r(x)};
  to=setTimeout(()=>fin(0),ms);e.onloadedmetadata=()=>fin(isFinite(e.duration)?e.duration:0);e.onerror=()=>fin(0);
  try{u=URL.createObjectURL(f.slice(0,f.size,'video/webm'));e.src=u}catch{fin(0)}})}

const ok=d=>isFinite(d)&&d>0&&d<864000;
/* ZD_durx(file) -> {sec, via:'header'|'browser'|'none'} ; ZD_dur(file) -> seconds */
window.ZD_durx=async function(f){
  try{
    const h=await rd(f,0,16);let d=0;
    if(tag(h,4)==='ftyp'||['moov','mdat','wide','free','skip'].includes(tag(h,4)))d=await mp4(f);
    else if(be(h,0,4)===0x1A45DFA3)d=await mkv(f);
    else if(tag(h,0)==='RIFF')d=await avi(f);
    else if(tag(h,0).slice(0,3)==='FLV')d=await flv(f);
    if(ok(d))return{sec:d,via:'header'};
  }catch{}
  for(const ms of [10000,30000]){const d=await probe(f,ms);if(ok(d))return{sec:d,via:'browser'}}
  return{sec:0,via:'none'}};
window.ZD_dur=async f=>(await ZD_durx(f)).sec;
})();
