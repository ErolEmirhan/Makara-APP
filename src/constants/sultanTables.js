/** Sultan Somatı şubesi masa yerleşimi — Makara masa ID'leriyle karışmaz (sultan-… öneki). */

export const SULTAN_TABLE_SECTIONS = [
  { key: 'disari', label: 'Dışarı', count: 4 },
  { key: 'kis-bahcesi', label: 'Kış Bahçesi', count: 14 },
  { key: 'osmanli-odasi', label: 'Osmanlı Odası', count: 8 },
  { key: 'selcuklu-odasi', label: 'Selçuklu Odası', count: 10 },
  { key: 'mevlevi-odasi', label: 'Mevlevi Odası', count: 1 },
  { key: 'ask-odasi', label: 'Aşk Odası', count: 1 },
  { key: 'yapma-odasi', label: 'Yapma Odası', count: 1 },
];

export function buildSultanTablesFlat() {
  const list = [];
  for (const sec of SULTAN_TABLE_SECTIONS) {
    for (let n = 1; n <= sec.count; n++) {
      const id = `sultan-${sec.key}-${n}`;
      const name = sec.count === 1 ? sec.label : `${sec.label} · Masa ${n}`;
      list.push({
        id,
        number: n,
        type: sec.key,
        name,
        sectionKey: sec.key,
        sectionLabel: sec.label,
      });
    }
  }
  return list;
}

export function parseSultanTableId(tableId) {
  if (!tableId || typeof tableId !== 'string' || !tableId.startsWith('sultan-')) return null;
  for (const sec of SULTAN_TABLE_SECTIONS) {
    const prefix = `sultan-${sec.key}-`;
    if (!tableId.startsWith(prefix)) continue;
    const numStr = tableId.slice(prefix.length);
    const n = parseInt(numStr, 10);
    if (String(n) !== numStr) continue;
    if (n < 1 || n > sec.count) continue;
    const name = sec.count === 1 ? sec.label : `${sec.label} · Masa ${n}`;
    return {
      id: tableId,
      sectionKey: sec.key,
      number: n,
      name,
      type: sec.key,
    };
  }
  return null;
}
