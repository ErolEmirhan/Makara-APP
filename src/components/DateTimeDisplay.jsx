import React, { useState, useEffect } from 'react';

const DateTimeDisplay = () => {
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    // Her saniye güncelle
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);

    // İlk render'da hemen güncelle
    setDateTime(new Date());

    return () => clearInterval(timer);
  }, []);

  // Tarih formatı: "15 Ocak 2024"
  const formattedDate = dateTime.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  // Saat formatı: "14:30:45"
  const formattedTime = dateTime.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return (
    <div className="flex items-center gap-2 px-2.5 py-1 bg-white/60 backdrop-blur-sm rounded border border-gray-200/50 shadow-sm">
      <div className="flex items-center gap-1.5">
        <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-[10px] font-medium text-gray-600">{formattedDate}</span>
      </div>
      <div className="w-px h-4 bg-gray-300"></div>
      <div className="flex items-center gap-1.5">
        <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-[10px] font-bold text-gray-700 font-mono">{formattedTime}</span>
      </div>
    </div>
  );
};

export default DateTimeDisplay;


