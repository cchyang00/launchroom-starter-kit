import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parsePreDiscovery} from '../src/preDiscovery.mjs';

test('pre-discovery checklist exposes ten ordered evidence checks', () => {
  const source=readFileSync(new URL('../../workflow/PRE-DISCOVERY-CHECKLIST.md',import.meta.url),'utf8');
  const rows=parsePreDiscovery(source);
  assert.deepEqual(rows.map(row=>row.id),Array.from({length:10},(_,i)=>`B${String(i+1).padStart(2,'0')}`));
  assert.ok(rows.every(row=>typeof row.done==='boolean'));
  assert.match(rows[9].title,/Kalodata/);
  assert.match(rows[9].title,/^Authenticate the current Kalodata Product view and verify usable country, category and date controls\./);
  assert.match(rows[9].title,/Trendtrack may remain signed out during early visual curation/);
});
