import React from 'react';

/**
 * Modern dönme animasyonu - backend işlemleri sırasında butonlarda kullanılır.
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {string} className - ek Tailwind sınıfları
 */
const Spinner = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-5 h-5 border-2',
    lg: 'w-6 h-6 border-[3px]'
  };
  return (
    <span
      className={`inline-block rounded-full border-solid border-current border-r-transparent animate-spin ${sizeClasses[size]} ${className}`}
      role="status"
      aria-label="Yükleniyor"
    />
  );
};

export default Spinner;
