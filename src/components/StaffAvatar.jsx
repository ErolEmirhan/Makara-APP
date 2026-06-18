const SIZE = {
  sm: { box: 'w-11 h-11', text: 'text-xs' },
  md: { box: 'w-12 h-12', text: 'text-sm' },
  lg: { box: 'w-16 h-16', text: 'text-base' },
  xl: { box: 'w-[72px] h-[72px]', text: 'text-lg' },
};

const ROLE_FRAME = {
  manager: {
    ring: 'bg-gradient-to-br from-red-500 via-rose-500 to-red-700 shadow-[0_0_14px_rgba(239,68,68,0.4)]',
    badge: 'bg-gradient-to-br from-red-600 to-rose-700 text-white border-red-300/50',
    label: 'M',
    title: 'Müdür',
  },
  chef: {
    ring: 'bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-500 shadow-[0_0_14px_rgba(251,191,36,0.42)]',
    badge: 'bg-gradient-to-br from-amber-500 to-yellow-500 text-amber-950 border-amber-200/80',
    label: 'Ş',
    title: 'Şef',
  },
};

const BADGE_CLASS = {
  sm: 'w-4 h-4 text-[8px] bottom-0 right-0',
  md: 'w-4 h-4 text-[8px] bottom-0 right-0',
  lg: 'w-5 h-5 text-[9px] -bottom-0.5 -right-0.5',
  xl: 'w-6 h-6 text-[10px] -bottom-0.5 -right-0.5',
};

function staffInitials(name, surname) {
  const a = (name || '').trim().charAt(0);
  const b = (surname || '').trim().charAt(0);
  return `${a}${b}`.toUpperCase() || '?';
}

function resolveStaffRoleFrame(isManager, isChef) {
  if (isManager) return 'manager';
  if (isChef) return 'chef';
  return null;
}

export default function StaffAvatar({
  name,
  surname,
  profileImageSrc,
  size = 'lg',
  accent = 'from-zinc-600 to-zinc-800',
  online = false,
  isManager = false,
  isChef = false,
  className = '',
}) {
  const dims = SIZE[size] || SIZE.lg;
  const roleFrame = resolveStaffRoleFrame(isManager, isChef);
  const frameStyle = roleFrame ? ROLE_FRAME[roleFrame] : null;
  const badgeClass = BADGE_CLASS[size] || BADGE_CLASS.lg;

  const initialsFace = (
    <div
      className={`${dims.box} aspect-square rounded-full shrink-0 flex items-center justify-center font-bold text-white bg-gradient-to-br ${accent}`}
      aria-hidden
    >
      {staffInitials(name, surname)}
    </div>
  );

  const imageFace = profileImageSrc ? (
    <img
      src={profileImageSrc}
      alt=""
      className={`${dims.box} aspect-square rounded-full object-cover object-center shrink-0 block`}
    />
  ) : (
    initialsFace
  );

  if (!frameStyle) {
    return (
      <div className={`relative inline-flex shrink-0 ${className}`}>
        {imageFace}
        {online && (
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white translate-x-0.5 translate-y-0.5" />
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative inline-flex shrink-0 rounded-full p-[2.5px] ${frameStyle.ring} ${className}`}
      title={frameStyle.title}
    >
      <div className={`${dims.box} rounded-full overflow-hidden bg-white`}>
        {profileImageSrc ? (
          <img
            src={profileImageSrc}
            alt=""
            className="w-full h-full aspect-square rounded-full object-cover object-center block"
          />
        ) : (
          <div
            className={`w-full h-full aspect-square rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br ${accent} ${dims.text}`}
            aria-hidden
          >
            {staffInitials(name, surname)}
          </div>
        )}
      </div>
      <span
        className={`absolute flex items-center justify-center font-black rounded-full border shadow-sm ${frameStyle.badge} ${badgeClass}`}
        aria-hidden
      >
        {frameStyle.label}
      </span>
      {online && (
        <span className="absolute top-0 left-0 w-3 h-3 rounded-full border-2 border-white z-[1] bg-emerald-500 -translate-x-0.5 -translate-y-0.5" />
      )}
    </div>
  );
}
