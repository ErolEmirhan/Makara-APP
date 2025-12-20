import React, { useState, useEffect } from 'react';
import PrintToast from './PrintToast';
import DatePickerDropdown from './DatePickerDropdown';

const SalesHistory = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('recent'); // 'recent', 'reports', or 'staff'
  const [selectedDate, setSelectedDate] = useState(null); // null = tüm tarihler, yoksa seçilen tarih
  const [printToast, setPrintToast] = useState(null); // { status: 'printing' | 'success' | 'error', message: string }
  const [productStatsData, setProductStatsData] = useState(null); // Ürün istatistikleri
  const [staffList, setStaffList] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAdisyonModal, setShowAdisyonModal] = useState(false);
  const [recentSales, setRecentSales] = useState([]);
  const [loadingRecentSales, setLoadingRecentSales] = useState(false);
  const [selectedSaleForAdisyon, setSelectedSaleForAdisyon] = useState(null);

  useEffect(() => {
    loadSales();
    loadStaff();
  }, []);

  const loadSales = async () => {
    setLoading(true);
    const salesData = await window.electronAPI.getSales();
    setSales(salesData);
    setLoading(false);
  };

  const loadStaff = async () => {
    try {
      const staff = await window.electronAPI.getStaff();
      setStaffList(staff || []);
    } catch (error) {
      console.error('Personel yükleme hatası:', error);
    }
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

  // Ödeme yöntemine göre istatistikler
  const getPaymentStats = () => {
    const nakitSales = filteredSales.filter(sale => 
      sale.payment_method === 'Nakit' && !sale.isExpense && sale.payment_method !== 'Masraf'
    );
    const kartSales = filteredSales.filter(sale => 
      sale.payment_method !== 'Nakit' && 
      sale.payment_method !== 'Masraf' && 
      !sale.isExpense &&
      sale.payment_method !== 'Parçalı Ödeme'
    );
    const parcaliSales = filteredSales.filter(sale => 
      sale.payment_method && sale.payment_method.includes('Parçalı Ödeme')
    );
    
    const nakitTotal = nakitSales.reduce((sum, sale) => sum + parseFloat(sale.total_amount), 0);
    const kartTotal = kartSales.reduce((sum, sale) => sum + parseFloat(sale.total_amount), 0);
    const parcaliTotal = parcaliSales.reduce((sum, sale) => sum + parseFloat(sale.total_amount), 0);
    
    return {
      nakitCount: nakitSales.length,
      nakitTotal,
      kartCount: kartSales.length,
      kartTotal,
      parcaliCount: parcaliSales.length,
      parcaliTotal
    };
  };

  const paymentStats = getPaymentStats();

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
    // Filtrelenmiş satışları kullan - masrafları hariç tut
    const reportSales = (selectedDate 
      ? sales.filter(sale => sale.sale_date === selectedDate)
      : sales).filter(sale => !sale.isExpense && sale.payment_method !== 'Masraf');

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

    // Ürün istatistiklerini hesapla - Firebase'den gelen gerçek satış detaylarını kullan
    const productStats = {};
    
    // Her satış için gerçek item detaylarını kullan
    reportSales.forEach(sale => {
      // Masraf ise atla
      if (sale.isExpense || sale.payment_method === 'Masraf') return;
      
      // items_array varsa gerçek verileri kullan, yoksa items string'ini parse et
      let itemsArray = [];
      
      if (sale.items_array && Array.isArray(sale.items_array)) {
        // Gerçek Firebase verileri - masraf itemlarını filtrele
        itemsArray = sale.items_array.filter(item => !item.isExpense);
      } else if (sale.items) {
        // Eski format - string'den parse et
        const items = sale.items.split(', ');
        itemsArray = items.map(item => {
          const match = item.match(/(.+) x(\d+)/);
          if (match) {
            const [, productName, quantity] = match;
            const isGift = item.includes('(İKRAM)');
            return {
              product_name: productName.replace(' (İKRAM)', ''),
              quantity: parseInt(quantity),
              price: 0, // Eski verilerde fiyat yok, hesaplanacak
              isGift: isGift
            };
          }
          return null;
        }).filter(Boolean);
      }
      
      // Her item için istatistikleri hesapla
      itemsArray.forEach(item => {
        if (!item || !item.product_name || item.isExpense) return;
        
        const productName = item.product_name;
        const quantity = item.quantity || 1;
        const isGift = item.isGift || false;
        
        // Ürün istatistiklerini başlat
        if (!productStats[productName]) {
          productStats[productName] = { 
            count: 0, 
            revenue: 0,
            price: item.price || 0 // İlk fiyatı kaydet
          };
        }
        
        // Adet sayısını artır (ikram edilenler dahil)
        productStats[productName].count += quantity;
        
        // Gelir hesapla (sadece ikram edilmeyenler)
        if (!isGift && item.price) {
          // Gerçek fiyat varsa kullan
          productStats[productName].revenue += item.price * quantity;
          // Fiyatı güncelle (ortalama için)
          if (productStats[productName].price === 0) {
            productStats[productName].price = item.price;
          }
        } else if (!isGift && !item.price && sale.total_amount) {
          // Eski veriler için: satış toplamını ürün adetine göre dağıt
          const saleTotal = parseFloat(sale.total_amount);
          const nonGiftItems = itemsArray.filter(i => !i.isGift);
          const totalNonGiftQuantity = nonGiftItems.reduce((sum, i) => sum + (i.quantity || 1), 0);
          
          if (totalNonGiftQuantity > 0) {
            productStats[productName].revenue += (saleTotal / totalNonGiftQuantity) * quantity;
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

    // Ödeme yöntemi dağılımı - masrafları hariç tut
    const paymentMethods = {};
    reportSales.forEach(sale => {
      // Masraf ise atla
      if (sale.isExpense || sale.payment_method === 'Masraf') return;
      
      if (!paymentMethods[sale.payment_method]) {
        paymentMethods[sale.payment_method] = { count: 0, total: 0 };
      }
      paymentMethods[sale.payment_method].count++;
      paymentMethods[sale.payment_method].total += parseFloat(sale.total_amount);
    });

    // Toplam ciro - masrafları hariç tut
    const totalRevenue = reportSales
      .filter(sale => !sale.isExpense && sale.payment_method !== 'Masraf')
      .reduce((sum, sale) => sum + parseFloat(sale.total_amount), 0);

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
                  <div key={product} className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{product}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-sm text-gray-600">{stats.count} adet</p>
                          {stats.price > 0 && (
                            <>
                              <span className="text-gray-400">•</span>
                              <p className="text-sm text-gray-600">Birim: ₺{stats.price.toFixed(2)}</p>
                            </>
                          )}
                        </div>
                        <p className="text-sm font-bold text-green-600 mt-1">Toplam: ₺{stats.revenue.toFixed(2)}</p>
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
                  <div key={product} className="flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl border border-red-200">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{product}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-sm text-gray-600">{stats.count} adet</p>
                          {stats.price > 0 && (
                            <>
                              <span className="text-gray-400">•</span>
                              <p className="text-sm text-gray-600">Birim: ₺{stats.price.toFixed(2)}</p>
                            </>
                          )}
                        </div>
                        <p className="text-sm font-bold text-red-600 mt-1">Toplam: ₺{stats.revenue.toFixed(2)}</p>
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
                  <div key={product} className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{product}</p>
                        <p className="text-lg font-bold text-blue-600 mt-1">₺{stats.revenue.toFixed(2)}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-sm text-gray-600">{stats.count} adet</p>
                          {stats.price > 0 && (
                            <>
                              <span className="text-gray-400">•</span>
                              <p className="text-sm text-gray-600">Birim: ₺{stats.price.toFixed(2)}</p>
                            </>
                          )}
                        </div>
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
                  <div key={product} className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{product}</p>
                        <p className="text-lg font-bold text-orange-600 mt-1">₺{stats.revenue.toFixed(2)}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-sm text-gray-600">{stats.count} adet</p>
                          {stats.price > 0 && (
                            <>
                              <span className="text-gray-400">•</span>
                              <p className="text-sm text-gray-600">Birim: ₺{stats.price.toFixed(2)}</p>
                            </>
                          )}
                        </div>
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

  const renderStaffDetails = () => {
    // Filtrelenmiş satışları kullan
    const reportSales = selectedDate 
      ? sales.filter(sale => sale.sale_date === selectedDate)
      : sales;

    // Personel bazlı istatistikleri hesapla - Gerçek verilerle (item bazlı personel bilgileri)
    const staffStats = {};
    
    reportSales.forEach(sale => {
      // Item bazlı personel bilgilerini kullan (items_array'de staff_name var)
      if (sale.items_array && Array.isArray(sale.items_array) && sale.items_array.length > 0) {
        // Bu satışta hangi personeller var (satış sayısı için)
        const staffInThisSale = new Set();
        
        // Her item için personel bilgisini kontrol et
        sale.items_array.forEach(item => {
          // Her item için personel bilgisi varsa o personelin satışı olarak say
          const itemStaffName = item.staff_name || sale.staff_name;
          
          if (!itemStaffName) return; // Personel bilgisi yoksa atla
          
          // Bu personeli bu satışta işaretle
          staffInThisSale.add(itemStaffName);
          
          if (!staffStats[itemStaffName]) {
            staffStats[itemStaffName] = {
              name: itemStaffName,
              totalRevenue: 0,
              totalSales: 0,
              products: {}, // { productName: { count: number, revenue: number } }
              averageSale: 0,
              totalItemsSold: 0,
              totalGiftItems: 0
            };
          }
          
          const productName = item.product_name;
          const quantity = item.quantity || 0;
          const price = parseFloat(item.price || 0);
          const isGift = item.isGift || false;
          
          // Bu item'ın gelirini hesapla (ikram değilse)
          if (!isGift) {
            staffStats[itemStaffName].totalRevenue += (price * quantity);
          }
          
          // Ürün istatistikleri
          if (!staffStats[itemStaffName].products[productName]) {
            staffStats[itemStaffName].products[productName] = {
              count: 0,
              revenue: 0
            };
          }
          
          staffStats[itemStaffName].products[productName].count += quantity;
          if (!isGift) {
            staffStats[itemStaffName].products[productName].revenue += (price * quantity);
          }
          
          staffStats[itemStaffName].totalItemsSold += quantity;
          if (isGift) {
            staffStats[itemStaffName].totalGiftItems += quantity;
          }
        });
        
        // Satış sayısını hesapla (her personel için en az bir item varsa bir satış sayılır)
        staffInThisSale.forEach(staffName => {
          if (staffStats[staffName]) {
            // Her personel için o personelin ürün sattığı her satış bir satış sayılır
            staffStats[staffName].totalSales += 1;
          }
        });
      } else if (sale.staff_name) {
        // Fallback: Satış seviyesinde personel bilgisi varsa (eski format)
        if (!staffStats[sale.staff_name]) {
          staffStats[sale.staff_name] = {
            name: sale.staff_name,
            totalRevenue: 0,
            totalSales: 0,
            products: {},
            averageSale: 0,
            totalItemsSold: 0,
            totalGiftItems: 0
          };
        }
        
        staffStats[sale.staff_name].totalRevenue += parseFloat(sale.total_amount);
        staffStats[sale.staff_name].totalSales += 1;
        
        // Gerçek item verilerini kullan (items_array varsa)
        if (sale.items_array && Array.isArray(sale.items_array) && sale.items_array.length > 0) {
          sale.items_array.forEach(item => {
            const productName = item.product_name;
            const quantity = item.quantity || 0;
            const price = parseFloat(item.price || 0);
            const isGift = item.isGift || false;
            
            if (!staffStats[sale.staff_name].products[productName]) {
              staffStats[sale.staff_name].products[productName] = {
                count: 0,
                revenue: 0
              };
            }
            
            staffStats[sale.staff_name].products[productName].count += quantity;
            if (!isGift) {
              staffStats[sale.staff_name].products[productName].revenue += (price * quantity);
            }
            
            staffStats[sale.staff_name].totalItemsSold += quantity;
            if (isGift) {
              staffStats[sale.staff_name].totalGiftItems += quantity;
            }
          });
        } else if (sale.items) {
          // Fallback: Eski string formatı (uyumluluk için)
          const items = sale.items.split(', ');
          items.forEach(item => {
            const match = item.match(/(.+) x(\d+)/);
            if (match) {
              const [, productName] = match;
              const cleanProductName = productName.replace(' (İKRAM)', '');
              const quantity = parseInt(match[2]);
              const isGift = item.includes('(İKRAM)');
              
              if (!staffStats[sale.staff_name].products[cleanProductName]) {
                staffStats[sale.staff_name].products[cleanProductName] = {
                  count: 0,
                  revenue: 0
                };
              }
              
              staffStats[sale.staff_name].products[cleanProductName].count += quantity;
              staffStats[sale.staff_name].totalItemsSold += quantity;
              if (isGift) {
                staffStats[sale.staff_name].totalGiftItems += quantity;
              }
            }
          });
        }
      }
    });
    
    // Ortalama satış hesapla
    Object.keys(staffStats).forEach(staffName => {
      const stats = staffStats[staffName];
      stats.averageSale = stats.totalSales > 0 ? stats.totalRevenue / stats.totalSales : 0;
    });
    
    // Personelleri toplam ciroyu göre sırala
    const sortedStaff = Object.values(staffStats).sort((a, b) => b.totalRevenue - a.totalRevenue);
    
    if (sortedStaff.length === 0) {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {selectedDate ? formatDateDisplay(selectedDate) + ' - Personel Detayları' : 'Tüm Zamanlar - Personel Detayları'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {selectedDate ? 'Seçilen tarihteki personel performansları' : 'Tüm personellerin performansları'}
              </p>
            </div>
            <DatePickerDropdown
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
            />
          </div>
          <div className="text-center py-20">
            <svg className="w-32 h-32 mx-auto text-purple-200 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-2xl font-bold text-gray-700 mb-2">
              Personel satış verisi bulunamadı
            </h3>
            <p className="text-gray-600">
              {selectedDate ? 'Seçilen tarihte personel satışı yok' : 'Henüz personel satış verisi yok'}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {selectedDate ? formatDateDisplay(selectedDate) + ' - Personel Detayları' : 'Tüm Zamanlar - Personel Detayları'}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {selectedDate ? 'Seçilen tarihteki personel performansları' : 'Tüm personellerin performansları'}
            </p>
          </div>
          <DatePickerDropdown
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
          />
        </div>

        {/* Personel Kartları */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sortedStaff.map((staff, index) => {
            // En çok satılan ürünleri bul (adet bazlı)
            const topProductsByCount = Object.entries(staff.products)
              .map(([name, data]) => [name, typeof data === 'object' ? data.count : data])
              .sort(([, a], [, b]) => b - a)
              .slice(0, 3);
            
            // En çok kazandıran ürünleri bul (gelir bazlı)
            const topProductsByRevenue = Object.entries(staff.products)
              .map(([name, data]) => [name, typeof data === 'object' ? data.revenue : 0])
              .filter(([, revenue]) => revenue > 0)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 3);
            
            const topProducts = topProductsByCount;
            
            return (
              <div
                key={staff.name}
                className="card-glass p-6 hover:shadow-xl transition-all duration-300"
              >
                {/* Personel Başlığı */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl ${
                      index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                      index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400' :
                      index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700' :
                      'bg-gradient-to-br from-purple-500 to-pink-500'
                    }`}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤'}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">{staff.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {staff.totalSales} satış yaptı
                      </p>
                    </div>
                  </div>
                </div>

                {/* İstatistikler */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                    <p className="text-xs font-semibold text-gray-600 mb-1">Toplam Ciro</p>
                    <p className="text-2xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
                      ₺{staff.totalRevenue.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
                    <p className="text-xs font-semibold text-gray-600 mb-1">Ortalama Satış</p>
                    <p className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
                      ₺{staff.averageSale.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                    <p className="text-xs font-semibold text-gray-600 mb-1">Toplam Satış</p>
                    <p className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                      {staff.totalSales}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-200">
                    <p className="text-xs font-semibold text-gray-600 mb-1">Toplam Ürün</p>
                    <p className="text-2xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                      {staff.totalItemsSold || 0}
                    </p>
                    {staff.totalGiftItems > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        ({staff.totalGiftItems} ikram)
                      </p>
                    )}
                  </div>
                </div>

                {/* En Çok Satılan Ürünler */}
                {topProducts.length > 0 && (
                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center space-x-2">
                      <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      <span>En Çok Sattığı Ürünler</span>
                    </h4>
                    <div className="space-y-2">
                      {topProducts.map(([productName, countOrData], idx) => {
                        const productData = typeof countOrData === 'object' ? countOrData : { count: countOrData, revenue: 0 };
                        const count = productData.count || 0;
                        const revenue = productData.revenue || 0;
                        
                        return (
                          <div
                            key={productName}
                            className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg"
                          >
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                {idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-gray-900 block truncate">{productName}</span>
                                {revenue > 0 && (
                                  <span className="text-xs text-gray-600">₺{revenue.toFixed(2)} kazandırdı</span>
                                )}
                              </div>
                            </div>
                            <span className="text-sm font-semibold text-purple-600 ml-2 flex-shrink-0">{count} adet</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center p-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl shadow-lg">
          <div className="flex flex-col items-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Satış Detayları</h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                Detaylı satış raporları, gelişmiş analizler ve kapsamlı raporlar için lütfen{' '}
                <a 
                  href="https://makara-16344.web.app" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-semibold text-blue-600 hover:text-blue-700 underline decoration-2 underline-offset-2 transition-colors"
                >
                  admin dashboard
                </a>
                {' '}üzerinden giriş yapınız.
              </p>
              <p className="text-base text-gray-600 mb-6">
                Dashboard'da tarih bazlı filtreleme, ödeme yöntemi analizleri, personel performans raporları ve daha fazlasını bulabilirsiniz.
              </p>
              <button
                onClick={async () => {
                  setShowAdisyonModal(true);
                  setLoadingRecentSales(true);
                  try {
                    const recent = await window.electronAPI.getRecentSales(12);
                    setRecentSales(recent || []);
                  } catch (error) {
                    console.error('Son satışlar yüklenemedi:', error);
                    alert('Son satışlar yüklenemedi');
                  } finally {
                    setLoadingRecentSales(false);
                  }
                }}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2 mx-auto"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Geçmiş Adisyon İste</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Geçmiş Adisyon Modal */}
      {showAdisyonModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white backdrop-blur-xl border border-purple-200 rounded-3xl p-8 max-w-4xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold gradient-text">Geçmiş Adisyon İste</h2>
              <button
                onClick={() => {
                  setShowAdisyonModal(false);
                  setSelectedSaleForAdisyon(null);
                  setRecentSales([]);
                }}
                className="text-gray-500 hover:text-gray-700 transition-colors p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-gray-600 mb-6">Son 12 saatin satış geçmişi:</p>

            {loadingRecentSales ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : recentSales.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Son 12 saatte satış bulunamadı.</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 max-h-96 overflow-y-auto mb-6">
                  {recentSales.map((sale) => (
                    <div
                      key={sale.id}
                      onClick={() => setSelectedSaleForAdisyon(sale)}
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        selectedSaleForAdisyon?.id === sale.id
                          ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-400'
                          : 'bg-gray-50 border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              sale.payment_method === 'Nakit'
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                            }`}>
                              {sale.payment_method === 'Nakit' ? (
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                              ) : (
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="font-bold text-gray-800">
                                {sale.table_name ? `${sale.table_type === 'inside' ? 'İç' : 'Dış'} Masa ${sale.table_name}` : 'Hızlı Satış'}
                              </p>
                              <p className="text-sm text-gray-600">
                                {sale.sale_date} {sale.sale_time}
                                {sale.staff_name && ` • ${sale.staff_name}`}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm text-gray-500 mt-2">
                            {sale.items || 'Ürün bulunamadı'}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-2xl font-bold text-purple-600">
                            ₺{sale.total_amount?.toFixed(2) || '0.00'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{sale.payment_method}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-end space-x-4">
                  <button
                    onClick={() => {
                      setShowAdisyonModal(false);
                      setSelectedSaleForAdisyon(null);
                      setRecentSales([]);
                    }}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all"
                  >
                    İptal
                  </button>
                  <button
                    onClick={async () => {
                      if (!selectedSaleForAdisyon) {
                        alert('Lütfen bir satış seçin');
                        return;
                      }

                      if (!window.electronAPI || !window.electronAPI.printAdisyon) {
                        alert('Adisyon yazdırma özelliği kullanılamıyor');
                        return;
                      }

                      try {
                        setPrintToast({ status: 'printing', message: 'Adisyon yazdırılıyor...' });

                        // Satış item'larını adisyon formatına çevir
                        const adisyonItems = (selectedSaleForAdisyon.items_array || []).map(item => ({
                          id: item.product_id,
                          name: item.product_name,
                          quantity: item.quantity,
                          price: item.price,
                          isGift: item.isGift || false,
                          staff_name: item.staff_name || null
                        }));

                        const adisyonData = {
                          items: adisyonItems,
                          tableName: selectedSaleForAdisyon.table_name || null,
                          tableType: selectedSaleForAdisyon.table_type || null,
                          orderNote: null,
                          sale_date: selectedSaleForAdisyon.sale_date,
                          sale_time: selectedSaleForAdisyon.sale_time,
                          staff_name: selectedSaleForAdisyon.staff_name || null,
                          cashierOnly: true // Sadece kasa yazıcısından fiyatlı fiş
                        };

                        const result = await window.electronAPI.printAdisyon(adisyonData);

                        if (result.success) {
                          setPrintToast({ status: 'success', message: 'Adisyon başarıyla yazdırıldı' });
                          setShowAdisyonModal(false);
                          setSelectedSaleForAdisyon(null);
                          setRecentSales([]);
                        } else {
                          setPrintToast({ status: 'error', message: result.error || 'Adisyon yazdırılamadı' });
                        }
                      } catch (error) {
                        console.error('Adisyon yazdırılırken hata:', error);
                        setPrintToast({ status: 'error', message: 'Adisyon yazdırılamadı: ' + error.message });
                      }
                    }}
                    disabled={!selectedSaleForAdisyon}
                    className={`px-6 py-3 rounded-xl font-bold text-white transition-all ${
                      selectedSaleForAdisyon
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg hover:shadow-xl'
                        : 'bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    Adisyon Yazdır
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHistory;
