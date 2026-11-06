import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseMap, currentMap} from '../src/mindmapModel.mjs';

const work = {id: 'M-1', title: 'Our working mind map', revision: 3};
const other = {id: 'M-2', title: 'Store ideas', revision: 1};

test('the Maps page renders before the hub answers: no maps and nothing saved is not a crash', () => {
  // #/maps threw "Cannot read properties of null (reading 'revision')" on first load.
  assert.equal(chooseMap([], ''), null);
  assert.equal(chooseMap(undefined, 'M-1'), null);
  assert.equal(currentMap(null, null), null);
  assert.equal(currentMap(null, undefined), null);
  assert.equal(currentMap(null, chooseMap([], 'M-1')), null);
});

test('the remembered map wins, then the working map, then the first', () => {
  assert.equal(chooseMap([other, work], 'M-2'), other);
  assert.equal(chooseMap([other, work], 'gone'), work);
  assert.equal(chooseMap([other], ''), other);
});

test('our own newer save shows until the polled list catches up', () => {
  const saved = {...work, revision: 4};
  assert.equal(currentMap(saved, work), saved);
  assert.equal(currentMap(saved, {...work, revision: 4}).revision, 4);
  assert.equal(currentMap({...work, revision: 2}, work), work, 'an older save never hides the listed map');
  assert.equal(currentMap(saved, other), other, 'a save of another map is ignored');
  assert.equal(currentMap(saved, null), null);
});
