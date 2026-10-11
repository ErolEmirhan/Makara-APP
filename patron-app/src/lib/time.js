export function trStamp(date) {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  return [`${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`, `${d}.${m}.${y}`];
}

export function currentBusinessDate() {
  const n = new Date();
  if (n.getHours() < 3) n.setDate(n.getDate() - 1);
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function businessWindow(dayDate) {
  const start = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 3, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function parseTrDateTime(saleDate, saleTime) {
  if (!saleDate) return null;
  const parts = String(saleDate).trim().split(/[.\-/]/);
  if (parts.length !== 3) return null;
  let day;
  let month;
  let year;
  if (parts[0].length === 4) {
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    day = parseInt(parts[2], 10);
  } else {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    year = parseInt(parts[2], 10);
  }
  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return null;
  if (saleTime) {
    const t = String(saleTime).split(':');
    date.setHours(parseInt(t[0], 10) || 0, parseInt(t[1], 10) || 0, parseInt(t[2], 10) || 0, 0);
  }
  return date;
}

export function inWindow(saleDate, saleTime, windowRange) {
  const at = parseTrDateTime(saleDate, saleTime);
  if (!at) return false;
  return at >= windowRange.start && at < windowRange.end;
}

export function formatDayLabel(dayDate) {
  return dayDate.toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
}

export function formatTry(n) {
  const value = Math.round((Number(n) || 0) * 100) / 100;
  return `₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
