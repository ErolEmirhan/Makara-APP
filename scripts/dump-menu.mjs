import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'node:fs';
const app = initializeApp({ apiKey: 'AIzaSyDnVpG-Hl7n2a1esMO4rZhq9JfqpKd3VUo', authDomain: 'makarasurici.firebaseapp.com', projectId: 'makarasurici', appId: '1:237735301273:web:bf62c8f145434df0292808' });
const db = getFirestore(app);
fs.mkdirSync('menu-dump/img', { recursive: true });
const res = {};
setTimeout(() => { fs.writeFileSync('menu-dump/data.json', JSON.stringify(res, null, 1)); process.exit(0); }, 150000);
for (const c of ['products', 'categories', 'menu', 'product_categories', 'settings']) {
  try { const s = await getDocs(collection(db, c)); res[c] = s.docs.map(d => ({ id: d.id, ...d.data() })); }
  catch (e) { res[c] = 'HATA ' + e.message; }
}
let n = 0;
for (const p of Array.isArray(res.products) ? res.products : []) {
  const img = p.image || p.image_url || p.imageUrl;
  if (!img || typeof img !== 'string') continue;
  try {
    let buf, ext = 'jpg';
    if (img.startsWith('data:')) { const m = img.match(/^data:image\/(\w+);base64,(.*)$/); ext = m[1]; buf = Buffer.from(m[2], 'base64'); }
    else { const r = await fetch(img); if (!r.ok) continue; buf = Buffer.from(await r.arrayBuffer()); const ct = r.headers.get('content-type') || ''; ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg'; }
    fs.writeFileSync(`menu-dump/img/${p.id}.${ext}`, buf); p._img = `${p.id}.${ext}`; n++;
    if (img.startsWith('data:')) p.image = '[base64]';
  } catch {}
}
res._imgCount = n;
fs.writeFileSync('menu-dump/data.json', JSON.stringify(res, null, 1));
console.log('ok', Object.fromEntries(Object.entries(res).map(([k, v]) => [k, Array.isArray(v) ? v.length : v])));
process.exit(0);
