import { useState } from 'react';
import { useBranch } from '../../context/BranchContext';
import { BRANCH_FIREBASE } from '../../config/firebase';

export function BranchSetup() {
  const { selectBranch, connecting, error } = useBranch();
  const [selected, setSelected] = useState('');

  const branches = Object.values(BRANCH_FIREBASE);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected) return;
    await selectBranch(selected);
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950" />
      <div className="absolute top-1/4 -left-20 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-violet-500/15 rounded-full blur-3xl animate-pulse-glow" />

      <div className="relative z-10 w-full max-w-sm animate-slide-up">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-2xl shadow-indigo-500/30 mb-6">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.76-3.76A4.502 4.502 0 0018 8.25c0 2.278-1.68 4.168-3.875 4.612" />
            </svg>
          </div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">Şube Seçin</h1>
          <p className="text-white/60 text-sm leading-relaxed">
            İnternet üzerinden doğrudan Firebase'e bağlanır.<br />
            Kasa IP'si veya aynı ağ gerekmez.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {branches.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setSelected(b.key)}
              className={`w-full p-4 rounded-2xl border text-left transition-all ${
                selected === b.key
                  ? 'bg-white/20 border-white/40 text-white shadow-lg'
                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
              }`}
            >
              <span className="font-bold text-lg">{b.label}</span>
              <p className="text-xs text-white/50 mt-0.5 font-mono">{b.main.projectId}</p>
            </button>
          ))}

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={connecting || !selected}
            className="w-full py-4 mt-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold text-lg shadow-xl disabled:opacity-50"
          >
            {connecting ? 'Bağlanıyor...' : 'Devam Et'}
          </button>
        </form>
      </div>
    </div>
  );
}
