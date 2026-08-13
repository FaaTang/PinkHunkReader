import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'scripts', 'render-appicon.mjs'));
let Resvg;
let pngToIco;
try {
  ({ Resvg } = require('@resvg/resvg-js'));
  const mod = require('png-to-ico');
  pngToIco = mod.default || mod;
} catch {
  const dbRequire = createRequire(join(root, '..', 'PinkHunkDB', 'node_modules', 'png-to-ico', 'package.json'));
  ({ Resvg } = dbRequire('@resvg/resvg-js'));
  const mod = dbRequire('png-to-ico');
  pngToIco = mod.default || mod;
}

const svgPath = join(root, 'logo.svg');
const pngPath = join(root, 'build', 'appicon.png');
const icoPath = join(root, 'build', 'windows', 'icon.ico');

const svg = readFileSync(svgPath, 'utf8');
writeFileSync(
  pngPath,
  new Resvg(svg, { fitTo: { mode: 'width', value: 1024 }, background: 'rgba(0,0,0,0)' }).render().asPng(),
);

const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngBuffers = sizes.map((size) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: size }, background: 'rgba(0,0,0,0)' }).render().asPng(),
);
writeFileSync(icoPath, await pngToIco(pngBuffers));

console.log(`Wrote ${pngPath}`);
console.log(`Wrote ${icoPath}`);
