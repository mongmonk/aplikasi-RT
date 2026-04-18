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
  Users
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

import { 
  onAuthStateChanged, 
  signInWithPopup,
  signOut,
  User 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  where, 
  orderBy, 
  setDoc,
  serverTimestamp,
  writeBatch,
  getDocs,
  limit,
  updateDoc,
  getDoc,
  getDocFromServer
} from 'firebase/firestore';

import { auth, db, googleProvider } from '@/lib/firebase';
import { Announcement, Resident, Payment, CashEntry, AppUser } from '@/lib/types';

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
  
  // Data State
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Auth & Sync AppUser
  useEffect(() => {
    let unsubSnapshot: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      // Cleanup previous snapshot listener if it exists
      if (unsubSnapshot) {
        unsubSnapshot();
        unsubSnapshot = null;
      }

      if (u) {
        const userDocRef = doc(db, 'users', u.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          const usersSnap = await getDocs(query(collection(db, 'users'), limit(1)));
          const isActive = usersSnap.empty; 
          
          const newUser: AppUser = {
            uid: u.uid,
            email: u.email || '',
            displayName: u.displayName || 'Warga RT',
            photoURL: u.photoURL || '',
            isActive,
            createdAt: new Date().toISOString()
          };
          await setDoc(userDocRef, newUser);
          setAppUser(newUser);
        }

        // Start listening to the user document for real-time status updates
        unsubSnapshot = onSnapshot(userDocRef, (snap) => {
          if (snap.exists()) {
            setAppUser(snap.data() as AppUser);
          }
        });
      } else {
        setAppUser(null);
      }
    });

    return () => {
      unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, []);

  // Sync All Users (Admin only)
  useEffect(() => {
    if (appUser?.isActive) {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      return onSnapshot(q, (snap) => {
        setAllUsers(snap.docs.map(doc => doc.data() as AppUser));
      });
    }
  }, [appUser?.isActive]);

  // Sync Data
  useEffect(() => {
    // Standard connection test
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log("CONNECTED");
      } catch (error) {
        console.error("Firebase Connection Error:", error);
      }
    };
    testConnection();

    const qA = query(collection(db, 'announcements'), orderBy('date', 'desc'));
    const unsubA = onSnapshot(qA, (snap) => {
      setAnnouncements(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
    });

    const qR = query(collection(db, 'residents'), orderBy('name', 'asc'));
    const unsubR = onSnapshot(qR, (snap) => {
      setResidents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Resident)));
    });

    const qP = query(collection(db, 'payments'), orderBy('paymentDate', 'desc'));
    const unsubP = onSnapshot(qP, (snap) => {
      setPayments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
    });

    const qC = query(collection(db, 'cash_book'), orderBy('date', 'desc'));
    const unsubC = onSnapshot(qC, (snap) => {
      setCashEntries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashEntry)));
    });

    return () => {
      unsubA();
      unsubR();
      unsubP();
      unsubC();
    };
  }, []);

  const handleLogout = () => signOut(auth);

  // Global Stats Calculation
  const stats = useMemo(() => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const filteredEntries = cashEntries.filter(e => {
      const d = new Date(e.date);
      return (d.getMonth() + 1) === currentMonth && d.getFullYear() === currentYear;
    });

    const income = filteredEntries.filter(e => e.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
    const expense = filteredEntries.filter(e => e.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
    const cumulativeBalance = cashEntries.reduce((acc, curr) => curr.type === 'income' ? acc + curr.amount : acc - curr.amount, 0);

    return {
      totalBalance: cumulativeBalance,
      monthlyIncome: income,
      monthlyExpense: expense,
      realization: income > 0 ? Math.round((income / (residents.length * 15000)) * 100) : 0
    };
  }, [cashEntries, residents.length]);

  return (
    <div className="flex min-h-screen bg-slate-100 font-sans text-slate-900">
      {/* Sidebar - Fixed 240px */}
      <aside className="w-[240px] bg-slate-900 text-white flex flex-col p-5 sticky top-0 h-screen shrink-0">
        <div className="flex items-center gap-2 mb-10">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <Receipt className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-[15px] tracking-tight">KAS RT TRANSMARIN</span>
        </div>

        <nav className="space-y-1 flex-1">
          <SidebarItem 
            active={activeTab === 'summary'} 
            onClick={() => setActiveTab('summary')} 
            icon={<BookOpen className="w-4 h-4" />} 
            label="Ringkasan" 
          />
          <SidebarItem 
            active={activeTab === 'iuran'} 
            onClick={() => setActiveTab('iuran')} 
            icon={<Receipt className="w-4 h-4" />} 
            label="Matriks Iuran" 
          />
          <SidebarItem 
            active={activeTab === 'cashbook'} 
            onClick={() => setActiveTab('cashbook')} 
            icon={<FileText className="w-4 h-4" />} 
            label="Buku Kas Umum" 
          />
          <SidebarItem 
            active={activeTab === 'residents'} 
            onClick={() => setActiveTab('residents')} 
            icon={<UserPlus className="w-4 h-4" />} 
            label="Warga & Properti" 
          />
          {appUser?.isActive && (
            <SidebarItem 
              active={activeTab === 'admin'} 
              onClick={() => setActiveTab('admin')} 
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
                ) : (
                  <span className="text-[9px] animate-pulse bg-slate-800 px-1.5 rounded ml-2 italic">VERIFYING...</span>
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
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 grid grid-rows-[auto_auto_1fr] gap-6 overflow-hidden">
        <header className="flex justify-between items-center">
          <h1 className="text-xl font-extrabold tracking-tight">Dashboard Keuangan Tahunan</h1>
          <div className="flex items-center gap-2">
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="h-8 w-[120px] bg-white border-slate-200 text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map(y => (
                  <SelectItem key={y} value={y.toString()}>Tahun {y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {user && appUser?.isActive && <AddPaymentGlobal entries={payments} residents={residents} />}
          </div>
        </header>

        {/* Global Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
           <StatCard label="Saldo Kas RT" value={CURRENCY_FORMATTER.format(stats.totalBalance)} valueColor="text-emerald-500" />
           <StatCard label="Target Iuran (Bln Ini)" value={CURRENCY_FORMATTER.format(residents.length * 15000)} />
           <StatCard label="Capaian Realisasi" value={`${stats.realization}%`} />
           <StatCard label="Pengeluaran (Bln Ini)" value={CURRENCY_FORMATTER.format(stats.monthlyExpense)} valueColor="text-rose-500" />
        </div>

        {/* Content Tabs Content Replacements */}
        <div className="min-h-0">
          {activeTab === 'summary' && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6 h-full">
              <Panel title="Matriks Pembayaran Iuran Warga" subtitle="Default: Rp 15.000 / Bln">
                 <IuranTable residents={residents} payments={payments} year={selectedYear} />
              </Panel>
              <Panel title="Informasi & Pengumuman" action={user && appUser?.isActive && <AddAnnouncementDialog />}>
                <AnnouncementList announcements={announcements} isAdmin={!!appUser?.isActive} />
              </Panel>
            </div>
          )}

          {activeTab === 'iuran' && (
             <Panel title="Data Lengkap Iuran" subtitle={`Tahun ${selectedYear}`}>
               <IuranTable residents={residents} payments={payments} year={selectedYear} />
             </Panel>
          )}

          {activeTab === 'cashbook' && (
             <CashBookModule cashEntries={cashEntries} isAdmin={!!appUser?.isActive} />
          )}

          {activeTab === 'residents' && (
             <Panel title="Daftar Warga & Properti" action={user && appUser?.isActive && <AddResidentDialog />}>
                <ResidentList residents={residents} isAdmin={!!appUser?.isActive} />
             </Panel>
          )}

          {activeTab === 'admin' && appUser?.isActive && (
             <Panel title="Daftar Admin & Status Akses" subtitle="Kelola persetujuan akses pengurus">
                <AdminManagement users={allUsers} currentUserUid={user?.uid || ''} />
             </Panel>
          )}
        </div>
      </main>
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
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</div>
      <div className={`text-xl font-mono font-bold tracking-tighter ${valueColor || 'text-slate-900'}`}>{value}</div>
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

function IuranTable({ residents, payments, year }: { residents: Resident[], payments: Payment[], year: number }) {
  const matrixData = useMemo(() => {
    return residents.map(resident => {
      const residentPayments = payments.filter(p => p.residentId === resident.id && p.year === year);
      const paidMonths = new Set<number>();
      residentPayments.forEach(p => p.months.forEach(m => paidMonths.add(m)));
      return { ...resident, paidMonths };
    });
  }, [residents, payments, year]);

  return (
    <div className="text-[11px]">
      <Table>
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
                const isPaid = row.paidMonths.has(m.id);
                return (
                  <TableCell key={m.id} className="text-center p-2">
                    {isPaid ? (
                      <span className="bg-emerald-100 text-emerald-700 font-black px-1.5 py-0.5 rounded text-[9px] border border-emerald-200">L</span>
                    ) : (
                      <span className="bg-slate-100 text-slate-300 font-black px-1.5 py-0.5 rounded text-[9px]">-</span>
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
    </div>
  );
}

function AnnouncementList({ announcements, isAdmin }: { announcements: Announcement[], isAdmin: boolean }) {
  const handleDelete = async (id: string) => {
    if (confirm('Hapus pengumuman?')) await deleteDoc(doc(db, 'announcements', id));
  };

  return (
    <div className="p-4 space-y-4">
      {announcements.map(ann => (
        <div key={ann.id} className="group relative border-l-4 border-blue-600 pl-4 py-1">
          <div className="font-extrabold text-[13px] text-slate-800 mb-0.5">{ann.title}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            {format(new Date(ann.date), 'dd MMM yyyy')} • {ann.author}
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed font-medium line-clamp-3 overflow-hidden text-ellipsis whitespace-pre-wrap">{ann.content}</p>
          {isAdmin && (
            <button onClick={() => handleDelete(ann.id)} className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500">
               <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
      {announcements.length === 0 && <p className="text-center py-10 text-slate-300 italic text-xs font-bold">Tidak ada pengumuman.</p>}
    </div>
  );
}

function ResidentList({ residents, isAdmin }: { residents: Resident[], isAdmin: boolean }) {
  const handleDelete = async (id: string) => {
    if (confirm('Hapus warga?')) await deleteDoc(doc(db, 'residents', id));
  };

  return (
    <div className="p-0">
      <Table>
        <TableHeader className="bg-slate-50 uppercase text-[10px] font-black text-slate-400 tracking-widest">
           <TableRow>
              <TableHead className="pl-4">Nama</TableHead>
              <TableHead>Alamat</TableHead>
              <TableHead className="text-right pr-4"></TableHead>
           </TableRow>
        </TableHeader>
        <TableBody>
           {residents.map(r => (
             <TableRow key={r.id} className="text-xs group">
                <TableCell className="pl-4 font-bold text-slate-700">{r.name}</TableCell>
                <TableCell className="font-mono text-slate-400">Blok {r.block}/{r.number}</TableCell>
                <TableCell className="text-right pr-4">
                  {isAdmin && (
                    <button onClick={() => handleDelete(r.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </TableCell>
             </TableRow>
           ))}
        </TableBody>
      </Table>
    </div>
  );
}

// --- UPDATED MODAL COMPONENTS ---

function AddAnnouncementDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleAdd = async () => {
    if (!title || !content || !auth.currentUser) return;
    await addDoc(collection(db, 'announcements'), {
      title, content, date: new Date().toISOString(), author: auth.currentUser.email
    });
    setOpen(false); setTitle(''); setContent('');
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

function AddPaymentGlobal({ entries, residents }: { entries: Payment[], residents: Resident[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="bg-blue-600 hover:bg-blue-700 h-8 px-4 text-xs font-black shadow-lg shadow-blue-200" />}>
        <Plus className="w-3.5 h-3.5 mr-1.5" /> INPUT IURAN BARU
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <PayIuranForm residents={residents} currentPayments={entries} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function PayIuranForm({ residents, currentPayments, onSuccess }: { residents: Resident[], currentPayments: Payment[], onSuccess: () => void }) {
  const [residentId, setResidentId] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [amount, setAmount] = useState('15000');
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());

  const resident = residents.find(r => r.id === residentId);

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
      const batch = writeBatch(db);
      
      // 1. Create Payment
      const paymentRef = doc(collection(db, 'payments'));
      const paymentData = {
        residentId,
        residentName: resident?.name || '',
        year: parseInt(year),
        months: selectedMonths,
        amount: parseInt(amount),
        paymentDate: format(paymentDate, 'yyyy-MM-dd'),
        createdAt: new Date().toISOString()
      };
      batch.set(paymentRef, paymentData);

      // 2. Create Cash Entry (Unified logic)
      // Logic: Aggregate to the month of PAYMENT DATE
      const pDate = paymentDate;
      const monthYearLabel = format(pDate, 'MMMM yyyy', { locale: localeID }).toUpperCase();
      const currentMonth = pDate.getMonth() + 1;
      const currentYear = pDate.getFullYear();

      const cashEntryRef = doc(collection(db, 'cash_book'));
      batch.set(cashEntryRef, {
        description: `PEROLEHAN IURAN BULAN ${monthYearLabel} (${resident?.name})`,
        date: format(pDate, 'yyyy-MM-dd'),
        type: 'income',
        amount: parseInt(amount),
        category: 'Iuran',
        paymentId: paymentRef.id
      });

      await batch.commit();
      onSuccess();
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
          <Label>Warga</Label>
          <Select value={residentId} onValueChange={setResidentId}>
            <SelectTrigger className="bg-slate-50 border-none">
              <SelectValue placeholder="Pilih Warga" />
            </SelectTrigger>
            <SelectContent>
              {residents.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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

function CashBookModule({ cashEntries, isAdmin }: { cashEntries: CashEntry[], isAdmin: boolean }) {
  const [filterMonth, setFilterMonth] = useState((new Date().getMonth() + 1).toString());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [openAdd, setOpenAdd] = useState(false);

  const filteredData = useMemo(() => {
    return cashEntries.filter(entry => {
      const d = new Date(entry.date);
      return (d.getMonth() + 1) === parseInt(filterMonth) && d.getFullYear() === parseInt(filterYear);
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
    await addDoc(collection(db, 'cash_book'), {
      description: newDesc,
      date: format(newDate, 'yyyy-MM-dd'),
      type: newType,
      amount: parseInt(newAmount),
      category: 'Lain-lain',
      createdAt: new Date().toISOString()
    });
    setOpenAdd(false);
    setNewDesc('');
    setNewAmount('');
  };

  const handleDelete = async (id: string) => {
    if (confirm('Hapus transaksi ini?')) {
      await deleteDoc(doc(db, 'cash_book', id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-blue-600 text-white border-none shadow-lg shadow-blue-100 rounded-2xl">
          <CardHeader className="pb-2">
            <CardDescription className="text-blue-100 font-bold uppercase tracking-widest text-[9px]">Total Pemasukan</CardDescription>
            <CardTitle className="text-2xl font-black font-mono">{CURRENCY_FORMATTER.format(stats.totalIncome)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-rose-600 text-white border-none shadow-lg shadow-rose-100 rounded-2xl">
          <CardHeader className="pb-2">
            <CardDescription className="text-rose-100 font-bold uppercase tracking-widest text-[9px]">Total Pengeluaran</CardDescription>
            <CardTitle className="text-2xl font-black font-mono">{CURRENCY_FORMATTER.format(stats.totalExpense)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-slate-900 text-white border-none shadow-lg shadow-slate-200 rounded-2xl">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Saldo Kas (Bulan Ini)</CardDescription>
            <CardTitle className="text-2xl font-black font-mono">{CURRENCY_FORMATTER.format(stats.balance)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-none shadow-xl shadow-slate-100 rounded-3xl">
        <CardHeader className="bg-white pb-6 pt-8 border-b border-slate-50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <CardTitle className="text-2xl font-black text-slate-800 tracking-tight">Buku Kas RT</CardTitle>
              <CardDescription className="font-medium text-slate-500 mt-1">Laporan arus kas bulanan yang transparan.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-2">
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger className="w-[140px] bg-slate-50 border-none font-bold">
                    <SelectValue placeholder="Bulan" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(m => (
                      <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input 
                  type="number" 
                  value={filterYear} 
                  onChange={e => setFilterYear(e.target.value)} 
                  className="w-[100px] bg-slate-50 border-none font-bold"
                />
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
                                <SelectValue />
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
        </CardHeader>
        <CardContent className="p-0">
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
                      {item.paymentId && <Badge className="mt-1 bg-green-50 text-[9px] text-green-600 font-bold border-none">IURAN OTOMATIS</Badge>}
                    </TableCell>
                    <TableCell className={`py-4 text-right font-black ${item.type === 'income' ? 'text-green-600' : 'text-slate-200'}`}>
                      {item.type === 'income' ? CURRENCY_FORMATTER.format(item.amount) : '-'}
                    </TableCell>
                    <TableCell className={`py-4 text-right font-black ${item.type === 'expense' ? 'text-red-500' : 'text-slate-200'}`}>
                      {item.type === 'expense' ? CURRENCY_FORMATTER.format(item.amount) : '-'}
                    </TableCell>
                    <TableCell className="pr-8 py-4 text-right">
                       {isAdmin && (
                         <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500">
                           <Trash2 className="w-4 h-4" />
                         </Button>
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
        </CardContent>
      </Card>
      
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

function AdminManagement({ users, currentUserUid }: { users: AppUser[], currentUserUid: string }) {
  const toggleStatus = async (user: AppUser) => {
    if (user.uid === currentUserUid) {
      alert("Anda tidak bisa menonaktifkan akun sendiri.");
      return;
    }
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { isActive: !user.isActive });
  };

  return (
    <div className="p-0">
      <Table>
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

function AddResidentDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [block, setBlock] = useState('');
  const [number, setNumber] = useState('');

  const handleAdd = async () => {
    if (!name) return;
    await addDoc(collection(db, 'residents'), { name, block, number });
    setOpen(false);
    setName('');
    setBlock('');
    setNumber('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="rounded-lg border-slate-200" />}>
        <UserPlus className="w-4 h-4 mr-2" /> Tambah Warga
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Data Warga Baru</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Nama Lengkap</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nama Warga" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Blok</Label>
              <Input value={block} onChange={e => setBlock(e.target.value)} placeholder="A" />
            </div>
            <div className="grid gap-2">
              <Label>Nomor Rumah</Label>
              <Input value={number} onChange={e => setNumber(e.target.value)} placeholder="01" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleAdd} className="w-full">Daftarkan Warga</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
