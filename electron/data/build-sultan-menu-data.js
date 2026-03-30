/**
 * Tek seferlik / geliştirici: node electron/data/build-sultan-menu-data.js
 * sultanMenuCatalog.js dosyasını üretir (kategoriler + ürünler).
 */
const fs = require('fs');
const path = require('path');

const BUNDLE_ID = 1;

const categories = [
  { id: 1, name: 'Konya Mutfağı · Çorba', order_index: 0 },
  { id: 2, name: 'Konya Mutfağı · Ana Yemekler', order_index: 1 },
  { id: 3, name: 'Konya Mutfağı · Tadım Menüsü', order_index: 2 },
  { id: 4, name: 'Osmanlı Mutfağı · Çorba', order_index: 3 },
  { id: 5, name: 'Osmanlı Mutfağı · Ara Sıcaklar', order_index: 4 },
  { id: 6, name: 'Osmanlı Mutfağı · Ana Yemekler', order_index: 5 },
  { id: 7, name: 'Selçuklu Mevlevi Mutfağı · Çorba', order_index: 6 },
  { id: 8, name: 'Selçuklu Mevlevi Mutfağı · Ara Sıcaklar', order_index: 7 },
  { id: 9, name: 'Selçuklu Mevlevi Mutfağı · Ana Yemekler', order_index: 8 },
  { id: 10, name: 'Vejetaryen · Çorba', order_index: 9 },
  { id: 11, name: 'Vejetaryen · Ara Sıcaklar', order_index: 10 },
  { id: 12, name: 'Vejetaryen · Ana Yemekler', order_index: 11 },
  { id: 13, name: 'Vegan · Çorba', order_index: 12 },
  { id: 14, name: 'Vegan · Ara Sıcaklar', order_index: 13 },
  { id: 15, name: 'Vegan · Ana Yemekler', order_index: 14 },
  { id: 16, name: 'Kahvaltı', order_index: 15 },
  { id: 17, name: 'Şerbetler', order_index: 16 },
  { id: 18, name: 'Soğuk İçecekler', order_index: 17 },
  { id: 19, name: 'Salatalar', order_index: 18 },
  { id: 20, name: 'Tatlılar', order_index: 19 },
  { id: 21, name: 'Sıcak İçecekler', order_index: 20 },
  { id: 22, name: 'Çocuk Menüsü', order_index: 21 },
];

/** @typedef {{ id: number, category_id: number, name: string, price: number, description?: string|null, image?: null, gluten_free?: boolean, per_person?: boolean }} P */
/** @param {Partial<P> & Pick<P,'category_id'|'name'|'price'>} o */
function P(o) {
  return {
    id: o.id,
    category_id: o.category_id,
    name: o.name,
    price: o.price,
    description: o.description || null,
    image: null,
    gluten_free: !!o.gluten_free,
    per_person: !!o.per_person,
  };
}

let nid = 0;
function nextId() {
  nid += 1;
  return nid;
}

const rows = [];

function add(cid, name, price, desc, flags = {}) {
  rows.push(
    P({
      id: nextId(),
      category_id: cid,
      name,
      price,
      description: desc || null,
      gluten_free: flags.gf,
      per_person: flags.pp,
    })
  );
}

// --- Konya
add(1, 'Bamya Çorbası', 440, 'Un, yağ, kuru soğan, kuru çiçek bamya, dana eti ve baharatlar.');
add(2, 'Kuyu Tandır Kebabı', 740, 'Hiçbir katkı maddesi olmadan 8–10 saat kuyu tandırda kendi yağında pişmiş kemiksiz kuzu eti, bakır kap içinde.');
add(2, 'Güveçte Et Tiridi', 740, 'Güveçte dana kavurma; üzerinde küp ekmek, yoğurt, sumaklı soğan, maydanoz, tereyağı ve baharatlar.');
add(
  3,
  'Dört Mutfak Tadım Menüsü',
  1790,
  'Kişi başı. En az 2 kişilik hazırlanır; kişi sayısı arttıkça çeşit sayısı artar. Dört tarihi mutfak kültüründen seçkiler. 4 çeşit çorba, 3 çeşit ara sıcak veya soğuk, 5 çeşit şerbet, kişi sayısına göre 4–7 çeşit ana yemek, 3 çeşit tatlı, salata, çay ve su.',
  { pp: true }
);

// --- Osmanlı
add(4, 'Çeşmi Nigar Çorbası', 280, 'Mısır unu, mercimek, sarımsak, kuru soğan ve baharatlar.');
add(5, 'Kıymalı Su Böreği', 340, 'El açması yufka, dana kıyma, kuru soğan, tereyağı ve baharatlar.');
add(5, 'Peynirli Su Böreği', 290, 'El açması yufka, peynir, tereyağı ve baharatlar.');
add(5, 'Tahinli Cevizli Humus', 340, 'Nohut, ceviz, tahin, sarımsak, limon suyu, zeytinyağı, tuz ve baharatlar.');
add(5, 'Cevizli Haydari', 340, 'Ceviz, yoğurt, közlenmiş patlıcan, zeytinyağı, sarımsak, dereotu, tuz ve baharatlar.', { gf: true });
add(5, 'Ispanaklı Peynirli Kalem Böreği', 290, 'El açması yufka, sütte haşlanmış ıspanak, kaşar ve tulum peyniri.');
add(5, 'Kırmızı Pancar Yemeği', 390, 'Kırmızı pancar, zeytinyağı, yoğurt ve baharatlar.', { gf: true });
add(5, 'Vişneli Yaprak Sarma', 390, 'Asma yaprağı, vişne, tarçın, pirinç, salça, zeytinyağı ve baharatlar.', { gf: true });
add(6, 'Tavuklu Mahmudiye', 570, 'Tavuk göğsü, bal, badem, kuru kayısı, kuru üzüm, arpacık soğan, maydanoz ve baharatlar.', { gf: true });
add(6, 'Dana Seferceliye', 740, 'Dana biftek, arpacık soğan, bal, badem, ayva kurusu ve baharatlar.', { gf: true });
add(6, 'Kuzu Mutancana', 890, 'Kuzu eti, arpacık soğan, bal, badem, kuru kayısı, kuru incir, kuru üzüm ve baharatlar.', { gf: true });
add(6, 'Sütlü Kahveli Et', 740, 'Çekirdek kahve ile marine edilmiş dana biftek, süt, Türk kahvesi ve baharatlar.');
add(6, 'Saray Usulü Tavuk', 570, 'Fıstıklı, kuş üzümlü tavuk sarma; portakal sos eşliğinde.', { gf: true });

// --- Selçuklu Mevlevi
add(7, 'Tarhana Çorbası', 280, 'Anadolu tarhanası, kırmızı toz biber, tereyağı, tuz, su.');
add(7, 'Tutmaç Çorbası', 340, 'Un, yoğurt, erişte veya nohut, dana eti, sarımsak ve baharatlar.');
add(8, 'Patlıcan Kalyesi', 390, 'Güneşte kurutulmuş patlıcan, kuru soğan, bitkisel yağ ve baharatlar.', { gf: true });
add(8, 'Fasülye Kalyesi', 390, 'Güneşte kurutulmuş fasülye, kuru soğan, bitkisel yağ ve baharatlar.', { gf: true });
add(8, 'Biber Kalyesi', 390, 'Güneşte kurutulmuş biber, kuru soğan, bitkisel yağ ve baharatlar.', { gf: true });
add(8, 'Karışık Kalye Tabağı', 490, 'Güneşte kurutulmuş patlıcan, biber, fasülye, kuru soğan, bitkisel yağ ve baharatlar.', { gf: true });
add(8, 'Ispanak Boranisi', 390, 'Ispanak, kuru soğan, bitkisel yağ ve baharatlar.', { gf: true });
add(9, 'Hurmalı Erikli Dana Biryan', 740, 'Toprak güveç kapta dana biftek, Medine hurması, kurutulmuş dağ eriği, kuru soğan ve baharatlar.', { gf: true });
add(9, 'Hassaten Lokma (Lokmanın Has)', 690, 'Pirinç, dana eti, kuru incir, kuş üzümü, badem, fıstık ve baharatlar.', { gf: true });
add(9, 'Elmalı Dana Biryan', 740, 'Toprak güveç kapta dana biftek, taze yeşil elma, tarçın, bal, ceviz, kuru soğan ve baharatlar.', { gf: true });
add(9, 'Vişneli Kuzu İncik', 990, 'Safranlı ve zerdeçallı bulgur pilavı, haşlama kuzu incik, kurutulmuş vişne.');
add(9, 'Etli Bulgur Aşı', 690, 'Safranlı ve zerdeçallı bulgur pilavı, dana kavurma.');
add(9, 'Kayısılı Kuzu Gerdan', 740, 'Toprak güveçte safranlı zerdeçallı bulgur pilavı üzerinde kuru kayısı ve kuru soğan ile kemikli kuzu gerdan eti.');

// --- Vejetaryen
add(10, 'Çeşmi Nigar Çorbası', 280, 'Mısır unu, mercimek, sarımsak, soğan ve baharatlar.');
add(11, 'Patatesli Sıkma', 340, 'Kızartılmış lavaş içinde patates, marul ve baharatlar.');
add(11, 'Konya Yeşil Peynirli Sıkma', 340, 'Kızartılmış lavaş içinde Konya yeşil peyniri, kaşar peyniri ve baharatlar.');
add(11, 'Közlenmiş Patlıcanlı Biberli Sıkma', 340, 'Kızartılmış lavaş içinde közlenmiş patlıcan, közlenmiş kırmızı biber ve baharatlar.');
add(11, 'Ispanaklı Peynirli Kalem Böreği', 290, 'El açması yufka, sütte haşlanmış ıspanak, kaşar ve tulum peyniri.');
add(11, 'Safranlı Bademli Bulgur Pilavı', 340, 'Bulgur, safran, zerdeçal, bitkisel yağ, badem.');
add(11, 'Tahinli Humus', 340, 'Nohut, tahin, sarımsak, limon suyu, zeytinyağı, tuz ve baharatlar.');
add(11, 'Cevizli Haydari', 340, 'Ceviz, yoğurt, közlenmiş patlıcan, zeytinyağı, sarımsak, dereotu, tuz ve baharatlar.', { gf: true });
add(11, 'Vişneli Yaprak Sarma', 390, 'Asma yaprağı, vişne, tarçın, pirinç, salça, zeytinyağı ve baharatlar.', { gf: true });
add(12, 'Hasseten Lokma', 590, 'Pirinç, kuru incir, kuş üzümü, badem, fıstık ve baharatlar.', { gf: true });
add(12, 'Kırmızı Pancar Yemeği', 390, 'Kırmızı pancar, zeytinyağı, yoğurt ve baharatlar.', { gf: true });
add(12, 'Ispanak Boranisi', 390, 'Ispanak, kuru soğan, bitkisel yağ ve baharatlar.', { gf: true });
add(12, 'Patlıcan Kalyesi', 390, 'Güneşte kurutulmuş patlıcan, kuru soğan, bitkisel yağ ve baharatlar.', { gf: true });
add(12, 'Fasülye Kalyesi', 390, 'Güneşte kurutulmuş fasülye, kuru soğan, bitkisel yağ ve baharatlar.', { gf: true });
add(12, 'Biber Kalyesi', 390, 'Güneşte kurutulmuş biber, kuru soğan, bitkisel yağ ve baharatlar.', { gf: true });
add(12, 'Karışık Kalye Tabağı', 490, 'Güneşte kurutulmuş patlıcan, biber, fasülye, kuru soğan, bitkisel yağ ve baharatlar.', { gf: true });

// --- Vegan
add(13, 'Çeşmi Nigar Çorbası', 280, 'Mısır unu, mercimek, sarımsak, soğan ve baharatlar.');
add(14, 'Patatesli Sıkma', 340, 'Kızartılmış lavaş içinde patates, marul ve baharatlar.');
add(14, 'Közlenmiş Patlıcanlı Biberli Sıkma', 340, 'Kızartılmış lavaş içinde közlenmiş patlıcan, közlenmiş kırmızı biber ve baharatlar.');
add(14, 'Safranlı Bademli Bulgur Pilavı', 340, 'Bulgur, safran, zerdeçal, bitkisel yağ, badem.');
add(14, 'Tahinli Humus', 340, 'Nohut, tahin, sarımsak, limon suyu, zeytinyağı, tuz ve baharatlar.');
add(14, 'Vişneli Yaprak Sarma', 390, 'Asma yaprağı, vişne, tarçın, pirinç, salça, zeytinyağı ve baharatlar.', { gf: true });
add(15, 'Hasseten Lokma', 590, 'Pirinç, kuru incir, kuş üzümü, badem, fıstık ve baharatlar.', { gf: true });
add(15, 'Kırmızı Pancar Yemeği', 390, 'Kırmızı pancar, zeytinyağı ve baharatlar.', { gf: true });
add(15, 'Ispanak Borani', 390, 'Ispanak, kuru soğan, bitkisel yağ ve baharatlar.', { gf: true });
add(15, 'Patlıcan Kalyesi', 390, 'Güneşte kurutulmuş patlıcan, kuru soğan, bitkisel yağ ve baharatlar.', { gf: true });
add(15, 'Fasülye Kalyesi', 390, 'Güneşte kurutulmuş fasülye, kuru soğan, bitkisel yağ ve baharatlar.', { gf: true });
add(15, 'Biber Kalyesi', 390, 'Güneşte kurutulmuş biber, kuru soğan, bitkisel yağ ve baharatlar.', { gf: true });
add(15, 'Karışık Kalye Tabağı', 490, 'Güneşte kurutulmuş patlıcan, biber, fasülye, kuru soğan, bitkisel yağ ve baharatlar.', { gf: true });

// --- Kahvaltı
add(
  16,
  'Soğuk Serpme Kahvaltı',
  590,
  'Top peyniri, kaşar, süzme, Konya yeşil peynir, yeşil biberli ve siyah zeytin, bal, kaymak, tereyağı, köpük helva, ceviz, ev yapımı reçeller, domates, salatalık, mevsim meyvesi, tahin, pekmez. Bu kahvaltı en az iki kişilik hazırlanır.',
  { pp: true }
);
add(
  16,
  'Kahvaltı Tabağı',
  640,
  'Kaşar, süzme, Konya yeşil peynir, yeşil biberli ve siyah zeytin, bal, kaymak, tereyağı, köpük helva, ev yapımı reçeller, domates, salatalık, mevsim meyvesi, tahin, pekmez, patates kızartması, paçanga böreği, haşlanmış yumurta.'
);
add(
  16,
  'Serpme Sultan Kahvaltısı',
  690,
  'Sucuklu yumurta, kavurmalı yumurta, çömlekte menemen, paçanga ve kalem böreği, patates kızartması, peynir çeşitleri, zeytin, bal, kaymak, tereyağı, köpük helva, reçeller, domates, salatalık, meyve, tahin, pekmez, ceviz, sınırsız çay ve su. En az iki kişilik hazırlanır.',
  { pp: true }
);
add(16, 'Tereyağlı Çılbır', 240, '');
add(16, 'Paçanga Böreği', 290, '');
add(16, 'Ispanaklı Sütlü Börek', 290, '');
add(16, 'Patates Kızartması', 290, '');
add(16, 'Sade Omlet / Peynirli Omlet', 240, '');
add(16, 'Omlet Çeşitleri', 290, 'Kavurmalı, sucuklu, pastırmalı, mantarlı.');
add(16, 'Sahanda Yumurta', 240, '');
add(16, 'Kavurmalı Yumurta', 390, '');
add(16, 'Çömlekte Sucuklu Yumurta', 340, '');
add(16, 'Çömlekte Menemen', 290, '');
add(16, 'Çömlekte Sucuk', 340, '');
add(16, 'Çömlekte Sade Kavurma', 340, '');
add(16, 'Çömlekte Kaşarlı Mantar', 340, '');
add(16, 'Taze Sıkma Meyve Suyu', 195, '');
add(16, 'Süt', 95, '');
add(16, 'Termos Çay', 290, '');

// --- Şerbet & soğuk
add(17, 'Reyhan Şerbeti', 130, '');
add(17, 'Sirkencübin Şerbeti', 130, '');
add(17, 'Gül Şerbeti', 130, '');
add(17, 'Demirhindi Şerbeti', 130, '');
add(17, 'Nar Şerbeti', 130, '');
add(18, 'Ayran', 95, '');
add(18, 'Şalgam', 95, '');
add(18, 'Taze Sıkma Meyve Suyu', 195, '');
add(18, 'Sade Soda', 95, '');
add(18, 'Limonlu Soda', 95, '');
add(18, 'Küçük Su', 48, '');
add(18, 'Büyük Su', 95, '');

// --- Salata & tatlı
add(19, 'Gül Yapraklı Marul Salatası', 340, 'Akdeniz ve kıvırcık marul, dereotu, gül yaprağı, zeytinyağı limon sosu, nar ekşisi.', { gf: true });
add(19, 'Çoban Salatası', 340, 'Kuru soğan, domates, salatalık, biber, zeytinyağı, limon sosu, nar ekşisi.', { gf: true });
add(19, 'Taze Meyveli Mevsim Salatası', 390, 'Mevsim meyveleri, kıvırcık marul, zeytinyağı, limon sosu, nar ekşisi.', { gf: true });
add(19, 'Kuru Meyveli Cevizli Salata', 390, 'Akdeniz ve kıvırcık marul, kuru incir, kuru üzüm, kayısı kurusu, ceviz, zeytinyağı, limon sosu, nar ekşisi.', { gf: true });
add(19, '3 Peynirli Yeşillik Salatası', 390, 'Akdeniz ve kıvırcık marul, beyaz peynir, tulum, süzme; zeytinyağı, limon sosu, nar ekşisi.', { gf: true });
add(19, 'Yoğurt', 290, '', { gf: true });
add(19, 'Cacık', 290, '', { gf: true });
add(19, 'Karışık Turşu', 290, '', { gf: true });
add(20, 'Ballı Güllü Badem Helvası', 340, '');
add(20, 'Tahinli Cevizli Kabak Tatlısı', 340, '', { gf: true });
add(20, 'Antep Fıstıklı Kaymaklı Firuze', 340, '');
add(20, 'Maraş Kesme Dondurma', 290, '', { gf: true });

// --- Sıcak içecekler
add(21, 'Bardak Çay', 48, '');
add(21, 'Fincan Çay', 78, '');
add(21, 'Türk Kahvesi', 125, '');
add(21, 'Menengiç Kahvesi', 125, '');
add(21, 'Dibek Kahvesi', 125, '');
add(21, 'Nescafe', 125, '');
add(21, 'Filtre Kahve', 145, '');
add(21, 'Sütlü Filtre Kahve', 145, '');
add(21, 'Sahlep', 145, '');
add(21, 'Sıcak Süt', 95, '');
add(21, 'Sıcak Ballı Süt', 125, '');
add(21, 'Yeşil Çay', 145, '');
add(21, 'Adaçayı', 145, '');
add(21, 'Ihlamur', 145, '');
add(21, 'Hibiskus', 145, '');
add(21, 'Early Grey', 145, '');
add(21, 'Papatya', 145, '');
add(21, 'Nane Limon', 145, '');
add(21, 'Elma Çayı', 145, '');

// --- Çocuk
add(22, 'Mutlu Mercimek Çorbası', 240, 'Mısır unlu mercimek çorbası.');
add(22, 'Minik Kaptan Yemeği', 590, 'Patates cipsi eşliğinde Norveç somonu.');
add(22, 'Pilav Dağında Et Macerası', 590, 'Pilav üstü dana kavurma.');
add(22, 'Köfte ve Patates Krallığı', 490, 'Patates cipsi eşliğinde ızgara köfte.');
add(22, 'Çılgın Tavuklu Makarna', 440, 'Kremalı tavuklu kalem makarna.');
add(22, 'Peynir Toplu Neşeli Makarna', 360, 'Top peynirli sade makarna.');
add(22, 'Ponçik Patates Sepeti', 240, 'Parmak patates cipsi.');
add(22, 'Pofuduk Donat', 240, 'Çilek veya çikolata dolgulu donat.');

const products = rows.map((p) => {
  const o = { ...p };
  if (!o.gluten_free) delete o.gluten_free;
  if (!o.per_person) delete o.per_person;
  return o;
});

const out = `'use strict';

/** Sultan Somatı — paketlenmiş tam menü (Firebase + yerel senkron). */
const SULTAN_MENU_BUNDLE_ID = ${BUNDLE_ID};

const categories = ${JSON.stringify(categories, null, 2)};

const products = ${JSON.stringify(products, null, 2)};

module.exports = {
  SULTAN_MENU_BUNDLE_ID,
  categories,
  products,
};
`;

const target = path.join(__dirname, 'sultanMenuCatalog.js');
fs.writeFileSync(target, out, 'utf8');
console.log('Yazıldı:', target, 'ürün sayısı:', products.length);
