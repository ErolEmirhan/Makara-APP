import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const UpdateModal = ({ updateInfo, onDownload, onInstall, onClose, downloadProgress }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    if (downloadProgress) {
      setIsDownloading(true);
    }
  }, [downloadProgress]);

  useEffect(() => {
    if (updateInfo?.downloaded) {
      setIsDownloading(false);
    }
  }, [updateInfo?.downloaded]);

  const handleInstall = () => {
    setIsInstalling(true);
    onInstall();
  };

  if (!updateInfo) return null;

  // Güncelleme indirilirken veya yüklenirken kapatılamaz
  const canClose = !isDownloading && !updateInfo.downloaded && !isInstalling;

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-[9999] animate-fade-in px-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl transform animate-scale-in relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500"></div>
      
        {canClose && (
          <button
            onClick={onClose}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all hover:rotate-90"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold gradient-text mb-2">Yeni Güncelleme Mevcut!</h2>
          <p className="text-gray-600">
            Versiyon <span className="font-bold text-purple-600">{updateInfo.version}</span> indirilmeye hazır
          </p>
        </div>

        {downloadProgress && isDownloading && downloadProgress.percent < 100 ? (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>İndiriliyor...</span>
                <span>{Math.round(downloadProgress.percent)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress.percent}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {Math.round(downloadProgress.transferred / 1024 / 1024)} MB / {Math.round(downloadProgress.total / 1024 / 1024)} MB
              </p>
            </div>
          </div>
        ) : (downloadProgress?.percent === 100 || updateInfo.downloaded) ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border-2 border-green-400 rounded-xl">
              <div className="flex items-center justify-center mb-2">
                <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-green-700 font-bold text-center text-lg mb-1">
                ✅ Güncelleme İndirildi!
              </p>
              <p className="text-green-600 text-sm text-center">
                Uygulamayı güncellemek için "Yeniden Başlat" butonuna tıklayın
              </p>
            </div>
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isInstalling ? 'Yükleniyor...' : 'Yeniden Başlat ve Güncelle'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-blue-700 text-sm text-center">
                Bu güncelleme yeni özellikler ve düzeltmeler içeriyor. İndirmek için "İndir" butonuna tıklayın.
              </p>
            </div>
            <button
              onClick={onDownload}
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all"
            >
              İndir
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default UpdateModal;

