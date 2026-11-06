import { STAGES } from './domain.mjs';
import { screenReady } from './research.mjs';
import { countryKey } from './country.mjs';
import { cardIdentity } from '../src/researchView.mjs';

export function researchIdentityBinding(product, market, candidate) {
  if (!candidate || market.researchCandidateId !== candidate.id) return { ready: false, code: 'PRE_VERIFICATION_REQUIRED', reason: 'Link this product market to its exact research card.' };
  if (!candidate.country || countryKey(candidate.country) !== countryKey(market.country)) return { ready: false, code: 'RESEARCH_COUNTRY_MISMATCH', reason: 'The research card does not cover this selling country.' };
  if (!product.sourceUrl || cardIdentity(candidate) !== product.sourceUrl) return { ready: false, code: 'RESEARCH_IDENTITY_MISMATCH', reason: 'The exact product listing differs from the research card identity source.' };
  return { ready: true, reason: 'The product listing and selling country match the research card.' };
}

export function researchBinding(product, market, research) {
  const candidate = research.candidates.find(item => item.id === market.researchCandidateId);
  if (candidate?.missingEvidence?.screen?.length) return { ready: false, code: 'RESEARCH_EVIDENCE_MISSING', reason: `Pre-verification evidence files are unavailable: ${candidate.missingEvidence.paths.join(', ')}. Restore or replace the sources before verifying product checks.` };
  if (!candidate || !screenReady(candidate)) return { ready: false, code: 'PRE_VERIFICATION_REQUIRED', reason: 'Link an owner-saved research card with all five Find checks and the source-and-profit preflight supported.' };
  const identity = researchIdentityBinding(product, market, candidate);
  return identity.ready ? { ready: true, reason: 'Pre-verification screen matches this product and market.' } : identity;
}

// Keep historical proof intact. A stale or missing screen does not count as
// current process progress, even if older product evidence remains readable.
export function projectProductResearch(product, research) {
  return { ...product, markets: product.markets.map(market => {
    const verificationGate = researchBinding(product, market, research);
    const effectiveVerifiedCount = verificationGate.ready ? market.verifiedCount : 0;
    const effectiveStageId = verificationGate.ready ? market.stageId : STAGES[0].id;
    return { ...market, verificationGate, effectiveVerifiedCount, effectiveStageId };
  }) };
}
