import React, { useState } from 'react';
import { createPortal } from 'react-dom';

export const SUPPORT_NOTICE_STORAGE_KEY = 'makara_pos_support_notice_suppress';

export function shouldShowSupportNotice() {
  try {
    return localStorage.getItem(SUPPORT_NOTICE_STORAGE_KEY) !== '1';
  } catch {
    return true;
  }
}

const fontUi = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
const fontSignature = '"Georgia", "Times New Roman", serif';

/**
 * İş ortakları duyurusu — beyaz ağırlıklı, mor gradient vurgular, kaydırmasız.
 */
export default function SupportNoticeModal({ open, onClose }) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!open) return null;

  const handleConfirm = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem(SUPPORT_NOTICE_STORAGE_KEY, '1');
      } catch (_) {}
    }
    setDontShowAgain(false);
    onClose?.();
  };

  /** Beyaz kart üzerinde zarif mor çerçeveli rozetler */
  const badgeBase =
    'flex w-full max-w-[260px] items-center justify-center rounded-2xl border border-violet-200/90 bg-gradient-to-b from-white to-violet-50/50 py-[7px] px-4 text-[12px] font-bold tracking-wide text-violet-800 shadow-[0_8px_32px_-12px_rgba(139,92,246,0.25),inset_0_1px_0_rgba(255,255,255,1)] mx-auto ring-1 ring-violet-100/80';

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483646] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-notice-title"
      style={{ fontFamily: fontUi }}
    >
      <div
        className="absolute inset-0 bg-gradient-to-br from-violet-950/[0.15] via-white/10 to-purple-950/[0.18] backdrop-blur-[18px]"
        aria-hidden
      />
      <style>{`
        @keyframes modalUp {
          from { opacity: 0; transform: translateY(14px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (max-height: 620px) {
          .support-notice-compact { padding-top: 0.625rem !important; padding-bottom: 0.5rem !important; padding-left: 1rem !important; padding-right: 1rem !important; }
          .support-notice-compact .support-gap { margin-top: 0.25rem !important; gap: 0.25rem !important; }
        }
      `}</style>

      <div
        className="relative flex max-h-[calc(100dvh-16px)] w-[min(480px,calc(100vw-16px))] flex-col overflow-hidden rounded-[26px] border border-white bg-gradient-to-b from-white via-white to-violet-50/30 shadow-[0_40px_100px_-28px_rgba(91,33,182,0.18),0_0_0_1px_rgba(255,255,255,1)_inset,0_1px_0_rgba(255,255,255,0.95)_inset]"
        style={{ animation: 'modalUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
      >
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-gradient-to-br from-violet-200/35 to-purple-100/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-gradient-to-tr from-fuchsia-100/30 to-violet-100/20 blur-3xl" />

        <div className="pointer-events-none relative h-[3px] shrink-0 bg-gradient-to-r from-transparent via-violet-300/70 to-transparent" />
        <div className="pointer-events-none relative h-px shrink-0 bg-gradient-to-r from-violet-100/40 via-purple-200/50 to-violet-100/40" />

        <div className="support-notice-compact relative flex min-h-0 flex-1 flex-col px-5 pb-4 pt-5 sm:px-7 sm:pb-5 sm:pt-6">
          <p className="text-[9px] font-semibold uppercase tracking-[0.32em] text-violet-400">Duyuru</p>
          <h2
            id="support-notice-title"
            className="mt-1 bg-gradient-to-r from-violet-950 via-purple-900 to-violet-950 bg-clip-text text-[clamp(15px,4vw,18px)] font-semibold leading-tight tracking-tight text-transparent"
          >
            Değerli iş ortaklarımız,
          </h2>

          <p className="mt-3 text-[clamp(11px,2.8vw,13px)] leading-snug text-slate-500">
            Artan müşteri yoğunluğu ve hizmet kalitesini sürdürülebilir kılmak adına teknik destek süreçlerimiz güncellenmiştir:
          </p>

          <div className="mt-3 flex flex-col gap-2 support-gap">
            <div className="flex flex-col gap-1">
              <p className="text-center text-[10px] font-medium leading-tight text-violet-900/55 sm:text-[11px]">
                Kullanıcı kaynaklı sorunlarda yerinde destek
              </p>
              <span className={badgeBase}>1000 TL</span>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-center text-[10px] font-medium leading-tight text-violet-900/55 sm:text-[11px]">
                Yazılım kaynaklı hatalar
              </p>
              <span className={badgeBase}>Ücretsiz</span>
              <p className="text-center text-[9px] text-violet-900/40 sm:text-[10px]">olarak giderilmektedir</p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-center text-[10px] font-medium leading-tight text-violet-900/55 sm:text-[11px]">
                Ek geliştirme ve özel güncellemeler
              </p>
              <span className={`${badgeBase} py-2 text-[11px] sm:text-[12px]`}>1.500 TL – 5.000 TL</span>
              <p className="text-center text-[9px] text-violet-900/40 sm:text-[10px]">
                Talep ve kapsam doğrultusunda
              </p>
            </div>
          </div>

          <p className="mt-3 rounded-2xl border border-violet-100/90 bg-white/90 px-3 py-2 text-[10px] leading-snug text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,1)] backdrop-blur-sm sm:text-[11px]">
            20&apos;ye yakın aktif işletmeye hizmet verdiğimiz için tüm destek talepleri planlı ve bu çerçevede değerlendirilecektir.
          </p>

          <p className="mt-2 text-[10px] leading-snug text-slate-500 sm:text-[11px]">
            Bilginize sunar, anlayışınız için teşekkür ederiz.
          </p>

          <div className="relative mt-3 overflow-hidden rounded-2xl border border-violet-100/90 bg-gradient-to-br from-white via-violet-50/40 to-purple-50/30 px-4 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,1)]">
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/50 to-transparent" />
            <p
              className="text-[13px] italic tracking-wide text-violet-950/85 sm:text-[14px]"
              style={{ fontFamily: fontSignature }}
            >
              Emirhan Erol
            </p>
            <div className="mx-auto mt-2 flex items-center justify-center gap-2">
              <span className="h-px w-8 bg-gradient-to-r from-transparent to-violet-300/70" aria-hidden />
              <span className="bg-gradient-to-r from-violet-700 via-purple-700 to-violet-800 bg-clip-text text-[10px] font-bold uppercase tracking-[0.32em] text-transparent sm:text-[11px]">
                Droje Systems
              </span>
              <span className="h-px w-8 bg-gradient-to-l from-transparent to-violet-300/70" aria-hidden />
            </div>
          </div>

          <div className="mt-auto flex shrink-0 flex-col gap-2.5 border-t border-violet-100/90 pt-3">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-2xl border border-violet-100/90 bg-white/80 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,1)] transition hover:border-violet-200 hover:bg-white">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 shrink-0 rounded border-violet-300 text-violet-600 focus:ring-violet-400/50"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
              />
              <span className="text-left text-[10px] leading-tight text-violet-950/70 sm:text-[11px]">
                Bu mesajı bir daha gösterme
                <span className="mt-0.5 block text-[9px] text-violet-900/45">Bu cihazda tekrar gösterilmez.</span>
              </span>
            </label>
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-violet-700 py-2.5 text-[13px] font-semibold tracking-wide text-white shadow-[0_16px_36px_-12px_rgba(109,40,217,0.45)] ring-1 ring-white/20 transition hover:brightness-[1.06] hover:shadow-[0_20px_40px_-12px_rgba(109,40,217,0.5)] active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2"
            >
              Anladım
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
