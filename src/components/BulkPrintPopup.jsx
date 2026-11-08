import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import receiptLogo from '../assets/receipt-logo-bw.svg';

/** Fişin yazıcıdan tamamen çıkması bu kadar sürer (satır satır). */
export const BULK_FEED_MS = 1100;
/** Termal kasa yazıcısında bir adisyonun basılıp kesilmesi (ekrandaki fiş bu sürede çıkar). */
export const BULK_PRINT_MS = 850;
/** Fiş Windows'a teslim edildikten sonra yazıcıdan çıkmaya başlaması (ağ + yazıcı ısınması). */
export const BULK_PRINT_LATENCY_MS = 250;
/** Çıkan fişin koparılıp uçması. */
export const BULK_TEAR_MS = 380;

const money = (x) =>
  '₺' + (Number(x) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function MiniReceipt({ job }) {
  return (
    <div className="bpp-rc">
      <div className="bpp-br">
        <img src={receiptLogo} alt="" />
        <div>
          <b>MAKARA</b>
          <span>ADİSYON</span>
        </div>
      </div>
      <div className="bpp-tn">{job.name}</div>
      <div className="bpp-dt">{job.date} · {job.time}</div>
      <hr />
      {job.items.map((it, i) => (
        <div key={i} className="bpp-it">
          <span>{it.quantity}× {it.name}</span>
          <span>{it.isGift ? 'İkram' : money((Number(it.price) || 0) * (Number(it.quantity) || 0))}</span>
        </div>
      ))}
      <div className="bpp-tot">
        <b>TOPLAM</b>
        <span>{money(job.total)}</span>
      </div>
      <div className="bpp-af">Afiyet olsun</div>
    </div>
  );
}

/**
 * Yazıcıdan çıkan fiş, gerçek baskıya bağlı:
 * - job.feedFrom: yazıcıya veri gitmeye başladığı an → fiş satır satır çıkmaya başlar,
 *   hız job.estimateMs'e (önceki fişlerin ölçülen süresi) göre ayarlanır, %88'de bekler.
 * - job.doneAt: kasa "yazıcı fişi aldı" dediği an → kalan kısım hızla çıkar, sonra koparılır.
 */
function Paper({ job }) {
  const wrapRef = useRef(null);
  const rcRef = useRef(null);
  const [torn, setTorn] = useState(false);
  const jobRef = useRef(job);
  jobRef.current = job;

  useEffect(() => {
    let raf;
    let doneFrac = null;
    let tornSet = false;
    const tick = () => {
      const j = jobRef.current;
      const H = rcRef.current?.offsetHeight || 0;
      const now = performance.now();
      let f = 0;
      if (j.feedFrom != null) {
        const e = Math.max(400, j.estimateMs || BULK_FEED_MS);
        const x = Math.min(1, (now - j.feedFrom) / e);
        f = 0.88 * (1 - Math.pow(1 - x, 1.6));
      }
      if (j.doneAt != null) {
        if (doneFrac == null) doneFrac = f;
        const k = Math.min(1, (now - j.doneAt) / 220);
        f = doneFrac + (1 - doneFrac) * k;
        if (k >= 1 && !tornSet) {
          tornSet = true;
          setTimeout(() => setTorn(true), 120);
        }
      }
      const h = f >= 1 ? H : Math.floor((f * H) / 7) * 7;
      if (wrapRef.current) wrapRef.current.style.height = `${h}px`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`bpp-paper${torn ? ' is-torn' : ''}`}
      style={{ height: 0, transition: `transform ${BULK_TEAR_MS}ms cubic-bezier(.65,0,.35,1), opacity ${BULK_TEAR_MS}ms cubic-bezier(.65,0,.35,1)` }}
    >
      <div ref={rcRef}><MiniReceipt job={job} /></div>
    </div>
  );
}

const PrinterArt = ({ printing }) => (
  <svg viewBox="0 0 300 216" aria-hidden>
    <defs>
      <linearGradient id="bpp-gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#43444a" /><stop offset=".55" stopColor="#2b2c31" /><stop offset="1" stopColor="#1c1d21" /></linearGradient>
      <linearGradient id="bpp-gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3d3e44" /><stop offset="1" stopColor="#2a2b30" /></linearGradient>
      <linearGradient id="bpp-gs" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#111215" /><stop offset=".5" stopColor="#1d1e22" /><stop offset="1" stopColor="#111215" /></linearGradient>
      <filter id="bpp-led"><feGaussianBlur stdDeviation="2.2" /></filter>
    </defs>
    <ellipse cx="150" cy="210" rx="128" ry="7" fill="#0f172a" opacity=".22" />
    <path d="M14 70 Q14 34 50 30 L250 30 Q286 34 286 70 L286 176 Q286 206 256 206 L44 206 Q14 206 14 176 Z" fill="url(#bpp-gb)" />
    <path d="M14 150 L286 150 L286 176 Q286 206 256 206 L44 206 Q14 206 14 176 Z" fill="#232428" />
    <path d="M14 150 L286 150" stroke="#16171a" strokeWidth="1.5" />
    <path d="M44 22 Q44 6 64 6 L236 6 Q256 6 256 22 L258 118 Q258 134 240 134 L60 134 Q42 134 42 118 Z" fill="url(#bpp-gl)" stroke="#4b4c52" strokeWidth="1.2" />
    <rect x="54" y="18" width="192" height="26" rx="4" fill="#0a0a0c" />
    <rect x="58" y="22" width="184" height="18" rx="3" fill="url(#bpp-gs)" />
    <path d="M60 40 h180" stroke="#3a3b40" strokeWidth="2" strokeDasharray="1.5 1.5" />
    <rect x="72" y="62" width="156" height="26" rx="8" fill="#0f1012" stroke="#2c2d31" />
    <g fill="#e5e7eb" opacity=".85">
      <rect x="88" y="69" width="16" height="11" rx="2" />
      <path d="M108 70 l6 6 m0 -6 l-6 6" stroke="#e5e7eb" strokeWidth="2" />
      <rect x="140" y="70" width="12" height="9" rx="1.5" />
      <path d="M156 76 l5 3 l-2 -5z" />
      <rect x="190" y="69" width="18" height="11" rx="2" />
      <path d="M200 82 l8 4" stroke="#e5e7eb" strokeWidth="2" />
    </g>
    <path d="M78 64 L130 64 L118 86 L74 86 Z" fill="#fff" opacity=".06" />
    <rect x="135" y="128" width="30" height="13" rx="3" fill="#3c3d42" stroke="#202125" />
    <rect x="137" y="142" width="26" height="8" rx="2" fill="#2d2e33" />
    <rect x="18" y="62" width="20" height="58" rx="7" fill="#26272b" stroke="#33343a" />
    <g className={printing ? 'bpp-led-blink' : ''}>
      <rect x="20" y="50" width="16" height="6" rx="3" fill="#3b82f6" />
      <rect x="18" y="47" width="20" height="12" rx="6" fill="#3b82f6" filter="url(#bpp-led)" opacity=".8" />
    </g>
    <rect x="128" y="176" width="44" height="22" rx="3" fill="#0c0c0e" />
    <rect x="133" y="180" width="34" height="14" rx="2" fill="#1e1f22" />
    <circle cx="143" cy="187" r="2.6" fill="none" stroke="#9ca3af" strokeWidth="1" />
    <path d="M157 183 v8" stroke="#9ca3af" strokeWidth="1.2" />
    <path d="M30 40 Q60 30 120 30" stroke="#fff" strokeOpacity=".08" strokeWidth="2" fill="none" />
  </svg>
);

const CSS = `
.bpp-pop{position:fixed;top:50%;right:28px;z-index:1300;width:390px;height:min(700px,calc(100vh - 32px));transform:translateY(-50%);border-radius:28px;
  background:linear-gradient(180deg,#fff,#f6f7fb);box-shadow:0 40px 90px -20px rgba(15,23,42,.45),0 0 0 1px rgba(15,23,42,.06);overflow:hidden;
  animation:bpp-in .45s cubic-bezier(.16,1,.3,1) both;font-family:Inter,'Segoe UI',system-ui,sans-serif}
.bpp-pop.is-leaving{animation:bpp-out .45s cubic-bezier(.76,0,.24,1) both}
@keyframes bpp-in{from{transform:translate(440px,-50%);opacity:0}to{transform:translate(0,-50%);opacity:1}}
@keyframes bpp-out{to{transform:translate(440px,-50%);opacity:0}}
.bpp-hd{position:absolute;left:24px;right:24px;top:22px}
.bpp-hd .k{font-size:11px;font-weight:800;letter-spacing:.2em;color:#94a3b8;text-transform:uppercase}
.bpp-hd .t{font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-.02em;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bpp-hd .s{font-size:13px;font-weight:600;color:#64748b;margin-top:2px}
.bpp-bar{position:absolute;left:24px;right:24px;top:104px;height:6px;border-radius:9px;background:#e2e8f0;overflow:hidden}
.bpp-bar i{display:block;height:100%;border-radius:9px;background:linear-gradient(90deg,#e5398f,#7c5cf6);transition:width .4s ease}
.bpp-ft{position:absolute;left:24px;right:24px;top:118px;display:flex;flex-wrap:wrap;gap:6px;max-height:54px;overflow:hidden;align-content:flex-start}
.bpp-chip{font-size:10.5px;font-weight:800;border-radius:99px;padding:4px 8px;white-space:nowrap;flex:none;animation:bpp-chip .3s ease both}
.bpp-chip.ok{color:#0f766e;background:#ccfbf1}.bpp-chip.err{color:#b91c1c;background:#fee2e2}
@keyframes bpp-chip{from{transform:scale(.7);opacity:0}}
.bpp-stage{position:absolute;left:0;right:0;top:176px;bottom:213px;overflow:hidden;z-index:2}
.bpp-paper{position:absolute;left:50%;bottom:0;width:190px;margin-left:-95px;overflow:hidden;transform-origin:50% 100%}\n.bpp-paper>div{position:absolute;left:0;top:0;width:190px}
.bpp-paper.is-torn{transform:translate(150px,-60px) rotate(14deg) scale(.65);opacity:0}
.bpp-printer{position:absolute;left:50%;bottom:10px;width:340px;height:238px;margin-left:-170px;z-index:1}
.bpp-printer svg{width:100%;height:100%;overflow:visible}
.bpp-led-blink{animation:bpp-led .22s steps(2) infinite}
@keyframes bpp-led{50%{opacity:.3}}
.bpp-rc{position:relative;width:190px;background:#fff;padding:14px 14px 18px;color:#000;box-shadow:0 4px 14px rgba(15,23,42,.16)}
.bpp-rc *{color:#000}
.bpp-br{display:flex;align-items:center;justify-content:center;gap:6px}
.bpp-br img{width:30px;height:30px}.bpp-br b{display:block;font-size:11px;font-weight:900;letter-spacing:2px;line-height:1}.bpp-br span{display:block;font-size:7px;font-weight:700;letter-spacing:1.5px;margin-top:2px}
.bpp-tn{text-align:center;font-size:19px;font-weight:900;letter-spacing:-.4px;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bpp-dt{text-align:center;font-size:8px;font-weight:600;margin-top:2px}
.bpp-rc hr{border:0;border-top:1px solid #000;margin:7px 0 4px}
.bpp-it{display:flex;justify-content:space-between;gap:6px;font-size:10px;font-weight:700;padding-top:3px}
.bpp-it span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bpp-it span:last-child{font-weight:800;white-space:nowrap}
.bpp-tot{display:flex;justify-content:space-between;align-items:center;background:#000;border-radius:5px;padding:5px 7px;margin-top:7px}
.bpp-tot *{color:#fff!important}.bpp-tot b{font-size:8px;letter-spacing:1.5px}.bpp-tot span{font-size:14px;font-weight:900}
.bpp-af{text-align:center;font-size:8px;font-weight:600;margin-top:7px}
.bpp-done{position:absolute;left:0;right:0;top:220px;text-align:center;z-index:3;animation:bpp-pop .4s cubic-bezier(.16,1,.3,1) both}
@keyframes bpp-pop{from{transform:scale(.85);opacity:0}}
.bpp-done .c{width:66px;height:66px;margin:0 auto;border-radius:50%;display:grid;place-items:center}
.bpp-done p{font-size:18px;font-weight:900;color:#0f172a;margin-top:14px}.bpp-done span{font-size:13px;font-weight:600;color:#64748b}
`;

/**
 * Gün sonu adisyonları yazdırılırken sağda açılan yazıcı penceresi.
 * state: { jobs: [{ key, name, date, time, items, total, status: 'waiting'|'printing'|'done'|'failed' }], finished }
 */
export default function BulkPrintPopup({ state, onClosed }) {
  const [leaving, setLeaving] = useState(false);
  const { jobs, finished } = state;
  const okCount = jobs.filter((j) => j.status === 'done').length;
  const failCount = jobs.filter((j) => j.status === 'failed').length;
  const settled = okCount + failCount;
  const current = jobs.find((j) => j.status === 'printing');
  const printing = !!current;

  useEffect(() => {
    if (!finished) return undefined;
    const t1 = setTimeout(() => setLeaving(true), 2200);
    const t2 = setTimeout(() => onClosed?.(), 2700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [finished, onClosed]);

  return createPortal(
    <div className={`bpp-pop${leaving ? ' is-leaving' : ''}`} role="status" aria-live="polite">
      <style>{CSS}</style>
      <div className="bpp-hd">
        <div className="k">Gün sonu adisyonları</div>
        <div className="t">{finished ? 'Tamamlandı' : current ? `${current.name} yazdırılıyor` : 'Hazırlanıyor…'}</div>
        <div className="s">{finished ? `${settled} / ${jobs.length}` : `${Math.min(settled + 1, jobs.length)} / ${jobs.length} adisyon`}</div>
      </div>
      <div className="bpp-bar"><i style={{ width: `${jobs.length ? (settled / jobs.length) * 100 : 0}%` }} /></div>
      <div className="bpp-ft">
        {jobs.filter((j) => j.status === 'done' || j.status === 'failed').map((j) => (
          <span key={j.key} className={`bpp-chip ${j.status === 'done' ? 'ok' : 'err'}`}>{j.status === 'done' ? '✓' : '✗'} {j.name}</span>
        ))}
      </div>
      <div className="bpp-stage">
        {jobs.filter((j) => j.status !== 'waiting').map((j) => (j.hidden ? null : <Paper key={j.key} job={j} />))}
      </div>
      {finished && (
        <div className="bpp-done">
          <div className="c" style={{ background: failCount ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 14px 30px -10px rgba(5,150,105,.6)' }}>
            <svg width="34" height="34" fill="none" stroke="#fff" strokeWidth="3" viewBox="0 0 24 24">
              {failCount
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5m0 4h.01" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />}
            </svg>
          </div>
          <p>{okCount} adisyon yazdırıldı</p>
          <span>{failCount ? `${failCount} masa yazdırılamadı` : 'Hepsi kasa yazıcısından çıktı'}</span>
        </div>
      )}
      <div className="bpp-printer"><PrinterArt printing={printing} /></div>
    </div>,
    document.body
  );
}
