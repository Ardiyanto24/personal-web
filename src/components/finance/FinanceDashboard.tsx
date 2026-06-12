import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { 
  Coins, 
  Wallet as WalletIcon, 
  TrendingUp, 
  Loader2, 
  AlertCircle
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface WalletItem {
  id: string;
  name: string;
  bank_name: string;
  balance: number;
  color: string;
}

interface BudgetItem {
  id: string;
  name: string;
  limit: number;
  spent: number;
  icon: string;
  color: string;
}

interface IncomeItem {
  id: string;
  description: string;
  amount: number;
  sourceName: string;
  sourceIcon: string;
  sourceColor: string;
  walletName: string;
  walletId: string;
  date: string;
  month: string;
}

interface ExpenseItem {
  id: string;
  description: string;
  amount: number;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  walletName: string;
  walletId: string;
  date: string;
  month: string;
}

interface DebtItem {
  id: string;
  type: 'debt' | 'receivable';
  person: string;
  description: string;
  amount: number;
  due_date?: string;
  status: 'pending' | 'paid';
  wallet_id?: string;
  wallet_name?: string;
  created_at?: string;
}

const monthsIndo = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const FinanceDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dbWarning, setDbWarning] = useState(false);

  // Data states
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [incomes, setIncomes] = useState<IncomeItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [debts, setDebts] = useState<DebtItem[]>([]);

  // Selected Month (default to current month)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  const getMonthStartAndEnd = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start, end };
  };

  useEffect(() => {
    loadDashboardData();
  }, [selectedMonth]);

  const loadDashboardData = async () => {
    setLoading(true);
    setDbWarning(false);
    const { start, end } = getMonthStartAndEnd(selectedMonth);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        loadLocalDashboardData();
        setLoading(false);
        return;
      }

      // Fetch all required tables in parallel
      const [
        walletsRes,
        budgetsRes,
        incomesRes,
        expensesRes,
        debtsRes
      ] = await Promise.all([
        supabase.from('wallets').select('*').order('created_at', { ascending: true }),
        supabase.from('budgets').select('*').eq('month', selectedMonth).order('created_at', { ascending: true }),
        supabase.from('incomes').select('*').gte('date', start).lte('date', end).order('date', { ascending: false }),
        supabase.from('expenses').select('*').gte('date', start).lte('date', end).order('date', { ascending: false }),
        supabase.from('debts').select('*').order('created_at', { ascending: false })
      ]);

      const hasDBError = walletsRes.error || budgetsRes.error || incomesRes.error || expensesRes.error || debtsRes.error;
      
      if (hasDBError) {
        console.warn('DB error occurred, falling back to LocalStorage:', walletsRes.error || budgetsRes.error || incomesRes.error || expensesRes.error || debtsRes.error);
        setDbWarning(true);
        loadLocalDashboardData();
      } else {
        if (walletsRes.data) setWallets(walletsRes.data);
        if (budgetsRes.data) {
          const mapped: BudgetItem[] = budgetsRes.data.map(b => ({
            id: b.id,
            name: b.name,
            limit: parseFloat(b.limit_amount) || 0,
            spent: parseFloat(b.spent_amount) || 0,
            icon: b.icon,
            color: b.color
          }));
          setBudgets(mapped);
        }
        if (incomesRes.data) {
          const mapped: IncomeItem[] = incomesRes.data.map(i => ({
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
          setIncomes(mapped);
        }
        if (expensesRes.data) {
          const mapped: ExpenseItem[] = expensesRes.data.map(e => ({
            id: e.id,
            description: e.description,
            amount: parseFloat(e.amount) || 0,
            categoryName: e.category_name,
            categoryIcon: e.category_icon,
            categoryColor: e.category_color,
            walletId: e.wallet_id,
            walletName: e.wallet_name,
            date: e.date,
            month: e.month
          }));
          setExpenses(mapped);
        }
        if (debtsRes.data) setDebts(debtsRes.data);
      }
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err.message);
      setDbWarning(true);
      loadLocalDashboardData();
    } finally {
      setLoading(false);
    }
  };

  const loadLocalDashboardData = () => {
    const { start, end } = getMonthStartAndEnd(selectedMonth);

    // 1. Wallets
    const localWallets = localStorage.getItem('mock_wallets');
    setWallets(localWallets ? JSON.parse(localWallets) : []);

    // 2. Budgets
    const localBudgets = localStorage.getItem(`mock_budgets_${selectedMonth}`);
    setBudgets(localBudgets ? JSON.parse(localBudgets) : []);

    // 3. Incomes
    const localIncomes = localStorage.getItem(`mock_incomes_${selectedMonth}`);
    const parsedIncomes: IncomeItem[] = localIncomes ? JSON.parse(localIncomes) : [];
    setIncomes(parsedIncomes.filter(i => i.date >= start && i.date <= end));

    // 4. Expenses
    const localExpenses = localStorage.getItem(`mock_expenses_${selectedMonth}`);
    const parsedExpenses: ExpenseItem[] = localExpenses ? JSON.parse(localExpenses) : [];
    setExpenses(parsedExpenses.filter(e => e.date >= start && e.date <= end));

    // 5. Debts
    const localDebts = localStorage.getItem('mock_debts');
    setDebts(localDebts ? JSON.parse(localDebts) : []);
  };

  // Metric computations
  const totalNetWorth = wallets.reduce((sum, w) => sum + w.balance, 0);
  const totalIncomes = incomes.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  
  const totalBudgetLimit = budgets.reduce((sum, b) => sum + b.limit, 0);
  const totalBudgetSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
  const totalBudgetRemaining = Math.max(0, totalBudgetLimit - totalBudgetSpent);

  const pendingHutang = debts
    .filter(d => d.type === 'debt' && d.status === 'pending')
    .reduce((sum, d) => sum + d.amount, 0);

  const pendingPiutang = debts
    .filter(d => d.type === 'receivable' && d.status === 'pending')
    .reduce((sum, d) => sum + d.amount, 0);

  const netDebtPosition = pendingPiutang - pendingHutang;

  // Prepare dual curves Line Chart
  const getDatesInMonthList = (monthStr: string): string[] => {
    const [year, month] = monthStr.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const dates: string[] = [];
    for (let d = 1; d <= lastDay; d++) {
      const dayStr = String(d).padStart(2, '0');
      dates.push(`${year}-${String(month).padStart(2, '0')}-${dayStr}`);
    }
    return dates;
  };

  const datesList = getDatesInMonthList(selectedMonth);
  const dailyIncomes = datesList.map(dateStr => 
    incomes.filter(i => i.date === dateStr).reduce((sum, i) => sum + i.amount, 0)
  );
  const dailyExpenses = datesList.map(dateStr => 
    expenses.filter(e => e.date === dateStr).reduce((sum, e) => sum + e.amount, 0)
  );

  const formatChartDateLabel = (dateStr: string) => {
    const [,, dStr] = dateStr.split('-');
    return `${parseInt(dStr, 10)}`;
  };
  const chartLabels = datesList.map(formatChartDateLabel);

  const cashFlowChartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Pemasukan',
        data: dailyIncomes,
        borderColor: '#10b981', // emerald green
        backgroundColor: 'rgba(16, 185, 129, 0.03)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointBackgroundColor: '#10b981',
        borderWidth: 2.5
      },
      {
        label: 'Pengeluaran',
        data: dailyExpenses,
        borderColor: '#ef4444', // red
        backgroundColor: 'rgba(239, 68, 68, 0.03)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointBackgroundColor: '#ef4444',
        borderWidth: 2.5
      }
    ]
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        display: true, 
        position: 'top' as const,
        labels: {
          color: '#334155',
          font: { size: 10, weight: 'bold' as const },
          usePointStyle: true,
          pointStyle: 'circle' as const
        }
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleFont: { size: 12, weight: 'bold' as const },
        bodyFont: { size: 11 },
        padding: 10,
        cornerRadius: 6,
        callbacks: {
          label: (context: any) => {
            return ` ${context.dataset.label}: ${formatCurrency(context.raw)}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: '#64748b', font: { size: 9 } }
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

  const getRecentActivities = () => {
    const activities: any[] = [];
    
    incomes.forEach(i => {
      activities.push({
        id: 'inc-' + i.id,
        date: i.date,
        type: 'income',
        title: i.description,
        subtitle: i.sourceIcon + ' ' + i.sourceName,
        wallet: i.walletName,
        amount: i.amount,
        color: 'var(--accent-success)'
      });
    });

    expenses.forEach(e => {
      activities.push({
        id: 'exp-' + e.id,
        date: e.date,
        type: 'expense',
        title: e.description,
        subtitle: e.categoryIcon + ' ' + e.categoryName,
        wallet: e.walletName,
        amount: -e.amount,
        color: 'var(--accent-danger)'
      });
    });

    debts.forEach(d => {
      const dDate = d.created_at ? d.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10);
      activities.push({
        id: 'debt-' + d.id,
        date: dDate,
        type: d.status === 'paid' ? 'debt_paid' : d.type === 'debt' ? 'debt_pending' : 'receivable_pending',
        title: d.description,
        subtitle: d.type === 'debt' 
          ? `🔴 Hutang ke ${d.person} (${d.status === 'paid' ? 'Lunas' : 'Belum Lunas'})` 
          : `🟢 Piutang pada ${d.person} (${d.status === 'paid' ? 'Lunas' : 'Belum Lunas'})`,
        wallet: d.wallet_name || 'Hanya Catatan',
        amount: d.type === 'debt' ? -d.amount : d.amount,
        color: d.type === 'debt' ? 'var(--accent-danger)' : 'var(--accent-success)'
      });
    });

    return activities
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val);
  };

  const formatMonthDisplay = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    return `${monthsIndo[parseInt(month, 10) - 1]} ${year}`;
  };

  const handleMonthChange = (offset: number) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const dateObj = new Date(year, month - 1 + offset, 1);
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${y}-${m}`);
  };

  if (loading) {
    return (
      <div className="loading-state">
        <Loader2 className="spinner text-primary animate-spin" size={32} />
        <p>Memuat ringkasan dashboard...</p>
      </div>
    );
  }

  return (
    <div className="budget-manager-view">
      {/* Database Warning Banner */}
      {dbWarning && (
        <div className="db-warning-alert glass-card">
          <AlertCircle className="warning-icon" />
          <div className="warning-text">
            <h5>Pemberitahuan Database</h5>
            <p>
              Tabel database belum terhubung secara penuh. 
              Sistem menampilkan ringkasan data finansial Anda yang tersimpan secara lokal.
            </p>
          </div>
        </div>
      )}

      {/* Date Navigation Controls */}
      <div className="date-filter-section glass-card" style={{ padding: '1rem 1.5rem', marginBottom: '0.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <button onClick={() => handleMonthChange(-1)} className="btn btn-secondary btn-sm" style={{ padding: '0.5rem 1rem' }}>
            &larr; Bulan Lalu
          </button>
          <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{formatMonthDisplay(selectedMonth)}</h3>
          <button onClick={() => handleMonthChange(1)} className="btn btn-secondary btn-sm" style={{ padding: '0.5rem 1rem' }}>
            Bulan Depan &rarr;
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="budget-summary-grid">
        {/* Total Wealth */}
        <div className="glass-card summary-card budget-remaining" style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0ea5e9 100%)', borderColor: 'rgba(13, 148, 136, 0.15)' }}>
          <div className="summary-card-content">
            <span className="summary-label" style={{ color: 'rgba(255,255,255,0.85)' }}>Kekayaan Bersih (Rekening)</span>
            <h4 style={{ color: 'white' }}>{formatCurrency(totalNetWorth)}</h4>
          </div>
          <div className="summary-icon-wrapper" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <WalletIcon size={22} style={{ color: 'white' }} />
          </div>
        </div>

        {/* Cash Flow Summary */}
        <div className="glass-card summary-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="summary-label">Arus Kas (Bulan Ini)</span>
            <TrendingUp size={16} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Pemasukan:</span>
              <span style={{ color: 'var(--accent-success)', fontWeight: 700 }}>+ {formatCurrency(totalIncomes)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Pengeluaran:</span>
              <span style={{ color: 'var(--accent-danger)', fontWeight: 700 }}>- {formatCurrency(totalExpenses)}</span>
            </div>
          </div>
        </div>

        {/* Budgets & Debts Remainder */}
        <div className="glass-card summary-card budget-total" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', borderColor: 'rgba(99, 102, 241, 0.15)' }}>
          <div className="summary-card-content">
            <span className="summary-label" style={{ color: 'rgba(255,255,255,0.85)' }}>Hutang Piutang Bersih</span>
            <h4 style={{ color: 'white' }}>
              {netDebtPosition >= 0 ? '+' : ''} {formatCurrency(netDebtPosition)}
            </h4>
          </div>
          <div className="summary-icon-wrapper" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <Coins size={22} style={{ color: 'white' }} />
          </div>
        </div>
      </div>

      {/* Main Graph Card */}
      <div className="glass-card chart-card chart-card-full">
        <div className="chart-card-header">
          <TrendingUp size={16} className="chart-card-icon" />
          <h4>Tren Arus Kas (Pemasukan vs Pengeluaran Harian)</h4>
        </div>
        <div className="chart-card-body">
          <div className="chart-canvas-wrapper" style={{ height: '220px' }}>
            <Line data={cashFlowChartData} options={lineOptions} />
          </div>
        </div>
      </div>

      {/* Two Column Section: Budget Health & Recent Transactions */}
      <div className="charts-dashboard-grid" style={{ marginTop: '0.5rem' }}>
        {/* Budget Health Column */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '1rem', margin: 0 }}>Kesehatan Anggaran (Bulan Ini)</h4>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {budgets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Belum ada anggaran belanja yang diatur untuk bulan ini.
              </div>
            ) : (
              budgets.slice(0, 4).map(b => {
                const percentage = b.limit > 0 ? Math.min(100, Math.round((b.spent / b.limit) * 100)) : 0;
                const isOver = b.spent > b.limit;
                
                let progressColor = 'var(--accent-success)';
                if (percentage >= 70 && percentage < 100) progressColor = 'var(--accent-warning)';
                if (percentage >= 100) progressColor = 'var(--accent-danger)';

                return (
                  <div key={b.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>{b.icon}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.name}</span>
                      </div>
                      <span style={{ color: isOver ? 'var(--accent-danger)' : 'var(--text-secondary)', fontWeight: 700 }}>
                        {formatCurrency(b.spent)} / {formatCurrency(b.limit)}
                      </span>
                    </div>
                    <div className="progress-bar-container" style={{ height: 6, background: 'rgba(0,0,0,0.04)', borderRadius: 99, overflow: 'hidden' }}>
                      <div 
                        className="progress-bar-fill" 
                        style={{ 
                          width: `${percentage}%`, 
                          background: progressColor, 
                          height: '100%',
                          borderRadius: 99
                        }} 
                      />
                    </div>
                  </div>
                );
              })
            )}
            
            {budgets.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0 0 0', borderTop: '1px dashed var(--border-color)', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Sisa Keseluruhan Anggaran:</span>
                <span style={{ color: 'var(--accent-success)', fontWeight: 700 }}>{formatCurrency(totalBudgetRemaining)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activities Column */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '1rem', margin: 0 }}>Aktivitas Finansial Terbaru</h4>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {getRecentActivities().length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Belum ada transaksi terekam pada bulan ini.
              </div>
            ) : (
              getRecentActivities().map(activity => (
                <div key={activity.id} className="expense-item-row glass-card" style={{ padding: '0.65rem 0.85rem', marginBottom: 0, borderRadius: 'var(--radius-sm)' }}>
                  <div className="item-left-block" style={{ gap: '0.65rem' }}>
                    <span 
                      className="category-emoji-badge" 
                      style={{ 
                        width: '28px', 
                        height: '28px', 
                        fontSize: '0.9rem',
                        backgroundColor: activity.type === 'income' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                        borderColor: 'transparent'
                      }}
                    >
                      {activity.type === 'income' ? '📥' : '📤'}
                    </span>
                    <div className="item-meta-info">
                      <h6 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>{activity.title}</h6>
                      <span className="item-category-tag" style={{ fontSize: '0.7rem', color: activity.color }}>
                        {activity.subtitle}
                      </span>
                    </div>
                  </div>

                  <div className="item-right-block" style={{ gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: activity.amount >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                      {activity.amount >= 0 ? '+' : ''} {formatCurrency(activity.amount)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
