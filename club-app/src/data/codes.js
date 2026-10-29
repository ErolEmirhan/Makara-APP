/** Üye kodu ve QR içerikleri. Karışabilen karakterler (0/O, 1/I) kullanılmaz. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomChars(n) {
  const out = [];
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < n; i++) out.push(ALPHABET[bytes[i] % ALPHABET.length]);
  return out.join('');
}

export function newMemberCode() {
  return randomChars(8);
}

export function newNonce() {
  return randomChars(12);
}

export function formatMemberCode(code = '') {
  return code.replace(/(.{4})(?=.)/g, '$1 ');
}

export function normalizeCode(input = '') {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Telefonu son 10 haneye indirger: "+90 (532) 111 22 33" → "5321112233" */
export function normalizePhone(input = '') {
  const digits = String(input).replace(/\D/g, '');
  return digits.slice(-10);
}

export function formatPhone(input = '') {
  const d = normalizePhone(input);
  if (d.length !== 10) return input;
  return `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
}

export const memberQrPayload = (memberCode) => `MAKARA:M:${memberCode}`;

export const rewardQrPayload = ({ memberCode, rewardId, expiresAt, nonce }) =>
  `MAKARA:R:${memberCode}:${rewardId}:${expiresAt}:${nonce}`;

/** Kasada okunan metni çözer. Düz üye kodu da kabul edilir. */
export function parseQr(text = '') {
  const raw = String(text).trim();
  const parts = raw.split(':');
  if (parts[0] === 'MAKARA' && parts[1] === 'M' && parts[2]) {
    return { kind: 'member', memberCode: normalizeCode(parts[2]) };
  }
  if (parts[0] === 'MAKARA' && parts[1] === 'R' && parts.length >= 6) {
    return {
      kind: 'reward',
      memberCode: normalizeCode(parts[2]),
      rewardId: parts[3],
      expiresAt: Number(parts[4]),
      nonce: parts[5],
    };
  }
  const code = normalizeCode(raw);
  if (code.length === 8) return { kind: 'member', memberCode: code };
  const phone = normalizePhone(raw);
  if (phone.length === 10) return { kind: 'phone', phone };
  return null;
}
