// Case notes also serve native Codex, so they may contain absolute Windows paths.
export function localDocumentUrl(value) {
  let decoded; try { decoded=decodeURI(value); } catch { decoded=value; }
  decoded=decoded.replaceAll('\\','/');
  if (/^[a-z]:\//i.test(decoded)) {
    const marker='/dropshipping/'; const index=decoded.toLowerCase().indexOf(marker);
    return index>=0?'/'+decoded.slice(index+marker.length):'';
  }
  return value;
}
export function resolveDocumentPath(currentPath, href) {
  if (!href) return '';
  href=localDocumentUrl(href);
  if (/^https?:/i.test(href)) return href;
  if (href.startsWith('#')) return currentPath.split('#')[0]+href;
  const parts=href.startsWith('/')?[]:currentPath.split('#')[0].split('/').slice(0,-1);
  for (const part of href.split('/')) {if(part==='..')parts.pop();else if(part&&part!=='.')parts.push(part);}
  return parts.join('/');
}

export function headingAnchor(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu,'').trim().replace(/\s/g,'-');
}
