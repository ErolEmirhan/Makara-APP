import React, { useState, useEffect } from 'react';

const DateTimeDisplay = () => {
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);
    setDateTime(new Date());
    return () => clearInterval(timer);
  }, []);

  const formattedDate = dateTime.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const formattedTime = dateTime.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return (
    <div className="flex flex-col items-end leading-tight">
      <span className="text-[11px] font-medium text-[#86868b] dark:text-[#a1a1a6] tabular-nums">
        {formattedDate}
      </span>
      <span className="text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums tracking-tight">
        {formattedTime}
      </span>
    </div>
  );
};

export default DateTimeDisplay;
