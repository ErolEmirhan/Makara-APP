import Sheet from '../components/Sheet';
import Icon from '../components/Icon';
import { BRANCHES } from '../config/loyalty';

const base = import.meta.env.BASE_URL;
// Şube fotoğrafı varsa public/ altına ekleyip buraya yazın
const PHOTOS = { surici: `${base}branch-surici.jpg` };

/** Starbucks mağaza listesi düzeni. */
export default function BranchesSheet({ open, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title="Şubelerimiz" tall>
      {BRANCHES.map((b) => (
        <article key={b.id} className="branch">
          <div className={`branch-photo ${PHOTOS[b.id] ? '' : 'is-empty'}`}>
            <img src={PHOTOS[b.id] || `${base}wordmark-white.png`} alt={b.name} />
          </div>
          <div className="branch-row">
            <div>
              <h3>{b.name}</h3>
              <p className="muted">{b.area}</p>
            </div>
            <a className="go" href={b.maps} target="_blank" rel="noreferrer" aria-label={`${b.name} yol tarifi`}>
              <Icon name="directions" size={30} stroke={1.7} />
            </a>
          </div>
        </article>
      ))}
    </Sheet>
  );
}
