// Render the composition frame by frame. Every frame is renderAt(t) -> screenshot.
//   node render.js stills <outDir> t1 t2 ...   -> PNG stills at the given times
//   node render.js video  <out.mp4>            -> silent H.264 video (frames piped to ffmpeg)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const FPS = 30, DUR = 23.4, W = 1080, H = 1920;
const mode = process.argv[2];
const out = process.argv[3];
const page_url = 'file://' + path.join(__dirname, 'video', 'index.html');

(async () => {
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files', '--force-color-profile=srgb'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') console.log('page error:', m.text()); });
  page.on('pageerror', (e) => console.log('page exception:', e.message));
  await page.goto(page_url, { waitUntil: 'load' });
  const ready = await page.evaluate(() => window.assetsReady());
  console.log('assets:', JSON.stringify(ready));
  if (ready.bad.length) { console.log('missing images, abort'); process.exit(1); }
  const stage = await page.$('#stage');

  if (mode === 'stills') {
    fs.mkdirSync(out, { recursive: true });
    for (const ts of process.argv.slice(4)) {
      const t = Number(ts);
      await page.evaluate((tt) => window.renderAt(tt), t);
      await stage.screenshot({ path: path.join(out, `t${t.toFixed(2).padStart(5, '0')}.png`) });
    }
  } else if (mode === 'video') {
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const N = Math.round(DUR * FPS);
    const t0 = Date.now();
    for (let f = 0; f < N; f++) {
      await page.evaluate((tt) => window.renderAt(tt), f / FPS);
      const buf = await stage.screenshot({ type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if (f % 60 === 0) console.log(`frame ${f}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
    console.log('done', out);
  }
  await browser.close();
})();
