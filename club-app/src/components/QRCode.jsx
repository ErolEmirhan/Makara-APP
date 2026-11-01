import { useMemo } from 'react';
import QR from 'qrcode';

/**
 * Yuvarlatılmış modüllü, ortasında MAKARA rozeti olan özel QR.
 * Hata düzeltme seviyesi H (%30) — ortadaki rozet okunabilirliği bozmaz.
 * Köşe (bulucu) kareleri tam koyu tutulur; açık tonlu pembe okuyucuları şaşırtır.
 */
export default function QRCode({ value, size = 220, color = '#121214', accent = '#D6156F', badge = true }) {
  const qr = useMemo(() => {
    try {
      return QR.create(value, { errorCorrectionLevel: 'H' });
    } catch {
      return null;
    }
  }, [value]);
  if (!qr) return null;

  const n = qr.modules.size;
  const quiet = 2;
  const total = n + quiet * 2;
  const inFinder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  // Hizalama desenleri (rezerve modüller; zamanlama ve format alanları hariç) düz kare çizilir.
  const reserved = qr.modules.reservedBit;
  const nearFinder = (r, c) => (r < 9 && c < 9) || (r < 9 && c >= n - 8) || (r >= n - 8 && c < 9);
  const isAlignment = (r, c) => reserved?.[r * n + c] && r !== 6 && c !== 6 && !nearFinder(r, c);
  // Not: nokta boyutu (0.92) ve rozet oranı (0.18) jsQR ile bulanık görüntüde test edildi; küçültmeyin.
  const badgeSize = Math.round(n * 0.18) | 1;
  const b0 = Math.floor((n - badgeSize) / 2);
  const inBadge = (r, c) => badge && r >= b0 - 1 && r <= b0 + badgeSize && c >= b0 - 1 && c <= b0 + badgeSize;

  const dots = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.modules.get(r, c) || inFinder(r, c) || inBadge(r, c)) continue;
      if (isAlignment(r, c)) {
        dots.push(<rect key={`${r}-${c}`} x={c + quiet} y={r + quiet} width={1.02} height={1.02} />);
        continue;
      }
      dots.push(<rect key={`${r}-${c}`} x={c + quiet + 0.04} y={r + quiet + 0.04} width={0.92} height={0.92} rx={0.25} />);
    }
  }
  const finder = (r, c) => (
    <g key={`f${r}${c}`}>
      <rect x={c + quiet + 0.5} y={r + quiet + 0.5} width={6} height={6} rx={1.9} fill="none" stroke={color} strokeWidth={1} />
      <rect x={c + quiet + 2} y={r + quiet + 2} width={3} height={3} rx={0.95} fill={color} />
    </g>
  );
  const bc = n / 2 + quiet;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${total} ${total}`} role="img" aria-label="Üyelik QR kodu" shapeRendering="geometricPrecision">
      <rect width={total} height={total} fill="#fff" rx={2} />
      <g fill={color}>{dots}</g>
      {finder(0, 0)}
      {finder(0, n - 7)}
      {finder(n - 7, 0)}
      {badge && (
        <g>
          <rect x={bc - badgeSize / 2} y={bc - badgeSize / 2} width={badgeSize} height={badgeSize} rx={badgeSize * 0.32} fill={accent} />
          <text
            x={bc}
            y={bc + badgeSize * 0.24}
            textAnchor="middle"
            fontSize={badgeSize * 0.66}
            fontWeight="800"
            fill="#fff"
            fontFamily="ui-rounded, 'SF Pro Rounded', 'Nunito', system-ui, sans-serif"
          >
            M
          </text>
        </g>
      )}
    </svg>
  );
}
