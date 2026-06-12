import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, AlertTriangle, Coins, ArrowUpRight, Wallet, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface BudgetItem {
  id: string;
  name: string;
  limit: number;
  spent: number;
  icon: string;
  color: string;
}

const colorPresets = [
  { id: 'teal', label: 'Teal', hex: '#0d9488' },
  { id: 'emerald', label: 'Emerald', hex: '#10b981' },
  { id: 'green', label: 'Forest Green', hex: '#15803d' },
  { id: 'blue', label: 'Blue', hex: '#3b82f6' },
  { id: 'sky', label: 'Sky Blue', hex: '#0ea5e9' },
  { id: 'indigo', label: 'Indigo', hex: '#6366f1' },
  { id: 'purple', label: 'Purple', hex: '#a855f7' },
  { id: 'fuchsia', label: 'Fuchsia', hex: '#d946ef' },
  { id: 'pink', label: 'Pink', hex: '#ec4899' },
  { id: 'rose', label: 'Rose Red', hex: '#f43f5e' },
  { id: 'red', label: 'Red', hex: '#ef4444' },
  { id: 'orange', label: 'Orange', hex: '#f97316' },
  { id: 'amber', label: 'Amber Yellow', hex: '#f59e0b' },
  { id: 'slate', label: 'Slate Gray', hex: '#64748b' },
];

const emojiPresets = [
  '🍔', '☕', '🍕', '🛒', // Makan, kopi, pizza, belanja bulanan
  '🚗', '✈️', '🚲', '⛽', // Transport, liburan, sepeda, bensin
  '🎬', '🎮', '🎵', '📖', // Film, game, musik, buku
  '🛍️', '👚', '💄', '💍', // Belanja, pakaian, kosmetik, perhiasan
  '💡', '📱', '🏠', '🔑', // Listrik/air, kuota/pulsa, sewa rumah, kunci
  '🏥', '🏋️', '💊', '🐱', // Rumah sakit, olahraga/gym, obat, peliharaan
  '🎁', '💖', '🍼', '🎓', // Kado, sedekah/sosial, keperluan anak, pendidikan
  '✏️', '💰', '💵', '🛡️'  // Alat tulis/kantor, investasi, kas/tabungan, asuransi/keamanan
];

// Helper to format raw inputs as standard Indonesian rupiah strings (with dots as thousands separator)
const formatRupiahInput = (value: string): string => {
  const numberString = value.replace(/[^0-9]/g, '');
  if (!numberString) return '';
  const parsed = parseInt(numberString, 10);
  return new Intl.NumberFormat('id-ID').format(parsed);
};

// Helper to convert formatted rupiah strings back to plain numbers
const parseRupiahInput = (value: string): number => {
  const cleanValue = value.replace(/[^0-9]/g, '');
  return parseFloat(cleanValue) || 0;
};


const monthsIndo = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const formatMonthIndo = (yearMonthStr: string) => {
  if (!yearMonthStr) return '';
  const [year, month] = yearMonthStr.split('-');
  const monthIndex = parseInt(month, 10) - 1;
  return `${monthsIndo[monthIndex]} ${year}`;
};

export const BudgetManager: React.FC = () => {
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formMonth, setFormMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dbWarning, setDbWarning] = useState(false);

  // Month-Year state (format YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  // Form states
  const [budgetName, setBudgetName] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('');
  const [budgetSpent, setBudgetSpent] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🍔');
  const [selectedColor, setSelectedColor] = useState('teal');

  // Fetch budgets from Supabase or LocalStorage fallback
  const fetchBudgets = async () => {
    setLoading(true);
    setDbWarning(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('month', selectedMonth)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Supabase budgets table warning:', error.message);
        if (error.code === 'PGRST496' || error.message.includes('relation "budgets" does not exist')) {
          setDbWarning(true);
          const localData = localStorage.getItem(`mock_budgets_${selectedMonth}`);
          if (localData) {
            setBudgets(JSON.parse(localData));
          } else {
            setBudgets([]);
          }
        } else {
          throw error;
        }
      } else if (data) {
        const mappedData: BudgetItem[] = data.map(item => ({
          id: item.id,
          name: item.name,
          limit: parseFloat(item.limit_amount) || 0,
          spent: parseFloat(item.spent_amount) || 0,
          icon: item.icon,
          color: item.color
        }));
        setBudgets(mappedData);
        localStorage.setItem(`mock_budgets_${selectedMonth}`, JSON.stringify(mappedData));
      }
    } catch (err: any) {
      console.error('Error fetching budgets:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load budgets whenever selectedMonth changes
  useEffect(() => {
    fetchBudgets();
  }, [selectedMonth]);

  const saveBudgets = (updatedList: BudgetItem[]) => {
    setBudgets(updatedList);
    localStorage.setItem(`mock_budgets_${selectedMonth}`, JSON.stringify(updatedList));
  };

  const getPreviousMonthKey = (monthKey: string): string => {
    const [year, month] = monthKey.split('-').map(Number);
    const date = new Date(year, month - 2, 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const handleCopyFromPreviousMonth = async () => {
    const prevKey = getPreviousMonthKey(selectedMonth);
    
    try {
      if (dbWarning) {
        const prevData = localStorage.getItem(`mock_budgets_${prevKey}`);
        if (prevData) {
          const prevList = JSON.parse(prevData) as BudgetItem[];
          const copiedList = prevList.map(b => ({
            ...b,
            id: 'budget-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            spent: 0
          }));
          saveBudgets(copiedList);
        } else {
          alert('Tidak ada anggaran dari bulan lalu yang bisa disalin.');
        }
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: prevData, error: fetchError } = await supabase
          .from('budgets')
          .select('*')
          .eq('month', prevKey);

        if (fetchError) throw fetchError;

        if (prevData && prevData.length > 0) {
          const insertData = prevData.map(item => ({
            user_id: user.id,
            name: item.name,
            limit_amount: parseFloat(item.limit_amount) || 0,
            spent_amount: 0,
            icon: item.icon,
            color: item.color,
            month: selectedMonth
          }));

          const { error: insertError } = await supabase
            .from('budgets')
            .insert(insertData);

          if (insertError) throw insertError;
          fetchBudgets();
        } else {
          alert('Tidak ada anggaran dari bulan lalu yang bisa disalin.');
        }
      }
    } catch (err: any) {
      alert('Gagal menyalin anggaran: ' + err.message);
    }
  };

  const getMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    for (let i = -6; i <= 6; i++) {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${y}-${m}`;
      options.push({ key, label: formatMonthIndo(key) });
    }
    return options;
  };

  const handleAddOrEditBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budgetName.trim() || !budgetLimit || !formMonth) return;

    setSubmitting(true);
    const limitNum = parseRupiahInput(budgetLimit);
    const spentNum = parseRupiahInput(budgetSpent);
    const colorHex = colorPresets.find(c => c.id === selectedColor)?.hex || '#0d9488';

    const budgetData = {
      name: budgetName,
      limit_amount: limitNum,
      spent_amount: spentNum,
      icon: selectedEmoji,
      color: colorHex,
      month: formMonth
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (dbWarning) {
        if (editingId) {
          if (formMonth !== selectedMonth) {
            const currentKey = `mock_budgets_${selectedMonth}`;
            const localCurrent = localStorage.getItem(currentKey);
            const currentList = localCurrent ? JSON.parse(localCurrent) as BudgetItem[] : [];
            const updatedCurrentList = currentList.filter(b => b.id !== editingId);
            localStorage.setItem(currentKey, JSON.stringify(updatedCurrentList));

            const targetKey = `mock_budgets_${formMonth}`;
            const localTarget = localStorage.getItem(targetKey);
            const targetList = localTarget ? JSON.parse(localTarget) as BudgetItem[] : [];
            const movedItem: BudgetItem = {
              id: editingId,
              ...budgetData,
              limit: limitNum,
              spent: spentNum
            };
            localStorage.setItem(targetKey, JSON.stringify([...targetList, movedItem]));

            setSelectedMonth(formMonth);
          } else {
            const updatedList = budgets.map((b) => {
              if (b.id === editingId) {
                return {
                  id: b.id,
                  name: budgetName,
                  limit: limitNum,
                  spent: spentNum,
                  icon: selectedEmoji,
                  color: colorHex
                };
              }
              return b;
            });
            setBudgets(updatedList);
            localStorage.setItem(`mock_budgets_${selectedMonth}`, JSON.stringify(updatedList));
          }
        } else {
          const newBudget: BudgetItem = {
            id: 'budget-' + Date.now(),
            name: budgetName,
            limit: limitNum,
            spent: spentNum,
            icon: selectedEmoji,
            color: colorHex
          };

          if (formMonth !== selectedMonth) {
            const targetKey = `mock_budgets_${formMonth}`;
            const localTarget = localStorage.getItem(targetKey);
            const targetList = localTarget ? JSON.parse(localTarget) as BudgetItem[] : [];
            localStorage.setItem(targetKey, JSON.stringify([...targetList, newBudget]));
            setSelectedMonth(formMonth);
          } else {
            const updatedList = [...budgets, newBudget];
            setBudgets(updatedList);
            localStorage.setItem(`mock_budgets_${selectedMonth}`, JSON.stringify(updatedList));
          }
        }
        resetForm();
      } else {
        if (editingId) {
          const { error } = await supabase
            .from('budgets')
            .update(budgetData)
            .eq('id', editingId);

          if (error) throw error;

          if (formMonth !== selectedMonth) {
            setSelectedMonth(formMonth);
          } else {
            fetchBudgets();
          }
        } else {
          const { error } = await supabase
            .from('budgets')
            .insert({
              user_id: user.id,
              ...budgetData
            });

          if (error) throw error;

          if (formMonth !== selectedMonth) {
            setSelectedMonth(formMonth);
          } else {
            fetchBudgets();
          }
        }
        resetForm();
      }
    } catch (err: any) {
      alert('Gagal menyimpan anggaran: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (budget: BudgetItem) => {
    setEditingId(budget.id);
    setBudgetName(budget.name);
    setBudgetLimit(formatRupiahInput(budget.limit.toString()));
    setBudgetSpent(budget.spent > 0 ? formatRupiahInput(budget.spent.toString()) : '');
    setSelectedEmoji(budget.icon);
    setFormMonth(selectedMonth);
    
    const matchedPreset = colorPresets.find(c => c.hex === budget.color);
    setSelectedColor(matchedPreset ? matchedPreset.id : 'teal');
    setShowAddForm(true);
  };

  const handleDeleteBudget = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus anggaran ini?')) return;

    try {
      if (dbWarning || id.toString().startsWith('budget-')) {
        const updatedList = budgets.filter((b) => b.id !== id);
        saveBudgets(updatedList);
      } else {
        const { error } = await supabase
          .from('budgets')
          .delete()
          .eq('id', id);

        if (error) throw error;
        setBudgets(budgets.filter((b) => b.id !== id));
      }
    } catch (err: any) {
      alert('Gagal menghapus anggaran: ' + err.message);
    }
  };

  const resetForm = () => {
    setBudgetName('');
    setBudgetLimit('');
    setBudgetSpent('');
    setSelectedEmoji('🍔');
    setSelectedColor('teal');
    setFormMonth('');
    setEditingId(null);
    setShowAddForm(false);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val);
  };

  // Calculations
  const totalLimit = budgets.reduce((sum, b) => sum + b.limit, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
  const totalRemaining = totalLimit - totalSpent;
  const totalPercentage = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;

  // Determine progress color helper
  const getProgressColor = (spent: number, limit: number, preferredColor: string) => {
    const pct = (spent / limit) * 100;
    if (pct >= 90) return 'var(--accent-danger)'; // Red
    if (pct >= 70) return 'var(--accent-warning)'; // Yellow
    return preferredColor; // Selected accent color
  };

  return (
    <div className="budget-manager-view">
      {dbWarning && (
        <div className="mockup-header-tag glass-card" style={{ borderColor: 'var(--accent-warning)', background: 'rgba(245, 158, 11, 0.04)' }}>
          <AlertTriangle className="info-icon" style={{ color: 'var(--accent-warning)' }} />
          <p style={{ color: '#78350f' }}>
            <strong>Status Mockup Aktif (Pemberitahuan Database):</strong> Tabel <code>budgets</code> belum dibuat di database Supabase Anda. 
            Data saat ini disimpan di penyimpanan lokal browser agar tetap bisa diuji coba. Silakan jalankan SQL schema untuk sinkronisasi cloud penuh.
          </p>
        </div>
      )}

      {/* Summary Stats cards */}
      <div className="budget-summary-grid">
        <div className="glass-card summary-card budget-total">
          <div className="summary-card-content">
            <span className="summary-label">Total Anggaran Bulanan</span>
            <h4>{formatCurrency(totalLimit)}</h4>
          </div>
          <div className="summary-icon-wrapper">
            <Coins size={22} />
          </div>
        </div>
        
        <div className={`glass-card summary-card budget-spent ${totalPercentage >= 90 ? 'exceeded' : ''}`}>
          <div className="summary-card-content">
            <span className="summary-label">Total Pengeluaran</span>
            <h4>
              {formatCurrency(totalSpent)} <span className="pct-badge">{totalPercentage}%</span>
            </h4>
          </div>
          <div className="summary-icon-wrapper">
            <ArrowUpRight size={22} />
          </div>
        </div>

        <div className={`glass-card summary-card budget-remaining ${totalRemaining < 0 ? 'negative' : ''}`}>
          <div className="summary-card-content">
            <span className="summary-label">Sisa Dana Tersisa</span>
            <h4>{formatCurrency(totalRemaining)}</h4>
          </div>
          <div className="summary-icon-wrapper">
            <Wallet size={22} />
          </div>
        </div>
      </div>

      {/* Main Budget Grid Header */}
      <div className="budget-list-header">
        <div className="budget-header-title-area">
          <h3>Daftar Anggaran</h3>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="month-select-dropdown"
          >
            {getMonthOptions().map(opt => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>
        {!showAddForm && (
          <button 
            onClick={() => {
              setFormMonth(selectedMonth);
              setShowAddForm(true);
            }} 
            className="btn btn-primary"
          >
            <Plus size={18} />
            <span>Buat Anggaran Baru</span>
          </button>
        )}
      </div>

      {/* Add / Edit Budget Form */}
      {showAddForm && (
        <div className="budget-form-container glass-card animate-slide-down">
          <div className="form-header">
            <h4>{editingId ? 'Edit Anggaran' : 'Tambah Anggaran Baru'}</h4>
            <button onClick={resetForm} className="btn-close-form">Batal</button>
          </div>

          <form onSubmit={handleAddOrEditBudget} className="budget-form-grid">
            <div className="form-group">
              <label className="form-label">Nama Anggaran</label>
              <input
                type="text"
                className="form-input"
                placeholder="Contoh: Kebutuhan Makan, Jajan Kopi"
                value={budgetName}
                onChange={(e) => setBudgetName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Digunakan untuk Bulan</label>
              <select
                value={formMonth}
                onChange={(e) => setFormMonth(e.target.value)}
                className="form-input select-input"
                required
              >
                {getMonthOptions().map(opt => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Jatah Bulanan (Limit)</label>
              <div className="currency-input-wrapper">
                <span className="currency-prefix">Rp</span>
                <input
                  type="text"
                  className="form-input with-prefix"
                  placeholder="0"
                  value={budgetLimit}
                  onChange={(e) => setBudgetLimit(formatRupiahInput(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Dana Terpakai (Opsional)</label>
              <div className="currency-input-wrapper">
                <span className="currency-prefix">Rp</span>
                <input
                  type="text"
                  className="form-input with-prefix"
                  placeholder="0"
                  value={budgetSpent}
                  onChange={(e) => setBudgetSpent(formatRupiahInput(e.target.value))}
                />
              </div>
            </div>

            {/* Color accent selector */}
            <div className="form-group">
              <label className="form-label">Warna Progress Bar</label>
              <div className="color-picker-row">
                {colorPresets.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`color-preset-dot ${selectedColor === c.id ? 'selected' : ''}`}
                    style={{ background: c.hex }}
                    onClick={() => setSelectedColor(c.id)}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            {/* Emoji category selector */}
            <div className="form-group span-full">
              <label className="form-label">Pilih Ikon / Emoji Kategori</label>
              <div className="emoji-picker-grid">
                {emojiPresets.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`emoji-preset-btn ${selectedEmoji === emoji ? 'selected' : ''}`}
                    onClick={() => setSelectedEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-actions span-full">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? <Loader2 className="spinner" size={16} /> : <span>{editingId ? 'Update Anggaran' : 'Simpan Anggaran'}</span>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List display of budgets */}
      {loading ? (
        <div className="loading-state">
          <Loader2 className="spinner text-primary" size={32} />
          <p>Memuat daftar anggaran...</p>
        </div>
      ) : budgets.length === 0 ? (
        <div className="budget-empty-state glass-card">
          <div className="icon-circle">💰</div>
          <h3>Belum Ada Anggaran</h3>
          <p>Anda belum mengonfigurasi anggaran belanja bulanan untuk bulan {formatMonthIndo(selectedMonth)}.</p>
          <div className="empty-state-actions">
            <button 
              onClick={() => {
                setFormMonth(selectedMonth);
                setShowAddForm(true);
              }} 
              className="btn btn-primary"
            >
              <Plus size={16} />
              <span>Buat Anggaran Baru</span>
            </button>
            {localStorage.getItem(`mock_budgets_${getPreviousMonthKey(selectedMonth)}`) && (
              <button onClick={handleCopyFromPreviousMonth} className="btn btn-secondary">
                <span>Salin Anggaran Bulan Lalu</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="budgets-list-grid">
          {budgets.map((budget) => {
            const spentPercentage = budget.limit > 0 ? Math.round((budget.spent / budget.limit) * 100) : 0;
            const remaining = budget.limit - budget.spent;
            const progressBarColor = getProgressColor(budget.spent, budget.limit, budget.color);

            return (
              <div key={budget.id} className="budget-item-card glass-card">
                <div className="card-top-section">
                  <div className="budget-title-info">
                    <span 
                      className="budget-icon-badge"
                      style={{ 
                        backgroundColor: `${budget.color}15`, 
                        borderColor: `${budget.color}35` 
                      }}
                    >
                      {budget.icon}
                    </span>
                    <div>
                      <h5>{budget.name}</h5>
                      <span className="sub-limit-label">Batas: {formatCurrency(budget.limit)} / bln</span>
                    </div>
                  </div>
                  
                  <div className="action-buttons-group">
                    <button 
                      onClick={() => handleStartEdit(budget)}
                      className="btn-icon-action"
                      title="Edit Anggaran"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => handleDeleteBudget(budget.id)}
                      className="btn-icon-action btn-delete-action"
                      title="Hapus Anggaran"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="card-progress-section">
                  <div className="progress-metrics">
                    <span className="spent-label">Terpakai: {formatCurrency(budget.spent)}</span>
                    <span 
                      className="pct-label"
                      style={{ color: progressBarColor, fontWeight: 700 }}
                    >
                      {spentPercentage}%
                    </span>
                  </div>

                  <div className="progress-bar-container">
                    <div 
                      className="progress-bar-fill" 
                      style={{ 
                        width: `${Math.min(spentPercentage, 100)}%`, 
                        background: progressBarColor,
                        boxShadow: `0 0 8px ${progressBarColor}40`
                      }}
                    />
                  </div>

                  <div className="remaining-indicator">
                    {remaining < 0 ? (
                      <span className="warning-text-danger">
                        Melebihi anggaran sebesar {formatCurrency(Math.abs(remaining))}
                      </span>
                    ) : (
                      <span className="remaining-label">
                        Sisa kuota: {formatCurrency(remaining)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
