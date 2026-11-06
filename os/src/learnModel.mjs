export const LEARN_CATALOG = 'resources/learning/CATALOG.md';

const localPath = value => typeof value === 'string' && /^(resources|agents)\//.test(value) && !value.includes('..') && !/[\\?#]/.test(value);
export function parseLearningCatalog(markdown) {
  const json = markdown.match(/```json\s*([\s\S]*?)```/);
  if (!json) throw new Error('The lesson catalog is missing. Open the source file to repair it, then reload lessons.');
  const data = JSON.parse(json[1]);
  if (!Array.isArray(data.lessons) || !data.lessons.length || data.lessons.length > 30) throw new Error('The catalog needs 1–30 lessons.');
  const ids = new Set();
  for (const lesson of data.lessons) {
    if (!/^[a-z0-9-]+$/.test(lesson.id) || ids.has(lesson.id)) throw new Error('Each lesson needs a unique ID.');
    ids.add(lesson.id);
    for (const key of ['topic','title','takeaway','alt','caption','question','answer','next']) if (typeof lesson[key] !== 'string' || !lesson[key].trim()) throw new Error(`Lesson ${lesson.id} needs ${key}.`);
    if (!localPath(lesson.image) || !localPath(lesson.document) || !lesson.document.endsWith('.md')) throw new Error('Lesson files must use safe workspace paths.');
    if (lesson.secondaryImage && (!localPath(lesson.secondaryImage) || !lesson.secondaryAlt)) throw new Error('Comparison images need a safe path and text alternative.');
    if (!Array.isArray(lesson.points) || !lesson.points.length || lesson.points.some(p => typeof p !== 'string')) throw new Error('Lesson observations are missing.');
    if (!Array.isArray(lesson.sources) || !lesson.sources.length) throw new Error('Lesson sources are missing.');
    for (const s of lesson.sources) if (!s.title || !s.scope || !/^https:\/\//.test(s.url)) throw new Error('Sources need a title, HTTPS URL and read scope.');
  }
  return data;
}

export function contribution({price,units,unitCost,shipping,feePercent,refundReserve}) {
  const values = [price,units,unitCost,shipping,feePercent,refundReserve];
  if (values.some(n => !Number.isFinite(n) || n < 0) || units < 1) return null;
  const goods = units * unitCost, fees = price * feePercent / 100;
  return {goods,fees,shipping,refundReserve,available:price-goods-shipping-fees-refundReserve};
}
