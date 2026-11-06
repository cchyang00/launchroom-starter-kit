import {rename} from 'node:fs/promises';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// Windows readers/antivirus may briefly prevent replacement. Keep the old
// destination intact and retry the same prepared file within the writer lock.
export async function replaceFile(source,target,{move=rename,wait=pause}={}){
 for(let attempt=0;;attempt++){
  try{return await move(source,target);}catch(error){
   if(attempt>=5||!['EPERM','EACCES','EBUSY'].includes(error.code))throw error;
   await wait(25*2**attempt);
  }
 }
}
