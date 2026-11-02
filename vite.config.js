import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

// Navbar sürümü her push'ta 0.0.1 artar: commit sayısından türetilir (Vercel'de VERCEL_DEEP_CLONE=true tam geçmiş verir).
// 110. commit v553.0.2; bir push'ta birden fazla commit varsa o kadar artar.
const UI_VERSION_PREFIX = '553.0.';
const UI_VERSION_BASE_COMMITS = 108;

function gitCommitCount() {
  const run = (cmd) => execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  try {
    if (run('git rev-parse --is-shallow-repository') === 'true') {
      try {
        run('git fetch --unshallow --quiet');
      } catch (_) {}
      if (run('git rev-parse --is-shallow-repository') === 'true') return null;
    }
    return Number(run('git rev-list --count HEAD')) || null;
  } catch (_) {
    return null;
  }
}

function uiVersionLabel() {
  const count = gitCommitCount();
  if (count) return `v${UI_VERSION_PREFIX}${count - UI_VERSION_BASE_COMMITS}`;
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  return sha ? `#${sha.slice(0, 7)}` : 'dev';
}

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __KASA_UI_VERSION__: JSON.stringify(uiVersionLabel())
  },
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
