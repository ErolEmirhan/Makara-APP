/**
 * MAKARA Club — puan kuralları ve içerik.
 * İşletme kurallarını değiştirmek için yalnızca bu dosyayı düzenlemeniz yeterli.
 */

export const PROGRAM = {
  name: 'MAKARA Club',
  currency: 'puan',
  /** Harcanan her 1 TL için kazanılan taban puan */
  pointsPerTL: 1,
  /** Üye olunca hediye edilen puan */
  welcomeBonus: 250,
  /** Ödül kodu kasada kaç dakika geçerli */
  redeemWindowMinutes: 10,
  website: 'https://www.makara.network',
};

/** Seviyeler: kazanılan toplam puana (lifetimePoints) göre. */
export const TIERS = [
  {
    key: 'pembe',
    name: 'Pembe',
    min: 0,
    bonus: 0,
    perks: ['Her 1 ₺ harcamaya 1 puan', 'Üyelikte 250 puan hediye', 'Doğum günü hediyesi'],
  },
  {
    key: 'gul',
    name: 'Gül',
    min: 5000,
    bonus: 0.1,
    perks: ['Tüm alışverişlerde +%10 puan', 'Yeni ürünlerden ilk sen haberdar ol', 'Doğum günü hediyesi'],
  },
  {
    key: 'elmas',
    name: 'Elmas',
    min: 15000,
    bonus: 0.2,
    perks: ['Tüm alışverişlerde +%20 puan', 'Özel kampanyalar', 'Doğum günü hediyesi'],
  },
];

/**
 * Ödüller menüdeki gerçek ürünlere bağlıdır: `match` içindeki ilk eşleşen ürünün
 * adı, fotoğrafı ve içerik bilgisi kullanılır (katalog: public/catalog/catalog.json).
 * `name` yalnızca ürün menüde bulunamazsa gösterilir. Puan bedelleri örnektir.
 */
export const REWARDS = [
  { id: 'turk-kahvesi', name: 'Türk Kahvesi', cost: 1500, match: ['Türk Kahvesi'] },
  { id: 'filtre-kahve', name: 'Filtre Kahve', cost: 1500, match: ['Filtre Kahve'] },
  { id: 'americano', name: 'Americano', cost: 1500, match: ['Americano'] },
  { id: 'latte', name: 'Latte', cost: 2000, match: ['Latte'] },
  { id: 'sicak-cikolata', name: 'Sıcak Çikolata', cost: 2000, match: ['Sıcak Çikolata'] },
  { id: 'milkshake', name: 'Çilekli Milkshake', cost: 2500, match: ['Çilekli Milkshake'] },
  { id: 'kruvasan', name: 'Antep Fıstıklı Kruvasan', cost: 2500, match: ['Antep Fıstıklı Kruvasan'] },
  { id: 'san-sebastian', name: 'San Sebastian', cost: 3500, match: ['San Sebastian'] },
  { id: 'fransiz-pasta', name: 'Antep Fıstığı Fransız Pasta', cost: 3500, match: ['Antep Fıstığı Fransız Pasta'] },
  { id: 'makara', name: 'Çilekli Makara', cost: 4000, match: ['Çilekli Makara', 'Lotuslu Makara'], featured: true },
];

/**
 * Kampanyalar. `multiplier` olanlar kasada puan hesaplanırken otomatik uygulanır.
 * days: 0=Pazar … 6=Cumartesi · hours: [başlangıç, bitiş) 24 saat
 * `match`: kartta fotoğrafı gösterilecek ürün.
 */
export const OFFERS = [
  {
    id: 'makara-carsamba',
    title: 'Makara Çarşambası',
    subtitle: 'Her çarşamba tüm alışverişlerde 2 kat puan.',
    badge: '2x puan',
    multiplier: 2,
    days: [3],
    match: ['Çilekli Makara', 'Antep Fıstıklı Makara'],
  },
  {
    id: 'sabah-kahvesi',
    title: 'Günaydın Saatleri',
    subtitle: 'Hafta içi 08:00 – 11:00 arası 1,5 kat puan.',
    badge: '1,5x puan',
    multiplier: 1.5,
    days: [1, 2, 3, 4, 5],
    hours: [8, 11],
    match: ['Latte', 'Filtre Kahve'],
  },
  {
    id: 'dogum-gunu',
    title: 'Doğum günü hediyesi',
    subtitle: 'Doğum gününde kodunu kasada okut, tatlın bizden.',
    badge: 'Hediye',
    match: ['Antep Fıstığı Fransız Pasta', 'San Sebastian'],
  },
];

export const BRANCHES = [
  {
    id: 'havzan',
    name: 'Makara Havzan',
    area: 'Havzan, Meram',
    maps: 'https://www.google.com/maps/search/?api=1&query=Makara+Havzan+Meram+Konya',
  },
  {
    id: 'surici',
    name: 'Makara Suriçi',
    area: 'Suriçi Çarşısı, Meram',
    maps: 'https://www.google.com/maps/search/?api=1&query=Makara+Suri%C3%A7i+%C3%87ar%C5%9F%C4%B1s%C4%B1+Meram+Konya',
  },
];

export function tierFor(lifetimePoints = 0) {
  let current = TIERS[0];
  for (const t of TIERS) if (lifetimePoints >= t.min) current = t;
  const idx = TIERS.indexOf(current);
  const next = TIERS[idx + 1] || null;
  const progress = next ? (lifetimePoints - current.min) / (next.min - current.min) : 1;
  return { current, next, progress: Math.max(0, Math.min(1, progress)) };
}

export function activeOffers(date = new Date()) {
  const day = date.getDay();
  const hour = date.getHours();
  return OFFERS.filter((o) => {
    if (!o.multiplier) return false;
    if (o.days && !o.days.includes(day)) return false;
    if (o.hours && (hour < o.hours[0] || hour >= o.hours[1])) return false;
    return true;
  });
}

/** Kasada girilen tutar için kazanılacak puan (seviye bonusu + en yüksek kampanya çarpanı). */
export function calculateEarn(amountTL, lifetimePoints = 0, date = new Date()) {
  const amount = Math.max(0, Number(amountTL) || 0);
  const base = Math.floor(amount * PROGRAM.pointsPerTL);
  const { current } = tierFor(lifetimePoints);
  const offers = activeOffers(date);
  const multiplier = offers.reduce((m, o) => Math.max(m, o.multiplier), 1);
  const total = Math.floor(base * multiplier * (1 + current.bonus));
  return { base, multiplier, tierBonus: current.bonus, total, offers };
}

export function rewardById(id) {
  return REWARDS.find((r) => r.id === id) || null;
}
