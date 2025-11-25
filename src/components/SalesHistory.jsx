import React, { useState, useEffect } from 'react';
import PrintToast from './PrintToast';
import DatePickerDropdown from './DatePickerDropdown';

const SalesHistory = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('recent'); // 'recent' or 'reports'
  const [selectedDate, setSelectedDate] = useState(null); // null = tüm tarihler, yoksa seçilen tarih
  const [printToast, setPrintToast] = useState(null); // { status: 'printing' | 'success' | 'error', message: string }
  const [productStatsData, setProductStatsData] = useState(null); // Ürün istatistikleri

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    setLoading(true);
    const salesData = await window.electronAPI.getSales();
    setSales(salesData);
    setLoading(false);
  };

  const getPaymentMethodColor = (method) => {
    return method === 'Nakit' 
      ? 'from-green-500 to-emerald-500' 
      : 'from-blue-500 to-cyan-500';
  };

  const getPaymentMethodIcon = (method) => {
    if (method === 'Nakit') {
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      );
    }
    return (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    );
  };

  // Satışları tarihe göre grupla
  const groupSalesByDate = (salesList) => {
    const grouped = {};
    salesList.forEach(sale => {
      const date = sale.sale_date; // Format: "DD.MM.YYYY"
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(sale);
    });
    
    // Tarihleri sırala (en yeni önce)
    const sortedDates = Object.keys(grouped).sort((a, b) => {
      const [dayA, monthA, yearA] = a.split('.');
      const [dayB, monthB, yearB] = b.split('.');
      const dateA = new Date(yearA, monthA - 1, dayA);
      const dateB = new Date(yearB, monthB - 1, dayB);
      return dateB - dateA; // Yeni tarihler önce
    });
    
    return { grouped, sortedDates };
  };

  // Tarihi Türkçe formata çevir (örn: "15.01.2024" -> "15 Ocak 2024 Pazartesi")
  const formatDateDisplay = (dateStr) => {
    const [day, month, year] = dateStr.split('.');
    const date = new Date(year, month - 1, day);
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    
    const dayName = days[date.getDay()];
    const monthName = months[parseInt(month) - 1];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const saleDate = new Date(year, month - 1, day);
    saleDate.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (saleDate.getTime() === today.getTime()) {
      return `Bugün - ${day} ${monthName} ${year}`;
    } else if (saleDate.getTime() === yesterday.getTime()) {
      return `Dün - ${day} ${monthName} ${year}`;
    } else {
      return `${day} ${monthName} ${year} - ${dayName}`;
    }
  };

  // Filtrelenmiş satışlar
  const filteredSales = selectedDate 
    ? sales.filter(sale => sale.sale_date === selectedDate)
    : sales;

  // Tarihe göre gruplanmış satışlar
  const { grouped: salesByDate, sortedDates } = groupSalesByDate(filteredSales);

  // Satış detaylarını al ve adisyon yazdır
  const handleReprintAdisyon = async (saleId) => {
    if (!window.electronAPI || !window.electronAPI.getSaleDetails || !window.electronAPI.printAdisyon) {
      alert('API mevcut değil. Lütfen uygulamayı yeniden başlatın.');
      return;
    }

    try {
      setPrintToast({ status: 'printing', message: 'Adisyon yazdırılıyor...' });
      
      const { sale, items } = await window.electronAPI.getSaleDetails(saleId);
      
      if (!sale || !items || items.length === 0) {
        setPrintToast({ 
          status: 'error', 
          message: 'Satış detayları bulunamadı' 
        });
        return;
      }

      // Items'ı adisyon formatına çevir
      const adisyonItems = items.map(item => ({
        id: item.product_id,
        name: item.product_name,
        quantity: item.quantity,
        price: item.price,
        isGift: item.isGift || false
      }));

      const adisyonData = {
        items: adisyonItems,
        tableName: sale.table_name || null,
        tableType: sale.table_type || null,
        orderNote: null,
        sale_date: sale.sale_date,
        sale_time: sale.sale_time
      };

      const result = await window.electronAPI.printAdisyon(adisyonData);
      
      if (result.success) {
        setPrintToast({ 
          status: 'success', 
          message: 'Adisyon başarıyla yazdırıldı' 
        });
      } else {
        setPrintToast({ 
          status: 'error', 
          message: result.error || 'Adisyon yazdırılamadı' 
        });
      }
    } catch (error) {
      console.error('Adisyon yazdırılırken hata:', error);
      setPrintToast({ 
        status: 'error', 
        message: 'Adisyon yazdırılamadı: ' + error.message 
      });
    }
  };

  // Satış detaylarını al ve fişi kasa yazıcısından yazdır
  const handleReprintReceipt = async (saleId) => {
    if (!window.electronAPI || !window.electronAPI.getSaleDetails || !window.electronAPI.printReceipt) {
      alert('API mevcut değil. Lütfen uygulamayı yeniden başlatın.');
      return;
    }

    try {
      setPrintToast({ status: 'printing', message: 'Fiş yazdırılıyor...' });
      
      const { sale, items } = await window.electronAPI.getSaleDetails(saleId);
      
      if (!sale || !items || items.length === 0) {
        setPrintToast({ 
          status: 'error', 
          message: 'Satış detayları bulunamadı' 
        });
        return;
      }

      // Items'ı receipt formatına çevir
      const receiptItems = items.map(item => ({
        id: item.product_id,
        name: item.product_name,
        quantity: item.quantity,
        price: item.price,
        isGift: item.isGift || false
      }));

      const receiptData = {
        sale_id: sale.id,
        totalAmount: parseFloat(sale.total_amount),
        paymentMethod: sale.payment_method,
        sale_date: sale.sale_date,
        sale_time: sale.sale_time,
        items: receiptItems,
        tableName: sale.table_name || null,
        tableType: sale.table_type || null,
        orderNote: null,
        cashierOnly: true // Sadece kasa yazıcısından yazdır
      };

      const result = await window.electronAPI.printReceipt(receiptData);
      
      if (result.success) {
        setPrintToast({ 
          status: 'success', 
          message: 'Fiş başarıyla yazdırıldı' 
        });
      } else {
        setPrintToast({ 
          status: 'error', 
          message: result.error || 'Fiş yazdırılamadı' 
        });
      }
    } catch (error) {
      console.error('Fiş yazdırılırken hata:', error);
      setPrintToast({ 
        status: 'error', 
        message: 'Fiş yazdırılamadı: ' + error.message 
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const renderReports = () => {
    // Filtrelenmiş satışları kullan
    const reportSales = selectedDate 
      ? sales.filter(sale => sale.sale_date === selectedDate)
      : sales;

    if (reportSales.length === 0) {
      return (
        <div className="space-y-6">
          {/* Tarih Seçici */}
          <div className="flex items-center justify-end">
            <DatePickerDropdown
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
            />
          </div>
          <div className="text-center py-20">
            <svg className="w-32 h-32 mx-auto text-purple-200 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-2xl font-bold text-gray-700 mb-2">
              {selectedDate ? 'Seçilen tarihte veri yok' : 'Henüz veri yok'}
            </h3>
            <p className="text-gray-600">
              {selectedDate ? 'Farklı bir tarih seçebilir veya filtreyi temizleyebilirsiniz' : 'Satış yapıldıkça raporlar oluşturulacak'}
            </p>
          </div>
        </div>
      );
    }

    // Ürün istatistiklerini hesapla - Gerçek satış detaylarını kullan
    const productStats = {};
    
    // Önce items string'inden temel bilgileri topla
    reportSales.forEach(sale => {
      const items = sale.items.split(', ');
      items.forEach(item => {
        const match = item.match(/(.+) x(\d+)/);
        if (match) {
          const [, productName, quantity] = match;
          const isGift = item.includes('(İKRAM)');
          
          if (!productStats[productName]) {
            productStats[productName] = { count: 0, revenue: 0 };
          }
          
          productStats[productName].count += parseInt(quantity);
        }
      });
    });
    
    // Şimdi gerçek fiyat bilgilerini almak için her satışın detaylarını çek
    // Not: Bu async bir işlem, bu yüzden önce temel bilgileri göster, sonra detayları yükle
    // Şimdilik satış toplamını ürün sayısına göre dağıtarak yaklaşık gelir hesapla
    reportSales.forEach(sale => {
      const items = sale.items.split(', ');
      const saleTotal = parseFloat(sale.total_amount);
      const nonGiftItems = items.filter(item => !item.includes('(İKRAM)'));
      
      // İkram edilmeyen ürünlerin toplam adetini hesapla
      let totalNonGiftQuantity = 0;
      nonGiftItems.forEach(item => {
        const match = item.match(/(.+) x(\d+)/);
        if (match) {
          totalNonGiftQuantity += parseInt(match[2]);
        }
      });
      
      // Her ürün için gelir hesapla (ikram edilenler hariç)
      items.forEach(item => {
        const match = item.match(/(.+) x(\d+)/);
        if (match) {
          const [, productName, quantity] = match;
          const isGift = item.includes('(İKRAM)');
          
          if (!isGift && totalNonGiftQuantity > 0) {
            // Satış toplamını ürün adetine göre orantılı dağıt
            productStats[productName].revenue += (saleTotal / totalNonGiftQuantity) * parseInt(quantity);
          }
        }
      });
    });

    // Ürünleri sırala ve kategorize et
    const productEntries = Object.entries(productStats);
    
    // En çok satılan ürünler (adet)
    const topProductsByCount = [...productEntries]
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5);
    
    // En az satılan ürünler (adet)
    const bottomProductsByCount = [...productEntries]
      .sort(([, a], [, b]) => a.count - b.count)
      .slice(0, 5);
    
    // En çok kazandıran ürünler (gelir)
    const topProductsByRevenue = [...productEntries]
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .slice(0, 5);
    
    // En az kazandıran ürünler (gelir)
    const bottomProductsByRevenue = [...productEntries]
      .sort(([, a], [, b]) => a.revenue - b.revenue)
      .slice(0, 5);

    // Ödeme yöntemi dağılımı
    const paymentMethods = {};
    reportSales.forEach(sale => {
      if (!paymentMethods[sale.payment_method]) {
        paymentMethods[sale.payment_method] = { count: 0, total: 0 };
      }
      paymentMethods[sale.payment_method].count++;
      paymentMethods[sale.payment_method].total += parseFloat(sale.total_amount);
    });

    const totalRevenue = reportSales.reduce((sum, sale) => sum + parseFloat(sale.total_amount), 0);

    return (
      <div className="space-y-6">
        {/* Tarih Seçici */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {selectedDate ? formatDateDisplay(selectedDate) + ' - Rapor' : 'Tüm Zamanlar - Rapor'}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {selectedDate ? 'Seçilen tarihteki satış istatistikleri' : 'Tüm satışların istatistikleri'}
            </p>
          </div>
          <DatePickerDropdown
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
          />
        </div>

        {/* Genel İstatistikler */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card-glass p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Toplam Ciro</p>
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
              ₺{totalRevenue.toFixed(2)}
            </p>
          </div>

          <div className="card-glass p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Toplam Satış</p>
              <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-gray-900">{reportSales.length}</p>
          </div>

          <div className="card-glass p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Ortalama Sepet</p>
              <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
              ₺{(reportSales.length > 0 ? (totalRevenue / reportSales.length) : 0).toFixed(2)}
            </p>
          </div>

          <div className="card-glass p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">En Yüksek Satış</p>
              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              ₺{(reportSales.length > 0 ? Math.max(...reportSales.map(s => parseFloat(s.total_amount))) : 0).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Ürün Bazlı İstatistikler */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* En Çok Satılan Ürünler */}
          <div className="card-glass p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span>En Çok Satılan Ürünler</span>
            </h3>
            <div className="space-y-3">
              {topProductsByCount.length > 0 ? (
                topProductsByCount.map(([product, stats], index) => (
                  <div key={product} className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{product}</p>
                        <p className="text-sm text-gray-600">{stats.count} adet satıldı</p>
                        <p className="text-sm font-semibold text-green-600">₺{stats.revenue.toFixed(2)} kazandırdı</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">Veri yok</p>
              )}
            </div>
          </div>

          {/* En Az Satılan Ürünler */}
          <div className="card-glass p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
              <span>En Az Satılan Ürünler</span>
            </h3>
            <div className="space-y-3">
              {bottomProductsByCount.length > 0 ? (
                bottomProductsByCount.map(([product, stats], index) => (
                  <div key={product} className="flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{product}</p>
                        <p className="text-sm text-gray-600">{stats.count} adet satıldı</p>
                        <p className="text-sm font-semibold text-red-600">₺{stats.revenue.toFixed(2)} kazandırdı</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">Veri yok</p>
              )}
            </div>
          </div>

          {/* En Çok Kazandıran Ürünler */}
          <div className="card-glass p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>En Çok Kazandıran Ürünler</span>
            </h3>
            <div className="space-y-3">
              {topProductsByRevenue.length > 0 ? (
                topProductsByRevenue.map(([product, stats], index) => (
                  <div key={product} className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{product}</p>
                        <p className="text-sm font-semibold text-blue-600">₺{stats.revenue.toFixed(2)} kazandırdı</p>
                        <p className="text-sm text-gray-600">{stats.count} adet satıldı</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">Veri yok</p>
              )}
            </div>
          </div>

          {/* En Az Kazandıran Ürünler */}
          <div className="card-glass p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
              <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>En Az Kazandıran Ürünler</span>
            </h3>
            <div className="space-y-3">
              {bottomProductsByRevenue.length > 0 ? (
                bottomProductsByRevenue.map(([product, stats], index) => (
                  <div key={product} className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{product}</p>
                        <p className="text-sm font-semibold text-orange-600">₺{stats.revenue.toFixed(2)} kazandırdı</p>
                        <p className="text-sm text-gray-600">{stats.count} adet satıldı</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">Veri yok</p>
              )}
            </div>
          </div>
        </div>

        {/* Ödeme Yöntemi Dağılımı */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-glass p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Ödeme Yöntemleri</span>
            </h3>
            <div className="space-y-4">
              {Object.entries(paymentMethods).map(([method, data]) => (
                <div key={method} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700">{method}</span>
                    <span className="text-sm text-gray-600">
                      {data.count} satış ({reportSales.length > 0 ? ((data.count / reportSales.length) * 100).toFixed(1) : '0'}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full ${method === 'Nakit' ? 'bg-gradient-to-r from-emerald-500 to-lime-500' : 'bg-gradient-to-r from-sky-500 to-indigo-500'}`}
                      style={{ width: `${reportSales.length > 0 ? (data.count / reportSales.length) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600">Toplam: ₺{data.total.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card-glass p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Performans Özeti</span>
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                <p className="text-sm text-gray-600 mb-1">En Karlı Gün</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(() => {
                    const dateRevenues = reportSales.reduce((acc, sale) => {
                      const date = sale.sale_date;
                      if (!acc[date]) acc[date] = 0;
                      acc[date] += parseFloat(sale.total_amount);
                      return acc;
                    }, {});
                    if (Object.keys(dateRevenues).length === 0) return 'Veri yok';
                    const maxDate = Object.keys(dateRevenues).reduce((a, b) => 
                      dateRevenues[a] > dateRevenues[b] ? a : b, Object.keys(dateRevenues)[0]
                    );
                    return `${maxDate} (₺${dateRevenues[maxDate]?.toFixed(2) || '0.00'})`;
                  })()}
                </p>
              </div>
              <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl">
                <p className="text-sm text-gray-600 mb-1">Toplam İşlem Sayısı</p>
                <p className="text-2xl font-bold text-gray-900">{reportSales.length} işlem</p>
              </div>
              <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                <p className="text-sm text-gray-600 mb-1">
                  {selectedDate ? 'Seçilen Tarih' : 'Bugünkü'} Satışlar
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {selectedDate 
                    ? reportSales.length 
                    : reportSales.filter(s => s.sale_date === new Date().toLocaleDateString('tr-TR')).length
                  } adet
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold gradient-text mb-2">Satış Detayları</h1>
          <p className="text-gray-600">Tüm satış işlemlerinizi görüntüleyin</p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Tarih Seçici - Kaydırmalı */}
          <DatePickerDropdown
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
          />
          <button
            onClick={loadSales}
            className="group relative px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-900 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm font-medium">Yenile</span>
            </div>
          </button>
        </div>
      </div>

      {/* Sekme Butonları */}
      <div className="flex items-center space-x-4 mb-8">
        <button
          onClick={() => setActiveTab('recent')}
          className={`px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300 ${
            activeTab === 'recent'
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-2xl transform scale-105'
              : 'bg-white/70 text-gray-600 hover:bg-white hover:shadow-lg hover:scale-102'
          }`}
        >
          <div className="flex items-center space-x-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Son Satışlar</span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300 ${
            activeTab === 'reports'
              ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-2xl transform scale-105'
              : 'bg-white/70 text-gray-600 hover:bg-white hover:shadow-lg hover:scale-102'
          }`}
        >
          <div className="flex items-center space-x-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Detaylı Raporlama</span>
          </div>
        </button>
      </div>

      {/* İçerik */}
      {activeTab === 'recent' ? (
        filteredSales.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-32 h-32 mx-auto text-purple-200 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-2xl font-bold text-gray-700 mb-2">
            {selectedDate ? 'Seçilen tarihte satış bulunamadı' : 'Henüz satış yok'}
          </h3>
          <p className="text-gray-600">
            {selectedDate ? 'Farklı bir tarih seçebilir veya filtreyi temizleyebilirsiniz' : 'İlk satışınızı yapmak için Satış Yap bölümüne gidin'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedDates.map((date) => {
            const daySales = salesByDate[date];
            const dayTotal = daySales.reduce((sum, sale) => sum + parseFloat(sale.total_amount), 0);
            const dayCount = daySales.length;
            
            return (
              <div key={date} className="space-y-4">
                {/* Gün Başlığı */}
                <div className="sticky top-0 z-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6 shadow-xl border border-purple-400">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white">{formatDateDisplay(date)}</h2>
                        <p className="text-purple-100 text-sm mt-1">
                          {dayCount} satış • Toplam: ₺{dayTotal.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* O Günün Satışları */}
                <div className="grid grid-cols-1 gap-4">
                  {daySales.map((sale) => (
            <div
              key={sale.id}
              className="group relative bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-gray-200"
              style={{
                boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.1)'
              }}
            >
              {/* Subtle accent line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100"></div>
              
              <div className="p-6">
                <div className="flex items-start justify-between gap-6">
                  {/* Left Section - Main Info */}
                  <div className="flex-1 min-w-0">
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center border border-gray-200">
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 tracking-tight">
                            Satış #{sale.id}
                          </h3>
                          <div className="flex items-center space-x-3 mt-1">
                            <span className="text-xs text-gray-500 font-medium">
                              {sale.sale_date}
                            </span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-500 font-medium">
                              {sale.sale_time}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Payment Method & Table Badge */}
                    <div className="flex items-center space-x-2 mb-4 flex-wrap gap-2">
                      <div className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                        sale.payment_method === 'Nakit'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {getPaymentMethodIcon(sale.payment_method)}
                        <span>{sale.payment_method}</span>
                      </div>
                      {sale.table_name && (
                        <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                          <span>{sale.table_name}</span>
                        </div>
                      )}
                    </div>

                    {/* Products List */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                        Ürünler
                      </p>
                      <div className="text-sm text-gray-700 leading-relaxed font-normal space-y-1">
                        {sale.items.split(', ').map((itemText, idx) => {
                          const isGift = itemText.includes('(İKRAM)');
                          const cleanText = itemText.replace(' (İKRAM)', '');
                          
                          return (
                            <div key={idx} className="flex items-center space-x-2">
                              <span className={isGift ? 'text-gray-400 line-through' : ''}>
                                {cleanText}
                              </span>
                              {isGift && (
                                <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                                  İKRAM
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right Section - Amount & Actions */}
                  <div className="flex-shrink-0">
                    <div className="bg-gradient-to-br from-gray-50 via-white to-gray-50 rounded-2xl p-5 border border-gray-200/60 shadow-sm min-w-[160px]">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 text-center">
                        Toplam
                      </p>
                      <p className="text-3xl font-bold text-gray-900 tracking-tight text-center mb-3">
                        ₺{parseFloat(sale.total_amount).toFixed(2)}
                      </p>
                      <div className="flex items-center justify-center space-x-1.5 text-xs text-gray-500 pt-2 pb-3 border-t border-b border-gray-200 mb-3">
                        <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">Tamamlandı</span>
                      </div>
                      
                      {/* Yeniden Yazdırma Butonları */}
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleReprintAdisyon(sale.id)}
                          className="px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-semibold rounded-lg transition-all duration-200 hover:shadow-md active:scale-95 flex items-center justify-center space-x-1.5"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>Adisyonu Tekrar İste</span>
                        </button>
                        <button
                          onClick={() => handleReprintReceipt(sale.id)}
                          className="px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-xs font-semibold rounded-lg transition-all duration-200 hover:shadow-md active:scale-95 flex items-center justify-center space-x-1.5"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                          <span>Fişi Tekrar Yazdır</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )
      ) : renderReports()}

      {activeTab === 'recent' && filteredSales.length > 0 && (
        <div className="mt-8 p-6 bg-white/70 backdrop-blur-xl rounded-2xl border border-purple-200 shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-gray-600 mb-2">{selectedDate ? 'Seçilen Tarih - ' : ''}Toplam Satış</p>
              <p className="text-3xl font-bold text-gray-900">{filteredSales.length}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-600 mb-2">{selectedDate ? 'Seçilen Tarih - ' : ''}Toplam Gelir</p>
              <p className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                ₺{filteredSales.reduce((sum, sale) => sum + parseFloat(sale.total_amount), 0).toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-gray-600 mb-2">{selectedDate ? 'Seçilen Tarih - ' : ''}Ortalama Satış</p>
              <p className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                ₺{(filteredSales.reduce((sum, sale) => sum + parseFloat(sale.total_amount), 0) / filteredSales.length).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Print Toast */}
      <PrintToast
        status={printToast?.status}
        message={printToast?.message}
        onClose={() => setPrintToast(null)}
        autoHideDuration={printToast?.status === 'printing' ? null : 2500}
      />
    </div>
  );
};

export default SalesHistory;

