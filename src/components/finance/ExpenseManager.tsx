import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, AlertTriangle, ArrowUpRight, Coins, Wallet, Calendar, CreditCard, Clock, AlertCircle, Loader2 } from 'lucide-react';
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

interface ExpenseItem {
  id: string;
  description: string;
  amount: number;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  walletName: string;
  walletId: string;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  timeOfDay: 'pagi' | 'siang' | 'sore' | 'malam';
}

interface BudgetItem {
  id: string;
  name: string;
  limit: number;
  spent: number;
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

// Fallback Categories if no budget is configured
const fallbackCategories = [
  { id: 'f-makanan', name: 'Makanan & Jajan', icon: '🍔', color: '#0d9488' },
  { id: 'f-transport', name: 'Transportasi', icon: '🚗', color: '#3b82f6' },
  { id: 'f-tagihan', name: 'Tagihan Harian', icon: '💡', color: '#f97316' },
  { id: 'f-belanja', name: 'Belanja', icon: '🛍️', color: '#ec4899' },
  { id: 'f-hiburan', name: 'Hiburan & Hobi', icon: '🎬', color: '#a855f7' },
  { id: 'f-lainnya', name: 'Lain-lain', icon: '💸', color: '#64748b' }
];

// Fallback Wallets if no wallet is configured
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

// Helper for auto-detecting current time of day
const getDefaultTimeOfDay = (): 'pagi' | 'siang' | 'sore' | 'malam' => {
  const hr = new Date().getHours();
  if (hr >= 5 && hr < 11) return 'pagi';
  if (hr >= 11 && hr < 15) return 'siang';
  if (hr >= 15 && hr < 19) return 'sore';
  return 'malam';
};

export const ExpenseManager: React.FC = () => {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [originalEditingItem, setOriginalEditingItem] = useState<ExpenseItem | null>(null);

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
  const [categoryKey, setCategoryKey] = useState('');
  const [walletKey, setWalletKey] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [timeOfDay, setTimeOfDay] = useState<'pagi' | 'siang' | 'sore' | 'malam'>(() => {
    return getDefaultTimeOfDay();
  });

  // Dynamic budget list for the form's selected date's month
  const [formBudgets, setFormBudgets] = useState<BudgetItem[]>([]);

  // Load form budgets dynamically when transaction date changes
  useEffect(() => {
    fetchFormBudgets();
  }, [date, dbWarning]);

  const fetchFormBudgets = async () => {
    const monthKey = date.substring(0, 7);
    if (dbWarning) {
      const localBudgets = localStorage.getItem(`mock_budgets_${monthKey}`);
      if (localBudgets) {
        setFormBudgets(JSON.parse(localBudgets));
      } else {
        setFormBudgets([]);
      }
    } else {
      try {
        const { data, error } = await supabase
          .from('budgets')
          .select('*')
          .eq('month', monthKey)
          .order('created_at', { ascending: true });
        
        if (error) {
          console.warn('Error fetching budgets for form, fallback to local:', error.message);
          const localBudgets = localStorage.getItem(`mock_budgets_${monthKey}`);
          if (localBudgets) setFormBudgets(JSON.parse(localBudgets));
        } else if (data) {
          const mapped: BudgetItem[] = data.map(b => ({
            id: b.id,
            name: b.name,
            limit: parseFloat(b.limit_amount) || 0,
            spent: parseFloat(b.spent_amount) || 0,
            icon: b.icon,
            color: b.color
          }));
          setFormBudgets(mapped);
          localStorage.setItem(`mock_budgets_${monthKey}`, JSON.stringify(mapped));
        }
      } catch (err) {
        console.error('Error fetching budgets for form:', err);
      }
    }
  };

  // Load all data contexts on mount and date range updates
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
      if (!user) return;

      // 1. Fetch Wallets from DB
      const { data: walletsData, error: walletsError } = await supabase
        .from('wallets')
        .select('*')
        .order('created_at', { ascending: true });

      // 2. Fetch Expenses from DB
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (walletsError || expensesError) {
        const err = walletsError || expensesError;
        console.warn('Supabase fetch error, falling back to LocalStorage:', err?.message);
        if (err?.code === 'PGRST496' || err?.message.includes('relation "expenses" does not exist') || err?.message.includes('relation "wallets" does not exist')) {
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

        if (expensesData) {
          const mappedExpenses: ExpenseItem[] = expensesData.map(e => ({
            id: e.id,
            description: e.description,
            amount: parseFloat(e.amount) || 0,
            categoryName: e.category_name,
            categoryIcon: e.category_icon,
            categoryColor: e.category_color,
            walletId: e.wallet_id,
            walletName: e.wallet_name,
            date: e.date,
            month: e.month,
            timeOfDay: (e.time_of_day || 'siang') as any
          }));
          setExpenses(mappedExpenses);

          // Update LocalStorage cache by month keys
          const rangeMonths = getMonthsInRange(startDate, endDate);
          rangeMonths.forEach(m => {
            const mExpenses = mappedExpenses.filter(ex => ex.month === m);
            localStorage.setItem(`mock_expenses_${m}`, JSON.stringify(mExpenses));
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
    // 1. Load Wallets from cache
    const localWallets = localStorage.getItem('mock_wallets');
    let loadedWallets: WalletItem[] = [];
    if (localWallets) {
      loadedWallets = JSON.parse(localWallets);
    } else {
      loadedWallets = fallbackWallets;
      localStorage.setItem('mock_wallets', JSON.stringify(fallbackWallets));
    }
    setWallets(loadedWallets);

    // 2. Load and merge Expenses for all months in the date range
    const months = getMonthsInRange(startDate, endDate);
    let mergedExpenses: ExpenseItem[] = [];
    
    months.forEach((m) => {
      const localExpenses = localStorage.getItem(`mock_expenses_${m}`);
      if (localExpenses) {
        mergedExpenses = mergedExpenses.concat(JSON.parse(localExpenses));
      }
    });

    const filtered = mergedExpenses
      .filter((e) => e.date >= startDate && e.date <= endDate)
      .sort((a, b) => b.date.localeCompare(a.date));
      
    setExpenses(filtered);
  };

  // Helper to sync category spent and wallet balance in LocalStorage & Supabase
  const syncFinanceTotals = async (
    walletId: string,
    categoryName: string,
    amountDiff: number, // positive to increase spent/decrease wallet, negative to decrease spent/increase wallet
    expenseMonth: string
  ) => {
    // 1. Adjust LocalStorage Cache first
    const localWallets = localStorage.getItem('mock_wallets');
    if (localWallets) {
      const walletsList: WalletItem[] = JSON.parse(localWallets);
      const updatedWallets = walletsList.map(w => {
        if (w.id === walletId) {
          return { ...w, balance: Math.max(0, w.balance - amountDiff) };
        }
        return w;
      });
      localStorage.setItem('mock_wallets', JSON.stringify(updatedWallets));
    }

    const budgetKey = `mock_budgets_${expenseMonth}`;
    const localBudgets = localStorage.getItem(budgetKey);
    if (localBudgets) {
      const budgetsList: BudgetItem[] = JSON.parse(localBudgets);
      const updatedBudgets = budgetsList.map(b => {
        if (b.name === categoryName) {
          return { ...b, spent: Math.max(0, b.spent + amountDiff) };
        }
        return b;
      });
      localStorage.setItem(budgetKey, JSON.stringify(updatedBudgets));
    }

    // 2. Sync to Supabase Cloud Database if DB is active
    if (!dbWarning) {
      try {
        // Adjust Wallet Balance in DB
        const { data: wData, error: wError } = await supabase
          .from('wallets')
          .select('balance')
          .eq('id', walletId)
          .single();

        if (!wError && wData) {
          const currentBalance = parseFloat(wData.balance) || 0;
          const newBalance = Math.max(0, currentBalance - amountDiff);
          await supabase
            .from('wallets')
            .update({ balance: newBalance })
            .eq('id', walletId);
        }

        // Adjust Budget Spent in DB
        const { data: bData, error: bError } = await supabase
          .from('budgets')
          .select('id, spent_amount')
          .eq('name', categoryName)
          .eq('month', expenseMonth)
          .maybeSingle();

        if (!bError && bData) {
          const currentSpent = parseFloat(bData.spent_amount) || 0;
          const newSpent = Math.max(0, currentSpent + amountDiff);
          await supabase
            .from('budgets')
            .update({ spent_amount: newSpent })
            .eq('id', bData.id);
        }
      } catch (err: any) {
        console.error('Error syncing database financial totals:', err.message);
      }
    } else {
      // Direct UI state update for mockup warning mode
      const localWallets = localStorage.getItem('mock_wallets');
      if (localWallets) setWallets(JSON.parse(localWallets));
    }
  };

  const handleAddOrEditExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount || !categoryKey || !walletKey) return;

    setSubmitting(true);
    const parsedAmount = parseRupiahInput(amount);
    const targetMonth = date.substring(0, 7);
    
    // Find category details
    const activeBudgets = formBudgets.length > 0 ? formBudgets : fallbackCategories;
    const matchedCategory = activeBudgets.find(c => c.name === categoryKey || c.id === categoryKey);
    const catName = matchedCategory?.name || 'Lain-lain';
    const catIcon = matchedCategory?.icon || '💸';
    const catColor = matchedCategory?.color || '#64748b';

    // Find wallet details
    const matchedWallet = wallets.find(w => w.id === walletKey || w.name === walletKey);
    const wName = matchedWallet?.name || 'Tunai';
    const wId = matchedWallet?.id || 'w-cash';

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (dbWarning) {
        // Local mockup CRUD flow
        if (editingId && originalEditingItem) {
          // Reverse original transaction totals first
          syncFinanceTotals(
            originalEditingItem.walletId,
            originalEditingItem.categoryName,
            -originalEditingItem.amount,
            originalEditingItem.month
          );

          // Remove from original month list
          const origKey = `mock_expenses_${originalEditingItem.month}`;
          const origData = localStorage.getItem(origKey);
          const origList: ExpenseItem[] = origData ? JSON.parse(origData) : [];
          const cleanedList = origList.filter(ex => ex.id !== editingId);
          localStorage.setItem(origKey, JSON.stringify(cleanedList));

          // Save new updated item
          const updatedItem: ExpenseItem = {
            id: editingId,
            description,
            amount: parsedAmount,
            categoryName: catName,
            categoryIcon: catIcon,
            categoryColor: catColor,
            walletName: wName,
            walletId: wId,
            date,
            month: targetMonth,
            timeOfDay
          };
          const targetKey = `mock_expenses_${targetMonth}`;
          const targetData = localStorage.getItem(targetKey);
          const targetList: ExpenseItem[] = targetData ? JSON.parse(targetData) : [];
          localStorage.setItem(targetKey, JSON.stringify([...targetList, updatedItem]));

          // Apply updated values
          syncFinanceTotals(wId, catName, parsedAmount, targetMonth);
        } else {
          // Add mode
          const newExpense: ExpenseItem = {
            id: 'expense-' + Date.now(),
            description,
            amount: parsedAmount,
            categoryName: catName,
            categoryIcon: catIcon,
            categoryColor: catColor,
            walletName: wName,
            walletId: wId,
            date,
            month: targetMonth,
            timeOfDay
          };
          const targetKey = `mock_expenses_${targetMonth}`;
          const targetData = localStorage.getItem(targetKey);
          const targetList: ExpenseItem[] = targetData ? JSON.parse(targetData) : [];
          localStorage.setItem(targetKey, JSON.stringify([...targetList, newExpense]));

          syncFinanceTotals(wId, catName, parsedAmount, targetMonth);
        }
        resetForm();
        loadLocalDataContexts();
      } else {
        // Real Supabase DB CRUD flow
        if (editingId && originalEditingItem) {
          // 1. Reverse original in DB
          await syncFinanceTotals(
            originalEditingItem.walletId,
            originalEditingItem.categoryName,
            -originalEditingItem.amount,
            originalEditingItem.month
          );

          // 2. Update in DB
          const { error } = await supabase
            .from('expenses')
            .update({
              description,
              amount: parsedAmount,
              category_name: catName,
              category_icon: catIcon,
              category_color: catColor,
              wallet_id: wId,
              wallet_name: wName,
              date,
              month: targetMonth,
              time_of_day: timeOfDay
            })
            .eq('id', editingId);

          if (error) throw error;

          // 3. Apply new in DB
          await syncFinanceTotals(wId, catName, parsedAmount, targetMonth);
        } else {
          // Add mode in DB
          const { error } = await supabase
            .from('expenses')
            .insert({
              user_id: user.id,
              description,
              amount: parsedAmount,
              category_name: catName,
              category_icon: catIcon,
              category_color: catColor,
              wallet_id: wId,
              wallet_name: wName,
              date,
              month: targetMonth,
              time_of_day: timeOfDay
            });

          if (error) throw error;

          // Apply values
          await syncFinanceTotals(wId, catName, parsedAmount, targetMonth);
        }
        resetForm();
        await loadDataContexts();
      }
    } catch (err: any) {
      alert('Gagal menyimpan transaksi: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (item: ExpenseItem) => {
    setEditingId(item.id);
    setOriginalEditingItem(item);
    setDescription(item.description);
    setAmount(formatRupiahInput(item.amount.toString()));
    
    // Match category key
    setCategoryKey(item.categoryName);
    setWalletKey(item.walletId);
    setDate(item.date);
    setTimeOfDay(item.timeOfDay || 'siang');
    setShowAddForm(true);
  };

  const handleDeleteExpense = async (item: ExpenseItem) => {
    if (!confirm('Apakah Anda yakin ingin menghapus catatan pengeluaran ini?')) return;

    setSubmitting(true);
    try {
      if (dbWarning || item.id.startsWith('expense-')) {
        // Local mockup delete
        syncFinanceTotals(item.walletId, item.categoryName, -item.amount, item.month);
        const monthKey = item.month;
        const localData = localStorage.getItem(`mock_expenses_${monthKey}`);
        if (localData) {
          const list: ExpenseItem[] = JSON.parse(localData);
          const updatedList = list.filter(ex => ex.id !== item.id);
          localStorage.setItem(`mock_expenses_${monthKey}`, JSON.stringify(updatedList));
        }
        loadLocalDataContexts();
      } else {
        // Real DB delete
        // 1. Reverse balance and spent limits
        await syncFinanceTotals(item.walletId, item.categoryName, -item.amount, item.month);

        // 2. Delete from DB
        const { error } = await supabase
          .from('expenses')
          .delete()
          .eq('id', item.id);

        if (error) throw error;

        await loadDataContexts();
      }
    } catch (err: any) {
      alert('Gagal menghapus transaksi: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCategoryKey('');
    setWalletKey('');
    
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setDate(`${y}-${m}-${day}`);

    setTimeOfDay(getDefaultTimeOfDay());
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

  // Preset functions
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

  // Calculations for summary boxes
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

  const getLargestExpense = () => {
    if (expenses.length === 0) return null;
    return expenses.reduce((prev, curr) => (prev.amount > curr.amount ? prev : curr));
  };

  const getDailyAverage = () => {
    if (expenses.length === 0) return 0;
    // Calculate number of unique days between startDate and endDate
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.round(totalSpent / diffDays);
  };

  // Grouping expenses by Date (sorted descending)
  const getGroupedExpenses = () => {
    const groups: { [key: string]: ExpenseItem[] } = {};
    expenses.forEach((e) => {
      if (!groups[e.date]) {
        groups[e.date] = [];
      }
      groups[e.date].push(e);
    });

    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((dateStr) => {
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

  const largestExpense = getLargestExpense();
  const activeBudgetsList = formBudgets.length > 0 ? formBudgets : fallbackCategories;
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
    return expenses
      .filter(e => e.date === dateStr)
      .reduce((sum, e) => sum + e.amount, 0);
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
        label: 'Pengeluaran',
        data: dailyAmounts,
        borderColor: '#0d9488',
        backgroundColor: 'rgba(13, 148, 136, 0.06)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointBackgroundColor: '#0d9488',
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
            return `Pengeluaran: ${formatCurrency(context.raw)}`;
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

  // 2. Category Distribution Doughnut Chart
  const categoryTotals: { [key: string]: { amount: number; color: string; icon: string } } = {};
  expenses.forEach(e => {
    if (!categoryTotals[e.categoryName]) {
      categoryTotals[e.categoryName] = { amount: 0, color: e.categoryColor, icon: e.categoryIcon };
    }
    categoryTotals[e.categoryName].amount += e.amount;
  });

  const categoryLabels = Object.keys(categoryTotals);
  const categoryData = categoryLabels.map(cat => categoryTotals[cat].amount);
  const categoryColors = categoryLabels.map(cat => categoryTotals[cat].color);

  const categoryChartData = {
    labels: categoryLabels.map(cat => `${categoryTotals[cat].icon} ${cat}`),
    datasets: [
      {
        data: categoryData,
        backgroundColor: categoryColors.length > 0 ? categoryColors : ['#0d9488'],
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

  // 3. Payment Methods Horizontal Bar Chart
  const walletTotals: { [key: string]: number } = {};
  expenses.forEach(e => {
    if (!walletTotals[e.walletName]) {
      walletTotals[e.walletName] = 0;
    }
    walletTotals[e.walletName] += e.amount;
  });

  const walletLabels = Object.keys(walletTotals);
  const walletData = walletLabels.map(w => walletTotals[w]);
  
  const walletColors = walletLabels.map(label => {
    const w = wallets.find(wal => wal.name === label);
    if (w) {
      if (w.color === 'teal') return '#0d9488';
      if (w.color === 'blue') return '#3b82f6';
      if (w.color === 'indigo') return '#6366f1';
      if (w.color === 'amber') return '#f59e0b';
      if (w.color === 'rose') return '#f43f5e';
      if (w.color === 'dark') return '#475569';
    }
    return '#0d9488';
  });

  const walletChartData = {
    labels: walletLabels,
    datasets: [
      {
        label: 'Total Pengeluaran (Rp)',
        data: walletData,
        backgroundColor: walletColors.length > 0 ? walletColors : ['#3b82f6'],
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
            return ` Pengeluaran: ${formatCurrency(context.raw)}`;
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
        <p>Memuat catatan pengeluaran...</p>
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
              Tabel <code>expenses</code> belum dibuat di database Supabase Anda. 
              Data saat ini disimpan di penyimpanan lokal browser Anda agar tetap bisa diuji coba. 
              Silakan jalankan SQL schema yang tertera di walkthrough untuk sinkronisasi cloud penuh.
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="budget-summary-grid">
        {/* Total Spent */}
        <div className="glass-card summary-card budget-spent exceeded">
          <div className="summary-card-content">
            <span className="summary-label">Total Belanja (Filter)</span>
            <h4>{formatCurrency(totalSpent)}</h4>
          </div>
          <div className="summary-icon-wrapper">
            <ArrowUpRight size={22} />
          </div>
        </div>

        {/* Largest Expense */}
        <div className="glass-card summary-card budget-total">
          <div className="summary-card-content">
            <span className="summary-label">Belanja Terbesar</span>
            <h4>
              {largestExpense ? (
                <>
                  <span style={{ marginRight: 4 }}>{largestExpense.categoryIcon}</span>
                  {formatCurrency(largestExpense.amount)}
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
        <div className="glass-card summary-card budget-remaining">
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

      {/* Visual Charts Dashboard Grid */}
      {expenses.length > 0 && (
        <div className="charts-dashboard-grid">
          {/* Card 1: Tren Belanja (Full Width) */}
          <div className="glass-card chart-card chart-card-full">
            <div className="chart-card-header">
              <Clock size={16} className="chart-card-icon" />
              <h4>Tren Belanja Harian</h4>
            </div>
            <div className="chart-card-body">
              <div className="chart-canvas-wrapper">
                <Line data={trendChartData} options={lineOptions} />
              </div>
            </div>
          </div>

          {/* Card 2: Kategori Anggaran (Half Width) */}
          <div className="glass-card chart-card">
            <div className="chart-card-header">
              <Coins size={16} className="chart-card-icon" />
              <h4>Distribusi Anggaran</h4>
            </div>
            <div className="chart-card-body">
              <div className="chart-canvas-wrapper doughnut-wrapper">
                <Doughnut data={categoryChartData} options={doughnutOptions} />
              </div>
            </div>
          </div>

          {/* Card 3: Metode Pembayaran (Half Width) */}
          <div className="glass-card chart-card">
            <div className="chart-card-header">
              <Wallet size={16} className="chart-card-icon" />
              <h4>Metode Pembayaran</h4>
            </div>
            <div className="chart-card-body">
              <div className="chart-canvas-wrapper">
                <Bar data={walletChartData} options={barOptions} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List Header */}
      <div className="budget-list-header" style={{ marginTop: '0.5rem' }}>
        <div className="budget-header-title-area">
          <h3>Riwayat Pengeluaran</h3>
          <span className="total-items-tag">{expenses.length} Transaksi</span>
        </div>
        {!showAddForm && (
          <button 
            onClick={() => {
              const today = new Date();
              const y = today.getFullYear();
              const m = String(today.getMonth() + 1).padStart(2, '0');
              const d = String(today.getDate()).padStart(2, '0');
              setDate(`${y}-${m}-${d}`);
              setTimeOfDay(getDefaultTimeOfDay());

              if (activeBudgetsList.length > 0) setCategoryKey(activeBudgetsList[0].name || activeBudgetsList[0].id);
              if (activeWalletsList.length > 0) setWalletKey(activeWalletsList[0].id);
              
              setShowAddForm(true);
            }} 
            className="btn btn-primary"
          >
            <Plus size={18} />
            <span>Catat Pengeluaran Baru</span>
          </button>
        )}
      </div>

      {/* Add / Edit Expense Form */}
      {showAddForm && (
        <div className="budget-form-container glass-card animate-slide-down">
          <div className="form-header">
            <h4>{editingId ? 'Edit Catatan Pengeluaran' : 'Catat Pengeluaran Baru'}</h4>
            <button onClick={resetForm} className="btn-close-form">Batal</button>
          </div>

          <form onSubmit={handleAddOrEditExpense} className="budget-form-grid">
            {/* Description */}
            <div className="form-group">
              <label className="form-label">Keterangan / Catatan</label>
              <input
                type="text"
                className="form-input"
                placeholder="Contoh: Beli Kopi Susu, Bensin Motor"
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

            {/* Time of Day */}
            <div className="form-group span-full">
              <label className="form-label">Waktu Transaksi</label>
              <div className="time-of-day-grid">
                {[
                  { id: 'pagi', label: 'Pagi', emoji: '🌅', desc: '05:00 - 11:00' },
                  { id: 'siang', label: 'Siang', emoji: '☀️', desc: '11:00 - 15:00' },
                  { id: 'sore', label: 'Sore', emoji: '🌤️', desc: '15:00 - 19:00' },
                  { id: 'malam', label: 'Malam', emoji: '🌙', desc: '19:00 - 05:00' }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className={`time-preset-card ${timeOfDay === item.id ? 'selected' : ''}`}
                    onClick={() => setTimeOfDay(item.id as any)}
                  >
                    <span className="time-card-emoji">{item.emoji}</span>
                    <div className="time-card-text">
                      <span className="time-card-label">{item.label}</span>
                      <span className="time-card-desc">{item.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Nominal */}
            <div className="form-group">
              <label className="form-label">Nominal Pengeluaran</label>
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

            {/* Category Select */}
            <div className="form-group">
              <label className="form-label">Pilih Kategori Anggaran</label>
              <select
                value={categoryKey}
                onChange={(e) => setCategoryKey(e.target.value)}
                className="form-input select-input"
                required
              >
                <option value="" disabled>-- Pilih Kategori --</option>
                {activeBudgetsList.map(c => (
                  <option key={c.id} value={c.name || c.id}>
                    {c.icon || '💸'} {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Wallet Select */}
            <div className="form-group">
              <label className="form-label">Rekening Pembayaran (Dompet)</label>
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
                  <option value="" disabled>-- Pilih Rekening --</option>
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
                {submitting ? <Loader2 className="spinner animate-spin" size={16} /> : <span>{editingId ? 'Update Transaksi' : 'Simpan Transaksi'}</span>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Transaction List */}
      {expenses.length === 0 ? (
        <div className="budget-empty-state glass-card">
          <div className="icon-circle">💸</div>
          <h3>Belum Ada Transaksi</h3>
          <p>Belum ada catatan pengeluaran uang untuk rentang tanggal terpilih.</p>
          <button 
            onClick={() => {
              const today = new Date();
              const y = today.getFullYear();
              const m = String(today.getMonth() + 1).padStart(2, '0');
              const d = String(today.getDate()).padStart(2, '0');
              setDate(`${y}-${m}-${d}`);
              setTimeOfDay(getDefaultTimeOfDay());
              
              if (activeBudgetsList.length > 0) setCategoryKey(activeBudgetsList[0].name || activeBudgetsList[0].id);
              if (activeWalletsList.length > 0) setWalletKey(activeWalletsList[0].id);
              
              setShowAddForm(true);
            }} 
            className="btn btn-primary"
            disabled={activeWalletsList.length === 0}
          >
            <Plus size={16} />
            <span>Catat Pengeluaran Pertama</span>
          </button>
        </div>
      ) : (
        <div className="expenses-history-list">
          {getGroupedExpenses().map(group => (
            <div key={group.date} className="expense-date-group">
              <div className="expense-date-header">
                <h5>{formatHeaderDate(group.date)}</h5>
                <span className="daily-total-badge">{formatCurrency(group.dailyTotal)}</span>
              </div>
              
              <div className="expense-group-items">
                {group.items.map(item => (
                  <div key={item.id} className="expense-item-row glass-card">
                    <div className="item-left-block">
                      <span className="category-emoji-badge" style={{ backgroundColor: `${item.categoryColor}15`, borderColor: `${item.categoryColor}30` }}>
                        {item.categoryIcon}
                      </span>
                      <div className="item-meta-info">
                        <h6>{item.description}</h6>
                        <div className="meta-tags-row">
                          <span className="item-category-tag" style={{ color: item.categoryColor }}>{item.categoryName}</span>
                          <span className={`time-badge-pill time-badge-${item.timeOfDay || 'siang'}`}>
                            {item.timeOfDay === 'pagi' ? '🌅 Pagi' :
                             item.timeOfDay === 'siang' ? '☀️ Siang' :
                             item.timeOfDay === 'sore' ? '🌤️ Sore' : '🌙 Malam'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="item-right-block">
                      <span className="payment-badge-pill">
                        <CreditCard size={12} style={{ marginRight: 4 }} />
                        {item.walletName}
                      </span>
                      
                      <span className="transaction-amount-minus">
                        - {formatCurrency(item.amount)}
                      </span>

                      <div className="row-action-buttons">
                        <button 
                          onClick={() => handleStartEdit(item)}
                          className="btn-icon-action"
                          title="Edit Catatan"
                          disabled={submitting}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          onClick={() => handleDeleteExpense(item)}
                          className="btn-icon-action btn-delete-action"
                          title="Hapus Catatan"
                          disabled={submitting}
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
