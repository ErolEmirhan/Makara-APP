import { useCallback, useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedProfileDataUrl } from '../../services/staffProfileImage';

export function ProfileImageCropModal({ open, imageSrc, onConfirm, onCancel, accent = 'from-violet-500 to-fuchsia-500' }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && imageSrc) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setSaving(false);
    }
  }, [open, imageSrc]);

  const onCropComplete = useCallback((_croppedArea, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels || saving) return;
    setSaving(true);
    try {
      const dataUrl = await getCroppedProfileDataUrl(imageSrc, croppedAreaPixels);
      await onConfirm(dataUrl);
    } finally {
      setSaving(false);
    }
  };

  if (!open || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-[9500] flex flex-col bg-slate-950 safe-top safe-bottom" data-allow-pinch-zoom>
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-white/70 font-semibold text-sm px-2 py-1 disabled:opacity-50"
        >
          İptal
        </button>
        <h3 className="text-white font-display font-bold text-base">Fotoğrafı Kırp</h3>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={saving || !croppedAreaPixels}
          className={`text-sm font-bold px-3 py-1.5 rounded-xl bg-gradient-to-r ${accent} text-white disabled:opacity-50`}
        >
          {saving ? '...' : 'Kaydet'}
        </button>
      </div>

      <div className="relative flex-1 min-h-[240px] bg-black">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="rect"
          showGrid
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>

      <div className="shrink-0 px-5 py-5 bg-slate-900 border-t border-white/10 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Yakınlaştır</span>
            <span className="text-white/40 text-xs">{Math.round(zoom * 100)}%</span>
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none bg-white/20 accent-pink-500"
          />
        </div>
        <p className="text-center text-white/45 text-xs leading-relaxed">
          Kare alanı sürükleyerek konumlandırın, kaydırıcı ile yakınlaştırın
        </p>
      </div>
    </div>
  );
}
