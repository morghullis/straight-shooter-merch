import type { Product, ProductColor } from "./types";

export const isColorOption = (name: string) => ["color", "colour", "colors", "colours"].includes(name.trim().toLowerCase());

/**
 * Garment colours by name, for the ones Shopify has no swatch for (its category field "Color" only
 * knows a few). A name of several words goes by its last known word ("Heather Navy" is a navy).
 */
const NAMED: Record<string, string> = {
  black: "#0b0b0b", white: "#ffffff", navy: "#1b2a49", red: "#c8102e", blue: "#1f4fa3", royal: "#1d4fb8", green: "#2e7d4f",
  yellow: "#f4c430", gold: "#d9a520", orange: "#e8731a", pink: "#f2a0b5", purple: "#5b2d8e", brown: "#5c4033", grey: "#8a8d91",
  gray: "#8a8d91", silver: "#c0c3c7", charcoal: "#3b3e42", graphite: "#41444a", heather: "#a9acb0", ash: "#d3d4d2", smoke: "#6f7277",
  cream: "#f3ead7", natural: "#efe6d2", ivory: "#f6f0e1", bone: "#e4dccb", sand: "#d8c6a5", tan: "#c8a97e", beige: "#dccab0",
  khaki: "#b8a77f", camel: "#b98b56", mocha: "#7b5a45", chocolate: "#4a2e22", espresso: "#3a2a22", maroon: "#5e1224", burgundy: "#5f1a2d",
  wine: "#5b1b2e", cardinal: "#8c1a2f", crimson: "#a31631", scarlet: "#c21f2c", coral: "#f27a66", peach: "#f6bfa0", salmon: "#ef9083",
  rose: "#dba1a3", fuchsia: "#c9277f", magenta: "#b31b74", berry: "#7a1f4b", lavender: "#b9a3d9", lilac: "#c3aedb", violet: "#6a3fa0",
  plum: "#54264f", indigo: "#34376f", teal: "#14757b", turquoise: "#2fb3b1", aqua: "#7fd0d6", mint: "#a8dfc6", sage: "#9caf88",
  olive: "#5b5d35", army: "#4b5237", military: "#4d5438", forest: "#1f4030", kelly: "#1f8a46", emerald: "#11754d", lime: "#9acb3c",
  sky: "#8cc3e8", carolina: "#6fa8dc", denim: "#3c5a80", slate: "#59656f", steel: "#6c7a86", midnight: "#141b2d", stone: "#b9b1a3",
  rust: "#a5472a", copper: "#b0643a", bronze: "#8c6a3f", mustard: "#c99a2e", butter: "#f3dd8e", lemon: "#f5e063",
};

/** The colour a name stands for, or null ("Tie dye", "Geometric"). */
export function colorByName(label: string): string | null {
  // "Black/White" goes by its first colour.
  const words = label.toLowerCase().split("/")[0].split(/[^a-z]+/).filter(Boolean);
  for (const word of words.reverse()) if (NAMED[word]) return NAMED[word];
  return null;
}

/**
 * The colours a product comes in: its "Color" option values (what can be bought), with the swatch
 * Shopify has for each in the product's category field "Color", or the one its name stands for; without
 * a Color option, the category field itself. Colours no one knows keep their name (hex null).
 */
export function productColors(product: Product): ProductColor[] {
  const known = new Map((product.colors ?? []).map((c) => [c.label.toLowerCase(), c]));
  const option = product.options.find((o) => isColorOption(o.name));
  if (!option) return product.colors ?? [];
  return option.values.map((value) => {
    const swatch = known.get(value.toLowerCase());
    return swatch?.hex ? swatch : { label: value, hex: colorByName(value) };
  });
}
