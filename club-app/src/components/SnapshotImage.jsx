import { useEffect, useState } from 'react';
import { snapshot } from '../three/snapshots';

/** 3D modelin stüdyo fotoğrafı; listelerde canlı WebGL yerine kullanılır. */
export default function SnapshotImage({ model, variant, size = 400, alt = '', className = '', options }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    snapshot(model, variant, { size, ...options }).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [model, variant, size]);
  return (
    <div className={`snap ${url ? 'is-loaded' : ''} ${className}`}>
      {url ? <img src={url} alt={alt} draggable="false" /> : <span className="snap-placeholder" aria-hidden="true" />}
    </div>
  );
}
