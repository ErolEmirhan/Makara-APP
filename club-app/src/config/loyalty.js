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

/** Seviyeler: son kazanılan toplam puana (lifetimePoints) göre. */
export const TIERS = [
  {
    key: 'pembe',
    name: 'Pembe',
    min: 0,
    bonus: 0,
    tint: ['#FFD3E6', '#FF8CC0'],
    perks: ['Her 1 ₺ = 1 puan', 'Hoş geldin hediyesi', 'Doğum günü sürprizi'],
  },
  {
    key: 'gul',
    name: 'Gül',
    min: 5000,
    bonus: 0.1,
    tint: ['#FF9CC8', '#E8338A'],
    perks: ['Tüm alışverişlerde +%10 puan', 'Yeni lezzetlere erken erişim', 'Doğum günü makarası'],
  },
  {
    key: 'elmas',
    name: 'Elmas',
    min: 15000,
    bonus: 0.2,
    tint: ['#F5E6FF', '#B44CF0'],
    perks: ['Tüm alışverişlerde +%20 puan', 'Ayda bir ücretsiz kahve', 'Özel etkinlik davetleri'],
  },
];

/**
 * Ödül kataloğu. `model` alanı 3D sahnedeki tatlıyı belirler:
 * roll · cup · macaron · croissant · prag · gift
 */
export const REWARDS = [
  {
    id: 'turk-kahvesi',
    name: 'Türk Kahvesi',
    cost: 900,
    category: 'İçecek',
    model: 'cup',
    variant: 'turkish',
    blurb: 'Geleneksel tadıyla, bol köpüklü.',
  },
  {
    id: 'latte',
    name: 'Latte',
    cost: 1500,
    category: 'İçecek',
    model: 'cup',
    variant: 'latte',
    blurb: 'Espresso ve kadife gibi süt köpüğü.',
  },
  {
    id: 'macaron',
    name: 'Macaron',
    cost: 1200,
    category: 'Tatlı',
    model: 'macaron',
    blurb: 'Paris usulü, çıtır kabuk ve yumuşacık ganaj.',
  },
  {
    id: 'sade-kruvasan',
    name: 'Tereyağlı Kruvasan',
    cost: 1600,
    category: 'Fırın',
    model: 'croissant',
    blurb: 'Kat kat, çıtır ve tereyağlı.',
  },
  {
    id: 'klasik-prag',
    name: 'Klasik Prag',
    cost: 2400,
    category: 'Tatlı',
    model: 'prag',
    blurb: 'Çikolatalı, yumuşacık ve parlak ganajlı.',
  },
  {
    id: 'lotuslu-makara',
    name: 'Lotuslu Makara',
    cost: 3000,
    category: 'İmza',
    model: 'roll',
    featured: true,
    blurb: 'İmza lezzetimiz: tarçınlı makara, lotus kreması.',
  },
  {
    id: 'surpriz-kutu',
    name: 'Sürpriz Kutu',
    cost: 6000,
    category: 'Özel',
    model: 'gift',
    blurb: 'Şefin seçtiği tatlılar, pembe kutusunda.',
  },
];

/**
 * Kampanyalar. `multiplier` olanlar kasada puan hesaplarken otomatik uygulanır.
 * days: 0=Pazar … 6=Cumartesi · hours: [başlangıç, bitiş) 24 saat
 */
export const OFFERS = [
  {
    id: 'makara-carsamba',
    title: 'Makara Çarşambası',
    subtitle: 'Her çarşamba tüm alışverişlerde 2 kat puan.',
    badge: '2x PUAN',
    multiplier: 2,
    days: [3],
    model: 'roll',
    tone: 'rose',
  },
  {
    id: 'sabah-kahvesi',
    title: 'Günaydın Saatleri',
    subtitle: 'Hafta içi 08:00 – 11:00 arası 1.5 kat puan.',
    badge: '1.5x PUAN',
    multiplier: 1.5,
    days: [1, 2, 3, 4, 5],
    hours: [8, 11],
    model: 'cup',
    tone: 'cream',
  },
  {
    id: 'dogum-gunu',
    title: 'Doğum Günün Kutlu Olsun',
    subtitle: 'Doğum gününde kasada kartını göster, makaran bizden.',
    badge: 'HEDİYE',
    model: 'gift',
    tone: 'lilac',
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
