import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { useApp } from '../../context/AppContext';
import { StaffTeamModal } from '../modals/StaffTeamModal';
import { StaffAvatar } from '../ui/StaffAvatar';

export function AppHeader() {
  const { staff } = useAuth();
  const { theme, branchKey } = useBranch();
  const { setDrawerOpen, screen, selectedTable } = useApp();
  const [teamOpen, setTeamOpen] = useState(false);

  const title = screen === 'order' && selectedTable
    ? selectedTable.name || `Masa ${selectedTable.number}`
    : theme.name;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 safe-top">
        <div className={`bg-gradient-to-r ${theme.accent} shadow-lg`}>
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center active:scale-95 transition-transform"
              aria-label="Menü"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="text-center flex-1 px-2">
              <h1 className="text-white font-display font-bold text-lg truncate">{title}</h1>
              {staff && (
                <p className="text-white/70 text-xs truncate">
                  {staff.name} {staff.surname}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setTeamOpen(true)}
              className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-transform overflow-visible"
              aria-label="Ekip paneli"
              title="Ekip"
            >
              {staff ? (
                <StaffAvatar
                  name={staff.name}
                  surname={staff.surname}
                  profileImageSrc={staff.profileImageSrc}
                  isManager={staff.is_manager}
                  isChef={staff.is_chef}
                  size="header"
                  accent={theme.accent}
                />
              ) : (
                <span className="w-10 h-10 rounded-full bg-white/25 border-2 border-white/40 text-white font-bold text-xs flex items-center justify-center">?</span>
              )}
            </button>
          </div>
        </div>
      </header>

      <StaffTeamModal
        open={teamOpen}
        onClose={() => setTeamOpen(false)}
        branchKey={branchKey}
      />
    </>
  );
}
