# 📑 Chronicle Keuangan - Personal Journaling Hub

Chronicle Keuangan adalah modul finansial personal premium yang dirancang untuk mengkonsolidasikan, menganalisis, dan memantau kesehatan keuangan pengguna secara real-time. Aplikasi ini mengintegrasikan pencatatan pemasukan, pengeluaran, anggaran bulanan, manajemen banyak dompet/rekening, serta pencatatan hutang & piutang ke dalam sebuah dashboard visual yang interaktif.

Aplikasi ini dibangun menggunakan **React**, **TypeScript**, dan **Vite** untuk frontend, serta disinkronkan langsung ke cloud database **Supabase** dengan penanganan *graceful fallback* ke penyimpanan lokal (`LocalStorage`) jika tabel database belum dikonfigurasi.

---

## ✨ Fitur Utama Modul Keuangan

### 1. 📊 Dashboard Keuangan Konsolidasi
* **Kompilasi Real-time**: Menyajikan ringkasan Total Kekayaan Bersih (akumulasi saldo seluruh dompet aktif), total arus kas masuk/keluar, dan posisi bersih hutang-piutang.
* **Grafik Tren Arus Kas**: Kurva garis ganda komparatif membandingkan tren harian Pemasukan (Emerald) vs Pengeluaran (Coral) menggunakan **Chart.js** & **react-chartjs-2**.
* **Budget Health Monitoring**: Bar progress interaktif yang menunjukkan persentase pemakaian anggaran kategori dengan indikator warna dinamis (Hijau, Kuning, Merah).
* **Recent Activity Feed**: Log audit gabungan kronologis untuk memantau 5 transaksi finansial terbaru (dari tipe apa saja).

### 2. 📥 Modul Pemasukan (Income Manager)
* Pencatatan nominal pemasukan Rupiah terformat otomatis.
* Panel Kelola Kategori Sumber Pemasukan kustom (Custom Emoji & Warna Presets).
* Penyelarasan otomatis: Menyimpan pemasukan secara real-time meningkatkan saldo rekening tujuan.

### 3. 📤 Modul Pengeluaran (Expense Manager)
* Pencatatan nominal pengeluaran Rupiah terformat otomatis.
* Menghubungkan pengeluaran langsung ke Anggaran bulanan dan Dompet asal.
* Penyelarasan otomatis: Menyimpan pengeluaran secara real-time mengurangi saldo rekening asal.

### 4. 💳 Modul Dompet (Wallet Manager)
* Manajemen multi-rekening (Tabungan Bank, Dompet Digital, Cash/Tunai, dll).
* Penentuan saldo awal dan pelacakan riwayat saldo terintegrasi.

### 5. 🍕 Modul Anggaran (Budget Manager)
* Pengaturan limit anggaran bulanan per kategori belanja.
* Fitur salin anggaran dari bulan sebelumnya (Copy from Previous Month) untuk setup cepat.

### 6. 🔴🟢 Modul Hutang & Piutang (Debt Manager)
* Pencatatan Hutang (Saya Berhutang) dan Piutang (Saya Meminjamkan) ke orang/instansi tertentu.
* Fitur jatuh tempo dan filter tab (Belum Lunas & Sudah Lunas).
* Pelunasan sekali klik (Mark as Paid) yang otomatis menyesuaikan saldo dompet terkait.

---

## 🛠️ Stack Teknologi

* **Frontend Framework**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
* **Build Tool**: [Vite](https://vitejs.dev/)
* **Database & Auth**: [Supabase](https://supabase.com/)
* **Grafik & Visual**: [Chart.js](https://www.chartjs.org/) + [react-chartjs-2](https://react-chartjs-2.js.org/)
* **Icons**: [Lucide React](https://lucide.dev/)
* **Styling**: Vanilla CSS (Premium Glassmorphism & Modern Playful Aesthetic)

---

## 🚀 Panduan Setup & Migrasi Database

### 1. Kloning & Pengaturan Repository
Jalankan perintah berikut di terminal Anda:
```bash
# Inisialisasi Git (jika baru)
git init
git remote add origin https://github.com/Ardiyanto24/personal-web.git
```

### 2. File Konfigurasi Lingkungan (`.env`)
Salin berkas `.env.example` menjadi `.env` di direktori utama proyek Anda:
```env
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```
> **PENTING**: File `.env` sudah diabaikan dalam `.gitignore` untuk mencegah terunggahnya data kredensial Anda ke GitHub publik.

### 3. Eksekusi Skema Database (Supabase SQL Editor)
Masuk ke dashboard proyek Supabase Anda, buka **SQL Editor**, dan jalankan skrip migrasi berikut untuk membuat seluruh tabel dan mengaktifkan Row Level Security (RLS) serta kebijakan akses data pengguna:

```sql
-- ==================== TABEL 1: WALLETS ====================
create table public.wallets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  bank_name text not null,
  account_number text,
  balance numeric default 0 not null,
  color text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.wallets enable row level security;

create policy "Users can view their own wallets" on public.wallets for select using (auth.uid() = user_id);
create policy "Users can insert their own wallets" on public.wallets for insert with check (auth.uid() = user_id);
create policy "Users can update their own wallets" on public.wallets for update using (auth.uid() = user_id);
create policy "Users can delete their own wallets" on public.wallets for delete using (auth.uid() = user_id);

-- ==================== TABEL 2: BUDGETS ====================
create table public.budgets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  limit_amount numeric not null,
  spent_amount numeric default 0 not null,
  icon text not null,
  color text not null,
  month varchar(7) not null, -- format YYYY-MM
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.budgets enable row level security;

create policy "Users can view their own budgets" on public.budgets for select using (auth.uid() = user_id);
create policy "Users can insert their own budgets" on public.budgets for insert with check (auth.uid() = user_id);
create policy "Users can update their own budgets" on public.budgets for update using (auth.uid() = user_id);
create policy "Users can delete their own budgets" on public.budgets for delete using (auth.uid() = user_id);

-- ==================== TABEL 3: INCOME SOURCES ====================
create table public.income_sources (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  icon text not null,
  color text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.income_sources enable row level security;

create policy "Users can view their own income sources" on public.income_sources for select using (auth.uid() = user_id);
create policy "Users can insert their own income sources" on public.income_sources for insert with check (auth.uid() = user_id);
create policy "Users can delete their own income sources" on public.income_sources for delete using (auth.uid() = user_id);

-- ==================== TABEL 4: INCOMES ====================
create table public.incomes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  description text not null,
  amount numeric not null,
  source_name text not null,
  source_icon text not null,
  source_color text not null,
  wallet_id uuid references public.wallets(id) on delete cascade not null,
  wallet_name text not null,
  date date not null,
  month varchar(7) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.incomes enable row level security;

create policy "Users can view their own incomes" on public.incomes for select using (auth.uid() = user_id);
create policy "Users can insert their own incomes" on public.incomes for insert with check (auth.uid() = user_id);
create policy "Users can update their own incomes" on public.incomes for update using (auth.uid() = user_id);
create policy "Users can delete their own incomes" on public.incomes for delete using (auth.uid() = user_id);

-- ==================== TABEL 5: EXPENSES ====================
create table public.expenses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  description text not null,
  amount numeric not null,
  category_name text not null,
  category_icon text not null,
  category_color text not null,
  wallet_id uuid references public.wallets(id) on delete cascade not null,
  wallet_name text not null,
  date date not null,
  month varchar(7) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.expenses enable row level security;

create policy "Users can view their own expenses" on public.expenses for select using (auth.uid() = user_id);
create policy "Users can insert their own expenses" on public.expenses for insert with check (auth.uid() = user_id);
create policy "Users can update their own expenses" on public.expenses for update using (auth.uid() = user_id);
create policy "Users can delete their own expenses" on public.expenses for delete using (auth.uid() = user_id);

-- ==================== TABEL 6: DEBTS ====================
create type debt_type as enum ('debt', 'receivable');
create type debt_status as enum ('pending', 'paid');

create table public.debts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  type debt_type not null,
  person text not null,
  description text not null,
  amount numeric not null,
  due_date date,
  status debt_status default 'pending' not null,
  wallet_id uuid references public.wallets(id) on delete set null,
  wallet_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.debts enable row level security;

create policy "Users can view their own debts" on public.debts for select using (auth.uid() = user_id);
create policy "Users can insert their own debts" on public.debts for insert with check (auth.uid() = user_id);
create policy "Users can update their own debts" on public.debts for update using (auth.uid() = user_id);
create policy "Users can delete their own debts" on public.debts for delete using (auth.uid() = user_id);
```

---

## 💻 Cara Menjalankan Aplikasi

### Install Dependensi
```bash
npm install
```

### Jalankan Development Server
```bash
npm run dev
```

### Bangun Bundle Produksi (Build)
```bash
npm run build
```
