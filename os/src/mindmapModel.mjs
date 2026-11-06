// Which mind map the Maps page shows. Pure, so it is tested in
// server/mindmapModel.test.mjs. The page first renders before /api/hub has
// answered (maps: []), so nothing here may assume a saved or listed map.

/** The listed map to show: the remembered one, then "Our working mind map", then the first. */
export function chooseMap(maps = [], rememberedId = '') {
  const list = Array.isArray(maps) ? maps : [];
  return list.find(map => map.id === rememberedId) || list.find(map => map.title === 'Our working mind map') || list[0] || null;
}

/**
 * The version to draw: our own just-saved copy while the polled list still
 * holds an older revision of the same map, otherwise the listed one.
 */
export function currentMap(saved, listed) {
  if (saved && listed && saved.id === listed.id && saved.revision > listed.revision) return saved;
  return listed || null;
}
