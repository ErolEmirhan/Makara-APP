import React from 'react';

/**
 * Açık / koyu tema anahtarı — Navbar’a `setThemeMode` verildiğinde görünür.
 */
export default function ThemeToggle({ themeMode = 'light', onThemeChange }) {
  const isDark = themeMode === 'dark';

  const toggle = () => {
    onThemeChange?.(isDark ? 'light' : 'dark');
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-slate-200 bg-white px-0.5 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/70 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
      aria-label={isDark ? 'Açık temaya geç' : 'Koyu temaya geç'}
      aria-pressed={isDark}
    >
      <span
        className={`pointer-events-none absolute left-0.5 top-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 shadow-sm transition-transform duration-200 ease-out dark:bg-slate-200 ${
          isDark ? 'translate-x-6' : 'translate-x-0'
        }`}
      >
        {isDark ? (
          <svg className="h-3.5 w-3.5 text-slate-900" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5 text-amber-300" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
          </svg>
        )}
      </span>
      <span className="sr-only">{isDark ? 'Koyu tema açık' : 'Açık tema açık'}</span>
    </button>
  );
}
