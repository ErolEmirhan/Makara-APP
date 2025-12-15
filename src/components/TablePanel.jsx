import React, { useState, useEffect } from 'react';
import TableOrderModal from './TableOrderModal';
import TablePartialPaymentModal from './TablePartialPaymentModal';

const TablePanel = ({ onSelectTable, refreshTrigger, onShowReceipt }) => {
  const [selectedType, setSelectedType] = useState('inside'); // 'inside' or 'outside'
  const [tableOrders, setTableOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showPartialPaymentModal, setShowPartialPaymentModal] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferSourceTable, setTransferSourceTable] = useState(null);
  const [transferTargetTable, setTransferTargetTable] = useState(null);
  const [transferring, setTransferring] = useState(false);

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
    
    // Masayı bul
    const table = tables.find(t => t.id === selectedOrder.table_id);
    if (table) {
      // Modal'ı kapat
      setShowModal(false);
      setSelectedOrder(null);
      setOrderItems([]);
      // Masayı seç ve sipariş ekleme moduna geç
      onSelectTable(table);
    }
  };

  // Masayı sonlandır
  const handleCompleteTable = async () => {
    if (!selectedOrder || !window.electronAPI || !window.electronAPI.completeTableOrder) {
      console.error('completeTableOrder API mevcut değil');
      return;
    }

    try {
      const result = await window.electronAPI.completeTableOrder(selectedOrder.id);
      
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
        alert('Masa sonlandırılamadı: ' + (result.error || 'Bilinmeyen hata'));
      }
    } catch (error) {
      console.error('Masa sonlandırılırken hata:', error);
      alert('Masa sonlandırılamadı: ' + error.message);
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
      alert('Hata: Adisyon yazdırma API\'si yüklenemedi. Lütfen uygulamayı yeniden başlatın.');
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
        alert('Adisyon yazdırılamadı: ' + (result.error || 'Bilinmeyen hata'));
      }
    } catch (error) {
      console.error('Adisyon yazdırılırken hata:', error);
      alert('Adisyon yazdırılamadı: ' + error.message);
    }
  };

  // Kısmi ödemeyi tamamla
  const handleCompletePartialPayment = async (payments) => {
    if (!selectedOrder || !window.electronAPI) {
      console.error('API mevcut değil');
      return;
    }

    try {
      console.log('window.electronAPI:', window.electronAPI);
      console.log('updateTableOrderAmount fonksiyonu var mı?', typeof window.electronAPI.updateTableOrderAmount);
      
      const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
      const paymentDetails = payments.map(p => `${p.method}: ₺${p.amount.toFixed(2)}`).join(', ');

      // Masa siparişi tutarını güncelle
      if (!window.electronAPI.updateTableOrderAmount) {
        alert('Hata: updateTableOrderAmount API fonksiyonu bulunamadı. Lütfen uygulamayı yeniden başlatın.');
        return;
      }
      
      const result = await window.electronAPI.updateTableOrderAmount(selectedOrder.id, paidAmount);
      
      if (result.success) {
        // Kısmi ödeme için satış kaydı oluştur
        const saleData = {
          orderId: selectedOrder.id,
          totalAmount: paidAmount,
          paymentMethod: `Kısmi Ödeme (${paymentDetails})`,
          tableName: selectedOrder.table_name,
          tableType: selectedOrder.table_type,
          items: orderItems
        };

        const saleResult = await window.electronAPI.createPartialPaymentSale(saleData);
        
        if (saleResult.success) {
          // Kısmi ödeme için fiş oluştur
          const receiptData = {
            sale_id: saleResult.saleId,
            order_id: selectedOrder.id,
            totalAmount: paidAmount,
            paymentMethod: `Kısmi Ödeme (${paymentDetails})`,
            sale_date: new Date().toLocaleDateString('tr-TR'),
            sale_time: new Date().toLocaleTimeString('tr-TR'),
            items: orderItems,
            tableName: selectedOrder.table_name,
            tableType: selectedOrder.table_type,
            isPartialPayment: true
          };

          // Fiş modal'ını göster
          if (onShowReceipt) {
            onShowReceipt(receiptData);
          }
        } else {
          alert('Kısmi ödeme satış kaydı oluşturulamadı: ' + (saleResult.error || 'Bilinmeyen hata'));
        }

        // Modal'ı kapat ve siparişleri yenile
        setShowPartialPaymentModal(false);
        await loadTableOrders();
        
        // Sipariş detaylarını yeniden yükle
        const updatedItems = await window.electronAPI.getTableOrderItems(selectedOrder.id);
        setOrderItems(updatedItems || []);
        
        // Modal'ı tekrar aç
        setShowModal(true);
      } else {
        alert('Kısmi ödeme kaydedilemedi: ' + (result.error || 'Bilinmeyen hata'));
      }
    } catch (error) {
      console.error('Kısmi ödeme kaydedilirken hata:', error);
      alert('Kısmi ödeme kaydedilemedi: ' + error.message);
    }
  };

  // Masa aktar işlemi
  const handleTransferTable = async () => {
    if (!transferSourceTable || !transferTargetTable) {
      alert('Lütfen kaynak ve hedef masayı seçin');
      return;
    }

    if (transferSourceTable.id === transferTargetTable.id) {
      alert('Kaynak ve hedef masa aynı olamaz');
      return;
    }

    if (!window.electronAPI || !window.electronAPI.transferTableOrder) {
      alert('Masa aktarımı API\'si mevcut değil');
      return;
    }

    setTransferring(true);
    try {
      const result = await window.electronAPI.transferTableOrder(
        transferSourceTable.id,
        transferTargetTable.id
      );

      if (result.success) {
        // Başarı mesajı göster
        alert(`✅ Masa başarıyla aktarıldı!\n\nKaynak: ${transferSourceTable.name}\nHedef: ${transferTargetTable.name}\n\nAktarılan sipariş sayısı: ${result.transferredOrders}\nAktarılan ürün sayısı: ${result.transferredItems}`);
        
        // Modal'ı kapat ve siparişleri yenile
        setShowTransferModal(false);
        setTransferSourceTable(null);
        setTransferTargetTable(null);
        await loadTableOrders();
      } else {
        alert('Masa aktarılamadı: ' + (result.error || 'Bilinmeyen hata'));
      }
    } catch (error) {
      console.error('Masa aktarımı hatası:', error);
      alert('Masa aktarılamadı: ' + error.message);
    } finally {
      setTransferring(false);
    }
  };

  // Tüm masaları al (hem iç hem dış)
  const getAllTables = () => {
    return [...insideTables, ...outsideTables];
  };

  // Dolu masaları al (tüm masalar içinden)
  const getOccupiedTables = () => {
    const allTables = getAllTables();
    return allTables.filter(table => getTableOrder(table.id));
  };

  // Boş masaları al (tüm masalar içinden)
  const getEmptyTables = () => {
    const allTables = getAllTables();
    return allTables.filter(table => !getTableOrder(table.id));
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold gradient-text">Masalar</h2>
        <button
          onClick={() => setShowTransferModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-300 flex items-center space-x-2"
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
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg transform scale-105'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
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
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg transform scale-105'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
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
          return (
            <button
              key={table.id}
              onClick={() => handleTableClick(table)}
              className={`table-btn group relative overflow-hidden rounded-md p-1 border transition-all duration-300 hover:shadow-sm hover:scale-105 active:scale-95 aspect-square ${
                hasOrder
                  ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300 hover:border-green-400'
                  : 'bg-gradient-to-br from-white to-purple-50 border-purple-200 hover:border-purple-400'
              }`}
            >
              <div className="flex flex-col items-center justify-center space-y-1 h-full">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow ${
                  hasOrder
                    ? 'bg-gradient-to-br from-green-400 to-emerald-500'
                    : 'bg-gradient-to-br from-purple-400 to-pink-400'
                }`}>
                  {hasOrder ? (
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  )}
                </div>
                <span className="font-bold text-sm text-gray-800 leading-tight">{table.name}</span>
                {hasOrder && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
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
                    ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-400 hover:border-green-500'
                    : 'bg-gradient-to-br from-white to-orange-50 border-orange-300 hover:border-orange-400'
                }`}
              >
                <div className="flex flex-col items-center justify-center space-y-1.5 h-full">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow ${
                    hasOrder
                      ? 'bg-gradient-to-br from-green-400 to-emerald-500'
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
                  {hasOrder && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
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

      {/* Masa Aktar Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[1500] animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl border-2 border-blue-200 rounded-3xl p-8 max-w-2xl w-full mx-4 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Masa Aktar</h3>
              <p className="text-gray-600">Kaynak masadaki tüm siparişleri hedef masaya aktarın</p>
            </div>

            <div className="space-y-6">
              {/* Kaynak Masa Seçimi */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  <span className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Kaynak Masa (Dolu Masalar)</span>
                  </span>
                </label>
                <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-50 rounded-xl">
                  {getOccupiedTables().length === 0 ? (
                    <div className="col-span-5 text-center py-8 text-gray-500">
                      <p>Dolu masa bulunamadı</p>
                    </div>
                  ) : (
                    getOccupiedTables().map((table) => {
                      const order = getTableOrder(table.id);
                      const isInside = table.type === 'inside';
                      return (
                        <button
                          key={table.id}
                          onClick={() => setTransferSourceTable(table)}
                          className={`p-3 rounded-xl border-2 transition-all duration-300 ${
                            transferSourceTable?.id === table.id
                              ? 'bg-gradient-to-br from-green-500 to-emerald-500 text-white border-green-600 shadow-lg transform scale-105'
                              : 'bg-white border-gray-300 hover:border-green-400 hover:bg-green-50'
                          }`}
                        >
                          <div className="text-xs mb-1 opacity-75">
                            {isInside ? '🏠 İç' : '🌳 Dış'}
                          </div>
                          <div className="text-sm font-bold">{table.name}</div>
                          {order && (
                            <div className="text-xs mt-1 opacity-75">
                              ₺{order.total_amount?.toFixed(2) || '0.00'}
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
                {transferSourceTable && (
                  <div className="mt-2 text-sm text-green-600 font-medium">
                    ✓ Seçili: {transferSourceTable.name}
                  </div>
                )}
              </div>

              {/* Ok İşareti */}
              <div className="flex justify-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Hedef Masa Seçimi */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  <span className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Hedef Masa (Boş Masalar)</span>
                  </span>
                </label>
                <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-50 rounded-xl">
                  {getEmptyTables().length === 0 ? (
                    <div className="col-span-5 text-center py-8 text-gray-500">
                      <p>Boş masa bulunamadı</p>
                    </div>
                  ) : (
                    getEmptyTables().map((table) => {
                      const isInside = table.type === 'inside';
                      return (
                        <button
                          key={table.id}
                          onClick={() => setTransferTargetTable(table)}
                          className={`p-3 rounded-xl border-2 transition-all duration-300 ${
                            transferTargetTable?.id === table.id
                              ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white border-blue-600 shadow-lg transform scale-105'
                              : 'bg-white border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                          }`}
                        >
                          <div className="text-xs mb-1 opacity-75">
                            {isInside ? '🏠 İç' : '🌳 Dış'}
                          </div>
                          <div className="text-sm font-bold">{table.name}</div>
                          <div className="text-xs mt-1 opacity-75">Boş</div>
                        </button>
                      );
                    })
                  )}
                </div>
                {transferTargetTable && (
                  <div className="mt-2 text-sm text-blue-600 font-medium">
                    ✓ Seçili: {transferTargetTable.name}
                  </div>
                )}
              </div>
            </div>

            {/* Butonlar */}
            <div className="flex space-x-4 mt-8">
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferSourceTable(null);
                  setTransferTargetTable(null);
                }}
                disabled={transferring}
                className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 hover:text-gray-800 font-semibold text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                İptal
              </button>
              <button
                onClick={handleTransferTable}
                disabled={!transferSourceTable || !transferTargetTable || transferring}
                className="flex-1 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-xl text-white font-bold text-lg transition-all duration-300 hover:shadow-2xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center space-x-2"
              >
                {transferring ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Aktarılıyor...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Masayı Aktar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TablePanel;

