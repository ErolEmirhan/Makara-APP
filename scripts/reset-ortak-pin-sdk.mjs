import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
const NEW_PIN = '102030';
const app = initializeApp({ apiKey: 'AIzaSyCdf-c13e0wCafRYHXhIls1epJgD1RjPUA', authDomain: 'makara-16344.firebaseapp.com', projectId: 'makara-16344', appId: '1:216769654742:web:16792742d4613f4269be77' });
const db = getFirestore(app);
const out = [];
const t = setTimeout(() => { out.push('ZAMAN AŞIMI'); fin(1); }, 90000);
async function fin(code) { clearTimeout(t); (await import('node:fs')).writeFileSync('reset-result.txt', out.join('\n') + '\n'); console.log(out.join('\n')); process.exit(code); }
try {
  const ref = doc(db, 'admin', 'pin');
  const snap = await getDoc(ref);
  const d = snap.exists() ? snap.data() : {};
  let users = Array.isArray(d.users) && d.users.length ? d.users.map(u => ({ username: u.username || '', pin: u.pin || '', allowedBranches: Array.isArray(u.allowedBranches) ? u.allowedBranches : [] })) : [];
  if (!users.length && Array.isArray(d.passwords)) users = d.passwords.map((p, i) => ({ username: i === 0 ? 'Fatih' : i === 1 ? 'Ortak' : `Kullanici ${i + 1}`, pin: p, allowedBranches: i === 0 ? ['makara','makarasur'] : ['makarasur'] }));
  out.push('önce: ' + users.map(u => `${u.username}[${u.allowedBranches.join(',')}]${u.pin===NEW_PIN?'=102030':''}`).join(', '));
  let changed = 0;
  users.forEach(u => { const n = u.username.trim().toLowerCase(); if (n === 'ortak' || n === 'suriçi' || n === 'surici') { u.pin = n === 'ortak' ? NEW_PIN : u.pin; } });
  const idx = users.findIndex(u => u.username.trim().toLowerCase() === 'ortak');
  if (idx >= 0) { users[idx].pin = NEW_PIN; users[idx].allowedBranches = ['makarasur']; changed = 1; }
  else users.push({ username: 'Ortak', pin: NEW_PIN, allowedBranches: ['makarasur'] });
  await setDoc(ref, { users, passwords: users.map(u => u.pin), updated_at: serverTimestamp() }, { merge: true });
  const check = await getDoc(ref);
  const ok = (check.data().users || []).some(u => u.username.toLowerCase() === 'ortak' && u.pin === NEW_PIN);
  out.push(`makara-16344: ${ok ? 'TAMAM' : 'DOĞRULANAMADI'} (ortak ${changed ? 'güncellendi' : 'eklendi'}) | sonra: ` + check.data().users.map(u => `${u.username}[${(u.allowedBranches||[]).join(',')}]`).join(', '));
  fin(0);
} catch (e) { out.push('HATA ' + (e.code || '') + ' ' + e.message); fin(1); }
