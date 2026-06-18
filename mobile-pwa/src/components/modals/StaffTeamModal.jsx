import { useEffect, useMemo, useRef, useState } from 'react';
import { SidePanel } from '../ui/SidePanel';
import { StaffAvatar } from '../ui/StaffAvatar';
import { LogoutModal } from './LogoutModal';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { useApp } from '../../context/AppContext';
import { useBackHandler } from '../../hooks/useBackButton';
import {
  fetchBranchStaff,
  subscribeStaffPresence,
  updateStaffProfileImage,
} from '../../services/firebaseService';
import { fileToDataUrl } from '../../services/staffProfileImage';
import { ProfileImageCropModal } from './ProfileImageCropModal';

function staffRoleLabel(s) {
  if (s.is_manager) return 'Müdür';
  if (s.is_chef) return 'Şef';
  return 'Personel';
}

function PanelHeader({
  onClose,
  theme,
  onlineCount,
  totalCount,
  currentStaff,
  uploadingProfile,
  onPickPhoto,
  onRemovePhoto,
}) {
  const fileRef = useRef(null);
  const hasPhoto = !!currentStaff?.profileImageSrc;

  return (
    <div className={`relative shrink-0 overflow-hidden bg-gradient-to-br ${theme.accent}`}>
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,white_0%,transparent_50%)]" />
      <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -left-6 bottom-0 w-32 h-32 rounded-full bg-black/10 blur-2xl" />

      <div className="relative px-5 pt-5 pb-6">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <p className="text-white/70 text-[11px] font-semibold uppercase tracking-[0.2em]">
              Ekip
            </p>
            <h2 className="text-white text-2xl font-display font-bold tracking-tight mt-0.5">
              Personel
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-10 h-10 rounded-xl bg-white/15 backdrop-blur border border-white/25 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
            aria-label="Kapat"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {currentStaff && (
          <div className="flex items-center gap-3.5 mb-5 p-3.5 rounded-2xl bg-white/12 backdrop-blur border border-white/20">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploadingProfile}
                className="relative block overflow-visible active:scale-95 transition-transform disabled:opacity-70"
                aria-label="Profil fotoğrafı değiştir"
              >
                <StaffAvatar
                  name={currentStaff.name}
                  surname={currentStaff.surname}
                  profileImageSrc={currentStaff.profileImageSrc}
                  isManager={currentStaff.is_manager}
                  isChef={currentStaff.is_chef}
                  size="lg"
                  accent={theme.accent}
                />
                <span className="absolute inset-0 rounded-full overflow-hidden bg-black/25 flex items-center justify-center opacity-0 hover:opacity-100 active:opacity-100 transition-opacity">
                  {uploadingProfile ? (
                    <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                  )}
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickPhoto}
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-white font-semibold truncate">
                {currentStaff.name} {currentStaff.surname}
              </p>
              <p className="text-white/65 text-xs mt-0.5">{staffRoleLabel(currentStaff)} · Sen</p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploadingProfile}
                className="mt-2 text-[11px] font-semibold text-white/90 underline-offset-2 hover:underline disabled:opacity-60"
              >
                {hasPhoto ? 'Fotoğrafı değiştir' : 'Fotoğraf ekle'}
              </button>
              {hasPhoto && (
                <button
                  type="button"
                  onClick={onRemovePhoto}
                  disabled={uploadingProfile}
                  className="block mt-1 text-[11px] font-medium text-white/55 hover:text-white/80 disabled:opacity-60"
                >
                  Fotoğrafı kaldır
                </button>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-white/12 backdrop-blur border border-white/20 px-3.5 py-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-60" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-300" />
              </span>
              <span className="text-white/75 text-xs font-medium">Çevrimiçi</span>
            </div>
            <p className="text-white text-2xl font-display font-bold mt-1">{onlineCount}</p>
          </div>
          <div className="rounded-2xl bg-white/12 backdrop-blur border border-white/20 px-3.5 py-3">
            <p className="text-white/75 text-xs font-medium">Toplam</p>
            <p className="text-white text-2xl font-display font-bold mt-1">{totalCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StaffTeamModal({ open, onClose, branchKey }) {
  const { theme } = useBranch();
  const { staff: currentStaff, updateStaff } = useAuth();
  const { showToast } = useApp();
  const [staffList, setStaffList] = useState([]);
  const [presenceMap, setPresenceMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);

  useEffect(() => {
    if (!open || !branchKey) return undefined;
    setLoading(true);
    fetchBranchStaff(branchKey)
      .then(setStaffList)
      .catch(() => setStaffList([]))
      .finally(() => setLoading(false));

    const unsub = subscribeStaffPresence(branchKey, setPresenceMap);
    return unsub;
  }, [open, branchKey]);

  const rows = useMemo(() => {
    return staffList.map((s) => {
      const presence = presenceMap.get(s.id);
      const viewingName = presence?.viewingTableName?.trim() || null;
      const isSelf = currentStaff?.id === s.id;
      return {
        ...s,
        profileImageSrc: isSelf ? currentStaff?.profileImageSrc || s.profileImageSrc : s.profileImageSrc,
        online: !!presence?.online,
        viewingTableName: presence?.online && viewingName ? viewingName : null,
        isSelf,
      };
    });
  }, [staffList, presenceMap, currentStaff?.id, currentStaff?.profileImageSrc]);

  const onlineCount = rows.filter((r) => r.online).length;

  const applyProfileImage = async (dataUrl) => {
    if (!currentStaff) return;
    setUploadingProfile(true);
    try {
      await updateStaffProfileImage(currentStaff.id, dataUrl);
      updateStaff({ profileImageSrc: dataUrl || null });
      setStaffList((prev) =>
        prev.map((s) =>
          s.id === currentStaff.id ? { ...s, profileImageSrc: dataUrl || null } : s
        )
      );
      showToast('success', 'Profil', dataUrl ? 'Fotoğraf kaydedildi' : 'Fotoğraf kaldırıldı');
    } catch {
      showToast('error', 'Hata', 'Profil fotoğrafı kaydedilemedi');
    } finally {
      setUploadingProfile(false);
    }
  };

  const handlePickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setCropImageSrc(dataUrl);
    } catch {
      showToast('error', 'Hata', 'Geçerli bir görsel seçin');
    }
  };

  const handleCropConfirm = async (dataUrl) => {
    setCropImageSrc(null);
    await applyProfileImage(dataUrl);
  };

  const handleRemovePhoto = async () => {
    await applyProfileImage(null);
  };

  useBackHandler(open, () => {
    if (cropImageSrc) {
      setCropImageSrc(null);
      return;
    }
    if (showLogout) {
      setShowLogout(false);
      return;
    }
    onClose();
  });

  return (
    <>
      <SidePanel
        open={open}
        onClose={onClose}
        header={
          <PanelHeader
            onClose={onClose}
            theme={theme}
            onlineCount={onlineCount}
            totalCount={rows.length}
            currentStaff={currentStaff}
            uploadingProfile={uploadingProfile}
            onPickPhoto={handlePickPhoto}
            onRemovePhoto={handleRemovePhoto}
          />
        }
      >
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-9 h-9 border-[3px] border-pink-100 border-t-pink-500 rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Ekip yükleniyor...</p>
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-gray-400 py-16 text-sm">Personel bulunamadı</p>
          ) : (
            <ul className="space-y-2.5">
              {rows.map((member) => (
                <li
                  key={member.id}
                  className={`group relative overflow-hidden rounded-2xl border transition-all ${
                    member.isSelf
                      ? 'border-pink-200/80 bg-gradient-to-br from-pink-50 to-fuchsia-50/50 shadow-sm shadow-pink-100/50'
                      : 'border-gray-100 bg-white shadow-sm shadow-gray-100/80 hover:border-gray-200 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center gap-3 p-3.5">
                    <div className="relative shrink-0">
                      <StaffAvatar
                        name={member.name}
                        surname={member.surname}
                        profileImageSrc={member.profileImageSrc}
                        isManager={member.is_manager}
                        isChef={member.is_chef}
                        online={member.online}
                        size="md"
                        accent={member.isSelf ? theme.accent : 'from-slate-500 to-slate-700'}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 truncate text-sm">
                          {member.name} {member.surname}
                        </p>
                        {member.isSelf && (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-pink-600 bg-pink-100 px-1.5 py-0.5 rounded-md shrink-0">
                            Sen
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{staffRoleLabel(member)}</p>
                      {member.viewingTableName && (
                        <p className="text-xs text-pink-600 font-medium mt-1 truncate flex items-center gap-1">
                          <svg className="w-3.5 h-3.5 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M8 6v12M16 6v12" />
                          </svg>
                          {member.viewingTableName}&apos;e bakıyor
                        </p>
                      )}
                    </div>

                    <span
                      className={`text-[11px] font-semibold shrink-0 px-2.5 py-1 rounded-full ${
                        member.online
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-gray-100 text-gray-500 border border-gray-200/80'
                      }`}
                    >
                      {member.online ? 'Çevrimiçi' : 'Çevrimdışı'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="shrink-0 px-5 pt-3 pb-5 border-t border-gray-100 bg-white space-y-3">
          <p className="text-[11px] text-center text-gray-400 font-medium tracking-wide">
            Durumlar canlı güncellenir
          </p>
          <button
            type="button"
            onClick={() => setShowLogout(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-50 text-red-600 font-bold border border-red-100 active:scale-[0.98] transition-all hover:bg-red-100"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Çıkış Yap
          </button>
        </div>
      </SidePanel>

      <LogoutModal
        open={showLogout}
        onClose={() => setShowLogout(false)}
        onAfterLogout={onClose}
      />

      <ProfileImageCropModal
        open={!!cropImageSrc}
        imageSrc={cropImageSrc}
        accent={theme.accent}
        onConfirm={handleCropConfirm}
        onCancel={() => setCropImageSrc(null)}
      />
    </>
  );
}
