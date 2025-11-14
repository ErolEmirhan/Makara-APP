import React from 'react';

const Navbar = ({ currentView, setCurrentView, totalItems }) => {
  return (
    <nav className="h-20 bg-gradient-to-r from-purple-900/30 to-pink-900/30 backdrop-blur-xl border-b border-white/10 px-8 flex items-center justify-between shadow-2xl">
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
          <span className="text-2xl font-bold">M</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold gradient-text">MAKARA</h1>
          <p className="text-xs text-gray-400">POS Sistemi</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button
          onClick={() => setCurrentView('pos')}
          className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
            currentView === 'pos'
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg transform scale-105'
              : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>Satış Yap</span>
            {totalItems > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {totalItems}
              </span>
            )}
          </div>
        </button>

        <button
          onClick={() => setCurrentView('sales')}
          className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
            currentView === 'sales'
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg transform scale-105'
              : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Satış Detayları</span>
          </div>
        </button>

        <div className="flex items-center space-x-3 ml-4 pl-4 border-l border-white/10">
          <div className="text-right">
            <p className="text-xs text-gray-400">Kullanıcı</p>
            <p className="text-sm font-medium">Admin</p>
          </div>
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

