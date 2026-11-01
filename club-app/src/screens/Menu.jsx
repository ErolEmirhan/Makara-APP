import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon';
import ProductImage from '../components/ProductImage';
import { useCatalog } from '../data/catalog';
import { formatTL } from '../lib/format';

function ProductRow({ product, onOpen }) {
  const sub = [product.note, product.calories].filter(Boolean).join(' · ');
  return (
    <button className="product-row" onClick={() => onOpen(product)}>
      <ProductImage product={product} size={64} />
      <span className="product-row-main">
        <strong>{product.name}</strong>
        {sub && <span>{sub}</span>}
      </span>
      <span className="product-row-price num">{formatTL(product.price)}</span>
    </button>
  );
}

export default function Menu({ initialCategory, onOpenProduct }) {
  const { categories, search, source, ready } = useCatalog();
  const [active, setActive] = useState(initialCategory || null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (initialCategory) setActive(initialCategory);
  }, [initialCategory]);

  const current = categories.find((c) => c.id === active) || categories[0];
  const results = useMemo(() => (query.trim() ? search(query) : null), [query, search]);

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <div className="menu-sticky">
        <h1 className="page-title" style={{ marginTop: 4 }}>Menü</h1>
        <label className="search">
          <Icon name="search" size={18} stroke={2} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ürün ara" aria-label="Ürün ara" enterKeyHint="search" />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Aramayı temizle">
              <Icon name="close" size={16} stroke={2.2} />
            </button>
          )}
        </label>
        {!results && (
          <div className="chips" role="tablist">
            {categories.map((c) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={current?.id === c.id}
                className={`chip ${current?.id === c.id ? 'is-active' : ''}`}
                onClick={() => {
                  setActive(c.id);
                  window.scrollTo({ top: 0 });
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {results ? (
        <>
          <h2 className="menu-section-title">{results.length ? `${results.length} sonuç` : 'Sonuç bulunamadı'}</h2>
          {results.map((p) => (
            <ProductRow key={p.id} product={p} onOpen={onOpenProduct} />
          ))}
        </>
      ) : current ? (
        <>
          <h2 className="menu-section-title">{current.name}</h2>
          {current.products.map((p) => (
            <ProductRow key={p.id} product={p} onOpen={onOpenProduct} />
          ))}
        </>
      ) : (
        ready && <p className="empty">Menü şu an yüklenemedi.</p>
      )}

      {source && <p className="price-note">Fiyatlar {source} menüsünden alınmıştır; şubeye göre farklılık gösterebilir.</p>}
    </div>
  );
}
