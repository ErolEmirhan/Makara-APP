import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { initializeApp, getApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, onSnapshot, getDocs, doc, updateDoc, setDoc, where, deleteDoc, serverTimestamp } from 'firebase/firestore';
import TableOrderModal from './TableOrderModal';
import TablePartialPaymentModal from './TablePartialPaymentModal';
import TableTransferModal from './TableTransferModal';
import TableMergeModal from './TableMergeModal';
import OnlineOrderModal from './OnlineOrderModal';
import OnlineProductManagementModal from './OnlineProductManagementModal';
import Toast from './Toast';
import Spinner from './Spinner';
import orderSound from '../sound/order.mp3';

const TablePanel = ({ onSelectTable, refreshTrigger, onShowReceipt }) => {
  const [selectedType, setSelectedType] = useState('inside'); // 'inside', 'outside', or 'online'
  const [tableOrders, setTableOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showPartialPaymentModal, setShowPartialPaymentModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
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
  const [showPaidOrders, setShowPaidOrders] = useState(false);
  const [paidOrders, setPaidOrders] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOnlineActive, setIsOnlineActive] = useState(false);
  const [loadingOnlineStatus, setLoadingOnlineStatus] = useState(false);
  const [showSoundModal, setShowSoundModal] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const [soundVolume, setSoundVolume] = useState(100);
  const [isConfirmingOrder, setIsConfirmingOrder] = useState(false);
  const [togglingPreparingId, setTogglingPreparingId] = useState(null);
  const selectedTypeRef = useRef(selectedType);
  // Geçmiş Adisyon modal
  const [showAdisyonModal, setShowAdisyonModal] = useState(false);
  const [recentSales, setRecentSales] = useState([]);
  const [loadingRecentSales, setLoadingRecentSales] = useState(false);
  const [selectedSaleForAdisyon, setSelectedSaleForAdisyon] = useState(null);
  const [expandedOrderIds, setExpandedOrderIds] = useState(() => new Set());
  const [adisyonLoadingOrderId, setAdisyonLoadingOrderId] = useState(null);
  const [prepareLoadingOrderId, setPrepareLoadingOrderId] = useState(null);
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const [adisyonSuccessOrderId, setAdisyonSuccessOrderId] = useState(null);
  const [prepareSuccessOrderId, setPrepareSuccessOrderId] = useState(null);
  const [isCancelSuccess, setIsCancelSuccess] = useState(false);
  const loadingOverlayStartRef = useRef(0);
  const OVERLAY_MIN_MS = 2000;
  const SUCCESS_OVERLAY_MS = 2200;
  const [orderTimeTick, setOrderTimeTick] = useState(0);

  const showToast = (message, type = 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  const parseDateTime = useCallback((dateStr, timeStr) => {
    if (!dateStr || !timeStr) return null;
    try {
      const [day, month, year] = dateStr.split('.');
      const [hour, minute, second] = timeStr.split(':');
      return new Date(year, month - 1, day, hour || 0, minute || 0, second || 0);
    } catch (e) {
      return null;
    }
  }, []);

  const groupPartialPayments = useCallback((sales) => {
    const grouped = {};
    const standalone = [];
    const sortedSales = [...sales].sort((a, b) => {
      const dateA = `${a.sale_date || ''} ${a.sale_time || ''}`;
      const dateB = `${b.sale_date || ''} ${b.sale_time || ''}`;
      return dateA.localeCompare(dateB);
    });
    const tableGroups = {};
    sortedSales.forEach(sale => {
      if (sale.table_name && sale.sale_date && sale.sale_time && sale.payment_method) {
        const tableKey = `${sale.table_name || ''}_${sale.table_type || ''}`;
        if (!tableGroups[tableKey]) tableGroups[tableKey] = [];
        tableGroups[tableKey].push(sale);
      } else {
        standalone.push(sale);
      }
    });
    Object.keys(tableGroups).forEach(tableKey => {
      const tableSales = tableGroups[tableKey];
      const sessions = [];
      let currentSession = [];
      for (let i = 0; i < tableSales.length; i++) {
        const sale = tableSales[i];
        const saleDateTime = parseDateTime(sale.sale_date, sale.sale_time);
        const itemCount = sale.items_array && Array.isArray(sale.items_array)
          ? sale.items_array.length
          : (sale.items ? sale.items.split(',').length : 0);
        const isTableClosingSale = itemCount >= 2;
        if (currentSession.length === 0) {
          currentSession.push(sale);
        } else {
          const prevSale = currentSession[currentSession.length - 1];
          const prevDateTime = parseDateTime(prevSale.sale_date, prevSale.sale_time);
          const prevItemCount = prevSale.items_array && Array.isArray(prevSale.items_array)
            ? prevSale.items_array.length
            : (prevSale.items ? prevSale.items.split(',').length : 0);
          const prevIsTableClosingSale = prevItemCount >= 2;
          if (prevIsTableClosingSale) {
            sessions.push([...currentSession]);
            currentSession = [sale];
          } else if (saleDateTime && prevDateTime) {
            const diffMinutes = (saleDateTime - prevDateTime) / (1000 * 60);
            if (diffMinutes > 30) {
              sessions.push([...currentSession]);
              currentSession = [sale];
            } else {
              currentSession.push(sale);
            }
          } else {
            currentSession.push(sale);
          }
        }
      }
      if (currentSession.length > 0) sessions.push(currentSession);
      sessions.forEach((session, sessionIndex) => {
        if (session.length === 1) {
          standalone.push(session[0]);
          return;
        }
        const sessionKey = `${tableKey}_session_${sessionIndex}`;
        if (session.length > 0) {
          const firstSale = session[0];
          const lastSale = session[session.length - 1];
          grouped[sessionKey] = {
            id: firstSale.id,
            table_name: firstSale.table_name,
            table_type: firstSale.table_type,
            sale_date: firstSale.sale_date,
            sale_time: firstSale.sale_time,
            last_sale_date: lastSale.sale_date,
            last_sale_time: lastSale.sale_time,
            payment_methods: new Set(),
            total_amount: 0,
            items_array: [],
            staff_names: new Set(),
            original_sales: []
          };
          session.forEach(sale => {
            grouped[sessionKey].total_amount += parseFloat(sale.total_amount || 0);
            grouped[sessionKey].payment_methods.add(sale.payment_method);
            if (sale.items_array && Array.isArray(sale.items_array)) {
              grouped[sessionKey].items_array.push(...sale.items_array);
            } else if (sale.items) {
              if (!grouped[sessionKey].items_strings) grouped[sessionKey].items_strings = [];
              grouped[sessionKey].items_strings.push(sale.items);
            }
            if (sale.staff_name) grouped[sessionKey].staff_names.add(sale.staff_name);
            grouped[sessionKey].original_sales.push(sale);
          });
        }
      });
    });
    const groupedSales = Object.values(grouped).map(group => {
      let itemsText = '';
      if (group.items_array && group.items_array.length > 0) {
        const itemMap = {};
        group.items_array.forEach(item => {
          const itemKey = `${item.product_id || item.product_name}_${item.price}`;
          if (!itemMap[itemKey]) {
            itemMap[itemKey] = {
              product_id: item.product_id,
              product_name: item.product_name,
              price: item.price,
              quantity: 0,
              isGift: item.isGift || false
            };
          }
          itemMap[itemKey].quantity += (item.quantity || 0);
          if (item.isGift) itemMap[itemKey].isGift = true;
        });
        itemsText = Object.values(itemMap).map(item => {
          const giftText = item.isGift ? ' (İKRAM)' : '';
          return `${item.product_name} x${item.quantity}${giftText}`;
        }).join(', ');
        group.items_array = Object.values(itemMap);
      } else if (group.items_strings && group.items_strings.length > 0) {
        itemsText = group.items_strings.join(', ');
      }
      const paymentMethods = Array.from(group.payment_methods);
      const paymentMethodText = paymentMethods.length > 1
        ? `${paymentMethods.join(' + ')} (Toplam)`
        : paymentMethods[0] || 'Bilinmiyor';
      return {
        id: group.id,
        table_name: group.table_name,
        table_type: group.table_type,
        sale_date: group.sale_date,
        sale_time: group.sale_time,
        last_sale_date: group.last_sale_date,
        last_sale_time: group.last_sale_time,
        payment_method: paymentMethodText,
        total_amount: group.total_amount,
        items: itemsText,
        items_array: group.items_array || [],
        staff_name: Array.from(group.staff_names).join(', ') || null,
        isGrouped: true,
        original_sales: group.original_sales
      };
    });
    // Masanın sonlandırılma tarihine göre sırala (en yeni önce) – parseDateTime ile doğru tarih karşılaştırması
    const allSales = [...groupedSales, ...standalone].sort((a, b) => {
      const dateStrA = a.isGrouped && a.last_sale_date && a.last_sale_time
        ? [a.last_sale_date, a.last_sale_time]
        : [a.sale_date, a.sale_time];
      const dateStrB = b.isGrouped && b.last_sale_date && b.last_sale_time
        ? [b.last_sale_date, b.last_sale_time]
        : [b.sale_date, b.sale_time];
      const timeA = parseDateTime(dateStrA[0], dateStrA[1])?.getTime() ?? 0;
      const timeB = parseDateTime(dateStrB[0], dateStrB[1])?.getTime() ?? 0;
      return timeB - timeA; // Sonlandırılma tarihi en yeni olan önce
    });
    return allSales;
  }, [parseDateTime]);

  const insideTables = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    id: `inside-${i + 1}`,
    number: i + 1,
    type: 'inside',
    name: `İçeri ${i + 1}`
  })), []);

  const outsideTables = useMemo(() => Array.from({ length: 24 }, (_, i) => {
    const tableNumber = i + 61; // 61-84
    return {
      id: `outside-${tableNumber}`,
      number: tableNumber,
      type: 'outside',
      name: `Dışarı ${tableNumber}`
    };
  }), []);

  // Paket masaları (hem içeri hem dışarı için)
  const packageTables = useMemo(() => Array.from({ length: 5 }, (_, i) => ({
    id: `package-${selectedType}-${i + 1}`,
    number: i + 1,
    type: selectedType,
    name: `Paket ${i + 1}`
  })), [selectedType]);

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

      // Online Firebase'i başlat (App.jsx zaten 'onlineOrders' ile başlatmış olabilir)
      let app;
      try { app = getApp('onlineOrders'); } catch { app = initializeApp(onlineFirebaseConfig, 'onlineOrders'); }
      const db = getFirestore(app);
      setOnlineFirebaseApp(app);
      setOnlineFirestore(db);
      
      // Online siparişleri yükle (her zaman dinle, bildirim badge'i için)
      loadOnlineOrders(db);
      
      // Online aktif durumunu dinle (manuel + otomatik 12:30/23:30 değişiklikleri anında yansır)
      const unsubActive = loadOnlineActiveStatus(db);
      return () => { unsubActive?.(); };
    } catch (error) {
      console.error('Online Firebase başlatılamadı:', error);
      showToast('Online siparişler yüklenemedi', 'error');
    }
  }, []); // Sadece component mount olduğunda çalış

  // Ses ayarları modalı açıldığında localStorage'dan yükle
  useEffect(() => {
    if (showSoundModal) {
      setSoundMuted(localStorage.getItem('onlineOrderSoundMuted') === 'true');
      setSoundVolume(Math.round((parseFloat(localStorage.getItem('onlineOrderSoundVolume') || '1') * 100)));
    }
  }, [showSoundModal]);

  // selectedType değiştiğinde ref'i güncelle
  useEffect(() => {
    selectedTypeRef.current = selectedType;
  }, [selectedType]);

  // Sipariş kartlarındaki "X dk önce" güncellemesi (dakikada bir)
  useEffect(() => {
    if (selectedType !== 'online' || onlineOrders.length === 0) return;
    const id = setInterval(() => setOrderTimeTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, [selectedType, onlineOrders.length]);

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

  // Backend masa güncellemesi (sonlandırma, aktar, birleştir, kısmi ödeme) – listeyi anında güncelle
  useEffect(() => {
    if (!window.electronAPI?.onTableOrderUpdated) return;
    const unsubscribe = window.electronAPI.onTableOrderUpdated(() => {
      loadTableOrders();
    });
    return () => { unsubscribe?.(); };
  }, []);

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
      
      // Real-time listener - PERFORMANS optimize
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const orders = [];
        const newOrderIds = new Set();
        const previousOrderIds = new Set(onlineOrders.map(o => o.id));
        
        // PERFORMANS: forEach yerine for-of (biraz daha hızlı)
        for (const doc of snapshot.docs) {
          const data = doc.data();
          const orderId = doc.id;
          
          // İptal edilmiş siparişleri filtrele
          if (data.is_decline === true) continue;
          
          newOrderIds.add(orderId);
          
          // PERFORMANS: Tarih formatlaması cache'lenebilir ama karmaşık, basitleştir
          let formattedDate = '';
          let formattedTime = '';
          let sortTimestamp = 0;
          
          if (data.createdAt) {
            const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt.seconds * 1000);
            sortTimestamp = date.getTime();
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
            sortTimestamp = data.timestamp;
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
          
          orders.push({
            id: orderId,
            ...data,
            total_amount: data.total || data.total_amount || 0,
            customer_name: data.name || data.customer_name || '',
            customer_phone: data.phone || data.customer_phone || '',
            customer_address: data.address || data.customer_address || '',
            formattedDate,
            formattedTime,
            _sortTimestamp: sortTimestamp
          });
        }
        
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
        
        // PERFORMANS: Sadece değişiklik varsa state güncelle
        setOnlineOrders(prev => {
          if (prev.length !== orders.length) return orders;
          const hasChange = orders.some((o, i) => !prev[i] || prev[i].id !== o.id || prev[i].status !== o.status || prev[i].isPreparing !== o.isPreparing);
          return hasChange ? orders : prev;
        });
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
        
        const closeModal = () => {
          if (modal.parentNode) document.body.removeChild(modal);
        };
        const setModalLoading = () => {
          const wrap = modal.querySelector('.bg-white.rounded-2xl');
          if (wrap) {
            wrap.innerHTML = `
              <div class="flex flex-col items-center justify-center py-10 px-4">
                <div class="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" style="animation-duration: 0.8s;"></div>
                <p class="mt-4 text-gray-700 font-semibold">Masa sonlandırılıyor...</p>
              </div>
            `;
          }
        };
        modal.querySelector('#cashBtn').onclick = () => {
          const btn = modal.querySelector('#cashBtn');
          const cardBtn = modal.querySelector('#cardBtn');
          if (btn.disabled) return;
          btn.disabled = true;
          if (cardBtn) cardBtn.disabled = true;
          setModalLoading();
          resolve({ paymentMethod: 'Nakit', campaignPercentage: selectedCampaign, closeModal });
        };
        modal.querySelector('#cardBtn').onclick = () => {
          const btn = modal.querySelector('#cardBtn');
          const cashBtn = modal.querySelector('#cashBtn');
          if (btn.disabled) return;
          btn.disabled = true;
          if (cashBtn) cashBtn.disabled = true;
          setModalLoading();
          resolve({ paymentMethod: 'Kredi Kartı', campaignPercentage: selectedCampaign, closeModal });
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

    const { paymentMethod, campaignPercentage, closeModal } = paymentResult;

    try {
      const result = await window.electronAPI.completeTableOrder(selectedOrder.id, paymentMethod, campaignPercentage);
      
      if (result.success) {
        setShowModal(false);
        setSelectedOrder(null);
        setOrderItems([]);
        await loadTableOrders();
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 1000);
      } else {
        showToast('Masa sonlandırılamadı: ' + (result.error || 'Bilinmeyen hata'), 'error');
      }
    } catch (error) {
      console.error('Masa sonlandırılırken hata:', error);
      showToast('Masa sonlandırılamadı: ' + error.message, 'error');
    } finally {
      if (typeof closeModal === 'function') closeModal();
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
    loadingOverlayStartRef.current = Date.now();
    setAdisyonLoadingOrderId(selectedOrder.id);
    try {
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
      
      // İndirim bilgilerini al (firstOrderDiscount vb.)
      const discountInfo = selectedOrder.firstOrderDiscount || null;
      
      // Ara toplam hesapla (indirim öncesi)
      const subtotal = adisyonItems.reduce((sum, item) => {
        if (item.isGift) return sum;
        return sum + (item.price * item.quantity);
      }, 0);
      
      // İndirim tutarını hesapla
      let discountAmount = 0;
      let finalTotal = subtotal;
      
      if (discountInfo && discountInfo.applied === true) {
        // İndirim bilgisi varsa kullan
        discountAmount = discountInfo.discountAmount || 0;
        finalTotal = discountInfo.finalTotal || (subtotal - discountAmount);
      }
      
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
        customer_address: selectedOrder.customer_address || selectedOrder.address || null,
        address_note: selectedOrder.address_note || selectedOrder.addressNote || null,
        // İndirim bilgileri
        discountInfo: discountInfo,
        subtotal: subtotal,
        discountAmount: discountAmount,
        finalTotal: finalTotal
      };

      try {
        console.log('Online sipariş adisyonu yazdırılıyor...');
        
        const result = await window.electronAPI.printAdisyon(adisyonData);
        
        if (result.success) {
          console.log('Adisyon başarıyla yazdırıldı');
          setAdisyonLoadingOrderId(null);
          setAdisyonSuccessOrderId(selectedOrder.id);
          setTimeout(() => setAdisyonSuccessOrderId(null), SUCCESS_OVERLAY_MS);
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
    } finally {
      const elapsed = Date.now() - loadingOverlayStartRef.current;
      const remaining = Math.max(0, OVERLAY_MIN_MS - elapsed);
      if (remaining > 0) setTimeout(() => setAdisyonLoadingOrderId(null), remaining);
      else setAdisyonLoadingOrderId(null);
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
    loadingOverlayStartRef.current = Date.now();
    setPrepareLoadingOrderId(selectedOrder.id);
    try {
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
          setPrepareLoadingOrderId(null);
          setPrepareSuccessOrderId(selectedOrder.id);
          setTimeout(() => setPrepareSuccessOrderId(null), SUCCESS_OVERLAY_MS);
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
    } finally {
      const elapsed = Date.now() - loadingOverlayStartRef.current;
      const remaining = Math.max(0, OVERLAY_MIN_MS - elapsed);
      if (remaining > 0) setTimeout(() => setPrepareLoadingOrderId(null), remaining);
      else setPrepareLoadingOrderId(null);
    }
  };

  // Siparişi Onayla - Onay modalını göster
  const handleMarkAsPaid = (order) => {
    if (!order || selectedType !== 'online') return;
    setOrderToMarkAsPaid(order);
    setShowPaymentConfirmModal(true);
  };

  // Hazırlanıyor durumunu toggle et
  const handleTogglePreparing = async (order) => {
    if (!order || selectedType !== 'online') return;
    
    if (!onlineFirestore) {
      showToast('Firebase bağlantısı bulunamadı', 'error');
      return;
    }

    setTogglingPreparingId(order.id);
    try {
      const orderRef = doc(onlineFirestore, 'orders', order.id);
      const currentPreparingStatus = order.isPreparing || false;
      const newPreparingStatus = !currentPreparingStatus;
      
      await updateDoc(orderRef, {
        isPreparing: newPreparingStatus
      });
      
      console.log(`✅ Sipariş hazırlanma durumu güncellendi: ${order.id} -> ${newPreparingStatus}`);
      showToast(newPreparingStatus ? 'Sipariş hazırlanıyor olarak işaretlendi' : 'Hazırlanıyor durumu kaldırıldı', 'success');
    } catch (error) {
      console.error('Hazırlanıyor durumu güncellenirken hata:', error);
      showToast('Durum güncellenemedi: ' + error.message, 'error');
    } finally {
      setTogglingPreparingId(null);
    }
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

  // Siparişi Onayla - Sipariş durumunu onaylandı olarak işaretle
  const confirmMarkAsPaid = async () => {
    if (!orderToMarkAsPaid || selectedType !== 'online') return;
    
    if (!onlineFirestore) {
      showToast('Firebase bağlantısı bulunamadı', 'error');
      setShowPaymentConfirmModal(false);
      setOrderToMarkAsPaid(null);
      return;
    }

    setIsConfirmingOrder(true);
    try {
      // Siparişi onaylandı olarak işaretle ve onaylama bilgilerini kaydet
      const orderRef = doc(onlineFirestore, 'orders', orderToMarkAsPaid.id);
      await updateDoc(orderRef, {
        status: 'paid', // Sipariş onaylandı olarak işaretlenir
        confirmedAt: serverTimestamp(), // Onaylama zamanı
        isConfirmed: true // Onaylandı durumu
      });
      
      console.log('✅ Online sipariş onaylandı ve Firebase\'e kaydedildi:', orderToMarkAsPaid.id);
      showToast('Sipariş başarıyla onaylandı ve kaydedildi', 'success');
      
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
            // Sale ID'yi order'a kaydet (sipariş silinirken satış kaydını da silmek için)
            try {
              await updateDoc(orderRef, {
                sale_id: saleResult.saleId
              });
            } catch (err) {
              console.warn('Sale ID order\'a kaydedilemedi:', err);
            }
          } else {
            console.error('❌ Satış geçmişe kaydedilemedi:', saleResult.error);
            showToast('Satış geçmişe kaydedilemedi: ' + (saleResult.error || 'Bilinmeyen hata'), 'error');
          }
        } catch (saleError) {
          console.error('Satış geçmişe kaydetme hatası:', saleError);
          showToast('Satış geçmişe kaydedilemedi: ' + saleError.message, 'error');
        }
      }
      
      // Toast mesajı zaten yukarıda gösterildi
      
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
    } finally {
      setIsConfirmingOrder(false);
    }
  };

  // İptal Et - Online siparişi iptal et (ödemeyi alınmış olarak işaretleme)
  const handleCancelOrder = () => {
    // Onay modalını göster
    setShowCancelConfirmModal(true);
  };

  // Online aktif durumunu yükle ve dinle (otomatik 12:30/23:30 ve manuel değişiklikler için)
  const loadOnlineActiveStatus = (db) => {
    try {
      const activeRef = doc(db, 'active', 'dGRsJ5V5lgHcpRMXwDm2');
      return onSnapshot(activeRef, (snap) => {
        if (snap.exists()) setIsOnlineActive(snap.data().is_active === true);
        else setIsOnlineActive(false);
      }, (err) => {
        console.error('Online aktif durumu dinlenirken hata:', err);
        setIsOnlineActive(false);
      });
    } catch (error) {
      console.error('Online aktif durumu yüklenemedi:', error);
      setIsOnlineActive(false);
      return () => {};
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

  // İptal işlemini onayla - Sadece is_decline: true olarak işaretle
  const confirmCancelOrder = async () => {
    if (!selectedOrder || selectedType !== 'online') return;
    if (!onlineFirestore) {
      showToast('Firebase bağlantısı bulunamadı', 'error');
      setShowCancelConfirmModal(false);
      return;
    }
    loadingOverlayStartRef.current = Date.now();
    setIsCancellingOrder(true);
    try {
      const orderRef = doc(onlineFirestore, 'orders', selectedOrder.id);
      
      // is_decline: true olarak işaretle
      await updateDoc(orderRef, {
        is_decline: true,
        declinedAt: serverTimestamp()
      });
      
      console.log('✅ Online sipariş iptal edildi ve is_decline: true olarak kaydedildi:', selectedOrder.id);
      setIsCancellingOrder(false);
      setIsCancelSuccess(true);
      setTimeout(() => {
        setIsCancelSuccess(false);
        setShowCancelConfirmModal(false);
        setShowModal(false);
        setSelectedOrder(null);
        setOrderItems([]);
        setExpandedOrderIds(prev => { const n = new Set(prev); if (selectedOrder) n.delete(selectedOrder.id); return n; });
      }, SUCCESS_OVERLAY_MS);
    } catch (error) {
      console.error('Sipariş iptal edilirken hata:', error);
      showToast('Sipariş iptal edilemedi: ' + error.message, 'error');
      setShowCancelConfirmModal(false);
    } finally {
      const elapsed = Date.now() - loadingOverlayStartRef.current;
      const remaining = Math.max(0, OVERLAY_MIN_MS - elapsed);
      if (remaining > 0) setTimeout(() => setIsCancellingOrder(false), remaining);
      else setIsCancellingOrder(false);
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

  // Masa birleştir (dolu masayı dolu masaya aktar)
  const handleMergeTable = async (sourceTableId, targetTableId) => {
    if (!window.electronAPI?.mergeTableOrder) {
      showToast('Masa birleştirme şu anda kullanılamıyor', 'error');
      return;
    }
    try {
      const result = await window.electronAPI.mergeTableOrder(sourceTableId, targetTableId);
      if (result.success) {
        setShowMergeModal(false);
        setShowModal(false);
        setSelectedOrder(null);
        setOrderItems([]);
        await loadTableOrders();
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 2000);
      } else {
        showToast(result.error || 'Masa birleştirilemedi', 'error');
      }
    } catch (error) {
      console.error('Masa birleştirme hatası:', error);
      showToast('Masa birleştirilemedi: ' + error.message, 'error');
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
      <div className="text-center mb-4">
        <h2 className="text-4xl font-black tracking-tight heading-display">Masalar</h2>
      </div>
      <div className="flex justify-end gap-3 mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              setShowAdisyonModal(true);
              setLoadingRecentSales(true);
              try {
                const recent = await window.electronAPI.getRecentSales(12);
                setRecentSales(groupPartialPayments(recent || []));
              } catch (error) {
                console.error('Son satışlar yüklenemedi:', error);
                showToast('Son satışlar yüklenemedi', 'error');
              } finally {
                setLoadingRecentSales(false);
              }
            }}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Geçmiş Adisyon İste</span>
          </button>
          <button
            onClick={() => setShowTransferModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-bold rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span>Masa Aktar</span>
          </button>
          <button
            onClick={() => setShowMergeModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>Masa Birleştir</span>
          </button>
        </div>
      </div>

      {/* Masa Tipi Seçimi */}
      <div className="flex justify-center gap-4 mb-4">
        <button
          onClick={() => setSelectedType('inside')}
          className={`relative px-8 py-4 rounded-xl border text-lg font-medium transition-all duration-200 flex items-center gap-4 ${
            selectedType === 'inside'
              ? 'bg-gradient-to-r from-pink-500 to-rose-500 border-pink-400 text-white shadow-md'
              : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400'
          }`}
        >
          <svg className="w-7 h-7 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span>İçeri</span>
        </button>
        <button
          onClick={() => setSelectedType('outside')}
          className={`px-8 py-4 rounded-xl border text-lg font-medium transition-all duration-200 flex items-center gap-4 ${
            selectedType === 'outside'
              ? 'bg-gradient-to-r from-pink-500 to-rose-500 border-pink-400 text-white shadow-md'
              : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400'
          }`}
        >
          <svg className="w-7 h-7 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span>Dışarı</span>
        </button>
        <button
          onClick={() => setSelectedType('online')}
          className={`relative px-8 py-4 rounded-xl border text-lg font-medium transition-all duration-200 flex items-center gap-4 ${
            selectedType === 'online'
              ? 'bg-gradient-to-r from-pink-500 to-rose-500 border-pink-400 text-white shadow-md'
              : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400'
          }`}
        >
          <svg className="w-7 h-7 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          <span>Online</span>
          {unseenOnlineOrdersCount > 0 && (
            <span className="absolute -top-2 -right-2 min-w-[26px] h-[26px] px-1.5 bg-red-600 text-white text-sm font-medium rounded-full flex items-center justify-center">
              {unseenOnlineOrdersCount > 99 ? '99+' : unseenOnlineOrdersCount}
            </span>
          )}
        </button>
      </div>

      {/* Online Siparişler - Kart Görünümü */}
      {selectedType === 'online' ? (
        <div className="space-y-4">
          {/* Online Ürün Yönetimi ve Alınmış Ödemeler Butonları */}
          <div className="flex justify-end mb-4 gap-3">
            <button
              onClick={() => setShowOnlineProductManagement(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-200 flex items-center space-x-2 shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <span>Online Ürün Yönetimi</span>
            </button>
            
            <button
              onClick={async () => {
                setShowPaidOrders(true);
                // Tüm paid siparişleri yükle (zaman filtresi kaldırıldı - en son 50 sipariş)
                if (onlineFirestore) {
                  try {
                    const ordersRef = collection(onlineFirestore, 'orders');
                    // Sadece status filtresi ile çek (composite index gerektirmez)
                    const q = query(
                      ordersRef,
                      where('status', '==', 'paid')
                    );
                    const snapshot = await getDocs(q);
                    console.log('📦 Toplam paid sipariş sayısı:', snapshot.docs.length);
                    
                    // Tüm paid siparişleri al, tarihe göre sırala (en yeni önce)
                    const orders = snapshot.docs
                      .map(doc => {
                        const data = doc.data();
                        console.log('📄 Sipariş:', doc.id, data);
                        return {
                          id: doc.id,
                          ...data
                        };
                      })
                      .sort((a, b) => {
                        // createdAt yoksa en alta at
                        if (!a.createdAt && !b.createdAt) return 0;
                        if (!a.createdAt) return 1;
                        if (!b.createdAt) return -1;
                        
                        const dateA = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                        const dateB = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                        return dateB - dateA; // En yeni önce
                      })
                      .slice(0, 50); // En son 50 sipariş
                    
                    console.log('✅ Gösterilecek sipariş sayısı:', orders.length);
                    setPaidOrders(orders);
                    
                    if (orders.length === 0) {
                      showToast('Henüz onaylanmış sipariş yok', 'info');
                    }
                  } catch (error) {
                    console.error('Paid siparişler yüklenirken hata:', error);
                    showToast('Siparişler yüklenemedi: ' + error.message, 'error');
                  }
                }
              }}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-200 flex items-center space-x-2 shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Alınmış Ödemeler</span>
            </button>

            <button
              onClick={() => setShowSoundModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-200 flex items-center space-x-2 shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 2.337-1.707 2.707L5.586 15z" />
              </svg>
              <span>Ses Ayarları</span>
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
                  <p className="text-xs text-gray-400 mt-1">Otomatik: 12:30 açılış, 23:30 kapanış</p>
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
            <div className="text-center py-16 bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-200 shadow-sm">
              <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-slate-500 font-medium text-lg">Henüz online sipariş bulunmuyor</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {onlineOrders.map((order) => {
                const isExpanded = expandedOrderIds.has(order.id);
                const items = order.items || [];
                const orderDate = order.createdAt
                  ? (order.createdAt.toDate ? order.createdAt.toDate() : new Date((order.createdAt.seconds || 0) * 1000))
                  : null;
                const minutesAgo = orderDate ? Math.floor((Date.now() - orderDate.getTime()) / 60000) : null;
                const timeLabel = minutesAgo == null ? '—' : minutesAgo === 0 ? 'Az önce' : `${minutesAgo} dk önce`;
                const timeColor = minutesAgo == null ? 'slate' : minutesAgo < 5 ? 'green' : minutesAgo < 10 ? 'yellow' : 'red';
                return (
                  <div
                    key={order.id}
                    onClick={() => {
                      const willExpand = !expandedOrderIds.has(order.id);
                      setExpandedOrderIds(prev => {
                        const next = new Set(prev);
                        if (next.has(order.id)) next.delete(order.id);
                        else next.add(order.id);
                        return next;
                      });
                      if (willExpand) {
                        setSelectedOrder(order);
                        setOrderItems(order.items || []);
                      }
                    }}
                    className="group relative rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 shadow-lg hover:shadow-xl min-h-[220px] flex flex-col"
                    style={{
                      backgroundImage: 'url(https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundColor: '#312e81'
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-900/85 via-indigo-900/80 to-purple-800/85" />
                    
                    {/* Sipariş süresi - üst orta, belirgin renkler, profesyonel */}
                    <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-10 px-5 py-2.5 rounded-2xl border-2 shadow-xl ${
                      timeColor === 'green'
                        ? 'bg-emerald-500/95 border-emerald-300 text-white'
                        : timeColor === 'yellow'
                        ? 'bg-amber-500/95 border-amber-300 text-white'
                        : 'bg-red-500/95 border-red-300 text-white'
                    }`}>
                      <span className="text-base font-bold tracking-tight drop-shadow-sm">
                        {timeLabel}
                      </span>
                    </div>
                    
                    {/* Adisyon / Ürünleri Hazırlat overlay - loading veya success (min 2 sn) */}
                    {(adisyonLoadingOrderId === order.id || prepareLoadingOrderId === order.id || adisyonSuccessOrderId === order.id || prepareSuccessOrderId === order.id) && (
                      <div className="absolute inset-0 z-20 rounded-3xl bg-black/70 backdrop-blur-md flex flex-col items-center justify-center gap-4 animate-fade-in">
                        {adisyonSuccessOrderId === order.id || prepareSuccessOrderId === order.id ? (
                          <>
                            <div className="w-20 h-20 rounded-full bg-emerald-500/90 flex items-center justify-center shadow-2xl animate-success-pop">
                              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <p className="text-xl font-semibold tracking-tight text-white">
                              {adisyonSuccessOrderId === order.id ? 'Adisyon Yazdırıldı' : 'Ürünler Hazırlatıldı'}
                            </p>
                          </>
                        ) : (
                          <>
                            <Spinner size="lg" className="text-white" />
                            <p className="text-xl font-semibold tracking-tight text-white">
                              {adisyonLoadingOrderId === order.id ? 'Adisyon Yazdırılıyor' : 'Ürünler Hazırlatılıyor'}
                            </p>
                          </>
                        )}
                      </div>
                    )}
                    
                    <div className="relative flex flex-col flex-1 p-6 text-white">
                      {/* Üst: Müşteri + Tarih + Durum */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-xl font-bold tracking-tight truncate">
                            {order.customer_name || order.name || 'İsimsiz Müşteri'}
                          </p>
                          <p className="text-sm text-white/80 mt-1">
                            {order.formattedDate} · {order.formattedTime}
                          </p>
                          <div className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                            </span>
                            <span className="text-base font-semibold text-white truncate">{order.customer_phone || order.phone || '-'}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
                            order.status === 'pending' ? 'bg-amber-500/90 text-white' :
                            order.status === 'completed' ? 'bg-emerald-500/90 text-white' :
                            order.isPreparing ? 'bg-orange-500/90 text-white' : 'bg-slate-500/90 text-white'
                          }`}>
                            {order.status === 'pending' && !order.isPreparing && 'Beklemede'}
                            {order.status === 'pending' && order.isPreparing && 'Hazırlanıyor'}
                            {order.status === 'completed' && 'Tamamlandı'}
                          </span>
                          <p className="text-2xl font-bold tracking-tight">₺{(order.total_amount || order.total || 0).toFixed(2)}</p>
                        </div>
                      </div>

                      {/* Onayla + Hazırlanıyor - Her zaman görünür (pending için) */}
                      {order.status === 'pending' && (
                        <div className="flex gap-3 mt-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleMarkAsPaid(order)}
                            className="flex-1 px-4 py-2.5 bg-white/95 hover:bg-white text-purple-800 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            Onayla
                          </button>
                          <button
                            onClick={() => handleTogglePreparing(order)}
                            disabled={togglingPreparingId === order.id}
                            className={`flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-70 ${
                              order.isPreparing ? 'bg-orange-500/90 text-white' : 'bg-white/20 text-white hover:bg-white/30'
                            }`}
                          >
                            {togglingPreparingId === order.id ? (
                              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                            {order.isPreparing ? 'Hazırlanıyor' : 'Hazırlanıyor'}
                          </button>
                        </div>
                      )}

                      {/* Genişleyen alan: Modal içeriği (müşteri, ürünler, adisyon, iptal) */}
                      <div className={`grid transition-all duration-300 ease-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden min-h-0">
                          <div className="pt-4 border-t border-white/20 space-y-4" onClick={(e) => e.stopPropagation()}>
                            {/* Müşteri bilgileri - koyu slate cam, başlıklar yeşil gradient */}
                            <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-4 border border-slate-600/20">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3 bg-gradient-to-r from-emerald-400 to-green-500 bg-clip-text text-transparent">Müşteri</p>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div><span className="block text-[10px] font-medium uppercase tracking-wider mb-0.5 bg-gradient-to-r from-emerald-400 to-green-500 bg-clip-text text-transparent">İsim</span><p className="font-medium text-slate-100 truncate">{order.customer_name || order.name || '-'}</p></div>
                                <div><span className="block text-[10px] font-medium uppercase tracking-wider mb-0.5 bg-gradient-to-r from-emerald-400 to-green-500 bg-clip-text text-transparent">Telefon</span><p className="font-medium text-slate-100 truncate">{order.customer_phone || order.phone || '-'}</p></div>
                                <div className="col-span-2"><span className="block text-[10px] font-medium uppercase tracking-wider mb-0.5 bg-gradient-to-r from-emerald-400 to-green-500 bg-clip-text text-transparent">Ödeme</span><p className="font-medium text-slate-100">{order.paymentMethod === 'card' ? 'Kart' : order.paymentMethod === 'cash' ? 'Nakit' : order.paymentMethod || '-'}</p></div>
                                <div className="col-span-2"><span className="block text-[10px] font-medium uppercase tracking-wider mb-0.5 bg-gradient-to-r from-emerald-400 to-green-500 bg-clip-text text-transparent">Adres</span><p className="font-medium text-slate-200 line-clamp-2">{order.customer_address || order.address || '-'}</p></div>
                              </div>
                              {(order.note || order.orderNote || order.order_note) && (
                                <div className="mt-3 pt-3 border-t border-slate-600/30">
                                  <span className="text-[10px] font-medium uppercase tracking-wider bg-gradient-to-r from-emerald-400 to-green-500 bg-clip-text text-transparent">Not</span>
                                  <p className="text-sm text-slate-200 line-clamp-2 mt-0.5">{order.note || order.orderNote || order.order_note}</p>
                                </div>
                              )}
                            </div>
                            {/* Ürünler - aynı palet */}
                            <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-4 border border-slate-600/20">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Ürünler</p>
                                <span className="text-[10px] text-slate-500 bg-slate-700/40 px-2 py-1 rounded-md font-medium tracking-wider">{items.length} adet</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                                {(items || []).map((item, idx) => {
                                  const name = item.name || item.product_name || '';
                                  const price = item.price || 0;
                                  const qty = item.quantity || 1;
                                  const total = price * qty;
                                  return (
                                    <div key={idx} className="rounded-xl p-[2px] bg-gradient-to-br from-purple-500 to-indigo-500">
                                      <div className="rounded-[10px] bg-slate-700/30 p-2.5 h-full">
                                        <p className="text-xs font-medium text-slate-100 truncate">{name}</p>
                                        <div className="flex justify-between items-end mt-2 gap-2">
                                          <span className="text-emerald-400 font-semibold text-base">{qty}x ₺{price.toFixed(2)}</span>
                                          <span className="text-2xl font-bold text-white tabular-nums">₺{total.toFixed(2)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            {/* Adisyon, Ürünleri Hazırlat - sade cam, mor gradient yazı */}
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => { setSelectedOrder(order); setOrderItems(order.items || []); handleRequestAdisyon(); }}
                                disabled={adisyonLoadingOrderId === order.id}
                                className="w-full px-4 py-3 bg-white hover:bg-gray-50 font-medium rounded-xl flex items-center justify-center gap-2 text-sm border border-gray-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed [&>span]:bg-gradient-to-r [&>span]:from-purple-600 [&>span]:to-indigo-600 [&>span]:bg-clip-text [&>span]:text-transparent"
                              >
                                {adisyonLoadingOrderId === order.id ? (
                                  <Spinner size="sm" className="text-indigo-600 shrink-0" />
                                ) : (
                                  <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                )}
                                <span>Adisyon Yazdır</span>
                              </button>
                              <button
                                onClick={() => { setSelectedOrder(order); setOrderItems(order.items || []); handlePrepareProducts(); }}
                                disabled={prepareLoadingOrderId === order.id}
                                className="w-full px-4 py-3 bg-white hover:bg-gray-50 font-medium rounded-xl flex items-center justify-center gap-2 text-sm border border-gray-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed [&>span]:bg-gradient-to-r [&>span]:from-purple-600 [&>span]:to-indigo-600 [&>span]:bg-clip-text [&>span]:text-transparent"
                              >
                                {prepareLoadingOrderId === order.id ? (
                                  <Spinner size="sm" className="text-indigo-600 shrink-0" />
                                ) : (
                                  <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                  </svg>
                                )}
                                <span>Ürünleri Hazırlat</span>
                              </button>
                              {order.status === 'pending' && (
                                <button
                                  onClick={() => { setSelectedOrder(order); setOrderItems(order.items || []); handleCancelOrder(); }}
                                  className="w-full px-4 py-3 bg-red-900/30 hover:bg-red-900/50 text-red-200 font-medium rounded-xl flex items-center justify-center gap-2 text-sm border border-red-500/40 transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  İptal Et
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {!isExpanded && (
                        <div className="mt-auto pt-4 flex items-center justify-center gap-2 text-white/60 text-sm">
                          <span>Detay için tıklayın</span>
                          <svg className="w-4 h-4 transition-transform group-hover:translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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

          {/* Paket Masaları - Kurumsal */}
          <div className="mb-6 mt-10">
            <h3 className="text-center text-sm font-semibold uppercase tracking-widest text-slate-400 mb-4">Paket Masaları</h3>
            <div className="grid grid-cols-5 gap-3">
              {packageTables.map((table) => {
                const hasOrder = getTableOrder(table.id);
                return (
                  <button
                    key={table.id}
                    onClick={() => handleTableClick(table)}
                    className={`table-btn group relative overflow-hidden rounded-xl border transition-all duration-200 hover:shadow-md active:scale-[0.98] ${
                      hasOrder
                        ? 'bg-slate-100 border-slate-300 hover:border-slate-400'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col items-center justify-center p-4 space-y-3 h-full min-h-[100px]">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                        hasOrder ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {hasOrder ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-sm font-medium leading-tight ${hasOrder ? 'text-slate-700' : 'text-slate-500'}`}>
                        {table.name}
                      </span>
                      <span className={`text-xs font-medium ${hasOrder ? 'text-slate-500' : 'text-slate-400'}`}>
                        {hasOrder ? 'Dolu' : 'Boş'}
                      </span>
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
          onTransferItems={() => loadTableOrders()}
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

      {/* Masa Birleştir Modal */}
      {showMergeModal && (
        <TableMergeModal
          onClose={() => setShowMergeModal(false)}
          onMerge={handleMergeTable}
        />
      )}

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
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        selectedSaleForAdisyon?.id === sale.id
                          ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-400'
                          : 'bg-gray-50 border-gray-200 hover:border-purple-300'
                      }`}
                      onClick={() => setSelectedSaleForAdisyon(sale)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              sale.payment_method && sale.payment_method.includes('Nakit')
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                : sale.payment_method && sale.payment_method.includes('Kredi Kartı')
                                ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                                : sale.isGrouped
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                                : 'bg-gradient-to-r from-gray-500 to-gray-600'
                            }`}>
                              {sale.payment_method && sale.payment_method.includes('Nakit') ? (
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                              ) : sale.payment_method && sale.payment_method.includes('Kredi Kartı') ? (
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                              ) : sale.isGrouped ? (
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
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
                                {sale.isGrouped && (
                                  <span className="ml-2 text-xs font-normal text-purple-600 bg-purple-100 px-2 py-0.5 rounded">(Kısmi Ödemeler)</span>
                                )}
                              </p>
                              <p className="text-sm text-gray-600">
                                {sale.isGrouped && sale.last_sale_date && sale.last_sale_time
                                  ? `${sale.sale_date} ${sale.sale_time} - ${sale.last_sale_date} ${sale.last_sale_time}`
                                  : `${sale.sale_date} ${sale.sale_time}`}
                                {sale.staff_name && ` • ${sale.staff_name}`}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm text-gray-500 mt-2">{sale.items || 'Ürün bulunamadı'}</p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-2xl font-bold text-purple-600">₺{sale.total_amount?.toFixed(2) || '0.00'}</p>
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
                        showToast('Lütfen bir satış seçin', 'warning');
                        return;
                      }
                      if (!window.electronAPI?.printAdisyon) {
                        showToast('Adisyon yazdırma özelliği kullanılamıyor', 'error');
                        return;
                      }
                      try {
                        showToast('Adisyon yazdırılıyor...', 'info');
                        const adisyonItems = (selectedSaleForAdisyon.items_array || []).map(item => ({
                          id: item.product_id,
                          name: item.product_name,
                          quantity: item.quantity,
                          price: item.price,
                          isGift: item.isGift || false,
                          staff_name: item.staff_name || null
                        }));
                        const saleDate = selectedSaleForAdisyon.isGrouped && selectedSaleForAdisyon.last_sale_date
                          ? selectedSaleForAdisyon.last_sale_date
                          : selectedSaleForAdisyon.sale_date;
                        const saleTime = selectedSaleForAdisyon.isGrouped && selectedSaleForAdisyon.last_sale_time
                          ? selectedSaleForAdisyon.last_sale_time
                          : selectedSaleForAdisyon.sale_time;
                        const adisyonData = {
                          items: adisyonItems,
                          tableName: selectedSaleForAdisyon.table_name || null,
                          tableType: selectedSaleForAdisyon.table_type || null,
                          orderNote: selectedSaleForAdisyon.isGrouped
                            ? `Kısmi Ödemeler (${selectedSaleForAdisyon.original_sales?.length || 0} ödeme)`
                            : null,
                          sale_date: saleDate,
                          sale_time: saleTime,
                          staff_name: selectedSaleForAdisyon.staff_name || null,
                          cashierOnly: true
                        };
                        const result = await window.electronAPI.printAdisyon(adisyonData);
                        if (result.success) {
                          showToast('Adisyon yazdırıldı', 'success');
                          setShowAdisyonModal(false);
                          setSelectedSaleForAdisyon(null);
                          setRecentSales([]);
                        } else {
                          showToast(result.error || 'Adisyon yazdırılamadı', 'error');
                        }
                      } catch (error) {
                        console.error('Adisyon yazdırılırken hata:', error);
                        showToast('Adisyon yazdırılamadı: ' + error.message, 'error');
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
                Bu online siparişi onaylamak istediğinizden <span className="font-semibold text-gray-900">emin misiniz?</span>
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
                disabled={isConfirmingOrder}
                className="flex-1 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed rounded-xl text-white font-bold text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                {isConfirmingOrder ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" style={{ animationDuration: '0.8s' }} />
                    <span>İşleniyor...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Onayla
                  </>
                )}
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

      {/* Ses Ayarları Modal */}
      {showSoundModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowSoundModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 2.337-1.707 2.707L5.586 15z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Ses Ayarları</h2>
                  <p className="text-sm text-amber-100">Online sipariş bildirim sesi</p>
                </div>
              </div>
              <button onClick={() => setShowSoundModal(false)} className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-all text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Online sipariş sesi: Açık / Kapalı (switch) */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">Online sipariş sesi</p>
                  <p className="text-sm text-gray-500">{soundMuted ? 'Kapalı' : 'Açık'}</p>
                </div>
                <button
                  role="switch"
                  aria-checked={!soundMuted}
                  onClick={() => {
                    const next = !soundMuted;
                    setSoundMuted(next);
                    localStorage.setItem('onlineOrderSoundMuted', next ? 'true' : 'false');
                  }}
                  className={`relative inline-flex h-10 w-20 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 ${
                    soundMuted ? 'bg-gray-300' : 'bg-gradient-to-r from-amber-500 to-orange-500'
                  }`}
                >
                  <span className={`inline-block h-8 w-8 transform rounded-full bg-white shadow transition-transform duration-200 ${soundMuted ? 'translate-x-1' : 'translate-x-12'}`} />
                </button>
              </div>
              {/* Ses yüksekliği */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="font-semibold text-gray-800">Ses yüksekliği</label>
                  <span className="text-sm font-medium text-amber-600">{soundVolume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={soundVolume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setSoundVolume(v);
                    localStorage.setItem('onlineOrderSoundVolume', (v / 100).toFixed(2));
                  }}
                  className="w-full h-2.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
              {/* Oynat butonu */}
              <button
                onClick={() => {
                  const a = new Audio(orderSound);
                  a.volume = Math.max(0, Math.min(1, soundVolume / 100));
                  a.play().catch(() => {});
                }}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Oynat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alınmış Ödemeler Modal */}
      {showPaidOrders && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-8 py-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Alınmış Ödemeler</h2>
                  <p className="text-sm text-green-100">Onaylanmış siparişler (en son 50 sipariş)</p>
                </div>
              </div>
              <button
                onClick={() => setShowPaidOrders(false)}
                className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-all text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {paidOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <svg className="w-20 h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-xl font-semibold">Henüz onaylanmış sipariş yok</p>
                  <p className="text-sm mt-2">Onaylanmış sipariş bulunamadı</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {paidOrders.map((order) => (
                    <div key={order.id} className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200 hover:border-green-300 transition-all">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold text-gray-900">{order.customer_name || order.name || 'İsimsiz Müşteri'}</h3>
                            <span className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-full">ONAYLANDI</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">
                            <span className="font-semibold">Tel:</span> {order.customer_phone || order.phone || '-'}
                          </p>
                          <p className="text-sm text-gray-600 mb-1">
                            <span className="font-semibold">Adres:</span> {order.customer_address || order.address || '-'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toLocaleString('tr-TR') : '-'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-700">₺{(order.total_amount || order.total || 0).toFixed(2)}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {order.paymentMethod === 'card' ? 'Kart' : order.paymentMethod === 'cash' ? 'Nakit' : 'Diğer'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Ürünler */}
                      {order.items && order.items.length > 0 && (
                        <div className="mb-4 bg-white/60 rounded-lg p-3">
                          <p className="text-xs font-semibold text-gray-600 mb-2">Sipariş İçeriği:</p>
                          <div className="space-y-1">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span className="text-gray-700">{item.name || item.product_name} x{item.quantity}</span>
                                <span className="font-semibold text-gray-900">₺{((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Sil Butonu */}
                      <button
                        onClick={() => {
                          setOrderToDelete(order);
                          setShowDeleteConfirm(true);
                        }}
                        className="w-full mt-4 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 hover:shadow-lg transform hover:scale-[1.02] active:scale-95"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Siparişi Sil
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* İptal Onay Modal - Modern ve Profesyonel */}
      {showCancelConfirmModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[2000] animate-fade-in px-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl transform animate-scale-in relative overflow-hidden border border-gray-100">
            {/* İptal işlemi overlay - loading veya success */}
            {(isCancellingOrder || isCancelSuccess) && (
              <div className="absolute inset-0 z-30 rounded-3xl bg-black/75 backdrop-blur-md flex flex-col items-center justify-center gap-4 animate-fade-in">
                {isCancelSuccess ? (
                  <>
                    <div className="w-20 h-20 rounded-full bg-emerald-500/90 flex items-center justify-center shadow-2xl animate-success-pop">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-xl font-semibold tracking-tight text-white">Sipariş İptal Edildi</p>
                  </>
                ) : (
                  <>
                    <Spinner size="lg" className="text-white" />
                    <p className="text-xl font-semibold tracking-tight text-white">Sipariş İptal Ediliyor</p>
                  </>
                )}
              </div>
            )}
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
                disabled={isCancellingOrder}
                className="flex-1 py-4 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 rounded-xl text-white font-bold text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isCancellingOrder ? (
                  <Spinner size="md" className="text-white" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                İptal Et
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sipariş Silme Onay Modal - Modern, Profesyonel ve Kurumsal */}
      {showDeleteConfirm && orderToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[3000] animate-fade-in px-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl transform animate-scale-in relative overflow-hidden border border-gray-100">
            {/* Üst gradient çizgi - Tehlike rengi */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 via-rose-500 to-red-500"></div>
            
            {/* Icon ve Başlık */}
            <div className="pt-10 pb-6 px-8 text-center">
              {/* Uyarı İkonu */}
              <div className="flex items-center justify-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-red-50 to-rose-100 rounded-2xl flex items-center justify-center border-2 border-red-200 shadow-lg">
                  <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">
                Siparişi Kalıcı Olarak Sil
              </h3>
              
              <p className="text-sm text-gray-600 leading-relaxed mb-6">
                <span className="font-semibold text-gray-900">{orderToDelete.customer_name || orderToDelete.name || 'Bu müşteri'}</span> adlı müşterinin siparişini <span className="font-semibold text-red-600">kalıcı olarak silmek</span> istediğinize emin misiniz?
              </p>

              {/* Sipariş Özeti Kartı */}
              <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-5 border-2 border-red-200 mb-6">
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700">Müşteri Adı:</span>
                    <span className="text-sm font-bold text-gray-900">{orderToDelete.customer_name || orderToDelete.name || 'İsimsiz'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700">Telefon:</span>
                    <span className="text-sm font-medium text-gray-800">{orderToDelete.customer_phone || orderToDelete.phone || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700">Adres:</span>
                    <span className="text-sm font-medium text-gray-800 text-right max-w-[250px] truncate" title={orderToDelete.customer_address || orderToDelete.address || '-'}>
                      {orderToDelete.customer_address || orderToDelete.address || '-'}
                    </span>
                  </div>
                  <div className="h-px bg-red-200 my-2"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-base font-semibold text-gray-900">Toplam Tutar:</span>
                    <span className="text-xl font-bold text-red-600">₺{(orderToDelete.total_amount || orderToDelete.total || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Uyarı Mesajı */}
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-xs text-yellow-800 font-semibold leading-relaxed text-left">
                    <span className="font-bold block mb-1">⚠️ Dikkat!</span>
                    Bu işlem geri alınamaz. Sipariş veritabanından kalıcı olarak silinecek ve bu işlem geri döndürülemeyecektir.
                  </p>
                </div>
              </div>
            </div>

            {/* Butonlar */}
            <div className="px-8 pb-8 flex items-center gap-4 border-t border-gray-100 pt-6">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setOrderToDelete(null);
                }}
                disabled={isDeleting}
                className="flex-1 py-3.5 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 rounded-xl text-gray-700 hover:text-gray-900 font-bold text-base transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Vazgeç
              </button>
              <button
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    // 1. Önce satış kaydını sil (eğer varsa)
                    if (orderToDelete.sale_id && window.electronAPI && window.electronAPI.deleteSale) {
                      try {
                        const deleteResult = await window.electronAPI.deleteSale(orderToDelete.sale_id);
                        if (deleteResult.success) {
                          console.log('✅ Satış kaydı silindi:', orderToDelete.sale_id);
                        }
                      } catch (err) {
                        console.warn('Satış kaydı silinirken hata:', err);
                      }
                    }
                    
                    // 2. Sonra siparişi sil
                    if (onlineFirestore) {
                      await deleteDoc(doc(onlineFirestore, 'orders', orderToDelete.id));
                      setPaidOrders(prev => prev.filter(o => o.id !== orderToDelete.id));
                      showToast('Sipariş ve satış kaydı başarıyla silindi', 'success');
                      setShowDeleteConfirm(false);
                      setOrderToDelete(null);
                    }
                  } catch (error) {
                    console.error('Sipariş silinirken hata:', error);
                    showToast('Sipariş silinemedi: ' + error.message, 'error');
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting}
                className="flex-1 py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 rounded-xl text-white font-bold text-base transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Siliniyor...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Evet, Sil</span>
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
