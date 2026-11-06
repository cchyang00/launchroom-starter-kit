import test from 'node:test';
import assert from 'node:assert/strict';
import { safeBuildReadiness, ASSET_SERVER_PENDING } from '../src/buildPacketReadiness.mjs';

test('older live backend cannot surface a ready Atlas handoff before final file checks load', () => {
  const oldResponse = { briefReady: true, assetsReviewed: true, atlasReady: true, atlasBlockers: [] };
  const safe = safeBuildReadiness(oldResponse);
  assert.equal(safe.briefReady, true);
  assert.equal(safe.assetsReviewed, false);
  assert.equal(safe.atlasReady, false);
  assert.deepEqual(safe.atlasBlockers, [ASSET_SERVER_PENDING]);
  assert.equal(oldResponse.atlasReady, true, 'the API response is not mutated');
  const currentResponse = { ...oldResponse, assetFileChecksSupported: true };
  assert.equal(safeBuildReadiness(currentResponse), currentResponse);
});
