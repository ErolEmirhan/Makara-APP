/**
 * MAKARA Club için ayrı bir Firebase projesi önerilir (puanlar para değerinde
 * olduğu için POS projelerinin açık kurallarından izole tutulmalı).
 *
 * Değerleri ya burada doldurun ya da club-app/.env.local dosyasına
 * VITE_FIREBASE_API_KEY=... şeklinde yazın. apiKey boşsa uygulama demo modunda çalışır.
 */
const env = import.meta.env;

export const FIREBASE_CONFIG = {
  apiKey: env.VITE_FIREBASE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.VITE_FIREBASE_APP_ID || '',
};

export const FIREBASE_ENABLED = Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
