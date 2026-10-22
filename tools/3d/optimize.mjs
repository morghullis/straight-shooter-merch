// usage: node optimize.mjs <in.glb> <outDir> <name>
// Writes <outDir>/<name>.glb (web: showroom / phones) and <outDir>/<name>-hd.glb (product page on desktop).
import { optimizeGlb } from "./lib/optimize.mjs";

const [input, outDir, name] = process.argv.slice(2);
if (!input || !outDir || !name) throw new Error("Usage: node optimize.mjs <in.glb> <outDir> <name>");
await optimizeGlb(input, outDir, name);
