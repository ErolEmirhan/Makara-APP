import { useMemo, useState } from 'react';
import Icon from '../components/Icon';
import ProductImage from '../components/ProductImage';
import { Watermark } from '../components/Brand';
import { useAppData } from '../data/AppData';
import { useCatalog } from '../data/catalog';
import { useFavorites } from '../lib/favorites';
import { calculateEarn } from '../config/loyalty';
import { formatPoints, formatTL } from '../lib/format';

export function ProductCard({ product, onOpen, lifetimePoints }) {
  const earn = calculateEarn(product.price, lifetimePoints).total;
  return (
    <button className="product-card" onClick={() => onOpen(product)}>
      {earn > 0 && <span className="earn num">+{formatPoints(earn)}</span>}
      <ProductImage product={product} size={108} />
      <strong>{product.name}</strong>
      <span className="price num">{formatTL(product.price)}</span>
    </button>
  );
}

/** Starbucks menü düzeni: fotoğraflı kategori ızgarası → kategori sayfası → ürün detayı. */
export default function Menu({ onOpenProduct }) {
  const { member } = useAppData();
  const { categories, products, search, source } = useCatalog();
  const [favorites] = useFavorites(member.id);
  const [tab, setTab] = useState('menu');
  const [categoryId, setCategoryId] = useState(null);
  const [query, setQuery] = useState('');
  const results = useMemo(() => (query.trim() ? search(query) : null), [query, search]);
  const category = categories.find((c) => c.id === categoryId);
  const favProducts = products.filter((p) => favorites.has(p.id));

  if (category) {
    return (
      <div className="page">
        <div className="subpage-header">
          <button className="icon-btn" onClick={() => setCategoryId(null)} aria-label="Geri">
            <Icon name="chevronLeft" size={20} stroke={2.2} />
          </button>
          <h1>{category.name}</h1>
          <span className="spacer" />
        </div>
        <div className="pad" style={{ paddingTop: 16 }}>
          <div className="product-grid">
            {category.products.map((p) => (
              <ProductCard key={p.id} product={p} onOpen={onOpenProduct} lifetimePoints={member.lifetimePoints} />
            ))}
          </div>
          {source && <p className="price-note">Fiyatlar {source} menüsünden alınmıştır; şubeye göre farklılık gösterebilir.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="brand-header" style={{ paddingBottom: 14 }}>
        <Watermark />
        <div className="header-row">
          <h1>Menü</h1>
        </div>
      </header>
      <nav className="top-tabs">
        <button className={tab === 'menu' ? 'is-active' : ''} onClick={() => setTab('menu')}>
          Menü
        </button>
        <button className={tab === 'fav' ? 'is-active' : ''} onClick={() => setTab('fav')}>
          Favorilerim
        </button>
      </nav>

      <div className="pad" style={{ paddingTop: 18 }}>
        {tab === 'menu' ? (
          <>
            <label className="search" style={{ marginBottom: 18 }}>
              <Icon name="search" size={19} stroke={2} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ürün ara" aria-label="Ürün ara" enterKeyHint="search" />
              {query && (
                <button onClick={() => setQuery('')} aria-label="Aramayı temizle">
                  <Icon name="close" size={16} stroke={2.2} />
                </button>
              )}
            </label>
            {results ? (
              results.length ? (
                <div className="product-grid">
                  {results.map((p) => (
                    <ProductCard key={p.id} product={p} onOpen={onOpenProduct} lifetimePoints={member.lifetimePoints} />
                  ))}
                </div>
              ) : (
                <p className="empty">“{query}” için ürün bulunamadı.</p>
              )
            ) : (
              <div className="cat-grid">
                {categories.map((c) => {
                  const cover = c.products.find((p) => p.image) || c.products[0];
                  return (
                    <button key={c.id} className="cat-card" onClick={() => setCategoryId(c.id)}>
                      <span className="cover">
                        <span className="count">{c.products.length} ürün</span>
                        <ProductImage product={cover} size={118} />
                      </span>
                      <strong>{c.name}</strong>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : favProducts.length ? (
          <div className="product-grid">
            {favProducts.map((p) => (
              <ProductCard key={p.id} product={p} onOpen={onOpenProduct} lifetimePoints={member.lifetimePoints} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <Icon name="heart" size={34} stroke={1.6} style={{ color: 'var(--brand)', margin: '0 auto 10px', display: 'block' }} />
            Beğendiğin ürünleri kalp simgesiyle kaydet, hepsi burada görünsün.
          </div>
        )}
      </div>
    </div>
  );
}
