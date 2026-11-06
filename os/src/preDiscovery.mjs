export function parsePreDiscovery(content=''){
  return [...content.matchAll(/^- \[([ x])\] \*\*(B\d{2})\*\* (.+)$/gm)].map(match=>({
    id:match[2], done:match[1]==='x', title:match[3].split(/ (?:Evidence|Partial evidence|Evidence pending):? /)[0],
  }));
}
