import React, { useState, useEffect } from 'react';
import TableOrderModal from './TableOrderModal';
import TablePartialPaymentModal from './TablePartialPaymentModal';
import TableTransferModal from './TableTransferModal';
import Toast from './Toast';

const TablePanel = ({ onSelectTable, refreshTrigger, onShowReceipt }) => {
  const [selectedType, setSelectedType] = useState('inside'); // 'inside' or 'outside'
  const [tableOrders, setTableOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showPartialPaymentModal, setShowPartialPaymentModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info', show: false });

  const showToast = (message, type = 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  const insideTables = Array.from({ length: 20 }, (_, i) => ({
    id: `inside-${i + 1}`,
    number: i + 1,
    type: 'inside',
    name: `İçeri ${i + 1}`
  }));

  const outsideTables = Array.from({ length: 20 }, (_, i) => ({
    id: `outside-${i + 1}`,
    number: i + 1,
    type: 'outside',
    name: `Dışarı ${i + 1}`
  }));

  // Paket masaları (hem içeri hem dışarı için)
  const packageTables = Array.from({ length: 5 }, (_, i) => ({
    id: `package-${selectedType}-${i + 1}`,
    number: i + 1,
    type: selectedType,
    name: `Paket ${i + 1}`
  }));

  // Masa siparişlerini yükle
  useEffect(() => {
    loadTableOrders();
    
    // Yeni sipariş geldiğinde dinle (mobil cihazdan veya Electron'dan gelen siparişler için)
    if (window.electronAPI && window.electronAPI.onNewOrderCreated) {
      const unsubscribe = window.electronAPI.onNewOrderCreated(async (data) => {
        console.log('📦 Yeni sipariş alındı:', data);
        // Siparişleri yenile (kısa bir gecikme ile veritabanının güncellenmesini bekle)
        setTimeout(async () => {
          await loadTableOrders();
          
          // Eğer modal açıksa ve aynı masaya sipariş eklendiyse, modal'daki sipariş detaylarını da yenile
          if (showModal && selectedOrder && data.tableId === selectedOrder.table_id) {
            try {
              // Güncel siparişleri API'den yükle
              const orders = await window.electronAPI.getTableOrders();
              const updatedOrder = orders.find(o => o.id === selectedOrder.id && o.status === 'pending');
              if (updatedOrder) {
                const updatedItems = await window.electronAPI.getTableOrderItems(updatedOrder.id);
                setSelectedOrder(updatedOrder);
                setOrderItems(updatedItems || []);
              }
            } catch (error) {
              console.error('Sipariş detayları yenilenirken hata:', error);
            }
          }
        }, 500);
      });
      
      return () => {
        if (unsubscribe && typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    }
  }, [showModal, selectedOrder]);

  // Masa tipi değiştiğinde siparişleri yenile
  useEffect(() => {
    loadTableOrders();
  }, [selectedType]);

  // Refresh trigger değiştiğinde siparişleri yenile
  useEffect(() => {
    if (refreshTrigger) {
      loadTableOrders();
    }
  }, [refreshTrigger]);

  const loadTableOrders = async () => {
    if (window.electronAPI && window.electronAPI.getTableOrders) {
      try {
        const orders = await window.electronAPI.getTableOrders();
        setTableOrders(orders || []);
      } catch (error) {
        console.error('Masa siparişleri yüklenemedi:', error);
      }
    }
  };

  // Belirli bir masa için sipariş var mı kontrol et
  const getTableOrder = (tableId) => {
    return tableOrders.find(order => order.table_id === tableId && order.status === 'pending');
  };

  // Masa sipariş detaylarını göster
  const handleViewOrder = async (table) => {
    const order = getTableOrder(table.id);
    if (order && window.electronAPI && window.electronAPI.getTableOrderItems) {
      try {
        const items = await window.electronAPI.getTableOrderItems(order.id);
        setSelectedOrder(order);
        setOrderItems(items || []);
        setShowModal(true);
      } catch (error) {
        console.error('Sipariş detayları yüklenemedi:', error);
      }
    }
  };

  // Masa butonuna tıklandığında
  const handleTableClick = (table) => {
    const order = getTableOrder(table.id);
    if (order) {
      // Sipariş varsa detayları göster
      handleViewOrder(table);
    } else {
      // Sipariş yoksa yeni sipariş oluştur
      onSelectTable(table);
    }
  };

  // Sipariş ekle - mevcut siparişe yeni ürünler eklemek için
  const handleAddItems = () => {
    if (!selectedOrder) return;
    
    // Tüm masaları birleştir
    const allTables = [...insideTables, ...outsideTables, ...packageTables];
    
    // Masayı bul
    const table = allTables.find(t => t.id === selectedOrder.table_id);
    if (table) {
      // Modal'ı kapat
      setShowModal(false);
      setSelectedOrder(null);
      setOrderItems([]);
      // Masayı seç ve sipariş ekleme moduna geç
      onSelectTable(table);
    } else {
      // Eğer masa bulunamazsa, selectedOrder'dan masa bilgisini oluştur
      const tableId = selectedOrder.table_id;
      let table = null;
      
      if (tableId.startsWith('inside-')) {
        const number = parseInt(tableId.replace('inside-', ''));
        table = {
          id: tableId,
          number: number,
          type: 'inside',
          name: `İçeri ${number}`
        };
      } else if (tableId.startsWith('outside-')) {
        const number = parseInt(tableId.replace('outside-', ''));
        table = {
          id: tableId,
          number: number,
          type: 'outside',
          name: `Dışarı ${number}`
        };
      } else if (tableId.startsWith('package-')) {
        const parts = tableId.split('-');
        const number = parseInt(parts[parts.length - 1]);
        const type = parts[1] || 'inside';
        table = {
          id: tableId,
          number: number,
          type: type,
          name: `Paket ${number}`
        };
      }
      
      if (table) {
        // Modal'ı kapat
        setShowModal(false);
        setSelectedOrder(null);
        setOrderItems([]);
        // Masayı seç ve sipariş ekleme moduna geç
        onSelectTable(table);
      }
    }
  };

  // Masayı sonlandır
  const handleCompleteTable = async () => {
    if (!selectedOrder || !window.electronAPI || !window.electronAPI.completeTableOrder) {
      console.error('completeTableOrder API mevcut değil');
      return;
    }

    // Önce ödeme yöntemi seçimi modal'ı göster
    const paymentMethod = await new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      modal.innerHTML = `
        <div class="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
          <h3 class="text-xl font-bold text-gray-800 mb-2">Ödeme Yöntemi Seçin</h3>
          <p class="text-sm text-gray-600 mb-6">Masa: ${selectedOrder.table_name}</p>
          <p class="text-lg font-semibold text-gray-800 mb-6">Toplam: ₺${selectedOrder.total_amount.toFixed(2)}</p>
          <div class="grid grid-cols-2 gap-3 mb-4">
            <button id="cashBtn" class="p-4 rounded-xl font-semibold bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
              <div class="flex flex-col items-center space-y-2">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>Nakit</span>
              </div>
            </button>
            <button id="cardBtn" class="p-4 rounded-xl font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
              <div class="flex flex-col items-center space-y-2">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <span>Kredi Kartı</span>
              </div>
            </button>
          </div>
          <button id="cancelBtn" class="w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-semibold transition-all">
            İptal
          </button>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      modal.querySelector('#cashBtn').onclick = () => {
        document.body.removeChild(modal);
        resolve('Nakit');
      };
      
      modal.querySelector('#cardBtn').onclick = () => {
        document.body.removeChild(modal);
        resolve('Kredi Kartı');
      };
      
      modal.querySelector('#cancelBtn').onclick = () => {
        document.body.removeChild(modal);
        resolve(null);
      };
    });

    if (!paymentMethod) {
      return; // Kullanıcı iptal etti
    }

    try {
      const result = await window.electronAPI.completeTableOrder(selectedOrder.id, paymentMethod);
      
      if (result.success) {
        // Modal'ı kapat ve siparişleri yenile
        setShowModal(false);
        setSelectedOrder(null);
        setOrderItems([]);
        await loadTableOrders();
        // Başarı toast'ı göster
        setShowSuccessToast(true);
        setTimeout(() => {
          setShowSuccessToast(false);
        }, 1000);
      } else {
        showToast('Masa sonlandırılamadı: ' + (result.error || 'Bilinmeyen hata'), 'error');
      }
    } catch (error) {
      console.error('Masa sonlandırılırken hata:', error);
      showToast('Masa sonlandırılamadı: ' + error.message, 'error');
    }
  };

  // Kısmi ödeme modal'ını aç
  const handlePartialPayment = () => {
    setShowModal(false);
    setShowPartialPaymentModal(true);
  };

  // Adisyon yazdır
  const handleRequestAdisyon = async () => {
    if (!selectedOrder || orderItems.length === 0) return;
    
    if (!window.electronAPI || !window.electronAPI.printAdisyon) {
      console.error('printAdisyon API mevcut değil. Lütfen uygulamayı yeniden başlatın.');
      showToast('Hata: Adisyon yazdırma API\'si yüklenemedi. Lütfen uygulamayı yeniden başlatın.', 'error');
      return;
    }
    
    // Order items'ı adisyon formatına çevir
    const adisyonItems = orderItems.map(item => ({
      id: item.product_id,
      name: item.product_name,
      quantity: item.quantity,
      price: item.price,
      isGift: item.isGift || false,
      staff_name: item.staff_name || null,
      category_id: null // Kategori bilgisi item'da yoksa sonra eklenebilir
    }));
    
    const adisyonData = {
      items: adisyonItems,
      tableName: selectedOrder.table_name,
      tableType: selectedOrder.table_type,
      orderNote: selectedOrder.order_note || null,
      sale_date: selectedOrder.order_date || new Date().toLocaleDateString('tr-TR'),
      sale_time: selectedOrder.order_time || new Date().toLocaleTimeString('tr-TR'),
      cashierOnly: true // Sadece kasa yazıcısından fiyatlı fiş
    };

    try {
      // Adisyon yazdırma toast'ını göster (eğer App.jsx'teki gibi bir toast sistemi varsa)
      // Şimdilik sadece console log ile göster
      console.log('Adisyon yazdırılıyor...');
      
      const result = await window.electronAPI.printAdisyon(adisyonData);
      
      if (result.success) {
        console.log('Adisyon başarıyla yazdırıldı');
        // Başarı mesajı gösterilebilir
      } else {
        console.error('Adisyon yazdırılamadı:', result.error);
        showToast('Adisyon yazdırılamadı: ' + (result.error || 'Bilinmeyen hata'), 'error');
      }
    } catch (error) {
      console.error('Adisyon yazdırılırken hata:', error);
      showToast('Adisyon yazdırılamadı: ' + error.message, 'error');
    }
  };

  // Masa aktar
  const handleTransferTable = async (sourceTableId, targetTableId) => {
    if (!window.electronAPI || !window.electronAPI.transferTableOrder) {
      showToast('Masa aktarımı şu anda kullanılamıyor', 'error');
      return;
    }

    try {
      const result = await window.electronAPI.transferTableOrder(sourceTableId, targetTableId);
      
      if (result.success) {
        // Modal'ı kapat ve siparişleri yenile
        setShowTransferModal(false);
        setShowModal(false);
        setSelectedOrder(null);
        setOrderItems([]);
        await loadTableOrders();
        // Başarı toast'ı göster
        setShowSuccessToast(true);
        setTimeout(() => {
          setShowSuccessToast(false);
        }, 2000);
      } else {
        showToast('Masa aktarılamadı: ' + (result.error || 'Bilinmeyen hata'), 'error');
      }
    } catch (error) {
      console.error('Masa aktarılırken hata:', error);
      showToast('Masa aktarılamadı: ' + error.message, 'error');
    }
  };

  // Ürün bazlı ödeme tamamlandı (siparişleri yenile)
  const handleCompletePartialPayment = async (payments) => {
    if (!selectedOrder || !window.electronAPI) {
      return;
    }

    try {
      // Siparişleri yenile
      await loadTableOrders();
      
      // Sipariş detaylarını yeniden yükle
      const updatedItems = await window.electronAPI.getTableOrderItems(selectedOrder.id);
      setOrderItems(updatedItems || []);
      
      // Eğer tüm ürünlerin ödemesi alındıysa modal'ı kapat
      const unpaidItems = updatedItems.filter(item => !item.is_paid && !item.isGift);
      if (unpaidItems.length === 0) {
        setShowPartialPaymentModal(false);
      }
    } catch (error) {
      console.error('Sipariş yenileme hatası:', error);
    }
  };


  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold gradient-text">Masalar</h2>
        <button
          onClick={() => setShowTransferModal(true)}
          className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-bold rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <span>Masa Aktar</span>
        </button>
      </div>
      
      {/* Masa Tipi Seçimi - Büyük ve Ortalanmış */}
      <div className="flex justify-center gap-4 mb-4">
        <button
          onClick={() => setSelectedType('inside')}
          className={`px-8 py-4 rounded-xl font-bold transition-all duration-300 text-lg ${
            selectedType === 'inside'
              ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg transform scale-105'
              : 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700'
          }`}
        >
          <div className="flex items-center space-x-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>İçeri</span>
          </div>
        </button>
        
        <button
          onClick={() => setSelectedType('outside')}
          className={`px-8 py-4 rounded-xl font-bold transition-all duration-300 text-lg ${
            selectedType === 'outside'
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg transform scale-105'
              : 'bg-orange-50 text-orange-600 hover:bg-orange-100 hover:text-orange-700'
          }`}
        >
          <div className="flex items-center space-x-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span>Dışarı</span>
          </div>
        </button>
      </div>

      {/* Normal Masalar */}
      <div className="grid grid-cols-10 gap-1 mb-6">
        {(selectedType === 'inside' ? insideTables : outsideTables).map((table) => {
          const hasOrder = getTableOrder(table.id);
          const isOutside = table.type === 'outside';
          return (
            <button
              key={table.id}
              onClick={() => handleTableClick(table)}
              className={`table-btn group relative overflow-hidden rounded-md p-1 border transition-all duration-300 hover:shadow-sm hover:scale-105 active:scale-95 aspect-square ${
                hasOrder
                  // Dolu masalar (iç/dış) – mobil ile aynı: kan kırmızısı tonlar
                  ? 'bg-gradient-to-br from-red-700 to-red-900 border-red-800 hover:border-red-900'
                  : isOutside
                  // Dışarı boş masalar – soft sarı
                  ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300 hover:border-amber-400'
                  // İçeri boş masalar – soft pembe (İçeri butonuyla uyumlu)
                  : 'bg-gradient-to-br from-pink-50 to-pink-100 border-pink-200 hover:border-pink-300'
              }`}
            >
              <div className="flex flex-col items-center justify-center space-y-1 h-full">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow ${
                  hasOrder
                    // Dolu masalarda iç daire – yoğun kırmızı
                    ? 'bg-gradient-to-br from-red-600 to-red-900'
                    : isOutside
                    ? 'bg-gradient-to-br from-amber-200 to-amber-300'
                    : 'bg-gradient-to-br from-pink-100 to-pink-200'
                }`}>
                  {hasOrder ? (
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className={`w-5 h-5 ${isOutside ? 'text-white' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  )}
                </div>
                <span className={`font-bold text-sm leading-tight ${
                  hasOrder
                    ? 'text-red-50'
                    : isOutside
                    ? 'text-amber-900'
                    : 'text-pink-900'
                }`}>{table.name}</span>
                <div
                  className={`text-[10px] font-semibold mt-1 px-2 py-0.5 rounded-md ${
                    hasOrder
                      ? 'bg-red-900 text-red-100'
                      : isOutside
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-pink-100 text-pink-800'
                  }`}
                >
                  {hasOrder ? 'Dolu' : 'Boş'}
                </div>
                {hasOrder && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-400 rounded-full animate-pulse"></span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* PAKET Başlığı */}
      <div className="mb-6 mt-8">
        <div className="flex items-center justify-center mb-4">
          <div className="flex items-center space-x-3 px-8 py-3 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 rounded-2xl shadow-xl transform hover:scale-105 transition-all duration-300">
            <svg className="w-7 h-7 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h3 className="text-2xl font-black text-white tracking-wider drop-shadow-lg">PAKET</h3>
          </div>
        </div>

        {/* Paket Masaları Grid */}
        <div className="grid grid-cols-5 gap-2">
          {packageTables.map((table) => {
            const hasOrder = getTableOrder(table.id);
            return (
              <button
                key={table.id}
                onClick={() => handleTableClick(table)}
                className={`table-btn group relative overflow-hidden rounded-lg p-2 border-2 transition-all duration-300 hover:shadow-lg hover:scale-105 active:scale-95 ${
                  hasOrder
                    // Paket masalar dolu – kırmızı ton
                    ? 'bg-gradient-to-br from-rose-100 to-red-200 border-red-500 hover:border-red-600'
                    : 'bg-gradient-to-br from-white to-orange-50 border-orange-300 hover:border-orange-400'
                }`}
              >
                <div className="flex flex-col items-center justify-center space-y-1.5 h-full">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow ${
                    hasOrder
                      ? 'bg-gradient-to-br from-red-600 to-red-900'
                      : 'bg-gradient-to-br from-orange-400 to-yellow-400'
                  }`}>
                    {hasOrder ? (
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    )}
                  </div>
                  <span className="font-extrabold text-sm text-gray-800 leading-tight">{table.name}</span>
                  <div
                    className={`text-[10px] font-semibold mt-1 px-2 py-0.5 rounded-md ${
                      hasOrder
                        ? 'bg-red-900 text-red-100'
                        : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    {hasOrder ? 'Dolu' : 'Boş'}
                  </div>
                  {hasOrder && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-400 rounded-full animate-pulse"></span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Masa Sipariş Detay Modal */}
      {showModal && selectedOrder && (
        <TableOrderModal
          order={selectedOrder}
          items={orderItems}
          onClose={() => {
            setShowModal(false);
            setSelectedOrder(null);
            setOrderItems([]);
            loadTableOrders(); // Siparişleri yenile
          }}
          onCompleteTable={handleCompleteTable}
          onPartialPayment={handlePartialPayment}
          onItemCancelled={async () => {
            // Ürün iptal edildiğinde sipariş detaylarını yenile
            if (selectedOrder && window.electronAPI && window.electronAPI.getTableOrderItems) {
              try {
                const updatedItems = await window.electronAPI.getTableOrderItems(selectedOrder.id);
                setOrderItems(updatedItems || []);
                // Sipariş bilgisini de güncelle
                const updatedOrders = await window.electronAPI.getTableOrders();
                const updatedOrder = updatedOrders.find(o => o.id === selectedOrder.id);
                if (updatedOrder) {
                  setSelectedOrder(updatedOrder);
                }
                loadTableOrders(); // Tüm siparişleri yenile
              } catch (error) {
                console.error('Sipariş detayları yenilenemedi:', error);
              }
            }
          }}
          onRequestAdisyon={handleRequestAdisyon}
          onAddItems={handleAddItems}
          onCancelEntireTable={() => {
            // Tüm masa iptal edildiğinde modalı kapat ve siparişleri yenile
            setShowModal(false);
            setSelectedOrder(null);
            setOrderItems([]);
            loadTableOrders(); // Siparişleri yenile
          }}
        />
      )}

      {/* Masa Aktar Modal */}
      {showTransferModal && (
        <TableTransferModal
          currentOrder={null}
          currentTableId={null}
          currentTableType={selectedType}
          onClose={() => {
            setShowTransferModal(false);
          }}
          onTransfer={handleTransferTable}
        />
      )}

      {/* Kısmi Ödeme Modal */}
      {showPartialPaymentModal && selectedOrder && (
        <TablePartialPaymentModal
          order={selectedOrder}
          items={orderItems}
          totalAmount={selectedOrder.total_amount}
          onClose={() => {
            setShowPartialPaymentModal(false);
            setShowModal(true);
          }}
          onComplete={handleCompletePartialPayment}
        />
      )}

      {/* Başarı Toast */}
      {showSuccessToast && (
        <div className="fixed inset-x-0 top-0 z-[1400] flex justify-center pointer-events-none pt-8">
          <div className="bg-white/98 backdrop-blur-xl border-2 border-green-300 rounded-3xl shadow-2xl px-8 py-5 pointer-events-auto animate-fade-in transform transition-all duration-300 scale-100">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-xl ring-4 ring-green-100">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-xl font-bold text-gray-900">Masa başarıyla sonlandırıldı</p>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: '', type: 'info', show: false })}
        />
      )}
    </div>
  );
};

export default TablePanel;

