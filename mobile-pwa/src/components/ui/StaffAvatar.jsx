const SIZE = {
  '2xs': { box: 'w-8 h-8', text: 'text-[10px]' },
  xs: { box: 'w-10 h-10', text: 'text-xs' },
  sm: { box: 'w-11 h-11', text: 'text-xs' },
  md: { box: 'w-12 h-12', text: 'text-sm' },
  lg: { box: 'w-16 h-16', text: 'text-base' },
  header: { box: 'w-10 h-10', text: 'text-xs' },
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
  '2xs': 'hidden',
  xs: 'w-3.5 h-3.5 text-[7px] bottom-0 right-0',
  sm: 'w-4 h-4 text-[8px] bottom-0 right-0',
  md: 'w-4 h-4 text-[8px] bottom-0 right-0',
  lg: 'w-5 h-5 text-[9px] -bottom-0.5 -right-0.5',
  header: 'w-3.5 h-3.5 text-[7px] bottom-0 right-0',
};

export function staffInitials(name, surname) {
  const a = (name || '').trim().charAt(0);
  const b = (surname || '').trim().charAt(0);
  return `${a}${b}`.toUpperCase() || '?';
}

export function resolveStaffRoleFrame(isManager, isChef) {
  if (isManager) return 'manager';
  if (isChef) return 'chef';
  return null;
}

function AvatarFace({
  name,
  surname,
  profileImageSrc,
  box,
  text,
  accent,
  onlineRing,
}) {
  if (profileImageSrc) {
    return (
      <img
        src={profileImageSrc}
        alt=""
        className={`${box} aspect-square rounded-full object-cover object-center shrink-0 block ${onlineRing}`}
      />
    );
  }

  return (
    <div
      className={`${box} ${text} aspect-square rounded-full shrink-0 flex items-center justify-center font-bold text-white bg-gradient-to-br ${accent} ${onlineRing}`}
      aria-hidden
    >
      {staffInitials(name, surname)}
    </div>
  );
}

export function StaffAvatar({
  name,
  surname,
  profileImageSrc,
  size = 'md',
  accent = 'from-slate-500 to-slate-700',
  online,
  isManager = false,
  isChef = false,
  role,
  className = '',
}) {
  const dims = SIZE[size] || SIZE.md;
  const roleFrame = role ?? resolveStaffRoleFrame(isManager, isChef);
  const frameStyle = roleFrame ? ROLE_FRAME[roleFrame] : null;
  const onlineRing = online && !frameStyle ? 'ring-2 ring-emerald-400/80 ring-offset-2' : '';

  const face = (
    <AvatarFace
      name={name}
      surname={surname}
      profileImageSrc={profileImageSrc}
      box={dims.box}
      text={dims.text}
      accent={accent}
      onlineRing={onlineRing}
    />
  );

  if (!frameStyle) {
    return (
      <div className={`relative inline-flex shrink-0 ${className}`}>
        {face}
        {online && (
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white translate-x-0.5 translate-y-0.5" />
        )}
      </div>
    );
  }

  const badgeClass = BADGE_CLASS[size] || BADGE_CLASS.md;

  return (
    <div
      className={`relative inline-flex shrink-0 rounded-full p-[2.5px] ${frameStyle.ring} ${className}`}
      title={frameStyle.title}
    >
      <div className={`${dims.box} rounded-full overflow-hidden`}>
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
