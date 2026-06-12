import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, AlertTriangle, ArrowUpRight, Coins, Wallet, Calendar, CreditCard, Clock, Tag, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface IncomeItem {
  id: string;
  description: string;
  amount: number;
  sourceName: string;
  sourceIcon: string;
  sourceColor: string;
  walletName: string;
  walletId: string;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
}

interface IncomeSource {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface WalletItem {
  id: string;
  name: string;
  bank_name: string;
  account_number?: string;
  balance: number;
  color: string;
}

const monthsIndo = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const colorPresets = [
  { id: 'emerald', hex: '#10b981', label: 'Emerald Green' },
  { id: 'teal', hex: '#0d9488', label: 'Teal Green' },
  { id: 'blue', hex: '#3b82f6', label: 'Ocean Blue' },
  { id: 'indigo', hex: '#6366f1', label: 'Indigo Purple' },
  { id: 'purple', hex: '#a855f7', label: 'Royal Purple' },
  { id: 'fuchsia', hex: '#d946ef', label: 'Fuchsia Pink' },
  { id: 'pink', hex: '#ec4899', label: 'Rose Pink' },
  { id: 'rose', hex: '#f43f5e', label: 'Rose Red' },
  { id: 'amber', hex: '#f59e0b', label: 'Amber Yellow' },
  { id: 'orange', hex: '#f97316', label: 'Orange' },
  { id: 'slate', hex: '#64748b', label: 'Slate Gray' }
];

const emojiPresets = [
  '💼', '💻', '📈', '🎁', '💰', '🏠', '💵', '🛒', '🏦', '🎨', '☕', '💸'
];

const defaultIncomeSources: IncomeSource[] = [
  { id: 's-gaji', name: 'Gaji Bulanan', icon: '💼', color: '#10b981' },
  { id: 's-freelance', name: 'Freelance', icon: '💻', color: '#6366f1' },
  { id: 's-investasi', name: 'Investasi', icon: '📈', color: '#3b82f6' },
  { id: 's-hadiah', name: 'Hadiah', icon: '🎁', color: '#ec4899' },
  { id: 's-lainnya', name: 'Lain-lain', icon: '💸', color: '#64748b' }
];

const fallbackWallets: WalletItem[] = [
  { id: 'w-cash', name: 'Dompet Tunai', bank_name: 'Cash', balance: 1000000, color: 'teal' },
  { id: 'w-bca', name: 'BCA Tabungan', bank_name: 'BCA', balance: 5000000, color: 'blue' }
];

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

export const IncomeManager: React.FC = () => {
  const [incomes, setIncomes] = useState<IncomeItem[]>([]);
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSourcesManager, setShowSourcesManager] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [originalEditingItem, setOriginalEditingItem] = useState<IncomeItem | null>(null);

  // Connection & loading states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dbWarning, setDbWarning] = useState(false);

  // Date range state (default to current month's start and end date)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
    return `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  });

  // Form states
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [sourceKey, setSourceKey] = useState('');
  const [walletKey, setWalletKey] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });

  // Manage Sources Form States
  const [newSourceName, setNewSourceName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('💼');
  const [selectedColor, setSelectedColor] = useState('emerald');

  // Load all contexts on mount and date range updates
  useEffect(() => {
    loadDataContexts();
  }, [startDate, endDate]);

  // Helper to identify all months in a date range (YYYY-MM)
  const getMonthsInRange = (startStr: string, endStr: string): string[] => {
    if (!startStr || !endStr) return [];
    const months: string[] = [];
    const start = new Date(startStr);
    const end = new Date(endStr);
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    const targetEnd = new Date(end.getFullYear(), end.getMonth(), 1);
    
    while (current <= targetEnd) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      months.push(`${y}-${m}`);
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  };

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

      // 1. Fetch Wallets from DB
      const { data: walletsData, error: walletsError } = await supabase
        .from('wallets')
        .select('*')
        .order('created_at', { ascending: true });

      // 2. Fetch Income Sources from DB
      const { data: sourcesData, error: sourcesError } = await supabase
        .from('income_sources')
        .select('*')
        .order('created_at', { ascending: true });

      // 3. Fetch Incomes in range from DB
      const { data: incomesData, error: incomesError } = await supabase
        .from('incomes')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (walletsError || sourcesError || incomesError) {
        const err = walletsError || sourcesError || incomesError;
        console.warn('Supabase fetch error, falling back to LocalStorage:', err?.message);
        if (err?.code === 'PGRST496' || err?.message.includes('relation "incomes" does not exist') || err?.message.includes('relation "income_sources" does not exist') || err?.message.includes('relation "wallets" does not exist')) {
          setDbWarning(true);
          loadLocalDataContexts();
        } else {
          throw err;
        }
      } else {
        // Handle successful DB responses
        if (walletsData) {
          setWallets(walletsData);
          localStorage.setItem('mock_wallets', JSON.stringify(walletsData));
        }

        if (sourcesData) {
          if (sourcesData.length === 0) {
            // Seed default income sources to DB
            const seedSources = defaultIncomeSources.map(ds => ({
              user_id: user.id,
              name: ds.name,
              icon: ds.icon,
              color: ds.color
            }));
            const { data: seeded, error: seedError } = await supabase
              .from('income_sources')
              .insert(seedSources)
              .select();
            if (!seedError && seeded) {
              const mappedSources: IncomeSource[] = seeded.map(s => ({
                id: s.id,
                name: s.name,
                icon: s.icon,
                color: s.color
              }));
              setSources(mappedSources);
              localStorage.setItem('mock_income_sources', JSON.stringify(mappedSources));
            } else {
              setSources(defaultIncomeSources);
              localStorage.setItem('mock_income_sources', JSON.stringify(defaultIncomeSources));
            }
          } else {
            const mappedSources: IncomeSource[] = sourcesData.map(s => ({
              id: s.id,
              name: s.name,
              icon: s.icon,
              color: s.color
            }));
            setSources(mappedSources);
            localStorage.setItem('mock_income_sources', JSON.stringify(mappedSources));
          }
        }

        if (incomesData) {
          const mappedIncomes: IncomeItem[] = incomesData.map(i => ({
            id: i.id,
            description: i.description,
            amount: parseFloat(i.amount) || 0,
            sourceName: i.source_name,
            sourceIcon: i.source_icon,
            sourceColor: i.source_color,
            walletId: i.wallet_id,
            walletName: i.wallet_name,
            date: i.date,
            month: i.month
          }));
          setIncomes(mappedIncomes);

          const rangeMonths = getMonthsInRange(startDate, endDate);
          rangeMonths.forEach(m => {
            const mIncomes = mappedIncomes.filter(inc => inc.month === m);
            localStorage.setItem(`mock_incomes_${m}`, JSON.stringify(mIncomes));
          });
        }
      }
    } catch (err: any) {
      console.error('Error fetching data from database:', err.message);
      setDbWarning(true);
      loadLocalDataContexts();
    } finally {
      setLoading(false);
    }
  };

  const loadLocalDataContexts = () => {
    // 1. Load Wallets
    const localWallets = localStorage.getItem('mock_wallets');
    let loadedWallets: WalletItem[] = [];
    if (localWallets) {
      loadedWallets = JSON.parse(localWallets);
    } else {
      loadedWallets = fallbackWallets;
      localStorage.setItem('mock_wallets', JSON.stringify(fallbackWallets));
    }
    setWallets(loadedWallets);

    // 2. Load Income Sources
    const localSources = localStorage.getItem('mock_income_sources');
    let loadedSources: IncomeSource[] = [];
    if (localSources) {
      loadedSources = JSON.parse(localSources);
    } else {
      loadedSources = defaultIncomeSources;
      localStorage.setItem('mock_income_sources', JSON.stringify(defaultIncomeSources));
    }
    setSources(loadedSources);

    // 3. Load Incomes in range
    const months = getMonthsInRange(startDate, endDate);
    let mergedIncomes: IncomeItem[] = [];
    months.forEach((m) => {
      const localIncomes = localStorage.getItem(`mock_incomes_${m}`);
      if (localIncomes) {
        mergedIncomes = mergedIncomes.concat(JSON.parse(localIncomes));
      }
    });

    const filtered = mergedIncomes
      .filter((e) => e.date >= startDate && e.date <= endDate)
      .sort((a, b) => b.date.localeCompare(a.date));
      
    setIncomes(filtered);
  };

  // Helper to sync wallet balance (adds/subtracts based on income changes)
  const syncWalletBalance = async (
    walletId: string,
    amountDiff: number // positive to add balance (add income), negative to deduct balance (delete/refund income)
  ) => {
    // 1. Adjust LocalStorage Cache
    const localWallets = localStorage.getItem('mock_wallets');
    if (localWallets) {
      const walletsList: WalletItem[] = JSON.parse(localWallets);
      const updatedWallets = walletsList.map(w => {
        if (w.id === walletId) {
          return { ...w, balance: Math.max(0, w.balance + amountDiff) };
        }
        return w;
      });
      localStorage.setItem('mock_wallets', JSON.stringify(updatedWallets));
    }

    // 2. Sync to Supabase DB if DB is active
    if (!dbWarning) {
      try {
        const { data: wData, error: wError } = await supabase
          .from('wallets')
          .select('balance')
          .eq('id', walletId)
          .single();

        if (!wError && wData) {
          const currentBalance = parseFloat(wData.balance) || 0;
          const newBalance = Math.max(0, currentBalance + amountDiff);
          await supabase
            .from('wallets')
            .update({ balance: newBalance })
            .eq('id', walletId);
        }
      } catch (err: any) {
        console.error('Error syncing wallet balance in database:', err.message);
      }
    } else {
      // Direct UI state update for mockup warning mode
      const localWallets = localStorage.getItem('mock_wallets');
      if (localWallets) setWallets(JSON.parse(localWallets));
    }
  };

  const handleAddOrEditIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount || !sourceKey || !walletKey) return;

    setSubmitting(true);
    const parsedAmount = parseRupiahInput(amount);
    const targetMonth = date.substring(0, 7);

    // Find source details
    const matchedSource = sources.find(s => s.name === sourceKey || s.id === sourceKey);
    const sName = matchedSource?.name || 'Lain-lain';
    const sIcon = matchedSource?.icon || '💸';
    const sColor = matchedSource?.color || '#64748b';

    // Find wallet details
    const matchedWallet = wallets.find(w => w.id === walletKey);
    const wName = matchedWallet?.name || 'Tunai';
    const wId = matchedWallet?.id || 'w-cash';

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSubmitting(false);
        return;
      }

      if (dbWarning) {
        // Local mockup CRUD flow
        if (editingId && originalEditingItem) {
          // Edit mode: Reverse original transaction balance addition
          await syncWalletBalance(originalEditingItem.walletId, -originalEditingItem.amount);

          // Remove from original month list
          const origKey = `mock_incomes_${originalEditingItem.month}`;
          const origData = localStorage.getItem(origKey);
          const origList: IncomeItem[] = origData ? JSON.parse(origData) : [];
          const cleanedList = origList.filter(ex => ex.id !== editingId);
          localStorage.setItem(origKey, JSON.stringify(cleanedList));

          // Save updated transaction
          const updatedItem: IncomeItem = {
            id: editingId,
            description,
            amount: parsedAmount,
            sourceName: sName,
            sourceIcon: sIcon,
            sourceColor: sColor,
            walletName: wName,
            walletId: wId,
            date,
            month: targetMonth
          };

          const targetKey = `mock_incomes_${targetMonth}`;
          const targetData = localStorage.getItem(targetKey);
          const targetList: IncomeItem[] = targetData ? JSON.parse(targetData) : [];
          localStorage.setItem(targetKey, JSON.stringify([...targetList, updatedItem]));

          // Apply new balance addition
          await syncWalletBalance(wId, parsedAmount);
        } else {
          // Add mode
          const newIncome: IncomeItem = {
            id: 'income-' + Date.now(),
            description,
            amount: parsedAmount,
            sourceName: sName,
            sourceIcon: sIcon,
            sourceColor: sColor,
            walletName: wName,
            walletId: wId,
            date,
            month: targetMonth
          };

          // Save to LocalStorage
          const targetKey = `mock_incomes_${targetMonth}`;
          const targetData = localStorage.getItem(targetKey);
          const targetList: IncomeItem[] = targetData ? JSON.parse(targetData) : [];
          localStorage.setItem(targetKey, JSON.stringify([...targetList, newIncome]));

          // Sync wallet balance
          await syncWalletBalance(wId, parsedAmount);
        }
        resetForm();
        loadLocalDataContexts();
      } else {
        // Real Supabase DB CRUD flow
        if (editingId && originalEditingItem) {
          // 1. Reverse original in DB
          await syncWalletBalance(originalEditingItem.walletId, -originalEditingItem.amount);

          // 2. Update in DB
          const { error } = await supabase
            .from('incomes')
            .update({
              description,
              amount: parsedAmount,
              source_name: sName,
              source_icon: sIcon,
              source_color: sColor,
              wallet_id: wId,
              wallet_name: wName,
              date,
              month: targetMonth
            })
            .eq('id', editingId);

          if (error) throw error;

          // 3. Apply new balance in DB
          await syncWalletBalance(wId, parsedAmount);
        } else {
          // Add mode
          const { error } = await supabase
            .from('incomes')
            .insert({
              user_id: user.id,
              description,
              amount: parsedAmount,
              source_name: sName,
              source_icon: sIcon,
              source_color: sColor,
              wallet_id: wId,
              wallet_name: wName,
              date,
              month: targetMonth
            });

          if (error) throw error;

          // Sync wallet balance
          await syncWalletBalance(wId, parsedAmount);
        }
        resetForm();
        await loadDataContexts();
      }
    } catch (err: any) {
      console.error('Error saving income transaction:', err.message);
      alert('Gagal menyimpan transaksi: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (item: IncomeItem) => {
    setEditingId(item.id);
    setOriginalEditingItem(item);
    setDescription(item.description);
    setAmount(formatRupiahInput(item.amount.toString()));

    const src = sources.find(s => s.name === item.sourceName);
    setSourceKey(src ? src.name : item.sourceName);
    setWalletKey(item.walletId);
    setDate(item.date);
    setShowAddForm(true);
  };

  const handleDeleteIncome = async (item: IncomeItem) => {
    if (!confirm('Apakah Anda yakin ingin menghapus catatan pemasukan ini?')) return;

    setSubmitting(true);
    try {
      if (dbWarning) {
        // 1. Reverse wallet balance
        await syncWalletBalance(item.walletId, -item.amount);

        // 2. Remove transaction from LocalStorage
        const monthKey = item.month;
        const localData = localStorage.getItem(`mock_incomes_${monthKey}`);
        if (localData) {
          const list: IncomeItem[] = JSON.parse(localData);
          const updatedList = list.filter(ex => ex.id !== item.id);
          localStorage.setItem(`mock_incomes_${monthKey}`, JSON.stringify(updatedList));
        }
        loadLocalDataContexts();
      } else {
        // 1. Reverse wallet balance in DB
        await syncWalletBalance(item.walletId, -item.amount);

        // 2. Delete from DB
        const { error } = await supabase
          .from('incomes')
          .delete()
          .eq('id', item.id);

        if (error) throw error;
        await loadDataContexts();
      }
    } catch (err: any) {
      console.error('Error deleting income:', err.message);
      alert('Gagal menghapus transaksi: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim()) return;

    const colorHex = colorPresets.find(c => c.id === selectedColor)?.hex || '#10b981';

    try {
      if (dbWarning) {
        const newSource: IncomeSource = {
          id: 'source-' + Date.now(),
          name: newSourceName,
          icon: selectedEmoji,
          color: colorHex
        };

        const updatedSources = [...sources, newSource];
        setSources(updatedSources);
        localStorage.setItem('mock_income_sources', JSON.stringify(updatedSources));
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
          .from('income_sources')
          .insert({
            user_id: user.id,
            name: newSourceName,
            icon: selectedEmoji,
            color: colorHex
          });

        if (error) throw error;
        await loadDataContexts();
      }

      setNewSourceName('');
      setSelectedEmoji('💼');
      setSelectedColor('emerald');
    } catch (err: any) {
      console.error('Error adding income source:', err.message);
      alert('Gagal menambah kategori sumber: ' + err.message);
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!confirm('Hapus kategori sumber pemasukan ini? Transaksi lama tidak terhapus tapi kategori tidak bisa dipilih lagi.')) return;
    
    try {
      if (dbWarning) {
        const updated = sources.filter(s => s.id !== id);
        setSources(updated);
        localStorage.setItem('mock_income_sources', JSON.stringify(updated));
      } else {
        const { error } = await supabase
          .from('income_sources')
          .delete()
          .eq('id', id);

        if (error) throw error;
        await loadDataContexts();
      }
    } catch (err: any) {
      console.error('Error deleting income source:', err.message);
      alert('Gagal menghapus kategori sumber: ' + err.message);
    }
  };

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setSourceKey('');
    setWalletKey('');

    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setDate(`${y}-${m}-${day}`);

    setEditingId(null);
    setOriginalEditingItem(null);
    setShowAddForm(false);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val);
  };

  // Preset Date range helpers
  const setPresetBulanIni = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    setStartDate(`${y}-${m}-01`);
    const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
    setEndDate(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
  };

  const setPreset7Hari = () => {
    const today = new Date();
    const prev = new Date(today);
    prev.setDate(today.getDate() - 6);
    
    const formatDate = (dateObj: Date) => {
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    
    setStartDate(formatDate(prev));
    setEndDate(formatDate(today));
  };

  const setPreset30Hari = () => {
    const today = new Date();
    const prev = new Date(today);
    prev.setDate(today.getDate() - 29);
    
    const formatDate = (dateObj: Date) => {
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    
    setStartDate(formatDate(prev));
    setEndDate(formatDate(today));
  };

  const isCurrentMonthActive = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const start = `${y}-${m}-01`;
    const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
    const end = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
    return startDate === start && endDate === end;
  };

  // Summary Metrics calculations
  const totalIncome = incomes.reduce((sum, item) => sum + item.amount, 0);

  const getLargestSource = () => {
    if (incomes.length === 0) return null;
    const sourceTotals: { [key: string]: { amount: number; icon: string } } = {};
    incomes.forEach(item => {
      if (!sourceTotals[item.sourceName]) {
        sourceTotals[item.sourceName] = { amount: 0, icon: item.sourceIcon };
      }
      sourceTotals[item.sourceName].amount += item.amount;
    });

    return Object.keys(sourceTotals).reduce((prev: any, curr: string) => {
      if (!prev || sourceTotals[curr].amount > sourceTotals[prev].amount) {
        return curr;
      }
      return prev;
    }, null);
  };

  const getLargestSourceAmount = (sourceName: string | null) => {
    if (!sourceName) return 0;
    return incomes.filter(i => i.sourceName === sourceName).reduce((sum, item) => sum + item.amount, 0);
  };

  const getDailyAverage = () => {
    if (incomes.length === 0) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.round(totalIncome / diffDays);
  };

  const getGroupedIncomes = () => {
    const groups: { [key: string]: IncomeItem[] } = {};
    incomes.forEach(e => {
      if (!groups[e.date]) {
        groups[e.date] = [];
      }
      groups[e.date].push(e);
    });

    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map(dateStr => {
        const dailyTotal = groups[dateStr].reduce((sum, item) => sum + item.amount, 0);
        return {
          date: dateStr,
          dailyTotal,
          items: groups[dateStr]
        };
      });
  };

  const formatHeaderDate = (dateStr: string) => {
    const dateObj = new Date(dateStr);
    const day = dateObj.getDate();
    const month = monthsIndo[dateObj.getMonth()];
    const year = dateObj.getFullYear();
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const formatCompare = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dayStr}`;
    };

    if (dateStr === formatCompare(today)) return `Hari ini - ${day} ${month} ${year}`;
    if (dateStr === formatCompare(yesterday)) return `Kemarin - ${day} ${month} ${year}`;

    const daysName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayName = daysName[dateObj.getDay()];
    
    return `${dayName}, ${day} ${month} ${year}`;
  };

  const largestSource = getLargestSource();
  const largestSourceAmount = getLargestSourceAmount(largestSource);
  const activeWalletsList = wallets.length > 0 ? wallets : [];

  // ==================== CHART DATA PREPARATION ====================

  // 1. Daily Trend Line Chart
  const getDatesInRangeList = (startStr: string, endStr: string): string[] => {
    const dates: string[] = [];
    const start = new Date(startStr);
    const end = new Date(endStr);
    const current = new Date(start);
    while (current <= end) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const datesList = getDatesInRangeList(startDate, endDate);
  const dailyAmounts = datesList.map(dateStr => {
    return incomes
      .filter(i => i.date === dateStr)
      .reduce((sum, i) => sum + i.amount, 0);
  });

  const formatChartDateLabel = (dateStr: string) => {
    const [,, dStr] = dateStr.split('-');
    const dateObj = new Date(dateStr);
    const monthShort = dateObj.toLocaleDateString('id-ID', { month: 'short' });
    return `${parseInt(dStr, 10)} ${monthShort}`;
  };

  const chartLabels = datesList.map(formatChartDateLabel);

  const trendChartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Pemasukan',
        data: dailyAmounts,
        borderColor: '#10b981', // emerald green for income
        backgroundColor: 'rgba(16, 185, 129, 0.06)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointBackgroundColor: '#10b981',
        borderWidth: 3
      }
    ]
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        titleFont: { size: 12, weight: 'bold' as const },
        bodyFont: { size: 11 },
        padding: 10,
        cornerRadius: 6,
        displayColors: false,
        callbacks: {
          label: (context: any) => {
            return `Pemasukan: ${formatCurrency(context.raw)}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: '#64748b', font: { size: 9 }, maxRotation: 45, minRotation: 0 }
      },
      y: {
        grid: { color: 'rgba(0, 0, 0, 0.03)' },
        border: { display: false },
        ticks: {
          color: '#64748b',
          font: { size: 9 },
          callback: (value: any) => {
            if (value >= 1000000) return `Rp ${value / 1000000}jt`;
            if (value >= 1000) return `Rp ${value / 1000}rb`;
            return `Rp ${value}`;
          }
        }
      }
    }
  };

  // 2. Source Distribution Doughnut Chart
  const sourceTotals: { [key: string]: { amount: number; color: string; icon: string } } = {};
  incomes.forEach(i => {
    if (!sourceTotals[i.sourceName]) {
      const src = sources.find(s => s.name === i.sourceName);
      sourceTotals[i.sourceName] = { 
        amount: 0, 
        color: src?.color || i.sourceColor, 
        icon: src?.icon || i.sourceIcon 
      };
    }
    sourceTotals[i.sourceName].amount += i.amount;
  });

  const sourceLabels = Object.keys(sourceTotals);
  const sourceChartData = {
    labels: sourceLabels.map(s => `${sourceTotals[s].icon} ${s}`),
    datasets: [
      {
        data: sourceLabels.map(s => sourceTotals[s].amount),
        backgroundColor: sourceLabels.map(s => sourceTotals[s].color),
        borderWidth: 0,
        borderRadius: 4,
        spacing: 3,
        hoverOffset: 6
      }
    ]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: '#334155',
          font: { size: 10, weight: 'normal' as const },
          padding: 8,
          usePointStyle: true,
          pointStyle: 'circle' as const
        }
      },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 10,
        cornerRadius: 6,
        callbacks: {
          label: (context: any) => {
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const val = context.raw;
            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
            return ` ${context.label}: ${formatCurrency(val)} (${pct}%)`;
          }
        }
      }
    },
    cutout: '75%'
  };

  // 3. Wallet Destination Horizontal Bar Chart
  const destinationTotals: { [key: string]: number } = {};
  incomes.forEach(i => {
    if (!destinationTotals[i.walletName]) {
      destinationTotals[i.walletName] = 0;
    }
    destinationTotals[i.walletName] += i.amount;
  });

  const destLabels = Object.keys(destinationTotals);
  const destData = destLabels.map(w => destinationTotals[w]);
  
  const destColors = destLabels.map(label => {
    const w = wallets.find(wal => wal.name === label);
    if (w) {
      if (w.color === 'teal') return '#0d9488';
      if (w.color === 'blue') return '#3b82f6';
      if (w.color === 'indigo') return '#6366f1';
      if (w.color === 'amber') return '#f59e0b';
      if (w.color === 'rose') return '#f43f5e';
      if (w.color === 'dark') return '#475569';
    }
    return '#10b981';
  });

  const destChartData = {
    labels: destLabels,
    datasets: [
      {
        label: 'Total Pemasukan (Rp)',
        data: destData,
        backgroundColor: destColors.length > 0 ? destColors : ['#10b981'],
        borderRadius: 8,
        borderWidth: 0,
        barThickness: 16
      }
    ]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 10,
        cornerRadius: 6,
        callbacks: {
          label: (context: any) => {
            return ` Pemasukan: ${formatCurrency(context.raw)}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: '#64748b',
          font: { size: 9 },
          callback: (value: any) => {
            if (value >= 1000000) return `${value / 1000000}jt`;
            if (value >= 1000) return `${value / 1000}rb`;
            return value;
          }
        }
      },
      y: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: '#334155', font: { size: 10, weight: 'normal' as const } }
      }
    }
  };

  // Rendering loading state
  if (loading) {
    return (
      <div className="loading-state">
        <Loader2 className="spinner text-primary animate-spin" size={32} />
        <p>Memuat catatan pemasukan...</p>
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
              Tabel <code>incomes</code> atau <code>income_sources</code> belum dibuat di database Supabase Anda. 
              Data saat ini disimpan di penyimpanan lokal browser Anda agar tetap bisa diuji coba. 
              Silakan jalankan SQL schema yang tertera di walkthrough untuk sinkronisasi cloud penuh.
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="budget-summary-grid">
        {/* Total Income */}
        <div className="glass-card summary-card budget-remaining">
          <div className="summary-card-content">
            <span className="summary-label">Total Pemasukan (Filter)</span>
            <h4>{formatCurrency(totalIncome)}</h4>
          </div>
          <div className="summary-icon-wrapper">
            <ArrowUpRight size={22} />
          </div>
        </div>

        {/* Largest Source */}
        <div className="glass-card summary-card budget-spent exceeded" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', borderColor: 'rgba(99, 102, 241, 0.15)' }}>
          <div className="summary-card-content">
            <span className="summary-label">Sumber Terbesar</span>
            <h4>
              {largestSource ? (
                <>
                  <span style={{ marginRight: 4 }}>{sources.find(s => s.name === largestSource)?.icon || '💰'}</span>
                  {formatCurrency(largestSourceAmount)}
                </>
              ) : (
                'Rp 0'
              )}
            </h4>
          </div>
          <div className="summary-icon-wrapper">
            <Coins size={22} />
          </div>
        </div>

        {/* Daily Average */}
        <div className="glass-card summary-card budget-total" style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', borderColor: 'rgba(14, 165, 233, 0.15)' }}>
          <div className="summary-card-content">
            <span className="summary-label">Rata-Rata Harian</span>
            <h4>{formatCurrency(getDailyAverage())}</h4>
          </div>
          <div className="summary-icon-wrapper">
            <Wallet size={22} />
          </div>
        </div>
      </div>

      {/* Date Range Picker Filter Section */}
      <div className="date-filter-section glass-card">
        <div className="date-filter-inputs">
          <div className="filter-input-group">
            <label>Mulai Tanggal</label>
            <div className="date-picker-input-wrapper">
              <Calendar size={14} className="input-decor-icon" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="filter-date-input"
              />
            </div>
          </div>
          <div className="filter-input-group">
            <label>Sampai Tanggal</label>
            <div className="date-picker-input-wrapper">
              <Calendar size={14} className="input-decor-icon" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="filter-date-input"
              />
            </div>
          </div>
        </div>
        
        <div className="date-presets-container">
          <span className="presets-label">Preset Cepat:</span>
          <div className="date-presets-row">
            <button 
              onClick={setPresetBulanIni} 
              className={`btn-preset-date ${isCurrentMonthActive() ? 'active' : ''}`}
            >
              Bulan Ini
            </button>
            <button 
              onClick={setPreset7Hari} 
              className="btn-preset-date"
            >
              7 Hari Terakhir
            </button>
            <button 
              onClick={setPreset30Hari} 
              className="btn-preset-date"
            >
              30 Hari Terakhir
            </button>
          </div>
        </div>
      </div>

      {/* Visual Charts Grid */}
      {incomes.length > 0 && (
        <div className="charts-dashboard-grid">
          {/* Card 1: Tren Pemasukan Harian */}
          <div className="glass-card chart-card chart-card-full">
            <div className="chart-card-header">
              <Clock size={16} className="chart-card-icon" />
              <h4>Tren Pemasukan Harian</h4>
            </div>
            <div className="chart-card-body">
              <div className="chart-canvas-wrapper">
                <Line data={trendChartData} options={lineOptions} />
              </div>
            </div>
          </div>

          {/* Card 2: Distribusi Sumber Pemasukan */}
          <div className="glass-card chart-card">
            <div className="chart-card-header">
              <Coins size={16} className="chart-card-icon" />
              <h4>Distribusi Sumber Pemasukan</h4>
            </div>
            <div className="chart-card-body">
              <div className="chart-canvas-wrapper doughnut-wrapper">
                <Doughnut data={sourceChartData} options={doughnutOptions} />
              </div>
            </div>
          </div>

          {/* Card 3: Distribusi per Rekening */}
          <div className="glass-card chart-card">
            <div className="chart-card-header">
              <Wallet size={16} className="chart-card-icon" />
              <h4>Rekening Tujuan (Dompet)</h4>
            </div>
            <div className="chart-card-body">
              <div className="chart-canvas-wrapper">
                <Bar data={destChartData} options={barOptions} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Area for adding sources or incomes */}
      <div className="budget-list-header" style={{ marginTop: '0.5rem' }}>
        <div className="budget-header-title-area">
          <h3>Riwayat Pemasukan</h3>
          <span className="total-items-tag">{incomes.length} Transaksi</span>
        </div>
        
        <div className="action-buttons-group">
          <button 
            onClick={() => setShowSourcesManager(!showSourcesManager)} 
            className="btn btn-secondary"
            style={{ marginRight: 8 }}
          >
            <Tag size={16} style={{ marginRight: 6 }} />
            <span>Kelola Sumber Pemasukan</span>
          </button>

          {!showAddForm && (
            <button 
              onClick={() => {
                const today = new Date();
                const y = today.getFullYear();
                const m = String(today.getMonth() + 1).padStart(2, '0');
                const d = String(today.getDate()).padStart(2, '0');
                setDate(`${y}-${m}-${d}`);

                if (sources.length > 0) setSourceKey(sources[0].name);
                if (activeWalletsList.length > 0) setWalletKey(activeWalletsList[0].id);

                setShowAddForm(true);
              }} 
              className="btn btn-primary"
            >
              <Plus size={18} />
              <span>Catat Pemasukan Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Income Sources Manager Panel */}
      {showSourcesManager && (
        <div className="budget-form-container glass-card animate-slide-down" style={{ borderColor: 'rgba(99, 102, 241, 0.15)' }}>
          <div className="form-header">
            <h4>Kelola Kategori Sumber Pemasukan</h4>
            <button onClick={() => setShowSourcesManager(false)} className="btn-close-form">Selesai</button>
          </div>

          <div className="sources-manager-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            {/* List of current sources */}
            <div className="sources-list-section" style={{ textAlign: 'left' }}>
              <h5>Daftar Sumber Saat Ini</h5>
              <div className="sources-list-grid" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto', paddingRight: '0.5rem', marginTop: '1rem' }}>
                {sources.map(s => {
                  const isDefault = defaultIncomeSources.some(ds => ds.id === s.id);
                  return (
                    <div key={s.id} className="source-item-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.01)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>{s.icon}</span>
                        <span style={{ fontWeight: 600, color: s.color }}>{s.name}</span>
                      </div>
                      {!isDefault && (
                        <button 
                          onClick={() => handleDeleteSource(s.id)}
                          className="btn-icon-action btn-delete-action"
                          title="Hapus Kategori"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Form to add a new source */}
            <form onSubmit={handleAddSource} className="sources-form-section" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
              <h5>Tambah Kategori Baru</h5>
              <div className="form-group">
                <label className="form-label">Nama Sumber</label>
                <input
                  type="text"
                  placeholder="Contoh: Honor Konsultasi, Dividen"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Warna Kategori</label>
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

              <div className="form-group">
                <label className="form-label">Ikon / Emoji</label>
                <div className="emoji-picker-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
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

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                <span>Tambah Kategori</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Income Transaction Form */}
      {showAddForm && (
        <div className="budget-form-container glass-card animate-slide-down">
          <div className="form-header">
            <h4>{editingId ? 'Edit Catatan Pemasukan' : 'Catat Pemasukan Baru'}</h4>
            <button onClick={resetForm} className="btn-close-form">Batal</button>
          </div>

          <form onSubmit={handleAddOrEditIncome} className="budget-form-grid">
            {/* Description */}
            <div className="form-group span-full">
              <label className="form-label">Keterangan / Catatan</label>
              <input
                type="text"
                className="form-input"
                placeholder="Contoh: Gaji Bulan Juni, Pembayaran Project Freelance"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {/* Date */}
            <div className="form-group">
              <label className="form-label">Tanggal Transaksi</label>
              <input
                type="date"
                className="form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            {/* Nominal */}
            <div className="form-group">
              <label className="form-label">Nominal Pemasukan</label>
              <div className="currency-input-wrapper">
                <span className="currency-prefix">Rp</span>
                <input
                  type="text"
                  className="form-input with-prefix"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(formatRupiahInput(e.target.value))}
                  required
                />
              </div>
            </div>

            {/* Source Select */}
            <div className="form-group">
              <label className="form-label">Sumber Pemasukan</label>
              <select
                value={sourceKey}
                onChange={(e) => setSourceKey(e.target.value)}
                className="form-input select-input"
                required
              >
                <option value="" disabled>-- Pilih Sumber --</option>
                {sources.map(s => (
                  <option key={s.id} value={s.name}>
                    {s.icon} {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Destination Wallet */}
            <div className="form-group">
              <label className="form-label">Rekening Penerima (Dompet)</label>
              {activeWalletsList.length === 0 ? (
                <div className="no-wallets-warning-box">
                  <AlertTriangle size={14} style={{ marginRight: 6 }} />
                  <span>Anda belum membuat rekening. Buat di menu Dompet dahulu.</span>
                </div>
              ) : (
                <select
                  value={walletKey}
                  onChange={(e) => setWalletKey(e.target.value)}
                  className="form-input select-input"
                  required
                >
                  <option value="" disabled>-- Pilih Dompet --</option>
                  {activeWalletsList.map(w => (
                    <option key={w.id} value={w.id}>
                      💳 {w.bank_name} - {w.name} ({formatCurrency(w.balance)})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="form-actions span-full">
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={activeWalletsList.length === 0 || submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="spinner animate-spin" size={16} style={{ marginRight: 6 }} />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>{editingId ? 'Update Transaksi' : 'Simpan Transaksi'}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Transaction History List */}
      {incomes.length === 0 ? (
        <div className="budget-empty-state glass-card">
          <div className="icon-circle">💰</div>
          <h3>Belum Ada Transaksi Masuk</h3>
          <p>Belum ada catatan pemasukan uang untuk rentang tanggal terpilih.</p>
          <button 
            onClick={() => {
              const today = new Date();
              const y = today.getFullYear();
              const m = String(today.getMonth() + 1).padStart(2, '0');
              const d = String(today.getDate()).padStart(2, '0');
              setDate(`${y}-${m}-${d}`);
              
              if (sources.length > 0) setSourceKey(sources[0].name);
              if (activeWalletsList.length > 0) setWalletKey(activeWalletsList[0].id);
              
              setShowAddForm(true);
            }} 
            className="btn btn-primary"
            disabled={activeWalletsList.length === 0}
          >
            <Plus size={16} />
            <span>Catat Pemasukan Pertama</span>
          </button>
        </div>
      ) : (
        <div className="expenses-history-list">
          {getGroupedIncomes().map(group => (
            <div key={group.date} className="expense-date-group">
              <div className="expense-date-header">
                <h5>{formatHeaderDate(group.date)}</h5>
                <span className="daily-total-badge" style={{ color: 'var(--accent-success)' }}>
                  + {formatCurrency(group.dailyTotal)}
                </span>
              </div>
              
              <div className="expense-group-items">
                {group.items.map(item => (
                  <div key={item.id} className="expense-item-row glass-card">
                    <div className="item-left-block">
                      <span className="category-emoji-badge" style={{ backgroundColor: `${item.sourceColor}15`, borderColor: `${item.sourceColor}30` }}>
                        {item.sourceIcon}
                      </span>
                      <div className="item-meta-info">
                        <h6>{item.description}</h6>
                        <div className="meta-tags-row">
                          <span className="item-category-tag" style={{ color: item.sourceColor }}>{item.sourceName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="item-right-block">
                      <span className="payment-badge-pill">
                        <CreditCard size={12} style={{ marginRight: 4 }} />
                        {item.walletName}
                      </span>
                      
                      <span className="transaction-amount-minus" style={{ color: 'var(--accent-success)' }}>
                        + {formatCurrency(item.amount)}
                      </span>

                      <div className="row-action-buttons">
                        <button 
                          onClick={() => handleStartEdit(item)}
                          className="btn-icon-action"
                          title="Edit Catatan"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          onClick={() => handleDeleteIncome(item)}
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
