export const BRANCHES = {
  makara: {
    key: 'makara',
    label: 'Havzan',
    sales: {
      apiKey: 'AIzaSyCdf-c13e0wCafRYHXhIls1epJgD1RjPUA',
      authDomain: 'makara-16344.firebaseapp.com',
      projectId: 'makara-16344',
      appId: '1:216769654742:web:16792742d4613f4269be77'
    },
    tables: {
      apiKey: 'AIzaSyDu_NUrgas4wZ_wdfAYE-DgxqTpb7vKxyo',
      authDomain: 'makaramasalar.firebaseapp.com',
      projectId: 'makaramasalar',
      appId: '1:840151572206:web:0afaf93deea636309e5dff'
    },
    online: {
      apiKey: 'AIzaSyAucyGoXwmQ5nrQLfk5zL5-73ir7u9vbI8',
      authDomain: 'makaraonline-5464e.firebaseapp.com',
      projectId: 'makaraonline-5464e',
      appId: '1:1041589485836:web:06119973a19da0a14f0929'
    }
  },
  makarasur: {
    key: 'makarasur',
    label: 'Suriçi',
    sales: {
      apiKey: 'AIzaSyDnVpG-Hl7n2a1esMO4rZhq9JfqpKd3VUo',
      authDomain: 'makarasurici.firebaseapp.com',
      projectId: 'makarasurici',
      appId: '1:237735301273:web:bf62c8f145434df0292808'
    },
    tables: null,
    online: null
  },
  sultansomati: {
    key: 'sultansomati',
    label: 'Sultan Somatı',
    sales: {
      apiKey: 'AIzaSyB_sSvCgbWC4HYKufueqfoDmbBS4SHlUnA',
      authDomain: 'sultansomati-5a3e9.firebaseapp.com',
      projectId: 'sultansomati-5a3e9',
      appId: '1:166037373406:web:ed1c3724085446ae0d1d4f'
    },
    tables: null,
    online: null
  }
};

export const FORCED_PIN = {
  'Mfp14531789.': ['makara', 'makarasur', 'sultansomati'],
  '102030': ['makarasur']
};

export const FORCED_USER = {
  fatih: ['makara', 'makarasur'],
  ortak: ['makarasur']
};

export function normalizeUser(user, pin) {
  const username = user?.username || 'Kullanıcı';
  const nameKey = username.trim().toLowerCase();
  const forced = FORCED_PIN[String(pin || user?.pin || '').trim()] || FORCED_USER[nameKey];
  let branches = forced || (Array.isArray(user?.allowedBranches) && user.allowedBranches.length
    ? [...user.allowedBranches]
    : ['makara']);
  const unlockSultan = pin === 'Mfp14531789.' || (branches.includes('sultansomati') && nameKey !== 'ortak');
  if (nameKey === 'ortak') branches = branches.filter((b) => b !== 'sultansomati');
  if (unlockSultan && !branches.includes('sultansomati')) branches.push('sultansomati');
  if (!unlockSultan) branches = branches.filter((b) => b !== 'sultansomati');
  return { username, allowedBranches: branches, unlockSultanPatron: unlockSultan };
}
