import Sheet from '../components/Sheet';
import ProductImage from '../components/ProductImage';
import Icon from '../components/Icon';
import { useAppData } from '../data/AppData';
import { useCatalog } from '../data/catalog';
import { useFavorites } from '../lib/favorites';
import { calculateEarn } from '../config/loyalty';
import { formatPoints, formatTL } from '../lib/format';

const splitList = (s = '') =>
  s
    .split(/,(?![^()]*\))/)
    .map((x) => x.trim())
    .filter(Boolean);

export default function ProductSheet({ product, open, onClose, onOpenReward }) {
  const { member } = useAppData();
  const { rewardFor, categoryName } = useCatalog();
  const [favorites, toggleFavorite] = useFavorites(member?.id);
  const reward = rewardFor(product);
  const isFav = product ? favorites.has(product.id) : false;
  const earn = product ? calculateEarn(product.price, member?.lifetimePoints || 0).total : 0;

  return (
    <Sheet open={open} onClose={onClose} title="" tall>
      {product && (
        <>
          <div className="detail-hero" style={{ marginTop: -4 }}>
            <button className={`fav ${isFav ? 'is-on' : ''}`} onClick={() => toggleFavorite(product.id)} aria-label={isFav ? 'Favorilerden çıkar' : 'Favorilere ekle'} aria-pressed={isFav}>
              <Icon name="heart" size={22} stroke={2} style={isFav ? { fill: 'currentColor' } : undefined} />
            </button>
            <ProductImage product={product} size={230} eager />
          </div>
          <div className="detail-body">
            <p className="eyebrow">{categoryName(product.categoryId)}</p>
            <h2 className="detail-title">{product.name}</h2>
            <div className="detail-meta">
              <span className="price num">{formatTL(product.price)}</span>
              {product.calories && <span>{product.calories}</span>}
              {product.note && <span className="badge is-soft">{product.note}</span>}
            </div>

            <div className="earn-strip">
              <span>Bu üründen kazanacağın puan</span>
              <strong className="num">+{formatPoints(earn)}</strong>
            </div>

            {product.summary && (
              <div className="info-block">
                <p>{product.summary}</p>
              </div>
            )}
            {product.ingredients && (
              <div className="info-block">
                <h3>İçindekiler</h3>
                <p>{product.ingredients}</p>
              </div>
            )}
            {product.allergens && (
              <div className="info-block">
                <h3>Alerjenler</h3>
                <div className="tags">
                  {splitList(product.allergens).map((a) => (
                    <span key={a}>{a}</span>
                  ))}
                </div>
              </div>
            )}
            {product.warning && <p className="warning">{product.warning}</p>}

            {reward && (
              <div className="callout">
                <Icon name="gift" size={24} stroke={2} style={{ color: 'var(--brand)' }} />
                <p>Bu ürünü {formatPoints(reward.cost)} puanla ücretsiz alabilirsin.</p>
                <button className="btn btn-primary btn-sm" onClick={() => onOpenReward(reward)}>
                  Ödüle git
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}
