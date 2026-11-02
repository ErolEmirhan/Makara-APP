// CI: yayınlanacak sürümü belirler ve yalnızca çalışma kopyasındaki package.json'a yazar (commit atılmaz).
// Son release'in patch'ini bir artırır; package.json elle daha yüksek bir sürüme çekildiyse onu kullanır.
const fs = require('fs');
const path = require('path');

function parse(v) {
  return String(v || '0.0.0').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0).concat([0, 0, 0]).slice(0, 3);
}

function compare(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

async function latestReleaseVersion() {
  const repo = process.env.GITHUB_REPOSITORY;
  const headers = { Accept: 'application/vnd.github+json' };
  if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers });
  if (res.status === 404) return '0.0.0';
  if (!res.ok) throw new Error(`Son release okunamadı: HTTP ${res.status}`);
  return (await res.json()).tag_name;
}

(async () => {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const fromPkg = parse(pkg.version);
  const latest = parse(await latestReleaseVersion());
  const next = compare(fromPkg, latest) > 0 ? fromPkg : [latest[0], latest[1], latest[2] + 1];
  pkg.version = next.join('.');
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`Yayınlanacak sürüm: ${pkg.version} (son release ${latest.join('.')})`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
