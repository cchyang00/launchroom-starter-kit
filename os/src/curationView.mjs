const headingPattern = /^#{1,3}\s+(L\d{3,})\s*[—–-]\s*(.+)$/gm;

export function curationBatchLinks(queue) {
  return [...queue.matchAll(/^\|\s*\[([^\]]+)\]\(([^)#]+\/BATCH\.md)\)/gm)]
    .map(([, label, reference]) => ({ label, reference }));
}

export function curationBatchOverview(content) {
  const field = label => (content.match(new RegExp(`^\\*\\*${label}:\\*\\*\\s*(.+)$`, 'm'))?.[1] ?? '')
    .replace(/\s+/g, ' ').trim().slice(0, 600);
  return { status: field('Status'), access: field('Access'), viewingCoverage: field('Viewing coverage') };
}

export function splitCurationBatches(batches) {
  const dated = batches.map(batch => /^research\/(\d{4}-\d{2}-\d{2})/.exec(batch.path)?.[1] ?? '');
  const latest = dated.reduce((max, date) => date > max ? date : max, '');
  const current = batches.filter((batch, index) => latest ? dated[index] === latest : index === 0);
  return { current, earlier: batches.filter(batch => !current.includes(batch)) };
}

export function curationCards(content, sourcePath) {
  const headings = [...content.matchAll(headingPattern)];
  return headings.map((match, index) => {
    const section = content.slice(match.index, headings[index + 1]?.index ?? content.length);
    const image = section.match(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+[^)]*)?\)/);
    const external = section.match(/\[[^\]]+\]\((https?:\/\/[^)]+)\)/);
    const opening = section.slice(0, 500);
    return {
      id: match[1], name: match[2].replace(/\s+[—–/]\s+CURATED.*$/i, '').trim(),
      heading: match[0].replace(/^#+\s+/, ''), sourcePath,
      imageReference: image?.[2] ?? '', imageAlt: image?.[1] ?? '',
      externalUrl: external?.[1] ?? '',
      disposition: /\bKILL\b/i.test(opening) ? 'KILL' : /\bPARK\b/i.test(opening) ? 'PARK' : 'CURATED',
      ownerDecision: /owner[ -](?:decision:\s*)?unreviewed/i.test(opening) ? 'unreviewed' : 'unrecorded'
    };
  });
}
