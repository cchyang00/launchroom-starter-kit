import test from 'node:test';
import assert from 'node:assert/strict';
import {replaceFile} from './replaceFile.mjs';
test('Windows sharing errors retry the same atomic replacement without deleting the destination',async()=>{
 let attempts=0;const calls=[],delays=[];
 await replaceFile('prepared.tmp','OS.md',{move:async(...args)=>{calls.push(args);if(attempts++<2)throw Object.assign(new Error('locked reader'),{code:'EPERM'});},wait:async ms=>delays.push(ms)});
 assert.equal(attempts,3);assert.deepEqual(calls,Array(3).fill(['prepared.tmp','OS.md']));assert.deepEqual(delays,[25,50]);
});
test('persistent sharing failures are bounded and unrelated errors are not retried',async()=>{
 let attempts=0;await assert.rejects(replaceFile('a','b',{move:async()=>{attempts++;throw Object.assign(new Error('locked'),{code:'EBUSY'});},wait:async()=>{}}),/locked/);assert.equal(attempts,6);
 attempts=0;await assert.rejects(replaceFile('a','b',{move:async()=>{attempts++;throw Object.assign(new Error('disk full'),{code:'ENOSPC'});},wait:async()=>{}}),/disk full/);assert.equal(attempts,1);
});
