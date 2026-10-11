import { useEffect, useMemo, useState } from 'react';
import { BRANCHES, normalizeUser } from './lib/branches';
import { loadAdminUsers, loadDayCancels, loadDaySales, openBranch, watchOnline, watchTables } from './lib/firebase';
import { isExpense, staffBreakdown, summarize, tableIsOpen } from './lib/revenue';
import { businessWindow, currentBusinessDate, formatDayLabel, formatTry, inWindow, trStamp } from './lib/time';

const TABS = [
  ['home', 'Özet'],
  ['sales', 'Satış'],
  ['staff', 'Personel'],
  ['tables', 'Masalar'],
  ['more', 'Diğer']
];

function readSession() {
  try {
    const raw = localStorage.getItem('adminRememberMe') === 'true'
      ? localStorage.getItem('adminUser')
      : sessionStorage.getItem('adminUser');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState(() => readSession());
  const [branchKey, setBranchKey] = useState(() => localStorage.getItem('adminActiveBranch') || 'makara');
  const [tab, setTab] = useState('home');
  const [more, setMore] = useState('cancels');
  const [day, setDay] = useState(() => currentBusinessDate());
  const [sales, setSales] = useState([]);
  const [cancels, setCancels] = useState([]);
  const [tables, setTables] = useState([]);
  const [online, setOnline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const dayKey = day.getTime();
  const todayKey = currentBusinessDate().getTime();
  const windowRange = useMemo(() => businessWindow(day), [dayKey]);

  useEffect(() => {
    if (!user) return undefined;
    const allowed = user.allowedBranches || [];
    const key = allowed.includes(branchKey) ? branchKey : allowed[0] || 'makara';
    if (key !== branchKey) {
      setBranchKey(key);
      return undefined;
    }
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const dateStrings = [...trStamp(day), ...trStamp(next)];
    const { salesDb, tablesDb, onlineDb } = openBranch(key);
    let stopTables = () => {};
    let stopOnline = () => {};
    let alive = true;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const [saleRows, cancelRows] = await Promise.all([
          loadDaySales(salesDb, dateStrings),
          loadDayCancels(salesDb, dateStrings)
        ]);
        if (!alive) return;
        setSales(saleRows);
        setCancels(cancelRows);
      } catch (err) {
        if (alive) setError(err.message || 'Veri alınamadı');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    stopTables = watchTables(tablesDb, setTables);
    stopOnline = watchOnline(onlineDb, setOnline);
    return () => {
      alive = false;
      stopTables();
      stopOnline();
    };
  }, [user, branchKey, dayKey]);

  const daySales = useMemo(
    () => sales.filter((sale) => !isExpense(sale) && inWindow(sale.sale_date, sale.sale_time, windowRange)),
    [sales, windowRange.start.getTime()]
  );
  const dayCancels = useMemo(
    () => cancels.filter((row) => inWindow(row.cancel_date, row.cancel_time, windowRange)),
    [cancels, windowRange.start.getTime()]
  );
  const money = useMemo(() => summarize(daySales), [daySales]);
  const staff = useMemo(() => staffBreakdown(daySales), [daySales]);
  const openTables = useMemo(() => tables.filter(tableIsOpen), [tables]);
  const openTotal = openTables.reduce((sum, table) => sum + parseFloat(table.total_amount || 0), 0);

  function shiftDay(delta) {
    setDay((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta);
      if (next.getTime() > todayKey) return new Date(todayKey);
      return next;
    });
  }

  function logout() {
    localStorage.removeItem('adminRememberMe');
    localStorage.removeItem('adminAuthenticated');
    localStorage.removeItem('adminUser');
    sessionStorage.removeItem('adminAuthenticated');
    sessionStorage.removeItem('adminUser');
    setUser(null);
  }

  if (!user) {
    return <Login initialBranch={branchKey} onSuccess={(nextUser, key) => { setBranchKey(key); setUser(nextUser); }} />;
  }

  const branch = BRANCHES[branchKey] || BRANCHES.makara;

  return (
    <div className="shell">
      <header className="top">
        <div>
          <p className="brand-mark">Makara · {user.username}</p>
          <h2>{branch.label}</h2>
          <div className="day-nav">
            <button type="button" className="chip" onClick={() => shiftDay(-1)}>Önceki gün</button>
            <span>{formatDayLabel(day)}</span>
            <button type="button" className="chip" onClick={() => shiftDay(1)} disabled={dayKey >= todayKey}>Sonraki</button>
            {dayKey < todayKey ? <button type="button" className="chip active" onClick={() => setDay(new Date(todayKey))}>Bugün</button> : null}
          </div>
        </div>
        <div>
          <div className="branches">
            {(user.allowedBranches || []).map((key) => (
              <button
                key={key}
                className={`chip ${key === branchKey ? 'active' : ''}`}
                onClick={() => { localStorage.setItem('adminActiveBranch', key); setBranchKey(key); }}
              >
                {BRANCHES[key]?.label || key}
              </button>
            ))}
          </div>
          <button className="logout" onClick={logout}>Çıkış</button>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">İş günü yükleniyor…</p> : null}

      {tab === 'home' && (
        <Home money={money} openTotal={openTotal} openCount={openTables.length} label={formatDayLabel(day)} sales={daySales} />
      )}
      {tab === 'sales' && <SalesList sales={daySales} />}
      {tab === 'staff' && <StaffList rows={staff} total={money.total} />}
      {tab === 'tables' && <TablesList tables={openTables} allCount={tables.length} />}
      {tab === 'more' && (
        <More
          mode={more}
          setMode={setMore}
          cancels={dayCancels}
          online={online}
        />
      )}

      <nav className="nav">
        {TABS.map(([id, label]) => (
          <button key={id} className={`nav-btn ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Login({ initialBranch, onSuccess }) {
  const [pin, setPin] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { salesDb } = openBranch(initialBranch || 'makara');
      const users = await loadAdminUsers(salesDb);
      const found = users.find((u) => String(u.pin || '').trim() === pin.trim());
      if (!found) {
        setError('Şifre eşleşmedi.');
        return;
      }
      const nextUser = normalizeUser(found, pin.trim());
      const key = nextUser.allowedBranches.includes(initialBranch) ? initialBranch : nextUser.allowedBranches[0];
      sessionStorage.setItem('adminAuthenticated', 'true');
      sessionStorage.setItem('adminUser', JSON.stringify(nextUser));
      if (remember) {
        localStorage.setItem('adminRememberMe', 'true');
        localStorage.setItem('adminAuthenticated', 'true');
        localStorage.setItem('adminUser', JSON.stringify(nextUser));
      }
      localStorage.setItem('adminActiveBranch', key);
      onSuccess(nextUser, key);
    } catch (err) {
      setError(err.message || 'Giriş yapılamadı');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <p className="eyebrow">Patron</p>
        <h1>Makara</h1>
        <p className="lead">İş gününün tahsilatı, masalar ve personel. Aynı panel, sade ekran.</p>
        <input
          className="pin"
          type="password"
          inputMode="text"
          autoComplete="current-password"
          placeholder="Şifre"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
        <div className="row">
          <label className="check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Bu telefonda kalsın
          </label>
          <button className="primary" type="submit" disabled={busy || !pin.trim()}>
            {busy ? '…' : 'Giriş'}
          </button>
        </div>
        <p className="error">{error}</p>
      </form>
    </main>
  );
}

function Home({ money, openTotal, openCount, label, sales }) {
  return (
    <>
      <section className="hero">
        <p className="hero-kicker">{label} · 03:00’ten 03:00’e</p>
        <div className="hero-amount">{formatTry(money.total)}</div>
        <p className="hero-note">Tahsil edilen. Kasa sayımı bu rakamla kıyaslanır. {money.count} fiş.</p>
        <div className="bar" aria-hidden>
          <span className="cash" style={{ flex: Math.max(money.cash, 0) }} />
          <span className="card" style={{ flex: Math.max(money.card, 0) }} />
          <span className="online" style={{ flex: Math.max(money.online, 0) }} />
        </div>
        <div className="pay-grid">
          <div className="pay"><small>Nakit</small><strong>{formatTry(money.cash)}</strong></div>
          <div className="pay"><small>Kart</small><strong>{formatTry(money.card)}</strong></div>
          <div className="pay"><small>Online</small><strong>{formatTry(money.online)}</strong></div>
        </div>
      </section>
      <div className="split">
        <section className="panel">
          <h3>Açık masalar</h3>
          <p className="hero-amount" style={{ fontSize: 36 }}>{formatTry(openTotal)}</p>
          <p className="hero-note">{openCount} masa henüz kapanmadı. Bu tutar kasada yoktur.</p>
        </section>
        <section className="panel">
          <h3>Son fişler</h3>
          <div className="list">
            {sales.slice().reverse().slice(0, 4).map((sale) => (
              <SaleRow key={sale.id} sale={sale} />
            ))}
            {!sales.length ? <p className="empty">Bu iş gününde fiş yok.</p> : null}
          </div>
        </section>
      </div>
    </>
  );
}

function SalesList({ sales }) {
  const ordered = sales.slice().sort((a, b) => String(b.sale_time).localeCompare(String(a.sale_time)));
  return (
    <section>
      <h2 className="section-title">Satışlar</h2>
      <p className="muted">Her satır bir tahsilattır. Bölünmüş ödeme ayrı fiş olarak durur, tutar bir kez sayılır.</p>
      <div className="panel" style={{ marginTop: 14 }}>
        {ordered.map((sale) => <SaleRow key={sale.id} sale={sale} />)}
        {!ordered.length ? <p className="empty">Kayıt yok.</p> : null}
      </div>
    </section>
  );
}

function SaleRow({ sale }) {
  const bucket = sale.payment_method === 'Nakit' ? 'cash' : (String(sale.payment_method || '').includes('Online') ? 'online' : '');
  return (
    <div className="item">
      <div>
        <b>{sale.table_name || 'Satış'}</b>
        <div className="meta">{sale.sale_time || ''} · {sale.staff_name || 'Personel yok'}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <b>{formatTry(sale.total_amount)}</b>
        <div><span className={`tag ${bucket}`}>{sale.payment_method || 'Ödeme'}</span></div>
      </div>
    </div>
  );
}

function StaffList({ rows, total }) {
  return (
    <section>
      <h2 className="section-title">Personel</h2>
      <p className="muted">Paylar fiş tutarına göre. Toplam tahsilat {formatTry(total)}.</p>
      <div className="panel" style={{ marginTop: 14 }}>
        {rows.map((row) => (
          <div className="staff-row" key={row.name}>
            <b>{row.name}</b>
            <b>{formatTry(row.total)}</b>
          </div>
        ))}
        {!rows.length ? <p className="empty">Personel cirosu yok.</p> : null}
      </div>
    </section>
  );
}

function TablesList({ tables, allCount }) {
  return (
    <section>
      <h2 className="section-title">Masalar</h2>
      <p className="muted">{tables.length} dolu · {allCount} kayıt</p>
      <div className="grid-tables" style={{ marginTop: 14 }}>
        {tables.map((table) => (
          <article className="table-card open" key={table.id}>
            <b>{table.table_name || table.id}</b>
            <div className="meta">{formatTry(table.total_amount)}</div>
            <div className="meta">{table.order_time || ''}</div>
          </article>
        ))}
      </div>
      {!tables.length ? <p className="empty">Açık masa yok.</p> : null}
    </section>
  );
}

function More({ mode, setMode, cancels, online }) {
  return (
    <section>
      <h2 className="section-title">Diğer</h2>
      <div className="branches" style={{ margin: '12px 0' }}>
        <button className={`chip ${mode === 'cancels' ? 'active' : ''}`} onClick={() => setMode('cancels')}>İptaller</button>
        <button className={`chip ${mode === 'online' ? 'active' : ''}`} onClick={() => setMode('online')}>Online</button>
      </div>
      {mode === 'cancels' ? (
        <div className="panel">
          {cancels.map((row) => (
            <div className="item" key={row.id}>
              <div>
                <b>{row.table_name || 'Masa'}</b>
                <div className="meta">{row.product_name || (row.is_group ? 'Grup iptal' : 'İptal')} · {row.cancel_reason || ''}</div>
              </div>
              <b>{formatTry(row.total_amount || (row.price || 0) * (row.quantity || 0))}</b>
            </div>
          ))}
          {!cancels.length ? <p className="empty">Bu iş gününde iptal yok.</p> : null}
        </div>
      ) : (
        <div className="panel">
          {online.map((order) => (
            <div className="item" key={order.id}>
              <div>
                <b>{order.name || order.customer_name || 'Müşteri'}</b>
                <div className="meta">{order.phone || order.customer_phone || ''} · {order.address || ''}</div>
              </div>
              <b>{formatTry(order.total || order.total_amount)}</b>
            </div>
          ))}
          {!online.length ? <p className="empty">Bekleyen online sipariş yok.</p> : null}
        </div>
      )}
    </section>
  );
}
