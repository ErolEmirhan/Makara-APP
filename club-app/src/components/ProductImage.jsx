import { useState } from 'react';
import Icon from './Icon';
import { imageSrc, useCatalog } from '../data/catalog';

/** Fotoğrafı olmayan ürünler için kategoriye uygun sade ikon. */
export function categoryIcon(name = '') {
  const n = name.toLocaleLowerCase('tr-TR');
  if (n.includes('makara')) return 'roll';
  if (n.includes('sıcak') || n.includes('kahve') || n.includes('çay')) return 'cup';
  if (/(soğuk|frozen|milkshake|smoothie|gazoz|soda|limonata)/.test(n)) return 'glass';
  return 'cake';
}

/** Ürün fotoğrafı (POS'taki yuvarlak kırpılmış çekimler); yoksa sade bir yer tutucu. */
export default function ProductImage({ product, size = 72, className = '', eager = false }) {
  const { categoryName } = useCatalog();
  const [failed, setFailed] = useState(false);
  const src = imageSrc(product);
  return (
    <span className={`pimg ${className}`} style={{ width: size, height: size }}>
      {src && !failed ? (
        <img src={src} alt={product?.name || ''} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />
      ) : (
        <span className="pimg-empty" aria-hidden="true">
          <Icon name={categoryIcon(categoryName(product?.categoryId) || product?.name)} size={Math.round(size * 0.42)} stroke={1.6} />
        </span>
      )}
    </span>
  );
}
