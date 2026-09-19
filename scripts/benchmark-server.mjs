// Local-only controller bridge for a Codex session using the benchmark harness.
// Run with JEV_BENCH_ENV_FILE set to an existing credential file.
import {createServer} from 'node:http';
import {createBenchmark} from './benchmark-session.mjs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const bench=await createBenchmark();
const output=resolve(root,'docs/controller-benchmark-2026-09-19.json');
let busy=false;
const server=createServer(async(req,res)=>{
  if(req.method!=='POST'||req.headers.origin){res.writeHead(403).end();return;}
  if(busy){res.writeHead(409).end();return;}
  busy=true;
  try{
    let body='';for await(const chunk of req){body+=chunk;if(body.length>1000)throw new Error('Request too large');}
    const {command,index}=JSON.parse(body);
    let result;
    if(command==='jev')result=await bench.runJev(process.env.JEV_BENCH_ENV_FILE);
    else if(command==='begin')result=await bench.beginCodex();
    else if(command==='click'&&Number.isInteger(index))result=await bench.click(index);
    else if(command==='finish')result=await bench.finishCodex();
    else if(command==='save')result=await bench.save(output);
    else if(command==='close'){await bench.close();result={closed:true};server.close();}
    else throw new Error('Unknown command');
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
  }catch{res.writeHead(500,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Benchmark command failed; raw details withheld'}));}
  finally{busy=false;}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
console.log(JSON.stringify({port:server.address().port,output}));
