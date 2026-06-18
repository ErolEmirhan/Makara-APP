/** Şube Firebase yapılandırmaları — masaüstü electron/main.js ile aynı projeler */

export const BRANCH_FIREBASE = {
  makara: {
    key: 'makara',
    label: 'Makara Havzan',
    main: {
      apiKey: 'AIzaSyCdf-c13e0wCafRYHXhIls1epJgD1RjPUA',
      authDomain: 'makara-16344.firebaseapp.com',
      projectId: 'makara-16344',
      storageBucket: 'makara-16344.firebasestorage.app',
      messagingSenderId: '216769654742',
      appId: '1:216769654742:web:16792742d4613f4269be77',
    },
    tables: {
      apiKey: 'AIzaSyDu_NUrgas4wZ_wdfAYE-DgxqTpb7vKxyo',
      authDomain: 'makaramasalar.firebaseapp.com',
      projectId: 'makaramasalar',
      storageBucket: 'makaramasalar.firebasestorage.app',
      messagingSenderId: '840151572206',
      appId: '1:840151572206:web:0afaf93deea636309e5dff',
    },
  },
  makarasur: {
    key: 'makarasur',
    label: 'Makara Suriçi',
    main: {
      apiKey: 'AIzaSyDnVpG-Hl7n2a1esMO4rZhq9JfqpKd3VUo',
      authDomain: 'makarasurici.firebaseapp.com',
      projectId: 'makarasurici',
      storageBucket: 'makarasurici.firebasestorage.app',
      messagingSenderId: '237735301273',
      appId: '1:237735301273:web:bf62c8f145434df0292808',
    },
    tables: null, // aynı proje
  },
  sultansomati: {
    key: 'sultansomati',
    label: 'Sultan Somatı',
    main: {
      apiKey: 'AIzaSyB_sSvCgbWC4HYKufueqfoDmbBS4SHlUnA',
      authDomain: 'sultansomati-5a3e9.firebaseapp.com',
      projectId: 'sultansomati-5a3e9',
      storageBucket: 'sultansomati-5a3e9.firebasestorage.app',
      messagingSenderId: '166037373406',
      appId: '1:166037373406:web:ed1c3724085446ae0d1d4f',
    },
    tables: null,
  },
};

export const MAKARA_HAVZAN_TABLE_COUNT = 100;

/** Makara Havzan masa bölgeleri (numara aralıkları) */
export const MAKARA_HAVZAN_ZONES = [
  { key: 'iceri', label: 'İçeri', min: 1, max: 19, accent: 'pink' },
  { key: 'disari', label: 'Dışarı', min: 20, max: 79, accent: 'amber' },
  { key: 'bahce', label: 'Bahçe', min: 80, max: 100, accent: 'emerald' },
];
export const MAKARA_SURICI_OUTSIDE = [
  61, 62, 63, 64, 65, 66, 67, 68, 71, 72, 73, 74, 75, 76, 77, 78,
  81, 82, 83, 84, 85, 86, 87, 88,
];

export const SULTAN_SECTIONS = [
  { key: 'disari', label: 'Dışarı', count: 4 },
  { key: 'kis-bahcesi', label: 'Kış Bahçesi', count: 14 },
  { key: 'osmanli-odasi', label: 'Osmanlı Odası', count: 8 },
  { key: 'selcuklu-odasi', label: 'Selçuklu Odası', count: 10 },
  { key: 'mevlevi-odasi', label: 'Mevlevi Odası', count: 1 },
  { key: 'ask-odasi', label: 'Aşk Odası', count: 1 },
  { key: 'yapma-odasi', label: 'Yapma Odası', count: 1 },
];

const BRANCH_KEY = 'makaraBranchKey';

export function getSavedBranchKey() {
  return localStorage.getItem(BRANCH_KEY) || '';
}

export function saveBranchKey(key) {
  localStorage.setItem(BRANCH_KEY, key);
}

export function buildBaseTables(branchKey) {
  if (branchKey === 'sultansomati') {
    const list = [];
    for (const sec of SULTAN_SECTIONS) {
      for (let n = 1; n <= sec.count; n++) {
        const id = `sultan-${sec.key}-${n}`;
        list.push({
          id,
          number: n,
          type: sec.key,
          name: sec.count === 1 ? sec.label : `${sec.label} · Masa ${n}`,
          hasOrder: false,
          orderTotal: null,
          sectionKey: sec.key,
          sectionLabel: sec.label,
        });
      }
    }
    return list;
  }

  const tables = [];
  const isSurici = branchKey === 'makarasur';
  const isHavzan = branchKey === 'makara';

  if (isHavzan) {
    for (const zone of MAKARA_HAVZAN_ZONES) {
      for (let n = zone.min; n <= zone.max; n += 1) {
        tables.push({
          id: `inside-${n}`,
          number: n,
          type: zone.key === 'iceri' ? 'inside' : zone.key === 'disari' ? 'outside' : 'garden',
          zoneKey: zone.key,
          zoneLabel: zone.label,
          name: `Masa ${n}`,
          hasOrder: false,
        });
      }
    }
  } else {
    const insideCount = isSurici ? 20 : MAKARA_HAVZAN_TABLE_COUNT;

    for (let i = 1; i <= insideCount; i++) {
      tables.push({ id: `inside-${i}`, number: i, type: 'inside', name: `Masa ${i}`, hasOrder: false });
    }
    if (isSurici) {
      MAKARA_SURICI_OUTSIDE.forEach((num) => {
        tables.push({ id: `outside-${num}`, number: num, type: 'outside', name: `Masa ${num}`, hasOrder: false });
      });
    }
  }

  for (let i = 1; i <= 5; i++) {
    tables.push({ id: `package-inside-${i}`, number: i, type: 'inside', name: `Paket ${i}`, hasOrder: false });
    tables.push({ id: `package-outside-${i}`, number: i, type: 'outside', name: `Paket ${i}`, hasOrder: false });
  }
  return tables;
}

export function mergeFirestoreTables(baseTables, firestoreMap) {
  return baseTables.map((t) => {
    const remote = firestoreMap[t.id];
    if (!remote) return t;
    const occupied = remote.is_occupied === true && Array.isArray(remote.items) && remote.items.length > 0;
    return {
      ...t,
      hasOrder: occupied,
      orderTotal: occupied ? (Number(remote.total_amount) || 0) : null,
      name: remote.table_name || t.name,
    };
  });
}
