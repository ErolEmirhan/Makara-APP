import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { OFFERS, REWARDS } from '../config/loyalty';

/**
 * Menü kataloğu: scripts/sync-catalog.mjs ile POS veritabanından üretilen
 * public/catalog/catalog.json. Uygulama Firestore'a bağlanmadan menüyü gösterir.
 */
const CatalogContext = createContext(null);

const key = (s = '') =>
  s
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function imageSrc(product) {
  if (!product?.image) return null;
  return /^(https?:|data:)/.test(product.image) ? product.image : `${import.meta.env.BASE_URL}${product.image}`;
}

function buildCatalog(data) {
  const categories = data?.categories || [];
  const products = data?.products || [];
  const byId = new Map(products.map((p) => [p.id, p]));
  const byKey = new Map();
  for (const p of products) {
    const k = key(p.name);
    // Aynı adlı birden fazla ürün varsa fotoğraflı olanı tercih et
    if (!byKey.has(k) || (!byKey.get(k).image && p.image)) byKey.set(k, p);
  }
  const find = (names = []) => {
    for (const n of names) {
      const hit = byKey.get(key(n));
      if (hit) return hit;
    }
    for (const n of names) {
      const k = key(n);
      const hit = products.find((p) => key(p.name).startsWith(k));
      if (hit) return hit;
    }
    return null;
  };
  const rewards = REWARDS.map((r) => {
    const product = find(r.match);
    return { ...r, product, name: product?.name || r.name };
  });
  const rewardByProduct = new Map(rewards.filter((r) => r.product).map((r) => [r.product.id, r]));
  const offers = OFFERS.map((o) => ({ ...o, product: find(o.match) }));
  const sections = categories
    .map((c) => ({ ...c, products: products.filter((p) => p.categoryId === c.id) }))
    .filter((c) => c.products.length);
  const withImages = products.filter((p) => p.image);
  const hero = find(['Çilekli Makara', 'Antep Fıstıklı Makara', 'Lotuslu Makara']) ?? null;
  return {
    ready: Boolean(data),
    source: data?.source || '',
    syncedAt: data?.syncedAt || null,
    categories: sections,
    products,
    rewards,
    offers,
    heroProduct: hero?.image ? hero : withImages[0] || hero,
    productById: (id) => byId.get(id) || null,
    rewardFor: (product) => (product ? rewardByProduct.get(product.id) || null : null),
    rewardById: (id) => rewards.find((r) => r.id === id) || null,
    categoryName: (id) => categories.find((c) => c.id === id)?.name || '',
    search: (q) => {
      const k = key(q);
      return k ? products.filter((p) => key(`${p.name} ${p.note}`).includes(k)) : [];
    },
  };
}

export function CatalogProvider({ children }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}catalog/catalog.json`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((json) => alive && setData(json || { categories: [], products: [] }));
    return () => {
      alive = false;
    };
  }, []);
  const value = useMemo(() => buildCatalog(data), [data]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog, CatalogProvider içinde kullanılmalı');
  return ctx;
}
