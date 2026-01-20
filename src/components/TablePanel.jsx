import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, onSnapshot, getDocs, doc, updateDoc, setDoc, where, getDoc } from 'firebase/firestore';
import TableOrderModal from './TableOrderModal';
import TablePartialPaymentModal from './TablePartialPaymentModal';
import TableTransferModal from './TableTransferModal';
import OnlineOrderModal from './OnlineOrderModal';
import OnlineProductManagementModal from './OnlineProductManagementModal';
import Toast from './Toast';

const TablePanel = ({ onSelectTable, refreshTrigger, onShowReceipt }) => {
  const [selectedType, setSelectedType] = useState('inside'); // 'inside', 'outside', or 'online'
  const [tableOrders, setTableOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showPartialPaymentModal, setShowPartialPaymentModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info', show: false });
  
  // Online siparişler için ayrı Firebase bağlantısı
  const [onlineOrders, setOnlineOrders] = useState([]);
  const [onlineFirebaseApp, setOnlineFirebaseApp] = useState(null);
  const [onlineFirestore, setOnlineFirestore] = useState(null);
  const [unseenOnlineOrdersCount, setUnseenOnlineOrdersCount] = useState(0);
  const [lastSeenOrderIds, setLastSeenOrderIds] = useState(() => {
    // localStorage'dan yükle
    try {
      const saved = localStorage.getItem('lastSeenOnlineOrderIds');
      if (saved) {
        const ids = JSON.parse(saved);
        return new Set(ids);
      }
    } catch (e) {
      console.warn('lastSeenOrderIds yüklenemedi:', e);
    }
    return new Set();
  });
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState(false);
  const [orderToMarkAsPaid, setOrderToMarkAsPaid] = useState(null);
  const [showOnlineProductManagement, setShowOnlineProductManagement] = useState(false);
  const [isOnlineActive, setIsOnlineActive] = useState(false);
  const [loadingOnlineStatus, setLoadingOnlineStatus] = useState(false);
  const selectedTypeRef = useRef(selectedType);

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

  const outsideTables = Array.from({ length: 24 }, (_, i) => {
    const tableNumber = i + 61; // 61-84
    return {
      id: `outside-${tableNumber}`,
      number: tableNumber,
      type: 'outside',
      name: `Dışarı ${tableNumber}`
    };
  });

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

  // Online Firebase bağlantısını başlat (component mount olduğunda)
  useEffect(() => {
    try {
      const onlineFirebaseConfig = {
        apiKey: "AIzaSyAucyGoXwmQ5nrQLfk5zL5-73ir7u9vbI8",
        authDomain: "makaraonline-5464e.firebaseapp.com",
        projectId: "makaraonline-5464e",
        storageBucket: "makaraonline-5464e.firebasestorage.app",
        messagingSenderId: "1041589485836",
        appId: "1:1041589485836:web:06119973a19da0a14f0929",
        measurementId: "G-MKPPB635ZZ"
      };

      // Online Firebase'i başlat (sadece bu bölüm için)
      const app = initializeApp(onlineFirebaseConfig, 'onlineOrders');
      const db = getFirestore(app);
      setOnlineFirebaseApp(app);
      setOnlineFirestore(db);
      
      // Online siparişleri yükle (her zaman dinle, bildirim badge'i için)
      loadOnlineOrders(db);
      
      // Online aktif durumunu yükle
      loadOnlineActiveStatus(db);
    } catch (error) {
      console.error('Online Firebase başlatılamadı:', error);
      showToast('Online siparişler yüklenemedi', 'error');
    }
    
  }, []); // Sadece component mount olduğunda çalış

  // selectedType değiştiğinde ref'i güncelle
  useEffect(() => {
    selectedTypeRef.current = selectedType;
  }, [selectedType]);

  // Masa tipi değiştiğinde siparişleri yenile
  useEffect(() => {
    if (selectedType !== 'online') {
      loadTableOrders();
    } else {
      // Online sekmesine geçildiğinde, mevcut tüm siparişleri görüldü olarak işaretle
      const currentOrderIds = new Set(onlineOrders.map(o => o.id));
      setLastSeenOrderIds(currentOrderIds);
      setUnseenOnlineOrdersCount(0);
      
      // localStorage'a kaydet
      try {
        localStorage.setItem('lastSeenOnlineOrderIds', JSON.stringify(Array.from(currentOrderIds)));
      } catch (e) {
        console.warn('lastSeenOrderIds kaydedilemedi:', e);
      }
    }
  }, [selectedType, onlineOrders]);

  // Refresh trigger değiştiğinde siparişleri yenile
  useEffect(() => {
    if (refreshTrigger && selectedType !== 'online') {
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

  // Online siparişleri yükle
  const loadOnlineOrders = async (db) => {
    try {
      const ordersRef = collection(db, 'orders');
      
      // Not: where + orderBy birlikte kullanıldığında Firestore composite index gerekiyor
      // Index oluşturmak için: https://console.firebase.google.com/project/makaraonline-5464e/firestore/indexes
      // Şimdilik sadece where kullanıp client-side'da sıralama yapıyoruz (index gerektirmez)
      
      // Hem pending hem de courier siparişlerini göster (pending için)
      const q = query(ordersRef, where('status', '==', 'pending'));
      
      // Real-time listener
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const orders = [];
        const newOrderIds = new Set();
        const previousOrderIds = new Set(onlineOrders.map(o => o.id));
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          const orderId = doc.id;
          newOrderIds.add(orderId);
          
          // Tarih formatlaması - createdAt timestamp'ini kullan
          let formattedDate = '';
          let formattedTime = '';
          
          if (data.createdAt) {
            const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt.seconds * 1000);
            formattedDate = date.toLocaleDateString('tr-TR', { 
              day: '2-digit', 
              month: '2-digit', 
              year: 'numeric' 
            });
            formattedTime = date.toLocaleTimeString('tr-TR', {
              hour: '2-digit',
              minute: '2-digit'
            });
          } else if (data.timestamp) {
            // Fallback: timestamp number ise
            const date = new Date(data.timestamp);
            formattedDate = date.toLocaleDateString('tr-TR', { 
              day: '2-digit', 
              month: '2-digit', 
              year: 'numeric' 
            });
            formattedTime = date.toLocaleTimeString('tr-TR', {
              hour: '2-digit',
              minute: '2-digit'
            });
          }
          
          // Sıralama için timestamp hesapla
          let sortTimestamp = 0;
          if (data.createdAt) {
            sortTimestamp = data.createdAt.toDate ? data.createdAt.toDate().getTime() : (data.createdAt.seconds * 1000);
          } else if (data.timestamp) {
            sortTimestamp = data.timestamp;
          }
          
          orders.push({
            id: orderId,
            ...data,
            // Alan adlarını normalize et
            total_amount: data.total || data.total_amount || 0,
            customer_name: data.name || data.customer_name || '',
            customer_phone: data.phone || data.customer_phone || '',
            customer_address: data.address || data.customer_address || '',
            formattedDate,
            formattedTime,
            _sortTimestamp: sortTimestamp
          });
        });
        
        // Client-side'da createdAt'e göre sırala (en yeni en üstte)
        orders.sort((a, b) => (b._sortTimestamp || 0) - (a._sortTimestamp || 0));
        
        // Yeni siparişleri tespit et (daha önce görülmemiş olanlar)
        if (!isFirstLoad && previousOrderIds.size > 0) {
          const newOrders = orders.filter(order => !previousOrderIds.has(order.id));
          if (newOrders.length > 0) {
            // Yeni sipariş geldi - toast göster (sadece online sekmesinde değilsek)
            if (selectedTypeRef.current !== 'online') {
              showToast(`Yeni Online Sipariş Geldi! (${newOrders.length} adet)`, 'success');
            }
            
            // Görülmemiş sipariş sayısını güncelle (sadece online sekmesinde değilsek)
            if (selectedTypeRef.current !== 'online') {
              setUnseenOnlineOrdersCount(prev => prev + newOrders.length);
            }
          }
        }
        
        // Component mount olduğunda (isFirstLoad true ise), mevcut tüm siparişleri görüldü olarak işaretle
        // Bu, başka bir ekrana gidip geri döndüğünde sayının artmaması için gerekli
        if (isFirstLoad) {
          setIsFirstLoad(false);
          const currentOrderIds = new Set(orders.map(o => o.id));
          setLastSeenOrderIds(currentOrderIds);
          // localStorage'a kaydet
          try {
            localStorage.setItem('lastSeenOnlineOrderIds', JSON.stringify(Array.from(currentOrderIds)));
          } catch (e) {
            console.warn('lastSeenOrderIds kaydedilemedi:', e);
          }
          // İlk yüklemede görülmemiş sayısı 0 olmalı (çünkü hepsi görüldü olarak işaretlendi)
          setUnseenOnlineOrdersCount(0);
        } else {
          // İlk yükleme değilse, görülmemiş sipariş sayısını güncelle
          // lastSeenOrderIds'de olmayan siparişleri say
          const unseenOrders = orders.filter(order => !lastSeenOrderIds.has(order.id));
          
          // Component yeniden mount kontrolü: Eğer lastSeenOrderIds boşsa
          // Component yeniden mount olmuş demektir - mevcut tüm siparişleri görüldü olarak işaretle
          if (lastSeenOrderIds.size === 0 && orders.length > 0) {
            // Component yeniden mount olmuş - mevcut tüm siparişleri görüldü olarak işaretle
            const currentOrderIds = new Set(orders.map(o => o.id));
            setLastSeenOrderIds(currentOrderIds);
            setUnseenOnlineOrdersCount(0);
            try {
              localStorage.setItem('lastSeenOnlineOrderIds', JSON.stringify(Array.from(currentOrderIds)));
            } catch (e) {
              console.warn('lastSeenOrderIds kaydedilemedi:', e);
            }
          } else {
            // Normal güncelleme - görülmemiş sipariş sayısını güncelle
            setUnseenOnlineOrdersCount(unseenOrders.length);
          }
        }
        
        setOnlineOrders(orders);
      }, (error) => {
        console.error('Online siparişler dinlenirken hata:', error);
        // Permission hatası için daha açıklayıcı mesaj
        if (error.code === 'permission-denied') {
          showToast('Firestore izin hatası: Orders collection\'ına okuma izni verilmedi. Firestore Rules\'ı kontrol edin.', 'error');
        } else {
          showToast('Online siparişler güncellenemedi: ' + error.message, 'error');
        }
      });

      return unsubscribe;
    } catch (error) {
      console.error('Online siparişler yüklenemedi:', error);
      if (error.code === 'permission-denied') {
        showToast('Firestore izin hatası: Orders collection\'ına okuma izni verilmedi. Firestore Rules\'ı kontrol edin.', 'error');
      } else {
        showToast('Online siparişler yüklenemedi: ' + error.message, 'error');
      }
    }
  };

  // Belirli bir masa için sipariş var mı kontrol et
  const getTableOrder = (tableId) => {
    // Önce yeni formatı kontrol et
    let order = tableOrders.find(order => order.table_id === tableId && order.status === 'pending');
    
    // Eğer bulunamazsa ve dışarı masası ise eski formatı da kontrol et
    if (!order && tableId.startsWith('outside-')) {
      const tableNumber = parseInt(tableId.replace('outside-', '')) || 0;
      if (tableNumber >= 61 && tableNumber <= 84) {
        // Yeni format (outside-61), eski formatı da kontrol et (outside-1)
        const oldTableNumber = tableNumber - 60; // 61 -> 1, 62 -> 2, etc.
        const oldTableId = `outside-${oldTableNumber}`;
        order = tableOrders.find(order => order.table_id === oldTableId && order.status === 'pending');
      } else if (tableNumber >= 1 && tableNumber <= 24) {
        // Eski format (outside-1), yeni formatı da kontrol et (outside-61)
        const newTableNumber = tableNumber + 60; // 1 -> 61, 2 -> 62, etc.
        const newTableId = `outside-${newTableNumber}`;
        order = tableOrders.find(order => order.table_id === newTableId && order.status === 'pending');
      }
    }
    
    return order;
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
          number: number + 60,
          type: 'outside',
          name: `Dışarı ${number + 60}`
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
    const paymentResult = await new Promise((resolve) => {
      let selectedCampaign = null;
      let showCampaign = false;
      
      const updateModal = () => {
        const originalAmount = selectedOrder.total_amount;
        const discount = selectedCampaign ? (originalAmount * selectedCampaign) / 100 : 0;
        const finalAmount = originalAmount - discount;
        
        const campaignSection = showCampaign ? `
          <div id="campaignSection" class="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 space-y-2 mb-4">
            <p class="text-center font-semibold text-amber-800 mb-3">Kampanya Seçin</p>
            <div class="grid grid-cols-3 gap-2">
              <button class="campaignBtn p-4 rounded-xl font-bold text-lg transition-all ${selectedCampaign === 10 ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg scale-105' : 'bg-white text-amber-700 hover:bg-amber-100 border-2 border-amber-300 hover:scale-105'}" data-percent="10">%10</button>
              <button class="campaignBtn p-4 rounded-xl font-bold text-lg transition-all ${selectedCampaign === 15 ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg scale-105' : 'bg-white text-amber-700 hover:bg-amber-100 border-2 border-amber-300 hover:scale-105'}" data-percent="15">%15</button>
              <button class="campaignBtn p-4 rounded-xl font-bold text-lg transition-all ${selectedCampaign === 20 ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg scale-105' : 'bg-white text-amber-700 hover:bg-amber-100 border-2 border-amber-300 hover:scale-105'}" data-percent="20">%20</button>
              <button class="campaignBtn p-4 rounded-xl font-bold text-lg transition-all ${selectedCampaign === 25 ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg scale-105' : 'bg-white text-amber-700 hover:bg-amber-100 border-2 border-amber-300 hover:scale-105'}" data-percent="25">%25</button>
              <button class="campaignBtn p-4 rounded-xl font-bold text-lg transition-all ${selectedCampaign === 50 ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg scale-105' : 'bg-white text-amber-700 hover:bg-amber-100 border-2 border-amber-300 hover:scale-105'}" data-percent="50">%50</button>
            </div>
            ${selectedCampaign ? `
              <button id="removeCampaignBtn" class="w-full mt-2 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-semibold rounded-lg transition-all">
                Kampanyayı Kaldır
              </button>
            ` : ''}
          </div>
        ` : '';
        
        const amountDisplay = selectedCampaign ? `
          <div class="mb-4 space-y-2">
            <p class="text-sm text-gray-600">Orijinal Tutar</p>
            <p class="text-xl font-semibold text-gray-400 line-through">₺${originalAmount.toFixed(2)}</p>
            <p class="text-sm text-amber-700 font-semibold">Kampanya: %${selectedCampaign} İndirim</p>
            <p class="text-3xl font-bold text-gray-800">₺${finalAmount.toFixed(2)}</p>
            <p class="text-sm text-green-600 font-semibold">İndirim: -₺${discount.toFixed(2)}</p>
          </div>
        ` : `
          <p class="text-lg font-semibold text-gray-800 mb-6">Toplam: ₺${originalAmount.toFixed(2)}</p>
        `;
        
        modal.innerHTML = `
          <div class="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 class="text-xl font-bold text-gray-800 mb-2">Ödeme Yöntemi Seçin</h3>
            <p class="text-sm text-gray-600 mb-4">Masa: ${selectedOrder.table_name}</p>
            ${amountDisplay}
            <div class="grid grid-cols-2 gap-3 mb-3">
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
            <button id="campaignBtn" class="w-full mb-3 p-4 rounded-xl font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
              <div class="flex items-center justify-center space-x-2">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Kampanya Uygula</span>
              </div>
            </button>
            ${campaignSection}
            <button id="cancelBtn" class="w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-semibold transition-all">
              İptal
            </button>
          </div>
        `;
        
        // Event listener'ları yeniden ekle
        modal.querySelector('#cashBtn').onclick = () => {
          document.body.removeChild(modal);
          resolve({ paymentMethod: 'Nakit', campaignPercentage: selectedCampaign });
        };
        
        modal.querySelector('#cardBtn').onclick = () => {
          document.body.removeChild(modal);
          resolve({ paymentMethod: 'Kredi Kartı', campaignPercentage: selectedCampaign });
        };
        
        modal.querySelector('#campaignBtn').onclick = () => {
          showCampaign = !showCampaign;
          updateModal();
        };
        
        if (showCampaign) {
          modal.querySelectorAll('.campaignBtn').forEach(btn => {
            btn.onclick = () => {
              selectedCampaign = parseInt(btn.dataset.percent);
              updateModal();
            };
          });
          
          const removeBtn = modal.querySelector('#removeCampaignBtn');
          if (removeBtn) {
            removeBtn.onclick = () => {
              selectedCampaign = null;
              updateModal();
            };
          }
        }
        
        modal.querySelector('#cancelBtn').onclick = () => {
          document.body.removeChild(modal);
          resolve(null);
        };
      };
      
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      document.body.appendChild(modal);
      updateModal();
    });

    if (!paymentResult) {
      return; // Kullanıcı iptal etti
    }

    const { paymentMethod, campaignPercentage } = paymentResult;

    try {
      const result = await window.electronAPI.completeTableOrder(selectedOrder.id, paymentMethod, campaignPercentage);
      
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
    
    // Online sipariş için özel format
    if (selectedType === 'online') {
      // Online sipariş items'ı adisyon formatına çevir
      const adisyonItems = orderItems.map(item => ({
        id: item.id || item.product_id,
        name: item.name || item.product_name,
        quantity: item.quantity || 1,
        price: item.price || 0,
        isGift: false,
        staff_name: null,
        category_id: null
      }));
      
      // Müşteri ismini al
      const customerName = selectedOrder.customer_name || selectedOrder.name || 'İsimsiz Müşteri';
      
      const adisyonData = {
        items: adisyonItems,
        tableName: `Online Sipariş Müşteri: ${customerName}`, // Format: "Online Sipariş Müşteri: [İsim]"
        tableType: 'online',
        orderNote: selectedOrder.note || selectedOrder.orderNote || selectedOrder.order_note || null,
        sale_date: selectedOrder.formattedDate || new Date().toLocaleDateString('tr-TR'),
        sale_time: selectedOrder.formattedTime || new Date().toLocaleTimeString('tr-TR'),
        cashierOnly: true, // Sadece kasa yazıcısından fiyatlı fiş
        // Online sipariş müşteri bilgileri
        customer_name: selectedOrder.customer_name || selectedOrder.name || null,
        customer_phone: selectedOrder.customer_phone || selectedOrder.phone || null,
        customer_address: selectedOrder.customer_address || selectedOrder.address || null
      };

      try {
        console.log('Online sipariş adisyonu yazdırılıyor...');
        
        const result = await window.electronAPI.printAdisyon(adisyonData);
        
        if (result.success) {
          console.log('Adisyon başarıyla yazdırıldı');
          showToast('Adisyon başarıyla yazdırıldı', 'success');
        } else {
          console.error('Adisyon yazdırılamadı:', result.error);
          showToast('Adisyon yazdırılamadı: ' + (result.error || 'Bilinmeyen hata'), 'error');
        }
      } catch (error) {
        console.error('Adisyon yazdırılırken hata:', error);
        showToast('Adisyon yazdırılamadı: ' + error.message, 'error');
      }
      return;
    }
    
    // Normal masa siparişi için
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

  // Ürünleri Hazırlat - Kategori bazlı yazdırma
  const handlePrepareProducts = async () => {
    if (!selectedOrder || orderItems.length === 0) return;
    
    if (!window.electronAPI || !window.electronAPI.printAdisyon) {
      console.error('printAdisyon API mevcut değil. Lütfen uygulamayı yeniden başlatın.');
      showToast('Hata: Adisyon yazdırma API\'si yüklenemedi. Lütfen uygulamayı yeniden başlatın.', 'error');
      return;
    }
    
    // Online sipariş için kategori bazlı yazdırma
    if (selectedType === 'online') {
      // Tüm ürünleri çek (kategori bilgisi için)
      let allProducts = [];
      if (window.electronAPI.getProducts) {
        try {
          allProducts = await window.electronAPI.getProducts(null);
        } catch (error) {
          console.error('Ürünler yüklenemedi:', error);
        }
      }
      
      // Online sipariş items'ı adisyon formatına çevir ve kategori bilgisini ekle
      const adisyonItems = await Promise.all(orderItems.map(async (item) => {
        const productId = item.id || item.product_id;
        let categoryId = item.category_id || null;
        
        // Eğer kategori bilgisi yoksa, ürün ID'sine göre bul
        if (!categoryId && productId && allProducts.length > 0) {
          const product = allProducts.find(p => p.id === productId);
          if (product) {
            categoryId = product.category_id;
          }
        }
        
        return {
          id: productId,
          name: item.name || item.product_name,
          quantity: item.quantity || 1,
          price: item.price || 0,
          isGift: false,
          staff_name: null,
          category_id: categoryId
        };
      }));
      
      // Müşteri ismini al
      const customerName = selectedOrder.customer_name || selectedOrder.name || 'İsimsiz Müşteri';
      
      const adisyonData = {
        items: adisyonItems,
        tableName: `Online Sipariş Müşteri: ${customerName}`, // Format: "Online Sipariş Müşteri: [İsim]"
        tableType: 'online',
        orderNote: selectedOrder.note || selectedOrder.orderNote || selectedOrder.order_note || null,
        sale_date: selectedOrder.formattedDate || new Date().toLocaleDateString('tr-TR'),
        sale_time: selectedOrder.formattedTime || new Date().toLocaleTimeString('tr-TR'),
        cashierOnly: false, // Kategori bazlı yazdırma için false
        // Online sipariş müşteri bilgileri
        customer_name: selectedOrder.customer_name || selectedOrder.name || null,
        customer_phone: selectedOrder.customer_phone || selectedOrder.phone || null,
        customer_address: selectedOrder.customer_address || selectedOrder.address || null
      };

      try {
        console.log('Online sipariş ürünleri hazırlatılıyor (kategori bazlı)...');
        
        const result = await window.electronAPI.printAdisyon(adisyonData);
        
        if (result.success) {
          console.log('Ürünler kategori bazlı yazıcılara gönderildi');
          showToast('Ürünler hazırlatıldı', 'success');
        } else {
          console.error('Ürünler hazırlatılamadı:', result.error);
          showToast('Ürünler hazırlatılamadı: ' + (result.error || 'Bilinmeyen hata'), 'error');
        }
      } catch (error) {
        console.error('Ürünler hazırlatılırken hata:', error);
        showToast('Ürünler hazırlatılamadı: ' + error.message, 'error');
      }
      return;
    }
  };

  // Siparişi Onayla - Onay modalını göster
  const handleMarkAsPaid = (order) => {
    if (!order || selectedType !== 'online') return;
    setOrderToMarkAsPaid(order);
    setShowPaymentConfirmModal(true);
  };

  // İki koordinat arasındaki mesafeyi hesapla (Haversine formülü - km cinsinden)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Dünya yarıçapı (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Adresi koordinatlara çevir (Nominatim - OpenStreetMap - ÜCRETSİZ)
  // Rate limiting için son istek zamanını sakla
  let lastGeocodeRequest = 0;
  const GEOCODE_DELAY = 1100; // 1.1 saniye (Nominatim rate limit: 1 istek/saniye)
  
  const geocodeAddress = async (address) => {
    try {
      // Rate limiting: Son istekten en az 1.1 saniye geçmeli
      const now = Date.now();
      const timeSinceLastRequest = now - lastGeocodeRequest;
      if (timeSinceLastRequest < GEOCODE_DELAY) {
        await new Promise(resolve => setTimeout(resolve, GEOCODE_DELAY - timeSinceLastRequest));
      }
      lastGeocodeRequest = Date.now();
      
      // Nominatim (OpenStreetMap) - Ücretsiz, API key gerektirmez
      // Rate limit: 1 istek/saniye (User-Agent header zorunlu)
      const nominatimResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'Makara-POS-Kurye-Sistemi/1.0',
            'Accept-Language': 'tr-TR,tr;q=0.9'
          }
        }
      );
      
      if (!nominatimResponse.ok) {
        console.warn('Nominatim isteği başarısız:', nominatimResponse.status);
        return null;
      }
      
      const nominatimData = await nominatimResponse.json();
      
      if (nominatimData && nominatimData.length > 0) {
        return { 
          lat: parseFloat(nominatimData[0].lat), 
          lng: parseFloat(nominatimData[0].lon) 
        };
      } else {
        console.warn('Adres bulunamadı:', address);
        return null;
      }
    } catch (error) {
      console.error('Geocoding hatası:', error);
      return null;
    }
  };

  // En yakın kuryeyi bul
  const findNearestCourier = async (targetLat, targetLng) => {
    if (!onlineFirestore) return null;

    try {
      // Tüm aktif kuryelerin konumlarını al
      const locationsRef = collection(onlineFirestore, 'courier_locations');
      const snapshot = await getDocs(locationsRef);
      
      let nearestCourier = null;
      let minDistance = Infinity;

      snapshot.forEach((docSnap) => {
        const locationData = docSnap.data();
        
        // Sadece online kuryeleri kontrol et
        if (locationData.isOnline && locationData.latitude && locationData.longitude) {
          const distance = calculateDistance(
            targetLat,
            targetLng,
            locationData.latitude,
            locationData.longitude
          );
          
          if (distance < minDistance) {
            minDistance = distance;
            nearestCourier = locationData.name;
          }
        }
      });

      return nearestCourier;
    } catch (error) {
      console.error('En yakın kurye bulunurken hata:', error);
      return null;
    }
  };

  // Siparişi Onayla - Onaylandıktan sonra en yakın kuryeye gönder
  const confirmMarkAsPaid = async () => {
    if (!orderToMarkAsPaid || selectedType !== 'online') return;
    
    if (!onlineFirestore) {
      showToast('Firebase bağlantısı bulunamadı', 'error');
      setShowPaymentConfirmModal(false);
      setOrderToMarkAsPaid(null);
      return;
    }

    try {
      // Sipariş adresini al
      const address = orderToMarkAsPaid.customer_address || orderToMarkAsPaid.address || '';
      
      if (!address) {
        showToast('Sipariş adresi bulunamadı', 'error');
        return;
      }

      // Adresi koordinatlara çevir
      // Önce adresin zaten koordinat formatında olup olmadığını kontrol et
      let coordinates = null;
      
      // Koordinat formatı kontrolü: "37.86233187486326, 32.47140102577743" veya benzeri
      const coordMatch = address.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
      if (coordMatch) {
        // Zaten koordinat formatında
        coordinates = {
          lat: parseFloat(coordMatch[1]),
          lng: parseFloat(coordMatch[2])
        };
        console.log('Adres zaten koordinat formatında:', coordinates);
      } else {
        // Adresi koordinatlara çevir
        showToast('Adres konumuna çevriliyor...', 'info');
        coordinates = await geocodeAddress(address);
        
        if (!coordinates) {
          showToast('Adres koordinatlara çevrilemedi. Lütfen daha sonra tekrar deneyin.', 'error');
          setShowPaymentConfirmModal(false);
          setOrderToMarkAsPaid(null);
          return; // Koordinat bulunamazsa işlemi durdur
        }
      }
      
      // En yakın kuryeyi bul
      showToast('En yakın kurye aranıyor...', 'info');
      const nearestCourier = await findNearestCourier(coordinates.lat, coordinates.lng);
      
      if (!nearestCourier) {
        showToast('Aktif kurye bulunamadı. Lütfen kurye ekleyin veya kuryelerin giriş yaptığından emin olun.', 'error');
        setShowPaymentConfirmModal(false);
        setOrderToMarkAsPaid(null);
        return; // Kurye bulunamazsa işlemi durdur
      }
      
      // Siparişi en yakın kuryeye ata
      const orderRef = doc(onlineFirestore, 'orders', orderToMarkAsPaid.id);
      await updateDoc(orderRef, {
        status: 'courier',
        assignedCourierId: nearestCourier,
        deliveryCoordinates: {
          latitude: coordinates.lat,
          longitude: coordinates.lng
      }
      });
      
      console.log(`✅ Sipariş en yakın kuryeye atandı: ${nearestCourier}`, orderToMarkAsPaid.id);
      showToast(`Sipariş ${nearestCourier} kuryesine atandı`, 'success');
      
      console.log('Online sipariş kurye sistemine gönderildi:', orderToMarkAsPaid.id);
      
      // Satış geçmişine kaydet
      if (window.electronAPI && window.electronAPI.createSale) {
        try {
          // Online sipariş items'ını createSale formatına çevir
          const saleItems = (orderToMarkAsPaid.items || []).map(item => ({
            id: item.id || item.product_id || `item-${Date.now()}-${Math.random()}`,
            name: item.name || item.product_name || 'Bilinmeyen Ürün',
            quantity: item.quantity || 1,
            price: item.price || 0,
            isGift: false // Online siparişlerde ikram yok
          }));

          // Ödeme yöntemini belirle
          const paymentMethod = orderToMarkAsPaid.paymentMethod === 'card' 
            ? 'Online Satış (Kart)' 
            : orderToMarkAsPaid.paymentMethod === 'cash'
            ? 'Online Satış (Nakit)'
            : 'Online Satış';

          const saleData = {
            items: saleItems,
            totalAmount: orderToMarkAsPaid.total_amount || orderToMarkAsPaid.total || 0,
            paymentMethod: paymentMethod,
            orderNote: orderToMarkAsPaid.note || orderToMarkAsPaid.orderNote || orderToMarkAsPaid.order_note || null,
            staff_name: null // Online siparişlerde personel yok
          };

          const saleResult = await window.electronAPI.createSale(saleData);
          
          if (saleResult.success) {
            console.log('✅ Online satış geçmişe kaydedildi:', saleResult.saleId);
          } else {
            console.error('❌ Satış geçmişe kaydedilemedi:', saleResult.error);
            showToast('Satış geçmişe kaydedilemedi: ' + (saleResult.error || 'Bilinmeyen hata'), 'error');
          }
        } catch (saleError) {
          console.error('Satış geçmişe kaydetme hatası:', saleError);
          showToast('Satış geçmişe kaydedilemedi: ' + saleError.message, 'error');
        }
      }
      
      showToast('Sipariş kurye sistemine gönderildi', 'success');
      
      // Modal'ları kapat
      setShowPaymentConfirmModal(false);
      setOrderToMarkAsPaid(null);
      
      // Eğer modal açıksa ve aynı siparişse modal'ı kapat
      if (showModal && selectedOrder && selectedOrder.id === orderToMarkAsPaid.id) {
        setShowModal(false);
        setSelectedOrder(null);
        setOrderItems([]);
      }
      
      // Siparişler otomatik olarak güncellenecek (real-time listener sayesinde)
    } catch (error) {
      console.error('Ödeme alındı işaretlenirken hata:', error);
      showToast('Ödeme alındı işaretlenemedi: ' + error.message, 'error');
      setShowPaymentConfirmModal(false);
      setOrderToMarkAsPaid(null);
    }
  };

  // İptal Et - Online siparişi iptal et (ödemeyi alınmış olarak işaretleme)
  const handleCancelOrder = () => {
    // Onay modalını göster
    setShowCancelConfirmModal(true);
  };

  // Online aktif durumunu yükle
  const loadOnlineActiveStatus = async (db) => {
    try {
      const activeRef = doc(db, 'active', 'dGRsJ5V5lgHcpRMXwDm2');
      const activeDoc = await getDoc(activeRef);
      
      if (activeDoc.exists()) {
        const data = activeDoc.data();
        setIsOnlineActive(data.is_active === true);
      } else {
        setIsOnlineActive(false);
      }
    } catch (error) {
      console.error('Online aktif durumu yüklenemedi:', error);
      setIsOnlineActive(false);
    }
  };

  // Online aktif durumunu güncelle
  const handleToggleOnlineActive = async () => {
    if (!onlineFirestore) {
      showToast('Firebase bağlantısı bulunamadı', 'error');
      return;
    }

    setLoadingOnlineStatus(true);
    try {
      const newStatus = !isOnlineActive;
      const activeRef = doc(onlineFirestore, 'active', 'dGRsJ5V5lgHcpRMXwDm2');
      
      await setDoc(activeRef, {
        is_active: newStatus
      }, { merge: true });

      setIsOnlineActive(newStatus);
      showToast(newStatus ? 'Online siparişler aktif edildi' : 'Online siparişler pasif edildi', 'success');
    } catch (error) {
      console.error('Online aktif durumu güncellenemedi:', error);
      showToast('Durum güncellenemedi: ' + error.message, 'error');
    } finally {
      setLoadingOnlineStatus(false);
    }
  };

  // İptal işlemini onayla
  const confirmCancelOrder = async () => {
    if (!selectedOrder || selectedType !== 'online') return;
    
    if (!onlineFirestore) {
      showToast('Firebase bağlantısı bulunamadı', 'error');
      setShowCancelConfirmModal(false);
      return;
    }

    try {
      // Firebase'de sipariş status'unu 'cancelled' olarak güncelle
      const orderRef = doc(onlineFirestore, 'orders', selectedOrder.id);
      await updateDoc(orderRef, {
        status: 'cancelled'
      });
      
      console.log('Online sipariş iptal edildi:', selectedOrder.id);
      showToast('Sipariş iptal edildi', 'success');
      
      // Modal'ları kapat
      setShowCancelConfirmModal(false);
      setShowModal(false);
      setSelectedOrder(null);
      setOrderItems([]);
      
      // Siparişler otomatik olarak güncellenecek (real-time listener sayesinde)
    } catch (error) {
      console.error('Sipariş iptal edilirken hata:', error);
      showToast('Sipariş iptal edilemedi: ' + error.message, 'error');
      setShowCancelConfirmModal(false);
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
      
      // Sipariş bilgisini de güncelle (kalan tutar için önemli)
      const updatedOrders = await window.electronAPI.getTableOrders();
      const updatedOrder = updatedOrders.find(o => o.id === selectedOrder.id);
      if (updatedOrder) {
        setSelectedOrder(updatedOrder);
      }
      
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

        <button
          onClick={() => {
            setSelectedType('online');
          }}
          className={`relative px-8 py-4 rounded-xl font-bold transition-all duration-300 text-lg ${
            selectedType === 'online'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg transform scale-105'
              : 'bg-purple-50 text-purple-600 hover:bg-purple-100 hover:text-purple-700'
          }`}
        >
          <div className="flex items-center space-x-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <span>Online</span>
          </div>
          {/* Bildirim Badge */}
          {unseenOnlineOrdersCount > 0 && (
            <span className="absolute -top-2 -right-2 min-w-[24px] h-6 px-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg animate-pulse border-2 border-white">
              {unseenOnlineOrdersCount > 99 ? '99+' : unseenOnlineOrdersCount}
            </span>
          )}
        </button>
      </div>

      {/* Online Siparişler - Kart Görünümü */}
      {selectedType === 'online' ? (
        <div className="space-y-4">
          {/* Online Ürün Yönetimi Butonu */}
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowOnlineProductManagement(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-200 flex items-center space-x-2 shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <span>Online Ürün Yönetimi</span>
            </button>
          </div>

          {/* Online Sipariş Aktif/Pasif Switch - Üstte */}
          <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 rounded-2xl p-6 border-2 border-purple-200 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${
                  isOnlineActive 
                    ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                    : 'bg-gradient-to-br from-gray-400 to-gray-500'
                }`}>
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">
                    {isOnlineActive ? 'Online Sipariş Aktif' : 'Online Sipariş Pasif'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {isOnlineActive 
                      ? 'Müşteriler online sipariş verebilir' 
                      : 'Online siparişler şu anda kapalı'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleToggleOnlineActive}
                disabled={loadingOnlineStatus}
                className={`relative inline-flex h-16 w-32 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-4 focus:ring-purple-300 focus:ring-offset-2 shadow-xl ${
                  isOnlineActive
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                    : 'bg-gradient-to-r from-gray-400 to-gray-500'
                } ${loadingOnlineStatus ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`inline-block h-14 w-14 transform rounded-full bg-white transition-transform duration-300 shadow-lg ${
                    isOnlineActive ? 'translate-x-[70px]' : 'translate-x-1'
                  }`}
                />
                {loadingOnlineStatus && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                  </div>
                )}
              </button>
            </div>
          </div>
          
          {onlineOrders.length === 0 ? (
            <div className="text-center py-12 bg-white/50 backdrop-blur-sm rounded-2xl border border-gray-200">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-gray-600 font-medium text-lg">Henüz online sipariş bulunmuyor</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {onlineOrders.map((order) => (
                <div
                  key={order.id}
                  className="group relative bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-200/60 cursor-pointer transform hover:-translate-y-1 overflow-hidden"
                  onClick={() => {
                    setSelectedOrder(order);
                    setOrderItems(order.items || []);
                    setShowModal(true);
                  }}
                >
                  {/* Subtle gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-purple-500/0 group-hover:from-indigo-500/5 group-hover:to-purple-500/5 transition-all duration-300 pointer-events-none" />
                  
                  {/* Modern Kart Tasarımı */}
                  <div className="relative p-6">
                    {/* Header with status badge */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-lg font-bold text-slate-900 truncate">
                              {order.customer_name || order.name || 'İsimsiz Müşteri'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-500 ml-12">
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="font-medium">{order.formattedDate}</span>
                          <span className="text-slate-300">•</span>
                          <span>{order.formattedTime}</span>
                        </div>
                      </div>
                      {order.status === 'pending' && (
                        <span className="px-3 py-1.5 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 rounded-xl text-xs font-semibold border border-amber-200/60 shadow-sm whitespace-nowrap">
                          Beklemede
                        </span>
                      )}
                      {order.status === 'completed' && (
                        <span className="px-3 py-1.5 bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 rounded-xl text-xs font-semibold border border-emerald-200/60 shadow-sm whitespace-nowrap">
                          Tamamlandı
                        </span>
                      )}
                    </div>
                    
                    {/* Divider */}
                    <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent mb-4" />
                    
                    {/* Footer with total */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                          <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Toplam</span>
                      </div>
                      <p className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                        ₺{(order.total_amount || order.total || 0).toFixed(2)}
                      </p>
                    </div>
                    
                    {/* Siparişi Onayla Butonu - Sadece pending siparişler için */}
                    {order.status === 'pending' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Kart tıklamasını engelle
                          handleMarkAsPaid(order);
                        }}
                        className="w-full px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white font-semibold text-xs rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow border border-green-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Siparişi Onayla</span>
                      </button>
                    )}
                    
                    {/* Hover indicator */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
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
        </>
      )}

      {/* Online Sipariş Detay Modal */}
      {showModal && selectedOrder && selectedType === 'online' && (
        <OnlineOrderModal
          order={selectedOrder}
          items={orderItems}
          onClose={() => {
            setShowModal(false);
            setSelectedOrder(null);
            setOrderItems([]);
          }}
          onRequestAdisyon={handleRequestAdisyon}
          onPrepareProducts={handlePrepareProducts}
          onCancelOrder={handleCancelOrder}
        />
      )}

      {/* Masa Sipariş Detay Modal */}
      {showModal && selectedOrder && selectedType !== 'online' && (
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

      {/* Ödeme Onay Modal - Modern ve Profesyonel */}
      {showPaymentConfirmModal && orderToMarkAsPaid && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[2000] animate-fade-in px-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl transform animate-scale-in relative overflow-hidden border border-gray-100">
            {/* Üst gradient çizgi */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-green-500 via-emerald-500 to-green-500"></div>
            
            {/* İkon */}
            <div className="flex items-center justify-center mb-6">
              <div className="w-24 h-24 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl flex items-center justify-center border-2 border-green-100 shadow-lg">
                <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            {/* Başlık ve Açıklama */}
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Siparişi Onayla</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                Bu online siparişi onaylayıp kurye sistemine göndermek istediğinizden <span className="font-semibold text-gray-900">emin misiniz?</span>
              </p>
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                <div className="space-y-2">
                  <p className="text-sm text-gray-700 font-medium">
                    <span className="font-semibold">Müşteri:</span> {orderToMarkAsPaid.customer_name || orderToMarkAsPaid.name || 'İsimsiz'}
                  </p>
                  <p className="text-lg font-bold text-green-700">
                    <span className="font-semibold">Toplam:</span> ₺{(orderToMarkAsPaid.total_amount || orderToMarkAsPaid.total || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Butonlar */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setShowPaymentConfirmModal(false);
                  setOrderToMarkAsPaid(null);
                }}
                className="flex-1 py-4 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 rounded-xl text-gray-700 hover:text-gray-900 font-bold text-lg transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
              >
                Vazgeç
              </button>
              <button
                onClick={confirmMarkAsPaid}
                className="flex-1 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl text-white font-bold text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Onayla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Online Ürün Yönetimi Modal */}
      {showOnlineProductManagement && (
        <OnlineProductManagementModal
          onClose={() => setShowOnlineProductManagement(false)}
        />
      )}

      {/* İptal Onay Modal - Modern ve Profesyonel */}
      {showCancelConfirmModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[2000] animate-fade-in px-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl transform animate-scale-in relative overflow-hidden border border-gray-100">
            {/* Üst gradient çizgi */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 via-pink-500 to-red-500"></div>
            
            {/* İkon */}
            <div className="flex items-center justify-center mb-6">
              <div className="w-24 h-24 bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl flex items-center justify-center border-2 border-red-100 shadow-lg">
                <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>

            {/* Başlık ve Açıklama */}
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Siparişi İptal Et</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                Bu online siparişi iptal etmek istediğinizden <span className="font-semibold text-gray-900">emin misiniz?</span>
              </p>
              <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-4 border border-red-100">
                <p className="text-sm text-red-700 font-medium flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Bu işlem geri alınamaz
                </p>
              </div>
            </div>

            {/* Butonlar */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowCancelConfirmModal(false)}
                className="flex-1 py-4 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 rounded-xl text-gray-700 hover:text-gray-900 font-bold text-lg transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
              >
                Vazgeç
              </button>
              <button
                onClick={confirmCancelOrder}
                className="flex-1 py-4 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 rounded-xl text-white font-bold text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                İptal Et
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TablePanel;
