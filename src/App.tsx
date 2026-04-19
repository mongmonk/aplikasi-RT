/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  FileText, 
  Receipt, 
  BookOpen, 
  LogIn, 
  LogOut, 
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Filter,
  UserPlus,
  ShieldCheck,
  Users,
  Menu,
  X,
  Edit,
  Search,
  Check,
  ChevronsUpDown,
  Building,
  MapPin,
  Map as MapIcon,
  Settings,
  Upload,
  Image as ImageIcon,
  Mic,
  MicOff,
  Loader2,
  FileUp,
  AlertCircle,
  Download,
  Smartphone
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

import { 
  onAuthStateChanged, 
  signInWithPopup,
  signOut,
  User 
} from 'firebase/auth';

import { auth, googleProvider } from '@/lib/firebase';
import { db } from '@/lib/firebase';
import { Announcement, Resident, Payment, CashEntry, AppUser, AppSettings } from '@/lib/types';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

const MONTHS = [
  { id: 1, name: 'Januari' },
  { id: 2, name: 'Februari' },
  { id: 3, name: 'Maret' },
  { id: 4, name: 'April' },
  { id: 5, name: 'Mei' },
  { id: 6, name: 'Juni' },
  { id: 7, name: 'Juli' },
  { id: 8, name: 'Agustus' },
  { id: 9, name: 'September' },
  { id: 10, name: 'Oktober' },
  { id: 11, name: 'November' },
  { id: 12, name: 'Desember' }
];

const CURRENCY_FORMATTER = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0
});

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Data State
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Update appUser whenever data refreshes
  useEffect(() => {
    if (user && allUsers.length > 0) {
      const me = allUsers.find(u => u.uid === user.uid);
      if (me) {
        setAppUser(me);
      } else if (user.email === 'backupcemonggaul@gmail.com') {
        // Fallback for designated admin if not yet in allUsers list
        setAppUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'Admin',
          photoURL: user.photoURL || '',
          isActive: true,
          createdAt: new Date().toISOString()
        });
      }
    }
  }, [user, allUsers]);

  // Auth Listener
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Sync user to Turso
        const userData = {
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          photoURL: u.photoURL
        };
        
        try {
          const res = await fetch('/api/users/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
          });
          if (res.ok) {
            // Get all persistent users to check status
            const usersRes = await fetch('/api/users');
            const allUsersArr: AppUser[] = await usersRes.json();
            const me = allUsersArr.find(usr => usr.uid === u.uid);
            if (me) setAppUser(me);
          }
        } catch (error) {
          console.error("User sync error:", error);
        }
      } else {
        setAppUser(null);
      }
    });

    return () => unsubAuth();
  }, []);

  // Fetch Data periodically (since we lost real-time onSnapshot)
  const fetchData = async () => {
    try {
      const urls = [
        '/api/residents',
        '/api/payments',
        '/api/cash-book',
        '/api/announcements',
        '/api/settings',
        '/api/users'
      ];
      
      const responses = await Promise.all(urls.map(url => fetch(url)));
      
      if (responses[0].ok) {
        const data = await responses[0].json();
        if (Array.isArray(data)) setResidents(data);
      }
      if (responses[1].ok) {
        const data = await responses[1].json();
        if (Array.isArray(data)) setPayments(data);
      }
      if (responses[2].ok) {
        const data = await responses[2].json();
        if (Array.isArray(data)) setCashEntries(data);
      }
      if (responses[3].ok) {
        const data = await responses[3].json();
        if (Array.isArray(data)) setAnnouncements(data);
      }
      if (responses[4].ok) {
        const data = await responses[4].json();
        if (data && !data.error) setSettings(data);
      }
      if (responses[5].ok) {
        const data = await responses[5].json();
        if (Array.isArray(data)) setAllUsers(data);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Polling every 5s for better responsiveness
    return () => clearInterval(interval);
  }, []);

  // Update Document Meta for SEO
  useEffect(() => {
    if (settings) {
      const pageTitle = `RT ${settings.rtNumber} ${settings.rwNumber ? `RW ${settings.rwNumber} ` : ''}${settings.village} - Manajemen Keuangan`;
      const desc = `Sistem Informasi Keuangan dan Buku Kas Umum Warga. RT ${settings.rtNumber} ${settings.rwNumber ? `RW ${settings.rwNumber} ` : ''}${settings.dusun ? `${settings.dusun} ` : ''}${settings.village} ${settings.district} ${settings.regency}`;
      
      document.title = pageTitle;
      
      const updateMeta = (name: string, content: string, isProperty = false) => {
        let meta = document.querySelector(`meta[${isProperty ? 'property' : 'name'}="${name}"]`);
        if (!meta) {
          meta = document.createElement('meta');
          if (isProperty) {
            meta.setAttribute('property', name);
          } else {
            meta.setAttribute('name', name);
          }
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', content);
      };

      updateMeta('description', desc);
      updateMeta('og:title', pageTitle, true);
      updateMeta('og:description', desc, true);
      updateMeta('og:image', '/api/logo', true);

      // Update favicon dynamically
      const updateLink = (rel: string, href: string) => {
        let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
        if (!link) {
          link = document.createElement('link');
          link.rel = rel;
          document.head.appendChild(link);
        }
        link.href = href;
      };
      updateLink('icon', '/api/logo');
      updateLink('apple-touch-icon', '/api/logo');
    }
  }, [settings]);

  const handleLogout = () => signOut(auth);

  // Global Stats Calculation
  const stats = useMemo(() => {
    const today = new Date();
    // If observing current year, use current month. Otherwise default to a relevant month or total? 
    // Usually dashboards show "current month's performance" for the year being looked at.
    const currentMonth = today.getMonth() + 1;
    
    const monthlyEntries = cashEntries.filter(e => {
      const d = new Date(e.date);
      return (d.getMonth() + 1) === currentMonth && d.getFullYear() === selectedYear;
    });

    const income = monthlyEntries.filter(e => e.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
    const expense = monthlyEntries.filter(e => e.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
    
    // Saldo Kas RT is always all-time cumulative
    const allTimeBalance = cashEntries.reduce((acc, curr) => curr.type === 'income' ? acc + curr.amount : acc - curr.amount, 0);

    const monthlyTarget = residents.length * (settings?.defaultIuran || 15000);

    return {
      totalBalance: allTimeBalance,
      monthlyIncome: income,
      monthlyExpense: expense,
      target: monthlyTarget,
      realization: monthlyTarget > 0 ? Math.round((income / monthlyTarget) * 100) : 0
    };
  }, [cashEntries, residents.length, selectedYear, settings?.defaultIuran]);

  return (
    <div className="flex min-h-screen bg-slate-100 font-sans text-slate-900 overflow-x-hidden">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900 text-white flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg shrink-0 overflow-hidden flex items-center justify-center w-8 h-8">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <Receipt className="w-4 h-4" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-sm tracking-tight uppercase leading-none">RT-Ku</span>
            {settings && <span className="text-[8px] font-bold text-blue-400 uppercase tracking-widest mt-0.5 truncate max-w-[200px]">RT {settings.rtNumber} {settings.rwNumber && `RW ${settings.rwNumber}`} {settings.village}</span>}
          </div>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1">
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[240px] bg-slate-900 text-white flex flex-col p-5 transition-transform duration-300 transform shrink-0
        md:translate-x-0 md:sticky md:top-0 md:h-screen
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="hidden md:flex flex-col gap-3 mb-10">
          <div className="flex items-center gap-2.5">
            <div className="bg-blue-600 p-1.5 rounded-xl shrink-0 overflow-hidden flex items-center justify-center w-10 h-10 shadow-lg shadow-blue-900/40 border border-blue-500/20">
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Receipt className="w-5 h-5" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-black text-[22px] tracking-tighter uppercase leading-none text-white">RT-Ku</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">SINKRONISASI AKTIF</span>
              </div>
            </div>
          </div>
          
          {settings && (
            <div className="pl-0.5 border-l-2 border-slate-800 ml-1.5 pl-3 mt-1 py-1 flex items-start gap-1.5 transition-colors">
               <MapPin className="w-2.5 h-2.5 mt-0.5 shrink-0 text-blue-500" />
               <span className="text-[9px] text-slate-400 font-bold uppercase leading-[1.4] tracking-wider line-clamp-2">
                 RT {settings.rtNumber} {settings.rwNumber && `RW ${settings.rwNumber} `}{settings.dusun && `${settings.dusun} `}{settings.village} {settings.district} {settings.regency}
               </span>
            </div>
          )}
        </div>

        <nav className="space-y-1 flex-1 mt-14 md:mt-0">
          <SidebarItem 
            active={activeTab === 'summary'} 
            onClick={() => { setActiveTab('summary'); setIsSidebarOpen(false); }} 
            icon={<BookOpen className="w-4 h-4" />} 
            label="Ringkasan" 
          />
          <SidebarItem 
            active={activeTab === 'iuran'} 
            onClick={() => { setActiveTab('iuran'); setIsSidebarOpen(false); }} 
            icon={<Receipt className="w-4 h-4" />} 
            label="Matriks Iuran" 
          />
          <SidebarItem 
            active={activeTab === 'cashbook'} 
            onClick={() => { setActiveTab('cashbook'); setIsSidebarOpen(false); }} 
            icon={<FileText className="w-4 h-4" />} 
            label="Buku Kas Umum" 
          />
          <SidebarItem 
            active={activeTab === 'residents'} 
            onClick={() => { setActiveTab('residents'); setIsSidebarOpen(false); }} 
            icon={<UserPlus className="w-4 h-4" />} 
            label="Warga & Properti" 
          />
          {appUser?.isActive && (
            <SidebarItem 
              active={activeTab === 'admin'} 
              onClick={() => { setActiveTab('admin'); setIsSidebarOpen(false); }} 
              icon={<ShieldCheck className="w-4 h-4" />} 
              label="Manajemen Admin" 
            />
          )}
        </nav>

        <div className="mt-auto bg-black/20 p-4 rounded-xl text-[11px]">
          <div className="opacity-60 mb-1">Login Sebagai:</div>
          <div className="font-bold flex items-center justify-between">
            {user ? (
              <>
                <span className="truncate">{user.displayName || user.email?.split('@')[0]}</span>
                {appUser ? (
                  appUser.isActive ? (
                    <span className="text-[9px] bg-blue-600 px-1.5 rounded ml-2">ADMIN</span>
                  ) : (
                    <span className="text-[9px] bg-slate-600 px-1.5 rounded ml-2">PENDING</span>
                  )
                ) : user ? (
                  <span className="text-[9px] animate-pulse bg-slate-800 px-1.5 rounded ml-2 italic">VERIFYING...</span>
                ) : (
                  <span className="text-[9px] opacity-40 italic ml-2">GUEST</span>
                )}
              </>
            ) : (
              <span className="opacity-40 italic">Public Guest</span>
            )}
          </div>
          {user ? (
            <button onClick={handleLogout} className="mt-3 text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors font-bold">
              <LogOut className="w-3 h-3" /> Logout
            </button>
          ) : (
            <AuthDialog />
          )}
        </div>

        <div className="text-center pt-3 border-t border-slate-800/50">
          <a
            href="https://t.me/cemonggaul"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] text-slate-600 hover:text-blue-400 transition-colors font-medium tracking-wide"
          >
            developed by @cemonggaul
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 flex flex-col gap-4 md:gap-6 overflow-y-auto mt-14 md:mt-0 h-screen">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
          <h1 className="text-lg md:text-xl font-extrabold tracking-tight">Dashboard Keuangan Tahunan</h1>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center bg-white border border-slate-200 rounded-md px-2 h-8">
               <span className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-tighter shrink-0">Tahun</span>
               <input 
                 type="number"
                 className="w-14 bg-transparent outline-none text-xs font-bold text-slate-700"
                 value={selectedYear}
                 onChange={(e) => setSelectedYear(parseInt(e.target.value) || new Date().getFullYear())}
               />
            </div>
            {user && appUser?.isActive && <AddPaymentGlobal entries={payments} residents={residents} onSync={fetchData} />}
          </div>
        </header>

        {/* Global Stats Row - Hide when in cashbook if the user wants consolidation */}
        {activeTab !== 'cashbook' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 shrink-0">
             <StatCard label="SALDO KAS RT" value={CURRENCY_FORMATTER.format(stats.totalBalance)} valueColor="text-emerald-500" />
             <StatCard label="TARGET (BLN INI)" value={CURRENCY_FORMATTER.format(stats.target)} />
             <StatCard label="CAPAIAN" value={`${stats.realization}%`} />
             <StatCard label="KELUAR (BLN INI)" value={CURRENCY_FORMATTER.format(stats.monthlyExpense)} valueColor="text-rose-500" />
          </div>
        )}

        {/* Content Tabs Content Replacements */}
        <div className="flex-1 min-h-0">
          {activeTab === 'summary' && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6 h-full">
              <Panel title="Statistik Iuran Tahunan" subtitle={`Tahun ${selectedYear} · ${residents.length} Warga · Default: ${CURRENCY_FORMATTER.format(settings?.defaultIuran || 15000)} / Bln`}>
                 <IuranStatsSummary residents={residents} payments={payments} year={selectedYear} defaultIuran={settings?.defaultIuran || 15000} />
              </Panel>
              <Panel title="Informasi & Pengumuman" action={user && appUser?.isActive && <AddAnnouncementDialog onSync={fetchData} />}>
                <AnnouncementList announcements={announcements} isAdmin={!!appUser?.isActive} onSync={fetchData} />
              </Panel>
            </div>
          )}

          {activeTab === 'iuran' && (
             <Panel title="Data Lengkap Iuran" subtitle={`Tahun ${selectedYear}`}>
               <IuranTable residents={residents} payments={payments} year={selectedYear} isAdmin={!!appUser?.isActive} onSync={fetchData} settings={settings} />
             </Panel>
          )}

          {activeTab === 'cashbook' && (
             <CashBookModule cashEntries={cashEntries} isAdmin={!!appUser?.isActive} onSync={fetchData} />
          )}

          {activeTab === 'residents' && (
             <Panel title="Daftar Warga & Properti" action={user && appUser?.isActive && <AddResidentDialog onSync={fetchData} />}>
                <ResidentList residents={residents} isAdmin={!!appUser?.isActive} onSync={fetchData} />
             </Panel>
          )}

          {activeTab === 'admin' && appUser?.isActive && (
             <Panel title="Manajemen Pengurus & Sistem" subtitle="Kelola hak akses dan konfigurasi unit RT">
                <AdminManagement users={allUsers} currentUserUid={user?.uid || ''} settings={settings} residents={residents} payments={payments} onSync={fetchData} />
             </Panel>
          )}
        </div>
      </main>

      {/* PWA Install Banner */}
      <InstallBanner />
    </div>
  );
}

// --- PWA INSTALL BANNER ---

function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Don't show if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // Don't show if user previously dismissed
    if (localStorage.getItem('pwa-dismissed')) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Small delay so page loads first
      setTimeout(() => setShowBanner(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setInstalling(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-dismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-3 md:p-4 animate-in slide-in-from-bottom duration-500">
      <div className="max-w-lg mx-auto bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl shadow-black/40 border border-slate-700/50 p-4 flex items-center gap-4">
        {/* Icon */}
        <div className="shrink-0 w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
          <Smartphone className="w-6 h-6 text-blue-400" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white leading-tight">Install Aplikasi RT-Ku</div>
          <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">Akses cepat dari home screen, bisa offline!</div>
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-2">
          <button
            onClick={handleDismiss}
            className="text-[10px] text-slate-500 hover:text-slate-300 font-bold uppercase tracking-wider transition-colors px-2 py-1"
          >
            Nanti
          </button>
          <button
            onClick={handleInstall}
            disabled={installing}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            {installing ? 'Installing...' : 'Install'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- HIGH DENSITY THEME COMPONENTS ---

function SidebarItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 text-sm transition-all ${
        active ? 'bg-blue-600 text-white shadow-md font-bold' : 'text-slate-400 hover:bg-white/10 hover:text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function StatCard({ label, value, valueColor }: { label: string, value: string, valueColor?: string }) {
  return (
    <div className="bg-white p-4 rounded-xl border-4 border-slate-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all">
      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">{label}</div>
      <div className={`text-xl md:text-2xl font-sans font-black tracking-tight ${valueColor || 'text-slate-800'}`}>{value}</div>
    </div>
  );
}

function Panel({ title, subtitle, children, action }: { title: string, subtitle?: string, children: React.ReactNode, action?: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden h-full">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-tight text-slate-700">{title}</h3>
          {subtitle && <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="flex-1 overflow-auto min-h-0">
        {children}
      </div>
    </div>
  );
}

// --- IURAN STATS SUMMARY (for Ringkasan tab) ---

function IuranStatsSummary({ residents, payments, year, defaultIuran }: { residents: Resident[], payments: Payment[], year: number, defaultIuran: number }) {
  const yearPayments = payments.filter(p => p.year === year);

  const monthlyStats = MONTHS.map(m => {
    const paid = residents.filter(r =>
      yearPayments.some(p => p.residentId === r.id && p.months.includes(m.id))
    ).length;
    return { ...m, paid, total: residents.length, pct: residents.length > 0 ? Math.round((paid / residents.length) * 100) : 0 };
  });

  const totalSlots = residents.length * 12;
  const totalPaid = monthlyStats.reduce((acc, m) => acc + m.paid, 0);
  const totalCollected = yearPayments.reduce((acc, p) => acc + p.amount, 0);
  const yearlyTarget = residents.length * defaultIuran * 12;

  // Resident payment counts
  const residentPaidMonths = residents.map(r => {
    const months = new Set<number>();
    yearPayments.filter(p => p.residentId === r.id).forEach(p => p.months.forEach(m => months.add(m)));
    return { name: r.name, count: months.size };
  }).sort((a, b) => b.count - a.count);

  const lunas = residentPaidMonths.filter(r => r.count === 12).length;
  const partial = residentPaidMonths.filter(r => r.count > 0 && r.count < 12).length;
  const belum = residentPaidMonths.filter(r => r.count === 0).length;

  return (
    <div className="p-4 md:p-5 space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
          <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Total Terkumpul</div>
          <div className="text-lg font-black text-emerald-700 mt-1">{CURRENCY_FORMATTER.format(totalCollected)}</div>
          <div className="text-[10px] text-emerald-500 mt-0.5">dari {CURRENCY_FORMATTER.format(yearlyTarget)}</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
          <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Capaian Tahunan</div>
          <div className="text-lg font-black text-blue-700 mt-1">{yearlyTarget > 0 ? Math.round((totalCollected / yearlyTarget) * 100) : 0}%</div>
          <div className="text-[10px] text-blue-500 mt-0.5">{totalPaid} dari {totalSlots} slot</div>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
          <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Lunas (12 Bln)</div>
          <div className="text-lg font-black text-amber-700 mt-1">{lunas} <span className="text-xs font-bold text-amber-500">warga</span></div>
          <div className="text-[10px] text-amber-500 mt-0.5">dari {residents.length} warga</div>
        </div>
        <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
          <div className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Belum Bayar</div>
          <div className="text-lg font-black text-rose-700 mt-1">{belum} <span className="text-xs font-bold text-rose-500">warga</span></div>
          <div className="text-[10px] text-rose-500 mt-0.5">{partial} sebagian bayar</div>
        </div>
      </div>

      {/* Monthly Progress */}
      <div>
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Progres Per Bulan</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {monthlyStats.map(m => (
            <div key={m.id} className="bg-white rounded-xl border border-slate-100 p-3 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">{m.name}</span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  m.pct === 100 ? 'bg-emerald-100 text-emerald-700' :
                  m.pct >= 50 ? 'bg-blue-100 text-blue-700' :
                  m.pct > 0 ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  {m.pct}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    m.pct === 100 ? 'bg-emerald-500' :
                    m.pct >= 50 ? 'bg-blue-500' :
                    m.pct > 0 ? 'bg-amber-500' :
                    'bg-slate-200'
                  }`}
                  style={{ width: `${m.pct}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-400 mt-1.5 font-medium">{m.paid}/{m.total} warga</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

function IuranTable({ residents, payments, year, isAdmin, onSync, settings }: { residents: Resident[], payments: Payment[], year: number, isAdmin: boolean, onSync: () => void, settings: AppSettings | null }) {
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Quick Add State
  const [quickAdd, setQuickAdd] = useState<{resident: Resident, month: number} | null>(null);
  const [quickAmount, setQuickAmount] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  const matrixData = useMemo(() => {
    return residents.map(resident => {
      const residentPayments = payments.filter(p => p.residentId === resident.id && p.year === year);
      const monthlyData: Record<number, { amount: number, payment: Payment | null }> = {};
      
      residentPayments.forEach(p => {
        const amountPerMonth = p.amount / p.months.length;
        p.months.forEach(m => {
          const current = monthlyData[m] || { amount: 0, payment: null };
          monthlyData[m] = {
            amount: current.amount + amountPerMonth,
            payment: p // Store the last payment found for this month as target for editing
          };
        });
      });

      return { ...resident, monthlyData };
    });
  }, [residents, payments, year]);

  return (
    <div className="text-[11px] overflow-auto h-full relative">
      <Table className="min-w-[700px]">
        <TableHeader className="bg-slate-50 sticky top-0 z-20 shadow-sm border-b-2 border-slate-200 uppercase font-black text-slate-400">
          <TableRow>
            <TableHead className="w-[140px] pl-4 sticky left-0 bg-slate-50 z-30">Nama Warga</TableHead>
            {MONTHS.map(m => (
              <TableHead key={m.id} className="text-center">{m.name.slice(0, 3)}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {matrixData.map(row => (
            <TableRow key={row.id} className="hover:bg-blue-50/30 transition-colors">
              <TableCell className="pl-4 font-bold text-slate-700 border-r border-slate-100 sticky left-0 bg-white z-10">
                {row.name}
              </TableCell>
              {MONTHS.map(m => {
                const data = row.monthlyData[m.id];
                const amount = data?.amount || 0;
                const payment = data?.payment || null;
                
                return (
                  <TableCell key={m.id} className="text-center p-1.5 border-x border-slate-50/50">
                    {amount > 0 ? (
                      <button 
                        disabled={!isAdmin}
                        onClick={() => isAdmin && payment && setEditingPayment(payment)}
                        className={`font-bold text-[10px] whitespace-nowrap transition-all ${isAdmin ? 'text-blue-600 hover:text-blue-800 hover:scale-110 cursor-pointer underline decoration-blue-200 underline-offset-2' : 'text-blue-600 cursor-default'}`}
                      >
                        {amount.toLocaleString('id-ID')}
                      </button>
                    ) : (
                      <div className="flex items-center justify-center">
                        <button
                          disabled={!isAdmin}
                          onClick={() => {
                            if (isAdmin) {
                              setQuickAdd({ resident: row, month: m.id });
                              setQuickAmount(settings?.defaultIuran || 15000);
                            }
                          }}
                          className={`font-black px-2 py-0.5 rounded text-[9px] transition-all ${isAdmin ? 'bg-slate-100 text-slate-400 hover:bg-blue-100 hover:text-blue-600 cursor-pointer hover:shadow-sm active:scale-95' : 'bg-slate-100 text-slate-300 cursor-default'}`}
                        >
                          -
                        </button>
                      </div>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
          {matrixData.length === 0 && (
             <TableRow>
                <TableCell colSpan={13} className="text-center py-20 text-slate-300 italic font-bold">Data warga tidak ditemukan.</TableCell>
             </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Edit Payment Dialog */}
      <Dialog 
        open={!!editingPayment} 
        onOpenChange={(open) => {
          if (!open) {
            setEditingPayment(null);
            setConfirmDelete(false);
            setIsDeleting(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[400px] border-none shadow-2xl rounded-3xl p-0 overflow-hidden">
          {editingPayment && (
            <div className="flex flex-col">
              <div className="p-6 pb-0">
                <DialogHeader>
                  <div className="flex items-center justify-between mb-2">
                    <DialogTitle className="flex items-center gap-2 text-xl font-black text-slate-800">
                      <div className="bg-blue-100 p-2 rounded-xl">
                        <Receipt className="w-5 h-5 text-blue-600" />
                      </div>
                      Detail Pembayaran
                    </DialogTitle>
                  </div>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest pl-11">Pengelolaan data transaksi iuran</p>
                </DialogHeader>
              </div>

              <div className="p-6 space-y-6">
                <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold uppercase tracking-[0.15em] text-[9px]">Warga</span>
                    <span className="font-black text-slate-700 uppercase tracking-tight">{residents.find(r => r.id === editingPayment.residentId)?.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold uppercase tracking-[0.15em] text-[9px]">Tahun</span>
                    <span className="font-black text-slate-700">{editingPayment.year}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold uppercase tracking-[0.15em] text-[9px]">Bulan</span>
                    <span className="font-black text-slate-700">
                      {editingPayment.months.map(m => MONTHS.find(mn => mn.id === m)?.name).join(', ')}
                    </span>
                  </div>
                  <Separator className="bg-slate-200/40" />
                  <div className="bg-white p-4 rounded-2xl border border-slate-100/50 flex justify-between items-center shadow-sm">
                    <span className="text-slate-400 font-bold uppercase tracking-[0.15em] text-[9px]">Total Nominal</span>
                    <span className="font-black text-2xl text-blue-600 tracking-tighter">
                      Rp {editingPayment.amount.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] text-rose-500 font-bold italic text-center px-6 leading-relaxed">
                    * Untuk mengedit, harap hapus transaksi ini dan input ulang dengan data yang benar agar sistem penomoran dan saldo tetap akurat.
                  </p>
                  
                  <div className="grid gap-2">
                    {!confirmDelete ? (
                      <Button 
                        variant="destructive" 
                        className="w-full h-14 font-black rounded-2xl bg-rose-50 text-rose-500 hover:bg-rose-100 border-none shadow-none transition-all group"
                        onClick={() => setConfirmDelete(true)}
                      >
                        <Trash2 className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform" /> 
                        Hapus Transaksi
                      </Button>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="ghost" 
                          className="h-14 font-bold rounded-2xl text-slate-400"
                          onClick={() => setConfirmDelete(false)}
                          disabled={isDeleting}
                        >
                          Batal
                        </Button>
                        <Button 
                          variant="destructive" 
                          className="h-14 font-black rounded-2xl bg-rose-600 text-white shadow-lg shadow-rose-200"
                          disabled={isDeleting}
                          onClick={async () => {
                            setIsDeleting(true);
                            try {
                              const res = await fetch('/api/payments/cleanup', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ paymentId: editingPayment.id })
                              });
                              if (res.ok) {
                                onSync();
                                setEditingPayment(null);
                                setConfirmDelete(false);
                              }
                            } catch (error) {
                              console.error("Delete error:", error);
                              alert("Gagal menghapus transaksi.");
                            } finally {
                              setIsDeleting(false);
                            }
                          }}
                        >
                          {isDeleting ? "Menghapus..." : "Ya, Hapus"}
                        </Button>
                      </div>
                    )}
                    <Button 
                      variant="ghost" 
                      className="w-full h-12 font-bold text-slate-400 text-xs" 
                      onClick={() => setEditingPayment(null)}
                      disabled={isDeleting}
                    >
                      Tutup
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Add Payment Dialog */}
      <Dialog 
        open={!!quickAdd} 
        onOpenChange={(open) => {
          if (!open) {
            setQuickAdd(null);
            setIsSaving(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[400px] border-none shadow-2xl rounded-3xl p-0 overflow-hidden">
          {quickAdd && (
            <div className="flex flex-col">
              <div className="p-6 pb-0">
                <DialogHeader>
                  <div className="flex items-center justify-between mb-2">
                    <DialogTitle className="flex items-center gap-2 text-xl font-black text-slate-800">
                      <div className="bg-blue-100 p-2 rounded-xl">
                        <PlusCircle className="w-5 h-5 text-blue-600" />
                      </div>
                      Input Iuran Cepat
                    </DialogTitle>
                  </div>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest pl-11">Tambah pembayaran bulan {MONTHS.find(m => m.id === quickAdd.month)?.name}</p>
                </DialogHeader>
              </div>

              <div className="p-6 space-y-6">
                <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold uppercase tracking-[0.15em] text-[9px]">Warga</span>
                    <span className="font-black text-slate-700 uppercase tracking-tight">{quickAdd.resident.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold uppercase tracking-[0.15em] text-[9px]">Tahun</span>
                    <span className="font-black text-slate-700">{year}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold uppercase tracking-[0.15em] text-[9px]">Bulan</span>
                    <span className="font-black text-slate-700 uppercase">{MONTHS.find(m => m.id === quickAdd.month)?.name}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                      <span className="text-slate-400 font-black text-lg">Rp</span>
                    </div>
                    <Input 
                      type="number" 
                      value={quickAmount || ''} 
                      onChange={e => setQuickAmount(Number(e.target.value))}
                      className="pl-14 h-16 text-2xl font-black bg-white border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-slate-800"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Button 
                      className="w-full h-14 font-black rounded-2xl bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-[0.98]"
                      disabled={isSaving || !quickAmount}
                      onClick={async () => {
                        setIsSaving(true);
                        try {
                          const pId = crypto.randomUUID();
                          const today = new Date();
                          const pDateStr = format(today, 'yyyy-MM-dd');
                          const monthYearLabel = `${MONTHS.find(m=>m.id === quickAdd.month)?.name.toUpperCase()} ${year}`;

                          const res = await fetch('/api/payments/record', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              payment: {
                                id: pId,
                                residentId: quickAdd.resident.id,
                                residentName: quickAdd.resident.name,
                                year: year,
                                months: [quickAdd.month],
                                amount: quickAmount,
                                paymentDate: pDateStr,
                                createdAt: new Date().toISOString()
                              },
                              cashEntry: {
                                id: crypto.randomUUID(),
                                description: `PEROLEHAN IURAN BULAN ${monthYearLabel} (${quickAdd.resident.name})`,
                                date: pDateStr,
                                type: 'income',
                                amount: quickAmount,
                                category: 'Iuran',
                                createdAt: new Date().toISOString()
                              }
                            })
                          });

                          if (res.ok) {
                            onSync();
                            setQuickAdd(null);
                          } else {
                            alert("Gagal menambahkan iuran.");
                          }
                        } catch (error) {
                          console.error(error);
                          alert("Gagal menyimpan data.");
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                    >
                      {isSaving ? "Menyimpan..." : "Simpan Iuran"}
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full h-12 font-bold text-slate-400 text-xs" 
                      onClick={() => setQuickAdd(null)}
                      disabled={isSaving}
                    >
                      Batal
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AnnouncementList({ announcements, isAdmin, onSync }: { announcements: Announcement[], isAdmin: boolean, onSync: () => void }) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
      if (res.ok) onSync();
    } catch (e) { console.error(e); }
    setDeletingId(null);
  };

  return (
    <div className="p-4 space-y-4">
      {announcements.map(ann => (
        <div key={ann.id} className="group relative border-l-4 border-blue-600 pl-4 py-1">
          <div className="font-extrabold text-[13px] text-slate-800 mb-0.5 pr-8">{ann.title}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            {format(new Date(ann.date), 'dd MMM yyyy')} • {ann.author?.includes('@') ? ann.author.split('@')[0] : ann.author}
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed font-medium line-clamp-3 overflow-hidden text-ellipsis whitespace-pre-wrap">{ann.content}</p>
          {isAdmin && (
            <div className="absolute top-0 right-0 p-1">
               {deletingId === ann.id ? (
                 <div className="flex items-center gap-1 bg-white shadow-sm border border-red-100 p-0.5 rounded-md animate-in fade-in zoom-in duration-200">
                    <button onClick={() => setDeletingId(null)} className="px-1.5 py-0.5 text-[8px] font-bold text-slate-400">Batal</button>
                    <button onClick={() => handleDelete(ann.id)} className="px-1.5 py-0.5 text-[8px] font-black bg-red-600 text-white rounded">Hapus</button>
                 </div>
               ) : (
                 <button onClick={() => setDeletingId(ann.id)} className="text-slate-300 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                 </button>
               )}
            </div>
          )}
        </div>
      ))}
      {announcements.length === 0 && <p className="text-center py-10 text-slate-300 italic text-xs font-bold">Tidak ada pengumuman.</p>}
    </div>
  );
}

function ResidentList({ residents, isAdmin, onSync }: { residents: Resident[], isAdmin: boolean, onSync: () => void }) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/residents/${id}`, { method: 'DELETE' });
      if (res.ok) onSync();
    } catch (e) { console.error(e); }
    setDeletingId(null);
  };

  return (
    <div className="p-0 overflow-x-auto min-h-[400px]">
      <Table>
        <TableHeader className="bg-slate-50 uppercase text-[10px] font-black text-slate-400 tracking-widest">
           <TableRow>
              <TableHead className="pl-4">Nama</TableHead>
              <TableHead>Alamat</TableHead>
              <TableHead className="text-right pr-4">Aksi</TableHead>
           </TableRow>
        </TableHeader>
        <TableBody>
           {residents.map(r => (
             <TableRow key={r.id} className="text-xs group hover:bg-slate-50/50 transition-colors h-14">
                <TableCell className="pl-4 font-bold text-slate-700 whitespace-nowrap">{r.name}</TableCell>
                <TableCell className="font-mono text-slate-400 whitespace-nowrap">Blok {r.block} / {r.number}</TableCell>
                <TableCell className="text-right pr-4">
                  <div className="flex items-center justify-end gap-1">
                    {isAdmin && (
                      <>
                        <EditResidentDialog resident={r} onSync={onSync} />
                        {deletingId === r.id ? (
                          <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-2 duration-200">
                             <button onClick={() => setDeletingId(null)} className="px-2 py-1 text-[9px] font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase">Batal</button>
                             <button onClick={() => handleDelete(r.id)} className="px-2 py-1 text-[9px] font-black bg-rose-600 text-white rounded-md hover:bg-rose-700 transition-colors uppercase shadow-sm">Hapus</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeletingId(r.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-rose-50 group-hover:opacity-100">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>
             </TableRow>
           ))}
        </TableBody>
      </Table>
    </div>
  );
}

// --- UPDATED MODAL COMPONENTS ---

function AddAnnouncementDialog({ onSync }: { onSync: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleAdd = async () => {
    if (!title || !content || !auth.currentUser) return;
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          title, 
          content, 
          date: new Date().toISOString(), 
          author: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Admin'
        })
      });
      if (res.ok) {
        onSync();
        setOpen(false); setTitle(''); setContent('');
      }
    } catch (e) {
      alert("Gagal mengirim pengumuman");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded font-black text-[12px] shadow-sm">+</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader><DialogTitle>Input Pengumuman</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Judul" className="font-bold h-11" />
          <textarea 
            value={content} 
            onChange={e => setContent(e.target.value)} 
            className="min-h-[150px] w-full rounded-md border border-slate-200 p-3 text-sm focus:ring-2 focus:ring-blue-600 outline-none"
            placeholder="Isi pengumuman..."
          />
        </div>
        <DialogFooter><Button onClick={handleAdd}>Posting</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddPaymentGlobal({ entries, residents, onSync }: { entries: Payment[], residents: Resident[], onSync: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="bg-blue-600 hover:bg-blue-700 h-8 px-4 text-xs font-black shadow-lg shadow-blue-200" />}>
        <Plus className="w-3.5 h-3.5 mr-1.5" /> INPUT IURAN BARU
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <PayIuranForm residents={residents} currentPayments={entries} onSync={onSync} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function PayIuranForm({ residents, currentPayments, onSuccess, onSync }: { residents: Resident[], currentPayments: Payment[], onSuccess: () => void, onSync: () => void }) {
  const [residentId, setResidentId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [amount, setAmount] = useState('15000');
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());

  const resident = residents.find(r => r.id === residentId);

  const filteredResidents = useMemo(() => {
    if (!searchQuery) return residents;
    const lowerQuery = searchQuery.toLowerCase();
    return residents.filter(r => 
      r.name.toLowerCase().includes(lowerQuery) || 
      r.block.toLowerCase().includes(lowerQuery) || 
      r.number.toLowerCase().includes(lowerQuery)
    );
  }, [residents, searchQuery]);

  const existingMonths = useMemo(() => {
    if (!residentId) return new Set<number>();
    const resPayments = currentPayments.filter(p => p.residentId === residentId && p.year === parseInt(year));
    const months = new Set<number>();
    resPayments.forEach(p => p.months.forEach(m => months.add(m)));
    return months;
  }, [residentId, year, currentPayments]);

  const toggleMonth = (mId: number) => {
    if (existingMonths.has(mId)) return;
    setSelectedMonths(prev => 
      prev.includes(mId) ? prev.filter(m => m !== mId) : [...prev, mId]
    );
  };

  const handleSave = async () => {
    if (!residentId || selectedMonths.length === 0 || !amount) return;

    try {
      const pId = crypto.randomUUID();
      const pDateStr = format(paymentDate, 'yyyy-MM-dd');
      const monthYearLabel = format(paymentDate, 'MMMM yyyy', { locale: localeID }).toUpperCase();

      const res = await fetch('/api/payments/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment: {
            id: pId,
            residentId,
            residentName: resident?.name || '',
            year: parseInt(year),
            months: selectedMonths,
            amount: parseInt(amount),
            paymentDate: pDateStr,
            createdAt: new Date().toISOString()
          },
          cashEntry: {
            id: crypto.randomUUID(),
            description: `PEROLEHAN IURAN BULAN ${monthYearLabel} (${resident?.name})`,
            date: pDateStr,
            type: 'income',
            amount: parseInt(amount),
            category: 'Iuran',
            createdAt: new Date().toISOString()
          }
        })
      });

      if (res.ok) {
        onSync();
        onSuccess();
      }
    } catch (e) {
      console.error(e);
      alert('Gagal menyimpan data.');
    }
  };

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="text-xl font-bold">Catat Pembayaran Iuran</DialogTitle>
      </DialogHeader>

      <div className="grid gap-5">
        <div className="grid gap-2">
          <Label className="text-[10px] uppercase font-black text-slate-400">Pilih Warga</Label>
          <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
            <PopoverTrigger render={<Button variant="outline" role="combobox" aria-expanded={isSearchOpen} className="h-11 bg-slate-50 border-none w-full justify-between font-normal" />}>
              {resident ? (
                <span className="flex items-center gap-2 overflow-hidden">
                  <span className="font-bold truncate">{resident.name}</span>
                  <span className="text-slate-400 text-[10px] font-mono shrink-0">Blok {resident.block}/{resident.number}</span>
                </span>
              ) : (
                <span className="text-slate-400">Pilih Nama Warga...</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </PopoverTrigger>
            <PopoverContent className="w-[--anchor-width] p-0 shadow-xl border-slate-100" align="start">
              <div className="flex items-center border-b border-slate-100 px-3 h-11">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <input
                  className="flex h-full w-full bg-transparent py-3 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Cari nama atau blok..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
              <ScrollArea className="max-h-[300px] overflow-y-auto">
                <div className="p-1">
                  {filteredResidents.length === 0 ? (
                    <div className="py-6 text-center text-sm text-slate-500">Warga tidak ditemukan.</div>
                  ) : (
                    filteredResidents.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => {
                          setResidentId(r.id);
                          setIsSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                          residentId === r.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <Check className={`h-4 w-4 shrink-0 transition-opacity ${residentId === r.id ? 'opacity-100' : 'opacity-0'}`} />
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-sm truncate">{r.name}</span>
                          <span className="text-[10px] opacity-70 font-mono">Blok {r.block}/{r.number}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Tahun Iuran</Label>
            <Input type="number" value={year} onChange={e => setYear(e.target.value)} className="bg-slate-50 border-none" />
          </div>
          <div className="grid gap-2">
            <Label>Tanggal Bayar</Label>
            <Popover>
              <PopoverTrigger render={<Button variant="outline" className={`w-full justify-start text-left font-normal bg-slate-50 border-none ${!paymentDate && "text-muted-foreground"}`} />}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {paymentDate ? format(paymentDate, "PPP", { locale: localeID }) : <span>Pilih Tanggal</span>}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={paymentDate} onSelect={(d) => d && setPaymentDate(d)} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="grid gap-3">
          <Label className="flex justify-between items-center">
            <span>Bulan yang Dibayar</span>
            <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-none">{selectedMonths.length} Bulan</Badge>
          </Label>
          <div className="grid grid-cols-4 gap-2">
            {MONTHS.map(m => {
              const paid = existingMonths.has(m.id);
              const selected = selectedMonths.includes(m.id);
              return (
                <button
                  key={m.id}
                  disabled={paid}
                  onClick={() => toggleMonth(m.id)}
                  className={`py-2 px-1 text-[10px] font-bold rounded-lg border transition-all ${
                    paid ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed line-through' :
                    selected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-blue-200'
                  }`}
                >
                  {m.name.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Total Nominal (Rp)</Label>
          <Input 
            type="number" 
            value={amount} 
            onChange={e => setAmount(e.target.value)} 
            className="bg-slate-50 border-none text-xl font-black text-slate-800"
            placeholder="Default 15.000"
          />
        </div>
      </div>

      <DialogFooter className="pt-4">
        <Button onClick={handleSave} className="w-full bg-slate-900 hover:bg-slate-800 h-12 text-md font-bold rounded-xl" disabled={!residentId || selectedMonths.length === 0}>
           SIMPAN PEMBAYARAN
        </Button>
      </DialogFooter>
    </div>
  );
}

function CashBookModule({ cashEntries, isAdmin, onSync }: { cashEntries: CashEntry[], isAdmin: boolean, onSync: () => void }) {
  const [filterMonth, setFilterMonth] = useState((new Date().getMonth() + 1).toString());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [openAdd, setOpenAdd] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CashEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredData = useMemo(() => {
    const raw = cashEntries.filter(entry => {
      const d = new Date(entry.date);
      return (d.getMonth() + 1) === parseInt(filterMonth) && d.getFullYear() === parseInt(filterYear);
    });

    const nonIuran = raw.filter(e => e.category !== 'Iuran');
    const iuranList = raw.filter(e => e.category === 'Iuran');

    const result = [...nonIuran];

    if (iuranList.length > 0) {
      const totalIuran = iuranList.reduce((acc, curr) => acc + curr.amount, 0);
      const monthLabel = MONTHS.find(m => m.id === parseInt(filterMonth))?.name.toUpperCase();
      
      result.push({
        id: `grouped-iuran-${filterMonth}-${filterYear}`,
        description: `PEROLEHAN IURAN BULAN ${monthLabel} ${filterYear}`,
        date: iuranList[0].date, // Use first date found
        type: 'income',
        amount: totalIuran,
        category: 'Iuran',
        isGrouped: true
      });
    }

    return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [cashEntries, filterMonth, filterYear]);

  const stats = useMemo(() => {
    const totalIncome = filteredData.filter(e => e.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
    const totalExpense = filteredData.filter(e => e.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense
    };
  }, [filteredData]);

  // Handle manual entry
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<'income' | 'expense'>('income');
  const [newDate, setNewDate] = useState<Date>(new Date());

  const handleAddManual = async () => {
    if (!newDesc || !newAmount) return;
    try {
      const res = await fetch('/api/cash-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          description: newDesc,
          date: format(newDate, 'yyyy-MM-dd'),
          type: newType,
          amount: parseInt(newAmount),
          category: 'Lain-lain'
        })
      });
      if (res.ok) {
        onSync();
        setOpenAdd(false);
        setNewDesc('');
        setNewAmount('');
      }
    } catch (e) { alert("Gagal menyimpan"); }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/cash-book/${id}`, { method: 'DELETE' });
      if (res.ok) onSync();
    } catch (e) { console.error(e); }
    setDeletingId(null);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Floating Voice Input FAB */}
      {isAdmin && (
        <VoiceInputFAB
          onParsed={(data) => {
            if (openAdd || editingEntry) {
              // If a dialog is open, fill its fields
              if (openAdd) {
                if (data.description) setNewDesc(data.description);
                if (data.amount) setNewAmount(data.amount.toString());
                if (data.type) setNewType(data.type);
                if (data.date) setNewDate(new Date(data.date));
              }
            } else {
              // Open add dialog with parsed data
              setNewDesc(data.description || '');
              setNewAmount(data.amount ? data.amount.toString() : '');
              setNewType(data.type || 'expense');
              if (data.date) setNewDate(new Date(data.date));
              setOpenAdd(true);
            }
          }}
        />
      )}

      {/* Edit Entry Dialog */}
      <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent className="sm:max-w-[450px]">
          {editingEntry && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle>Edit Transaksi Manual</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Uraian</Label>
                  <Input 
                    value={editingEntry.description} 
                    onChange={e => setEditingEntry({...editingEntry, description: e.target.value})} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Tipe</Label>
                    <Select 
                      value={editingEntry.type} 
                      onValueChange={(v: any) => setEditingEntry({...editingEntry, type: v})}
                    >
                      <SelectTrigger>
                        <SelectValue>{editingEntry.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Pemasukan</SelectItem>
                        <SelectItem value="expense">Pengeluaran</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Tanggal</Label>
                    <Popover>
                      <PopoverTrigger render={<Button variant="outline" className="w-full justify-start text-left font-normal border-slate-200" />}>
                        {editingEntry.date ? format(new Date(editingEntry.date), "dd/MM/yyyy") : <span>Pilih</span>}
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar 
                          mode="single" 
                          selected={new Date(editingEntry.date)} 
                          onSelect={(d) => d && setEditingEntry({...editingEntry, date: format(d, 'yyyy-MM-dd')})} 
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Nominal (Rp)</Label>
                  <Input 
                    type="number" 
                    value={editingEntry.amount} 
                    onChange={e => setEditingEntry({...editingEntry, amount: parseInt(e.target.value) || 0})} 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/cash-book/${editingEntry.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          description: editingEntry.description,
                          date: editingEntry.date,
                          type: editingEntry.type,
                          amount: editingEntry.amount
                        })
                      });
                      if (res.ok) onSync();
                    } catch (e) { console.error(e); }
                    setEditingEntry(null);
                  }} 
                  className="w-full"
                >
                  Simpan Perubahan
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <div className="grid gap-4 md:grid-cols-3 shrink-0">
        <div className="bg-blue-600 p-5 rounded-2xl shadow-[0_10px_40px_rgba(37,99,235,0.25)] border-b-4 border-blue-700">
          <div className="text-[10px] font-black uppercase tracking-widest text-blue-100/80 mb-2">Total Pemasukan</div>
          <div className="text-2xl font-black text-white">{CURRENCY_FORMATTER.format(stats.totalIncome)}</div>
        </div>
        <div className="bg-rose-600 p-5 rounded-2xl shadow-[0_10px_40px_rgba(225,29,72,0.25)] border-b-4 border-rose-700">
          <div className="text-[10px] font-black uppercase tracking-widest text-rose-100/80 mb-2">Total Pengeluaran</div>
          <div className="text-2xl font-black text-white">{CURRENCY_FORMATTER.format(stats.totalExpense)}</div>
        </div>
        <div className="bg-slate-800 p-5 rounded-2xl shadow-[0_10px_40px_rgba(30,41,59,0.25)] border-b-4 border-slate-900">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Saldo Kas (Bulan Ini)</div>
          <div className="text-2xl font-black text-white">{CURRENCY_FORMATTER.format(stats.balance)}</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 md:p-8 bg-white border-b border-slate-100">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">Buku Kas RT</h2>
              <p className="font-medium text-slate-500 mt-1">Laporan arus kas bulanan yang transparan.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-2">
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger className="w-[160px] bg-slate-50 border-none font-bold text-slate-700">
                    <SelectValue>
                      {MONTHS.find(m => m.id.toString() === filterMonth)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(m => (
                      <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center bg-slate-50 rounded-md px-3 h-10">
                  <span className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-tighter shrink-0">Tahun</span>
                  <input 
                    type="number" 
                    className="w-16 bg-transparent outline-none font-bold text-slate-700"
                    value={filterYear} 
                    onChange={e => setFilterYear(e.target.value)} 
                  />
                </div>
              </div>
              {isAdmin && (
                <Dialog open={openAdd} onOpenChange={setOpenAdd}>
                   <DialogTrigger render={<Button className="bg-slate-900 hover:bg-slate-800 shadow-lg px-6" />}>
                     <Plus className="w-4 h-4 mr-2" /> Manual Transaksi
                   </DialogTrigger>
                   <DialogContent className="sm:max-w-[450px]">
                      <DialogHeader>
                        <DialogTitle>Input Transaksi Manual</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label>Uraian</Label>
                          <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Contoh: Pembelian Sapu" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label>Tipe</Label>
                            <Select value={newType} onValueChange={(v: any) => setNewType(v)}>
                              <SelectTrigger>
                                <SelectValue>{newType === 'income' ? 'Pemasukan' : 'Pengeluaran'}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="income">Pemasukan</SelectItem>
                                <SelectItem value="expense">Pengeluaran</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Tanggal</Label>
                            <Popover>
                              <PopoverTrigger render={<Button variant="outline" className={`w-full justify-start text-left font-normal border-slate-200 ${!newDate && "text-muted-foreground"}`} />}>
                                {newDate ? format(newDate, "dd/MM/yyyy") : <span>Pilih</span>}
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={newDate} onSelect={(d) => d && setNewDate(d)} />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label>Nominal (Rp)</Label>
                          <Input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAddManual} className="w-full">Simpan Transaksi</Button>
                      </DialogFooter>
                   </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </div>
        <div className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50 border-b border-slate-50">
                <TableRow>
                  <TableHead className="pl-8 py-5 font-black text-slate-500 uppercase text-[11px] tracking-widest">Tanggal</TableHead>
                  <TableHead className="py-5 font-black text-slate-500 uppercase text-[11px] tracking-widest">Uraian</TableHead>
                  <TableHead className="py-5 font-black text-slate-500 uppercase text-[11px] tracking-widest text-right">Masuk</TableHead>
                  <TableHead className="py-5 font-black text-slate-500 uppercase text-[11px] tracking-widest text-right">Keluar</TableHead>
                  <TableHead className="pr-8 py-5 w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50 transition-colors border-slate-50 group">
                    <TableCell className="pl-8 py-4 font-mono text-[11px] font-bold text-slate-400">
                      {format(new Date(item.date), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                         <div className={`w-1.5 h-1.5 rounded-full ${item.type === 'income' ? 'bg-green-500' : 'bg-red-500'}`} />
                         <span className="font-bold text-slate-700">{item.description}</span>
                      </div>
                      {(item.paymentId || item.isGrouped) && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge className="bg-green-50 text-[9px] text-green-600 font-bold border-none uppercase tracking-tighter">
                            IURAN OTOMATIS
                          </Badge>
                          {item.isGrouped && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const msgDesc = item.description.charAt(0).toUpperCase() + item.description.slice(1).toLowerCase();
                                const message = `📢 *INFO KAS RT*\n\nTerima kasih atas partisipasi seluruh warga. ${msgDesc} telah terkumpul sebesar *Rp ${item.amount.toLocaleString('id-ID')}*.\n\nUntuk detail lengkap pemasukan dan pengeluaran dapat dilihat di link:\n${window.location.origin}\n\nMari bersama kita bangun lingkungan yang lebih baik! 🙏`;
                                window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                              }}
                              className="inline-flex items-center justify-center bg-[#25D366] text-white rounded-full p-1.5 w-6 h-6 shadow-sm hover:scale-110 hover:shadow-md active:scale-95 transition-all"
                              title="Bagikan perolehan iuran bulan ini ke WhatsApp"
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.878-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            </button>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className={`py-4 text-right font-black ${item.type === 'income' ? 'text-green-600' : 'text-slate-200'}`}>
                      {item.type === 'income' ? `Rp ${item.amount.toLocaleString('id-ID')}` : '-'}
                    </TableCell>
                    <TableCell className={`py-4 text-right font-black ${item.type === 'expense' ? 'text-red-500' : 'text-slate-200'}`}>
                      {item.type === 'expense' ? `Rp ${item.amount.toLocaleString('id-ID')}` : '-'}
                    </TableCell>
                    <TableCell className="pr-8 py-4 text-right">
                       {isAdmin && !item.isGrouped && (
                         <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {deletingId === item.id ? (
                              <div className="flex items-center gap-1 bg-white border border-red-100 p-1 rounded-lg animate-in fade-in slide-in-from-right-2 duration-200">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => setDeletingId(null)} 
                                  className="h-7 px-2 text-[10px] font-bold text-slate-400"
                                >
                                  Batal
                                </Button>
                                <Button 
                                  variant="destructive" 
                                  size="sm" 
                                  onClick={() => handleDelete(item.id)} 
                                  className="h-7 px-2 text-[10px] font-black uppercase"
                                >
                                  Hapus
                                </Button>
                              </div>
                            ) : (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => setEditingEntry(item)} 
                                  className="text-slate-300 hover:text-blue-600"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => setDeletingId(item.id)} 
                                  className="text-slate-300 hover:text-red-500"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                         </div>
                       )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredData.length === 0 && (
                  <TableRow>
                     <TableCell colSpan={5} className="h-60 text-center">
                        <div className="flex flex-col items-center gap-2">
                           <Filter className="w-12 h-12 text-slate-100" />
                           <p className="text-slate-300 font-medium italic">Tidak ada transaksi ditemukan pada periode ini.</p>
                        </div>
                     </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
      
      <div className="bg-slate-900 rounded-3xl p-8 text-white flex flex-col md:flex-row justify-between items-center gap-6">
         <div>
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-1">Status Keuangan Terakhir</p>
            <h3 className="text-2xl font-black text-white">Saldo Akhir Kumulatif</h3>
         </div>
         <div className="text-right">
            <p className="text-orange-500 font-black text-4xl tracking-tighter">
              {CURRENCY_FORMATTER.format(cashEntries.reduce((acc, curr) => curr.type === 'income' ? acc + curr.amount : acc - curr.amount, 0))}
            </p>
            <p className="text-[9px] text-slate-500 font-mono mt-1 uppercase">SINKRONISASI REALTIME FIRESTORE</p>
         </div>
      </div>
    </div>
  );
}

function AdminManagement({ users, currentUserUid, settings, residents, payments, onSync }: { users: AppUser[], currentUserUid: string, settings: AppSettings | null, residents: Resident[], payments: Payment[], onSync: () => void }) {
  const toggleStatus = async (user: AppUser) => {
    if (user.uid === currentUserUid) {
      alert("Anda tidak bisa menonaktifkan akun sendiri.");
      return;
    }
    const res = await fetch(`/api/users/${user.uid}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !user.isActive })
    });
    if (res.ok) onSync();
  };

  return (
    <div className="p-0">
      <Tabs defaultValue="list" className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-xl mx-6 mb-4">
          <TabsTrigger value="list" className="rounded-lg font-bold text-xs px-6">Daftar Admin</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg font-bold text-xs px-6">Pengaturan RT</TabsTrigger>
          <TabsTrigger value="import" className="rounded-lg font-bold text-xs px-6">Impor Data</TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader className="bg-slate-50 uppercase text-[10px] font-black text-slate-400 tracking-widest">
                 <TableRow>
                    <TableHead className="pl-4">Admin</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-4">Aksi</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                 {users.map(u => (
                   <TableRow key={u.uid} className="text-xs">
                      <TableCell className="pl-4 font-bold text-slate-700">
                        <div className="flex items-center gap-2">
                          {u.photoURL && <img src={u.photoURL} alt="" className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />}
                          {u.displayName}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-slate-400">{u.email}</TableCell>
                      <TableCell>
                        {u.isActive ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-none text-[9px] font-black">AKTIF</Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-400 border-none text-[9px] font-black">PENDING</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <Button 
                          size="xs" 
                          variant={u.isActive ? "destructive" : "default"}
                          onClick={() => toggleStatus(u)}
                          disabled={u.uid === currentUserUid}
                          className="text-[9px] font-bold h-6"
                        >
                          {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        </Button>
                      </TableCell>
                   </TableRow>
                 ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="settings">
           <SettingsForm settings={settings} onSync={onSync} />
        </TabsContent>
        <TabsContent value="import">
           <LegacyImporter settings={settings} residents={residents} payments={payments} onSync={onSync} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- SHARED COMPONENTS ---

function AuthDialog() {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      setOpen(false);
    } catch (e: any) {
      alert('Login Gagal: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="bg-slate-900 hover:bg-slate-800 shadow-md" />}>
        <LogIn className="w-4 h-4 mr-2" /> Login Admin
      </DialogTrigger>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <div className="mx-auto bg-blue-600 p-3 rounded-2xl mb-4">
             <Receipt className="text-white w-8 h-8" />
          </div>
          <DialogTitle className="text-center text-xl font-black">Akses Bendahara & Pengurus</DialogTitle>
          <CardDescription className="text-center font-medium text-slate-500 text-xs">
            Gunakan Akun Google untuk masuk ke dashboard pengelolaan.
          </CardDescription>
        </DialogHeader>
        <div className="py-6">
          <Button 
            disabled={loading} 
            onClick={handleLogin} 
            className="w-full bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 h-12 text-sm font-bold rounded-xl shadow-sm flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
          >
            {loading ? (
              'Menghubungkan...'
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Masuk dengan Google
              </>
            )}
          </Button>
          
          <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
             <div className="flex gap-3">
               <ShieldCheck className="w-10 h-10 text-blue-600 shrink-0" />
               <div>
                  <p className="text-[11px] font-bold text-slate-800 uppercase tracking-tight mb-1">Kebijakan Akses</p>
                  <p className="text-[10px] leading-relaxed text-slate-500 font-medium">
                    Akses admin baru harus disetujui oleh admin pertama. Silakan login terlebih dahulu untuk status pending, kemudian hubungi Ketua RT/Bendahara untuk aktivasi.
                  </p>
               </div>
             </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddResidentDialog({ onSync }: { onSync: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [block, setBlock] = useState('');
  const [number, setNumber] = useState('');

  const handleAdd = async () => {
    if (!name) return;
    try {
      const res = await fetch('/api/residents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          name, 
          block, 
          number: (number || '-')
        })
      });
      if (res.ok) {
        onSync();
        setOpen(false);
        setName(''); setBlock(''); setNumber('');
      }
    } catch (e) { alert("Gagal menambah warga"); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="rounded-xl border-slate-200 h-9 font-bold text-xs" />}>
        <UserPlus className="w-4 h-4 mr-2" /> TAMBAH WARGA
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <ResidentForm 
          title="Data Warga Baru" 
          submitLabel="Daftarkan Warga"
          onSave={handleAdd}
          name={name} setName={setName}
          block={block} setBlock={setBlock}
          number={number} setNumber={setNumber}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditResidentDialog({ resident, onSync }: { resident: Resident, onSync: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(resident.name);
  const [block, setBlock] = useState(resident.block || '');
  const [number, setNumber] = useState(resident.number || '');

  const handleEdit = async () => {
    if (!name) return;
    try {
      const res = await fetch(`/api/residents/${resident.id}`, {
        method: 'POST', // Use POST for update if PUT not specifically defined for residents, or we can use PUT
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, block, number: (number || '-') })
      });
      if (res.ok) onSync();
    } catch (e) { console.error(e); }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<button className="p-1 text-slate-300 hover:text-blue-600 transition-colors" />}>
        <Edit className="w-3.5 h-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <ResidentForm 
          title="Edit Data Warga" 
          submitLabel="Simpan Perubahan"
          onSave={handleEdit}
          name={name} setName={setName}
          block={block} setBlock={setBlock}
          number={number} setNumber={setNumber}
        />
      </DialogContent>
    </Dialog>
  );
}

function ResidentForm({ 
  title, 
  submitLabel, 
  onSave, 
  name, setName, 
  block, setBlock, 
  number, setNumber 
}: any) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-5 py-4">
        <div className="grid gap-2">
          <Label className="text-[10px] uppercase font-black text-slate-400">Nama Lengkap</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nama Warga" className="h-11 bg-slate-50 border-none" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label className="text-[10px] uppercase font-black text-slate-400">Blok</Label>
            <Input value={block} onChange={e => setBlock(e.target.value)} placeholder="A" className="h-11 bg-slate-50 border-none" />
          </div>
          <div className="grid gap-2">
            <Label className="text-[10px] uppercase font-black text-slate-400">Nomor Rumah</Label>
            <Input value={number} onChange={e => setNumber(e.target.value)} placeholder="01" className="h-11 bg-slate-50 border-none" />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={onSave} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-sm font-bold rounded-xl shadow-lg shadow-blue-100">{submitLabel}</Button>
      </DialogFooter>
    </>
  );
}

function VoiceInputFAB({ onParsed }: { onParsed: (data: any) => void }) {
  const [isListening, setIsListening] = useState(false);
  const [lastText, setLastText] = useState('');

  const MONTH_MAP: Record<string, number> = {
    'januari': 1, 'februari': 2, 'maret': 3, 'april': 4,
    'mei': 5, 'juni': 6, 'juli': 7, 'agustus': 8,
    'september': 9, 'oktober': 10, 'november': 11, 'desember': 12,
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4,
    'ags': 8, 'sep': 9, 'okt': 10, 'nov': 11, 'des': 12
  };

  const parseVoice = (text: string) => {
    const lowerText = text.toLowerCase();

    // 1. Detect type
    let type = 'expense';
    const incomeKw = ['masuk', 'iuran', 'terima', 'donasi', 'setoran', 'saldo', 'pemasukan', 'pendapatan'];
    if (incomeKw.some(kw => lowerText.includes(kw))) type = 'income';

    // 2. Extract amount - match patterns like "Rp50.000", "50000", "50 ribu", "1 juta"
    let amount = 0;
    // Try "Rp" prefix patterns first: "rp50.000", "rp 50.000"
    const rpMatch = lowerText.match(/rp\.?\s*(\d[\d.,]*)/);
    if (rpMatch) {
      amount = parseInt(rpMatch[1].replace(/[.,]/g, '')) || 0;
    }
    // Try "ribu" / "juta" patterns: "50 ribu", "1,5 juta"
    if (!amount) {
      const ribuMatch = lowerText.match(/(\d+[.,]?\d*)\s*ribu/);
      if (ribuMatch) amount = Math.round(parseFloat(ribuMatch[1].replace(',', '.')) * 1000);
      const jutaMatch = lowerText.match(/(\d+[.,]?\d*)\s*juta/);
      if (jutaMatch) amount = Math.round(parseFloat(jutaMatch[1].replace(',', '.')) * 1000000);
    }
    // Fallback: find standalone number groups (but NOT dates)
    if (!amount) {
      // Remove date-like patterns first (e.g., "19 maret 2026")
      let cleaned = lowerText;
      const monthNames = Object.keys(MONTH_MAP);
      // Remove "tanggal X" and "DD bulan YYYY" patterns
      cleaned = cleaned.replace(/tanggal\s+\d+/g, '');
      for (const mn of monthNames) {
        cleaned = cleaned.replace(new RegExp(`\\d+\\s+${mn}\\s+\\d{4}`, 'g'), '');
        cleaned = cleaned.replace(new RegExp(`\\d+\\s+${mn}`, 'g'), '');
      }
      const numMatch = cleaned.match(/(\d[\d.,]{2,})/);
      if (numMatch) amount = parseInt(numMatch[1].replace(/[.,]/g, '')) || 0;
    }

    // 3. Extract date
    let dateStr = format(new Date(), 'yyyy-MM-dd');
    if (lowerText.includes('kemarin')) {
      const d = new Date(); d.setDate(d.getDate() - 1);
      dateStr = format(d, 'yyyy-MM-dd');
    } else if (lowerText.includes('lusa') || lowerText.includes('kemarin lusa')) {
      const d = new Date(); d.setDate(d.getDate() - 2);
      dateStr = format(d, 'yyyy-MM-dd');
    } else {
      // Try to match "tanggal DD bulan" or "DD bulan YYYY" or "DD bulan"
      for (const [monthName, monthNum] of Object.entries(MONTH_MAP)) {
        const withYear = lowerText.match(new RegExp(`(\\d{1,2})\\s+${monthName}\\s+(\\d{4})`));
        if (withYear) {
          const day = parseInt(withYear[1]);
          const yr = parseInt(withYear[2]);
          if (day >= 1 && day <= 31) {
            dateStr = `${yr}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            break;
          }
        }
        const noYear = lowerText.match(new RegExp(`(\\d{1,2})\\s+${monthName}`));
        if (noYear) {
          const day = parseInt(noYear[1]);
          if (day >= 1 && day <= 31) {
            dateStr = `${new Date().getFullYear()}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            break;
          }
        }
      }
      // Try "tanggal DD"
      if (dateStr === format(new Date(), 'yyyy-MM-dd')) {
        const tglMatch = lowerText.match(/tanggal\s+(\d{1,2})/);
        if (tglMatch) {
          const day = parseInt(tglMatch[1]);
          if (day >= 1 && day <= 31) {
            const now = new Date();
            dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          }
        }
      }
    }

    // 4. Clean description - remove amount and date parts
    let desc = text;
    // Remove Rp amounts
    desc = desc.replace(/[Rr]p\.?\s*\d[\d.,]*/g, '').trim();
    // Remove "ribu"/"juta" amounts  
    desc = desc.replace(/\d+[.,]?\d*\s*(ribu|juta)/gi, '').trim();
    // Remove "tanggal DD bulan YYYY" patterns
    for (const mn of Object.keys(MONTH_MAP)) {
      const re1 = new RegExp(`tanggal\\s+\\d+\\s+${mn}\\s+\\d{4}`, 'gi');
      const re2 = new RegExp(`tanggal\\s+\\d+\\s+${mn}`, 'gi');
      const re3 = new RegExp(`\\d+\\s+${mn}\\s+\\d{4}`, 'gi');
      const re4 = new RegExp(`\\d+\\s+${mn}`, 'gi');
      desc = desc.replace(re1, '').replace(re2, '').replace(re3, '').replace(re4, '').trim();
    }
    desc = desc.replace(/tanggal\s+\d+/gi, '').trim();
    desc = desc.replace(/kemarin\s*(lusa)?/gi, '').trim();
    // Clean up multiple spaces
    desc = desc.replace(/\s{2,}/g, ' ').trim();
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);

    return { description: desc, amount, type, date: dateStr };
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Browser Anda tidak mendukung fitur suara.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => { setIsListening(true); setLastText(''); };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setLastText(text);
      onParsed(parseVoice(text));
    };
    recognition.start();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {lastText && (
        <div className="bg-slate-900 text-white text-[11px] px-3 py-2 rounded-xl shadow-lg max-w-[250px] animate-in fade-in slide-in-from-bottom-2">
          <div className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">Terdengar:</div>
          <div className="font-medium">"{lastText}"</div>
        </div>
      )}
      <button
        onClick={startListening}
        disabled={isListening}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-90 ${
          isListening
            ? 'bg-red-500 shadow-red-200 animate-pulse scale-110'
            : 'bg-blue-600 hover:bg-blue-500 shadow-blue-200 hover:scale-105'
        }`}
      >
        {isListening ? (
          <MicOff className="w-6 h-6 text-white" />
        ) : (
          <Mic className="w-6 h-6 text-white" />
        )}
      </button>
      {isListening && (
        <div className="text-[10px] font-bold text-red-500 animate-pulse text-center">Mendengarkan...</div>
      )}
    </div>
  );
}

function SettingsForm({ settings, onSync }: { settings: AppSettings | null, onSync: () => void }) {
  const [loading, setLoading] = useState(false);
  const [rtNumber, setRtNumber] = useState(settings?.rtNumber || '');
  const [rwNumber, setRwNumber] = useState(settings?.rwNumber || '');
  const [dusun, setDusun] = useState(settings?.dusun || '');
  const [village, setVillage] = useState(settings?.village || '');
  const [district, setDistrict] = useState(settings?.district || '');
  const [regency, setRegency] = useState(settings?.regency || '');
  const [defaultIuran, setDefaultIuran] = useState(settings?.defaultIuran?.toString() || '15000');
  const [logoUrl, setLogoUrl] = useState(settings?.logoUrl || '');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        alert("Ukuran file terlalu besar (maks 500KB)");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!rtNumber || !village || !district || !regency || !defaultIuran) {
       alert("Mohon lengkapi semua field wajib (*)");
       return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rtNumber,
          rwNumber,
          dusun,
          village,
          district,
          regency,
          defaultIuran: parseInt(defaultIuran),
          logoUrl
        })
      });
      if (res.ok) {
        onSync();
        alert("Pengaturan berhasil disimpan!");
      }
    } catch (error) {
      console.error(error);
      alert("Gagal menyimpan pengaturan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl bg-white rounded-3xl border border-slate-100 shadow-sm mx-6 mb-10">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-50">
        <div className="bg-slate-900 p-2 rounded-xl">
          <Settings className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-800">Konfigurasi Unit RT</h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Identitas Wilayah & Iuran Dasar</p>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-400">Nomor RT *</Label>
                <Input value={rtNumber} onChange={e => setRtNumber(e.target.value)} placeholder="005" className="h-11 bg-slate-50 border-none" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-400">Nomor RW (Opsional)</Label>
                <Input value={rwNumber} onChange={e => setRwNumber(e.target.value)} placeholder="002" className="h-11 bg-slate-50 border-none" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[10px] uppercase font-black text-slate-400">Dusun (Opsional)</Label>
              <Input value={dusun} onChange={e => setDusun(e.target.value)} placeholder="Dusun Karang" className="h-11 bg-slate-50 border-none" />
            </div>
          </div>
          <div className="w-full md:w-32 flex flex-col items-center justify-center gap-3">
             <Label className="text-[10px] uppercase font-black text-slate-400 text-center">Logo RT</Label>
             <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden relative group">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-300" />
                )}
                <label className="absolute inset-0 bg-black/60 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[10px] font-bold">
                  <Upload className="w-4 h-4 mb-1" /> GANTI
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                </label>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label className="text-[10px] uppercase font-black text-slate-400">Desa / Kelurahan *</Label>
            <Input value={village} onChange={e => setVillage(e.target.value)} placeholder="..." className="h-11 bg-slate-50 border-none" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-[10px] uppercase font-black text-slate-400">Kecamatan *</Label>
            <Input value={district} onChange={e => setDistrict(e.target.value)} placeholder="..." className="h-11 bg-slate-50 border-none" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-[10px] uppercase font-black text-slate-400">Kabupaten / Kota *</Label>
            <Input value={regency} onChange={e => setRegency(e.target.value)} placeholder="..." className="h-11 bg-slate-50 border-none" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-[10px] uppercase font-black text-slate-400">Iuran Bulanan Default (Rp) *</Label>
            <Input type="number" value={defaultIuran} onChange={e => setDefaultIuran(e.target.value)} placeholder="15000" className="h-11 bg-slate-50 border-none font-bold text-blue-600" />
          </div>
        </div>

        <Button onClick={handleSave} disabled={loading} className="h-14 bg-slate-900 hover:bg-slate-800 rounded-2xl font-black text-sm tracking-widest uppercase shadow-xl shadow-slate-200 mt-4">
          {loading ? "Menyimpan..." : "Update Konfigurasi RT"}
        </Button>
      </div>
    </div>
  );
}

function LegacyImporter({ settings, residents, payments, onSync }: { settings: AppSettings | null, residents: Resident[], payments: Payment[], onSync: () => void }) {
  const [csvText, setCsvText] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const handleImport = async () => {
    if (!csvText.trim()) return;
    setLoading(true);
    setLogs([]);
    const addLog = (msg: string) => setLogs(prev => [...prev.slice(-4), msg]);

    try {
      const allLines = csvText.trim().split('\n');
      const headerLine = allLines[0];
      const dataLines = allLines.slice(1);
      
      const detectDelimiter = (text: string) => {
        if (text.includes('\t')) return '\t';
        if (text.includes(';')) return ';';
        if (text.includes(',')) return ',';
        return /\s{2,}/; // Multiple spaces
      };

      const delimiter = detectDelimiter(headerLine);

      // Parse headers to build month mapping
      const headerParts = headerLine.split(delimiter).map(p => p.trim()).filter(p => p !== '');
      const monthMap: { idx: number; month: number; year: number }[] = [];
      const monthNames = [
        ['jan', 'januari'], ['feb', 'februari'], ['mar', 'maret'], ['apr', 'april'],
        ['mei', 'may'], ['jun', 'juni'], ['jul', 'juli'], ['agu', 'agt', 'august', 'agustus'],
        ['sep', 'september'], ['okt', 'october', 'oktober'], ['nov', 'november'], ['des', 'december', 'desember']
      ];

      headerParts.forEach((h, idx) => {
        if (idx === 0) return; // Skip Name column
        const lowerH = h.toLowerCase();
        
        let month = -1;
        monthNames.forEach((names, mIdx) => {
          if (names.some(n => lowerH.includes(n))) month = mIdx + 1;
        });

        if (month !== -1) {
          const yearMatch = lowerH.match(/(\d{2,4})/);
          let year = new Date().getFullYear();
          if (yearMatch) {
            const y = yearMatch[0];
            year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
          }
          monthMap.push({ idx, month, year });
        }
      });

      if (monthMap.length === 0) {
        throw new Error("Tidak menemukan nama bulan di baris pertama. Pastikan baris pertama adalah header (Nama, Jan, Feb, dst)");
      }

      addLog(`Menemukan ${monthMap.length} kolom bulan.`);

      // Store results for bulk insert
      const importResidents: any[] = [];
      const importPayments: any[] = [];
      const importCash: any[] = [];

      // Use current residents state instead of Firebase
      const residentsMap = new Map();
      residents.forEach(res => residentsMap.set(res.name.toLowerCase().trim(), res.id));

      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i].trim();
        if (!line || line.startsWith('TOTAL')) continue;

        const parts = line.split(delimiter).map(p => p.trim());
        if (parts.length < 2) continue;

        const nameRaw = parts[0];
        if (!nameRaw || nameRaw.toLowerCase() === 'total') continue;
        
        const name = nameRaw.replace(/^["']|["']$/g, '');
        addLog(`Memproses: ${name}...`);

        const residentKey = name.toLowerCase().trim();
        let residentId = residentsMap.get(residentKey);
        
        if (!residentId) {
          residentId = crypto.randomUUID();
          importResidents.push({
            id: residentId,
            name,
            block: '-',
            number: '-',
            createdAt: new Date().toISOString()
          });
          residentsMap.set(residentKey, residentId);
          addLog(`Warga baru: ${name}`);
        }

        for (const mi of monthMap) {
          if (mi.idx >= parts.length) continue;
          const val = parts[mi.idx]?.toLowerCase();
          if (val && val !== '') {
            let amount = 0;
            if (val === 'lunas' || val === 'v') {
              amount = settings?.defaultIuran || 15000;
            } else {
              amount = parseInt(val.replace(/[^\d]/g, '')) || 0;
            }

            if (amount > 0) {
              const pDate = new Date(mi.year, mi.month - 1, 1);
              const pDateStr = format(pDate, 'yyyy-MM-dd');
              
              // Local duplicate check
              const isDuplicate = payments.some(p => 
                p.residentId === residentId && 
                p.year === mi.year && 
                p.months.includes(mi.month)
              );

              if (!isDuplicate) {
                const pId = crypto.randomUUID();
                importPayments.push({
                  id: pId,
                  residentId,
                  residentName: name,
                  year: mi.year,
                  months: [mi.month],
                  amount,
                  paymentDate: pDateStr,
                  createdAt: new Date().toISOString()
                });

                // Check for manual cash entries linked to this? No, we skip if cash entry exists too
                const monthYearLabel = format(pDate, 'MMMM yyyy', { locale: localeID }).toUpperCase();
                importCash.push({
                  id: crypto.randomUUID(),
                  description: `PEROLEHAN IURAN BULAN ${monthYearLabel} (${name})`,
                  date: pDateStr,
                  type: 'income',
                  amount,
                  category: 'Iuran',
                  paymentId: pId,
                  createdAt: new Date().toISOString()
                });
                addLog(`Siap: ${name} - ${mi.month}/${mi.year}`);
              } else {
                // If payment exists, maybe check if cash entry exists?
                // For simplicity, if payment exists we skip to avoid balance messy
              }
            }
          }
        }
      }

      const res = await fetch('/api/import/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residents: importResidents,
          payments: importPayments,
          cashEntries: importCash
        })
      });

      if (res.ok) {
        addLog("Data terkirim ke server!");
        alert("Impor Selesai!");
        onSync();
        setCsvText('');
      } else {
        throw new Error("Gagal mengirim data ke server");
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Terjadi kesalahan saat impor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
       <div className="flex items-center gap-4 bg-blue-50 p-6 rounded-3xl border border-blue-100">
          <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-200">
             <FileUp className="w-6 h-6 text-white" />
          </div>
          <div>
             <h3 className="text-xl font-black text-slate-800">Impor Data Legacy</h3>
             <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Salin data Excel/CSV ke kotak di bawah</p>
          </div>
       </div>

       <div className="grid gap-4">
          <textarea 
             className="min-h-[300px] w-full bg-slate-50 border-none rounded-3xl p-6 font-mono text-xs leading-relaxed focus:ring-2 focus:ring-blue-500 outline-none"
             placeholder="NAMA,NOV,DES,JAN,Extra,FEB,Extra,MAR,APR,MEI,JUNI,JULI,AGUSTUS,SEPTEMBER,OKTOBER,NOVEMBER,DESEMBER"
             value={csvText}
             onChange={e => setCsvText(e.target.value)}
          />
          
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
             <div className="flex-1">
                {logs.length > 0 && (
                   <div className="space-y-1">
                      {logs.map((l, i) => (
                         <div key={i} className="text-[10px] font-mono text-slate-400 flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-blue-400" /> {l}
                         </div>
                      ))}
                   </div>
                )}
             </div>
             <Button 
                onClick={handleImport} 
                disabled={loading || !csvText.trim()} 
                className="h-14 px-10 bg-slate-900 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-slate-200"
             >
                {loading ? "Sedang Memproses..." : "Mulai Impor Data"}
             </Button>
          </div>
       </div>

       <div className="bg-amber-50 rounded-2xl p-4 flex gap-3 border border-amber-100">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-xs text-amber-900 font-bold uppercase tracking-wide mb-1">Panduan Format</p>
            <ul className="text-[10px] text-amber-800/80 space-y-1 list-disc pl-4">
              <li>Header kolom pertama harus Nama Warga.</li>
              <li>Kolom berikutnya mengikuti urutan: Nov(23), Des(23), Jan(24), Extra, Feb(24), Extra, Mar(24)... hingga Des(24).</li>
              <li>Angka dapat menggunakan format ribuan (misal: 15.000).</li>
              <li>Kata <b>lunas</b> akan dikonversi ke nominal iuran default.</li>
            </ul>
          </div>
       </div>
    </div>
  );
}
