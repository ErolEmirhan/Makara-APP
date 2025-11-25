import React, { useState, useEffect } from 'react';

const DatePickerDropdown = ({ selectedDate, onDateChange }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);

  // Mevcut tarihi parse et
  useEffect(() => {
    if (selectedDate) {
      const [day, month, year] = selectedDate.split('.');
      setSelectedDay(parseInt(day));
      setSelectedMonth(parseInt(month));
      setSelectedYear(parseInt(year));
    } else {
      const today = new Date();
      setSelectedDay(today.getDate());
      setSelectedMonth(today.getMonth() + 1);
      setSelectedYear(today.getFullYear());
    }
  }, [selectedDate]);

  // Günleri oluştur (seçilen ay ve yıla göre)
  const getDaysInMonth = (month, year) => {
    return new Date(year, month, 0).getDate();
  };

  const days = [];
  const maxDays = getDaysInMonth(selectedMonth || 1, selectedYear || new Date().getFullYear());
  for (let i = 1; i <= maxDays; i++) {
    days.push(i);
  }

  // Aylar
  const months = [
    { value: 1, name: 'Ocak' },
    { value: 2, name: 'Şubat' },
    { value: 3, name: 'Mart' },
    { value: 4, name: 'Nisan' },
    { value: 5, name: 'Mayıs' },
    { value: 6, name: 'Haziran' },
    { value: 7, name: 'Temmuz' },
    { value: 8, name: 'Ağustos' },
    { value: 9, name: 'Eylül' },
    { value: 10, name: 'Ekim' },
    { value: 11, name: 'Kasım' },
    { value: 12, name: 'Aralık' }
  ];

  // Yılları oluştur (2020'den bugüne kadar)
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear; i >= 2020; i--) {
    years.push(i);
  }

  // Tarih değiştiğinde
  const handleDateChange = (day, month, year) => {
    if (day && month && year) {
      // Günün geçerli olduğundan emin ol (ay değiştiğinde)
      const maxDaysInMonth = getDaysInMonth(month, year);
      const validDay = Math.min(day, maxDaysInMonth);
      
      const formattedDate = `${validDay.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}.${year}`;
      onDateChange(formattedDate);
    }
  };

  // Gün değiştiğinde
  const handleDayChange = (day) => {
    setSelectedDay(day);
    handleDateChange(day, selectedMonth, selectedYear);
  };

  // Ay değiştiğinde
  const handleMonthChange = (month) => {
    setSelectedMonth(month);
    // Eğer seçili gün yeni ayda geçerli değilse, maksimum güne ayarla
    const maxDays = getDaysInMonth(month, selectedYear);
    const validDay = Math.min(selectedDay || maxDays, maxDays);
    setSelectedDay(validDay);
    handleDateChange(validDay, month, selectedYear);
  };

  // Yıl değiştiğinde
  const handleYearChange = (year) => {
    setSelectedYear(year);
    // Eğer seçili gün yeni yıldaki ayda geçerli değilse (örn. 29 Şubat), maksimum güne ayarla
    const maxDays = getDaysInMonth(selectedMonth, year);
    const validDay = Math.min(selectedDay || maxDays, maxDays);
    setSelectedDay(validDay);
    handleDateChange(validDay, selectedMonth, year);
  };

  // Filtreyi temizle
  const handleClear = () => {
    onDateChange(null);
    setShowPicker(false);
  };

  // Tarihi göster
  const displayDate = selectedDate 
    ? (() => {
        const [day, month, year] = selectedDate.split('.');
        const monthName = months.find(m => m.value === parseInt(month))?.name || '';
        return `${day} ${monthName} ${year}`;
      })()
    : 'Tarih seç...';

  return (
    <div className="relative">
      {/* Tarih Seçici Butonu */}
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="relative px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-medium text-gray-700 hover:border-purple-300 hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent min-w-[200px] flex items-center justify-between"
      >
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className={selectedDate ? 'text-gray-900' : 'text-gray-400'}>{displayDate}</span>
        </div>
        {selectedDate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="ml-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            title="Filtreyi temizle"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </button>

      {/* Dropdown Picker */}
      {showPicker && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPicker(false)}
          />
          
          {/* Picker Panel */}
          <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 min-w-[320px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Tarih Seçin</h3>
              <button
                onClick={() => setShowPicker(false)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* Gün */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Gün
                </label>
                <div className="relative">
                  <select
                    value={selectedDay || ''}
                    onChange={(e) => handleDayChange(parseInt(e.target.value))}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0.5rem center',
                      backgroundSize: '1.5em 1.5em',
                      paddingRight: '2.5rem'
                    }}
                  >
                    {days.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ay */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Ay
                </label>
                <div className="relative">
                  <select
                    value={selectedMonth || ''}
                    onChange={(e) => handleMonthChange(parseInt(e.target.value))}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0.5rem center',
                      backgroundSize: '1.5em 1.5em',
                      paddingRight: '2.5rem'
                    }}
                  >
                    {months.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Yıl */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Yıl
                </label>
                <div className="relative">
                  <select
                    value={selectedYear || ''}
                    onChange={(e) => handleYearChange(parseInt(e.target.value))}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0.5rem center',
                      backgroundSize: '1.5em 1.5em',
                      paddingRight: '2.5rem'
                    }}
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Butonlar */}
            <div className="flex items-center justify-end space-x-2 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={handleClear}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Temizle
              </button>
              <button
                onClick={() => setShowPicker(false)}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold rounded-lg hover:shadow-md transition-all duration-200"
              >
                Tamam
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DatePickerDropdown;
