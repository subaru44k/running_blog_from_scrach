import {reviewPriority} from './priority.js';
let db;
const $=id=>document.getElementById(id);
const labels={subject_match:'お題らしさ',structure:'構造',completion:'完成度',feature_capture:'特徴の表現',form_coherence:'形の整合性',finish_quality:'仕上がりの質'};
function el(tag,text,parent){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(parent)parent.append(n);return n;}
const latest=id=>db.reviews.filter(r=>r.evaluation_id===id).at(-1);
async function request(url,options){const r=await fetch(url,options);const data=await r.json();if(!r.ok)throw Error(data.error);return data;}
async function stats(){$('stats').textContent=JSON.stringify(await request(`/api/summary?accepted=${$('accepted').checked}`),null,2);}
const condition=e=>JSON.stringify([e.prompt_version,e.rubric_version,e.scoring_version,e.run_id,e.model,e.reasoning_effort,e.evaluator_type]);
function isPrimary(e){return db.evaluations.find(x=>['reference','candidate'].includes(x.evaluator_type)&&x.drawing_id===e.drawing_id&&condition(x)===condition(e))?.id===e.id;}
function previous(e){if(e.evaluator_type==='candidate')return db.evaluations.find(x=>x.drawing_id===e.drawing_id&&(x.id.startsWith('sol-ref-p3-01-')||x.id.startsWith('sol-tune-final-01-')||x.id.startsWith('sol-luna56-fresh-01-')));return db.evaluations.find(x=>x.evaluator_type==='reference'&&x.drawing_id===e.drawing_id&&x.prompt_version===(['prompt-v4','prompt-v5'].includes(e.prompt_version)?'prompt-v3':e.prompt_version==='prompt-v3'?'prompt-v2':'prompt-v1'));}
function priority(e){
 if(!isPrimary(e))return [];
 const old=previous(e),r=old?latest(old.id):undefined;
 const reasons=reviewPriority(e,db.evaluations.find(x=>x.evaluator_type==='production-saved'&&x.drawing_id===e.drawing_id),latest(e.id),r);
 if(['prompt-v3','prompt-v4','prompt-v5'].includes(e.prompt_version)&&!latest(e.id)&&r?.status==='valid'&&Object.keys(e.ratings).some(k=>e.ratings[k]!==old.ratings[k]))reasons.push('前回妥当だった作品の段階が変化：評価を崩していないか確認');
 return reasons;
}
function render(){
 $('works').replaceChildren();
 $('selection').textContent=`${db.drawings.length}作品・${db.evaluations.length}評価。過去月は保存Top20に偏っています。白紙などの網羅性は未確認です。`;
 const references=db.evaluations.filter(e=>['reference','candidate'].includes(e.evaluator_type)&&condition(e)===$('version').value&&isPrimary(e));
 const counts=Object.fromEntries(['valid','check','inappropriate'].map(status=>[status,references.filter(e=>latest(e.id)?.status===status).length]));
 const pending=references.filter(e=>!latest(e.id)).length, urgent=references.filter(e=>priority(e).length).length;
 $('progress').textContent=`${references[0]?.model||''} / ${references[0]?.reasoning_effort||''} ${references[0]?.prompt_version||''} 初回レビュー ${references.length-pending}/${references.length}件 — 妥当${counts.valid}・要確認${counts.check}・不適切${counts.inappropriate} ／ 未レビュー${pending}件、うち優先${urgent}件`;
 const drawings=[...db.drawings];
 if($('filter').value==='priority')drawings.sort((a,b)=>Math.max(0,...references.filter(e=>e.drawing_id===b.id).map(e=>priority(e).length))-Math.max(0,...references.filter(e=>e.drawing_id===a.id).map(e=>priority(e).length)));
 let displayed=0;
 for(const d of drawings){
  const all=db.evaluations.filter(e=>e.drawing_id===d.id&&(e.evaluator_type==='production-saved'||condition(e)===$('version').value)),filter=$('filter').value;
  const relevant=all.filter(e=>['reference','candidate'].includes(e.evaluator_type)&&isPrimary(e));
  if(!relevant.length)continue;
  const reasons=[...new Set(relevant.flatMap(priority))];
  if(filter==='priority'&&!reasons.length)continue;
  displayed++;
  if(filter==='pending'&&!relevant.some(e=>!latest(e.id)))continue;
  if(['check','inappropriate'].includes(filter)&&!relevant.some(e=>latest(e.id)?.status===filter))continue;
  const card=el('article',undefined,$('works'));card.className='work';card.id=`work-${d.id}`;el('h2',d.prompt_text,card);
  if(reasons.length){const badge=el('aside',undefined,card);badge.className='priority';el('strong','優先して確認',badge);for(const reason of reasons)el('p',reason,badge);}
  const image=el('img',undefined,card);image.src='/'+d.image_path;image.alt=d.prompt_text;image.loading='lazy';
  el('p',d.id,card).className='metadata';
  const current=relevant[0],old=current?previous(current):null;
  if(old){const compare=el('details',undefined,card);el('summary','前の評価・あなたのレビューを見る',compare);el('p',`${old.model} / ${old.reasoning_effort} · ${old.prompt_version} / ${old.rubric_version}: ${old.calculated_score}点 → 今回${current.calculated_score}点`,compare);const r=latest(old.id);if(r)el('p',`前のレビュー: ${{valid:'妥当',check:'要確認',inappropriate:'不適切'}[r.status]} — ${r.note||'メモなし'}`,compare);else el('p','前の評価は未レビュー',compare);}
  if(!relevant.length)el('p','reference 未評価 — Codexの評価JSONを取り込んでください。',card);
  for(const e of all){
   if($('blind').checked&&e.evaluator_type==='production-saved')continue;
   const repeated=['reference','candidate'].includes(e.evaluator_type)&&!isPrimary(e);
   const panel=el(repeated?'details':'section',undefined,card);panel.className='evaluation';
   if(repeated)el('summary',`独立反復評価 — ${e.calculated_score}点`,panel);
   el('h3',`${e.evaluator_type} / ${e.model} · ${e.prompt_version} / ${e.rubric_version}${repeated?' · 反復':' · 初回'}`,panel);el('strong',`${e.calculated_score}点（${e.scoring_version==='score-v2'?'補正前の基礎点':'評価点'}） / confidence: ${e.confidence??'未保存'}`,panel);
   if(e.ratings){const table=el('table',undefined,panel);for(const [k,v]of Object.entries(e.ratings)){const row=el('tr',undefined,table);el('th',labels[k]||k,row);el('td',`${v} / ${e.rubric_version==='rubric-v2'?6:e.evaluator_type==='production-saved'?10:4}`,row);}}
   for(const [key,title]of [['visual_observations','観察'],['positive_points','良い点'],['improvement_points','改善点']])if(e[key]?.length)el('p',`${title}: ${e[key].join(' / ')}`,panel);
   if(e.axis_evidence)for(const [axis,points]of Object.entries(e.axis_evidence))el('p',`${labels[axis]}の根拠: ${points.join(' / ')}`,panel);
   if(e.short_reason)el('p',e.short_reason,panel);
   el('p',`${e.id} | ${e.model_version} | effort=${e.reasoning_effort} | ${e.prompt_version} / ${e.rubric_version} / ${e.scoring_version} | run=${e.run_id}`,panel).className='metadata';
   const r=latest(e.id),select=el('select',undefined,panel);select.setAttribute('aria-label','レビュー状態');
   for(const [v,t]of [['','未レビュー'],['valid','妥当'],['check','要確認'],['inappropriate','不適切']]){const option=el('option',t,select);option.value=v;}
   select.value=r?.status||'';const note=el('textarea',undefined,panel);note.setAttribute('aria-label','レビューのメモ');note.value=r?.note||'';
   const button=el('button','レビューを保存',panel);button.onclick=async()=>{
    button.disabled=true;try{const result=await request('/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({evaluation_id:e.id,status:select.value,note:note.value})});db.reviews.push(result);render();$('message').textContent=`保存しました: ${e.id}`;await stats();}catch(error){$('message').textContent=error.message;}finally{button.disabled=false;}
   };
   if(r)el('p',`保存済み: ${r.reviewed_at}`,panel).className='metadata';
  }
 }
 if(!displayed)el('p',$('filter').value==='priority'?'優先レビューの未確認作品はありません。必要に応じて「未レビューの評価」で他の作品も確認してください。':'この条件の作品はありません。',$('works'));
}
async function reload(){try{
 db=await request('/api/data');const selected=$('version').value;
 const versions=[...new Map(db.evaluations.filter(e=>['reference','candidate'].includes(e.evaluator_type)).map(e=>[condition(e),e])).entries()].sort((a,b)=>b[0].localeCompare(a[0]));
 $('version').replaceChildren();for(const [value,e]of versions){const option=el('option',`${e.model} / ${e.reasoning_effort} · ${e.prompt_version}（${e.rubric_version} / ${e.scoring_version}） · ${e.run_id}`,$('version'));option.value=value;}
 if(versions.some(([v])=>v===selected))$('version').value=selected;render();await stats();
}catch(e){$('message').textContent=e.message;}}
$('version').onchange=render;$('filter').onchange=render;$('blind').onchange=render;$('accepted').onchange=stats;$('refresh').onclick=reload;reload();
