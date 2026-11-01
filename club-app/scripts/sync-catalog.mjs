#!/usr/bin/env node
/**
 * Menüyü POS veritabanından (Firestore) çekip uygulamaya gömer:
 *   public/catalog/catalog.json  ve  public/catalog/img/<ürün-id>.webp
 *
 * Müşteri telefonları Firestore'a hiç bağlanmaz (kota tüketmez); menü veya
 * fotoğraflar değişince bu betiği çalıştırıp uygulamayı yeniden yayınlayın.
 *
 *   npm run sync:catalog                     # önce Havzan, olmazsa Suriçi
 *   npm run sync:catalog -- --project makarasurici
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCES = {
  'makara-16344': { label: 'Makara Havzan', apiKey: 'AIzaSyCdf-c13e0wCafRYHXhIls1epJgD1RjPUA' },
  makarasurici: { label: 'Makara Suriçi', apiKey: 'AIzaSyDnVpG-Hl7n2a1esMO4rZhq9JfqpKd3VUo' },
};
// Müşteri menüsünde gösterilmeyen kategoriler (ekstralar, POS'a özel kalemler)
const HIDDEN_CATEGORIES = ['yan ürünler', 'yan urunler', 'ekstra çikolata'];
const IMAGE_SIZE = 480;

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'public', 'catalog');
const imgDir = path.join(outDir, 'img');

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : null;
};

function value(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, value(x)]));
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(value);
  return null;
}

async function fetchCollection(project, apiKey, collection) {
  const rows = [];
  let pageToken = '';
  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${collection}`);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url);
    const body = await res.json();
    if (!res.ok) throw new Error(`${project}/${collection}: ${res.status} ${body?.error?.message || ''}`.trim());
    for (const doc of body.documents || []) {
      const fields = Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, value(v)]));
      rows.push({ _id: doc.name.split('/').pop(), ...fields });
    }
    pageToken = body.nextPageToken || '';
  } while (pageToken);
  return rows;
}

const clean = (s = '') => String(s).replace(/\s+/g, ' ').trim();

/** "Çilekli Makara(Çilek-Muz İçerir)" → { name: "Çilekli Makara", note: "Çilek-Muz İçerir" } */
function splitName(raw) {
  const name = clean(raw);
  const m = name.match(/^(.*?)\s*\(\s*([^()]*?)\s*\)$/);
  const base = m && m[1] ? m[1] : name;
  const pretty = base.charAt(0).toLocaleUpperCase('tr-TR') + base.slice(1);
  return { name: pretty, note: m && m[1] ? m[2] : '' };
}

/** POS'taki açıklama metni: "Ad\n\nİçindekiler: …\nAlerjenler: …\nUyarı: …\n\nMenü kategorisi: …" */
function parseDetails(text = '', name = '') {
  const out = { summary: '', ingredients: '', allergens: '', warning: '' };
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const free = [];
  for (const line of lines) {
    const [, key, rest] = line.match(/^([^:]{3,20}):\s*(.*)$/) || [];
    const k = (key || '').toLocaleLowerCase('tr-TR');
    if (k === 'içindekiler') out.ingredients = rest;
    else if (k === 'alerjenler') out.allergens = rest;
    else if (k === 'uyarı') out.warning = rest;
    else if (k === 'menü kategorisi') continue;
    else if (clean(line) !== clean(name)) free.push(line);
  }
  out.summary = free.join(' ');
  return out;
}

function imageCandidates(p) {
  return [p.image_base64, p.imageBase64, p.image, p.image_url, p.imageUrl].filter((v) => typeof v === 'string' && v.trim());
}

async function loadImageBytes(src) {
  const s = src.trim();
  if (s.startsWith('data:image')) return Buffer.from(s.split(',')[1] || '', 'base64');
  if (/^https?:\/\//.test(s)) {
    const res = await fetch(s, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  if (s.length > 200) return Buffer.from(s, 'base64');
  throw new Error('desteklenmeyen görsel');
}

let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.warn('! sharp yok: görseller küçültülmeden kopyalanacak');
}

async function saveImage(id, bytes) {
  if (sharp) {
    const file = `${id}.webp`;
    await sharp(bytes).resize(IMAGE_SIZE, IMAGE_SIZE, { fit: 'cover' }).webp({ quality: 82 }).toFile(path.join(imgDir, file));
    return `catalog/img/${file}`;
  }
  const file = `${id}.img`;
  await fs.writeFile(path.join(imgDir, file), bytes);
  return `catalog/img/${file}`;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    }),
  );
  return results;
}

async function main() {
  const order = arg('project') ? [arg('project')] : Object.keys(SOURCES);
  let source = null;
  let rawCategories;
  let rawProducts;
  for (const project of order) {
    const cfg = SOURCES[project];
    if (!cfg) throw new Error(`Bilinmeyen proje: ${project}`);
    try {
      console.log(`→ ${cfg.label} (${project}) okunuyor…`);
      rawCategories = await fetchCollection(project, cfg.apiKey, 'categories');
      rawProducts = await fetchCollection(project, cfg.apiKey, 'products');
      source = { project, label: cfg.label };
      break;
    } catch (err) {
      console.warn(`  ! ${err.message}`);
    }
  }
  if (!source) throw new Error('Hiçbir kaynaktan menü okunamadı.');

  const categories = rawCategories
    .map((c) => ({ id: Number(c.id ?? c._id), name: clean(c.name), order: Number(c.order_index ?? 999) }))
    .filter((c) => c.name && c.id !== 999999 && !HIDDEN_CATEGORIES.includes(c.name.toLocaleLowerCase('tr-TR')))
    .sort((a, b) => a.order - b.order || a.id - b.id);
  const visible = new Set(categories.map((c) => c.id));

  await fs.rm(imgDir, { recursive: true, force: true });
  await fs.mkdir(imgDir, { recursive: true });

  const candidates = rawProducts.filter((p) => visible.has(Number(p.category_id)) && clean(p.name));
  let withImage = 0;
  const failed = [];
  const products = await mapLimit(candidates, 6, async (p) => {
    const id = Number(p.id ?? p._id);
    const { name, note } = splitName(p.name);
    let image = null;
    for (const src of imageCandidates(p)) {
      try {
        image = await saveImage(id, await loadImageBytes(src));
        withImage++;
        break;
      } catch (err) {
        failed.push(`${name}: ${err.message}`);
      }
    }
    return {
      id,
      name,
      note,
      categoryId: Number(p.category_id),
      price: Number(p.price) || 0,
      calories: clean(p.calorie_info || p.calories || p.calorie || ''),
      ...parseDetails(p.description || p.content || p.ingredients, p.name),
      image,
    };
  });
  products.sort((a, b) => a.categoryId - b.categoryId || a.name.localeCompare(b.name, 'tr'));

  const catalog = { source: source.label, project: source.project, syncedAt: new Date().toISOString(), categories, products };
  await fs.writeFile(path.join(outDir, 'catalog.json'), JSON.stringify(catalog));
  console.log(`✓ ${categories.length} kategori, ${products.length} ürün, ${withImage} fotoğraf → public/catalog/`);
  if (failed.length) console.log(`  ${failed.length} görsel indirilemedi (ör. ${failed.slice(0, 3).join(' · ')})`);
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
