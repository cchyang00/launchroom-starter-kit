const countryAliases = { 'united states': 'US', usa: 'US', 'u.s.': 'US', 'u.s.a.': 'US', 'united states of america': 'US', 'united kingdom': 'GB', uk: 'GB', 'u.k.': 'GB', canada: 'CA', australia: 'AU', 'new zealand': 'NZ', germany: 'DE', france: 'FR', ireland: 'IE', netherlands: 'NL', spain: 'ES', italy: 'IT', sweden: 'SE' };
export const countryKey = value => {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  return countryAliases[normalized] || normalized.toUpperCase();
};
