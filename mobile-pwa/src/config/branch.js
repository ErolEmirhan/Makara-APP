export const BRANCH_THEMES = {
  makara: {
    key: 'makara',
    name: 'MAKARA',
    subtitle: 'Mobil personel',
    themeColor: '#ffffff',
    loginGradient: 'from-violet-600 via-fuchsia-500 to-pink-500',
    accent: 'from-violet-500 to-fuchsia-500',
    accentSolid: '#7c3aed',
    accentLight: '#f5f3ff',
    accentMuted: '#ede9fe',
    splashBg: 'from-violet-600 via-fuchsia-500 to-pink-500',
    isSultan: false,
    isMakaraHavzan: true,
    useImmersiveSearch: false,
  },
  makarasur: {
    key: 'makarasur',
    name: 'MAKARA Suriçi',
    subtitle: 'Mobil personel',
    themeColor: '#ec4899',
    loginGradient: 'from-pink-500 via-rose-500 to-orange-400',
    accent: 'from-pink-500 to-rose-500',
    accentSolid: '#db2777',
    accentLight: '#fdf2f8',
    accentMuted: '#fce7f3',
    splashBg: 'from-pink-500 via-rose-500 to-orange-400',
    isSultan: false,
    isMakaraHavzan: false,
    useImmersiveSearch: false,
  },
  sultansomati: {
    key: 'sultansomati',
    name: 'Sultan Somatı',
    subtitle: 'Mobil personel',
    themeColor: '#064e3b',
    loginGradient: 'from-emerald-900 via-emerald-800 to-teal-900',
    accent: 'from-emerald-600 to-teal-500',
    accentSolid: '#059669',
    accentLight: '#ecfdf5',
    accentMuted: '#d1fae5',
    splashBg: 'from-emerald-800 via-emerald-700 to-teal-800',
    isSultan: true,
    isMakaraHavzan: false,
    useImmersiveSearch: true,
  },
};

export function getBranchTheme(key) {
  return BRANCH_THEMES[key] || BRANCH_THEMES.makara;
}

export const SESSION_DURATION = 3600000; // 1 saat
export const YAN_URUNLER_CATEGORY_ID = 999999;

export const MAKARA_SURICI_OUTSIDE_NUMBERS = [
  61, 62, 63, 64, 65, 66, 67, 68, 71, 72, 73, 74, 75, 76, 77, 78,
  81, 82, 83, 84, 85, 86, 87, 88,
];

export const SULTAN_TABLE_SECTIONS = [
  { key: 'disari', label: 'Dışarı', count: 4 },
  { key: 'kis-bahcesi', label: 'Kış Bahçesi', count: 14 },
  { key: 'osmanli-odasi', label: 'Osmanlı Odası', count: 8 },
  { key: 'selcuklu-odasi', label: 'Selçuklu Odası', count: 10 },
  { key: 'mevlevi-odasi', label: 'Mevlevi Odası', count: 1 },
  { key: 'ask-odasi', label: 'Aşk Odası', count: 1 },
  { key: 'yapma-odasi', label: 'Yapma Odası', count: 1 },
];

export function hasManagerPermission(staff, branchKey) {
  if (!staff) return false;
  if (branchKey === 'sultansomati') return true;
  return !!staff.is_manager;
}

export function canCancelOrderItem(staff, branchKey) {
  if (!staff) return false;
  if (branchKey === 'sultansomati') return true;
  if (branchKey === 'makara' && staff.is_chef) return true;
  if (staff.is_manager) return true;
  return false;
}

export function canTransferTable(staff) {
  return !!staff;
}

export function canMergeTable(staff, branchKey) {
  return hasManagerPermission(staff, branchKey);
}
