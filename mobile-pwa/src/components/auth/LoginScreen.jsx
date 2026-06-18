import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { ChangePasswordModal } from '../modals/ChangePasswordModal';

const LOGO_SRC = `${import.meta.env.BASE_URL}logo.png`;

function BrandLogo({ accent, accentLight }) {
  return (
    <div className="relative mx-auto w-fit">
      <div
        className="absolute inset-0 rounded-full blur-2xl opacity-25 scale-[1.4]"
        style={{ background: accent }}
      />
      <div
        className="relative flex items-center justify-center w-[172px] h-[172px] rounded-full shadow-[0_20px_48px_-20px_rgba(15,23,42,0.2)]"
        style={{ backgroundColor: accentLight }}
      >
        <img
          src={LOGO_SRC}
          alt="MAKARA"
          width={116}
          height={116}
          className="w-[116px] h-[116px] object-contain"
          draggable={false}
        />
      </div>
    </div>
  );
}

export function LoginScreen() {
  const { login, loginError, loggingIn } = useAuth();
  const { theme } = useBranch();
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);

  const accent = theme.accentSolid;
  const accentLight = theme.accentLight || '#f8fafc';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    await login(password, rememberMe);
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[#f4f6fa] relative overflow-hidden px-5 py-10 safe-top safe-bottom">
      {/* Background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${accentLight} 0%, #f4f6fa 38%, #f8fafc 100%)`,
        }}
      />
      <div
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[min(520px,100vw)] h-[280px] opacity-70"
        style={{
          background: `radial-gradient(ellipse at center top, ${accent}20 0%, transparent 72%)`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage: `radial-gradient(${accent}14 1px, transparent 1px)`,
          backgroundSize: '22px 22px',
        }}
      />

      <div className="relative z-10 w-full max-w-[400px] flex flex-col items-center">
        {/* Centered brand */}
        <header className="text-center mb-9 animate-slide-up w-full">
          <BrandLogo accent={accent} accentLight={accentLight} />
          <p
            className="mt-6 text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400"
          >
            Mobil Personel
          </p>
          <h1 className="mt-2 text-[1.75rem] font-display font-bold text-slate-900 tracking-tight leading-tight">
            {theme.name}
          </h1>
          <p className="mt-2 text-[15px] text-slate-500 max-w-[280px] mx-auto leading-relaxed">
            Sipariş ve masa yönetimi için güvenli giriş
          </p>
        </header>

        {/* Login card */}
        <main
          className="w-full animate-slide-up"
          style={{ animationDelay: '0.08s' }}
        >
          <div className="bg-white/90 backdrop-blur-sm rounded-[32px] border border-white shadow-[0_20px_50px_-24px_rgba(15,23,42,0.28)] ring-1 ring-slate-200/60 overflow-hidden">
            <div
              className="h-1 w-full"
              style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
            />

            <div className="px-7 pt-7 pb-8 sm:px-8">
              <div className="text-center mb-6">
                <h2 className="text-lg font-display font-bold text-slate-900">Personel girişi</h2>
                <p className="text-slate-500 text-sm mt-1">Şifrenizi girerek devam edin</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="staff-password" className="sr-only">
                    Personel şifresi
                  </label>
                  <div
                    className="relative rounded-[18px] transition-all duration-200"
                    style={{ boxShadow: focused ? `0 0 0 4px ${accent}1a` : 'none' }}
                  >
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      id="staff-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                      placeholder="Personel şifresi"
                      maxLength={20}
                      autoComplete="off"
                      className="w-full pl-12 pr-12 py-[15px] rounded-[18px] border text-slate-900 placeholder:text-slate-400 text-[16px] font-medium transition-all focus:outline-none"
                      style={{
                        borderColor: focused ? accent : '#e8edf3',
                        backgroundColor: focused ? '#fff' : '#f8fafc',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100/80 transition-colors"
                      aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <div className="flex items-center justify-center gap-2.5 rounded-[18px] bg-red-50 border border-red-100 px-4 py-3 animate-fade-in text-center">
                    <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-700 text-sm font-medium">{loginError}</p>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="peer sr-only"
                    />
                    <span
                      className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all"
                      style={{
                        backgroundColor: rememberMe ? accent : '#fff',
                        borderColor: rememberMe ? accent : '#cbd5e1',
                      }}
                    >
                      {rememberMe && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="text-slate-600 text-sm font-medium">Beni hatırla</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowChangePassword(true)}
                    className="text-sm font-semibold transition-opacity active:opacity-70"
                    style={{ color: accent }}
                  >
                    Şifre değiştir
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loggingIn || !password.trim()}
                  className="w-full py-[15px] rounded-[18px] text-white font-bold text-[16px] active:scale-[0.985] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                  style={{
                    background: `linear-gradient(135deg, ${accent} 0%, ${accent}d4 100%)`,
                    boxShadow: loggingIn || !password.trim() ? 'none' : `0 14px 32px -14px ${accent}80`,
                  }}
                >
                  {loggingIn ? (
                    <span className="inline-flex items-center justify-center gap-2.5">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Giriş yapılıyor…
                    </span>
                  ) : (
                    'Giriş yap'
                  )}
                </button>
              </form>
            </div>
          </div>
        </main>

        <footer className="mt-8 text-center animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-slate-200/80 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[12px] font-medium text-slate-500 tracking-wide">
              Güvenli kurumsal erişim
            </span>
          </div>
        </footer>
      </div>

      <ChangePasswordModal open={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </div>
  );
}
