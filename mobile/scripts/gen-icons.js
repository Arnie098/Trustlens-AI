// One-off: regenerate mobile app icons/splash from the web brand logo.
// Pure-JS (jimp), no native deps. Run from mobile/:  node scripts/gen-icons.js
const fs = require("node:fs");
const path = require("node:path");
const Jimp = require("jimp");

const ROOT = __dirname;
const SRC = path.resolve(ROOT, "../../src/assets/logo-transparent.png");
const OUT = path.resolve(ROOT, "../assets/images");
const NAVY = 0x0c2340ff; // opaque navy
const TRANSPARENT = 0x00000000;

// name, size, background, logo scale (fraction of canvas the logo occupies)
const targets = [
  { name: "icon.png", size: 1024, bg: NAVY, scale: 0.68 }, // opaque — iOS forbids alpha
  { name: "splash-icon.png", size: 1024, bg: TRANSPARENT, scale: 0.5 }, // Expo paints navy behind
  { name: "android-icon-foreground.png", size: 512, bg: TRANSPARENT, scale: 0.62 }, // adaptive safe-zone
  { name: "favicon.png", size: 48, bg: TRANSPARENT, scale: 0.92 },
];

(async () => {
  const logo = await Jimp.read(SRC);
  for (const t of targets) {
    const canvas = new Jimp(t.size, t.size, t.bg);
    const inner = Math.round(t.size * t.scale);
    const resized = logo.clone().contain(inner, inner);
    const x = Math.round((t.size - resized.bitmap.width) / 2);
    const y = Math.round((t.size - resized.bitmap.height) / 2);
    canvas.composite(resized, x, y);
    const buf = await canvas.getBufferAsync(Jimp.MIME_PNG);
    fs.writeFileSync(path.join(OUT, t.name), buf);
    console.log(`${t.name}: ${t.size}x${t.size} bg=${t.bg === NAVY ? "navy" : "transparent"} (${(buf.length / 1024).toFixed(0)}KB)`);
  }

  // Android adaptive background layer — solid navy (overrides backgroundColor).
  const bg = new Jimp(512, 512, NAVY);
  fs.writeFileSync(path.join(OUT, "android-icon-background.png"), await bg.getBufferAsync(Jimp.MIME_PNG));
  console.log("android-icon-background.png: 512x512 solid navy");

  // Monochrome layer (themed icons) — white logo silhouette on transparent.
  const mono = new Jimp(512, 512, TRANSPARENT);
  const monoLogo = logo.clone().contain(Math.round(512 * 0.62), Math.round(512 * 0.62));
  // Force every visible pixel to white, keep alpha.
  monoLogo.scan(0, 0, monoLogo.bitmap.width, monoLogo.bitmap.height, function (px, py, idx) {
    if (this.bitmap.data[idx + 3] > 0) {
      this.bitmap.data[idx] = 255;
      this.bitmap.data[idx + 1] = 255;
      this.bitmap.data[idx + 2] = 255;
    }
  });
  const mx = Math.round((512 - monoLogo.bitmap.width) / 2);
  const my = Math.round((512 - monoLogo.bitmap.height) / 2);
  mono.composite(monoLogo, mx, my);
  fs.writeFileSync(path.join(OUT, "android-icon-monochrome.png"), await mono.getBufferAsync(Jimp.MIME_PNG));
  console.log("android-icon-monochrome.png: 512x512 white silhouette");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
