'use strict';

/** Sultan Somatı — paketlenmiş tam menü (Firebase + yerel senkron). */
const SULTAN_MENU_BUNDLE_ID = 1;

const categories = [
  {
    "id": 1,
    "name": "Konya Mutfağı · Çorba",
    "order_index": 0
  },
  {
    "id": 2,
    "name": "Konya Mutfağı · Ana Yemekler",
    "order_index": 1
  },
  {
    "id": 3,
    "name": "Konya Mutfağı · Tadım Menüsü",
    "order_index": 2
  },
  {
    "id": 4,
    "name": "Osmanlı Mutfağı · Çorba",
    "order_index": 3
  },
  {
    "id": 5,
    "name": "Osmanlı Mutfağı · Ara Sıcaklar",
    "order_index": 4
  },
  {
    "id": 6,
    "name": "Osmanlı Mutfağı · Ana Yemekler",
    "order_index": 5
  },
  {
    "id": 7,
    "name": "Selçuklu Mevlevi Mutfağı · Çorba",
    "order_index": 6
  },
  {
    "id": 8,
    "name": "Selçuklu Mevlevi Mutfağı · Ara Sıcaklar",
    "order_index": 7
  },
  {
    "id": 9,
    "name": "Selçuklu Mevlevi Mutfağı · Ana Yemekler",
    "order_index": 8
  },
  {
    "id": 10,
    "name": "Vejetaryen · Çorba",
    "order_index": 9
  },
  {
    "id": 11,
    "name": "Vejetaryen · Ara Sıcaklar",
    "order_index": 10
  },
  {
    "id": 12,
    "name": "Vejetaryen · Ana Yemekler",
    "order_index": 11
  },
  {
    "id": 13,
    "name": "Vegan · Çorba",
    "order_index": 12
  },
  {
    "id": 14,
    "name": "Vegan · Ara Sıcaklar",
    "order_index": 13
  },
  {
    "id": 15,
    "name": "Vegan · Ana Yemekler",
    "order_index": 14
  },
  {
    "id": 16,
    "name": "Kahvaltı",
    "order_index": 15
  },
  {
    "id": 17,
    "name": "Şerbetler",
    "order_index": 16
  },
  {
    "id": 18,
    "name": "Soğuk İçecekler",
    "order_index": 17
  },
  {
    "id": 19,
    "name": "Salatalar",
    "order_index": 18
  },
  {
    "id": 20,
    "name": "Tatlılar",
    "order_index": 19
  },
  {
    "id": 21,
    "name": "Sıcak İçecekler",
    "order_index": 20
  },
  {
    "id": 22,
    "name": "Çocuk Menüsü",
    "order_index": 21
  }
];

const products = [
  {
    "id": 1,
    "category_id": 1,
    "name": "Bamya Çorbası",
    "price": 440,
    "description": "Un, yağ, kuru soğan, kuru çiçek bamya, dana eti ve baharatlar.",
    "image": null
  },
  {
    "id": 2,
    "category_id": 2,
    "name": "Kuyu Tandır Kebabı",
    "price": 740,
    "description": "Hiçbir katkı maddesi olmadan 8–10 saat kuyu tandırda kendi yağında pişmiş kemiksiz kuzu eti, bakır kap içinde.",
    "image": null
  },
  {
    "id": 3,
    "category_id": 2,
    "name": "Güveçte Et Tiridi",
    "price": 740,
    "description": "Güveçte dana kavurma; üzerinde küp ekmek, yoğurt, sumaklı soğan, maydanoz, tereyağı ve baharatlar.",
    "image": null
  },
  {
    "id": 4,
    "category_id": 3,
    "name": "Dört Mutfak Tadım Menüsü",
    "price": 1790,
    "description": "Kişi başı. En az 2 kişilik hazırlanır; kişi sayısı arttıkça çeşit sayısı artar. Dört tarihi mutfak kültüründen seçkiler. 4 çeşit çorba, 3 çeşit ara sıcak veya soğuk, 5 çeşit şerbet, kişi sayısına göre 4–7 çeşit ana yemek, 3 çeşit tatlı, salata, çay ve su.",
    "image": null,
    "per_person": true
  },
  {
    "id": 5,
    "category_id": 4,
    "name": "Çeşmi Nigar Çorbası",
    "price": 280,
    "description": "Mısır unu, mercimek, sarımsak, kuru soğan ve baharatlar.",
    "image": null
  },
  {
    "id": 6,
    "category_id": 5,
    "name": "Kıymalı Su Böreği",
    "price": 340,
    "description": "El açması yufka, dana kıyma, kuru soğan, tereyağı ve baharatlar.",
    "image": null
  },
  {
    "id": 7,
    "category_id": 5,
    "name": "Peynirli Su Böreği",
    "price": 290,
    "description": "El açması yufka, peynir, tereyağı ve baharatlar.",
    "image": null
  },
  {
    "id": 8,
    "category_id": 5,
    "name": "Tahinli Cevizli Humus",
    "price": 340,
    "description": "Nohut, ceviz, tahin, sarımsak, limon suyu, zeytinyağı, tuz ve baharatlar.",
    "image": null
  },
  {
    "id": 9,
    "category_id": 5,
    "name": "Cevizli Haydari",
    "price": 340,
    "description": "Ceviz, yoğurt, közlenmiş patlıcan, zeytinyağı, sarımsak, dereotu, tuz ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 10,
    "category_id": 5,
    "name": "Ispanaklı Peynirli Kalem Böreği",
    "price": 290,
    "description": "El açması yufka, sütte haşlanmış ıspanak, kaşar ve tulum peyniri.",
    "image": null
  },
  {
    "id": 11,
    "category_id": 5,
    "name": "Kırmızı Pancar Yemeği",
    "price": 390,
    "description": "Kırmızı pancar, zeytinyağı, yoğurt ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 12,
    "category_id": 5,
    "name": "Vişneli Yaprak Sarma",
    "price": 390,
    "description": "Asma yaprağı, vişne, tarçın, pirinç, salça, zeytinyağı ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 13,
    "category_id": 6,
    "name": "Tavuklu Mahmudiye",
    "price": 570,
    "description": "Tavuk göğsü, bal, badem, kuru kayısı, kuru üzüm, arpacık soğan, maydanoz ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 14,
    "category_id": 6,
    "name": "Dana Seferceliye",
    "price": 740,
    "description": "Dana biftek, arpacık soğan, bal, badem, ayva kurusu ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 15,
    "category_id": 6,
    "name": "Kuzu Mutancana",
    "price": 890,
    "description": "Kuzu eti, arpacık soğan, bal, badem, kuru kayısı, kuru incir, kuru üzüm ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 16,
    "category_id": 6,
    "name": "Sütlü Kahveli Et",
    "price": 740,
    "description": "Çekirdek kahve ile marine edilmiş dana biftek, süt, Türk kahvesi ve baharatlar.",
    "image": null
  },
  {
    "id": 17,
    "category_id": 6,
    "name": "Saray Usulü Tavuk",
    "price": 570,
    "description": "Fıstıklı, kuş üzümlü tavuk sarma; portakal sos eşliğinde.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 18,
    "category_id": 7,
    "name": "Tarhana Çorbası",
    "price": 280,
    "description": "Anadolu tarhanası, kırmızı toz biber, tereyağı, tuz, su.",
    "image": null
  },
  {
    "id": 19,
    "category_id": 7,
    "name": "Tutmaç Çorbası",
    "price": 340,
    "description": "Un, yoğurt, erişte veya nohut, dana eti, sarımsak ve baharatlar.",
    "image": null
  },
  {
    "id": 20,
    "category_id": 8,
    "name": "Patlıcan Kalyesi",
    "price": 390,
    "description": "Güneşte kurutulmuş patlıcan, kuru soğan, bitkisel yağ ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 21,
    "category_id": 8,
    "name": "Fasülye Kalyesi",
    "price": 390,
    "description": "Güneşte kurutulmuş fasülye, kuru soğan, bitkisel yağ ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 22,
    "category_id": 8,
    "name": "Biber Kalyesi",
    "price": 390,
    "description": "Güneşte kurutulmuş biber, kuru soğan, bitkisel yağ ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 23,
    "category_id": 8,
    "name": "Karışık Kalye Tabağı",
    "price": 490,
    "description": "Güneşte kurutulmuş patlıcan, biber, fasülye, kuru soğan, bitkisel yağ ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 24,
    "category_id": 8,
    "name": "Ispanak Boranisi",
    "price": 390,
    "description": "Ispanak, kuru soğan, bitkisel yağ ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 25,
    "category_id": 9,
    "name": "Hurmalı Erikli Dana Biryan",
    "price": 740,
    "description": "Toprak güveç kapta dana biftek, Medine hurması, kurutulmuş dağ eriği, kuru soğan ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 26,
    "category_id": 9,
    "name": "Hassaten Lokma (Lokmanın Has)",
    "price": 690,
    "description": "Pirinç, dana eti, kuru incir, kuş üzümü, badem, fıstık ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 27,
    "category_id": 9,
    "name": "Elmalı Dana Biryan",
    "price": 740,
    "description": "Toprak güveç kapta dana biftek, taze yeşil elma, tarçın, bal, ceviz, kuru soğan ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 28,
    "category_id": 9,
    "name": "Vişneli Kuzu İncik",
    "price": 990,
    "description": "Safranlı ve zerdeçallı bulgur pilavı, haşlama kuzu incik, kurutulmuş vişne.",
    "image": null
  },
  {
    "id": 29,
    "category_id": 9,
    "name": "Etli Bulgur Aşı",
    "price": 690,
    "description": "Safranlı ve zerdeçallı bulgur pilavı, dana kavurma.",
    "image": null
  },
  {
    "id": 30,
    "category_id": 9,
    "name": "Kayısılı Kuzu Gerdan",
    "price": 740,
    "description": "Toprak güveçte safranlı zerdeçallı bulgur pilavı üzerinde kuru kayısı ve kuru soğan ile kemikli kuzu gerdan eti.",
    "image": null
  },
  {
    "id": 31,
    "category_id": 10,
    "name": "Çeşmi Nigar Çorbası",
    "price": 280,
    "description": "Mısır unu, mercimek, sarımsak, soğan ve baharatlar.",
    "image": null
  },
  {
    "id": 32,
    "category_id": 11,
    "name": "Patatesli Sıkma",
    "price": 340,
    "description": "Kızartılmış lavaş içinde patates, marul ve baharatlar.",
    "image": null
  },
  {
    "id": 33,
    "category_id": 11,
    "name": "Konya Yeşil Peynirli Sıkma",
    "price": 340,
    "description": "Kızartılmış lavaş içinde Konya yeşil peyniri, kaşar peyniri ve baharatlar.",
    "image": null
  },
  {
    "id": 34,
    "category_id": 11,
    "name": "Közlenmiş Patlıcanlı Biberli Sıkma",
    "price": 340,
    "description": "Kızartılmış lavaş içinde közlenmiş patlıcan, közlenmiş kırmızı biber ve baharatlar.",
    "image": null
  },
  {
    "id": 35,
    "category_id": 11,
    "name": "Ispanaklı Peynirli Kalem Böreği",
    "price": 290,
    "description": "El açması yufka, sütte haşlanmış ıspanak, kaşar ve tulum peyniri.",
    "image": null
  },
  {
    "id": 36,
    "category_id": 11,
    "name": "Safranlı Bademli Bulgur Pilavı",
    "price": 340,
    "description": "Bulgur, safran, zerdeçal, bitkisel yağ, badem.",
    "image": null
  },
  {
    "id": 37,
    "category_id": 11,
    "name": "Tahinli Humus",
    "price": 340,
    "description": "Nohut, tahin, sarımsak, limon suyu, zeytinyağı, tuz ve baharatlar.",
    "image": null
  },
  {
    "id": 38,
    "category_id": 11,
    "name": "Cevizli Haydari",
    "price": 340,
    "description": "Ceviz, yoğurt, közlenmiş patlıcan, zeytinyağı, sarımsak, dereotu, tuz ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 39,
    "category_id": 11,
    "name": "Vişneli Yaprak Sarma",
    "price": 390,
    "description": "Asma yaprağı, vişne, tarçın, pirinç, salça, zeytinyağı ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 40,
    "category_id": 12,
    "name": "Hasseten Lokma",
    "price": 590,
    "description": "Pirinç, kuru incir, kuş üzümü, badem, fıstık ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 41,
    "category_id": 12,
    "name": "Kırmızı Pancar Yemeği",
    "price": 390,
    "description": "Kırmızı pancar, zeytinyağı, yoğurt ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 42,
    "category_id": 12,
    "name": "Ispanak Boranisi",
    "price": 390,
    "description": "Ispanak, kuru soğan, bitkisel yağ ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 43,
    "category_id": 12,
    "name": "Patlıcan Kalyesi",
    "price": 390,
    "description": "Güneşte kurutulmuş patlıcan, kuru soğan, bitkisel yağ ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 44,
    "category_id": 12,
    "name": "Fasülye Kalyesi",
    "price": 390,
    "description": "Güneşte kurutulmuş fasülye, kuru soğan, bitkisel yağ ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 45,
    "category_id": 12,
    "name": "Biber Kalyesi",
    "price": 390,
    "description": "Güneşte kurutulmuş biber, kuru soğan, bitkisel yağ ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 46,
    "category_id": 12,
    "name": "Karışık Kalye Tabağı",
    "price": 490,
    "description": "Güneşte kurutulmuş patlıcan, biber, fasülye, kuru soğan, bitkisel yağ ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 47,
    "category_id": 13,
    "name": "Çeşmi Nigar Çorbası",
    "price": 280,
    "description": "Mısır unu, mercimek, sarımsak, soğan ve baharatlar.",
    "image": null
  },
  {
    "id": 48,
    "category_id": 14,
    "name": "Patatesli Sıkma",
    "price": 340,
    "description": "Kızartılmış lavaş içinde patates, marul ve baharatlar.",
    "image": null
  },
  {
    "id": 49,
    "category_id": 14,
    "name": "Közlenmiş Patlıcanlı Biberli Sıkma",
    "price": 340,
    "description": "Kızartılmış lavaş içinde közlenmiş patlıcan, közlenmiş kırmızı biber ve baharatlar.",
    "image": null
  },
  {
    "id": 50,
    "category_id": 14,
    "name": "Safranlı Bademli Bulgur Pilavı",
    "price": 340,
    "description": "Bulgur, safran, zerdeçal, bitkisel yağ, badem.",
    "image": null
  },
  {
    "id": 51,
    "category_id": 14,
    "name": "Tahinli Humus",
    "price": 340,
    "description": "Nohut, tahin, sarımsak, limon suyu, zeytinyağı, tuz ve baharatlar.",
    "image": null
  },
  {
    "id": 52,
    "category_id": 14,
    "name": "Vişneli Yaprak Sarma",
    "price": 390,
    "description": "Asma yaprağı, vişne, tarçın, pirinç, salça, zeytinyağı ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 53,
    "category_id": 15,
    "name": "Hasseten Lokma",
    "price": 590,
    "description": "Pirinç, kuru incir, kuş üzümü, badem, fıstık ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 54,
    "category_id": 15,
    "name": "Kırmızı Pancar Yemeği",
    "price": 390,
    "description": "Kırmızı pancar, zeytinyağı ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 55,
    "category_id": 15,
    "name": "Ispanak Borani",
    "price": 390,
    "description": "Ispanak, kuru soğan, bitkisel yağ ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 56,
    "category_id": 15,
    "name": "Patlıcan Kalyesi",
    "price": 390,
    "description": "Güneşte kurutulmuş patlıcan, kuru soğan, bitkisel yağ ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 57,
    "category_id": 15,
    "name": "Fasülye Kalyesi",
    "price": 390,
    "description": "Güneşte kurutulmuş fasülye, kuru soğan, bitkisel yağ ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 58,
    "category_id": 15,
    "name": "Biber Kalyesi",
    "price": 390,
    "description": "Güneşte kurutulmuş biber, kuru soğan, bitkisel yağ ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 59,
    "category_id": 15,
    "name": "Karışık Kalye Tabağı",
    "price": 490,
    "description": "Güneşte kurutulmuş patlıcan, biber, fasülye, kuru soğan, bitkisel yağ ve baharatlar.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 60,
    "category_id": 16,
    "name": "Soğuk Serpme Kahvaltı",
    "price": 590,
    "description": "Top peyniri, kaşar, süzme, Konya yeşil peynir, yeşil biberli ve siyah zeytin, bal, kaymak, tereyağı, köpük helva, ceviz, ev yapımı reçeller, domates, salatalık, mevsim meyvesi, tahin, pekmez. Bu kahvaltı en az iki kişilik hazırlanır.",
    "image": null,
    "per_person": true
  },
  {
    "id": 61,
    "category_id": 16,
    "name": "Kahvaltı Tabağı",
    "price": 640,
    "description": "Kaşar, süzme, Konya yeşil peynir, yeşil biberli ve siyah zeytin, bal, kaymak, tereyağı, köpük helva, ev yapımı reçeller, domates, salatalık, mevsim meyvesi, tahin, pekmez, patates kızartması, paçanga böreği, haşlanmış yumurta.",
    "image": null
  },
  {
    "id": 62,
    "category_id": 16,
    "name": "Serpme Sultan Kahvaltısı",
    "price": 690,
    "description": "Sucuklu yumurta, kavurmalı yumurta, çömlekte menemen, paçanga ve kalem böreği, patates kızartması, peynir çeşitleri, zeytin, bal, kaymak, tereyağı, köpük helva, reçeller, domates, salatalık, meyve, tahin, pekmez, ceviz, sınırsız çay ve su. En az iki kişilik hazırlanır.",
    "image": null,
    "per_person": true
  },
  {
    "id": 63,
    "category_id": 16,
    "name": "Tereyağlı Çılbır",
    "price": 240,
    "description": null,
    "image": null
  },
  {
    "id": 64,
    "category_id": 16,
    "name": "Paçanga Böreği",
    "price": 290,
    "description": null,
    "image": null
  },
  {
    "id": 65,
    "category_id": 16,
    "name": "Ispanaklı Sütlü Börek",
    "price": 290,
    "description": null,
    "image": null
  },
  {
    "id": 66,
    "category_id": 16,
    "name": "Patates Kızartması",
    "price": 290,
    "description": null,
    "image": null
  },
  {
    "id": 67,
    "category_id": 16,
    "name": "Sade Omlet / Peynirli Omlet",
    "price": 240,
    "description": null,
    "image": null
  },
  {
    "id": 68,
    "category_id": 16,
    "name": "Omlet Çeşitleri",
    "price": 290,
    "description": "Kavurmalı, sucuklu, pastırmalı, mantarlı.",
    "image": null
  },
  {
    "id": 69,
    "category_id": 16,
    "name": "Sahanda Yumurta",
    "price": 240,
    "description": null,
    "image": null
  },
  {
    "id": 70,
    "category_id": 16,
    "name": "Kavurmalı Yumurta",
    "price": 390,
    "description": null,
    "image": null
  },
  {
    "id": 71,
    "category_id": 16,
    "name": "Çömlekte Sucuklu Yumurta",
    "price": 340,
    "description": null,
    "image": null
  },
  {
    "id": 72,
    "category_id": 16,
    "name": "Çömlekte Menemen",
    "price": 290,
    "description": null,
    "image": null
  },
  {
    "id": 73,
    "category_id": 16,
    "name": "Çömlekte Sucuk",
    "price": 340,
    "description": null,
    "image": null
  },
  {
    "id": 74,
    "category_id": 16,
    "name": "Çömlekte Sade Kavurma",
    "price": 340,
    "description": null,
    "image": null
  },
  {
    "id": 75,
    "category_id": 16,
    "name": "Çömlekte Kaşarlı Mantar",
    "price": 340,
    "description": null,
    "image": null
  },
  {
    "id": 76,
    "category_id": 16,
    "name": "Taze Sıkma Meyve Suyu",
    "price": 195,
    "description": null,
    "image": null
  },
  {
    "id": 77,
    "category_id": 16,
    "name": "Süt",
    "price": 95,
    "description": null,
    "image": null
  },
  {
    "id": 78,
    "category_id": 16,
    "name": "Termos Çay",
    "price": 290,
    "description": null,
    "image": null
  },
  {
    "id": 79,
    "category_id": 17,
    "name": "Reyhan Şerbeti",
    "price": 130,
    "description": null,
    "image": null
  },
  {
    "id": 80,
    "category_id": 17,
    "name": "Sirkencübin Şerbeti",
    "price": 130,
    "description": null,
    "image": null
  },
  {
    "id": 81,
    "category_id": 17,
    "name": "Gül Şerbeti",
    "price": 130,
    "description": null,
    "image": null
  },
  {
    "id": 82,
    "category_id": 17,
    "name": "Demirhindi Şerbeti",
    "price": 130,
    "description": null,
    "image": null
  },
  {
    "id": 83,
    "category_id": 17,
    "name": "Nar Şerbeti",
    "price": 130,
    "description": null,
    "image": null
  },
  {
    "id": 84,
    "category_id": 18,
    "name": "Ayran",
    "price": 95,
    "description": null,
    "image": null
  },
  {
    "id": 85,
    "category_id": 18,
    "name": "Şalgam",
    "price": 95,
    "description": null,
    "image": null
  },
  {
    "id": 86,
    "category_id": 18,
    "name": "Taze Sıkma Meyve Suyu",
    "price": 195,
    "description": null,
    "image": null
  },
  {
    "id": 87,
    "category_id": 18,
    "name": "Sade Soda",
    "price": 95,
    "description": null,
    "image": null
  },
  {
    "id": 88,
    "category_id": 18,
    "name": "Limonlu Soda",
    "price": 95,
    "description": null,
    "image": null
  },
  {
    "id": 89,
    "category_id": 18,
    "name": "Küçük Su",
    "price": 48,
    "description": null,
    "image": null
  },
  {
    "id": 90,
    "category_id": 18,
    "name": "Büyük Su",
    "price": 95,
    "description": null,
    "image": null
  },
  {
    "id": 91,
    "category_id": 19,
    "name": "Gül Yapraklı Marul Salatası",
    "price": 340,
    "description": "Akdeniz ve kıvırcık marul, dereotu, gül yaprağı, zeytinyağı limon sosu, nar ekşisi.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 92,
    "category_id": 19,
    "name": "Çoban Salatası",
    "price": 340,
    "description": "Kuru soğan, domates, salatalık, biber, zeytinyağı, limon sosu, nar ekşisi.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 93,
    "category_id": 19,
    "name": "Taze Meyveli Mevsim Salatası",
    "price": 390,
    "description": "Mevsim meyveleri, kıvırcık marul, zeytinyağı, limon sosu, nar ekşisi.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 94,
    "category_id": 19,
    "name": "Kuru Meyveli Cevizli Salata",
    "price": 390,
    "description": "Akdeniz ve kıvırcık marul, kuru incir, kuru üzüm, kayısı kurusu, ceviz, zeytinyağı, limon sosu, nar ekşisi.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 95,
    "category_id": 19,
    "name": "3 Peynirli Yeşillik Salatası",
    "price": 390,
    "description": "Akdeniz ve kıvırcık marul, beyaz peynir, tulum, süzme; zeytinyağı, limon sosu, nar ekşisi.",
    "image": null,
    "gluten_free": true
  },
  {
    "id": 96,
    "category_id": 19,
    "name": "Yoğurt",
    "price": 290,
    "description": null,
    "image": null,
    "gluten_free": true
  },
  {
    "id": 97,
    "category_id": 19,
    "name": "Cacık",
    "price": 290,
    "description": null,
    "image": null,
    "gluten_free": true
  },
  {
    "id": 98,
    "category_id": 19,
    "name": "Karışık Turşu",
    "price": 290,
    "description": null,
    "image": null,
    "gluten_free": true
  },
  {
    "id": 99,
    "category_id": 20,
    "name": "Ballı Güllü Badem Helvası",
    "price": 340,
    "description": null,
    "image": null
  },
  {
    "id": 100,
    "category_id": 20,
    "name": "Tahinli Cevizli Kabak Tatlısı",
    "price": 340,
    "description": null,
    "image": null,
    "gluten_free": true
  },
  {
    "id": 101,
    "category_id": 20,
    "name": "Antep Fıstıklı Kaymaklı Firuze",
    "price": 340,
    "description": null,
    "image": null
  },
  {
    "id": 102,
    "category_id": 20,
    "name": "Maraş Kesme Dondurma",
    "price": 290,
    "description": null,
    "image": null,
    "gluten_free": true
  },
  {
    "id": 103,
    "category_id": 21,
    "name": "Bardak Çay",
    "price": 48,
    "description": null,
    "image": null
  },
  {
    "id": 104,
    "category_id": 21,
    "name": "Fincan Çay",
    "price": 78,
    "description": null,
    "image": null
  },
  {
    "id": 105,
    "category_id": 21,
    "name": "Türk Kahvesi",
    "price": 125,
    "description": null,
    "image": null
  },
  {
    "id": 106,
    "category_id": 21,
    "name": "Menengiç Kahvesi",
    "price": 125,
    "description": null,
    "image": null
  },
  {
    "id": 107,
    "category_id": 21,
    "name": "Dibek Kahvesi",
    "price": 125,
    "description": null,
    "image": null
  },
  {
    "id": 108,
    "category_id": 21,
    "name": "Nescafe",
    "price": 125,
    "description": null,
    "image": null
  },
  {
    "id": 109,
    "category_id": 21,
    "name": "Filtre Kahve",
    "price": 145,
    "description": null,
    "image": null
  },
  {
    "id": 110,
    "category_id": 21,
    "name": "Sütlü Filtre Kahve",
    "price": 145,
    "description": null,
    "image": null
  },
  {
    "id": 111,
    "category_id": 21,
    "name": "Sahlep",
    "price": 145,
    "description": null,
    "image": null
  },
  {
    "id": 112,
    "category_id": 21,
    "name": "Sıcak Süt",
    "price": 95,
    "description": null,
    "image": null
  },
  {
    "id": 113,
    "category_id": 21,
    "name": "Sıcak Ballı Süt",
    "price": 125,
    "description": null,
    "image": null
  },
  {
    "id": 114,
    "category_id": 21,
    "name": "Yeşil Çay",
    "price": 145,
    "description": null,
    "image": null
  },
  {
    "id": 115,
    "category_id": 21,
    "name": "Adaçayı",
    "price": 145,
    "description": null,
    "image": null
  },
  {
    "id": 116,
    "category_id": 21,
    "name": "Ihlamur",
    "price": 145,
    "description": null,
    "image": null
  },
  {
    "id": 117,
    "category_id": 21,
    "name": "Hibiskus",
    "price": 145,
    "description": null,
    "image": null
  },
  {
    "id": 118,
    "category_id": 21,
    "name": "Early Grey",
    "price": 145,
    "description": null,
    "image": null
  },
  {
    "id": 119,
    "category_id": 21,
    "name": "Papatya",
    "price": 145,
    "description": null,
    "image": null
  },
  {
    "id": 120,
    "category_id": 21,
    "name": "Nane Limon",
    "price": 145,
    "description": null,
    "image": null
  },
  {
    "id": 121,
    "category_id": 21,
    "name": "Elma Çayı",
    "price": 145,
    "description": null,
    "image": null
  },
  {
    "id": 122,
    "category_id": 22,
    "name": "Mutlu Mercimek Çorbası",
    "price": 240,
    "description": "Mısır unlu mercimek çorbası.",
    "image": null
  },
  {
    "id": 123,
    "category_id": 22,
    "name": "Minik Kaptan Yemeği",
    "price": 590,
    "description": "Patates cipsi eşliğinde Norveç somonu.",
    "image": null
  },
  {
    "id": 124,
    "category_id": 22,
    "name": "Pilav Dağında Et Macerası",
    "price": 590,
    "description": "Pilav üstü dana kavurma.",
    "image": null
  },
  {
    "id": 125,
    "category_id": 22,
    "name": "Köfte ve Patates Krallığı",
    "price": 490,
    "description": "Patates cipsi eşliğinde ızgara köfte.",
    "image": null
  },
  {
    "id": 126,
    "category_id": 22,
    "name": "Çılgın Tavuklu Makarna",
    "price": 440,
    "description": "Kremalı tavuklu kalem makarna.",
    "image": null
  },
  {
    "id": 127,
    "category_id": 22,
    "name": "Peynir Toplu Neşeli Makarna",
    "price": 360,
    "description": "Top peynirli sade makarna.",
    "image": null
  },
  {
    "id": 128,
    "category_id": 22,
    "name": "Ponçik Patates Sepeti",
    "price": 240,
    "description": "Parmak patates cipsi.",
    "image": null
  },
  {
    "id": 129,
    "category_id": 22,
    "name": "Pofuduk Donat",
    "price": 240,
    "description": "Çilek veya çikolata dolgulu donat.",
    "image": null
  }
];

module.exports = {
  SULTAN_MENU_BUNDLE_ID,
  categories,
  products,
};
