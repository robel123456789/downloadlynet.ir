// Curriculum builder v2: editable tables with done-tracking + progress, status/number/date columns,
// drag-reorder, keyboard navigation, spreadsheet paste, Markdown/CSV import & export, search, print,
// plus data safety (save indicator, undo, JSON backup/restore, corrupt-data guard).
(function(){
  'use strict';
  const K='zd:curriculum',KB='zd:curriculum:lastBackup',KU='zd:curriculum:ui';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  const main=$('#curMain');
  const STATUS=['Not started','In progress','Done','Blocked'];
  const STATUS_CLS={'Not started':'s0','In progress':'s1','Done':'s2','Blocked':'s3'};
  const TYPES={text:'Text',status:'Status',number:'Number',date:'Date'};
  const ui={hideDone:false,q:''};
  try{ui.hideDone=!!JSON.parse(localStorage[KU]).hideDone}catch{}

  const normUrl=u=>{u=(u||'').trim();if(!u)return'';return /^https?:\/\//i.test(u)?u:'https://'+u};
  const hostOf=u=>{try{return new URL(u).hostname.replace(/^www\./,'')}catch{return u}};
  const parseNum=s=>{const x=parseFloat(String(s==null?'':s).replace(/,/g,''));return isNaN(x)?null:x};
  const fmt=n=>n.toLocaleString(undefined,{maximumFractionDigits:2});
  const statusCls=v=>v?(STATUS_CLS[v]||'s0'):'';

  /* ================= data ================= */
  function validData(d){
    return !!d&&Array.isArray(d.tables)&&d.tables.every(t=>t&&Array.isArray(t.cols)&&Array.isArray(t.rows)&&
      t.cols.every(c=>c&&c.id)&&t.rows.every(r=>r&&r.id&&r.cells&&typeof r.cells==='object'));
  }
  function migrate(d){
    d.tables.forEach(t=>{
      t.title=t.title||'';
      t.cols.forEach(c=>{if(!TYPES[c.type])c.type='text'});
      t.rows.forEach(r=>{r.done=!!r.done;t.cols.forEach(c=>{if(!r.cells[c.id])r.cells[c.id]={text:'',href:''}})});
    });
    return d;
  }
  function load(){
    const raw=localStorage[K];let d=null;
    if(raw){
      try{d=JSON.parse(raw)}catch{}
      if(!validData(d)){
        try{localStorage[K+':corrupt']=raw}catch{}
        d=null;setTimeout(()=>toast('Saved data looked damaged — a copy was kept aside. Use ⬆ Restore with a backup.'),400);
      }
    }
    return migrate(d||{tables:[]});
  }
  let D=load();
  const snap=()=>JSON.stringify(D);
  const cellOf=(r,cid)=>r.cells[cid]||(r.cells[cid]={text:'',href:''});
  const persist=()=>save(D);

  function blankTable(){
    const ids=[uid(),uid(),uid(),uid()];
    const labels=[['Stage','text'],['Course / Topic','text'],['Status','status'],['Notes','text']];
    const cells={};ids.forEach(i=>cells[i]={text:'',href:''});
    return{id:uid(),title:'My Curriculum',cols:ids.map((id,i)=>({id,label:labels[i][0],type:labels[i][1]})),
      rows:[{id:uid(),done:false,cells}]};
  }

  /* ================= save status ================= */
  const statusEl=$('#saveStatus');
  function flashSaved(ok){
    if(!statusEl)return;
    clearTimeout(flashSaved.t);
    if(ok){
      statusEl.className='save-status ok show';statusEl.textContent='✓ Saved';
      flashSaved.t=setTimeout(()=>statusEl.classList.remove('show'),1600);
    }else{
      statusEl.className='save-status err show';
      statusEl.textContent='⚠ NOT saved — storage full or blocked. Export a backup now.';
    }
  }
  function save(d){
    try{localStorage[K]=JSON.stringify(d);flashSaved(true);return true}
    catch{flashSaved(false);return false}
  }

  /* ================= undo (one level, 6s) ================= */
  const undoBox=$('#undoToast');
  let undoSnap=null,undoTimer=null;
  function offerUndo(snapshot,msg){
    undoSnap=snapshot;$('#undoMsg').textContent=msg;undoBox.hidden=false;
    clearTimeout(undoTimer);undoTimer=setTimeout(hideUndo,6000);
  }
  function hideUndo(){undoBox.hidden=true;undoSnap=null;clearTimeout(undoTimer)}
  function doUndo(){
    if(!undoSnap)return;
    try{D=migrate(JSON.parse(undoSnap));persist()}catch{}
    hideUndo();render();
  }
  $('#undoBtn').onclick=doUndo;

  /* ================= toast / modal ================= */
  function toast(t){const e=$('#toast');if(!e)return;e.textContent=t;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>e.hidden=true,3200)}
  function modal({title,body,buttons}){
    const dlg=document.createElement('dialog');dlg.className='cur-modal';
    dlg.innerHTML=`<h3>${esc(title)}</h3><div class="cur-modal-body">${body}</div><div class="cur-modal-btns"></div>`;
    const bar=$('.cur-modal-btns',dlg);
    buttons.forEach(b=>{
      const el=document.createElement('button');
      el.className='btn small'+(b.primary?' primary':'');el.textContent=b.label;
      el.onclick=()=>{if(!b.run||b.run(dlg)!==false)dlg.close()};
      bar.appendChild(el);
    });
    dlg.addEventListener('close',()=>dlg.remove());
    dlg.addEventListener('keydown',e=>{
      if(e.key==='Enter'&&e.target.matches('input[type=text]')){e.preventDefault();const p=$('.primary',bar);if(p)p.click()}
    });
    document.body.appendChild(dlg);dlg.showModal();
    const f=$('input[type=text],textarea',dlg);if(f){f.focus();if(f.select&&f.tagName==='INPUT')f.select()}
    return dlg;
  }

  /* ================= parsing / export ================= */
  function parseDelimited(s,d){
    const rows=[];let row=[],cur='',q=false;
    for(let i=0;i<s.length;i++){
      const ch=s[i];
      if(q){if(ch==='"'){if(s[i+1]==='"'){cur+='"';i++}else q=false}else cur+=ch}
      else if(ch==='"'&&cur===''){q=true}
      else if(ch===d){row.push(cur);cur=''}
      else if(ch==='\n'){row.push(cur);rows.push(row);row=[];cur=''}
      else if(ch!=='\r'){cur+=ch}
    }
    row.push(cur);rows.push(row);return rows;
  }
  function parseMarkdown(s){
    const rows=[];
    s.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.includes('|')).forEach(l=>{
      l=l.replace(/^\|/,'').replace(/\|$/,'');
      const cells=l.split(/(?<!\\)\|/).map(c=>c.trim().replace(/\\\|/g,'|'));
      if(cells.every(c=>/^:?-+:?$/.test(c)))return;
      rows.push(cells);
    });
    return rows;
  }
  function parseAny(text){
    text=String(text||'').replace(/^\uFEFF/,'').trim();if(!text)return[];
    const lines=text.split(/\r?\n/);let rows;
    if(lines.filter(l=>l.trim().startsWith('|')).length>=2)rows=parseMarkdown(text);
    else if(lines[0].includes('\t'))rows=parseDelimited(text,'\t');
    else{
      const c=(lines[0].match(/,/g)||[]).length,s=(lines[0].match(/;/g)||[]).length;
      rows=parseDelimited(text,s>c?';':',');
    }
    return rows.filter(r=>r.some(c=>String(c).trim()));
  }
  function toCell(v){
    v=String(v==null?'':v).replace(/<br\s*\/?>/gi,'\n').trim();
    const m=v.match(/^\[([^\]]*)\]\((\S+?)\)$/);
    return m?{text:m[1],href:normUrl(m[2])}:{text:v,href:''};
  }
  const isDoneVal=v=>/^(yes|y|x|true|1|✓|✔|done)$/i.test(String(v||'').trim());
  const isDoneHdr=v=>/^(done|✓|✔)$/i.test(String(v||'').trim());

  function guessType(vals){
    const v=vals.map(x=>x.text).filter(Boolean);
    if(!v.length)return'text';
    if(v.every(x=>STATUS.includes(x)))return'status';
    if(v.every(x=>parseNum(x)!==null&&/^[\d.,\s-]+$/.test(x))&&v.length>=2)return'number';
    return'text';
  }
  // matrix -> {cols,rows}; header handling + optional leading "Done" column
  function buildFromMatrix(m,header){
    let head=header?m[0].slice():null,body=header?m.slice(1):m.map(r=>r.slice());
    let doneCol=false;
    if(head&&isDoneHdr(head[0])){doneCol=true;head.shift()}
    const flags=body.map(r=>doneCol?isDoneVal(r[0]):false);
    if(doneCol)body=body.map(r=>r.slice(1));
    const w=Math.max(head?head.length:0,...body.map(r=>r.length),1);
    const cells=body.map(r=>Array.from({length:w},(_,i)=>toCell(r[i])));
    const cols=Array.from({length:w},(_,i)=>{
      const type=guessType(cells.map(r=>r[i]));
      return{id:uid(),label:(head&&String(head[i]||'').trim())||'Column '+(i+1),type};
    });
    const rows=cells.map((r,ri)=>{const o={};cols.forEach((c,i)=>o[c.id]=r[i]);return{id:uid(),done:flags[ri],cells:o}});
    return{cols,rows};
  }
  const cellOut=(c,col)=>{
    const x=c||{text:'',href:''};
    return x.href?`[${x.text||hostOf(x.href)}](${x.href})`:x.text;
  };
  function toCSV(t){
    const q=v=>/[",\n\r;]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;
    const lines=[['Done',...t.cols.map(c=>c.label)].map(q).join(',')];
    t.rows.forEach(r=>lines.push([r.done?'yes':'',...t.cols.map(c=>cellOut(r.cells[c.id]))].map(q).join(',')));
    return lines.join('\r\n');
  }
  function toMD(t){
    const e=v=>String(v).replace(/\|/g,'\\|').replace(/\r?\n/g,'<br>');
    const lines=['| Done | '+t.cols.map(c=>e(c.label)).join(' | ')+' |','| --- | '+t.cols.map(()=>'---').join(' | ')+' |'];
    t.rows.forEach(r=>lines.push('| '+(r.done?'✓':'')+' | '+t.cols.map(c=>e(cellOut(r.cells[c.id]))).join(' | ')+' |'));
    return (t.title?'### '+t.title+'\n\n':'')+lines.join('\n');
  }
  function download(name,mime,text){
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([text],{type:mime}));a.download=name;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  }
  const slug=s=>(s||'curriculum').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'curriculum';

  /* ================= render ================= */
  function render(focus){
    main.innerHTML='';
    if(!D.tables.length){
      main.innerHTML=`<div class="cur-empty"><h2>No curriculum yet</h2><p>Click “+ Add table” to build one, or “⤓ Import table” to paste in a Markdown / CSV / Excel table.</p></div>`;
    }else D.tables.forEach(t=>main.appendChild(renderTable(t)));
    applyFilter();updateOverall();updateBackupInfo();
    if(focus){const w=$(`.cur-table-wrap[data-tid="${focus.tid}"]`);if(w)focusCell(w,focus.row,focus.col)}
  }

  function linkRowHtml(href){
    if(!href)return`<button class="cur-link-add">+ link</button>`;
    return`<span class="cur-link-pill"><a href="${esc(href)}" target="_blank" rel="noopener">${esc(hostOf(href))}</a>
      <button class="cur-link-edit" title="Edit link">✎</button><button class="cur-link-rm" title="Remove link">✕</button></span>`;
  }
  function cellHtml(r,c,cell){
    const a=`data-row="${r.id}" data-col="${c.id}"`;
    if(c.type==='status'){
      const v=cell.text,opts=STATUS.slice();if(v&&!opts.includes(v))opts.push(v);
      return`<div class="cur-cell"><select class="cur-in cur-status ${statusCls(v)}" ${a}><option value=""${v?'':' selected'}>—</option>${opts.map(o=>`<option${o===v?' selected':''}>${esc(o)}</option>`).join('')}</select></div>`;
    }
    if(c.type==='number')return`<div class="cur-cell"><input class="cur-in cur-num" ${a} type="text" inputmode="decimal" value="${esc(cell.text)}" placeholder="0"></div>`;
    if(c.type==='date')return`<div class="cur-cell"><input class="cur-in cur-date" ${a} type="date" value="${esc(cell.text)}"></div>`;
    return`<div class="cur-cell"><div class="cur-in cur-cell-text" contenteditable="plaintext-only" data-ph="…" ${a}>${esc(cell.text)}</div><div class="cur-link-row" ${a}>${linkRowHtml(cell.href)}</div></div>`;
  }
  function rowHtml(t,r,ri){
    let h=`<tr data-row="${r.id}"${r.done?' class="is-done"':''}><td class="cur-ctl"><div class="cur-ctl-in"><span class="cur-grip" draggable="true" data-drag="row" title="Drag to reorder">⠿</span><span class="cur-rn">${ri+1}</span><span class="cur-rowbtns"><button class="cur-rdup" data-row="${r.id}" title="Duplicate row">⧉</button><button class="cur-rdel" data-row="${r.id}" title="Delete row">✕</button></span></div></td><td class="cur-chk"><input type="checkbox" class="cur-done" data-row="${r.id}" title="Mark done"${r.done?' checked':''}></td>`;
    t.cols.forEach(c=>{h+='<td>'+cellHtml(r,c,cellOf(r,c.id))+'</td>'});
    return h+'</tr>';
  }
  function tableHtml(t){
    let h='<table class="cur-table"><thead><tr><th class="cur-ctl"></th><th class="cur-chk"><input type="checkbox" class="cur-all" title="Mark all done"></th>';
    t.cols.forEach(c=>{
      h+=`<th data-col="${c.id}"><div class="cur-col-hdr"><span class="cur-grip" draggable="true" data-drag="col" title="Drag to reorder">⠿</span><input class="cur-hdr-text" data-col="${c.id}" value="${esc(c.label)}" placeholder="Column name"><select class="cur-type" data-col="${c.id}" title="Column type">${Object.entries(TYPES).map(([k,v])=>`<option value="${k}"${c.type===k?' selected':''}>${v}</option>`).join('')}</select><button class="cur-col-del" data-col="${c.id}" title="Delete column">✕</button></div></th>`;
    });
    h+='</tr></thead><tbody>';
    t.rows.forEach((r,i)=>{h+=rowHtml(t,r,i)});
    h+='</tbody>';
    if(t.cols.some(c=>c.type==='number'))
      h+='<tfoot><tr><td class="cur-ctl"></td><td class="cur-chk"></td>'+t.cols.map(c=>c.type==='number'?`<td class="cur-sum" data-sum="${c.id}"></td>`:'<td></td>').join('')+'</tr></tfoot>';
    return h+'</table>';
  }

  function renderTable(t){
    const wrap=document.createElement('section');
    wrap.className='cur-table-wrap'+(t.collapsed?' collapsed':'');
    wrap.dataset.tid=t.id;
    wrap.innerHTML=`
      <div class="cur-head-row">
        <button class="cur-collapse" title="Collapse / expand">▾</button>
        <input class="cur-title" value="${esc(t.title)}" placeholder="Table title">
        <div class="cur-prog"><div class="cur-bar"><i></i></div><span class="cur-prog-txt"></span></div>
        <div class="cur-actions">
          <button class="btn small cur-add-row">+ Row</button>
          <button class="btn small cur-add-col">+ Column</button>
          <button class="btn small" data-act="dup" title="Duplicate table">⧉</button>
          <button class="btn small" data-act="csv" title="Download as CSV">CSV</button>
          <button class="btn small" data-act="md" title="Copy as Markdown">MD</button>
          <button class="btn small cur-table-del" data-act="del" title="Delete table">🗑</button>
        </div>
      </div>
      <div class="cur-body">
        <div class="cur-scroll">${tableHtml(t)}</div>
        <div class="cur-foot-row"><button class="btn small cur-add-row">+ Add row</button><span class="cur-filter-note" hidden></span></div>
      </div>`;
    wireTable(t,wrap);
    updateDerived(wrap,t);
    return wrap;
  }

  /* ================= derived UI ================= */
  function updateDerived(wrap,t){
    const total=t.rows.length,done=t.rows.filter(r=>r.done).length,pct=total?Math.round(done/total*100):0;
    $('.cur-bar i',wrap).style.width=pct+'%';
    $('.cur-prog-txt',wrap).textContent=total?`${done}/${total} · ${pct}%`:'no rows';
    wrap.classList.toggle('complete',total>0&&done===total);
    const all=$('.cur-all',wrap);
    if(all){all.checked=total>0&&done===total;all.indeterminate=done>0&&done<total}
    $$('[data-sum]',wrap).forEach(td=>{
      let s=0,n=0;
      t.rows.forEach(r=>{const v=parseNum(r.cells[td.dataset.sum]&&r.cells[td.dataset.sum].text);if(v!==null){s+=v;n++}});
      td.textContent=n?'Σ '+fmt(s):'';
    });
    updateOverall();
  }
  function updateOverall(){
    let total=0,done=0;
    D.tables.forEach(t=>{total+=t.rows.length;done+=t.rows.filter(r=>r.done).length});
    const pct=total?Math.round(done/total*100):0;
    $('#ovBar').style.width=pct+'%';
    $('#ovTxt').textContent=total?`${done}/${total} done · ${pct}%`:'';
  }
  function applyFilter(){
    const q=ui.q.trim().toLowerCase(),active=!!q||ui.hideDone;
    $$('.cur-table-wrap').forEach(wrap=>{
      const t=D.tables.find(x=>x.id===wrap.dataset.tid);if(!t)return;
      let shown=0;
      $$('tbody tr',wrap).forEach(tr=>{
        const r=t.rows.find(x=>x.id===tr.dataset.row);if(!r)return;
        let ok=!(ui.hideDone&&r.done);
        if(ok&&q){
          const hay=t.cols.map(c=>{const x=r.cells[c.id]||{};return(x.text||'')+' '+(x.href||'')}).join(' ').toLowerCase();
          ok=hay.includes(q);
        }
        tr.hidden=!ok;if(ok)shown++;
      });
      const note=$('.cur-filter-note',wrap);
      note.hidden=!active;note.textContent=active?`Showing ${shown} of ${t.rows.length} rows`:'';
    });
  }

  /* ================= focus / keyboard ================= */
  function focusCell(wrap,rid,cid){
    const el=$(`.cur-in[data-row="${rid}"][data-col="${cid}"]`,wrap);if(!el)return;
    el.focus();
    if(el.isContentEditable){const r=document.createRange();r.selectNodeContents(el);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r)}
    else if(el.select&&el.type==='text')el.select();
  }
  function caretPos(el){
    const s=getSelection();if(!s.rangeCount||!s.isCollapsed)return null;
    const r=s.getRangeAt(0),pre=document.createRange();
    pre.selectNodeContents(el);pre.setEnd(r.endContainer,r.endOffset);
    return{pos:pre.toString().length,len:el.textContent.length};
  }
  function addRow(t,cid){
    const cells={};t.cols.forEach(c=>cells[c.id]={text:'',href:''});
    const r={id:uid(),done:false,cells};t.rows.push(r);persist();
    render({tid:t.id,row:r.id,col:cid||t.cols[0].id});
  }

  /* ================= table wiring ================= */
  function wireTable(t,wrap){
    const rowHidden=rid=>{const tr=$(`tbody tr[data-row="${rid}"]`,wrap);return !tr||tr.hidden};

    /* ---- clicks ---- */
    wrap.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b)return;
      const cl=b.classList;
      if(cl.contains('cur-collapse')){t.collapsed=!t.collapsed;wrap.classList.toggle('collapsed',t.collapsed);persist();return}
      if(cl.contains('cur-add-row')){addRow(t);return}
      if(cl.contains('cur-add-col')){addColumn(t);return}
      if(b.dataset.act){tableAction(t,b.dataset.act);return}
      if(cl.contains('cur-col-del')){
        if(t.cols.length<=1){toast('A table needs at least one column');return}
        const s=snap(),cid=b.dataset.col;
        t.cols=t.cols.filter(c=>c.id!==cid);t.rows.forEach(r=>{delete r.cells[cid]});
        persist();render();offerUndo(s,'Column deleted');return;
      }
      if(cl.contains('cur-rdel')){
        const s=snap();t.rows=t.rows.filter(r=>r.id!==b.dataset.row);
        persist();render();offerUndo(s,'Row deleted');return;
      }
      if(cl.contains('cur-rdup')){
        const i=t.rows.findIndex(r=>r.id===b.dataset.row);if(i<0)return;
        const c=JSON.parse(JSON.stringify(t.rows[i]));c.id=uid();t.rows.splice(i+1,0,c);
        persist();render();return;
      }
      const lr=b.closest('.cur-link-row');
      if(lr){
        if(cl.contains('cur-link-rm')){
          const r=t.rows.find(x=>x.id===lr.dataset.row);if(!r)return;
          const s=snap();cellOf(r,lr.dataset.col).href='';persist();render();offerUndo(s,'Link removed');
        }else editLink(t,lr.dataset.row,lr.dataset.col);
      }
    });

    /* ---- typing / changes ---- */
    wrap.addEventListener('input',e=>{
      const el=e.target;
      if(el.classList.contains('cur-title')){t.title=el.value;persist();return}
      if(el.classList.contains('cur-hdr-text')){const c=t.cols.find(x=>x.id===el.dataset.col);if(c){c.label=el.value;persist()}return}
      if(el.classList.contains('cur-in')){
        const r=t.rows.find(x=>x.id===el.dataset.row),c=t.cols.find(x=>x.id===el.dataset.col);if(!r||!c)return;
        const v=el.isContentEditable?el.textContent:el.value;
        cellOf(r,c.id).text=v;
        if(el.classList.contains('cur-status'))el.className='cur-in cur-status '+statusCls(v);
        persist();
        if(c.type==='number')updateDerived(wrap,t);
      }
    });
    wrap.addEventListener('change',e=>{
      const el=e.target;
      if(el.classList.contains('cur-done')){
        const r=t.rows.find(x=>x.id===el.dataset.row);if(!r)return;
        r.done=el.checked;el.closest('tr').classList.toggle('is-done',r.done);
        persist();updateDerived(wrap,t);if(ui.hideDone)applyFilter();return;
      }
      if(el.classList.contains('cur-all')){
        const s=snap();t.rows.forEach(r=>r.done=el.checked);persist();render();
        offerUndo(s,el.checked?'All rows marked done':'All rows cleared');return;
      }
      if(el.classList.contains('cur-type')){
        const c=t.cols.find(x=>x.id===el.dataset.col);if(c){c.type=el.value;persist();render()}
      }
    });

    /* ---- paste: tab-separated (Excel / Sheets) fills the grid ---- */
    wrap.addEventListener('paste',e=>{
      const el=e.target.closest&&e.target.closest('.cur-in');if(!el)return;
      const text=(e.clipboardData||window.clipboardData).getData('text/plain');
      if(!text.includes('\t'))return;
      e.preventDefault();
      const grid=parseDelimited(text.replace(/\r\n?/g,'\n').replace(/\n$/,''),'\t');
      const ri=t.rows.findIndex(r=>r.id===el.dataset.row),ci=t.cols.findIndex(c=>c.id===el.dataset.col);
      if(ri<0||ci<0)return;
      const s=snap();let n=0;
      grid.forEach((g,i)=>{
        while(ri+i>=t.rows.length){const cells={};t.cols.forEach(c=>cells[c.id]={text:'',href:''});t.rows.push({id:uid(),done:false,cells})}
        g.forEach((v,j)=>{if(ci+j<t.cols.length){const x=toCell(v);const cell=cellOf(t.rows[ri+i],t.cols[ci+j].id);cell.text=x.text;if(x.href)cell.href=x.href;n++}});
      });
      persist();render({tid:t.id,row:el.dataset.row,col:el.dataset.col});offerUndo(s,`Pasted ${n} cells`);
    });

    /* ---- keyboard navigation ---- */
    wrap.addEventListener('keydown',e=>{
      const el=e.target.closest('.cur-in');if(!el)return;
      const ri=t.rows.findIndex(r=>r.id===el.dataset.row),ci=t.cols.findIndex(c=>c.id===el.dataset.col);
      if(ri<0||ci<0)return;
      const go=(r,c)=>focusCell(wrap,t.rows[r].id,t.cols[c].id);
      const vert=dir=>{let r=ri+dir;while(r>=0&&r<t.rows.length&&rowHidden(t.rows[r].id))r+=dir;return r};
      if(e.key==='Tab'){
        e.preventDefault();
        let c=ci+(e.shiftKey?-1:1),r=ri;
        if(c>=t.cols.length){c=0;r=vert(1)}else if(c<0){c=t.cols.length-1;r=vert(-1)}
        if(r<0)return;
        if(r>=t.rows.length){addRow(t,t.cols[0].id);return}
        go(r,c);
      }else if(e.key==='Enter'&&!e.shiftKey&&!e.ctrlKey&&!e.altKey){
        e.preventDefault();const r=vert(1);
        if(r>=t.rows.length)addRow(t,t.cols[ci].id);else go(r,ci);
      }else if(e.key==='ArrowUp'||e.key==='ArrowDown'){
        const dir=e.key==='ArrowUp'?-1:1;
        if(el.tagName==='SELECT'||el.type==='date')return;
        if(el.isContentEditable){const p=caretPos(el);if(!p||(dir<0&&p.pos!==0)||(dir>0&&p.pos!==p.len))return}
        const r=vert(dir);if(r<0||r>=t.rows.length)return;
        e.preventDefault();go(r,ci);
      }else if(e.key==='Escape')el.blur();
    });

    /* ---- drag to reorder rows / columns ---- */
    let drag=null;
    const clearMarks=()=>$$('.drop-before,.drop-after',wrap).forEach(x=>x.classList.remove('drop-before','drop-after'));
    wrap.addEventListener('dragstart',e=>{
      const g=e.target.closest&&e.target.closest('[data-drag]');if(!g)return;
      const kind=g.dataset.drag,el=g.closest(kind==='row'?'tr':'th');
      drag={kind,id:kind==='row'?el.dataset.row:el.dataset.col};
      e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',drag.id);
      try{e.dataTransfer.setDragImage(el,12,12)}catch{}
    });
    wrap.addEventListener('dragover',e=>{
      if(!drag)return;
      const el=e.target.closest(drag.kind==='row'?'tbody tr':'thead th[data-col]');if(!el)return;
      e.preventDefault();clearMarks();
      const rc=el.getBoundingClientRect();
      drag.after=drag.kind==='row'?e.clientY>rc.top+rc.height/2:e.clientX>rc.left+rc.width/2;
      drag.target=el.dataset[drag.kind==='row'?'row':'col'];
      el.classList.add(drag.after?'drop-after':'drop-before');
    });
    wrap.addEventListener('drop',e=>{
      if(!drag||!drag.target)return;e.preventDefault();
      const arr=drag.kind==='row'?t.rows:t.cols;
      const from=arr.findIndex(x=>x.id===drag.id),to=arr.findIndex(x=>x.id===drag.target);
      let ins=to+(drag.after?1:0);if(from<ins)ins--;
      const moved=from>=0&&to>=0&&ins!==from;
      if(moved){const[x]=arr.splice(from,1);arr.splice(ins,0,x);persist()}
      drag=null;clearMarks();if(moved)render();
    });
    wrap.addEventListener('dragend',()=>{clearMarks();drag=null});
  }

  /* ================= table-level actions & dialogs ================= */
  function tableAction(t,act){
    if(act==='del'){
      if(!confirm('Delete the whole table “'+(t.title||'Untitled')+'”?'))return;
      const s=snap();D.tables=D.tables.filter(x=>x.id!==t.id);persist();render();offerUndo(s,'Table deleted');
    }else if(act==='dup'){
      const nt=JSON.parse(JSON.stringify(t)),map={};
      nt.id=uid();nt.title=(t.title||'Table')+' (copy)';
      nt.cols.forEach(c=>{const n=uid();map[c.id]=n;c.id=n});
      nt.rows.forEach(r=>{r.id=uid();const cells={};Object.keys(r.cells).forEach(k=>{if(map[k])cells[map[k]]=r.cells[k]});r.cells=cells});
      D.tables.splice(D.tables.indexOf(t)+1,0,nt);persist();render();toast('Table duplicated');
    }else if(act==='csv'){
      download(slug(t.title)+'.csv','text/csv;charset=utf-8','\uFEFF'+toCSV(t));
    }else if(act==='md'){
      const md=toMD(t);
      (navigator.clipboard?navigator.clipboard.writeText(md):Promise.reject()).then(()=>toast('Markdown copied'),()=>download(slug(t.title)+'.md','text/markdown',md));
    }
  }
  function addColumn(t){
    modal({title:'Add column',
      body:`<label class="cur-field">Name<input type="text" id="mName" value="New column"></label>
            <label class="cur-field">Type<select id="mType">${Object.entries(TYPES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label>`,
      buttons:[{label:'Cancel'},{label:'Add column',primary:true,run:d=>{
        const cid=uid();
        t.cols.push({id:cid,label:$('#mName',d).value.trim()||'Column',type:$('#mType',d).value});
        t.rows.forEach(r=>r.cells[cid]={text:'',href:''});persist();render();
      }}]});
  }
  function editLink(t,rid,cid){
    const r=t.rows.find(x=>x.id===rid);if(!r)return;const cell=cellOf(r,cid);
    const btns=[{label:'Cancel'}];
    if(cell.href)btns.push({label:'Remove',run:()=>{const s=snap();cell.href='';persist();render();offerUndo(s,'Link removed')}});
    btns.push({label:'Save',primary:true,run:d=>{cell.href=normUrl($('#mUrl',d).value);persist();render()}});
    modal({title:cell.href?'Edit link':'Add link',body:`<label class="cur-field">URL<input type="text" id="mUrl" value="${esc(cell.href)}" placeholder="https://…"></label>`,buttons:btns});
  }

  /* ---- import (Markdown / CSV / TSV) ---- */
  function openImport(){
    const dlg=modal({title:'Import a table',
      body:`<label class="cur-field">Paste Markdown, CSV or a copied Excel / Sheets range — or load a file
              <input type="file" id="mFile" accept=".csv,.tsv,.txt,.md,text/*"></label>
            <textarea id="mText" rows="9" placeholder="| Stage | Course | Notes |&#10;| --- | --- | --- |&#10;| 1 | C basics | … |"></textarea>
            <div class="cur-row-opts">
              <label><input type="checkbox" id="mHdr" checked> First row is the header</label>
              <label>Add to <select id="mTarget"><option value="">a new table</option>${D.tables.map(t=>`<option value="${t.id}">${esc(t.title||'Untitled')}</option>`).join('')}</select></label>
            </div>
            <div id="mPrev" class="cur-prev"></div>`,
      buttons:[{label:'Cancel'},{label:'Import',primary:true,run:d=>{
        const m=parseAny($('#mText',d).value);
        if(!m.length){toast('Nothing to import — paste a table first');return false}
        const built=buildFromMatrix(m,$('#mHdr',d).checked),s=snap(),tid=$('#mTarget',d).value;
        if(tid){
          const t=D.tables.find(x=>x.id===tid);
          built.rows.forEach(br=>{
            const cells={};
            t.cols.forEach((c,i)=>{const src=built.cols[i];cells[c.id]=src?br.cells[src.id]:{text:'',href:''}});
            t.rows.push({id:uid(),done:br.done,cells});
          });
        }else{
          D.tables.push({id:uid(),title:'Imported table',cols:built.cols,rows:built.rows});
        }
        persist();render();offerUndo(s,`Imported ${built.rows.length} row${built.rows.length===1?'':'s'}`);
      }}]});
    const prev=()=>{
      const m=parseAny($('#mText',dlg).value);
      $('#mPrev',dlg).textContent=m.length?`Detected ${m.length} line${m.length===1?'':'s'} × ${Math.max(...m.map(r=>r.length))} columns`:'';
    };
    $('#mText',dlg).addEventListener('input',prev);
    $('#mFile',dlg).onchange=e=>{
      const f=e.target.files[0];if(!f)return;
      const fr=new FileReader();fr.onload=()=>{$('#mText',dlg).value=fr.result;prev()};fr.readAsText(f);
    };
  }

  /* ================= backup / restore ================= */
  const hasData=()=>D.tables.length>0;
  function updateBackupInfo(){
    const el=$('#backupInfo');if(!el)return;
    const t=+localStorage[KB]||0;
    if(!hasData()&&!t){el.textContent='';el.className='backup-info';return}
    if(!t){el.textContent='No backup yet';el.className='backup-info warn';return}
    const days=Math.floor((Date.now()-t)/864e5);
    el.textContent='Backed up '+(days<1?'today':days===1?'yesterday':days+' days ago');
    el.className='backup-info'+(days>=7?' warn':'');
  }
  const stamp=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'-'+p(d.getHours())+p(d.getMinutes())};
  function exportBackup(){
    download('curriculum-backup-'+stamp()+'.json','application/json',
      JSON.stringify({app:'ethio-planner-curriculum',version:2,exportedAt:new Date().toISOString(),data:D},null,2));
    try{localStorage[KB]=String(Date.now())}catch{}
    updateBackupInfo();toast('Backup downloaded — keep it somewhere outside this browser');
  }
  function importBackup(file){
    const fr=new FileReader();
    fr.onerror=()=>toast('Could not read that file');
    fr.onload=()=>{
      let P;try{P=JSON.parse(fr.result)}catch{toast('Not a valid backup file');return}
      const nd=(P&&P.data)?P.data:P;
      if(!validData(nd)){toast('Backup file is not in the expected format');return}
      const n=nd.tables.length;
      if(hasData()&&!confirm('Replace your current curriculum with this backup ('+n+' table'+(n===1?'':'s')+')?\n\nYou can Undo for a few seconds afterwards.'))return;
      const s=snap(),had=hasData();
      D=migrate(nd);if(!persist()){D=migrate(JSON.parse(s));return}
      render();if(had)offerUndo(s,'Backup restored');else toast('Backup restored');
    };
    fr.readAsText(file);
  }

  /* ================= top bar & global events ================= */
  $('#addTable').onclick=()=>{
    const t=blankTable();D.tables.push(t);persist();
    render({tid:t.id,row:t.rows[0].id,col:t.cols[0].id});
  };
  $('#exportBtn').onclick=exportBackup;
  $('#importBtn').onclick=()=>$('#importFile').click();
  $('#importFile').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)importBackup(f)};
  $('#importTxt').onclick=openImport;
  $('#printBtn').onclick=()=>window.print();
  const search=$('#curSearch'),hide=$('#hideDone');
  hide.checked=ui.hideDone;
  search.addEventListener('input',()=>{ui.q=search.value;applyFilter()});
  hide.addEventListener('change',()=>{
    ui.hideDone=hide.checked;try{localStorage[KU]=JSON.stringify({hideDone:ui.hideDone})}catch{}
    applyFilter();
  });
  document.addEventListener('keydown',e=>{
    const typing=e.target.closest&&e.target.closest('[contenteditable],input,textarea,select');
    if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'&&undoSnap&&!typing){e.preventDefault();doUndo()}
    else if(e.key==='/'&&!typing&&!e.ctrlKey&&!e.metaKey){e.preventDefault();search.focus()}
  });
  // another tab changed the data
  window.addEventListener('storage',e=>{
    if(e.key!==K)return;
    if(document.activeElement&&document.activeElement.closest&&document.activeElement.closest('.cur-table')){
      toast('Curriculum changed in another tab — reload this page to sync before editing more');return;
    }
    D=load();render();
  });
  window.addEventListener('beforeprint',()=>$$('.cur-table-wrap').forEach(w=>w.classList.remove('collapsed')));
  window.addEventListener('afterprint',()=>$$('.cur-table-wrap').forEach(w=>{const t=D.tables.find(x=>x.id===w.dataset.tid);if(t&&t.collapsed)w.classList.add('collapsed')}));

  render();
})();
