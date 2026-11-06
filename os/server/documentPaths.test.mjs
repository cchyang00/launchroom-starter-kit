import test from 'node:test';
import assert from 'node:assert/strict';
import {localDocumentUrl,resolveDocumentPath} from '../src/documentPaths.mjs';
test('case note media resolves native Windows, encoded and relative source paths',()=>{
  const doc='agents/validation/skills/research-products/references/cases/REF001.md';
  for(const url of ['C:/Users/Cha Yang/Documents/dropshipping/guides/rippy-club/evidence/image.png','C:/Users/Cha%20Yang/Documents/dropshipping/guides/rippy-club/evidence/image.png','../../../../../../guides/rippy-club/evidence/image.png']) assert.equal(resolveDocumentPath(doc,url),'guides/rippy-club/evidence/image.png');
  assert.equal(resolveDocumentPath(doc,'/resources/INDEX.md'),'resources/INDEX.md');
  assert.equal(resolveDocumentPath(doc,'https://example.com/source'),'https://example.com/source');
  assert.equal(localDocumentUrl('C:/private/file.png'),'');
});
