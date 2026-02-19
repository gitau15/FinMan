import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Calendar as CalendarIcon, 
  User, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Settings,
  LogOut,
  ChevronRight,
  History,
  PieChart as PieChartIcon,
  Mail,
  Lock,
  Banknote
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { format, isSameDay, startOfMonth, endOfMonth, subMonths } from 'date-fns';

import { db, initializeCategories, type Transaction, type Category } from './db';
import { parseMpesaSMS } from './utils/smsParser';
import { cn, formatCurrency } from './utils/utils';
import { supabase, isSupabaseConfigured } from './supabaseClient';

// --- Components ---

const TabButton = ({ active, icon: Icon, label, onClick }: { active: boolean, icon: any, label: string, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex flex-col items-center justify-center py-2 px-4 transition-all duration-300 relative",
      active ? "text-emerald-600" : "text-slate-400 hover:text-slate-600"
    )}
  >
    <Icon size={24} className={cn("mb-1 transition-transform", active && "scale-110")} />
    <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
    {active && (
      <motion.div 
        layoutId="activeTab"
        className="absolute -top-1 w-12 h-1 bg-emerald-600 rounded-full"
      />
    )}
  </button>
);

const Card = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("bg-white rounded-3xl p-6 shadow-sm border border-slate-100", className)}>
    {children}
  </div>
);

const TransactionItem = ({ transaction, category }: { transaction: Transaction, category?: Category }) => {
  const isIncome = transaction.type === 'receive';
  
  return (
    <div className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors group">
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105",
          isIncome ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
        )}>
          {isIncome ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
        </div>
        <div>
          <h4 className="font-semibold text-slate-800 line-clamp-1">{transaction.merchant}</h4>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{format(transaction.date, 'MMM d, h:mm a')}</span>
            {category && (
              <span 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: category.color }}
              />
            )}
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className={cn(
          "font-bold",
          isIncome ? "text-emerald-600" : "text-slate-800"
        )}>
          {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
        </p>
        <p className="text-[10px] text-slate-400 uppercase font-medium">{transaction.type}</p>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'income' | 'calendar' | 'profile'>('dashboard');
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSignUp, setIsSignUp] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [smsInput, setSmsInput] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Data fetching
  const transactions = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray());
  const categories = useLiveQuery(() => db.categories.toArray());

  useEffect(() => {
    initializeCategories();
    
    // Check Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Handle Web Share Target
    const urlParams = new URLSearchParams(window.location.search);
    const sharedText = urlParams.get('text');
    if (sharedText) {
      const parsed = parseMpesaSMS(sharedText);
      if (parsed) {
        setSmsInput(sharedText);
        setShowAddModal(true);
      }
      window.history.replaceState({}, document.title, "/");
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isSupabaseConfigured) {
      alert('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your secrets.');
      return;
    }

    setLoading(true);
    try {
      console.log('Starting auth process...', isSignUp ? 'SignUp' : 'SignIn');
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        console.log('SignUp Result:', { data, error });
        if (error) throw error;
        
        if (data.user && !data.session) {
          setVerificationSent(true);
        } else {
          alert('Account created and logged in!');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        console.log('SignIn Result:', { data, error });
        if (error) throw error;
      }
    } catch (error: any) {
      console.error('Auth Error:', error);
      alert(error.message || 'An unexpected error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleAddTransaction = async () => {
    const parsed = parseMpesaSMS(smsInput);
    if (parsed) {
      try {
        await db.transactions.add(parsed as Transaction);
        setSmsInput('');
        setShowAddModal(false);
      } catch (e) {
        console.error(e);
        alert('Transaction already exists or invalid format.');
      }
    } else {
      alert('Could not parse SMS. Please ensure it is a valid M-Pesa message.');
    }
  };

  // Calculations
  const stats = useMemo(() => {
    if (!transactions) return { balance: 0, income: 0, expense: 0 };
    const income = transactions.filter(t => t.type === 'receive').reduce((acc, t) => acc + t.amount, 0);
    const expense = transactions.filter(t => t.type !== 'receive').reduce((acc, t) => acc + t.amount, 0);
    return {
      balance: income - expense,
      income,
      expense
    };
  }, [transactions]);

  const chartData = useMemo(() => {
    if (!transactions) return [];
    // Last 7 days
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return format(date, 'MMM d');
    }).reverse();

    return days.map(day => {
      const dayTransactions = transactions.filter(t => format(t.date, 'MMM d') === day);
      const income = dayTransactions.filter(t => t.type === 'receive').reduce((acc, t) => acc + t.amount, 0);
      const expense = dayTransactions.filter(t => t.type !== 'receive').reduce((acc, t) => acc + t.amount, 0);
      return { name: day, income, expense };
    });
  }, [transactions]);

  const categorySpending = useMemo(() => {
    if (!transactions || !categories) return [];
    return categories.map(cat => {
      const amount = transactions
        .filter(t => t.categoryId === cat.id || (cat.id === 'other' && !t.categoryId))
        .filter(t => t.type !== 'receive')
        .reduce((acc, t) => acc + t.amount, 0);
      return { name: cat.name, value: amount, color: cat.color };
    }).filter(c => c.value > 0);
  }, [transactions, categories]);

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100"
        >
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Wallet size={40} />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">FinMan</h1>
            <p className="text-slate-500">Secure, cloud-authenticated tracking.</p>
          </div>
          
          {verificationSent ? (
            <div className="text-center space-y-6">
              <div className="bg-emerald-50 text-emerald-700 p-6 rounded-3xl border border-emerald-100">
                <Mail className="mx-auto mb-4" size={48} />
                <h3 className="text-xl font-bold mb-2">Verify your email</h3>
                <p className="text-sm opacity-90">
                  We've sent a confirmation link to <span className="font-bold">{email}</span>. 
                  Please check your inbox and click the link to activate your account.
                </p>
              </div>
              <button 
                onClick={() => setVerificationSent(false)}
                className="text-emerald-600 font-bold text-sm hover:underline"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleAuth} className="space-y-4">
                {!isSupabaseConfigured && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
                    <p className="text-xs text-amber-800 font-medium">
                      ⚠️ Supabase keys are missing. Please configure them in the Secrets panel to enable authentication.
                    </p>
                  </div>
                )}
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="email" 
                    placeholder="Email Address" 
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-6 focus:ring-2 focus:ring-emerald-500 transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="password" 
                    placeholder="Password" 
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-6 focus:ring-2 focus:ring-emerald-500 transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button 
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </button>
              </div>
            </>
          )}

          <p className="mt-8 text-center text-[10px] text-slate-400 uppercase tracking-widest font-bold">Cloud Identity • Local Storage • Privacy First</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans text-slate-900">
      {/* Header */}
      <header className="px-6 pt-8 pb-4 flex items-center justify-between sticky top-0 bg-slate-50/80 backdrop-blur-md z-10">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Welcome Back</p>
          <h2 className="text-xl font-bold">Financial Overview</h2>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200 hover:scale-105 transition-transform"
        >
          <Plus size={24} />
        </button>
      </header>

      <main className="px-6 space-y-6">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              {/* Balance Card */}
              <Card className="bg-emerald-600 text-white border-none shadow-emerald-200 shadow-xl overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Wallet size={120} />
                </div>
                <div className="relative z-10">
                  <p className="text-emerald-100 text-sm font-medium mb-1">Total Balance</p>
                  <h3 className="text-4xl font-bold mb-6">{formatCurrency(stats.balance)}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-sm">
                      <div className="flex items-center gap-2 text-emerald-100 text-[10px] font-bold uppercase tracking-wider mb-1">
                        <TrendingUp size={12} /> Income
                      </div>
                      <p className="font-bold">{formatCurrency(stats.income)}</p>
                    </div>
                    <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-sm">
                      <div className="flex items-center gap-2 text-emerald-100 text-[10px] font-bold uppercase tracking-wider mb-1">
                        <TrendingDown size={12} /> Expenses
                      </div>
                      <p className="font-bold">{formatCurrency(stats.expense)}</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Chart */}
              <Card>
                <div className="flex items-center justify-between mb-6">
                  <h4 className="font-bold text-slate-800">Weekly Activity</h4>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase">
                      <div className="w-2 h-2 rounded-full bg-emerald-600" /> Income
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-rose-500 uppercase">
                      <div className="w-2 h-2 rounded-full bg-rose-500" /> Expense
                    </div>
                  </div>
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#94a3b8' }} 
                        dy={10}
                      />
                      <YAxis hide />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Goal Progress / Categories */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-3">
                    <PieChartIcon size={24} />
                  </div>
                  <h5 className="text-xs font-bold text-slate-400 uppercase mb-1">Budget Used</h5>
                  <p className="text-xl font-bold">64%</p>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                    <div className="bg-blue-500 h-full w-[64%]" />
                  </div>
                </Card>
                <Card className="flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-3">
                    <TrendingUp size={24} />
                  </div>
                  <h5 className="text-xs font-bold text-slate-400 uppercase mb-1">Savings Goal</h5>
                  <p className="text-xl font-bold">Ksh 12k</p>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                    <div className="bg-amber-500 h-full w-[42%]" />
                  </div>
                </Card>
              </div>

              {/* Recent Transactions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800">Recent Transactions</h4>
                  <button className="text-xs font-bold text-emerald-600 uppercase tracking-wider">See All</button>
                </div>
                <div className="space-y-2">
                  {transactions?.slice(0, 5).map(t => (
                    <TransactionItem 
                      key={t.id} 
                      transaction={t} 
                      category={categories?.find(c => c.id === t.categoryId)} 
                    />
                  ))}
                  {(!transactions || transactions.length === 0) && (
                    <div className="text-center py-12 text-slate-400">
                      <History size={48} className="mx-auto mb-4 opacity-20" />
                      <p>No transactions yet.</p>
                      <p className="text-xs mt-1">Share an M-Pesa SMS to get started.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'income' && (
            <motion.div 
              key="income"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <Card className="bg-emerald-600 text-white border-none shadow-emerald-200 shadow-xl overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Banknote size={120} />
                </div>
                <div className="relative z-10">
                  <p className="text-emerald-100 text-sm font-medium mb-1">Total Income</p>
                  <h3 className="text-4xl font-bold mb-2">{formatCurrency(stats.income)}</h3>
                  <p className="text-emerald-100 text-xs opacity-80">Distributed by 40-30-30 Rule</p>
                </div>
              </Card>

              <div className="space-y-4">
                <h4 className="font-bold text-slate-800">Budget Distribution</h4>
                
                <div className="space-y-3">
                  {/* Savings - 40% */}
                  <Card className="p-5 border-l-4 border-l-blue-500">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                          <TrendingUp size={20} />
                        </div>
                        <div>
                          <h5 className="font-bold text-slate-800">Savings</h5>
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">40% Allocation</p>
                        </div>
                      </div>
                      <p className="text-lg font-bold text-blue-600">{formatCurrency(stats.income * 0.4)}</p>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full w-full" />
                    </div>
                  </Card>

                  {/* Company - 30% */}
                  <Card className="p-5 border-l-4 border-l-emerald-500">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                          <LayoutDashboard size={20} />
                        </div>
                        <div>
                          <h5 className="font-bold text-slate-800">Company</h5>
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">30% Allocation</p>
                        </div>
                      </div>
                      <p className="text-lg font-bold text-emerald-600">{formatCurrency(stats.income * 0.3)}</p>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full w-full" />
                    </div>
                  </Card>

                  {/* Needs - 30% */}
                  <Card className="p-5 border-l-4 border-l-amber-500">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                          <Wallet size={20} />
                        </div>
                        <div>
                          <h5 className="font-bold text-slate-800">Needs</h5>
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">30% Allocation</p>
                        </div>
                      </div>
                      <p className="text-lg font-bold text-amber-600">{formatCurrency(stats.income * 0.3)}</p>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full w-full" />
                    </div>
                  </Card>
                </div>
              </div>

              <Card className="bg-slate-900 text-white border-none">
                <h5 className="font-bold mb-4 flex items-center gap-2">
                  <PieChartIcon size={18} className="text-emerald-400" />
                  Visual Breakdown
                </h5>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Savings', value: 40, color: '#3b82f6' },
                          { name: 'Company', value: 30, color: '#10b981' },
                          { name: 'Needs', value: 30, color: '#f59e0b' },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {[
                          { name: 'Savings', value: 40, color: '#3b82f6' },
                          { name: 'Company', value: 30, color: '#10b981' },
                          { name: 'Needs', value: 30, color: '#f59e0b' },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', color: '#000' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Savings</p>
                    <p className="font-bold text-blue-400">40%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Company</p>
                    <p className="font-bold text-emerald-400">30%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Needs</p>
                    <p className="font-bold text-amber-400">30%</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {activeTab === 'calendar' && (
            <motion.div 
              key="calendar"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <Card className="p-4">
                <Calendar 
                  onChange={(val) => setSelectedDate(val as Date)} 
                  value={selectedDate}
                  className="w-full border-none font-sans"
                  tileClassName={({ date }) => {
                    const hasTrans = transactions?.some(t => isSameDay(t.date, date));
                    return hasTrans ? 'has-transaction' : '';
                  }}
                />
              </Card>

              <div className="space-y-4">
                <h4 className="font-bold text-slate-800">Activity on {format(selectedDate, 'MMMM d, yyyy')}</h4>
                <div className="space-y-2">
                  {transactions?.filter(t => isSameDay(t.date, selectedDate)).map(t => (
                    <TransactionItem 
                      key={t.id} 
                      transaction={t} 
                      category={categories?.find(c => c.id === t.categoryId)} 
                    />
                  ))}
                  {transactions?.filter(t => isSameDay(t.date, selectedDate)).length === 0 && (
                    <div className="text-center py-12 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
                      <p className="text-sm">No activity recorded for this day.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <Card className="text-center py-10">
                <div className="w-24 h-24 bg-slate-100 rounded-[2rem] flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-lg overflow-hidden">
                  {session.user.user_metadata?.avatar_url ? (
                    <img src={session.user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User size={48} className="text-slate-400" />
                  )}
                </div>
                <h3 className="text-2xl font-bold truncate px-4">{session.user.email}</h3>
                <p className="text-slate-500 text-sm">Supabase Session Active</p>
              </Card>

              <div className="space-y-3">
                <button className="w-full bg-white p-5 rounded-2xl flex items-center justify-between border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                      <Settings size={20} />
                    </div>
                    <span className="font-semibold">Security Settings</span>
                  </div>
                  <ChevronRight size={20} className="text-slate-300" />
                </button>
                <button 
                  onClick={async () => {
                    if (confirm('Export all data to JSON?')) {
                      const data = await db.transactions.toArray();
                      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `mpesa_data_${format(new Date(), 'yyyyMMdd')}.json`;
                      a.click();
                    }
                  }}
                  className="w-full bg-white p-5 rounded-2xl flex items-center justify-between border border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                      <TrendingUp size={20} />
                    </div>
                    <span className="font-semibold">Export Data (JSON)</span>
                  </div>
                  <ChevronRight size={20} className="text-slate-300" />
                </button>
                <button 
                  onClick={handleLogout}
                  className="w-full bg-white p-5 rounded-2xl flex items-center justify-between border border-slate-100 hover:bg-rose-50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center group-hover:bg-rose-100">
                      <LogOut size={20} />
                    </div>
                    <span className="font-semibold text-rose-600">Sign Out</span>
                  </div>
                  <ChevronRight size={20} className="text-rose-200" />
                </button>
              </div>
              
              <div className="text-center px-10">
                <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold leading-relaxed">
                  Your data never leaves this device. No servers, no tracking, just you and your money.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 px-6 pb-6 pt-2 flex justify-around items-center z-20">
        <TabButton 
          active={activeTab === 'dashboard'} 
          icon={LayoutDashboard} 
          label="Home" 
          onClick={() => setActiveTab('dashboard')} 
        />
        <TabButton 
          active={activeTab === 'income'} 
          icon={Banknote} 
          label="Income" 
          onClick={() => setActiveTab('income')} 
        />
        <TabButton 
          active={activeTab === 'calendar'} 
          icon={CalendarIcon} 
          label="Calendar" 
          onClick={() => setActiveTab('calendar')} 
        />
        <TabButton 
          active={activeTab === 'profile'} 
          icon={User} 
          label="Profile" 
          onClick={() => setActiveTab('profile')} 
        />
      </nav>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-lg bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
            >
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden" />
              <h3 className="text-2xl font-bold mb-2">Add Transaction</h3>
              <p className="text-slate-500 mb-6 text-sm">Paste your M-Pesa SMS below to automatically parse and record it.</p>
              
              <div className="space-y-4">
                <textarea 
                  placeholder="Paste M-Pesa SMS here..."
                  className="w-full bg-slate-50 border-none rounded-2xl p-4 h-32 focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                  value={smsInput}
                  onChange={(e) => setSmsInput(e.target.value)}
                />
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAddTransaction}
                    className="flex-1 bg-emerald-600 text-white font-bold py-4 rounded-2xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
                  >
                    Parse & Save
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .react-calendar {
          width: 100% !important;
          border: none !important;
          background: transparent !important;
        }
        .react-calendar__navigation button {
          color: #1e293b !important;
          font-weight: 700 !important;
          font-size: 1.1rem !important;
        }
        .react-calendar__tile {
          padding: 1.25em 0.5em !important;
          font-size: 0.9rem !important;
          border-radius: 1rem !important;
        }
        .react-calendar__tile--active {
          background: #10b981 !important;
          color: white !important;
        }
        .react-calendar__tile--now {
          background: #f1f5f9 !important;
          color: #10b981 !important;
          font-weight: 800 !important;
        }
        .has-transaction {
          position: relative;
        }
        .has-transaction::after {
          content: '';
          position: absolute;
          bottom: 6px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 4px;
          background: #10b981;
          border-radius: 50%;
        }
      `}</style>
    </div>
  );
}

