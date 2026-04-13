const fs = require('fs');
const path = require('path');

// Version numarasını artır (patch version: 2.4.9 -> 2.4.10)
function incrementVersion(version) {
  const parts = version.split('.');
  const major = parseInt(parts[0]);
  const minor = parseInt(parts[1]);
  const patch = parseInt(parts[2]) + 1;
  return `${major}.${minor}.${patch}`;
}

// Dosyaları güncelle
function updateVersionFiles(newVersion) {
  console.log(`🔄 Version güncelleniyor: ${newVersion}`);

  // 1. public/index.html - APP_VERSION ve manifest link
  const indexHtmlPath = path.join(__dirname, '../public/index.html');
  let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  
  // APP_VERSION güncelle
  indexHtml = indexHtml.replace(
    /const APP_VERSION = '[\d.]+';/,
    `const APP_VERSION = '${newVersion}';`
  );
  
  // Manifest link güncelle
  indexHtml = indexHtml.replace(
    /<link rel="manifest" href="\/manifest\.json\?v=[\d.]+">/,
    `<link rel="manifest" href="/manifest.json?v=${newVersion}">`
  );
  
  fs.writeFileSync(indexHtmlPath, indexHtml, 'utf8');
  console.log('✅ public/index.html güncellendi');

  // 2. public/manifest.json
  const manifestPath = path.join(__dirname, '../public/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.version = newVersion;
  // start_url'e timestamp ekle (PWA güncellemesi için)
  const timestamp = Date.now();
  manifest.start_url = `/?v=${newVersion}&_t=${timestamp}`;
  manifest.icons = manifest.icons.map(icon => ({
    ...icon,
    src: icon.src.replace(/\?v=[\d.]+/, `?v=${newVersion}&t=${timestamp}`)
  }));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log('✅ public/manifest.json güncellendi');

  // 3. package.json
  const pkgPath = path.join(__dirname, '../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log('✅ package.json güncellendi');

  console.log(`\n✨ Version başarıyla ${newVersion} olarak güncellendi!\n`);
}

// Mevcut sürüm: package.json (Electron / navbar ile aynı çizgi); yoksa index.html APP_VERSION
function getCurrentVersion() {
  const pkgPath = path.join(__dirname, '../package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const v = String(pkg.version || '').trim();
    if (/^\d+\.\d+\.\d+$/.test(v)) return v;
  } catch (_) {}
  const indexHtmlPath = path.join(__dirname, '../public/index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  const match = indexHtml.match(/const APP_VERSION = '([\d.]+)';/);
  return match ? match[1] : '0.0.0';
}

// Ana işlem
const currentVersion = getCurrentVersion();
const newVersion = incrementVersion(currentVersion);
updateVersionFiles(newVersion);
