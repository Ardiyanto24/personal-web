import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Check, AlertTriangle, ArrowUpRight, ArrowDownRight, Coins, Calendar, User, CreditCard, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface DebtItem {
  id: string;
  type: 'debt' | 'receivable'; // 'debt' = Hutang (Saya Berhutang), 'receivable' = Piutang (Saya Meminjamkan)
  person: string;
  description: string;
  amount: number;
  due_date?: string; // YYYY-MM-DD
  status: 'pending' | 'paid';
  wallet_id?: string;
  wallet_name?: string;
  created_at?: string;
}

interface WalletItem {
  id: string;
  name: string;
  bank_name: string;
  balance: number;
  color: string;
}

// Helpers for currency formatting
const formatRupiahInput = (value: string): string => {
  const numberString = value.replace(/[^0-9]/g, '');
  if (!numberString) return '';
  const parsed = parseInt(numberString, 10);
  return new Intl.NumberFormat('id-ID').format(parsed);
};

const parseRupiahInput = (value: string): number => {
  const cleanValue = value.replace(/[^0-9]/g, '');
  return parseFloat(cleanValue) || 0;
};

export const DebtManager: React.FC = () => {
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dbWarning, setDbWarning] = useState(false);
  
  // UI filter tab & Add form toggle
  const [activeTab, setActiveTab] = useState<'pending' | 'paid'>('pending');
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states
  const [type, setType] = useState<'debt' | 'receivable'>('debt');
  const [person, setPerson] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [walletId, setWalletId] = useState('');

  useEffect(() => {
    loadDataContexts();
  }, []);

  const loadDataContexts = async () => {
    setLoading(true);
    setDbWarning(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        loadLocalDataContexts();
        setLoading(false);
        return;
      }

      // 1. Fetch Wallets
      const { data: walletsData, error: walletsError } = await supabase
        .from('wallets')
        .select('*')
        .order('created_at', { ascending: true });

      // 2. Fetch Debts & Receivables
      const { data: debtsData, error: debtsError } = await supabase
        .from('debts')
        .select('*')
        .order('created_at', { ascending: false });

      if (walletsError || debtsError) {
        const err = walletsError || debtsError;
        console.warn('Supabase fetch warning, fallback to LocalStorage:', err?.message);
        if (err?.code === 'PGRST496' || err?.message.includes('relation "debts" does not exist') || err?.message.includes('relation "wallets" does not exist')) {
          setDbWarning(true);
          loadLocalDataContexts();
        } else {
          throw err;
        }
      } else {
        if (walletsData) {
          setWallets(walletsData);
          localStorage.setItem('mock_wallets', JSON.stringify(walletsData));
        }
        if (debtsData) {
          setDebts(debtsData);
          localStorage.setItem('mock_debts', JSON.stringify(debtsData));
        }
      }
    } catch (err: any) {
      console.error('Error fetching debts data:', err.message);
      setDbWarning(true);
      loadLocalDataContexts();
    } finally {
      setLoading(false);
    }
  };

  const loadLocalDataContexts = () => {
    // 1. Load Wallets
    const localWallets = localStorage.getItem('mock_wallets');
    if (localWallets) {
      setWallets(JSON.parse(localWallets));
    } else {
      setWallets([]);
    }

    // 2. Load Debts
    const localDebts = localStorage.getItem('mock_debts');
    if (localDebts) {
      setDebts(JSON.parse(localDebts));
    } else {
      setDebts([]);
    }
  };

  // Sync wallet balance (adds/subtracts based on debt type & operation)
  const syncWalletBalance = async (
    targetWalletId: string,
    amountDiff: number // positive to add balance, negative to deduct
  ) => {
    // 1. LocalStorage update
    const localWallets = localStorage.getItem('mock_wallets');
    if (localWallets) {
      const walletsList: WalletItem[] = JSON.parse(localWallets);
      const updatedWallets = walletsList.map(w => {
        if (w.id === targetWalletId) {
          return { ...w, balance: Math.max(0, w.balance + amountDiff) };
        }
        return w;
      });
      localStorage.setItem('mock_wallets', JSON.stringify(updatedWallets));
    }

    // 2. Database update
    if (!dbWarning) {
      try {
        const { data: wData, error: wError } = await supabase
          .from('wallets')
          .select('balance')
          .eq('id', targetWalletId)
          .single();

        if (!wError && wData) {
          const currentBalance = parseFloat(wData.balance) || 0;
          const newBalance = Math.max(0, currentBalance + amountDiff);
          await supabase
            .from('wallets')
            .update({ balance: newBalance })
            .eq('id', targetWalletId);
        }
      } catch (err: any) {
        console.error('Error syncing wallet balance in database:', err.message);
      }
    } else {
      const localWallets = localStorage.getItem('mock_wallets');
      if (localWallets) setWallets(JSON.parse(localWallets));
    }
  };

  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!person.trim() || !description.trim() || !amount) return;

    setSubmitting(true);
    const parsedAmount = parseRupiahInput(amount);
    
    // Find wallet info if selected
    const matchedWallet = wallets.find(w => w.id === walletId);
    const wName = matchedWallet?.name || undefined;
    const wId = matchedWallet?.id || undefined;

    const newDebtData = {
      type,
      person,
      description,
      amount: parsedAmount,
      due_date: dueDate || null,
      status: 'pending' as const,
      wallet_id: wId,
      wallet_name: wName
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSubmitting(false);
        return;
      }

      if (dbWarning) {
        // Local mockup CRUD flow
        const newLocalItem: DebtItem = {
          id: 'debt-' + Date.now(),
          ...newDebtData,
          due_date: dueDate || undefined
        };
        const updatedDebts = [newLocalItem, ...debts];
        setDebts(updatedDebts);
        localStorage.setItem('mock_debts', JSON.stringify(updatedDebts));

        // Sync wallet balance upon creation (if wallet selected):
        // - Hutang (debt) -> meminjam uang -> saldo BERTAMBAH
        // - Piutang (receivable) -> meminjamkan uang -> saldo BERKURANG
        if (wId) {
          const creationDiff = type === 'debt' ? parsedAmount : -parsedAmount;
          await syncWalletBalance(wId, creationDiff);
        }
        resetForm();
        loadLocalDataContexts();
      } else {
        // Real Supabase DB CRUD flow
        const { error } = await supabase
          .from('debts')
          .insert({
            user_id: user.id,
            ...newDebtData
          });

        if (error) throw error;

        // Sync wallet balance
        if (wId) {
          const creationDiff = type === 'debt' ? parsedAmount : -parsedAmount;
          await syncWalletBalance(wId, creationDiff);
        }
        resetForm();
        await loadDataContexts();
      }
    } catch (err: any) {
      console.error('Error saving debt:', err.message);
      alert('Gagal menyimpan transaksi: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkAsPaid = async (item: DebtItem) => {
    if (!confirm(`Tandai transaksi dengan ${item.person} sebesar ${formatCurrency(item.amount)} ini sebagai Lunas?`)) return;

    try {
      if (dbWarning) {
        const updated = debts.map(d => {
          if (d.id === item.id) {
            return { ...d, status: 'paid' as const };
          }
          return d;
        });
        setDebts(updated);
        localStorage.setItem('mock_debts', JSON.stringify(updated));

        // Sync wallet balance upon payment (if wallet associated):
        // - Hutang (debt) -> melunasi/bayar hutang -> saldo BERKURANG
        // - Piutang (receivable) -> menerima pelunasan -> saldo BERTAMBAH
        if (item.wallet_id) {
          const paymentDiff = item.type === 'debt' ? -item.amount : item.amount;
          await syncWalletBalance(item.wallet_id, paymentDiff);
        }
        loadLocalDataContexts();
      } else {
        const { error } = await supabase
          .from('debts')
          .update({ status: 'paid' })
          .eq('id', item.id);

        if (error) throw error;

        // Sync wallet balance
        if (item.wallet_id) {
          const paymentDiff = item.type === 'debt' ? -item.amount : item.amount;
          await syncWalletBalance(item.wallet_id, paymentDiff);
        }
        await loadDataContexts();
      }
    } catch (err: any) {
      console.error('Error updating status to paid:', err.message);
      alert('Gagal memperbarui status: ' + err.message);
    }
  };

  const handleDeleteDebt = async (item: DebtItem) => {
    if (!confirm('Apakah Anda yakin ingin menghapus catatan ini?')) return;

    try {
      if (dbWarning) {
        const updated = debts.filter(d => d.id !== item.id);
        setDebts(updated);
        localStorage.setItem('mock_debts', JSON.stringify(updated));

        // Sync wallet balance upon deletion (only if status was pending/unpaid):
        // - Hutang pending deleted -> reverse saldo BERTAMBAH -> saldo dikurangi (-)
        // - Piutang pending deleted -> reverse saldo BERKURANG -> saldo ditambah (+)
        if (item.status === 'pending' && item.wallet_id) {
          const reverseDiff = item.type === 'debt' ? -item.amount : item.amount;
          await syncWalletBalance(item.wallet_id, reverseDiff);
        }
        loadLocalDataContexts();
      } else {
        const { error } = await supabase
          .from('debts')
          .delete()
          .eq('id', item.id);

        if (error) throw error;

        // Sync wallet balance
        if (item.status === 'pending' && item.wallet_id) {
          const reverseDiff = item.type === 'debt' ? -item.amount : item.amount;
          await syncWalletBalance(item.wallet_id, reverseDiff);
        }
        await loadDataContexts();
      }
    } catch (err: any) {
      console.error('Error deleting debt:', err.message);
      alert('Gagal menghapus catatan: ' + err.message);
    }
  };

  const resetForm = () => {
    setPerson('');
    setDescription('');
    setAmount('');
    setDueDate('');
    setWalletId('');
    setType('debt');
    setShowAddForm(false);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val);
  };

  const formatDisplayDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const dObj = new Date(dateStr);
    const day = dObj.getDate();
    const month = monthsIndo[dObj.getMonth()];
    const year = dObj.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Metrics calculations (unpaid pending items)
  const totalHutang = debts
    .filter(d => d.type === 'debt' && d.status === 'pending')
    .reduce((sum, d) => sum + d.amount, 0);

  const totalPiutang = debts
    .filter(d => d.type === 'receivable' && d.status === 'pending')
    .reduce((sum, d) => sum + d.amount, 0);

  const netFinansial = totalPiutang - totalHutang;

  const filteredDebts = debts.filter(d => d.status === activeTab);

  if (loading) {
    return (
      <div className="loading-state">
        <Loader2 className="spinner text-primary animate-spin" size={32} />
        <p>Memuat catatan hutang...</p>
      </div>
    );
  }

  return (
    <div className="budget-manager-view">
      {/* Database Warning Alert */}
      {dbWarning && (
        <div className="db-warning-alert glass-card">
          <AlertCircle className="warning-icon" />
          <div className="warning-text">
            <h5>Pemberitahuan Database</h5>
            <p>
              Tabel <code>debts</code> belum dibuat di database Supabase Anda. 
              Data saat ini disimpan di penyimpanan lokal browser Anda agar tetap bisa diuji coba. 
              Silakan jalankan SQL schema yang tertera di walkthrough untuk sinkronisasi cloud penuh.
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="budget-summary-grid">
        {/* Total Hutang */}
        <div className="glass-card summary-card budget-spent exceeded">
          <div className="summary-card-content">
            <span className="summary-label">Total Hutang (Perlu Dibayar)</span>
            <h4>{formatCurrency(totalHutang)}</h4>
          </div>
          <div className="summary-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
            <ArrowDownRight size={22} style={{ color: 'var(--accent-danger)' }} />
          </div>
        </div>

        {/* Total Piutang */}
        <div className="glass-card summary-card budget-remaining">
          <div className="summary-card-content">
            <span className="summary-label">Total Piutang (Akan Diterima)</span>
            <h4>{formatCurrency(totalPiutang)}</h4>
          </div>
          <div className="summary-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
            <ArrowUpRight size={22} style={{ color: 'var(--accent-success)' }} />
          </div>
        </div>

        {/* Posisi Bersih */}
        <div 
          className="glass-card summary-card budget-total" 
          style={{ 
            background: netFinansial >= 0 
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
              : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            borderColor: 'rgba(255, 255, 255, 0.15)'
          }}
        >
          <div className="summary-card-content">
            <span className="summary-label" style={{ color: 'rgba(255,255,255,0.85)' }}>Posisi Net Finansial</span>
            <h4 style={{ color: '#ffffff' }}>
              {netFinansial >= 0 ? '+' : ''} {formatCurrency(netFinansial)}
            </h4>
          </div>
          <div className="summary-icon-wrapper">
            <Coins size={22} style={{ color: '#ffffff' }} />
          </div>
        </div>
      </div>

      {/* Action Header */}
      <div className="budget-list-header" style={{ marginTop: '1rem' }}>
        <div className="tab-filters-row">
          <button 
            onClick={() => setActiveTab('pending')} 
            className={`btn-tab-filter ${activeTab === 'pending' ? 'active' : ''}`}
            style={{ fontWeight: 600 }}
          >
            Belum Lunas ({debts.filter(d => d.status === 'pending').length})
          </button>
          <button 
            onClick={() => setActiveTab('paid')} 
            className={`btn-tab-filter ${activeTab === 'paid' ? 'active' : ''}`}
            style={{ fontWeight: 600 }}
          >
            Sudah Lunas ({debts.filter(d => d.status === 'paid').length})
          </button>
        </div>

        <div className="action-buttons-group">
          {!showAddForm && (
            <button 
              onClick={() => setShowAddForm(true)} 
              className="btn btn-primary"
            >
              <Plus size={18} />
              <span>Catat Hutang/Piutang</span>
            </button>
          )}
        </div>
      </div>

      {/* Add Debt Form */}
      {showAddForm && (
        <div className="budget-form-container glass-card animate-slide-down">
          <div className="form-header">
            <h4>Catat Hutang / Piutang Baru</h4>
            <button onClick={resetForm} className="btn-close-form">Batal</button>
          </div>

          <form onSubmit={handleAddDebt} className="budget-form-grid">
            {/* Transaction Type Radio Card */}
            <div className="form-group span-full">
              <label className="form-label">Jenis Catatan</label>
              <div className="time-of-day-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <button
                  type="button"
                  className={`time-preset-card ${type === 'debt' ? 'selected' : ''}`}
                  onClick={() => setType('debt')}
                  style={{ borderColor: type === 'debt' ? 'var(--accent-danger)' : '' }}
                >
                  <span className="time-card-emoji">🔴</span>
                  <div className="time-card-text">
                    <span className="time-card-label" style={{ color: type === 'debt' ? 'var(--accent-danger)' : '' }}>Hutang</span>
                    <span className="time-card-desc">Saya meminjam uang dari orang lain</span>
                  </div>
                </button>
                <button
                  type="button"
                  className={`time-preset-card ${type === 'receivable' ? 'selected' : ''}`}
                  onClick={() => setType('receivable')}
                  style={{ borderColor: type === 'receivable' ? 'var(--accent-success)' : '' }}
                >
                  <span className="time-card-emoji">🟢</span>
                  <div className="time-card-text">
                    <span className="time-card-label" style={{ color: type === 'receivable' ? 'var(--accent-success)' : '' }}>Piutang</span>
                    <span className="time-card-desc">Orang lain meminjam uang dari saya</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Person Name */}
            <div className="form-group">
              <label className="form-label">Nama Orang / Instansi</label>
              <div className="date-picker-input-wrapper">
                <User size={14} className="input-decor-icon" />
                <input
                  type="text"
                  placeholder="Contoh: Andi, Bank Mandiri"
                  value={person}
                  onChange={(e) => setPerson(e.target.value)}
                  className="form-input with-prefix"
                  required
                />
              </div>
            </div>

            {/* Keterangan */}
            <div className="form-group">
              <label className="form-label">Keterangan / Tujuan</label>
              <input
                type="text"
                placeholder="Contoh: Pinjaman modal laptop, talangan makan siang"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="form-input"
                required
              />
            </div>

            {/* Nominal */}
            <div className="form-group">
              <label className="form-label">Nominal Rupiah</label>
              <div className="currency-input-wrapper">
                <span className="currency-prefix">Rp</span>
                <input
                  type="text"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(formatRupiahInput(e.target.value))}
                  className="form-input with-prefix"
                  required
                />
              </div>
            </div>

            {/* Due Date (Tanggal Jatuh Tempo) */}
            <div className="form-group">
              <label className="form-label">Jatuh Tempo (Opsional)</label>
              <div className="date-picker-input-wrapper">
                <Calendar size={14} className="input-decor-icon" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="form-input with-prefix"
                />
              </div>
            </div>

            {/* Wallet Selection (Opsional) */}
            <div className="form-group span-full">
              <label className="form-label">Hubungkan ke Rekening (Opsional)</label>
              {wallets.length === 0 ? (
                <div className="no-wallets-warning-box">
                  <AlertTriangle size={14} style={{ marginRight: 6 }} />
                  <span>Tidak ada rekening aktif. Saldo tidak akan disinkronkan otomatis.</span>
                </div>
              ) : (
                <select
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  className="form-input select-input"
                >
                  <option value="">-- Tidak menghubungkan rekening (Hanya catatan) --</option>
                  {wallets.map(w => (
                    <option key={w.id} value={w.id}>
                      💳 {w.bank_name} - {w.name} ({formatCurrency(w.balance)})
                    </option>
                  ))}
                </select>
              )}
              <span className="placeholder-text-muted" style={{ fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                Jika rekening dipilih: Saldo Anda akan otomatis bertambah (jika Hutang baru dibuat) atau berkurang (jika Piutang baru dibuat).
              </span>
            </div>

            <div className="form-actions span-full">
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="spinner animate-spin" size={16} style={{ marginRight: 6 }} />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Simpan Transaksi</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Debts list */}
      {filteredDebts.length === 0 ? (
        <div className="budget-empty-state glass-card">
          <div className="icon-circle">{activeTab === 'pending' ? '📜' : '✅'}</div>
          <h3>Tidak Ada Transaksi</h3>
          <p>Tidak ditemukan data catatan untuk tab ini.</p>
        </div>
      ) : (
        <div className="expenses-history-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredDebts.map(item => (
            <div 
              key={item.id} 
              className="expense-item-row glass-card"
              style={{ 
                borderLeft: item.type === 'debt' ? '4px solid var(--accent-danger)' : '4px solid var(--accent-success)'
              }}
            >
              <div className="item-left-block">
                <span 
                  className="category-emoji-badge" 
                  style={{ 
                    backgroundColor: item.type === 'debt' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    borderColor: item.type === 'debt' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'
                  }}
                >
                  {item.type === 'debt' ? '🔴' : '🟢'}
                </span>
                <div className="item-meta-info">
                  <h6 style={{ fontWeight: 700 }}>{item.description}</h6>
                  <div className="meta-tags-row">
                    <span 
                      className="item-category-tag" 
                      style={{ 
                        color: item.type === 'debt' ? 'var(--accent-danger)' : 'var(--accent-success)',
                        fontWeight: 600
                      }}
                    >
                      {item.type === 'debt' ? `Hutang ke ${item.person}` : `Piutang pada ${item.person}`}
                    </span>
                    {item.due_date && (
                      <span className="time-badge-pill" style={{ background: 'rgba(0,0,0,0.03)', color: '#64748b' }}>
                        📅 Jatuh Tempo: {formatDisplayDate(item.due_date)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="item-right-block">
                {item.wallet_name && (
                  <span className="payment-badge-pill">
                    <CreditCard size={12} style={{ marginRight: 4 }} />
                    {item.wallet_name}
                  </span>
                )}
                
                <span 
                  style={{ 
                    color: item.type === 'debt' ? 'var(--accent-danger)' : 'var(--accent-success)',
                    fontWeight: 700,
                    fontSize: '1.1rem'
                  }}
                >
                  {item.type === 'debt' ? '-' : '+'} {formatCurrency(item.amount)}
                </span>

                <div className="row-action-buttons">
                  {item.status === 'pending' && (
                    <button 
                      onClick={() => handleMarkAsPaid(item)}
                      className="btn-icon-action"
                      style={{ color: 'var(--accent-success)', borderColor: 'rgba(16, 185, 129, 0.2)', background: 'rgba(16, 185, 129, 0.05)' }}
                      title="Tandai Lunas"
                    >
                      <Check size={13} />
                    </button>
                  )}
                  <button 
                    onClick={() => handleDeleteDebt(item)}
                    className="btn-icon-action btn-delete-action"
                    title="Hapus Catatan"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const monthsIndo = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
