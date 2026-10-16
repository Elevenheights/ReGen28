import { createRequire } from 'node:module';
import { mkdir, copyFile, access, readdir } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = process.env.REGEN28_IMAGE_MODULES
  ? createRequire(join(process.env.REGEN28_IMAGE_MODULES, 'package.json'))('sharp')
  : require('sharp');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const masterPath = join(root, 'resources/regen28-icon-master.png');
const backupRoot = join(root, '.icon-backups/before-20261015-refresh');
const background = '#0c103f';
const master = await sharp(masterPath).flatten({ background }).removeAlpha().png().toBuffer();
let generated = 0;

async function save(relativePath, buffer) {
  const target = join(root, relativePath);
  const backup = join(backupRoot, relativePath);
  try {
    await access(target);
    try { await access(backup); }
    catch { await mkdir(dirname(backup), { recursive: true }); await copyFile(target, backup); }
  } catch { /* New asset. */ }
  await mkdir(dirname(target), { recursive: true });
  await sharp(buffer).toFile(target);
  generated++;
}

async function icon(relativePath, size, padding = 0) {
  const artwork = await sharp(master).resize(size - padding * 2).png().toBuffer();
  const image = padding
    ? await sharp({ create: { width: size, height: size, channels: 3, background } })
      .composite([{ input: artwork, gravity: 'centre' }]).png().toBuffer()
    : artwork;
  const output = /play-store|playstore/.test(relativePath)
    ? await sharp(image).ensureAlpha().png().toBuffer()
    : image;
  await save(relativePath, output);
}

async function splash(relativePath) {
  const { width, height } = await sharp(join(root, relativePath)).metadata();
  const size = Math.round(Math.min(width, height) * 0.22);
  const artwork = await sharp(master).resize(size).png().toBuffer();
  const buffer = await sharp({ create: { width, height, channels: 3, background } })
    .composite([{ input: artwork, gravity: 'centre' }]).png().toBuffer();
  await save(relativePath, buffer);
}

await icon('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024);
await icon('src/assets/regen28logo.png', 512);
await icon('src/assets/icon/favicon.png', 64);
await icon('landing-page/regen28-icon.png', 512);
await icon('landing-page/apple-touch-icon.png', 180);
await icon('store-assets/app-store-icon-1024.png', 1024);
await icon('store-assets/play-store-icon-512.png', 512);
await icon('android/app/src/main/res/playstore/icon-512.png', 512);

for (const [density, size, adaptiveSize] of [
  ['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216],
  ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432],
]) {
  await icon(`android/app/src/main/res/mipmap-${density}/ic_launcher.png`, size);
  await icon(`android/app/src/main/res/mipmap-${density}/ic_launcher_round.png`, size);
  // Keep the symbol inside Android adaptive-icon's central safe region.
  await icon(`android/app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`, adaptiveSize, Math.round(adaptiveSize * 0.18));
  await icon(`android/app/src/main/res/drawable-${density}/ic_splash_icon.png`, adaptiveSize, Math.round(adaptiveSize * 0.18));
}

for (const file of await readdir(join(root, 'ios/App/App/Assets.xcassets/Splash.imageset'))) {
  if (file.endsWith('.png')) await splash(`ios/App/App/Assets.xcassets/Splash.imageset/${file}`);
}
const androidRes = 'android/app/src/main/res';
for (const directory of await readdir(join(root, androidRes))) {
  if (!directory.startsWith('drawable')) continue;
  const relativePath = `${androidRes}/${directory}/splash.png`;
  try { await access(join(root, relativePath)); } catch { continue; }
  await splash(relativePath);
}
console.log(`Generated ${generated} brand assets. Existing files preserved under ${backupRoot}.`);
