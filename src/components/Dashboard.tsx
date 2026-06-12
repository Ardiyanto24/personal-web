import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  Wallet, 
  Briefcase, 
  CheckCircle, 
  FolderGit2, 
  LogOut, 
  User as UserIcon, 
  Sparkles,
  ArrowLeft,
  LayoutDashboard,
  ArrowDownLeft,
  ArrowUpRight,
  PieChart,
  Receipt,
  TrendingUp,
  Clock,
  Flame,
  Layers,
  Menu,
  X
} from 'lucide-react';
import { WalletManager } from './finance/WalletManager';
import { BudgetManager } from './finance/BudgetManager';
import { ExpenseManager } from './finance/ExpenseManager';
import { IncomeManager } from './finance/IncomeManager';
import { DebtManager } from './finance/DebtManager';
import { FinanceDashboard } from './finance/FinanceDashboard';

interface DashboardProps {
  onLogout: () => void;
}

type ViewType = 'menu' | 'finance' | 'work' | 'habits' | 'projects';
type FinanceTabType = 'dashboard' | 'income' | 'expense' | 'wallet' | 'budget' | 'debt';

const financeTabs = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'income', label: 'Pemasukan', icon: ArrowDownLeft },
  { id: 'expense', label: 'Pengeluaran', icon: ArrowUpRight },
  { id: 'wallet', label: 'Dompet', icon: Wallet },
  { id: 'budget', label: 'Anggaran', icon: PieChart },
  { id: 'debt', label: 'Hutang', icon: Receipt },
] as const;

export const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const [currentView, setCurrentView] = useState<ViewType>('menu');
  const [activeFinanceTab, setActiveFinanceTab] = useState<FinanceTabType>('dashboard');
  const [financeSidebarCollapsed, setFinanceSidebarCollapsed] = useState(false);
  const [financeMobileOpen, setFinanceMobileOpen] = useState(false);
  const [displayName, setDisplayName] = useState('User');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // 1. Try to read from Auth Metadata first
          const metaName = user.user_metadata?.full_name || user.user_metadata?.name;
          if (metaName) {
            setDisplayName(metaName);
          }
          
          // 2. Fetch from database profiles table as secondary source
          const { data, error } = await supabase
            .from('profiles')
            .select('full_name, username')
            .eq('id', user.id)
            .maybeSingle();

          if (!error && data) {
            if (data.full_name) {
              setDisplayName(data.full_name);
            } else if (data.username) {
              setDisplayName(data.username);
            }
          }
        }
      } catch (err) {
        console.error('Gagal mengambil data profil:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  const renderBackButton = () => (
    <button onClick={() => setCurrentView('menu')} className="btn btn-secondary back-btn">
      <ArrowLeft size={16} />
      <span>Kembali ke Menu Utama</span>
    </button>
  );

  return (
    <div className="dashboard-wrapper menu-mode">
      <div className="ambient-glow" />
      
      {/* Top Navbar - visible only on main hubs selection */}
      {currentView === 'menu' && (
        <header className="dashboard-top-nav glass-container">
          <div className="nav-brand" onClick={() => setCurrentView('menu')} style={{ cursor: 'pointer' }}>
            <Sparkles className="brand-logo-icon" />
            <span>Chronicle</span>
          </div>
          
          <div className="nav-user-actions">
            <div className="nav-user-profile">
              <div className="user-avatar">
                <UserIcon size={14} />
              </div>
              <span className="user-name">{loading ? 'Memuat...' : displayName}</span>
            </div>
            <button onClick={handleSignOut} className="btn-nav-logout" title="Keluar Akun">
              <LogOut size={18} />
            </button>
          </div>
        </header>
      )}

      {/* Main Container */}
      <main className={currentView === 'finance' ? '' : 'dashboard-container'}>
        {currentView === 'menu' && (
          <div className="menu-selection-view">
            <div className="menu-welcome-section">
              <span className="welcome-tag">Personal Journaling Hub</span>
              <h1>Halo, {loading ? 'Memuat...' : displayName}! 👋</h1>
              <p>Pilih aktivitas atau catatan yang ingin Anda kelola hari ini.</p>
            </div>

            <div className="menu-grid">
              {/* Card Keuangan */}
              <div className="menu-card glass-container" onClick={() => setCurrentView('finance')}>
                <div className="card-icon-container teal-accent">
                  <Wallet size={24} />
                </div>
                <h3>Keuangan</h3>
                <p>Pantau pemasukan, pengeluaran, serta analisis anggaran finansial bulanan Anda.</p>
                <div className="card-footer-pill teal-accent">
                  <TrendingUp size={14} />
                  <span>Saldo: Rp 5.230.000</span>
                </div>
              </div>

              {/* Card Pekerjaan */}
              <div className="menu-card glass-container" onClick={() => setCurrentView('work')}>
                <div className="card-icon-container violet-accent">
                  <Briefcase size={24} />
                </div>
                <h3>Pekerjaan</h3>
                <p>Kelola to-do list harian Anda dan tracking jam kerja secara real-time.</p>
                <div className="card-footer-pill violet-accent">
                  <Clock size={14} />
                  <span>4 Tugas Aktif Hari Ini</span>
                </div>
              </div>

              {/* Card Habit Tracker */}
              <div className="menu-card glass-container" onClick={() => setCurrentView('habits')}>
                <div className="card-icon-container emerald-accent">
                  <CheckCircle size={24} />
                </div>
                <h3>Habits Tracker</h3>
                <p>Bentuk kebiasaan positif dan pantau grafik konsistensi rutinitas harian Anda.</p>
                <div className="card-footer-pill emerald-accent">
                  <Flame size={14} />
                  <span>Streak Terbaik: 12 Hari</span>
                </div>
              </div>

              {/* Card Project */}
              <div className="menu-card glass-container" onClick={() => setCurrentView('projects')}>
                <div className="card-icon-container amber-accent">
                  <FolderGit2 size={24} />
                </div>
                <h3>Project</h3>
                <p>Kelola tahapan project, simpan dokumentasi ide, dan rencanakan milestone.</p>
                <div className="card-footer-pill amber-accent">
                  <Layers size={14} />
                  <span>3 Project Berjalan</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === 'finance' && (
          <div className={`finance-layout ${financeSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            
            {/* Mobile Top Header for Finance Module */}
            <header className="finance-mobile-header">
              <button 
                className="mobile-menu-toggle"
                onClick={() => setFinanceMobileOpen(true)}
                aria-label="Buka Menu Keuangan"
              >
                <Menu size={20} />
              </button>
              <div className="mobile-brand">
                <Wallet size={18} />
                <span>Keuangan</span>
              </div>
              <div style={{ width: 20 }}></div>
            </header>

            {/* Left Sidebar for Finance Section */}
            <aside className={`finance-sidebar glass-container ${financeMobileOpen ? 'mobile-open' : ''}`}>
              <div className="sidebar-header">
                <div className="header-actions-row">
                  <button onClick={() => setCurrentView('menu')} className="btn btn-secondary btn-sm back-to-hub-btn" title="Menu Utama">
                    <ArrowLeft size={14} />
                    <span>Menu Utama</span>
                  </button>
                  
                  {/* Hamburger Button inside Sidebar */}
                  <button 
                    onClick={() => {
                      if (window.innerWidth <= 768) {
                        setFinanceMobileOpen(false);
                      } else {
                        setFinanceSidebarCollapsed(!financeSidebarCollapsed);
                      }
                    }} 
                    className="sidebar-toggle-btn"
                    title={financeSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                  >
                    <span className="toggle-icon-desktop">
                      {financeSidebarCollapsed ? <Menu size={18} /> : <X size={18} />}
                    </span>
                    <span className="toggle-icon-mobile">
                      <X size={18} />
                    </span>
                  </button>
                </div>
                
                <div className="finance-brand">
                  <Wallet size={18} className="brand-icon" />
                  <span>Keuangan</span>
                </div>
              </div>

              <nav className="finance-nav">
                {financeTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      className={`finance-nav-item ${activeFinanceTab === tab.id ? 'active' : ''}`}
                      onClick={() => {
                        setActiveFinanceTab(tab.id);
                        setFinanceMobileOpen(false); // Auto close mobile drawer
                      }}
                      title={tab.label}
                    >
                      <Icon size={16} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>

            {/* Right Main Panel */}
            <main className="finance-main-content">
              <header className="finance-content-header">
                <h1>{financeTabs.find(t => t.id === activeFinanceTab)?.label}</h1>
                <span className="finance-subtitle">Modul Keuangan</span>
              </header>

              {activeFinanceTab === 'dashboard' ? (
                <FinanceDashboard />
              ) : activeFinanceTab === 'wallet' ? (
                <WalletManager />
              ) : activeFinanceTab === 'budget' ? (
                <BudgetManager />
              ) : activeFinanceTab === 'income' ? (
                <IncomeManager />
              ) : activeFinanceTab === 'expense' ? (
                <ExpenseManager />
              ) : activeFinanceTab === 'debt' ? (
                <DebtManager />
              ) : (
                <div className="finance-content-body glass-container">
                  <div className="ambient-glow" />
                  <div className="placeholder-card-content">
                    <div className="icon-badge">
                      {React.createElement(financeTabs.find(t => t.id === activeFinanceTab)?.icon || Wallet, { size: 32 })}
                    </div>
                    <h2>{financeTabs.find(t => t.id === activeFinanceTab)?.label}</h2>
                    <p className="placeholder-text-muted">Halaman ini sedang dalam fase pengembangan</p>
                  </div>
                </div>
              )}
            </main>

            {/* Mobile Drawer Overlay */}
            {financeMobileOpen && (
              <div 
                className="finance-overlay" 
                onClick={() => setFinanceMobileOpen(false)}
              />
            )}
          </div>
        )}

        {currentView === 'work' && (
          <div className="feature-detail-view">
            <div className="feature-view-header">
              {renderBackButton()}
              <div className="feature-title-block">
                <div className="icon-badge violet-accent">
                  <Briefcase size={28} />
                </div>
                <div>
                  <h1>Pekerjaan</h1>
                  <p>Organisasi tugas pekerjaan Anda agar tetap produktif dan terstruktur.</p>
                </div>
              </div>
            </div>

            <div className="feature-placeholder-body glass-container">
              <div className="placeholder-info">
                <h3>Fitur Pencatatan Pekerjaan Sedang Dikembangkan</h3>
                <p>Nantikan papan tugas ala Kanban, log pelacak waktu kerja, dan grafik pencapaian performa harian Anda di sini.</p>
              </div>

              {/* Mock visual elements */}
              <div className="mock-dashboard-elements">
                <div className="mock-tasks-layout">
                  <div className="mock-task-column">
                    <h5>To-Do</h5>
                    <div className="mock-task-item">
                      <h6>Desain Halaman Login</h6>
                      <p>Selesaikan integrasi CSS & Supabase</p>
                    </div>
                    <div className="mock-task-item">
                      <h6>Review Schema Database</h6>
                      <p>Pastikan relasi tabel profiles aman</p>
                    </div>
                  </div>
                  <div className="mock-task-column">
                    <h5>Sedang Dikerjakan</h5>
                    <div className="mock-task-item active">
                      <h6>Revisi Tampilan Dashboard</h6>
                      <p>Ubah layout menu grid playful</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === 'habits' && (
          <div className="feature-detail-view">
            <div className="feature-view-header">
              {renderBackButton()}
              <div className="feature-title-block">
                <div className="icon-badge emerald-accent">
                  <CheckCircle size={28} />
                </div>
                <div>
                  <h1>Habits Tracker</h1>
                  <p>Pelacak rutinitas untuk membangun gaya hidup sehat dan konsisten.</p>
                </div>
              </div>
            </div>

            <div className="feature-placeholder-body glass-container">
              <div className="placeholder-info">
                <h3>Fitur Pelacakan Kebiasaan Sedang Dikembangkan</h3>
                <p>Di halaman ini nanti Anda dapat menentukan daftar habit harian, mencentang keberhasilan harian, dan melihat streak kebiasaan Anda.</p>
              </div>

              {/* Mock visual elements */}
              <div className="mock-dashboard-elements">
                <div className="mock-habits-layout">
                  <div className="mock-habit-card">
                    <div className="habit-header">
                      <h6>Minum Air Putih 3L</h6>
                      <span className="streak-badge"><Flame size={12} /> 12 hari</span>
                    </div>
                    <div className="streak-dots">
                      <span className="dot active">S</span>
                      <span className="dot active">S</span>
                      <span className="dot active">R</span>
                      <span className="dot active">K</span>
                      <span className="dot active">J</span>
                      <span className="dot">S</span>
                      <span className="dot">M</span>
                    </div>
                  </div>
                  <div className="mock-habit-card">
                    <div className="habit-header">
                      <h6>Olahraga Pagi (30m)</h6>
                      <span className="streak-badge"><Flame size={12} /> 3 hari</span>
                    </div>
                    <div className="streak-dots">
                      <span className="dot active">S</span>
                      <span className="dot">S</span>
                      <span className="dot active">R</span>
                      <span className="dot active">K</span>
                      <span className="dot active">J</span>
                      <span className="dot">S</span>
                      <span className="dot">M</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === 'projects' && (
          <div className="feature-detail-view">
            <div className="feature-view-header">
              {renderBackButton()}
              <div className="feature-title-block">
                <div className="icon-badge amber-accent">
                  <FolderGit2 size={28} />
                </div>
                <div>
                  <h1>Project</h1>
                  <p>Atur pengerjaan ide dan project pribadi atau kolaboratif Anda.</p>
                </div>
              </div>
            </div>

            <div className="feature-placeholder-body glass-container">
              <div className="placeholder-info">
                <h3>Fitur Pencatatan Project Sedang Dikembangkan</h3>
                <p>Gunakan halaman ini untuk memecah project Anda menjadi beberapa tahapan milestone, mencatat ide (raw notes), dan memantau persentase kelar project.</p>
              </div>

              {/* Mock visual elements */}
              <div className="mock-projects-list">
                <div className="mock-project-item">
                  <div className="project-meta">
                    <h6>Aplikasi Chronicle Web</h6>
                    <span>60% Selesai</span>
                  </div>
                  <div className="progress-bar-container">
                    <div className="progress-bar-fill" style={{ width: '60%', background: 'var(--accent-warning)' }}></div>
                  </div>
                </div>
                <div className="glass-card mock-project-item">
                  <div className="project-meta">
                    <h6>Desain Branding Portofolio</h6>
                    <span>90% Selesai</span>
                  </div>
                  <div className="progress-bar-container">
                    <div className="progress-bar-fill" style={{ width: '90%', background: 'var(--accent-success)' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
