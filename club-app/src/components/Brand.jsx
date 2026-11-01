const base = import.meta.env.BASE_URL;

/** Başlıklarda kullanılan yarı saydam dev logo (Starbucks'taki siren filigranının karşılığı). */
export function Watermark() {
  return <img className="watermark" src={`${base}wordmark-white.png`} alt="" aria-hidden="true" />;
}

export function Wordmark({ white = false, className = '', style }) {
  return <img className={className} style={style} src={`${base}wordmark-${white ? 'white' : 'pink'}.png`} alt="MAKARA" />;
}
