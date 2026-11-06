/** Fallback swatch colors when Shopify has no swatch configured for a value. */
export const colorMap: Record<string, string> = {
  Evergreen: '#1b4332',
  'Evergreen Tartan + Crimson Bow': '#1b4332',
  Classic: '#9e1b24',
  'Classic Red Tartan + Crimson Bow': '#9e1b24',
  Green: '#345447',
  Clay: '#b68469',
  Red: '#853840',
  Jam: '#853840',
  Ocean: '#497480',
  Purple: '#766b8c',
  Violet: '#766b8c',
  Black: '#262626',
  White: '#f4f2ec',
  Gray: '#8d8f8a',
  Grey: '#8d8f8a',
  Navy: '#27344c',
  Blue: '#4a6b8f',
  Beige: '#d8c9ad',
  Cream: '#ece3cf',
  Brown: '#6d4c3a',
  Olive: '#6b6f45',
  Pink: '#d6a3a6',
  Yellow: '#e2c65a',
  Orange: '#c86a3a',
};

export function swatchColor(name: string, color?: string | null) {
  return color || colorMap[name] || colorMap[name.split(' ')[0]] || '#9a9a92';
}

export function isColorOption(name: string) {
  return /^colou?r$/i.test(name.trim());
}
