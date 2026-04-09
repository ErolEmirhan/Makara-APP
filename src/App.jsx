import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApp, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import orderSound from './sound/order.mp3';
import Navbar from './components/Navbar';
import CategoryPanel from './components/CategoryPanel';
import TablePanel from './components/TablePanel';
import ProductGrid from './components/ProductGrid';
import Cart from './components/Cart';
import SalesHistory from './components/SalesHistory';
import PaymentModal from './components/PaymentModal';
import SplitPaymentModal from './components/SplitPaymentModal';
import RoleSplash from './components/RoleSplash';
import SaleSuccessToast from './components/SaleSuccessToast';
import PrintToast from './components/PrintToast';
import SplashScreen from './components/SplashScreen';
import CatalogSyncProgressBar from './components/CatalogSyncProgressBar';
import ExitSplash from './components/ExitSplash';
import UpdateModal from './components/UpdateModal';
import ExpenseModal from './components/ExpenseModal';
import YanUrunlerManagementModal from './components/YanUrunlerManagementModal';
import Toast from './components/Toast';
import SettingsModal from './components/SettingsModal';

const BRANCH_ONBOARDING_KEY = 'makara_pos_branch_onboarded';
/** Açılış splash’inde şube; senkron okuma + getActiveBranch ile güncellenir */
const LAST_BRANCH_SPLASH_KEY = 'makara_pos_splash_branch_key';

/** Sultan Somatı: “Yan Ürünler” yalnızca Makara’da; Firebase’de kayıtlı olsa bile Sultan’da gösterilmez. */
function filterYanUrunlerCategoriesForSultan(cats) {
  if (!Array.isArray(cats)) return [];
  return cats.filter((c) => {
    const n = Number(c.id);
    if (n === 999999 || n === -999) return false;
    const nm = (c?.name || '').trim().toLowerCase();
    return nm !== 'yan ürünler' && nm !== 'yan urunler';
  });
}

function readSplashBranchKeyFromStorage() {
  try {
    return (localStorage.getItem(LAST_BRANCH_SPLASH_KEY) || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [splashBranchKey, setSplashBranchKey] = useState(readSplashBranchKeyFromStorage);
  const [selectedBranchKey, setSelectedBranchKey] = useState('');
  const [activeBranch, setActiveBranch] = useState(null);
  const [isActivatingBranch, setIsActivatingBranch] = useState(false);
  const [branchError, setBranchError] = useState('');
  const [isBranchReady, setIsBranchReady] = useState(false);
  /** Kayıtlı şube ile otomatik bağlanırken; seçim ekranı flicker olmasın */
  const [branchGateResolved, setBranchGateResolved] = useState(() => {
    try {
      return localStorage.getItem(BRANCH_ONBOARDING_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const [branchBootstrapKey, setBranchBootstrapKey] = useState(0);
  const [currentView, setCurrentView] = useState('pos'); // 'pos', 'sales', or 'tables'
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]); // Tüm kategorilerden ürünler (arama için)
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [yanUrunler, setYanUrunler] = useState([]); // Yan Ürünler listesi
  const [showYanUrunlerModal, setShowYanUrunlerModal] = useState(false); // Yan Ürünler yönetim modalı
  const YAN_URUNLER_CATEGORY_ID = -999; // Özel kategori ID'si
  /** Sanal kategori: tüm katalog (getProducts(null)); IPC'de -998 = tümü */
  const ALL_PRODUCTS_CATEGORY_ID = -998;
  const [cart, setCart] = useState([]);
  const [orderNote, setOrderNote] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSplitPaymentModal, setShowSplitPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null); // Masa seçimi
  const [userType, setUserType] = useState('Personel'); // 'Admin' or 'Personel'
  const [activeRoleSplash, setActiveRoleSplash] = useState(null);
  const [saleSuccessInfo, setSaleSuccessInfo] = useState(null);
  const [printToast, setPrintToast] = useState(null); // { status: 'printing' | 'success' | 'error', message: string }
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updateDownloadProgress, setUpdateDownloadProgress] = useState(null);
  const [tableRefreshTrigger, setTableRefreshTrigger] = useState(0);
  const [autoOpenOrderId, setAutoOpenOrderId] = useState(null);
  const [autoOpenTableId, setAutoOpenTableId] = useState(null);
  const [showExitSplash, setShowExitSplash] = useState(false);
  const [exitAction, setExitAction] = useState('quit'); // 'quit' | 'logout'
  const [searchQuery, setSearchQuery] = useState('');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info', show: false });
  const [isCompletingSale, setIsCompletingSale] = useState(false);
  const [isCompletingSplitPayment, setIsCompletingSplitPayment] = useState(false);
  const [isSubmittingTableOrder, setIsSubmittingTableOrder] = useState(false);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [showSuriciNameModal, setShowSuriciNameModal] = useState(false);
  const [suriciGuestName, setSuriciGuestName] = useState('');
  const suriciNameResolverRef = useRef(null);
  const catalogSyncHideTimerRef = useRef(null);
  const searchInputRef = useRef(null);
  const preparedReceiptsRef = useRef({}); // Sepetteyken hazırlanan fişler (metin)
  const preparedPrintJobIdRef = useRef(null); // Sepetteyken hazırlanan fiş job id — Adisyon Yazdır / Masaya Kaydet anında yazdırılır

  const showToast = (message, type = 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };
  const triggerRoleSplash = (role) => {
    setActiveRoleSplash(role);
    setTimeout(() => setActiveRoleSplash(null), 1300);
  };

  const [catalogSyncProgress, setCatalogSyncProgress] = useState(null);
  const [broadcastMessage, setBroadcastMessage] = useState(null);
  const BRANCH_OPTIONS = useMemo(() => ([
    {
      key: 'makara',
      label: 'MAKARA HAVZAN',
      subtitle: 'Ana sube'
    },
    {
      key: 'makarasur',
      label: 'MAKARA SURİÇİ',
      subtitle: 'Suriçi şube'
    },
    {
      key: 'sultansomati',
      label: 'SULTAN SOMATI',
      subtitle: 'Makara ile ortak katalog yok'
    }
  ]), []);
  const VALID_BRANCH_KEYS = useMemo(
    () => new Set(BRANCH_OPTIONS.map((b) => b.key)),
    [BRANCH_OPTIONS]
  );
  const systemTitle = useMemo(() => {
    const key = activeBranch?.key || selectedBranchKey;
    if (key === 'makarasur') return 'Makara Suriçi Satış Sistemi';
    if (key === 'sultansomati') return 'Sultan Somatı Satış Sistemi';
    return 'Makara Havzan Satış Sistemi';
  }, [activeBranch, selectedBranchKey]);
  const isSuriciBranch = (activeBranch?.key || selectedBranchKey) === 'makarasur';
  const isSultanBranch = useMemo(
    () => Boolean(isBranchReady && activeBranch?.key === 'sultansomati'),
    [isBranchReady, activeBranch]
  );

  useEffect(() => {
    document.body.classList.toggle('body-theme-sultan', isSultanBranch);
    return () => document.body.classList.remove('body-theme-sultan');
  }, [isSultanBranch]);

  // Açılış splash’i için güncel şube (Electron; ilk karede localStorage yedeği)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!window.electronAPI?.getActiveBranch) return;
        const b = await window.electronAPI.getActiveBranch();
        const k = (b?.key || '').trim().toLowerCase();
        if (cancelled || !VALID_BRANCH_KEYS.has(k)) return;
        setSplashBranchKey(k);
        try {
          localStorage.setItem(LAST_BRANCH_SPLASH_KEY, k);
        } catch (_) {}
      } catch (_) {}
    })();
    return () => {
      cancelled = true;
    };
  }, [VALID_BRANCH_KEYS]);

  // Kayıtlı şube: splash görünürken bile hemen bağlan — katalog splash bitmeden memory’de hazır olsun
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let onboarded = false;
      try {
        onboarded = localStorage.getItem(BRANCH_ONBOARDING_KEY) === '1';
      } catch {
        onboarded = false;
      }
      if (!onboarded) {
        if (!cancelled) setBranchGateResolved(true);
        return;
      }
      if (!cancelled) setBranchGateResolved(false);
      try {
        if (!window.electronAPI?.getActiveBranch || !window.electronAPI?.activateBranch) {
          if (!cancelled) setBranchGateResolved(true);
          return;
        }
        const branch = await window.electronAPI.getActiveBranch();
        const key = (branch?.key || '').trim().toLowerCase();
        if (!VALID_BRANCH_KEYS.has(key)) {
          if (!cancelled) setBranchGateResolved(true);
          return;
        }
        const result = await window.electronAPI.activateBranch(key);
        if (cancelled) return;
        if (result?.success) {
          setActiveBranch(result.branch || branch);
          setSelectedBranchKey(key);
          setSplashBranchKey(key);
          try {
            localStorage.setItem(LAST_BRANCH_SPLASH_KEY, key);
          } catch (_) {}
          setIsBranchReady(true);
          setCurrentView(key === 'makarasur' || key === 'sultansomati' ? 'tables' : 'pos');
        }
      } catch (e) {
        console.error('Otomatik şube bağlantısı:', e);
      } finally {
        if (!cancelled) setBranchGateResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branchBootstrapKey, VALID_BRANCH_KEYS]);

  useEffect(() => {
    if (!window.electronAPI?.onCatalogSyncProgress) return undefined;
    const cleanup = window.electronAPI.onCatalogSyncProgress((data) => {
      if (catalogSyncHideTimerRef.current) {
        clearTimeout(catalogSyncHideTimerRef.current);
        catalogSyncHideTimerRef.current = null;
      }
      setCatalogSyncProgress(data);
      if (data?.phase === 'done' || (data?.percent != null && data.percent >= 100)) {
        catalogSyncHideTimerRef.current = setTimeout(() => {
          setCatalogSyncProgress(null);
          catalogSyncHideTimerRef.current = null;
        }, 650);
      }
    });
    return () => {
      if (catalogSyncHideTimerRef.current) {
        clearTimeout(catalogSyncHideTimerRef.current);
        catalogSyncHideTimerRef.current = null;
      }
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    // Update event listeners
    if (window.electronAPI) {
      window.electronAPI.onUpdateAvailable((info) => {
        setUpdateInfo({ ...info, downloaded: false });
      });
      
      window.electronAPI.onUpdateDownloaded((info) => {
        setUpdateInfo({ ...info, downloaded: true });
      });
      
      window.electronAPI.onUpdateError((error) => {
        console.error('Update error:', error);
        // Hata durumunda modal'ı kapat
        setUpdateInfo(null);
      });
      
      window.electronAPI.onUpdateProgress((progress) => {
        setUpdateDownloadProgress(progress);
      });

      // Broadcast message listener
      if (window.electronAPI.onBroadcastMessage) {
        const cleanup = window.electronAPI.onBroadcastMessage((data) => {
          setBroadcastMessage(data);
        });
        return cleanup;
      }
    }
  }, []);

  // Online sipariş düştüğünde ses çal (sadece bu cihaz online sipariş alıyorsa)
  useEffect(() => {
    if (activeBranch?.key === 'sultansomati') return;
    if (localStorage.getItem('receiveOnlineOrdersOnThisDevice') === 'false') return;
    if (!isBranchReady) return;
    const branchKey = activeBranch?.key || 'makara';
    const onlineFirebaseConfig = branchKey === 'makarasur'
      ? {
          apiKey: "AIzaSyDnVpG-Hl7n2a1esMO4rZhq9JfqpKd3VUo",
          authDomain: "makarasurici.firebaseapp.com",
          projectId: "makarasurici",
          storageBucket: "makarasurici.firebasestorage.app",
          messagingSenderId: "237735301273",
          appId: "1:237735301273:web:bf62c8f145434df0292808",
          measurementId: "G-WXWWQT92L6"
        }
      : {
          apiKey: "AIzaSyAucyGoXwmQ5nrQLfk5zL5-73ir7u9vbI8",
          authDomain: "makaraonline-5464e.firebaseapp.com",
          projectId: "makaraonline-5464e",
          storageBucket: "makaraonline-5464e.firebasestorage.app",
          messagingSenderId: "1041589485836",
          appId: "1:1041589485836:web:06119973a19da0a14f0929",
          measurementId: "G-MKPPB635ZZ"
        };
    let unsubscribe;
    try {
      let app;
      try { app = getApp('onlineOrders'); } catch { app = initializeApp(onlineFirebaseConfig, 'onlineOrders'); }
      const db = getFirestore(app);
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('status', '==', 'pending'));
      const prevIdsRef = { current: new Set() };
      let isFirstLoad = true;
      unsubscribe = onSnapshot(q, (snapshot) => {
        const ids = new Set();
        snapshot.forEach((d) => ids.add(d.id));
        if (isFirstLoad) {
          isFirstLoad = false;
          prevIdsRef.current = ids;
          return;
        }
        const added = [...ids].filter((id) => !prevIdsRef.current.has(id));
        if (added.length > 0) {
          if (localStorage.getItem('onlineOrderSoundMuted') === 'true') return;
          try {
            const a = new Audio(orderSound);
            a.volume = Math.max(0, Math.min(1, parseFloat(localStorage.getItem('onlineOrderSoundVolume') || '1')));
            a.play().catch(() => {});
          } catch (_) {}
        }
        prevIdsRef.current = ids;
      });
    } catch (e) {
      console.error('Online sipariş sesi listener başlatılamadı:', e);
    }
    return () => { if (unsubscribe) unsubscribe(); };
  }, [isBranchReady, activeBranch]);

  // Online sipariş: her gün 12:30 aktif, 23:30 pasif (otomatik)
  useEffect(() => {
    if (!isBranchReady) return;
    if (activeBranch?.key === 'sultansomati') return;
    const branchKey = activeBranch?.key || 'makara';
    const onlineFirebaseConfig = branchKey === 'makarasur'
      ? {
          apiKey: "AIzaSyDnVpG-Hl7n2a1esMO4rZhq9JfqpKd3VUo",
          authDomain: "makarasurici.firebaseapp.com",
          projectId: "makarasurici",
          storageBucket: "makarasurici.firebasestorage.app",
          messagingSenderId: "237735301273",
          appId: "1:237735301273:web:bf62c8f145434df0292808",
          measurementId: "G-WXWWQT92L6"
        }
      : {
          apiKey: "AIzaSyAucyGoXwmQ5nrQLfk5zL5-73ir7u9vbI8",
          authDomain: "makaraonline-5464e.firebaseapp.com",
          projectId: "makaraonline-5464e",
          storageBucket: "makaraonline-5464e.firebasestorage.app",
          messagingSenderId: "1041589485836",
          appId: "1:1041589485836:web:06119973a19da0a14f0929",
          measurementId: "G-MKPPB635ZZ"
        };
    let activeRef;
    try {
      let app;
      try { app = getApp('onlineOrders'); } catch { app = initializeApp(onlineFirebaseConfig, 'onlineOrders'); }
      const db = getFirestore(app);
      activeRef = doc(db, 'active', 'dGRsJ5V5lgHcpRMXwDm2');
    } catch (e) {
      console.error('Online otomatik saat başlatılamadı:', e);
      return;
    }
    const run = () => {
      const now = new Date();
      const today = now.getFullYear() + '-' + (now.getMonth() + 1).toString().padStart(2, '0') + '-' + now.getDate().toString().padStart(2, '0');
      const h = now.getHours();
      const m = now.getMinutes();
      if (h === 12 && m === 30 && localStorage.getItem('lastAutoOnlineActivate') !== today) {
        setDoc(activeRef, { is_active: true }, { merge: true }).then(() => {
          localStorage.setItem('lastAutoOnlineActivate', today);
        }).catch((e) => console.error('12:30 aktif yapılamadı:', e));
      }
      if (h === 23 && m === 30 && localStorage.getItem('lastAutoOnlinePassive') !== today) {
        setDoc(activeRef, { is_active: false }, { merge: true }).then(() => {
          localStorage.setItem('lastAutoOnlinePassive', today);
        }).catch((e) => console.error('23:30 pasif yapılamadı:', e));
      }
    };
    run();
    const id = setInterval(run, 60 * 1000);
    return () => clearInterval(id);
  }, [isBranchReady, activeBranch]);

  // PERFORMANS: useCallback ile fonksiyonları memoize et
  const loadProducts = useCallback(async (categoryId) => {
    const sultan = activeBranch?.key === 'sultansomati';
    if (categoryId === ALL_PRODUCTS_CATEGORY_ID) {
      const prods = await window.electronAPI.getProducts(null);
      const list = Array.isArray(prods) ? prods : [];
      setProducts(list);
      setAllProducts(list);
      return;
    }
    if (!sultan && categoryId === YAN_URUNLER_CATEGORY_ID) {
      if (window.electronAPI && window.electronAPI.getYanUrunler) {
        const yanUrunlerList = await window.electronAPI.getYanUrunler();
        const formattedYanUrunler = yanUrunlerList.map(urun => ({
          id: `yan_urun_${urun.id}`,
          name: urun.name,
          price: urun.price,
          category_id: YAN_URUNLER_CATEGORY_ID,
          isYanUrun: true
        }));
        setProducts(formattedYanUrunler);
      } else {
        setProducts([]);
      }
      return;
    }

    const prods = await window.electronAPI.getProducts(categoryId);
    setProducts(prods);
  }, [activeBranch?.key]);

  const loadCategories = useCallback(async () => {
    const cats = await window.electronAPI.getCategories();
    const sultan = activeBranch?.key === 'sultansomati';
    const allProductsCategoryObj = {
      id: ALL_PRODUCTS_CATEGORY_ID,
      name: 'Tüm ürünler',
      order_index: -1
    };
    const yanUrunlerCategory = {
      id: YAN_URUNLER_CATEGORY_ID,
      name: 'Yan Ürünler',
      order_index: 9999
    };
    const categoryToSelect = allProductsCategoryObj;

    if (sultan) {
      const filtered = filterYanUrunlerCategoriesForSultan([...cats]);
      setCategories([allProductsCategoryObj, ...filtered]);
      setYanUrunler([]);
    } else {
      setCategories([allProductsCategoryObj, ...cats, yanUrunlerCategory]);
      if (window.electronAPI && window.electronAPI.getYanUrunler) {
        const yanUrunlerList = await window.electronAPI.getYanUrunler();
        setYanUrunler(yanUrunlerList);
      }
    }

    setSelectedCategory(allProductsCategoryObj);
    await loadProducts(ALL_PRODUCTS_CATEGORY_ID);
  }, [activeBranch?.key, loadProducts]);

  useEffect(() => {
    if (!isBranchReady) return;
    let cancelled = false;
    (async () => {
      await loadCategories();
      let attempts = 0;
      const maxAttempts = 40;
      while (!cancelled && attempts < maxAttempts) {
        const cats = await window.electronAPI.getCategories();
        if (cats.length > 0) {
          await loadCategories();
          break;
        }
        attempts += 1;
        await new Promise((r) => setTimeout(r, 200));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isBranchReady, loadCategories]);

  // Arama aktifken tüm katalog hâlâ boşsa, yazmayı bıraktıktan sonra katalog yükle (tuş başına istek yok)
  useEffect(() => {
    if (!isBranchReady || !searchQuery.trim()) return;
    if (allProducts.length > 0) return;
    if (!window.electronAPI?.getProducts) return;
    let cancelled = false;
    const t = setTimeout(() => {
      (async () => {
        try {
          const all = await window.electronAPI.getProducts(null);
          if (!cancelled) setAllProducts(Array.isArray(all) ? all : []);
        } catch {
          /* sessiz */
        }
      })();
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isBranchReady, searchQuery, allProducts.length]);

  // Arama sorgusuna göre ürünleri filtrele
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) {
      return products;
    }
    const query = searchQuery.trim().toLocaleLowerCase('tr-TR');
    const sultan = activeBranch?.key === 'sultansomati';
    const yanExtras = sultan
      ? []
      : yanUrunler.map(urun => ({
          id: `yan_urun_${urun.id}`,
          name: urun.name,
          price: urun.price,
          category_id: YAN_URUNLER_CATEGORY_ID,
          isYanUrun: true
        }));
    const seen = new Set();
    const pool = [];
    for (const p of [...allProducts, ...yanExtras]) {
      const id = p?.id;
      if (id === undefined || id === null || seen.has(id)) continue;
      seen.add(id);
      pool.push(p);
    }
    return pool.filter((product) =>
      String(product?.name ?? '')
        .toLocaleLowerCase('tr-TR')
        .includes(query)
    );
  }, [products, allProducts, searchQuery, yanUrunler, activeBranch?.key]);

  const refreshProducts = async () => {
    const cats = await window.electronAPI.getCategories();
    const sultan = activeBranch?.key === 'sultansomati';
    const allProductsCategoryObj = {
      id: ALL_PRODUCTS_CATEGORY_ID,
      name: 'Tüm ürünler',
      order_index: -1
    };
    const yanUrunlerCategory = {
      id: YAN_URUNLER_CATEGORY_ID,
      name: 'Yan Ürünler',
      order_index: 9999
    };

    if (sultan) {
      setCategories([allProductsCategoryObj, ...filterYanUrunlerCategoriesForSultan([...cats])]);
      setYanUrunler([]);
    } else {
      setCategories([allProductsCategoryObj, ...cats, yanUrunlerCategory]);
      if (window.electronAPI && window.electronAPI.getYanUrunler) {
        const yanUrunlerList = await window.electronAPI.getYanUrunler();
        setYanUrunler(yanUrunlerList);
      }
    }

    const allProds = await window.electronAPI.getProducts(null);
    const allList = Array.isArray(allProds) ? allProds : [];
    setAllProducts(allList);

    let categoryToLoad = selectedCategory;
    const allCategories = sultan
      ? [allProductsCategoryObj, ...filterYanUrunlerCategoriesForSultan([...cats])]
      : [allProductsCategoryObj, ...cats, yanUrunlerCategory];
    if (allCategories.length > 0) {
      if (!categoryToLoad || !allCategories.find(c => c.id === categoryToLoad.id)) {
        categoryToLoad = allCategories[0];
        setSelectedCategory(allCategories[0]);
      } else {
        // Mevcut kategoriyi güncelle (order_index değişmiş olabilir)
        const updatedCategory = allCategories.find(c => c.id === categoryToLoad.id);
        if (updatedCategory) {
          setSelectedCategory(updatedCategory);
          categoryToLoad = updatedCategory;
        }
      }
      
      if (categoryToLoad) {
        if (categoryToLoad.id === ALL_PRODUCTS_CATEGORY_ID) {
          setProducts(allList);
        } else {
          await loadProducts(categoryToLoad.id);
        }
      }
    }
  };

  // PERFORMANS: useCallback ile memoize et
  const addToCart = useCallback((product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  }, []);

  const updateCartItemQuantity = useCallback((productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  }, [removeFromCart]);

  const toggleGift = useCallback((productId) => {
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId ? { ...item, isGift: !item.isGift } : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setOrderNote('');
    setSelectedTable(null);
  }, []);

  const handleTableSelect = (table) => {
    setSelectedTable(table);
    setCurrentView('pos'); // Masa seçildiğinde pos view'a geç
    // İlk kategoriyi yükle
    if (categories.length > 0 && !selectedCategory) {
      const first = categories[0];
      setSelectedCategory(first);
      loadProducts(first.id);
    }
  };

  const requestAdisyon = async () => {
    if (cart.length === 0 || !selectedTable) return;
    
    if (!window.electronAPI) {
      showToast('Hata: Yazdırma API yüklenemedi. Lütfen uygulamayı yeniden başlatın.', 'error');
      return;
    }

    const jobId = preparedPrintJobIdRef.current;
    if (jobId && window.electronAPI.printAdisyonByJobId) {
      try {
        setPrintToast({ status: 'printing', message: 'Adisyon yazdırılıyor...' });
        const result = await window.electronAPI.printAdisyonByJobId(jobId);
        preparedPrintJobIdRef.current = null;
        if (result?.success) {
          setPrintToast({ status: 'success', message: 'Adisyon başarıyla yazdırıldı' });
        } else {
          setPrintToast({ status: 'error', message: result?.error || 'Adisyon yazdırılamadı' });
        }
      } catch (error) {
        preparedPrintJobIdRef.current = null;
        setPrintToast({ status: 'error', message: 'Adisyon yazdırılamadı: ' + (error?.message || error) });
      }
      return;
    }

    if (!window.electronAPI.printAdisyon) {
      showToast('Hata: Adisyon yazdırma API\'si yüklenemedi.', 'error');
      return;
    }
    
    const adisyonData = {
      items: cart,
      tableName: selectedTable.name,
      tableType: selectedTable.type,
      orderNote: orderNote || null,
      sale_date: new Date().toLocaleDateString('tr-TR'),
      sale_time: new Date().toLocaleTimeString('tr-TR'),
      cashierOnly: true
    };

    try {
      setPrintToast({ status: 'printing', message: 'Adisyon yazdırılıyor...' });
      const result = await window.electronAPI.printAdisyon(adisyonData);
      if (result?.success) {
        setPrintToast({ status: 'success', message: 'Adisyon başarıyla yazdırıldı' });
      } else {
        setPrintToast({ status: 'error', message: result?.error || 'Adisyon yazdırılamadı' });
      }
    } catch (error) {
      setPrintToast({ status: 'error', message: 'Adisyon yazdırılamadı: ' + (error?.message || error) });
    }
  };

  // Sepetteyken fişi arka planda hazırla (Adisyon Yazdır / Masaya Kaydet anında anında yazdırılır)
  useEffect(() => {
    if (cart.length === 0 || !selectedTable) {
      preparedPrintJobIdRef.current = null;
      preparedReceiptsRef.current = {};
      return;
    }
    const now = new Date();
    const currentDate = now.toLocaleDateString('tr-TR');
    const currentTime = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const itemsWithTime = cart.map(item => ({
      ...item,
      staff_name: null,
      added_date: currentDate,
      added_time: currentTime
    }));
    const adisyonData = {
      items: itemsWithTime,
      tableName: selectedTable.name,
      tableType: selectedTable.type,
      orderNote: orderNote || null,
      sale_date: currentDate,
      sale_time: currentTime,
      cashierOnly: true
    };
    if (window.electronAPI?.prepareAdisyonDesktop) {
      window.electronAPI.prepareAdisyonDesktop(adisyonData).then(({ printJobId }) => {
        preparedPrintJobIdRef.current = printJobId || null;
      }).catch(() => { preparedPrintJobIdRef.current = null; });
    }
    if (window.electronAPI?.prepareAdisyonReceipts) {
      window.electronAPI.prepareAdisyonReceipts(adisyonData).then((receipts) => {
        preparedReceiptsRef.current = receipts || {};
      }).catch(() => { preparedReceiptsRef.current = {}; });
    }
  }, [cart, selectedTable, orderNote]);

  const completeTableOrder = async () => {
    if (cart.length === 0 || !selectedTable) return;
    
    if (!window.electronAPI || !window.electronAPI.createTableOrder) {
      console.error('createTableOrder API mevcut değil. Lütfen uygulamayı yeniden başlatın.');
      showToast('Hata: Masa siparişi API\'si yüklenemedi. Lütfen uygulamayı yeniden başlatın.', 'error');
      return;
    }
    
    const totalAmount = cart.reduce((sum, item) => {
      // İkram edilen ürünleri toplamdan çıkar
      if (item.isGift) return sum;
      return sum + (item.price * item.quantity);
    }, 0);
    
    let effectiveTableName = selectedTable.name;
    const hasExistingOrderForSelected = Boolean(window.electronAPI?.getTableOrders);
    if (isSuriciBranch && hasExistingOrderForSelected) {
      try {
        const tableOrders = await window.electronAPI.getTableOrders();
        const existing = (tableOrders || []).find(
          (o) => o.table_id === selectedTable.id && o.status === 'pending'
        );
        if (!existing) {
          const enteredName = await new Promise((resolve) => {
            suriciNameResolverRef.current = resolve;
            setSuriciGuestName('');
            setShowSuriciNameModal(true);
          });
          const normalizedName = String(enteredName || '').trim();
          if (!normalizedName) {
            showToast('İsim soyisim girilmeden masaya kayıt yapılamaz.', 'warning');
            return;
          }
          effectiveTableName = normalizedName;
        } else if (existing.table_name) {
          effectiveTableName = existing.table_name;
        }
      } catch (_) {}
    }

    const orderData = {
      items: cart,
      totalAmount,
      tableId: selectedTable.id,
      tableName: effectiveTableName,
      tableType: selectedTable.type,
      orderNote: orderNote || null
    };

    setIsSubmittingTableOrder(true);
    try {
      const result = await window.electronAPI.createTableOrder(orderData);
      
      if (result.success) {
        if (!result.isNewOrder) {
          console.log('📦 Mevcut siparişe eklendi:', result.orderId);
        } else {
          console.log('✨ Yeni sipariş oluşturuldu:', result.orderId);
        }
        // Suriçi şubesi: masaya kaydeder etmez kategori bazlı adisyonu otomatik yazdır
        if (isSuriciBranch && window.electronAPI?.printAdisyon) {
          const now = new Date();
          const currentDate = now.toLocaleDateString('tr-TR');
          const currentTime = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const itemsWithTime = cart.map(item => ({
            ...item,
            staff_name: null,
            added_date: currentDate,
            added_time: currentTime
          }));
          const adisyonData = {
            items: itemsWithTime,
            tableName: effectiveTableName,
            tableType: selectedTable.type,
            orderNote: orderNote || null,
            sale_date: currentDate,
            sale_time: currentTime,
            cashierOnly: true
          };
          setPrintToast({ status: 'printing', message: 'Kategori fişleri yazdırılıyor...' });
          window.electronAPI.printAdisyon(adisyonData)
            .then((printResult) => {
              if (printResult?.success) {
                setPrintToast({ status: 'success', message: 'Kategori fişleri yazdırıldı' });
              } else {
                setPrintToast({ status: 'error', message: printResult?.error || 'Kategori fişleri yazdırılamadı' });
              }
            })
            .catch((printError) => {
              console.error('Suriçi otomatik adisyon yazdırma hatası:', printError);
              setPrintToast({ status: 'error', message: 'Kategori fişleri yazdırılamadı' });
            });
        }

        // Diğer şubeler: adisyon otomatik yazdırılmaz (kullanıcı isterse Adisyon Yazdır ile yazdırabilir)
        preparedPrintJobIdRef.current = null;
        
        // Sepeti temizle
        setCart([]);
        setOrderNote('');
        
        // Mevcut siparişe ekleme durumunda masa seçimini koru, yeni sipariş durumunda temizle
        if (result.isNewOrder) {
          setSelectedTable(null);
        }
        setAutoOpenOrderId(result.orderId || null);
        setAutoOpenTableId(result.tableId || selectedTable.id || null);
        setCurrentView('tables');
        // Mevcut siparişe eklendiyse masa seçili kalır, böylece tekrar ürün eklenebilir
        
        setSaleSuccessInfo({ 
          totalAmount, 
          paymentMethod: 'Masaya Kaydedildi',
          tableName: effectiveTableName
        });
        // Masalar görünümünü yenile
        setTableRefreshTrigger(Date.now());
      }
    } catch (error) {
      console.error('Masa siparişi kaydedilirken hata:', error);
      showToast('Masa siparişi kaydedilemedi: ' + error.message, 'error');
    } finally {
      setIsSubmittingTableOrder(false);
    }
  };

  const handlePayment = () => {
    if (cart.length === 0) return;
    setShowPaymentModal(true);
  };

  const completeSale = async (paymentMethod) => {
    if (paymentMethod === 'split') {
      // Ayrı ödemeler modal'ını aç
      setShowPaymentModal(false);
      setShowSplitPaymentModal(true);
      return;
    }

    const totalAmount = cart.reduce((sum, item) => {
      // İkram edilen ürünleri toplamdan çıkar
      if (item.isGift) return sum;
      return sum + (item.price * item.quantity);
    }, 0);
    
    const saleData = {
      items: cart,
      totalAmount,
      paymentMethod,
      orderNote: orderNote || null
    };

    setIsCompletingSale(true);
    try {
    const result = await window.electronAPI.createSale(saleData);
    
    if (result.success) {
      setShowPaymentModal(false);
      
      // Kasa yazıcısından satış fişi yazdır (sadece kasa yazıcısına)
      const receiptData = {
        sale_id: result.saleId,
        totalAmount,
        paymentMethod,
        sale_date: new Date().toLocaleDateString('tr-TR'),
        sale_time: new Date().toLocaleTimeString('tr-TR'),
        items: cart,
        orderNote: orderNote || null,
        cashierOnly: true // Sadece kasa yazıcısına yazdır
      };
      
      if (window.electronAPI && window.electronAPI.printReceipt) {
        setPrintToast({ status: 'printing', message: 'Fiş yazdırılıyor...' });
        window.electronAPI.printReceipt(receiptData).then(result => {
          if (result.success) {
            setPrintToast({ status: 'success', message: 'Fiş başarıyla yazdırıldı' });
          } else {
            setPrintToast({ status: 'error', message: result.error || 'Fiş yazdırılamadı' });
          }
        }).catch(err => {
          console.error('Fiş yazdırılırken hata:', err);
          setPrintToast({ status: 'error', message: 'Fiş yazdırılamadı: ' + err.message });
        });
      }
      
      // Kategori bazlı yazıcılardan adisyon yazdır
      const adisyonData = {
        items: cart,
        tableName: null, // Hızlı satış için masa yok
        tableType: null,
        orderNote: orderNote || null,
        sale_date: new Date().toLocaleDateString('tr-TR'),
        sale_time: new Date().toLocaleTimeString('tr-TR')
      };
      
      if (window.electronAPI && window.electronAPI.printAdisyon) {
        // Arka planda yazdır, hata olsa bile devam et
        window.electronAPI.printAdisyon(adisyonData).catch(err => {
          console.error('Adisyon yazdırılırken hata:', err);
        });
      }
      
      // Fiş modal'ını göster
      setReceiptData({
        sale_id: result.saleId,
        totalAmount,
        paymentMethod,
        sale_date: new Date().toLocaleDateString('tr-TR'),
        sale_time: new Date().toLocaleTimeString('tr-TR'),
        items: cart,
        orderNote: orderNote || null
      });
      setShowReceiptModal(true);
      const currentNote = orderNote;
      clearCart();
      setSaleSuccessInfo({ totalAmount, paymentMethod });
    }
    } finally {
      setIsCompletingSale(false);
    }
  };

  const completeSplitPayment = async (payments) => {
    // Parçalı ödeme için tek bir satış oluştur (tüm ürünler bir arada)
    const totalAmount = cart.reduce((sum, item) => {
      // İkram edilen ürünleri toplamdan çıkar
      if (item.isGift) return sum;
      return sum + (item.price * item.quantity);
    }, 0);
    
    // Ödeme yöntemlerini birleştir (örn: "Nakit + Kredi Kartı")
    const paymentMethods = [...new Set(payments.map(p => p.method))];
    const paymentMethodString = paymentMethods.join(' + ');

    // Ödeme detaylarını string olarak oluştur
    const paymentDetails = payments.map(p => `${p.method}: ₺${p.amount.toFixed(2)}`).join(', ');

    const saleData = {
      items: cart,
      totalAmount,
      paymentMethod: `Parçalı Ödeme (${paymentDetails})`,
      orderNote: orderNote || null
    };

    setIsCompletingSplitPayment(true);
    try {
    const result = await window.electronAPI.createSale(saleData);
    
    if (result.success) {
      setShowSplitPaymentModal(false);
      // Fiş modal'ını göster
      const receiptData = {
        sale_id: result.saleId,
        totalAmount,
        paymentMethod: `Parçalı Ödeme (${paymentDetails})`,
        sale_date: new Date().toLocaleDateString('tr-TR'),
        sale_time: new Date().toLocaleTimeString('tr-TR'),
        items: cart,
        orderNote: orderNote || null
      };
      
      // Kasa yazıcısından satış fişi yazdır (sadece kasa yazıcısına)
      if (window.electronAPI && window.electronAPI.printReceipt) {
        setPrintToast({ status: 'printing', message: 'Fiş yazdırılıyor...' });
        window.electronAPI.printReceipt({
          ...receiptData,
          cashierOnly: true // Sadece kasa yazıcısına yazdır
        }).then(result => {
          if (result.success) {
            setPrintToast({ status: 'success', message: 'Fiş başarıyla yazdırıldı' });
          } else {
            setPrintToast({ status: 'error', message: result.error || 'Fiş yazdırılamadı' });
          }
        }).catch(err => {
          console.error('Fiş yazdırılırken hata:', err);
          setPrintToast({ status: 'error', message: 'Fiş yazdırılamadı: ' + err.message });
        });
      }
      
      // Kategori bazlı yazıcılardan adisyon yazdır
      const adisyonData = {
        items: cart,
        tableName: null, // Hızlı satış için masa yok
        tableType: null,
        orderNote: orderNote || null,
        sale_date: new Date().toLocaleDateString('tr-TR'),
        sale_time: new Date().toLocaleTimeString('tr-TR')
      };
      
      if (window.electronAPI && window.electronAPI.printAdisyon) {
        // Arka planda yazdır, hata olsa bile devam et
        window.electronAPI.printAdisyon(adisyonData).catch(err => {
          console.error('Adisyon yazdırılırken hata:', err);
        });
      }
      
      clearCart();
      setSaleSuccessInfo({ 
        totalAmount, 
        paymentMethod: `Parçalı Ödeme (${paymentDetails})`,
        splitPayment: true
      });
    }
    } finally {
      setIsCompletingSplitPayment(false);
    }
  };

  const getTotalAmount = () => {
    return cart.reduce((sum, item) => {
      // İkram edilen ürünleri toplamdan çıkar
      if (item.isGift) return sum;
      return sum + (item.price * item.quantity);
    }, 0);
  };

  const getTotalItems = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  const handleExit = () => {
    setExitAction('quit');
    setShowExitSplash(true);
  };

  const handleLogout = () => {
    setExitAction('logout');
    setShowExitSplash(true);
  };

  const handleExitComplete = async () => {
    if (exitAction === 'logout') {
      setShowExitSplash(false);
      setIsBranchReady(false);
      setActiveBranch(null);
      setSelectedBranchKey('');
      setCurrentView('pos');
      setSelectedTable(null);
      setCart([]);
      setOrderNote('');
      // Çıkışta her zaman şube seçim ekranı (otomatik bağlanmayı tetikleme: branchBootstrapKey dokunma)
      setBranchGateResolved(true);
      return;
    }

    // Veritabanını kaydet ve uygulamayı kapat
    if (window.electronAPI && window.electronAPI.quitApp) {
      await window.electronAPI.quitApp();
    } else {
      // Fallback
      window.close();
    }
  };

  const handleSaveExpense = async (expenseData) => {
    const saleData = {
      items: [{
        id: 'expense-' + Date.now(),
        name: expenseData.title,
        price: expenseData.amount,
        quantity: 1,
        isExpense: true
      }],
      totalAmount: expenseData.amount,
      paymentMethod: 'Masraf',
      orderNote: null,
      isExpense: true
    };

    setIsSavingExpense(true);
    try {
    const result = await window.electronAPI.createSale(saleData);
    
    if (result.success) {
      setShowExpenseModal(false);
      setSaleSuccessInfo({ 
        totalAmount: expenseData.amount, 
        paymentMethod: 'Masraf',
        expenseTitle: expenseData.title
      });
    }
    } finally {
      setIsSavingExpense(false);
    }
  };

  const handleBranchLogin = async () => {
    const normalized = (selectedBranchKey || '').trim().toLowerCase();
    if (!normalized) {
      setBranchError('Lutfen bir sube secin.');
      return;
    }
    if (!VALID_BRANCH_KEYS.has(normalized)) {
      setBranchError('Gecersiz sube secimi.');
      return;
    }

    if (!window.electronAPI?.activateBranch) {
      setBranchError('Sistem baglantisi bulunamadi.');
      return;
    }

    setBranchError('');
    setIsActivatingBranch(true);
    try {
      const result = await window.electronAPI.activateBranch(normalized);
      if (!result?.success) {
        setBranchError(result?.error || 'Sube baglantisi kurulamadi.');
        return;
      }
      setActiveBranch(result.branch || { key: normalized, label: normalized });
      setSelectedBranchKey(normalized);
      setIsBranchReady(true);
      setCurrentView(normalized === 'makarasur' || normalized === 'sultansomati' ? 'tables' : 'pos');
      try {
        localStorage.setItem(BRANCH_ONBOARDING_KEY, '1');
        localStorage.setItem(LAST_BRANCH_SPLASH_KEY, normalized);
      } catch (_) {}
      setSplashBranchKey(normalized);
    } catch (error) {
      setBranchError(error?.message || 'Sube aktivasyonunda hata olustu.');
    } finally {
      setIsActivatingBranch(false);
    }
  };

  const handleBranchChangeFromSettings = async (newKey) => {
    const normalized = String(newKey || '').trim().toLowerCase();
    if (!VALID_BRANCH_KEYS.has(normalized)) return;
    const cur = (activeBranch?.key || selectedBranchKey || '').toLowerCase();
    if (cur === normalized) {
      showToast('Zaten bu şubedesiniz.', 'info');
      return;
    }
    if (!window.electronAPI?.activateBranch) {
      showToast('Şube bağlantısı kullanılamıyor.', 'error');
      return;
    }
    try {
      const result = await window.electronAPI.activateBranch(normalized);
      if (!result?.success) {
        showToast(result?.error || 'Şube değiştirilemedi', 'error');
        return;
      }
      try {
        localStorage.setItem(BRANCH_ONBOARDING_KEY, '1');
        localStorage.setItem(LAST_BRANCH_SPLASH_KEY, normalized);
      } catch (_) {}
      setActiveBranch(result.branch || { key: normalized });
      setSelectedBranchKey(normalized);
      setSplashBranchKey(normalized);
      setCurrentView(normalized === 'makarasur' || normalized === 'sultansomati' ? 'tables' : 'pos');
      setSelectedTable(null);
      setCart([]);
      setOrderNote('');
      await refreshProducts();
      showToast('Şube güncellendi.', 'success');
    } catch (e) {
      showToast(e?.message || 'Şube değiştirilemedi', 'error');
    }
  };

  if (!showSplash && !isBranchReady && !branchGateResolved) {
    return (
      <>
        <CatalogSyncProgressBar progress={catalogSyncProgress} />
        {showExitSplash && (
          <ExitSplash onComplete={handleExitComplete} />
        )}
        <div className="min-h-screen w-full bg-white flex flex-col items-center justify-center gap-4 p-6">
          <div className="h-12 w-12 rounded-full border-4 border-pink-200 border-t-pink-600 animate-spin" />
          <p className="text-slate-600 font-medium text-center">Şube bağlanıyor…</p>
        </div>
      </>
    );
  }

  if (!showSplash && !isBranchReady && branchGateResolved) {
    return (
      <>
        <CatalogSyncProgressBar progress={catalogSyncProgress} />
        {showExitSplash && (
          <ExitSplash onComplete={handleExitComplete} />
        )}
        <div className="min-h-screen w-full bg-gradient-to-br from-slate-100 via-white to-rose-50 flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
          <div className="absolute -top-20 -left-20 w-80 h-80 bg-red-200/25 rounded-full blur-3xl" />
          <div className="absolute -bottom-28 -right-16 w-96 h-96 bg-slate-200/35 rounded-full blur-3xl" />

          <div className="relative w-full max-w-7xl min-h-[88vh] bg-white/95 backdrop-blur-xl rounded-[36px] border border-slate-200 shadow-[0_28px_80px_rgba(15,23,42,0.16)] px-7 py-8 md:px-14 md:py-12 flex flex-col justify-center">
            <div className="mb-10 text-center">
              <div className="mx-auto mb-5 h-24 w-24 md:h-28 md:w-28 rounded-3xl bg-white shadow-[0_12px_34px_rgba(0,0,0,0.14)] border border-slate-100 flex items-center justify-center overflow-hidden">
                <img
                  src="./logo.png"
                  alt="Makara Logo"
                  className="h-full w-full object-contain p-2"
                />
              </div>
              <h1 className="text-5xl md:text-6xl font-black tracking-tight text-slate-900">MAKARA</h1>
              <p className="text-base md:text-lg text-slate-500 mt-3">Sube secimi</p>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {BRANCH_OPTIONS.map((branch) => {
                  const isSelected = selectedBranchKey === branch.key;
                  const branchBgImage = branch.key === 'makara'
                    ? './L_height.webp'
                    : branch.key === 'makarasur'
                    ? './meramin-yeni-merkezi-surici-carsisi-003.jpg'
                    : './logo.png';
                  return (
                    <button
                      key={branch.key}
                      type="button"
                      onClick={() => {
                        setSelectedBranchKey(branch.key);
                        setBranchError('');
                      }}
                      className={`relative overflow-hidden text-left rounded-3xl border p-6 md:p-8 transition-all duration-200 aspect-square min-h-[280px] md:min-h-[360px] flex ${
                        isSelected
                          ? 'border-pink-400 shadow-[0_20px_45px_rgba(236,72,153,0.35)] ring-4 ring-pink-200/90 scale-[1.02]'
                          : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                      }`}
                      style={{
                        backgroundImage: `url(${branchBgImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}
                    >
                      <div className="absolute inset-0 bg-black/80" />
                      {isSelected && (
                        <>
                          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-pink-400/80 via-pink-300/55 to-transparent" />
                          <div className="absolute inset-0 ring-2 ring-white/45 rounded-3xl" />
                        </>
                      )}
                      <div className="relative z-10 w-full h-full flex items-center justify-center text-center">
                        {isSelected && (
                          <span className="absolute top-5 left-5 px-3 py-1 rounded-full bg-pink-500/90 text-white text-xs md:text-sm font-bold tracking-wide shadow-lg">
                            Seçili
                          </span>
                        )}
                        <div className="flex flex-col items-center">
                          <p className="text-3xl md:text-4xl font-extrabold tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
                            {branch.label}
                          </p>
                          <p className="text-base md:text-lg mt-3 text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">
                            {branch.subtitle}
                          </p>
                        </div>
                        <span
                          className={`absolute top-5 right-5 inline-flex h-7 w-7 items-center justify-center rounded-full border ${
                            isSelected ? 'border-pink-400 bg-pink-500 shadow-sm' : 'border-white/80 bg-white/15 backdrop-blur'
                          }`}
                        >
                          {isSelected ? (
                            <span className="h-3 w-3 rounded-full bg-white" />
                          ) : null}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {branchError && (
                <p className="text-sm text-red-600 font-medium">{branchError}</p>
              )}
              <button
                onClick={handleBranchLogin}
                disabled={isActivatingBranch || !selectedBranchKey}
                className="w-full mt-2 py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-fuchsia-600 hover:from-pink-600 hover:to-fuchsia-700 disabled:opacity-60 text-white text-lg font-extrabold tracking-wide transition-all"
              >
                {isActivatingBranch ? 'Baglaniyor...' : 'Devam Et'}
              </button>
              <p className="text-sm text-slate-500 mt-2 text-center">
                İlk kurulumda bir kez şube seçin; bu cihazda hatırlanır. Değiştirmek için Ayarlar → Şube.
              </p>
            </div>
          </div>

        </div>
      </>
    );
  };

  return (
    <>
      <CatalogSyncProgressBar progress={catalogSyncProgress} />
      {showSplash && (
        <SplashScreen
          branchKey={splashBranchKey}
          onComplete={() => setShowSplash(false)}
        />
      )}

      {showExitSplash && (
        <ExitSplash onComplete={handleExitComplete} />
      )}
      <div className={isSultanBranch ? 'theme-sultan' : ''}>
      <div className="min-h-screen bg-gradient-to-br from-[#f0f4ff] via-[#e0e7ff] to-[#fce7f3] theme-sultan:from-emerald-50 theme-sultan:via-green-50 theme-sultan:to-teal-50 text-gray-800">
        <Navbar 
        currentView={currentView} 
        setCurrentView={(view) => {
          setCurrentView(view);
          // Masalar görünümüne geçildiğinde seçili masayı temizle
          if (view === 'tables') {
            setSelectedTable(null);
            clearCart();
          }
        }}
        totalItems={getTotalItems()}
        userType={userType}
        setUserType={setUserType}
        onRoleSplash={triggerRoleSplash}
        onProductsUpdated={refreshProducts}
        onExit={handleExit}
        onLogout={handleLogout}
        onOpenSettings={() => setCurrentView('settings')}
        systemTitle={systemTitle}
        isSuriciBranch={isSuriciBranch}
        isSultanBranch={isSultanBranch}
      />
      
      {currentView === 'settings' ? (
        <div className="h-[calc(100vh-80px)] overflow-hidden bg-white">
          <SettingsModal
            variant="page"
            onClose={() => setCurrentView('pos')}
            onProductsUpdated={refreshProducts}
            currentBranchKey={activeBranch?.key || selectedBranchKey}
            branchOptions={BRANCH_OPTIONS}
            onBranchChange={handleBranchChangeFromSettings}
          />
        </div>
      ) : currentView === 'tables' ? (
        <div className="p-6">
          <TablePanel 
            onSelectTable={handleTableSelect}
            branchKey={activeBranch?.key || selectedBranchKey}
            refreshTrigger={tableRefreshTrigger}
            autoOpenOrderId={autoOpenOrderId}
            autoOpenTableId={autoOpenTableId}
            onAutoOpenConsumed={() => {
              setAutoOpenOrderId(null);
              setAutoOpenTableId(null);
            }}
            onShowReceipt={(receiptData) => {
              setReceiptData(receiptData);
              setShowReceiptModal(true);
            }}
          />
        </div>
      ) : currentView === 'pos' ? (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)]">
          {/* Sol Panel — katalog (sabit tipografi, kurumsal düzen) */}
          <div className="pos-catalog w-full lg:flex-1 flex flex-col px-3 py-3 sm:px-4 sm:py-4 lg:px-5 overflow-hidden">
            {selectedTable && (
              <div className="mb-3 rounded-[var(--pos-radius-lg)] border border-slate-200 bg-slate-900 text-white shadow-[0_4px_14px_rgba(15,23,42,0.18)] flex items-center justify-between gap-3 px-4 py-3 theme-sultan:border-emerald-900/40 theme-sultan:bg-emerald-950">
                <p
                  className="font-semibold min-w-0 leading-snug"
                  style={{ fontSize: 'var(--pos-fs-input)' }}
                >
                  <span className="text-white/70 font-medium">
                    {isSuriciBranch ? 'Müşteri' : 'Masa'}
                  </span>
                  <span className="mx-1.5 text-white/40">·</span>
                  <span className="break-words">{selectedTable.name}</span>
                  <span className="block sm:inline sm:ml-1 text-white/80 font-normal mt-0.5 sm:mt-0">
                    için sipariş
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTable(null);
                    clearCart();
                  }}
                  className="shrink-0 min-h-[var(--pos-touch-min)] min-w-[var(--pos-touch-min)] flex items-center justify-center rounded-[var(--pos-radius-sm)] bg-white/10 hover:bg-white/20 transition-colors touch-manipulation"
                  title="Masa seçimini iptal et"
                  aria-label="Masa seçimini iptal et"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            <div className="shrink-0">
              <CategoryPanel
                categories={categories}
                selectedCategory={selectedCategory}
                isSultanBranch={isSultanBranch}
                onSelectCategory={(category) => {
                  setSelectedCategory(category);
                  setSearchQuery('');
                  loadProducts(category.id);
                }}
              />
              {selectedCategory && selectedCategory.id === YAN_URUNLER_CATEGORY_ID && userType === 'Admin' && !isSultanBranch && (
                <div className="mt-3 mb-1">
                  <button
                    type="button"
                    onClick={() => setShowYanUrunlerModal(true)}
                    className="w-full min-h-[var(--pos-touch-min)] px-4 rounded-[var(--pos-radius-md)] border-2 border-amber-300 bg-amber-50 text-amber-950 font-semibold hover:bg-amber-100 hover:border-amber-400 transition-colors flex items-center justify-center gap-2 shadow-sm"
                    style={{ fontSize: 'var(--pos-fs-input)' }}
                  >
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Yan ürünler yönetimi</span>
                  </button>
                </div>
              )}
            </div>

            <div className="mb-3 flex flex-col sm:flex-row gap-2 shrink-0">
              <div className="flex-1 relative min-w-0">
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tüm kategorilerde ara…"
                  autoComplete="off"
                  className="w-full min-h-[var(--pos-touch-min)] pl-11 pr-10 bg-white border border-slate-200 rounded-[var(--pos-radius-md)] shadow-[0_1px_2px_rgba(15,23,42,0.04)] text-slate-900 font-medium placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-400 theme-sultan:focus:ring-emerald-500/30 theme-sultan:focus:border-emerald-500"
                  style={{ fontSize: 'var(--pos-fs-input)' }}
                />
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 min-h-9 min-w-9 flex items-center justify-center rounded-[var(--pos-radius-sm)] text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                    aria-label="Aramayı temizle"
                  >
                    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ) : null}
              </div>
              {userType === 'Admin' && (
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(true)}
                  className="min-h-[var(--pos-touch-min)] px-4 rounded-[var(--pos-radius-md)] bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 whitespace-nowrap shadow-sm theme-sultan:bg-emerald-800 theme-sultan:hover:bg-emerald-900"
                  style={{ fontSize: 'var(--pos-fs-input)' }}
                >
                  <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Masraf ekle</span>
                </button>
              )}
            </div>
            {searchQuery ? (
              <p
                className="mb-2 text-slate-600 font-medium shrink-0"
                style={{ fontSize: 'var(--pos-fs-meta)' }}
              >
                {filteredProducts.length > 0
                  ? `Tüm kategorilerde ${filteredProducts.length} ürün bulundu`
                  : 'Tüm kategorilerde eşleşen ürün yok'}
              </p>
            ) : null}

            <ProductGrid
              products={filteredProducts}
              onAddToCart={addToCart}
              isSearchMode={Boolean(searchQuery.trim())}
            />
          </div>

          {/* Sağ Panel - Sepet */}
          <div className="w-full lg:w-[420px] bg-gradient-to-b from-pink-50 theme-sultan:from-emerald-50/80 to-fuchsia-50 theme-sultan:to-green-50/80 backdrop-blur-xl border-t lg:border-t-0 lg:border-l border-pink-200 theme-sultan:border-emerald-200 p-6 mt-4 lg:mt-0">
            <Cart
              cart={cart}
              onUpdateQuantity={updateCartItemQuantity}
              onRemoveItem={removeFromCart}
              onClearCart={clearCart}
              onCheckout={handlePayment}
              onSaveToTable={completeTableOrder}
              isSavingToTable={isSubmittingTableOrder}
              onRequestAdisyon={requestAdisyon}
              totalAmount={getTotalAmount()}
              selectedTable={selectedTable}
              isSuriciBranch={isSuriciBranch}
              orderNote={orderNote}
              onOrderNoteChange={setOrderNote}
              onToggleGift={toggleGift}
            />
          </div>
        </div>
      ) : (
        <div className="p-6">
          <SalesHistory />
        </div>
      )}

      {showPaymentModal && (
        <PaymentModal
          totalAmount={getTotalAmount()}
          onSelectPayment={completeSale}
          onClose={() => setShowPaymentModal(false)}
          isSubmitting={isCompletingSale}
        />
      )}

      {showSplitPaymentModal && (
        <SplitPaymentModal
          cart={cart}
          totalAmount={getTotalAmount()}
          onCompleteSplitPayment={completeSplitPayment}
          onClose={() => setShowSplitPaymentModal(false)}
          isSubmitting={isCompletingSplitPayment}
        />
      )}

      {showExpenseModal && (
        <ExpenseModal
          onClose={() => setShowExpenseModal(false)}
          onSave={handleSaveExpense}
          isSubmitting={isSavingExpense}
        />
      )}

      {/* Yan Ürünler Yönetim Modal */}
      {showYanUrunlerModal && !isSultanBranch && (
        <YanUrunlerManagementModal
          yanUrunler={yanUrunler}
          onClose={() => {
            setShowYanUrunlerModal(false);
            loadCategories(); // Yan ürünleri yenile
          }}
          onRefresh={async () => {
            if (window.electronAPI && window.electronAPI.getYanUrunler) {
              const yanUrunlerList = await window.electronAPI.getYanUrunler();
              setYanUrunler(yanUrunlerList);
              // Eğer Yan Ürünler kategorisi seçiliyse ürünleri yenile
              if (selectedCategory && selectedCategory.id === YAN_URUNLER_CATEGORY_ID) {
                loadProducts(YAN_URUNLER_CATEGORY_ID);
              }
            }
          }}
        />
      )}

      {activeRoleSplash && <RoleSplash role={activeRoleSplash} />}
      <SaleSuccessToast
        info={saleSuccessInfo}
        onClose={() => setSaleSuccessInfo(null)}
      />
      <PrintToast
        status={printToast?.status}
        message={printToast?.message}
        onClose={() => setPrintToast(null)}
        autoHideDuration={printToast?.status === 'printing' ? null : 2500}
      />
      {updateInfo && (
        <UpdateModal
          updateInfo={updateInfo}
          downloadProgress={updateDownloadProgress}
          onDownload={async () => {
            if (window.electronAPI) {
              await window.electronAPI.downloadUpdate();
            }
          }}
          onInstall={() => {
            if (window.electronAPI) {
              window.electronAPI.installUpdate();
            }
          }}
          onClose={() => {
            setUpdateInfo(null);
            setUpdateDownloadProgress(null);
          }}
        />
      )}

      {/* Minimize Button - Sol Alt Köşe */}
      <button
        onClick={() => {
          if (window.electronAPI && window.electronAPI.minimizeWindow) {
            window.electronAPI.minimizeWindow();
          }
        }}
        className="fixed bottom-4 left-4 z-50 w-10 h-10 rounded-full bg-white/80 hover:bg-white border-2 border-pink-300 theme-sultan:border-emerald-300 hover:border-pink-500 theme-sultan:hover:border-pink-50 theme-sultan:hover:border-pink-500 theme-sultan:border-emerald-500 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
        title="Uygulamayı Arka Plana Al (Alt+Tab)"
      >
        <svg 
          className="w-5 h-5 text-pink-600 theme-sultan:text-emerald-600 group-hover:text-pink-700 theme-sultan:group-hover:text-pink-700 theme-sultan:hover:text-pink-700 theme-sultan:text-emerald-700 transition-colors" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2.5} 
            d="M19 9l-7 7-7-7" 
            transform="rotate(90 12 12)"
          />
        </svg>
      </button>

      {/* Broadcast Message Modal */}
      {broadcastMessage && (
        <div 
          className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-[100] animate-fade-in p-4" 
          onClick={() => setBroadcastMessage(null)}
          style={{ animation: 'fadeIn 0.3s ease' }}
        >
          <div 
            className="bg-gradient-to-br from-white to-slate-50 rounded-[32px] max-w-md w-full shadow-2xl overflow-hidden relative border border-white/20" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              animation: 'slideUpScale 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
              boxShadow: '0 30px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1) inset'
            }}
          >
            {/* Dekoratif arka plan efektleri */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-pink-200 theme-sultan:from-emerald-200/20 to-indigo-200 theme-sultan:to-teal-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-fuchsia-200 theme-sultan:from-green-200/20 to-pink-200 theme-sultan:to-emerald-200/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
            
            {/* Header */}
            <div className="relative bg-gradient-to-r from-pink-700 theme-sultan:from-emerald-700 via-fuchsia-600 theme-sultan:via-green-600 to-indigo-600 theme-sultan:to-teal-600 text-white p-7 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
              <div className="relative z-10 flex items-center gap-4">
                <div className="w-14 h-14 bg-white/25 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg border border-white/30">
                  <span className="text-3xl">📢</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-black text-white mb-1 tracking-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                    Yeni Mesaj
                  </h3>
                  <p className="text-sm font-medium text-white/95">Yönetimden bildirim</p>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="relative z-10 p-7">
              <div className="mb-5">
                <p className="text-base font-medium text-gray-800 leading-relaxed whitespace-pre-wrap tracking-wide">
                  {broadcastMessage.message}
                </p>
              </div>
              <div className="bg-gradient-to-r from-slate-100 to-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-center gap-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-semibold text-slate-600">
                  {broadcastMessage.date} {broadcastMessage.time}
                </p>
              </div>
            </div>
            
            {/* Footer */}
            <div className="relative z-10 border-t border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6 flex justify-center">
              <button
                onClick={() => setBroadcastMessage(null)}
                className="px-12 py-4 bg-gradient-to-r from-pink-700 theme-sultan:from-emerald-700 via-fuchsia-600 theme-sultan:via-green-600 to-indigo-600 theme-sultan:to-teal-600 hover:from-pink-800 theme-sultan:hover:from-emerald-800 hover:via-fuchsia-700 theme-sultan:hover:via-green-700 hover:to-indigo-700 theme-sultan:hover:to-teal-700 text-white font-bold rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 relative overflow-hidden group"
                style={{
                  boxShadow: '0 8px 20px rgba(102, 126, 234, 0.4)',
                  letterSpacing: '0.3px'
                }}
              >
                <span className="relative z-10">Anladım</span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
            </div>
          </div>
          
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUpScale {
              from { transform: translateY(40px) scale(0.9); opacity: 0; }
              to { transform: translateY(0) scale(1); opacity: 1; }
            }
          `}</style>
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

      {showSuriciNameModal && (
        <div className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-pink-100 theme-sultan:border-emerald-100 shadow-2xl p-7">
            <div className="mb-5">
              <h3 className="text-2xl font-extrabold text-slate-900">İsim Soyisim</h3>
              <p className="text-sm text-slate-500 mt-1">
                Masaya kaydetmeden önce müşteri adını girin.
              </p>
            </div>
            <input
              type="text"
              value={suriciGuestName}
              onChange={(e) => setSuriciGuestName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = suriciGuestName.trim();
                  if (!val) return;
                  setShowSuriciNameModal(false);
                  suriciNameResolverRef.current?.(val);
                  suriciNameResolverRef.current = null;
                }
              }}
              placeholder="Örn: Ahmet Yılmaz"
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-pink-500 theme-sultan:focus:ring-emerald-500"
              autoFocus
            />
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowSuriciNameModal(false);
                  suriciNameResolverRef.current?.('');
                  suriciNameResolverRef.current = null;
                }}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={() => {
                  const val = suriciGuestName.trim();
                  if (!val) return;
                  setShowSuriciNameModal(false);
                  suriciNameResolverRef.current?.(val);
                  suriciNameResolverRef.current = null;
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white font-bold hover:from-pink-700 hover:to-fuchsia-700 theme-sultan:from-emerald-600 theme-sultan:to-green-600 theme-sultan:hover:from-emerald-700 theme-sultan:hover:to-green-700"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
    </>
  );
}

export default App;

