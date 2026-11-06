import test from 'node:test';
import assert from 'node:assert/strict';
import {storePreflight,PRE_PRODUCT_NEXT} from '../src/storeReadiness.mjs';

test('store preflight separates open preparation from owner and later checks', () => {
  const result = storePreflight([{items:[
    {id:'F06',done:false}, {id:'F07',done:true}, {id:'E03',done:false}, {id:'E05',done:false},
    {id:'P01',done:false}, {id:'L06',done:false}, {id:'D02',done:false},
  ]}]);
  assert.deepEqual(result.now.map(item => item.id), ['D02']);
  assert.deepEqual(result.owner.map(item => item.id), ['F06','E03','E05']);
  assert.deepEqual(result.later.map(item => item.id), ['P01','L06']);
});

test('owner-only security review does not become actionable setup work', () => {
  const result=storePreflight([{items:[{id:'F06',done:false},{id:'E05',done:false}]}]);
  assert.equal(result.now.length,0);
  assert.deepEqual(result.owner.map(item=>item.id),['F06','E05']);
});

test('notification delivery stays open in the visible pre-product queue', () => {
  const result=storePreflight([{items:[{id:'E07',done:false,title:'Verify notifications'},{id:'D02',done:false,title:'Finish brand basics'}]}]);
  assert.deepEqual(result.now.map(item=>item.id),['D02','E07']);
  assert.match(PRE_PRODUCT_NEXT.E07,/approved test order later/);
});
