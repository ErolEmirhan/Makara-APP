import React, { useState, useEffect, useCallback } from 'react';
import { buildSultanTablesFlat } from '../constants/sultanTables';

const OUTSIDE_NUMS = [61,62,63,64,65,66,67,68,71,72,73,74,75,76,77,78,81,82,83,84,85,86,87,88];

const ReservationsModal = ({ branchKey, onClose }) => {
  const isSultanBranch = branchKey === 'sultansomati';

  // Liste | form view
  const [view, setView] = useState('list'); // 'list' | 'form'
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [printing, setPrinting] = useState(null);

  // Düzenleme
  const [editingId, setEditingId] = useState(null);

  // Form alanları
  const [form, setForm] = useState({
    guestName: '', tableId: '', date: '', time: '',
    peopleCount: '', adults: '', children: '', babies: '', note: ''
  });
  const [formError, setFormError] = useState('');

  // Toast
  const [toast, setToast] = useState({ msg: '', type: 'info', show: false });
  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type, show: true });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3000);
  }, []);

  // API base URL
  const [apiBase, setApiBase] = useState('http://localhost:3000');
  useEffect(() => {
    window.electronAPI?.getServerURL?.().then(url => {
      if (url) setApiBase(url.replace(/\/$/, ''));
    }).catch(() => {});
  }, []);

  // Tablo listesi
  const allTables = (() => {
    if (isSultanBranch) {
      return buildSultanTablesFlat().map(t => ({ id: t.id, name: t.name }));
    }
    const inside = Array.from({ length: 20 }, (_, i) => ({
      id: `inside-${i + 1}`, name: `Masa ${i + 1}`
    }));
    const outside = OUTSIDE_NUMS.map(n => ({ id: `outside-${n}`, name: `Masa ${n}` }));
    return [...inside, ...outside];
  })();

  // Rezervasyonları yükle
  const loadReservations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/reservations`);
      const data = await res.json();
      const sorted = (Array.isArray(data) ? data : []).sort((a, b) => {
        if (a.date < b.date) return -1; if (a.date > b.date) return 1;
        return (a.time || '').localeCompare(b.time || '');
      });
      setReservations(sorted);
    } catch {
      showToast('Rezervasyonlar yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiBase, showToast]);

  useEffect(() => { loadReservations(); }, [loadReservations]);

  // Bugün
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  function openCreateForm() {
    setEditingId(null);
    setForm({ guestName: '', tableId: allTables[0]?.id || '', date: todayStr, time: '', peopleCount: '', adults: '', children: '', babies: '', note: '' });
    setFormError('');
    setView('form');
  }

  function openEditForm(r) {
    setEditingId(r.id);
    setForm({
      guestName: r.guestName || '',
      tableId: r.tableId || allTables[0]?.id || '',
      date: r.date || todayStr,
      time: r.time || '',
      peopleCount: r.peopleCount ? String(r.peopleCount) : '',
      adults: r.adults ? String(r.adults) : '',
      children: r.children ? String(r.children) : '',
      babies: r.babies ? String(r.babies) : '',
      note: r.note || '',
    });
    setFormError('');
    setView('form');
  }

  async function saveReservation() {
    if (!form.guestName.trim()) { setFormError('Ad Soyad zorunludur.'); return; }
    if (!form.tableId) { setFormError('Masa seçilmelidir.'); return; }
    if (!form.date) { setFormError('Tarih zorunludur.'); return; }
    if (!form.time) { setFormError('Saat zorunludur.'); return; }
    setSaving(true);
    setFormError('');
    try {
      const tObj = allTables.find(t => t.id === form.tableId);
      const body = {
        tableId: form.tableId,
        tableName: tObj ? tObj.name : form.tableId,
        guestName: form.guestName.trim(),
        date: form.date,
        time: form.time,
        peopleCount: parseInt(form.peopleCount) || 0,
        adults: parseInt(form.adults) || 0,
        children: parseInt(form.children) || 0,
        babies: parseInt(form.babies) || 0,
        note: form.note.trim(),
      };
      if (editingId) body.reservationId = editingId;
      const res = await fetch(`${apiBase}/api/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(editingId ? 'Rezervasyon güncellendi' : 'Rezervasyon oluşturuldu', 'success');
        setView('list');
        loadReservations();
      } else {
        setFormError(data.error || 'Kaydedilemedi.');
      }
    } catch {
      setFormError('Bağlantı hatası.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteReservation(id) {
    setDeleting(id);
    try {
      const res = await fetch(`${apiBase}/api/reservations/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Rezervasyon silindi', 'success');
        setReservations(prev => prev.filter(r => r.id !== id));
      } else {
        showToast(data.error || 'Silinemedi', 'error');
      }
    } catch {
      showToast('Bağlantı hatası', 'error');
    } finally {
      setDeleting(null);
    }
  }

  async function printReservation(id) {
    setPrinting(id);
    try {
      const res = await fetch(`${apiBase}/api/reservations/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId: id }),
      });
      const data = await res.json();
      if (res.ok && data.success) showToast('Rezervasyon fişi yazdırıldı', 'success');
      else showToast(data.error || 'Yazdırılamadı', 'error');
    } catch {
      showToast('Bağlantı hatası', 'error');
    } finally {
      setPrinting(null);
    }
  }

  const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition bg-white';
  const labelCls = 'block text-xs font-bold text-slate-500 mb-1';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            {view === 'form' && (
              <button
                onClick={() => setView('list')}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-slate-500"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                {view === 'form' ? (editingId ? 'Rezervasyon Düzenle' : 'Yeni Rezervasyon') : 'Rezervasyonlar'}
              </h2>
              {view === 'list' && (
                <p className="text-xs text-slate-400 font-medium">{reservations.length} rezervasyon</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view === 'list' && (
              <button
                onClick={openCreateForm}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Yeni
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 transition text-slate-400 hover:text-slate-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── LİSTE GÖRÜNÜMÜ ── */}
          {view === 'list' && (
            <div className="p-5">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                  <svg className="w-6 h-6 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  <span className="font-medium">Yükleniyor...</span>
                </div>
              ) : reservations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <svg className="w-14 h-14 mb-4 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="font-semibold text-lg">Rezervasyon bulunamadı</p>
                  <p className="text-sm mt-1">Yeni butonuna tıklayarak oluşturun.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {reservations.map(r => (
                    <div key={r.id} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden hover:border-amber-200 transition-colors">
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <div className="font-black text-slate-900 text-base">{r.guestName || '—'}</div>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full">
                                {r.tableName || r.tableId}
                              </span>
                              <span className="text-xs font-semibold bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full">
                                {r.date} {r.time}
                              </span>
                              {(r.peopleCount > 0) && (
                                <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full">
                                  {r.peopleCount} kişi
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Detay satırı */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                          {r.adults > 0 && <span>Yetişkin: <b className="text-slate-700">{r.adults}</b></span>}
                          {r.children > 0 && <span>Çocuk: <b className="text-slate-700">{r.children}</b></span>}
                          {r.babies > 0 && <span>Bebek: <b className="text-slate-700">{r.babies}</b></span>}
                          {r.staffName && <span>Oluşturan: <b className="text-slate-700">{r.staffName}</b></span>}
                        </div>
                        {r.note && (
                          <div className="mt-2 text-xs text-slate-500 italic bg-white border border-slate-100 rounded-lg px-3 py-1.5 line-clamp-2">
                            {r.note}
                          </div>
                        )}
                      </div>
                      {/* Aksiyon butonları */}
                      <div className="flex border-t border-slate-200">
                        <button
                          onClick={() => openEditForm(r)}
                          className="flex-1 py-2.5 text-xs font-bold text-blue-600 hover:bg-blue-50 transition flex items-center justify-center gap-1 border-r border-slate-200"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Düzenle
                        </button>
                        <button
                          onClick={() => printReservation(r.id)}
                          disabled={printing === r.id}
                          className="flex-1 py-2.5 text-xs font-bold text-amber-600 hover:bg-amber-50 transition flex items-center justify-center gap-1 border-r border-slate-200 disabled:opacity-50"
                        >
                          {printing === r.id ? (
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                          )}
                          Yazdır
                        </button>
                        <button
                          onClick={() => deleteReservation(r.id)}
                          disabled={deleting === r.id}
                          className="flex-1 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 transition flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          {deleting === r.id ? (
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                          Kaldır
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── FORM GÖRÜNÜMÜ ── */}
          {view === 'form' && (
            <div className="p-5">
              {/* Ad Soyad */}
              <div className="mb-4">
                <label className={labelCls}>Ad Soyad *</label>
                <input
                  type="text"
                  value={form.guestName}
                  onChange={e => setForm(f => ({ ...f, guestName: e.target.value }))}
                  placeholder="Müşteri adı soyadı..."
                  className={inputCls}
                  autoFocus
                />
              </div>

              {/* Masa */}
              <div className="mb-4">
                <label className={labelCls}>Masa *</label>
                <select
                  value={form.tableId}
                  onChange={e => setForm(f => ({ ...f, tableId: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">Masa seçin...</option>
                  {allTables.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Tarih & Saat */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className={labelCls}>Tarih *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Saat *</label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Kişi sayıları */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className={labelCls}>Kişi Sayısı</label>
                  <input
                    type="number" min="0"
                    value={form.peopleCount}
                    onChange={e => setForm(f => ({ ...f, peopleCount: e.target.value }))}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Yetişkin</label>
                  <input
                    type="number" min="0"
                    value={form.adults}
                    onChange={e => setForm(f => ({ ...f, adults: e.target.value }))}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className={labelCls}>Çocuk</label>
                  <input
                    type="number" min="0"
                    value={form.children}
                    onChange={e => setForm(f => ({ ...f, children: e.target.value }))}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Bebek</label>
                  <input
                    type="number" min="0"
                    value={form.babies}
                    onChange={e => setForm(f => ({ ...f, babies: e.target.value }))}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Özel Not */}
              <div className="mb-4">
                <label className={labelCls}>Özel Not</label>
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Özel istek veya not..."
                  className={`${inputCls} resize-none`}
                />
              </div>

              {formError && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">
                  {formError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {view === 'form' && (
          <div className="flex gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
            <button
              onClick={() => setView('list')}
              className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition"
            >
              İptal
            </button>
            <button
              onClick={saveReservation}
              disabled={saving}
              className="flex-2 flex-grow-[2] py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-sm rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Kaydediliyor...
                </>
              ) : editingId ? 'Kaydet' : 'Oluştur'}
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 z-[1200] px-5 py-3 rounded-xl shadow-lg text-white text-sm font-bold transition-all ${
          toast.type === 'error' ? 'bg-red-500' : toast.type === 'success' ? 'bg-emerald-500' : 'bg-slate-700'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default ReservationsModal;
