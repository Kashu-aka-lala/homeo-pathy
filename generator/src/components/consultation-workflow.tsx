'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft, CreditCard, Gift, Send, Lock,
  Unlock, CheckCircle2, AlertCircle, FileText, Loader2,
  ClipboardList, Pill, Eye, ChevronLeft, ChevronRight,
  CheckCheck, User,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useEmrStore } from '@/lib/store';
import PrescriptionBuilder from './prescription-builder';
import { sendInvoiceToPatient } from '@/lib/prescription-sender';
import { completeConsultation } from '@/lib/supabase-service';

// ── Wizard step metadata ───────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Billing',    icon: CreditCard,    shortLabel: 'Billing'    },
  { id: 2, label: 'Notes',      icon: ClipboardList, shortLabel: 'Notes'      },
  { id: 3, label: 'Rx Builder', icon: Pill,          shortLabel: 'Rx'         },
  { id: 4, label: 'Review',     icon: Eye,           shortLabel: 'Review'     },
];

// ─────────────────────────────────────────────────────────────────────────────

interface ConsultationWorkflowProps {
  onBack: () => void;
}

export default function ConsultationWorkflow({ onBack }: ConsultationWorkflowProps) {
  const {
    patients, consultations, invoices,
    activeConsultationId, setActiveConsultationId,
    updateConsultation, updateInvoice, doctorInfo,
    currentStep, nextStep, prevStep, resetWizard,
  } = useEmrStore();

  const amountRef = useRef<HTMLInputElement>(null);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const activeConsultation = useMemo(
    () => consultations.find((c) => c.id === activeConsultationId) || null,
    [consultations, activeConsultationId]
  );
  const activePatient = useMemo(
    () => (activeConsultation ? patients.find((p) => p.id === activeConsultation.patient_id) || null : null),
    [patients, activeConsultation]
  );
  const activeInvoice = useMemo(
    () => (activeConsultationId ? invoices.find((i) => i.consultation_id === activeConsultationId) || null : null),
    [invoices, activeConsultationId]
  );

  // ── Local editable state ─────────────────────────────────────────────────────
  const [consultationType, setConsultationType] = useState<'PAID' | 'COMPLIMENTARY'>('PAID');
  const [doctorNotes, setDoctorNotes]           = useState('');
  const [amount, setAmount]                     = useState('500');
  const [paymentMethod, setPaymentMethod]       = useState<'Bank Transfer' | 'Mobile Wallet' | 'Cash' | ''>('');
  const [paymentStatus, setPaymentStatus]       = useState<'PENDING' | 'PAID' | 'WAIVED'>('PENDING');

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [isSharingInvoice, setIsSharingInvoice] = useState(false);
  const [isFinishing,      setIsFinishing]      = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const notesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Sync local state when session changes (IDs only — prevents mid-typing resets)
  useEffect(() => {
    if (activeConsultation) {
      const rawType = activeConsultation.consultation_type?.toUpperCase();
      setConsultationType(rawType === 'COMPLIMENTARY' ? 'COMPLIMENTARY' : 'PAID');
      setDoctorNotes(activeConsultation.doctor_notes || '');
    }
    if (activeInvoice) {
      const stored = Number(activeInvoice.amount);
      setAmount(stored > 0 ? stored.toString() : '500');
      setPaymentMethod((activeInvoice.payment_method as any) || '');
      setPaymentStatus((activeInvoice.payment_status as any) || 'PENDING');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConsultationId, activeInvoice?.id]);

  // ── Rx lock logic ─────────────────────────────────────────────────────────────
  const isRxLocked = useMemo(() => {
    if (consultationType === 'COMPLIMENTARY') return false;
    return paymentStatus !== 'PAID' && paymentStatus !== 'WAIVED';
  }, [consultationType, paymentStatus]);

  // ── Next button gate per step ─────────────────────────────────────────────────
  const isNextDisabled = useMemo(() => {
    if (currentStep === 1) {
      // Must have a valid amount if PAID
      if (consultationType === 'PAID') {
        const val = parseFloat(amount);
        return isNaN(val) || val <= 0;
      }
      return false; // COMPLIMENTARY is always valid
    }
    if (currentStep === 2) return false; // Notes are optional
    if (currentStep === 3) return isRxLocked; // Can't proceed to review if Rx is locked
    return false;
  }, [currentStep, consultationType, amount, isRxLocked]);

  // ── Save helpers ──────────────────────────────────────────────────────────────
  const handleSaveConsultationState = async (updates: {
    type?: 'PAID' | 'COMPLIMENTARY';
    notes?: string;
    invAmount?: number;
    invMethod?: typeof paymentMethod;
    invStatus?: typeof paymentStatus;
  }) => {
    if (!activeConsultation || !activeInvoice) return;
    try {
      const typeChanged  = updates.type  !== undefined && updates.type  !== activeConsultation.consultation_type;
      const notesChanged = updates.notes !== undefined && updates.notes !== activeConsultation.doctor_notes;
      if (typeChanged || notesChanged) {
        await updateConsultation({
          ...activeConsultation,
          consultation_type: updates.type  ?? activeConsultation.consultation_type,
          doctor_notes:      updates.notes ?? activeConsultation.doctor_notes,
        });
      }
      const invAmountVal = updates.invAmount ?? activeInvoice.amount;
      const invStatusVal = updates.invStatus ?? activeInvoice.payment_status;
      const invMethodVal = updates.invMethod !== undefined ? updates.invMethod : activeInvoice.payment_method;
      if (
        invAmountVal !== activeInvoice.amount ||
        invStatusVal !== activeInvoice.payment_status ||
        invMethodVal !== activeInvoice.payment_method
      ) {
        await updateInvoice({
          ...activeInvoice,
          amount:         invAmountVal,
          payment_status: invStatusVal,
          payment_method: invMethodVal,
          paid_at: invStatusVal === 'PAID' ? new Date().toISOString() : null,
        });
        if (invStatusVal === 'PAID' && activeInvoice.payment_status !== 'PAID') {
          confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 }, colors: ['#10b981', '#14b8a6', '#34d399'] });
        }
      }
    } catch (e) {
      console.error('Failed to sync consultation updates:', e);
    }
  };

  const handleToggleConsultationType = async (type: 'PAID' | 'COMPLIMENTARY') => {
    setConsultationType(type);
    if (type === 'COMPLIMENTARY') {
      setPaymentStatus('WAIVED');
      await handleSaveConsultationState({ type: 'COMPLIMENTARY', invStatus: 'WAIVED' });
    } else {
      setPaymentStatus('PENDING');
      await handleSaveConsultationState({ type: 'PAID', invStatus: 'PENDING' });
      setTimeout(() => amountRef.current?.focus(), 150);
    }
  };

  const handleMarkAsPaid = async () => {
    const method = paymentMethod || 'Cash';
    setPaymentStatus('PAID');
    setPaymentMethod(method);
    await handleSaveConsultationState({ invStatus: 'PAID', invMethod: method });
  };

  const handleSendInvoiceWhatsApp = async () => {
    if (!activePatient || !activeInvoice || !activeConsultation) return;
    setIsSharingInvoice(true);
    showToast('Compiling and sharing invoice PDF...', 'info');
    try {
      const amountVal = amount || '500';
      const methodStr = paymentMethod || 'Bank Transfer';
      await sendInvoiceToPatient({
        patient: activePatient,
        consultation: activeConsultation,
        invoice: activeInvoice,
        fee: amountVal,
        paymentMethod: methodStr,
        doctorInfo,
      });
      await updateInvoice({ ...activeInvoice, amount: Number(amountVal), payment_method: methodStr });
      showToast('Invoice PDF generated and shared!', 'success');
    } catch (err: any) {
      showToast('Failed to compile or share Invoice PDF.', 'error');
    } finally {
      setIsSharingInvoice(false);
    }
  };

  const handleFinishConsultation = async () => {
    if (!activeConsultation) return;
    setIsFinishing(true);
    showToast('Closing session...', 'info');
    try {
      const { error } = await completeConsultation(activeConsultation.id);
      if (error) await updateConsultation({ ...activeConsultation, status: 'COMPLETED' });
      setActiveConsultationId(null);
      resetWizard();
      onBack();
    } catch {
      showToast('Failed to close session. Please try again.', 'error');
    } finally {
      setIsFinishing(false);
    }
  };

  // ── Empty guard ───────────────────────────────────────────────────────────────
  if (!activeConsultation || !activePatient || !activeInvoice) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle size={32} className="text-destructive mb-3 animate-bounce" />
        <p className="text-sm font-semibold text-foreground">No active consultation loaded</p>
        <button onClick={onBack} className="mt-4 text-xs font-semibold text-primary underline">Go Back</button>
      </div>
    );
  }

  // ── Step content renderers ────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="space-y-5 animate-fade-in">
      {/* Consultation Type Toggle */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Consultation Category</h3>
        <div className="grid grid-cols-2 gap-2 bg-muted/50 p-1.5 rounded-xl border border-border/60">
          {(['PAID', 'COMPLIMENTARY'] as const).map((type) => {
            const isActive = consultationType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleToggleConsultationType(type)}
                className={`flex items-center justify-center gap-2 py-3.5 min-h-[52px] rounded-lg text-sm font-bold transition-all focus:outline-none ${
                  isActive
                    ? 'bg-card text-foreground shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {type === 'PAID'
                  ? <CreditCard size={16} className={isActive ? 'text-primary' : ''} />
                  : <Gift      size={16} className={isActive ? 'text-primary' : ''} />
                }
                {type === 'PAID' ? 'Paid' : 'Free'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Invoice / Complimentary Banner */}
      {consultationType === 'PAID' ? (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Invoice & Payment</h3>
            <span className={`text-[10px] px-2.5 py-1 rounded-lg font-bold uppercase border ${
              paymentStatus === 'PAID'   ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
              paymentStatus === 'WAIVED' ? 'bg-gray-500/10 text-muted-foreground border-gray-500/10' :
                                          'bg-rose-500/10 text-rose-500 border-rose-500/20'
            }`}>
              {paymentStatus}
            </span>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Fee Amount (Rs.)</label>
            <input
              ref={amountRef}
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                const val = parseFloat(e.target.value);
                handleSaveConsultationState({ invAmount: isNaN(val) ? 0 : val });
              }}
              placeholder="500"
              className="w-full rounded-xl border border-border bg-background px-4 py-3.5 text-lg font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/45 min-h-[52px]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => {
                const method = e.target.value as any;
                setPaymentMethod(method);
                handleSaveConsultationState({ invMethod: method });
              }}
              className="w-full rounded-xl border border-border bg-background px-4 py-3.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/45 min-h-[52px] appearance-none"
            >
              <option value="">-- Select Payment Method --</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Mobile Wallet">Mobile Wallet</option>
              <option value="Cash">Cash</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={handleSendInvoiceWhatsApp}
              disabled={isSharingInvoice}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background py-3.5 min-h-[52px] text-sm font-semibold text-foreground hover:bg-muted transition-colors focus:outline-none disabled:opacity-50"
            >
              {isSharingInvoice
                ? <><Loader2 size={15} className="animate-spin text-primary" />Generating...</>
                : <><Send size={15} className="text-emerald-600 dark:text-emerald-400" />Share Invoice</>
              }
            </button>
            {paymentStatus !== 'PAID' && (
              <button
                type="button"
                onClick={handleMarkAsPaid}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white py-3.5 min-h-[52px] text-sm font-bold hover:bg-emerald-700 transition-colors shadow-md focus:outline-none"
              >
                <CheckCircle2 size={15} />
                Mark as Paid
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-tr from-indigo-500/5 to-teal-500/5 border border-indigo-500/15 rounded-2xl p-5 flex items-start gap-4">
          <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <Gift size={20} className="text-indigo-500" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-foreground">Complimentary Session</h4>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              This consultation is marked as free of charge. Billing status is automatically set to &quot;Waived&quot; and the prescription builder is fully unlocked.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-5 animate-fade-in">
      <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
        <div className="border-b border-border pb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Clinical Investigation & Notes</h3>
          <p className="text-xs text-muted-foreground mt-1">Record symptoms, modalities, and investigation parameters for this session.</p>
        </div>
        <textarea
          value={doctorNotes}
          onChange={(e) => {
            const val = e.target.value;
            setDoctorNotes(val);
            if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
            notesSaveTimer.current = setTimeout(() => handleSaveConsultationState({ notes: val }), 800);
          }}
          onBlur={(e) => {
            if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
            handleSaveConsultationState({ notes: e.target.value });
          }}
          placeholder="Record chief complaints, key modalities (aggravation/amelioration), thermal symptoms, diagnostic parameters, or laboratory investigation recommendations..."
          rows={10}
          className="w-full rounded-xl border border-border bg-background px-4 py-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/45 transition-all resize-none leading-relaxed"
        />
        <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
          <CheckCheck size={12} className="text-emerald-500" />
          Auto-saves as you type
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-5 animate-fade-in">
      {isRxLocked ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-5 shadow-sm">
          <div className="h-16 w-16 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center animate-pulse">
            <Lock size={28} />
          </div>
          <div>
            <h4 className="text-base font-bold text-foreground">Prescription Builder Locked</h4>
            <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto leading-relaxed">
              Go back to Step 1 and mark the invoice as <span className="font-bold text-foreground">Paid</span> (or mark the consultation as Complimentary) to unlock the Rx builder.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
            <button
              onClick={handleMarkAsPaid}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 min-h-[52px] text-sm font-bold text-primary-foreground hover:bg-primary/95 transition-all shadow-md focus:outline-none w-full sm:w-auto"
            >
              <Unlock size={15} />
              Verify Payment (Paid)
            </button>
            <button
              onClick={() => handleToggleConsultationType('COMPLIMENTARY')}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3.5 min-h-[52px] text-sm font-semibold text-foreground hover:bg-muted transition-colors focus:outline-none w-full sm:w-auto"
            >
              Make Complimentary
            </button>
          </div>
        </div>
      ) : (
        <div className="animate-scale-in">
          <div className="flex items-center gap-2 mb-4 bg-emerald-500/10 border border-emerald-500/15 rounded-xl p-3.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            <Unlock size={15} className="flex-shrink-0" />
            Prescription Builder Unlocked — create patient remedy instructions below.
          </div>
          <PrescriptionBuilder consultationId={activeConsultation.id} />
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-5 animate-fade-in">
      {/* Session Summary Card */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-4">Session Review</h3>

        {/* Patient info row */}
        <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-muted/30 border border-border/50">
          <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <User size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{activePatient.full_name}</p>
            <p className="text-xs text-muted-foreground">{activePatient.gender}, {activePatient.age} yrs • {activePatient.city}</p>
          </div>
        </div>

        {/* Summary grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/30 border border-border/50 p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Type</p>
            <p className="text-sm font-bold text-foreground">{consultationType === 'PAID' ? 'Paid Consult' : 'Complimentary'}</p>
          </div>
          <div className="rounded-xl bg-muted/30 border border-border/50 p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Payment</p>
            <p className={`text-sm font-bold ${
              paymentStatus === 'PAID'   ? 'text-emerald-600 dark:text-emerald-400' :
              paymentStatus === 'WAIVED' ? 'text-muted-foreground' : 'text-rose-500'
            }`}>{paymentStatus}</p>
          </div>
          {consultationType === 'PAID' && (
            <>
              <div className="rounded-xl bg-muted/30 border border-border/50 p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Fee</p>
                <p className="text-sm font-bold text-foreground">Rs. {amount || '—'}</p>
              </div>
              <div className="rounded-xl bg-muted/30 border border-border/50 p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Method</p>
                <p className="text-sm font-bold text-foreground">{paymentMethod || '—'}</p>
              </div>
            </>
          )}
        </div>

        {/* Clinical notes preview */}
        {doctorNotes && (
          <div className="rounded-xl bg-background border border-border/60 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Clinical Notes</p>
            <p className="text-xs text-foreground leading-relaxed whitespace-pre-line line-clamp-4">{doctorNotes}</p>
          </div>
        )}
      </div>

      {/* Finish Button */}
      <div className="bg-gradient-to-tr from-emerald-500/5 to-teal-500/5 border border-emerald-500/20 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
          <CheckCircle2 size={16} />
          Ready to close this consultation
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          All data has been saved automatically. Closing this session will mark it as <span className="font-bold text-foreground">Completed</span> and return you to the patient directory.
        </p>
        <button
          onClick={handleFinishConsultation}
          disabled={isFinishing}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-4 min-h-[56px] text-sm font-bold hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 focus:outline-none disabled:opacity-60"
        >
          {isFinishing
            ? <><Loader2 size={16} className="animate-spin" />Closing Session...</>
            : <><CheckCheck size={16} />Finish &amp; Close Session</>
          }
        </button>
      </div>
    </div>
  );

  // ── Progress indicator ────────────────────────────────────────────────────────
  const progressPct = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="max-w-2xl mx-auto pb-36">

      {/* ── Top Navigation Bar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-xl border border-border p-2.5 min-h-[44px] min-w-[44px] bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all focus:outline-none flex items-center justify-center"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Active Session</span>
            <h2 className="text-sm font-bold text-foreground truncate max-w-[180px] sm:max-w-xs">
              <span className="text-primary">{activePatient.full_name}</span>
              <span className="text-muted-foreground font-normal"> · {activePatient.age}y {activePatient.gender}</span>
            </h2>
          </div>
        </div>
        <span className={`text-[10px] px-2.5 py-1 rounded-lg font-bold uppercase border ${
          paymentStatus === 'PAID'   ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
          paymentStatus === 'WAIVED' ? 'bg-gray-500/10 text-muted-foreground border-gray-500/10' :
          consultationType === 'COMPLIMENTARY' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' :
                                      'bg-rose-500/10 text-rose-500 border-rose-500/20'
        }`}>
          {consultationType === 'COMPLIMENTARY' ? 'Free' : paymentStatus}
        </span>
      </div>

      {/* ── Step Progress Bar ────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-6 shadow-xs">
        {/* Step icon pills */}
        <div className="flex items-center justify-between mb-3.5">
          {STEPS.map((step) => {
            const isCompleted = currentStep > step.id;
            const isActive    = currentStep === step.id;
            const Icon        = step.icon;
            return (
              <div key={step.id} className="flex flex-col items-center gap-1.5 flex-1">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                  isCompleted
                    ? 'bg-primary border-primary text-primary-foreground shadow-md'
                    : isActive
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-muted/50 border-border text-muted-foreground'
                }`}>
                  {isCompleted ? <CheckCircle2 size={15} /> : <Icon size={15} />}
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider ${
                  isActive ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {step.shortLabel}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress track */}
        <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500 ease-in-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Step counter */}
        <div className="flex items-center justify-between mt-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Step {currentStep} of {STEPS.length}
          </span>
          <span className="text-[10px] font-semibold text-muted-foreground">
            {STEPS[currentStep - 1].label}
          </span>
        </div>
      </div>

      {/* ── Step Content ─────────────────────────────────────────────────────── */}
      <div>
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </div>

      {/* ── Sticky Bottom Navigation ─────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Back */}
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-5 py-3.5 min-h-[52px] text-sm font-semibold text-foreground hover:bg-muted transition-all focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
          >
            <ChevronLeft size={16} />
            Back
          </button>

          {/* Progress dots (center) */}
          <div className="flex-1 flex items-center justify-center gap-2">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={`rounded-full transition-all duration-300 ${
                  currentStep === step.id
                    ? 'h-2.5 w-8 bg-primary'
                    : currentStep > step.id
                    ? 'h-2 w-2 bg-primary/50'
                    : 'h-2 w-2 bg-muted-foreground/20'
                }`}
              />
            ))}
          </div>

          {/* Next / Finish */}
          {currentStep < 4 ? (
            <button
              onClick={nextStep}
              disabled={isNextDisabled}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-5 py-3.5 min-h-[52px] text-sm font-bold text-primary-foreground hover:bg-primary/95 transition-all shadow-md focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              Next
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleFinishConsultation}
              disabled={isFinishing}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-3.5 min-h-[52px] text-sm font-bold hover:from-emerald-500 hover:to-teal-500 transition-all shadow-md focus:outline-none disabled:opacity-50 flex-shrink-0"
            >
              {isFinishing ? <Loader2 size={15} className="animate-spin" /> : <CheckCheck size={15} />}
              Finish
            </button>
          )}
        </div>
      </div>

      {/* ── Toast ─────────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-24 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 shadow-lg border animate-slide-up max-w-xs ${
          toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 backdrop-blur-md' :
          toast.type === 'error'   ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 backdrop-blur-md' :
                                     'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 backdrop-blur-md'
        }`}>
          <span className="text-xs font-bold">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
