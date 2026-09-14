'use client';

import React, { useState, useMemo } from 'react';
import { 
  Search, UserPlus, Phone, MapPin, Activity, 
  PlusCircle, Edit2, Calendar, FileText, CheckCircle2, 
  Clock, AlertCircle, Eye, RefreshCw, ArrowLeft, ChevronDown, ChevronUp, Trash2
} from 'lucide-react';
import { useEmrStore } from '@/lib/store';
import { Patient, Consultation, Invoice, Prescription, supabase } from '@/lib/storage';
import { createConsultation, createOrUpdateInvoice, updateInvoiceStatus } from '@/lib/supabase-service';
import AddPatientModal from './add-patient-modal';

interface PatientRegistryProps {
  onStartConsultation: () => void;
}

export default function PatientRegistry({ onStartConsultation }: PatientRegistryProps) {
  const { 
    patients, consultations, invoices, prescriptions, 
    selectedPatientId, setSelectedPatientId, setActiveConsultationId,
    addConsultation, addInvoice, loadData, updateInvoice, deletePatient
  } = useEmrStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [patientToEdit, setPatientToEdit] = useState<Patient | null>(null);
  const [isStartingConsultation, setIsStartingConsultation] = useState(false);
  const [expandedConsultationId, setExpandedConsultationId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingPatient, setIsDeletingPatient] = useState(false);

  // 1. Filtered Patients list
  const filteredPatients = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return patients;
    return patients.filter(
      (p) => p.full_name.toLowerCase().includes(q) || p.phone.includes(q)
    );
  }, [patients, searchQuery]);

  // 2. Currently selected patient details
  const selectedPatient = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId) || null;
  }, [patients, selectedPatientId]);

  // 3. Chronological consultations list for selected patient
  const selectedPatientConsultations = useMemo(() => {
    if (!selectedPatientId) return [];
    return consultations
      .filter((c) => c.patient_id === selectedPatientId)
      .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
  }, [consultations, selectedPatientId]);

  // 4. Invoices map by consultation ID for quick retrieval
  const invoicesMap = useMemo(() => {
    const map: { [key: string]: Invoice } = {};
    invoices.forEach((i) => {
      map[i.consultation_id] = i;
    });
    return map;
  }, [invoices]);

  // 5. Prescriptions map by consultation ID for quick retrieval
  const prescriptionsMap = useMemo(() => {
    const map: { [key: string]: Prescription } = {};
    prescriptions.forEach((p) => {
      map[p.consultation_id] = p;
    });
    return map;
  }, [prescriptions]);

  const handleEditPatient = (patient: Patient, e: React.MouseEvent) => {
    e.stopPropagation();
    setPatientToEdit(patient);
    setIsModalOpen(true);
  };

  const handleCreateNewPatient = () => {
    setPatientToEdit(null);
    setIsModalOpen(true);
  };

  const handleDeletePatient = async (patientId: string) => {
    setIsDeletingPatient(true);
    try {
      await deletePatient(patientId);
    } catch (err) {
      console.error('Failed to delete patient:', err);
    } finally {
      setIsDeletingPatient(false);
      setConfirmDeleteId(null);
    }
  };

  const handleInitiateConsultation = async () => {
    if (!selectedPatient) return;
    setIsStartingConsultation(true);

    try {
      let newConsultation: any;

      if (supabase) {
        // Use the centralized service layer (normalizes type to uppercase, trims notes)
        const { data, error } = await createConsultation(selectedPatient.id, 'PAID', '');
        if (error || !data) throw new Error(error ?? 'Failed to create consultation');
        newConsultation = data;

        // Create the initial PENDING invoice via service layer
        const { error: invError } = await createOrUpdateInvoice(
          newConsultation.id,
          500,
          'Bank Transfer',
          'PENDING'
        );
        if (invError) throw new Error(invError);

        // Refresh EMR store state
        await loadData();
      } else {
        // Local storage fallback flow
        newConsultation = await addConsultation({
          patient_id:        selectedPatient.id,
          consultation_type: 'Paid',
          status:            'Draft',
          doctor_notes:      '',
        });

        await addInvoice({
          consultation_id: newConsultation.id,
          amount:          500,
          payment_status:  'Pending',
          payment_method:  '',
          paid_at:         null,
        });
      }

      setActiveConsultationId(newConsultation.id);
      onStartConsultation();
    } catch (err) {
      console.error('Failed to create consultation:', err);
    } finally {
      setIsStartingConsultation(false);
    }
  };

  const handleResumeConsultation = (consultationId: string) => {
    setActiveConsultationId(consultationId);
    onStartConsultation();
  };

  const handleShareInvoiceWhatsApp = (patientName: string, phone: string, amount: number, pdfUrl?: string | null) => {
    let msg = `Assalam-o-Alaikum ${patientName}, your invoice for fee amount Rs. ${amount} is ready.`;
    if (pdfUrl) {
      msg += ` You can view or download it here: ${pdfUrl}`;
    } else {
      msg += ` Please complete the payment using Bank Transfer or Mobile Wallet.`;
    }
    msg += ` Thank you.`;
    const url = `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleShareRxWhatsApp = (patientName: string, phone: string, pdfUrl: string, precautions: string[] = []) => {
    let msg = `Assalam-o-Alaikum ${patientName}, your prescription is ready. You can view or download it here: ${pdfUrl}`;
    if (precautions && precautions.length > 0) {
      msg += `\n\nDietary Restrictions & Instructions:\n• ${precautions.join('\n• ')}`;
    }
    const url = `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleTogglePaymentStatus = async (invoice: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentStatus = invoice.payment_status.toUpperCase();
    const nextStatus = currentStatus === 'PAID' ? 'PENDING' : 'PAID';
    
    try {
      if (supabase) {
        await updateInvoiceStatus(invoice.id, nextStatus);
      }
      
      // Update store so client-side state is reactive immediately
      await updateInvoice({
        ...invoice,
        payment_status: nextStatus as any,
        paid_at: nextStatus === 'PAID' ? new Date().toISOString() : null,
      });
    } catch (err) {
      console.error('Failed to toggle payment status:', err);
    }
  };

  return (
    <div className="flex flex-col md:grid md:grid-cols-12 gap-6 md:h-[calc(100vh-140px)] md:max-h-[800px] min-h-0">
      {/* ----------------- LEFT PANEL: Patient Search & List ----------------- */}
      <div className={`md:col-span-4 flex flex-col bg-card border border-border rounded-2xl overflow-hidden shadow-sm md:h-full ${
        selectedPatientId ? 'hidden md:flex' : 'flex h-[calc(100svh-180px)]'
      }`}>
        {/* Search Header */}
        <div className="p-4 border-b border-border bg-muted/20 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-foreground">Patient Registry</h3>
            <button
              onClick={handleCreateNewPatient}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-all shadow-sm focus:outline-none"
            >
              <UserPlus size={14} />
              Register
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or WhatsApp..."
              className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/45 transition-all"
            />
          </div>
        </div>

        {/* Patients List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredPatients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground font-medium">No patients found</p>
              <p className="text-xs text-muted-foreground/80 mt-1">Register a new profile to get started.</p>
            </div>
          ) : (
            filteredPatients.map((p) => {
              const isSelected = p.id === selectedPatientId;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPatientId(p.id)}
                  className={`group relative flex flex-col p-4 sm:p-5 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden min-h-[72px] ${
                    isSelected
                      ? 'bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/40 shadow-sm shadow-primary/5'
                      : 'bg-background hover:bg-muted/40 border-border hover:border-primary/20'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-primary/50 shadow-[0_0_8px_rgba(var(--primary),0.5)]"></div>
                  )}
                  <div className="flex items-start justify-between relative z-10">
                    <div>
                      <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                        {p.full_name}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Phone size={10} />
                        {p.phone}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleEditPatient(p, e)}
                        className="opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200"
                        title="Edit Profile"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(p.id); }}
                        className="opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-all duration-200"
                        title="Delete Patient"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground font-medium relative z-10">
                    <span className="bg-muted px-2 py-0.5 rounded-md">
                      {p.gender}, {p.age} yrs
                    </span>
                    <span className="flex items-center gap-0.5">
                      <MapPin size={9} />
                      {p.city}
                    </span>
                  </div>

                  {/* Inline confirmation dialog */}
                  {confirmDeleteId === p.id && (
                    <div
                      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl bg-background/95 backdrop-blur-sm border border-rose-500/30 p-4 animate-fade-in"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2 text-rose-500">
                        <Trash2 size={16} />
                        <span className="text-xs font-bold">Delete this patient?</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                        This will permanently remove <span className="font-bold text-foreground">{p.full_name}</span> and all their consultations, invoices, and prescriptions.
                      </p>
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="flex-1 rounded-xl border border-border bg-background py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors focus:outline-none"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDeletePatient(p.id)}
                          disabled={isDeletingPatient}
                          className="flex-1 rounded-xl bg-rose-500 py-2 text-xs font-bold text-white hover:bg-rose-600 transition-colors focus:outline-none disabled:opacity-60"
                        >
                          {isDeletingPatient ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ----------------- RIGHT PANEL: Patient Chronological History ----------------- */}
      <div className={`md:col-span-8 bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col md:h-full ${
        selectedPatientId ? 'flex h-[calc(100svh-140px)]' : 'hidden md:flex'
      }`}>
        {selectedPatient ? (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Patient Header Block */}
            <div className="p-6 border-b border-border bg-gradient-to-r from-emerald-500/5 to-teal-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedPatientId(null)}
                    className="md:hidden p-2 -ml-1 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all focus:outline-none"
                    title="Back to Patient List"
                  >
                    <ArrowLeft size={14} />
                  </button>
                  <h3 className="text-lg font-bold text-foreground">{selectedPatient.full_name}</h3>
                  <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-xs font-semibold">
                    {selectedPatient.gender}, {selectedPatient.age} Years
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Phone size={13} className="text-muted-foreground" />
                    {selectedPatient.phone}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin size={13} className="text-muted-foreground" />
                    {selectedPatient.city}
                  </span>
                </div>
                {selectedPatient.medical_history && (
                  <div className="mt-3 flex items-start gap-1.5 bg-destructive/5 text-destructive-foreground dark:text-red-300 border border-destructive/10 rounded-lg p-2.5 text-xs font-medium">
                    <Activity size={14} className="mt-0.5 flex-shrink-0 text-destructive" />
                    <div>
                      <span className="font-semibold block text-[11px] uppercase tracking-wider text-destructive/80">Clinical History / Allergies</span>
                      {selectedPatient.medical_history}
                    </div>
                  </div>
                )}
              </div>

              {/* Patient actions */}
              <div className="flex flex-row sm:flex-col gap-2 justify-end">
                <button
                  onClick={handleInitiateConsultation}
                  disabled={isStartingConsultation}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/95 transition-all shadow-md focus:outline-none disabled:opacity-60"
                >
                  {isStartingConsultation ? (
                    <>
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <PlusCircle size={15} />
                      New Consultation
                    </>
                  )}
                </button>
                <button
                  onClick={(e) => handleEditPatient(selectedPatient, e)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors focus:outline-none"
                >
                  <Edit2 size={13} />
                  Edit Profile
                </button>
                <button
                  onClick={() => setConfirmDeleteId(selectedPatient.id)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-2.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/15 transition-colors focus:outline-none"
                >
                  <Trash2 size={13} />
                  Delete Patient
                </button>
              </div>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto p-6">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-6">Consultation Timeline History</h4>
              
              {selectedPatientConsultations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-2xl">
                  <Calendar size={36} className="text-muted-foreground/60 mb-3" />
                  <p className="text-sm font-semibold text-foreground">No consult records yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                    Click &apos;New Consultation&apos; above to record symptoms, generate invoices, and build prescriptions.
                  </p>
                </div>
              ) : (
                <div className="relative border-l border-border pl-6 ml-3 space-y-8 pb-4">
                  {selectedPatientConsultations.map((c) => {
                    const invoice = invoicesMap[c.id];
                    const rx = prescriptionsMap[c.id];
                    const dateFormatted = c.created_at 
                      ? new Date(c.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : '';
                    const isDraft = c.status === 'Draft';
                    const isExpanded = expandedConsultationId === c.id;

                    return (
                      <div key={c.id} className="relative animate-slide-up">
                        {/* Timeline node dot */}
                        <span className={`absolute -left-[31px] top-4 flex h-5 w-5 items-center justify-center rounded-full border shadow-sm z-10 ${
                          isDraft ? 'bg-background border-amber-500 shadow-amber-500/20' : 'bg-background border-emerald-600 shadow-emerald-500/20'
                        }`}>
                          <span className={`h-2.5 w-2.5 rounded-full ${
                            isDraft ? 'bg-amber-500 animate-ping' : 'bg-emerald-600'
                          }`} />
                        </span>

                        {/* Timeline content card */}
                        <div 
                          onClick={() => setExpandedConsultationId(isExpanded ? null : c.id)}
                          className={`glass-card rounded-2xl overflow-hidden shadow-sm hover:shadow transition-all duration-300 cursor-pointer ${
                            isExpanded ? 'border-primary/40 ring-2 ring-primary/10 shadow-md' : 'border-border/60 hover:border-primary/30'
                          }`}
                        >
                          {/* ─── CARD HEADER (Always Visible Summary) ─── */}
                          <div className="p-4 sm:p-5 flex items-center justify-between gap-4 select-none relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent dark:via-white/5 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 relative z-10">
                              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{dateFormatted}</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                  c.consultation_type.toUpperCase() === 'COMPLIMENTARY' 
                                    ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/10'
                                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10'
                                }`}>
                                  {c.consultation_type}
                                </span>
                                
                                {isDraft ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase bg-amber-500/10 text-amber-500 border border-amber-500/10 animate-pulse">
                                    Draft
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10">
                                    Completed
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              {/* Invoice payment summary */}
                              {invoice && (
                                <div className="hidden sm:flex items-center gap-2 text-xs">
                                  <span className="font-semibold text-foreground">Rs. {invoice.amount}</span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                    invoice.payment_status.toUpperCase() === 'PAID'
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10'
                                      : invoice.payment_status.toUpperCase() === 'WAIVED'
                                      ? 'bg-gray-500/10 text-muted-foreground border border-gray-500/10'
                                      : 'bg-rose-500/10 text-rose-500 border border-rose-500/10'
                                  }`}>
                                    {invoice.payment_status}
                                  </span>
                                </div>
                              )}
                              
                              {/* Accordion Expand/Collapse arrow */}
                              <div className="text-muted-foreground hover:text-foreground p-1 transition-colors">
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </div>
                            </div>
                          </div>

                          {/* ─── CARD EXPANDED CONTENT ─── */}
                          {isExpanded && (
                            <div className="px-4 sm:px-5 pb-5 border-t border-border/30 pt-5 space-y-5 cursor-default animate-fade-in bg-muted/10" onClick={(e) => e.stopPropagation()}>
                              {/* Clinical notes */}
                              {c.doctor_notes ? (
                                <div>
                                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block mb-2">Clinical Notes & Symptoms</span>
                                  <p className="text-sm text-foreground whitespace-pre-line bg-background/60 rounded-xl p-4 border border-border/50 shadow-sm leading-relaxed">
                                    {c.doctor_notes}
                                  </p>
                                </div>
                              ) : (
                                <div>
                                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block mb-2">Clinical Notes & Symptoms</span>
                                  <p className="text-sm text-muted-foreground/60 italic bg-background/40 rounded-xl p-4 border border-border/30">
                                    No notes recorded for this session.
                                  </p>
                                </div>
                              )}

                              {/* Invoice detailed info */}
                              {invoice && (
                                <div className="bg-muted/20 border border-border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="flex items-center gap-4 flex-wrap text-xs">
                                    <div>
                                      <span className="text-muted-foreground block text-[9px] uppercase tracking-wider font-bold">Amount Due</span>
                                      <span className="font-bold text-foreground">Rs. {invoice.amount}</span>
                                    </div>
                                    {invoice.payment_method && (
                                      <div>
                                        <span className="text-muted-foreground block text-[9px] uppercase tracking-wider font-bold">Method</span>
                                        <span className="font-semibold text-foreground">{invoice.payment_method}</span>
                                      </div>
                                    )}
                                    <div>
                                      <span className="text-muted-foreground block text-[9px] uppercase tracking-wider font-bold">Payment Status</span>
                                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase inline-block ${
                                        invoice.payment_status.toUpperCase() === 'PAID'
                                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10'
                                          : invoice.payment_status.toUpperCase() === 'WAIVED'
                                          ? 'bg-gray-500/10 text-muted-foreground border border-gray-500/10'
                                          : 'bg-rose-500/10 text-rose-500 border border-rose-500/10'
                                      }`}>
                                        {invoice.payment_status}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {/* Toggle Payment Status Button */}
                                    {invoice.payment_status.toUpperCase() !== 'WAIVED' && (
                                      <button
                                        onClick={(e) => handleTogglePaymentStatus(invoice, e)}
                                        className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors focus:outline-none"
                                      >
                                        Mark as {invoice.payment_status.toUpperCase() === 'PAID' ? 'Pending' : 'Paid'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Prescription Details */}
                              {rx ? (
                                <div className="border border-border/80 rounded-xl p-3.5 space-y-3">
                                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Prescribed Remedies (Rx)</span>
                                    {rx.pdf_url && (
                                      <a
                                        href={rx.pdf_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                                      >
                                        <FileText size={12} />
                                        Open PDF in New Tab
                                      </a>
                                    )}
                                  </div>
                                  
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                      <thead>
                                        <tr className="border-b border-border text-[9px] uppercase font-bold text-muted-foreground">
                                          <th className="pb-1.5 font-bold">Remedy</th>
                                          <th className="pb-1.5 font-bold">Potency</th>
                                          <th className="pb-1.5 font-bold">Form</th>
                                          <th className="pb-1.5 font-bold">Dosage & Frequency</th>
                                          <th className="pb-1.5 font-bold">Duration</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border/40 text-xs">
                                        {rx.medicines.map((med, idx) => (
                                          <tr key={idx} className="hover:bg-muted/10">
                                            <td className="py-2 font-bold text-foreground">{med.remedy}</td>
                                            <td className="py-2 text-muted-foreground">{med.potency}</td>
                                            <td className="py-2 text-muted-foreground">{med.vehicle}</td>
                                            <td className="py-2 text-foreground font-medium">{med.dosage}</td>
                                            <td className="py-2 text-muted-foreground">{med.duration}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>

                                  {rx.diet_precautions && rx.diet_precautions.length > 0 && (
                                    <div className="border-t border-border/50 pt-2.5">
                                      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block">Dietary Restrictions & Instructions</span>
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {rx.diet_precautions.map((tag, idx) => (
                                          <span key={idx} className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/10 px-2 py-0.5 rounded-md text-[9px] font-bold">
                                            {tag}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                !isDraft && (
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-dashed border-amber-500/20 bg-amber-500/5 rounded-xl p-3.5 text-xs text-amber-600 font-medium">
                                    <div className="flex items-center gap-2">
                                      <AlertCircle size={14} className="flex-shrink-0" />
                                      <span>No prescription recorded for this completed session.</span>
                                    </div>
                                    {/* Incomplete session handling */}
                                    <button
                                      onClick={() => handleResumeConsultation(c.id)}
                                      className="flex items-center justify-center gap-1 bg-amber-500 text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-amber-600 transition-colors focus:outline-none shadow-xs w-full sm:w-auto"
                                    >
                                      <PlusCircle size={12} />
                                      Add Prescription to this Session
                                    </button>
                                  </div>
                                )
                              )}

                              {/* ─── ACTION BUTTONS TOOLBAR ─── */}
                              <div className="border-t border-border/50 pt-3 flex flex-wrap gap-2.5 items-center justify-between">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleResumeConsultation(c.id)}
                                    className="flex items-center gap-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground px-3 py-2 text-xs font-semibold transition-colors focus:outline-none"
                                  >
                                    <Edit2 size={12} />
                                    Edit / Resume Session
                                  </button>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-stretch sm:items-center">
                                  {invoice && invoice.payment_status.toUpperCase() === 'PENDING' && (
                                    <button
                                      onClick={() => handleShareInvoiceWhatsApp(selectedPatient.full_name, selectedPatient.phone, invoice.amount, invoice.pdf_url)}
                                      className="flex items-center justify-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 px-3 py-2 rounded-lg transition-colors focus:outline-none"
                                    >
                                      <Phone size={12} />
                                      Resend Invoice via WhatsApp
                                    </button>
                                  )}

                                  {rx && rx.pdf_url && (
                                    <button
                                      onClick={() => handleShareRxWhatsApp(selectedPatient.full_name, selectedPatient.phone, rx.pdf_url || '', rx.diet_precautions)}
                                      className="flex items-center justify-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 px-3 py-2 rounded-lg transition-colors focus:outline-none"
                                    >
                                      <Phone size={12} />
                                      Resend Rx via WhatsApp
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-muted/5 to-background relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(var(--primary),0.05)_0%,transparent_70%)] pointer-events-none"></div>
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 flex items-center justify-center text-primary mb-6 border border-primary/20 shadow-[0_0_30px_rgba(var(--primary),0.1)] relative z-10 group transition-transform duration-500 hover:scale-105">
              <Activity size={40} className="animate-pulse" />
              <div className="absolute inset-0 bg-primary/5 rounded-3xl animate-ping opacity-20"></div>
            </div>
            <h3 className="text-xl font-extrabold text-foreground tracking-tight relative z-10">Welcome to Yashfeen <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500">EMR</span></h3>
            <p className="text-sm text-muted-foreground mt-3 max-w-md leading-relaxed relative z-10">
              Select an existing patient profile from the directory on the left, or register a new one to begin consultations, manage invoices, and compose beautiful prescriptions.
            </p>
            <button
              onClick={handleCreateNewPatient}
              className="flex items-center gap-2 mt-8 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-sm font-bold text-white hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 focus:outline-none relative z-10"
            >
              <UserPlus size={18} />
              Register Your First Patient
            </button>
          </div>
        )}
      </div>

      {/* Register / Edit Patient Modal */}
      <AddPatientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        patientToEdit={patientToEdit}
      />
    </div>
  );
}
