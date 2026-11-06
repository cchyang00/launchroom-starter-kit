import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('scoped local helper keeps its project header and never falls back to legacy health records', async t => {
  const seen=[];
  const server=http.createServer((req,res)=>{
    seen.push({path:req.url,header:req.headers['x-launchroom-local-agent']});
    res.writeHead(404,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Fixture unavailable'}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const helper=fileURLToPath(new URL('../../.claude/skills/merrivy-os/scripts/os.mjs',import.meta.url));
  const result=await new Promise(resolve=>execFile(process.execPath,[helper,'doctor'],{
    env:{...process.env,MERRIVY_OS_PORT:String(server.address().port),LAUNCHROOM_PROJECT:'p-fixture'},timeout:10000,
  },(error,stdout,stderr)=>resolve({error,stdout,stderr})));
  assert.equal(result.error?.code,1);
  assert.match(result.stderr,/Project p-fixture health check is unavailable/);
  assert.equal(result.stdout,'');
  assert.deepEqual(seen,[{path:'/p/p-fixture/api/doctor',header:'1'}]);
});
