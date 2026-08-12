// The registry mirrors paramShape in treegen's mcp/server.js. One line here
// per generator param: the form, value outputs, URL state, and MCP snippet
// all render from this table. Seed is deliberately absent — it lives in the
// top bar, not the panel.
import { leafPalettes, barkPalettes } from 'treegen/generator';

export const GROUPS = [
  { id: 'shape', title: 'Shape' },
  { id: 'trunk', title: 'Trunk & branches' },
  { id: 'foliage', title: 'Foliage' },
  { id: 'color', title: 'Color' },
  { id: 'wear', title: 'Age & condition' },
];

const SPECIES = ['round', 'oak', 'acacia', 'willow', 'pine', 'birch', 'poplar', 'palm', 'baobab'];
const LEAF_STYLES = ['clustered', 'angular', 'rounded', 'flat', 'needles'];

export const PARAMS = [
  { name: 'species', group: 'shape', control: 'select', options: SPECIES, label: 'Species' },
  { name: 'height', group: 'shape', control: 'range', min: 2, max: 50, step: 0.1, unit: 'm', label: 'Height', help: 'Above ~15m the trunk blends toward columnar giant proportions' },
  { name: 'canopySize', group: 'shape', control: 'range', min: 0.9, max: 8, step: 0.05, label: 'Canopy' },
  { name: 'lean', group: 'shape', control: 'range', min: 0, max: 0.55, step: 0.01, label: 'Lean' },
  { name: 'detail', group: 'shape', control: 'select', options: [0, 1, 2], optionLabels: ['0 — low-poly', '1 — game-ready', '2 — hero'], label: 'Detail' },

  { name: 'trunkRadius', group: 'trunk', control: 'range', min: 0.15, max: 2.5, step: 0.01, label: 'Trunk radius' },
  { name: 'branchCount', group: 'trunk', control: 'range', min: 4, max: 18, step: 1, label: 'Branches' },
  { name: 'branchSpread', group: 'trunk', control: 'range', min: 0.45, max: 2.2, step: 0.01, label: 'Spread' },

  { name: 'leafDensity', group: 'foliage', control: 'range', min: 0, max: 64, step: 1, label: 'Foliage', help: '0 = bare winter tree: terminals grow fine twigs instead of leaves' },
  { name: 'leafStyle', group: 'foliage', control: 'select', options: LEAF_STYLES, label: 'Leaf style' },
  { name: 'leafShape', group: 'foliage', control: 'range', min: 0.15, max: 1, step: 0.01, label: 'Leaf roundness' },
  { name: 'leafSize', group: 'foliage', control: 'range', min: 0.45, max: 1.7, step: 0.01, label: 'Leaf size' },
  { name: 'leafVariation', group: 'foliage', control: 'range', min: 0, max: 1, step: 0.01, label: 'Variation' },

  { name: 'leafPalette', group: 'color', control: 'swatch', swatches: leafPalettes, label: 'Leaf palette' },
  { name: 'barkPalette', group: 'color', control: 'swatch', swatches: barkPalettes, label: 'Bark palette' },

  { name: 'age', group: 'wear', control: 'range', min: 0, max: 1, step: 0.01, label: 'Age', help: '0 sapling, 0.5 mature, 1 ancient — drives slenderness, droop, gnarl, buttressing' },
  { name: 'brokenTop', group: 'wear', control: 'toggle', label: 'Broken top', help: 'Snap the trunk at ~70% height — a standing-dead snag' },
];

// Form values arrive as strings/booleans; coerce them to what buildTree expects.
export function coerce(def, raw) {
  if (def.control === 'range' || def.control === 'swatch') return Number(raw);
  if (def.control === 'toggle') return raw === true || raw === 'true';
  if (def.control === 'select' && typeof def.options[0] === 'number') return Number(raw);
  return raw;
}
