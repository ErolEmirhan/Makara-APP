import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';

export function SplashScreen() {
  const { staff, completeSplash } = useAuth();
  const { theme } = useBranch();

  useEffect(() => {
    const timer = setTimeout(completeSplash, 2000);
    return () => clearTimeout(timer);
  }, [completeSplash]);

  const name = staff ? `${staff.name} ${staff.surname}` : '';

  return (
    <div className={`min-h-dvh flex items-center justify-center relative overflow-hidden bg-gradient-to-br ${theme.splashBg}`}>
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
        backgroundSize: '32px 32px',
      }} />

      <div className="relative z-10 text-center animate-slide-up px-8">
        <div className="inline-block px-4 py-1.5 rounded-full bg-white/15 backdrop-blur border border-white/20 text-white/80 text-xs font-bold tracking-widest uppercase mb-8">
          {theme.name}
        </div>

        <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-white/20 backdrop-blur-xl border border-white/30 flex items-center justify-center shadow-2xl">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="text-3xl font-display font-bold text-white mb-3">
          İyi çalışmalar dileriz
        </h1>
        <p className="text-2xl font-semibold text-white/90 mb-10">{name}</p>

        <div className="w-48 h-1 mx-auto bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full animate-[shimmer_2s_ease-in-out_infinite]" style={{ width: '60%' }} />
        </div>
      </div>
    </div>
  );
}
