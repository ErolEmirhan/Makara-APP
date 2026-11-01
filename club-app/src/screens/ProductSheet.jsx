import Sheet from '../components/Sheet';
import ProductImage from '../components/ProductImage';
import Icon from '../components/Icon';
import { useCatalog } from '../data/catalog';
import { formatPoints, formatTL } from '../lib/format';

const splitList = (s = '') =>
  s
    .split(/,(?![^()]*\))/)
    .map((x) => x.trim())
    .filter(Boolean);

export default function ProductSheet({ product, open, onClose, onOpenReward }) {
  const { rewardFor, categoryName } = useCatalog();
  const reward = rewardFor(product);
  return (
    <Sheet open={open} onClose={onClose} title="" tall>
      {product && (
        <>
          <div className="detail-photo">
            <ProductImage product={product} size={230} eager />
          </div>
          <p className="eyebrow" style={{ marginTop: 18 }}>{categoryName(product.categoryId)}</p>
          <h2 className="detail-title" style={{ marginTop: 4 }}>{product.name}</h2>
          <div className="detail-meta">
            <span className="price num">{formatTL(product.price)}</span>
            {product.calories && <span>· {product.calories}</span>}
            {product.note && <span className="badge is-gray">{product.note}</span>}
          </div>

          {product.summary && <p className="info-block" style={{ fontSize: 15 }}>{product.summary}</p>}

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
            <div className="reward-callout">
              <Icon name="gift" size={22} stroke={2} style={{ color: 'var(--brand)' }} />
              <p>Bu ürünü {formatPoints(reward.cost)} puanla ücretsiz alabilirsin.</p>
              <button className="btn btn-primary btn-sm" onClick={() => onOpenReward(reward)}>
                Ödüle git
              </button>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
