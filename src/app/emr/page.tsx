'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { 
  Users, Activity, DollarSign, FileClock, Sun, Moon, 
  Settings, HeartPulse, RefreshCw, Database
} from 'lucide-react';
import { useEmrStore } from '@/lib/store';
import { isSupabaseConfigured } from '@/lib/storage';
import PatientRegistry from '@/components/patient-registry';
import ConsultationWorkflow from '@/components/consultation-workflow';
import DoctorSettingsModal from '@/components/doctor-settings-modal';

export default function Dashboard() {
  const { 
    patients, consultations, invoices, activeConsultationId, 
    loadData, isLoading, doctorInfo 
  } = useEmrStore();

  const [darkMode, setDarkMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Load EMR records on mount
  useEffect(() => {
    loadData();

    // Check localStorage for dark mode preference
    if (typeof window !== 'undefined') {
      const darkPref = localStorage.getItem('homeocare_dark_mode') === 'true';
      setDarkMode(darkPref);
      if (darkPref) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [loadData]);

  // Toggle theme controller
  const handleToggleTheme = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    if (typeof window !== 'undefined') {
      localStorage.setItem('homeocare_dark_mode', String(nextDark));
      if (nextDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  // ----------------------------------------------------
  // Statistics Calculations
  // ----------------------------------------------------
  const stats = useMemo(() => {
    const totalPatients = patients.length;
    const totalConsults = consultations.length;
    const pendingInvoices = invoices.filter((i) => i.payment_status.toUpperCase() === 'PENDING').length;
    const revenue = invoices
      .filter((i) => i.payment_status.toUpperCase() === 'PAID')
      .reduce((sum, item) => sum + Number(item.amount), 0);

    return [
      {
        title: 'Total Patients',
        value: totalPatients.toString(),
        icon: Users,
        color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/10',
      },
      {
        title: 'Total Consultations',
        value: totalConsults.toString(),
        icon: Activity,
        color: 'text-teal-600 dark:text-teal-400 bg-teal-500/10 border-teal-500/10',
      },
      {
        title: 'Pending Invoices',
        value: pendingInvoices.toString(),
        icon: FileClock,
        color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/10',
      },
    ];
  }, [patients, consultations, invoices]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground space-y-4">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 shadow-md border border-primary/10">
          <HeartPulse className="animate-pulse text-primary" size={32} />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <RefreshCw size={14} className="animate-spin text-primary" />
          Synchronizing EMR records...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col transition-all duration-300">
      {/* ----------------- TOP HEADER BAR ----------------- */}
      <header className="sticky top-0 z-40 w-full bg-background/70 backdrop-blur-xl border-b border-border/40 shadow-[0_4px_30px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.2)]">
        <div className="absolute bottom-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 group cursor-pointer">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20 border border-emerald-400/20 overflow-hidden transition-transform duration-300 group-hover:scale-105">
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
              <HeartPulse size={20} className="relative animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-foreground sm:text-lg bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                Yashfeen <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500 font-bold">EMR</span>
              </h1>
              <p className="text-[10px] text-muted-foreground hidden sm:block font-medium">
                Clinic of {doctorInfo.name} <span className="mx-1 text-border">&bull;</span> Reg No {doctorInfo.regNo}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3.5">
            {/* Database mode status badge */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border shadow-sm transition-all duration-300 ${
              isSupabaseConfigured
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
            }`}>
              <Database size={12} className={isSupabaseConfigured ? 'text-emerald-500' : 'text-amber-500'} />
              <span className="hidden sm:inline">
                {isSupabaseConfigured ? 'Supabase Connected' : 'Local Fallback'}
              </span>
              <span className="sm:hidden">
                {isSupabaseConfigured ? 'Supabase' : 'Local'}
              </span>
            </div>

            {/* Dark Mode toggle */}
            <button
              onClick={handleToggleTheme}
              className="rounded-xl border border-border/50 p-2.5 bg-background hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all duration-300 focus:outline-none shadow-sm hover:shadow active:scale-95"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Doctor Profile settings */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="rounded-xl border border-border/50 p-2.5 bg-background hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all duration-300 focus:outline-none shadow-sm hover:shadow active:scale-95"
              title="Clinic Settings"
            >
              <Settings size={16} className="hover:rotate-90 transition-transform duration-500" />
            </button>
          </div>
        </div>
      </header>

      {/* ----------------- CORE CONTENT BODY ----------------- */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Render stats summary (Hide during active consultation to maximize typing space) */}
        {!activeConsultationId && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 animate-fade-in relative z-10">
            {stats.map((s, idx) => (
              <div 
                key={idx} 
                className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-primary/30 transition-all duration-300 group cursor-default overflow-hidden relative"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative z-10">
                  <span className="text-[11px] font-bold text-muted-foreground block uppercase tracking-widest">{s.title}</span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-foreground block mt-1 tracking-tight">{s.value}</span>
                </div>
                <div className={`relative z-10 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border ${s.color} flex-shrink-0 ml-4 group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                  <s.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Workspace Panel switcher */}
        <div className="w-full">
          {activeConsultationId ? (
            <ConsultationWorkflow onBack={() => useEmrStore.getState().setActiveConsultationId(null)} />
          ) : (
            <PatientRegistry onStartConsultation={() => {}} />
          )}
        </div>
      </main>

      {/* Profile & Clinic Settings Modal */}
      <DoctorSettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  );
}
