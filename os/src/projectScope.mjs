export function projectBase(pathname=globalThis.location?.pathname||'/') {
  return pathname.match(/^\/p\/[a-z0-9-]+(?=\/|$)/)?.[0]||'';
}
export function projectUrl(url) {
  return typeof url==='string'&&url.startsWith('/api/')&&!url.startsWith('/api/launchroom/') ? projectBase()+url : url;
}
export const projectAsset=path=>projectUrl('/api/asset?path='+encodeURIComponent(path));
