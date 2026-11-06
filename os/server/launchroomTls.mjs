import fs from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
// TLS is opt-in. The default HTTP listener remains loopback-only.
// A second listener shares the same handler/state; no localhost proxy or
// X-Forwarded-For trust is involved.
export async function loadRemoteConfig(workspaceRoot) {
  const dir=path.join(workspaceRoot,'os/private/launchroom');
  let config;try {config=JSON.parse(await fs.readFile(path.join(dir,'remote.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}
  if(config.enabled!==true)return null;
  if(!/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/.test(config.address))throw Error('Remote bind must be the specific NetBird IPv4 address.');
  const origin=new URL(config.origin);
  if(origin.protocol!=='https:'||origin.origin!==config.origin||origin.username||origin.password)throw Error('Remote origin must be an exact HTTPS origin.');
  const port=Number(origin.port||443);
  const cert=await fs.readFile(path.join(dir,'tls/server.crt'));
  const key=await fs.readFile(path.join(dir,'tls/server.key'));
  return {address:config.address,origin:config.origin,port,cert,key};
}
export async function listenRemote(config,handler) {
  if(!config)return null;
  const server=https.createServer({cert:config.cert,key:config.key,minVersion:'TLSv1.2'},handler);
  server.requestTimeout=300000;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(config.port,config.address,resolve);});
  console.log('Launchroom private HTTPS: '+config.origin);
  return server;
}
