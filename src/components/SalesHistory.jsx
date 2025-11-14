import React, { useState, useEffect } from 'react';

const SalesHistory = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

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
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold gradient-text mb-2">Satış Detayları</h1>
          <p className="text-gray-400">Tüm satış işlemlerinizi görüntüleyin</p>
        </div>
        <button
          onClick={loadSales}
          className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-medium hover:shadow-lg hover:scale-105 transition-all"
        >
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Yenile</span>
          </div>
        </button>
      </div>

      {sales.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-32 h-32 mx-auto text-white/10 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-2xl font-bold text-gray-300 mb-2">Henüz satış yok</h3>
          <p className="text-gray-500">İlk satışınızı yapmak için Satış Yap bölümüne gidin</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sales.map((sale) => (
            <div
              key={sale.id}
              className="card-glass p-6 hover:shadow-2xl transition-all duration-300 animate-fade-in"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <span className="px-4 py-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full text-sm font-medium">
                      Satış #{sale.id}
                    </span>
                    <div className={`px-4 py-1 bg-gradient-to-r ${getPaymentMethodColor(sale.payment_method)} rounded-full text-sm font-medium flex items-center space-x-1`}>
                      {getPaymentMethodIcon(sale.payment_method)}
                      <span>{sale.payment_method}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6 text-sm text-gray-400 mb-3">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{sale.sale_date}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{sale.sale_time}</span>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-sm text-gray-400 mb-1">Ürünler:</p>
                    <p className="text-white">{sale.items}</p>
                  </div>
                </div>

                <div className="text-right ml-6">
                  <p className="text-sm text-gray-400 mb-1">Toplam Tutar</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    ₺{parseFloat(sale.total_amount).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {sales.length > 0 && (
        <div className="mt-8 p-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-xl rounded-2xl border border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-gray-400 mb-2">Toplam Satış</p>
              <p className="text-3xl font-bold text-white">{sales.length}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 mb-2">Toplam Gelir</p>
              <p className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                ₺{sales.reduce((sum, sale) => sum + parseFloat(sale.total_amount), 0).toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 mb-2">Ortalama Satış</p>
              <p className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                ₺{(sales.reduce((sum, sale) => sum + parseFloat(sale.total_amount), 0) / sales.length).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHistory;

