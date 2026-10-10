import {createServer} from 'node:http';
import {readFileSync,realpathSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {load,save,review,summary} from './core.mjs';
import {buildComparison} from './score-candidates.mjs';
import {scoreHTML} from './score-report.mjs';
import {modelComparisonHTML} from './model-comparison.mjs';
const here=dirname(fileURLToPath(import.meta.url)),dir=realpathSync(resolve(process.argv[2]||resolve(here,'data')));
const path=resolve(dir,'dataset.json'),port=Number(process.env.PORT||4317);
load(path);
const lock=resolve(dir,'.server.lock');
const fd=openSync(lock,'wx');closeSync(fd);
const cleanup=()=>{try{unlinkSync(lock);}catch{}};
process.on('exit',cleanup);process.on('SIGINT',()=>process.exit());process.on('SIGTERM',()=>process.exit());
const server=createServer(async(req,res)=>{
 const send=(status,data,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; frame-ancestors 'none'"});res.end(type==='application/json'?JSON.stringify(data):data);};
 try{
  if(req.headers.host!==`127.0.0.1:${port}` && req.headers.host!==`localhost:${port}`)return send(403,{error:'Invalid host'});
  const url=new URL(req.url,`http://127.0.0.1:${port}`);
  if(req.method==='GET'&&url.pathname==='/model-comparison')return send(200,modelComparisonHTML(load(path),dir),'text/html; charset=utf-8');
  if(req.method==='GET'&&url.pathname==='/score-comparison')return send(200,scoreHTML(buildComparison(load(path))),'text/html; charset=utf-8');
  if(req.method==='GET'&&url.pathname==='/api/data')return send(200,load(path));
  if(req.method==='GET'&&url.pathname==='/api/summary')return send(200,summary(load(path),url.searchParams.get('accepted')==='true'));
  if(req.method==='POST'&&url.pathname==='/api/reviews'){
   if(req.headers.origin!==`http://${req.headers.host}` || req.headers['content-type']!=='application/json')return send(403,{error:'Same-origin JSON required'});
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>10000)return send(413,{error:'Too large'});}
   const db=review(load(path),JSON.parse(body));save(path,db);return send(200,db.reviews.at(-1));
  }
  if(req.method==='GET'&&url.pathname.startsWith('/images/')){
   const db=load(path),relative=decodeURIComponent(url.pathname.slice(1));
   if(!db.drawings.some(d=>d.image_path===relative))return send(404,{error:'Unknown image'});
   const target=realpathSync(resolve(dir,relative));if(!target.startsWith(dir+sep))return send(403,{error:'Invalid path'});
   return send(200,readFileSync(target),'image/png');
  }
  const files={'/':'index.html','/app.js':'app.js','/priority.js':'priority.mjs','/style.css':'style.css','/model-comparison.css':'model-comparison.css','/score-comparison.css':'score-comparison.css'};
  if(req.method==='GET'&&files[url.pathname])return send(200,readFileSync(resolve(here,files[url.pathname])),url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html; charset=utf-8');
  send(404,{error:'Not found'});
 }catch(e){send(400,{error:e.message});}
});
server.on('error',e=>{console.error(e.message);process.exit(1);});
server.listen(port,'127.0.0.1',()=>console.log(`Drawing evaluation: http://127.0.0.1:${port}`));
