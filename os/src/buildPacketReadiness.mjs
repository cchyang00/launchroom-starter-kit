export const ASSET_SERVER_PENDING = 'OS server update pending: final asset file checks are not active yet.';

export function safeBuildReadiness(readiness) {
  if (!readiness) return null;
  if (readiness.assetFileChecksSupported === true) return readiness;
  return {
    ...readiness,
    assetsReviewed: false,
    atlasReady: false,
    atlasBlockers: [...(readiness.atlasBlockers || []), ASSET_SERVER_PENDING],
  };
}
