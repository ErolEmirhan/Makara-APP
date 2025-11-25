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

  const insideTables = Array.from({ length: 20 }, (_, i) => ({
    id: `inside-${i + 1}`,
    number: i + 1,
    type: 'inside',
    name: `İç Masa ${i + 1}`
  }));

  const outsideTables = Array.from({ length: 20 }, (_, i) => ({
    id: `outside-${i + 1}`,
    number: i + 1,
    type: 'outside',
    name: `Dış Masa ${i + 1}`
  }));

  const tables = selectedType === 'inside' ? insideTables : outsideTables;

  // Masa siparişlerini yükle
  useEffect(() => {
    loadTableOrders();
  }, []);

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
      category_id: null // Kategori bilgisi item'da yoksa sonra eklenebilir
    }));
    
    const adisyonData = {
      items: adisyonItems,
      tableName: selectedOrder.table_name,
      tableType: selectedOrder.table_type,
      orderNote: null, // Order'da order_note yoksa null
      sale_date: selectedOrder.order_date || new Date().toLocaleDateString('tr-TR'),
      sale_time: selectedOrder.order_time || new Date().toLocaleTimeString('tr-TR')
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

  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold mb-4 gradient-text">Masalar</h2>
      
      {/* Masa Tipi Seçimi */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setSelectedType('inside')}
          className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
            selectedType === 'inside'
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg transform scale-105'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>İç Masalar ({insideTables.length} adet)</span>
          </div>
        </button>
        
        <button
          onClick={() => setSelectedType('outside')}
          className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
            selectedType === 'outside'
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg transform scale-105'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span>Dış Masalar ({outsideTables.length} adet)</span>
          </div>
        </button>
      </div>

      {/* Masa Grid */}
      <div className="grid grid-cols-5 gap-4">
        {tables.map((table) => {
          const hasOrder = getTableOrder(table.id);
          return (
            <button
              key={table.id}
              onClick={() => handleTableClick(table)}
              className={`table-btn group relative overflow-hidden rounded-2xl p-6 border-2 transition-all duration-300 hover:shadow-xl hover:scale-105 active:scale-95 ${
                hasOrder
                  ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300 hover:border-green-400'
                  : 'bg-gradient-to-br from-white to-purple-50 border-purple-200 hover:border-purple-400'
              }`}
            >
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg group-hover:shadow-2xl transition-shadow ${
                  hasOrder
                    ? 'bg-gradient-to-br from-green-400 to-emerald-500'
                    : 'bg-gradient-to-br from-purple-400 to-pink-400'
                }`}>
                  {hasOrder ? (
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  )}
                </div>
                <span className="font-bold text-lg text-gray-800">{table.name}</span>
                <span className={`text-xs font-medium ${
                  hasOrder ? 'text-green-600' : 'text-gray-500'
                }`}>
                  {hasOrder ? 'Ürünleri Gör' : 'Sipariş Oluştur'}
                </span>
                {hasOrder && (
                  <span className="absolute top-2 right-2 w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                )}
              </div>
            </button>
          );
        })}
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
          onRequestAdisyon={handleRequestAdisyon}
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
    </div>
  );
};

export default TablePanel;

