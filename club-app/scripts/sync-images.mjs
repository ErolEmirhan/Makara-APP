#!/usr/bin/env node
/**
 * Ürün fotoğraflarını Firestore'a HİÇ okuma yapmadan, doğrudan Cloudflare R2'den alır.
 * Kasa yazılımı fotoğrafları "images/products/<ürün-id>_<zaman>.jpg" adıyla yüklediği için
 * eşleştirme dosya adından yapılır; her ürünün en yeni fotoğrafı seçilir.
 *
 *   npm run sync:images
 *
 * Gerekli ortam değişkenleri (club-app/.env.local içine de yazılabilir):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET (varsayılan: makara)
 * Yalnızca okuma (liste + indirme) yapar; R2'ye hiçbir şey yazmaz.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'public', 'catalog');
const imgDir = path.join(outDir, 'img');
const IMAGE_SIZE = 480;

async function loadEnvFile() {
  try {
    const text = await fs.readFile(path.join(root, '.env.local'), 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* .env.local yoksa ortam değişkenleri kullanılır */
  }
}

async function main() {
  await loadEnvFile();
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  const bucket = process.env.R2_BUCKET || 'makara';
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error('R2_ACCOUNT_ID, R2_ACCESS_KEY_ID ve R2_SECRET_ACCESS_KEY tanımlı olmalı (.env.local).');
  }
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });

  const catalogPath = path.join(outDir, 'catalog.json');
  const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
  const byId = new Map(catalog.products.map((p) => [p.id, p]));

  // Ürün başına en yeni fotoğrafı bul
  const latest = new Map();
  let token;
  let total = 0;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: 'images/products/', ContinuationToken: token }));
    for (const obj of page.Contents || []) {
      total++;
      const m = obj.Key.match(/images\/products\/(\d+)_(\d+)\.(jpe?g|png|webp)$/i);
      if (!m) continue;
      const id = Number(m[1]);
      const ts = Number(m[2]);
      if (!latest.has(id) || latest.get(id).ts < ts) latest.set(id, { key: obj.Key, ts });
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  console.log(`→ R2'de ${total} dosya, ${latest.size} ürüne ait fotoğraf bulundu`);

  let sharp = null;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.warn('! sharp yok: görseller küçültülmeden kopyalanacak');
  }
  await fs.mkdir(imgDir, { recursive: true });

  let saved = 0;
  const unmatched = [];
  const jobs = [...latest.entries()];
  let next = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (next < jobs.length) {
        const [id, { key }] = jobs[next++];
        const product = byId.get(id);
        if (!product) {
          unmatched.push(id);
          continue;
        }
        try {
          const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
          const bytes = Buffer.from(await res.Body.transformToByteArray());
          let file = `${id}.webp`;
          if (sharp) {
            await sharp(bytes).resize(IMAGE_SIZE, IMAGE_SIZE, { fit: 'cover' }).webp({ quality: 82 }).toFile(path.join(imgDir, file));
          } else {
            file = `${id}${path.extname(key)}`;
            await fs.writeFile(path.join(imgDir, file), bytes);
          }
          product.image = `catalog/img/${file}`;
          saved++;
        } catch (err) {
          console.warn(`  ! ${product.name}: ${err.message}`);
        }
      }
    }),
  );

  catalog.imagesSyncedAt = new Date().toISOString();
  await fs.writeFile(catalogPath, JSON.stringify(catalog));
  const withImage = catalog.products.filter((p) => p.image).length;
  console.log(`✓ ${saved} fotoğraf güncellendi · menüde fotoğraflı ürün: ${withImage}/${catalog.products.length}`);
  if (unmatched.length) console.log(`  Menüde karşılığı olmayan ürün id'leri: ${unmatched.sort((a, b) => a - b).join(', ')}`);
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
