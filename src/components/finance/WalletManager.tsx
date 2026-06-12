import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Plus, Wallet, Trash2, CreditCard, Loader2, AlertCircle } from 'lucide-react';

interface WalletItem {
  id: string;
  name: string;
  bank_name: string;
  account_number?: string;
  balance: number;
  color: string;
}

const colorPresets = [
  { id: 'teal', label: 'Teal Green', gradient: 'linear-gradient(135deg, #0d9488 0%, #2dd4bf 100%)', text: '#ffffff' },
  { id: 'blue', label: 'Ocean Blue', gradient: 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)', text: '#ffffff' },
  { id: 'indigo', label: 'Lavender', gradient: 'linear-gradient(135deg, #6366f1 0%, #a5b4fc 100%)', text: '#ffffff' },
  { id: 'amber', label: 'Golden Amber', gradient: 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)', text: '#ffffff' },
  { id: 'rose', label: 'Rose Pink', gradient: 'linear-gradient(135deg, #e11d48 0%, #fda4af 100%)', text: '#ffffff' },
  { id: 'dark', label: 'Slate Gray', gradient: 'linear-gradient(135deg, #1e293b 0%, #64748b 100%)', text: '#ffffff' },
];

const bankPresets = [
  'BCA',
  'Mandiri',
  'BNI',
  'BRI',
  'BSI',
  'Bank Jago',
  'Allo Bank',
  'GoPay',
  'OVO',
  'Dana',
  'ShopeePay',
  'Cash / Tunai',
  'Lainnya'
];

export const WalletManager: React.FC = () => {
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [dbWarning, setDbWarning] = useState(false);
  
  // Form States
  const [walletName, setWalletName] = useState('');
  const [bankName, setBankName] = useState('BCA');
  const [customBankName, setCustomBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [selectedColor, setSelectedColor] = useState('teal');
  const [submitting, setSubmitting] = useState(false);

  // Load wallets
  useEffect(() => {
    fetchWallets();
  }, []);

  const fetchWallets = async () => {
    setLoading(true);
    setDbWarning(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        // Table probably doesn't exist yet
        console.warn('Supabase wallets table warning:', error.message);
        if (error.code === 'PGRST496' || error.message.includes('relation "wallets" does not exist')) {
          setDbWarning(true);
          // Load from LocalStorage as fallback so user can interact
          const localData = localStorage.getItem('mock_wallets');
          if (localData) setWallets(JSON.parse(localData));
        } else {
          throw error;
        }
      } else if (data) {
        setWallets(data);
        localStorage.setItem('mock_wallets', JSON.stringify(data));
      }
    } catch (err: any) {
      console.error('Error fetching wallets:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletName.trim()) return;

    setSubmitting(true);
    const resolvedBankName = bankName === 'Lainnya' ? customBankName : bankName;
    const balanceNum = parseFloat(initialBalance) || 0;

    const newWalletData = {
      name: walletName,
      bank_name: resolvedBankName || 'Cash',
      account_number: accountNumber || '',
      balance: balanceNum,
      color: selectedColor,
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (dbWarning) {
        // Local fallback insert
        const mockNewWallet: WalletItem = {
          id: 'mock-' + Date.now(),
          ...newWalletData
        };
        const updatedWallets = [...wallets, mockNewWallet];
        setWallets(updatedWallets);
        localStorage.setItem('mock_wallets', JSON.stringify(updatedWallets));
        resetForm();
      } else {
        const { data, error } = await supabase
          .from('wallets')
          .insert({
            user_id: user.id,
            ...newWalletData
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setWallets([...wallets, data]);
          resetForm();
        }
      }
    } catch (err: any) {
      alert('Gagal menambah rekening: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWallet = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus rekening ini?')) return;

    try {
      if (dbWarning || id.startsWith('mock-')) {
        const updatedWallets = wallets.filter(w => w.id !== id);
        setWallets(updatedWallets);
        localStorage.setItem('mock_wallets', JSON.stringify(updatedWallets));
      } else {
        const { error } = await supabase
          .from('wallets')
          .delete()
          .eq('id', id);

        if (error) throw error;
        setWallets(wallets.filter(w => w.id !== id));
      }
    } catch (err: any) {
      alert('Gagal menghapus rekening: ' + err.message);
    }
  };

  const resetForm = () => {
    setWalletName('');
    setBankName('BCA');
    setCustomBankName('');
    setAccountNumber('');
    setInitialBalance('');
    setSelectedColor('teal');
    setShowAddForm(false);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="wallet-manager-view">
      {dbWarning && (
        <div className="db-warning-alert glass-card">
          <AlertCircle className="warning-icon" />
          <div className="warning-text">
            <h5>Pemberitahuan Database</h5>
            <p>
              Tabel <code>wallets</code> belum dibuat di database Supabase Anda. 
              Data saat ini disimpan di penyimpanan lokal browser Anda agar tetap bisa diuji coba. 
              Silakan jalankan SQL schema yang tertera di walkthrough untuk sinkronisasi cloud penuh.
            </p>
          </div>
        </div>
      )}

      {/* Header section with Stats & Add Button */}
      <div className="wallet-manager-header">
        <div className="total-balance-summary">
          <span className="stats-label">Total Saldo Tergabung</span>
          <h2>{formatCurrency(wallets.reduce((sum, w) => sum + w.balance, 0))}</h2>
        </div>
        {!showAddForm && (
          <button onClick={() => setShowAddForm(true)} className="btn btn-primary">
            <Plus size={18} />
            <span>Tambah Rekening</span>
          </button>
        )}
      </div>

      {/* Add Wallet Form - Inline slide down */}
      {showAddForm && (
        <div className="wallet-form-container glass-card animate-slide-down">
          <div className="form-header">
            <h4>Tambah Rekening Baru</h4>
            <button onClick={resetForm} className="btn-close-form">Batal</button>
          </div>
          
          <form onSubmit={handleAddWallet} className="wallet-form-grid">
            <div className="form-group">
              <label className="form-label">Nama Rekening/Alias</label>
              <input
                type="text"
                className="form-input"
                placeholder="Contoh: Tabungan Utama, Uang Jajan"
                value={walletName}
                onChange={(e) => setWalletName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Bank atau E-wallet</label>
              <select
                className="form-input select-input"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              >
                {bankPresets.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {bankName === 'Lainnya' && (
              <div className="form-group">
                <label className="form-label">Nama Bank/E-wallet Custom</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Masukkan nama bank/e-wallet"
                  value={customBankName}
                  onChange={(e) => setCustomBankName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Nomor Rekening (Opsional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Masukkan nomor rekening jika ada"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Saldo Awal</label>
              <div className="currency-input-wrapper">
                <span className="currency-prefix">Rp</span>
                <input
                  type="number"
                  className="form-input with-prefix"
                  placeholder="0"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  min="0"
                />
              </div>
            </div>

            {/* Color preset picker */}
            <div className="form-group span-full">
              <label className="form-label">Pilih Warna Kartu</label>
              <div className="color-picker-row">
                {colorPresets.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    className={`color-preset-dot ${selectedColor === color.id ? 'selected' : ''}`}
                    style={{ background: color.gradient }}
                    onClick={() => setSelectedColor(color.id)}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            <div className="form-actions span-full">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? <Loader2 className="spinner" size={16} /> : <span>Simpan Rekening</span>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main List Display */}
      {loading ? (
        <div className="loading-state">
          <Loader2 className="spinner text-primary" size={32} />
          <p>Memuat daftar rekening...</p>
        </div>
      ) : wallets.length === 0 ? (
        /* Empty State */
        <div className="wallet-empty-state glass-card">
          <div className="icon-circle">
            <Wallet size={36} />
          </div>
          <h3>Belum ada Rekening</h3>
          <p>
            Anda belum menambahkan rekening atau e-wallet sama sekali. 
            Mulai atur kondisi finansial Anda dengan mendaftarkan dompet atau rekening pertama Anda!
          </p>
          <button onClick={() => setShowAddForm(true)} className="btn btn-primary">
            <Plus size={18} />
            <span>Tambah Rekening Sekarang</span>
          </button>
        </div>
      ) : (
        /* Grid list of wallet cards */
        <div className="wallets-grid">
          {wallets.map((wallet) => {
            const colorPreset = colorPresets.find(c => c.id === wallet.color) || colorPresets[0];
            return (
              <div 
                key={wallet.id} 
                className="wallet-card-item" 
                style={{ background: colorPreset.gradient, color: colorPreset.text }}
              >
                <div className="wallet-card-decor" />
                
                <div className="card-top">
                  <div className="card-title-section">
                    <span className="card-wallet-name">{wallet.name}</span>
                    <span className="card-bank-badge">{wallet.bank_name}</span>
                  </div>
                  <button 
                    onClick={() => handleDeleteWallet(wallet.id)} 
                    className="card-delete-btn"
                    title="Hapus Rekening"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="card-middle">
                  <CreditCard className="card-chip-icon" size={28} />
                  <span className="card-balance">{formatCurrency(wallet.balance)}</span>
                </div>

                <div className="card-bottom">
                  <span className="card-number">
                    {wallet.account_number ? wallet.account_number : '•••• •••• ••••'}
                  </span>
                  <span className="card-decor-seal" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
