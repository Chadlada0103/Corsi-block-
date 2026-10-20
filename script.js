const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const EXP=new URLSearchParams(location.search).has('exp'); // เปิดด้วย ?exp=1 เพื่อให้ผู้ทดลองข้ามการพักได้
const POS=[[12,18],[38,8],[70,14],[84,36],[24,44],[55,40],[10,72],[42,80],[76,74]];
const NAME={instant:'Instant',animated:'Animated'},MODE={F:'Forward',B:'Backward'};
const board=$('board');
const blocks=POS.map((p,i)=>{const b=document.createElement('button');b.className='blk';b.style.left=p[0]+'%';b.style.top=p[1]+'%';b.setAttribute('aria-label','บล็อก '+(i+1));board.appendChild(b);return b});
let S={rows:[],ok:0,bad:0},tapHandler=null;

/* ตรวจจับการสลับแท็บ */
const vis={hid:false};
document.addEventListener('visibilitychange',()=>{if(document.hidden)vis.hid=true});
const waitVisible=async()=>{while(document.hidden)await sleep(200)};

/* ลำดับแบบ seed: รหัสนักศึกษา + ชุด(A/B) + รูปแบบ + เลเวล + ชุดที่ -> ได้ลำดับเดิมทุกครั้ง */
function hashSeed(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19}
  h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return(h^h>>>16)>>>0}
function mulberry32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function makeSeq(n,key){const rnd=mulberry32(hashSeed(key));const a=[...Array(9).keys()];for(let i=8;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,n)}

function show(id){['setup','gate','test','res'].forEach(x=>$(x).classList.toggle('hidden',x!==id))}
function flash(el,kind,cond){
  const cls=(cond==='instant'?'i-':'a-')+kind, dur=kind==='show'?700:(cond==='instant'?250:350);
  el.classList.remove('i-show','i-tap','a-show','a-tap');void el.offsetWidth;
  el.classList.add(cls);setTimeout(()=>el.classList.remove(cls),dur);
}
function renderNeed(n,k,act){
  const el=$('need');el.className='need'+(act?' act':'');
  el.innerHTML='<div class="nbig"><b>'+n+'</b><span>'+(act?'กดแล้ว '+k+' / เหลืออีก '+(n-k)+' อัน':'ต้องกดทั้งหมด '+n+' อัน')+'</span></div><div class="dots">'+Array.from({length:n},(_,i)=>'<i class="'+(i<k?'on':'')+'"></i>').join('')+'</div>';
}
function fmt(ms){return (ms/1000).toFixed(2)}

/* บันทึกสำรองลงเครื่อง */
function save(){try{localStorage.setItem('corsi_'+S.pid,JSON.stringify({pid:S.pid,order:S.order,rows:S.rows,ts:Date.now()}))}catch(e){}}
const CSV_H='student_id,order,timestamp,stage,set,condition,mode,level,length,trial,sequence,response,correct,first_tap_ms,total_rt_ms,tap_times_ms,interrupted';
function downloadCsv(rows,pid){
  const t=[CSV_H,...rows.map(x=>[x.pid,x.order,x.ts,x.stage,x.set,x.cond,x.mode,x.level,x.len,x.trial,x.seq,x.resp,x.ok,Math.round(x.first),Math.round(x.total),x.taps,x.interrupted].join(','))].join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+t],{type:'text/csv'}));a.download='corsi_'+pid+'.csv';a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
function renderBackups(){
  const items=[];
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('corsi_')){try{const d=JSON.parse(localStorage.getItem(k));if(d&&Array.isArray(d.rows))items.push({k,d})}catch(e){}}}}catch(e){}
  $('bk').classList.toggle('hidden',!items.length);
  const list=$('bkList');list.innerHTML='';
  items.forEach(({k,d})=>{
    const row=document.createElement('div');row.className='bk';
    const sp=document.createElement('span');sp.className='mute';
    sp.textContent='รหัส '+d.pid+' / '+d.rows.length+' ชุด / '+new Date(d.ts).toLocaleString('th-TH');
    const b1=document.createElement('button');b1.className='s';b1.textContent='ดาวน์โหลด CSV';b1.onclick=()=>downloadCsv(d.rows,d.pid);
    const b2=document.createElement('button');b2.className='s';b2.textContent='ลบ';
    b2.onclick=()=>{if(confirm('ลบข้อมูลสำรองของรหัส '+d.pid+' ?')){try{localStorage.removeItem(k)}catch(e){}renderBackups()}};
    row.append(sp,b1,b2);list.appendChild(row);
  });
}

async function trial(g,len,level,tn){
  const seq=makeSeq(len,[S.pid,g.practice?'P':'T',g.set,g.mode,level,tn].join('|')),need=g.mode==='B'?[...seq].reverse():seq;
  board.classList.add('lock');$('tTrial').textContent='0.00';renderNeed(len,0,false);
  let interrupted=0;
  for(;;){ // ถ้าสลับแท็บระหว่างแสดงลำดับ ให้แสดงใหม่
    vis.hid=document.hidden;
    $('status').textContent='ดูลำดับให้ดี…';
    await sleep(900);
    for(const b of seq){flash(blocks[b],'show',g.cond);await sleep(1000)}
    if(!vis.hid)break;
    interrupted++;
    $('status').textContent='ตรวจพบการสลับแท็บ — จะแสดงลำดับใหม่อีกครั้ง';
    await waitVisible();await sleep(1500);
  }
  $('status').textContent=g.mode==='B'?'กดบล็อกย้อนกลับ (จากตัวสุดท้ายไปตัวแรก)':'กดบล็อกตามลำดับที่เห็น';
  vis.hid=false;
  const taps=[],t0=performance.now();renderNeed(len,0,true);
  const iv=setInterval(()=>{$('tTrial').textContent=fmt(performance.now()-t0)},50);
  board.classList.remove('lock');
  await new Promise(res=>{tapHandler=(i,ts)=>{if(taps.length>=len)return;taps.push({b:i,t:Math.max(0,ts-t0)});renderNeed(len,taps.length,true);flash(blocks[i],'tap',g.cond);if(taps.length===len)res()}});
  tapHandler=null;clearInterval(iv);board.classList.add('lock');
  const ok=taps.every((x,i)=>x.b===need[i]),total=taps[taps.length-1].t;
  $('tTrial').textContent=fmt(total);
  if(!g.practice){
    ok?S.ok++:S.bad++;$('okN').textContent=S.ok;$('badN').textContent=S.bad;
    S.rows.push({pid:S.pid,order:S.order,ts:new Date().toISOString(),stage:g.n,set:g.set,cond:g.cond,mode:g.mode,level,len,trial:tn,seq:seq.map(x=>x+1).join('-'),resp:taps.map(x=>x.b+1).join('-'),ok:ok?1:0,first:taps[0].t,total,taps:taps.map(x=>Math.round(x.t)).join('|'),interrupted:interrupted+(vis.hid?1:0)});
    save();
  }
  $('fb').innerHTML=ok?'<span class="ok">✓ ถูกต้อง</span>':'<span class="no">✗ ผิด</span>';
  await sleep(1000);$('fb').innerHTML='';
  return ok;
}

async function runStage(g){
  show('test');
  const t0=performance.now(),tk=setInterval(()=>{const s=Math.floor((performance.now()-t0)/1000);$('tStage').textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0')},250);
  const lens=g.practice?[3]:[3,4,5,6,7,8,9];
  for(let li=0;li<lens.length;li++){
    for(let tn=1;tn<=(g.practice?1:2);tn++){
      $('head').textContent=(g.practice?'รอบฝึกซ้อม / ':'ช่วงที่ '+g.n+'/4 / ')+NAME[g.cond]+' / '+MODE[g.mode]+' / เลเวล '+(li+1)+'/'+lens.length+' (ลำดับ '+lens[li]+' บล็อก) / ชุดที่ '+tn+'/'+(g.practice?1:2);
      await trial(g,lens[li],li+1,tn);
    }
  }
  clearInterval(tk);
}

function gate(g){
  show('gate');$('gC').textContent='';$('gB').textContent='เริ่ม';$('gB').classList.remove('hidden');
  $('gT').textContent=(g.practice?'รอบฝึกซ้อม: ':'')+NAME[g.cond]+' Visual Feedback / '+MODE[g.mode];
  $('gD').textContent=g.mode==='F'?'ดูบล็อกที่สว่างขึ้นทีละตัว แล้วกดตามลำดับเดิม':'ดูบล็อกที่สว่างขึ้นทีละตัว แล้วกดย้อนกลับ จากตัวสุดท้ายไปตัวแรก';
  return new Promise(r=>{$('gB').onclick=r});
}
function rest(g){
  show('gate');$('gT').textContent='พักสายตา';$('gD').textContent=g.label;$('gB').textContent='ข้ามการพัก';
  $('gB').classList.toggle('hidden',!EXP); // ผู้เข้าร่วมข้ามเองไม่ได้
  const end=Date.now()+g.sec*1000;
  const draw=left=>$('gC').textContent=Math.floor(left/60)+':'+String(left%60).padStart(2,'0');
  draw(g.sec);
  return new Promise(r=>{
    const done=()=>{clearInterval(iv);r()};
    const iv=setInterval(()=>{const left=Math.max(0,Math.ceil((end-Date.now())/1000));draw(left);if(left<=0)done()},250);
    $('gB').onclick=done;
  });
}

async function main(){
  S={rows:[],ok:0,bad:0,pid:$('pid').value,order:document.querySelector('input[name=ord]:checked').value};
  $('okN').textContent=0;$('badN').textContent=0;
  const c=S.order==='ia'?['instant','animated']:['animated','instant'];
  const st=[];
  c.forEach((cond,i)=>{
    const set=i===0?'A':'B'; // ชุดลำดับ A สำหรับเงื่อนไขแรก, B สำหรับเงื่อนไขที่สอง
    if($('prac').checked)st.push({t:'run',cond,mode:'F',practice:1,set},{t:'run',cond,mode:'B',practice:1,set});
    st.push({t:'run',cond,mode:'F',set},{t:'rest',sec:60,label:'พักสายตา 1 นาที ก่อนทดสอบแบบ Backward'},{t:'run',cond,mode:'B',set});
    if(i===0)st.push({t:'rest',sec:300,label:'พักสายตา 5 นาที ก่อนเงื่อนไขถัดไป'});
  });
  let n=0;st.forEach(g=>{if(g.t==='run'&&!g.practice)g.n=++n});
  window.onbeforeunload=e=>{e.preventDefault();e.returnValue=''};
  for(const g of st){
    if(g.t==='rest')await rest(g);else{await gate(g);await runStage(g)}
  }
  results();
}

/* Span ต่อเนื่อง = เลเวลสูงสุดที่ตอบถูกอย่างน้อย 1 ใน 2 ชุด โดยทุกเลเวลก่อนหน้าก็ถูกอย่างน้อย 1 ชุด */
function spanOf(r){
  const by={};r.forEach(x=>{(by[x.len]=by[x.len]||[]).push(x)});
  let cont=0,max=0,broken=false;
  Object.keys(by).map(Number).sort((a,b)=>a-b).forEach(l=>{
    if(by[l].some(x=>x.ok)){max=l;if(!broken)cont=l}else broken=true;
  });
  return{cont,max};
}

function results(){
  window.onbeforeunload=null;save();
  show('res');$('who').textContent='รหัสนักศึกษา '+S.pid;
  const R=S.rows,groups=[];
  ['instant','animated'].forEach(c=>['F','B'].forEach(m=>{
    const r=R.filter(x=>x.cond===c&&x.mode===m);if(!r.length)return;
    const good=r.filter(x=>x.ok),sp=spanOf(r);
    const rt=good.length?good.reduce((a,x)=>a+x.total,0)/good.length:0;
    groups.push(`<tr><td>${NAME[c]}</td><td>${MODE[m]}</td><td>${sp.cont}</td><td>${sp.max}</td><td>${sp.cont*good.length}</td><td class="ok">${good.length}</td><td class="no">${r.length-good.length}</td><td>${fmt(rt)}</td></tr>`);
  }));
  $('sum').innerHTML='<tr><th>เงื่อนไข</th><th>รูปแบบ</th><th>Corsi Span (ต่อเนื่อง)</th><th>Span สูงสุดที่เคยถูก</th><th>Corsi Score</th><th>ถูก</th><th>ผิด</th><th>เวลาตอบเฉลี่ย (ชุดที่ถูก, วินาที)</th></tr>'+groups.join('');
  $('raw').innerHTML='<tr><th>เงื่อนไข</th><th>รูปแบบ</th><th>เลเวล</th><th>ยาว</th><th>ชุด</th><th>ผล</th><th>เวลา (วินาที)</th></tr>'+R.map(x=>`<tr><td>${NAME[x.cond]}</td><td>${MODE[x.mode]}</td><td>${x.level}</td><td>${x.len}</td><td>${x.trial}</td><td class="${x.ok?'ok':'no'}">${x.ok?'ถูก':'ผิด'}</td><td>${fmt(x.total)}${x.interrupted?' ⚠':''}</td></tr>`).join('');
}
$('csv').onclick=()=>downloadCsv(S.rows,S.pid);

/* pointerdown ให้เวลาตอบแม่นกว่า click; click ที่ detail===0 คือการกดด้วยคีย์บอร์ด */
blocks.forEach((b,i)=>{
  b.addEventListener('pointerdown',e=>{if(e.button>0||!tapHandler)return;e.preventDefault();tapHandler(i,e.timeStamp)});
  b.addEventListener('click',e=>{if(e.detail===0&&tapHandler)tapHandler(i,performance.now())});
});
const pidEl=$('pid'),msg=$('pidMsg');
pidEl.addEventListener('input',()=>{
  pidEl.value=pidEl.value.replace(/\D/g,'').slice(0,11);
  const n=pidEl.value.length,ok=n===11;
  $('go').disabled=!ok;
  msg.textContent=ok?'รหัสถูกต้อง':(n?'กรอกแล้ว '+n+'/11 หลัก':'กรอกตัวเลข 11 หลัก');
});
$('go').onclick=()=>{if(/^\d{11}$/.test(pidEl.value))main()};
renderBackups();
