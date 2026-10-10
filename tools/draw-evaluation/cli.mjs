import {existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {load,save,importEvaluations,summary} from './core.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const [command,input,folder]=process.argv.slice(2);
const path=resolve(folder||resolve(here,'data'),'dataset.json');
if(command==='import'){if(existsSync(resolve(dirname(path),'.server.lock')))throw Error('Stop the server before importing to avoid concurrent writers');const db=importEvaluations(load(path),load(resolve(input)));save(path,db);console.log(`Imported ${load(resolve(input)).length} evaluations`);}
else if(command==='summary')console.log(JSON.stringify(summary(load(path),input==='accepted'),null,2));
else throw Error('Usage: cli.mjs import evaluations.json [data-dir] | summary all|accepted [data-dir]');
