import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {candidateScore,candidates,axes} from './score-candidates.mjs';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function modelComparisonHTML(db,dir){
 const read=p=>JSON.parse(readFileSync(resolve(dir,p)));
 const analysis=read('decisions-20261009-live/analysis.json');
 const models=[['5.6 Luna low',read('luna56-train-baseline.json').concat(read('luna56-fresh-baseline.json'))],['6.0 Luna low',read('luna6-low-pilot.json')]];
 let tuned=[];let tunedId='';
 if(existsSync(resolve(dir,'decisions-tuning-20261009/freeze.json'))){const freeze=read('decisions-tuning-20261009/freeze.json');tunedId=freeze.selected;for(const phase of ['train','check']){const file=`decisions-tuning-20261009/${phase}-${tunedId}.json`;if(existsSync(resolve(dir,file)))tuned.push(...read(file));}}
 const f=candidates.find(c=>c.id==='game-balanced');
 const labels=['お題との一致','特徴の捉え方','形のまとまり','仕上がり'];
 const groups=[['既存17枚：Sol評価を人間レビューで妥当と確認',analysis.development[0].rows],['追加18枚：評価用に追加。Sol評価は人間未確認',analysis.check[0].rows]];
 let count=0;
 const section=groups.map(([title,rows])=>`<section><h2>${title}</h2>${rows.toSorted((a,b)=>b.teacher_score-a.teacher_score).map(r=>{
 const d=db.drawings.find(d=>d.id===r.drawing_id);if(!d)throw Error('Missing drawing');count++;
 const plausible=r.teacher.subject_match>=3&&r.teacher.form_coherence>=3&&r.teacher.finish_quality>=3;
 const values=[['Sol 6.1 low（基準）',r.teacher],...models.map(([label,records])=>[label,records.find(e=>e.drawing_id===r.drawing_id)?.ratings]),['Decisions（元の指示）',r.candidate],...(tunedId?[[`Decisions（改良 ${tunedId}）`,tuned.find(e=>e.drawing_id===r.drawing_id)?.parsed.map]]:[])];
 const table=values.map(([label,ratings])=>`<tr><th>${escape(label)}</th>${axes.map(k=>`<td>${ratings?ratings[k]:'—'}</td>`).join('')}<td class="score">${ratings?candidateScore(ratings,f).toFixed(2):'—'}</td></tr>`).join('');
 return `<article id="work-${escape(d.id)}"><div class="drawing"><h3>${escape(d.prompt_text)}</h3><a href="/images/${encodeURIComponent(d.id)}.png" target="_blank"><img src="/${escape(d.image_path)}" loading="lazy" alt="${escape(d.prompt_text)}の投稿作品"></a></div><div class="details"><p class="badge">${plausible?'前回の順位比較に含めた作品':'前回の順位比較の対象外（今回も表示）'}</p><div class="scroll"><table><thead><tr><th>評価モデル</th>${labels.map(x=>`<th>${x}</th>`).join('')}<th>F点数</th></tr></thead><tbody>${table}</tbody></table></div><p class="id">${escape(d.id)}</p><a href="/#work-${escape(d.id)}">既存レビュー画面を開く</a></div></article>`;
 }).join('')}</section>`).join('');
 if(count!==35)throw Error('Expected 35 works');
 return `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>絵・rubric・点数のモデル比較</title><link rel="stylesheet" href="/model-comparison.css"><body><main><a href="/">評価・レビュー画面へ</a><h1>絵・rubric・点数のモデル比較</h1><p>全35枚。低評価の作品も含みます。各セット内はSolのF点数が高い順です。</p><p>rubricは各軸0〜6、点数は全モデル同じ採用済みF方式（0〜100）。Lunaは共通prompt-v3の結果。Decisionsは最頻段階（MAP）です。改良版は既存17枚で選択した指示の結果です。未評価は「—」。追加18枚に6.0 Luna lowの比較結果はありません。</p><p>前回の順位比較対象：Solのお題との一致・形のまとまり・仕上がりがすべて3以上。これは作品の合否判定ではありません。Decisionsは文章の評価根拠を返さないため、この画面には生成していません。</p>${section}</main></body></html>`;
}
