// Tek seferlik: Ortak (sadece Suriçi) hesabına yeni şifre verir. Fatih'e dokunmaz.
const NEW_PIN = 'Suri2026';
const PROJECTS = [
  ['makara-16344', 'AIzaSyCdf-c13e0wCafRYHXhIls1epJgD1RjPUA'],
];
const S = (v) => ({ stringValue: v });
const out = [];
for (const [pid, key] of PROJECTS) {
  const url = `https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/admin/pin`;
  try {
    const r = await fetch(`${url}?key=${key}`);
    const doc = r.ok ? await r.json() : null;
    if (!r.ok && r.status !== 404) { out.push(`${pid}: okuma HATA ${r.status} ${await r.text()}`); continue; }
    const f = doc?.fields || {};
    let users = (f.users?.arrayValue?.values || []).map((v) => {
      const m = v.mapValue?.fields || {};
      return {
        username: m.username?.stringValue || '',
        pin: m.pin?.stringValue || '',
        allowedBranches: (m.allowedBranches?.arrayValue?.values || []).map((x) => x.stringValue),
      };
    });
    if (!users.length) {
      const pw = (f.passwords?.arrayValue?.values || []).map((x) => x.stringValue);
      users = pw.map((p, i) => ({ username: i === 0 ? 'Fatih' : i === 1 ? 'Ortak' : `Kullanici ${i + 1}`, pin: p, allowedBranches: i === 0 ? ['makara','makarasur'] : ['makarasur'] }));
    }
    if (users.some((u) => u.pin === NEW_PIN && u.username.trim().toLowerCase() !== 'ortak')) { out.push(`${pid}: yeni şifre başka kullanıcıda var, atlandı`); continue; }
    const idx = users.findIndex((u) => u.username.trim().toLowerCase() === 'ortak');
    if (idx >= 0) { users[idx].pin = NEW_PIN; users[idx].allowedBranches = ['makarasur']; }
    else users.push({ username: 'Ortak', pin: NEW_PIN, allowedBranches: ['makarasur'] });
    if (!users.some((u) => u.pin === 'Mfp14531789.')) out.push(`${pid}: UYARI Fatih şifresi listede yok`);
    const body = { fields: {
      users: { arrayValue: { values: users.map((u) => ({ mapValue: { fields: {
        username: S(u.username), pin: S(u.pin),
        allowedBranches: { arrayValue: { values: u.allowedBranches.map(S) } } } } })) } },
      passwords: { arrayValue: { values: users.map((u) => S(u.pin)) } },
      updated_at: { timestampValue: new Date().toISOString() },
    } };
    const w = await fetch(`${url}?key=${key}&updateMask.fieldPaths=users&updateMask.fieldPaths=passwords&updateMask.fieldPaths=updated_at`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    out.push(`${pid}: ${w.ok ? 'TAMAM' : 'yazma HATA ' + w.status + ' ' + (await w.text()).slice(0, 300)} | kullanıcılar: ${users.map((u) => u.username + '[' + u.allowedBranches.join(',') + ']').join(', ')} | ortak ${idx >= 0 ? 'güncellendi' : 'eklendi'}`);
  } catch (e) { out.push(`${pid}: HATA ${e.message}`); }
}
console.log(out.join('\n'));
(await import('node:fs')).writeFileSync('reset-result.txt', out.join('\n') + '\n');
