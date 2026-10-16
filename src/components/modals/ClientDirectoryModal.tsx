import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  Search,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Edit2,
  Trash2,
  CheckCircle2,
  X,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Calendar,
  AlertTriangle,
  Check,
} from 'lucide-react';
import {
  ClientRecord,
  getStoredClients,
  saveOrUpdateClientRecord,
  persistClients,
  harvestAllClientsFromSystem,
  normalizeClientName,
  resolveDepartmentFromCity,
  getClientDataStatus,
  markClientAsPermanentlyDeleted,
} from '../../utils/clientStorage';
import type { ClientPendingField } from '../../utils/clientStorage';
import { deleteClientFromFirestore } from '../../services/realtimeSync';
import { SavedQuote, TenderClientProject, OCTrackingContract } from '../../types';
export { getClientDataStatus };
export type { ClientPendingField };

const EMPTY_TENDERS: TenderClientProject[] = [];
const EMPTY_CONTRACTS: OCTrackingContract[] = [];

interface ClientDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedQuotes: SavedQuote[];
  tenderClients?: TenderClientProject[];
  ocContracts?: OCTrackingContract[];
  onSelectClient?: (client: ClientRecord) => void;
  onViewQuote?: (quote: SavedQuote) => void;
}

export const ClientDirectoryModal: React.FC<ClientDirectoryModalProps> = ({
  isOpen,
  onClose,
  savedQuotes,
  tenderClients = EMPTY_TENDERS,
  ocContracts = EMPTY_CONTRACTS,
  onSelectClient,
  onViewQuote,
}) => {
  const [clients, setClients] = useState<ClientRecord[]>(() => {
    return harvestAllClientsFromSystem(savedQuotes, tenderClients, ocContracts);
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'pending' | 'complete' | 'missing_nit' | 'missing_phone' | 'missing_email' | 'missing_contact'>('all');
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  // Form State for creating/editing
  const [isEditing, setIsEditing] = useState(false);
  const [editingClient, setEditingClient] = useState<Partial<ClientRecord> | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [clientToDelete, setClientToDelete] = useState<{ id: string; name: string } | null>(null);

  // Map quotes to clients for fast lookup and display
  const clientQuotesMap = useMemo(() => {
    const map = new Map<string, SavedQuote[]>();
    savedQuotes.forEach((quote) => {
      const norm = normalizeClientName(quote.clientName);
      if (!norm) return;
      const list = map.get(norm) || [];
      list.push(quote);
      map.set(norm, list);
    });
    return map;
  }, [savedQuotes]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => {
      if (c.department) set.add(c.department.trim());
    });
    return Array.from(set).sort();
  }, [clients]);

  // Global counts for pending vs complete
  const { pendingCount, completeCount } = useMemo(() => {
    let pending = 0;
    let complete = 0;
    clients.forEach((c) => {
      const status = getClientDataStatus(c);
      if (status.isComplete) {
        complete++;
      } else {
        pending++;
      }
    });
    return { pendingCount: pending, completeCount: complete };
  }, [clients]);

  // Filtered clients
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        (c.name || '').toLowerCase().includes(q) ||
        (c.nit || '').toLowerCase().includes(q) ||
        (c.city || '').toLowerCase().includes(q) ||
        (c.contactPerson || '').toLowerCase().includes(q) ||
        (c.contactEmail || '').toLowerCase().includes(q);

      const matchDept = selectedDeptFilter === 'all' || c.department === selectedDeptFilter;
      const matchSource = selectedSourceFilter === 'all' || c.source === selectedSourceFilter;

      const status = getClientDataStatus(c);
      let matchStatus = true;
      if (selectedStatusFilter === 'pending') {
        matchStatus = !status.isComplete;
      } else if (selectedStatusFilter === 'complete') {
        matchStatus = status.isComplete;
      } else if (selectedStatusFilter === 'missing_nit') {
        matchStatus = status.missingFields.some((f) => f.key === 'nit');
      } else if (selectedStatusFilter === 'missing_phone') {
        matchStatus = status.missingFields.some((f) => f.key === 'contactPhone');
      } else if (selectedStatusFilter === 'missing_email') {
        matchStatus = status.missingFields.some((f) => f.key === 'contactEmail');
      } else if (selectedStatusFilter === 'missing_contact') {
        matchStatus = status.missingFields.some((f) => f.key === 'contactPerson');
      }

      return matchSearch && matchDept && matchSource && matchStatus;
    });
  }, [clients, searchTerm, selectedDeptFilter, selectedSourceFilter, selectedStatusFilter]);

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient || !editingClient.name?.trim()) return;

    try {
      await saveOrUpdateClientRecord({
        id: editingClient.id,
        name: editingClient.name.trim(),
        nit: editingClient.nit?.trim() || '',
        city: editingClient.city?.trim() || '',
        department: editingClient.department?.trim() || resolveDepartmentFromCity(editingClient.city?.trim()),
        contactPerson: editingClient.contactPerson?.trim() || '',
        contactEmail: editingClient.contactEmail?.trim() || '',
        contactPhone: editingClient.contactPhone?.trim() || '',
        address: editingClient.address?.trim() || '',
        notes: editingClient.notes?.trim() || '',
        source: editingClient.source || 'manual',
      });

      const updated = harvestAllClientsFromSystem(savedQuotes, tenderClients, ocContracts);
      setClients(updated);
      setIsEditing(false);
      setEditingClient(null);
      setFormSuccess('¡Cliente guardado y actualizado exitosamente en el directorio!');
      setTimeout(() => setFormSuccess(null), 3000);
    } catch (err: any) {
      alert('Error guardando cliente: ' + (err?.message || 'Error'));
    }
  };

  const handleDeleteClient = (clientId: string, clientName: string) => {
    setClientToDelete({ id: clientId, name: clientName });
  };

  const confirmDeleteClient = async () => {
    if (!clientToDelete) return;
    const { id: clientId, name: clientName } = clientToDelete;
    markClientAsPermanentlyDeleted(clientId, clientName);
    const remaining = clients.filter((c) => c.id !== clientId);
    persistClients(remaining);
    setClients(remaining);
    try {
      await deleteClientFromFirestore(clientId);
    } catch (e) {
      console.error('Error deleting client from Firestore:', e);
    }
    setClientToDelete(null);
    setFormSuccess(`¡Cliente "${clientName}" eliminado exitosamente del directorio!`);
    setTimeout(() => setFormSuccess(null), 3000);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/25 flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#192b45] border border-[#38bdf8]/50 rounded-2xl max-w-5xl w-full shadow-2xl animate-scaleUp max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#334d6e] flex items-center justify-between gap-3 bg-[#15253d] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-white">
                  Directorio de Clientes &amp; Entidades
                </h3>
                <span className="text-xs bg-[#38bdf8]/20 text-[#38bdf8] px-2.5 py-0.5 rounded-full font-bold border border-[#38bdf8]/30">
                  {clients.length} Registrados
                </span>
                {pendingCount > 0 && (
                  <span className="text-xs bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full font-bold border border-amber-500/40 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    {pendingCount} con datos pendientes
                  </span>
                )}
                {completeCount > 0 && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full font-bold border border-emerald-500/40 hidden sm:inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    {completeCount} completos
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Revise el estado de NIT, contacto y ubicación de cada cliente. Cargue sus datos completos a la cotización con un clic.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-red-500/20 rounded-lg transition border border-[#334d6e] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Success toast */}
        {formSuccess && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-4 py-2 text-xs font-bold text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{formSuccess}</span>
          </div>
        )}

        {/* Controls & Quick Status Tabs Bar */}
        <div className="p-4 bg-[#111c2e] border-b border-[#334d6e] space-y-3 shrink-0">
          {/* Quick status filter pills */}
          <div className="flex flex-wrap items-center gap-2 pb-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Filtrar por estado:
            </span>

            <button
              type="button"
              onClick={() => setSelectedStatusFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                selectedStatusFilter === 'all'
                  ? 'bg-[#38bdf8] text-[#0f172a] shadow-sm'
                  : 'bg-[#192b45] text-slate-300 hover:text-white border border-[#334d6e]'
              }`}
            >
              <span>Todos</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold border ${
                  selectedStatusFilter === 'all'
                    ? 'bg-slate-950 text-white border-white/20'
                    : 'bg-black/30 text-slate-200 border-white/10'
                }`}
              >
                {clients.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedStatusFilter('pending')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                selectedStatusFilter === 'pending'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                  : 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/40'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Datos Pendientes</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold border ${
                  selectedStatusFilter === 'pending'
                    ? 'bg-slate-950 text-amber-300 border-amber-400/40'
                    : 'bg-amber-950/40 text-amber-300 border-amber-500/30'
                }`}
              >
                {pendingCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedStatusFilter('complete')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                selectedStatusFilter === 'complete'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm font-black'
                  : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/40'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Datos Completos</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold border ${
                  selectedStatusFilter === 'complete'
                    ? 'bg-slate-950 text-emerald-300 border-emerald-400/40'
                    : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                }`}
              >
                {completeCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'missing_nit' ? 'all' : 'missing_nit')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                selectedStatusFilter === 'missing_nit'
                  ? 'bg-rose-500 text-white font-bold'
                  : 'bg-[#192b45] text-slate-300 hover:text-white border border-[#334d6e]'
              }`}
            >
              Falta NIT
            </button>

            <button
              type="button"
              onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'missing_phone' ? 'all' : 'missing_phone')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                selectedStatusFilter === 'missing_phone'
                  ? 'bg-rose-500 text-white font-bold'
                  : 'bg-[#192b45] text-slate-300 hover:text-white border border-[#334d6e]'
              }`}
            >
              Falta Teléfono
            </button>

            <button
              type="button"
              onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'missing_email' ? 'all' : 'missing_email')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                selectedStatusFilter === 'missing_email'
                  ? 'bg-rose-500 text-white font-bold'
                  : 'bg-[#192b45] text-slate-300 hover:text-white border border-[#334d6e]'
              }`}
            >
              Falta Correo
            </button>
          </div>

          {/* Search bar & selectors */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por cliente, NIT, ciudad, contacto o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#192b45] border border-[#334d6e] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-[#38bdf8]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Department Filter */}
              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className="bg-[#192b45] border border-[#334d6e] rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-[#38bdf8]"
              >
                <option value="all">Todos los Departamentos</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              {/* Source Filter */}
              <select
                value={selectedSourceFilter}
                onChange={(e) => setSelectedSourceFilter(e.target.value)}
                className="bg-[#192b45] border border-[#334d6e] rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-[#38bdf8]"
              >
                <option value="all">Todas las Fuentes</option>
                <option value="cotizacion">Cotizaciones</option>
                <option value="licitacion">Licitaciones</option>
                <option value="oc">Órdenes de Compra</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          </div>
        </div>

        {/* Modal Body / Client Cards List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#15253d] scrollbar-thin">
          {/* New / Edit Form Drawer */}
          {isEditing && editingClient && (
            <form onSubmit={handleSaveForm} className="bg-[#111c2e] border-2 border-[#38bdf8] rounded-xl p-4 mb-4 space-y-4 shadow-xl animate-fadeIn">
              <div className="flex items-center justify-between border-b border-[#334d6e] pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#38bdf8]/20 text-[#38bdf8]">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">
                      {editingClient.id ? 'Editar y Completar Datos del Cliente' : 'Registrar Nuevo Cliente en Directorio'}
                    </h4>
                    <p className="text-[10.5px] text-slate-400">
                      Los campos marcados como pendientes se actualizarán en toda la plataforma.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-[#192b45] border border-[#334d6e]"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-200">
                      Nombre o Razón Social *
                    </label>
                    {editingClient.name?.trim() ? (
                      <span className="text-[9.5px] text-emerald-400 font-semibold flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> Completado
                      </span>
                    ) : (
                      <span className="text-[9.5px] text-amber-400 font-semibold flex items-center gap-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" /> Requerido
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={editingClient.name || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                    placeholder="Ej: E.S.E. Hospital San Jerónimo de Montería"
                    className="w-full bg-[#192b45] border border-[#334d6e] focus:border-[#38bdf8] rounded-lg px-3 py-1.5 text-xs text-white uppercase font-bold focus:outline-hidden"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-200">NIT / Cédula</label>
                    {editingClient.nit?.trim() ? (
                      <span className="text-[9.5px] text-emerald-400 font-semibold flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> NIT OK
                      </span>
                    ) : (
                      <span className="text-[9.5px] text-amber-400 font-semibold flex items-center gap-0.5 bg-amber-500/10 px-1 rounded">
                        <AlertTriangle className="w-2.5 h-2.5" /> Pendiente
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={editingClient.nit || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, nit: e.target.value })}
                    placeholder="Ej: 890.123.456-7"
                    className={`w-full bg-[#192b45] border rounded-lg px-3 py-1.5 text-xs text-white font-mono font-semibold focus:outline-hidden ${
                      !editingClient.nit?.trim() ? 'border-amber-500/60 focus:border-amber-400' : 'border-[#334d6e] focus:border-[#38bdf8]'
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-200">Ciudad</label>
                    {editingClient.city?.trim() ? (
                      <span className="text-[9.5px] text-emerald-400 font-semibold flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> OK
                      </span>
                    ) : (
                      <span className="text-[9.5px] text-amber-400 font-semibold flex items-center gap-0.5 bg-amber-500/10 px-1 rounded">
                        <AlertTriangle className="w-2.5 h-2.5" /> Pendiente
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={editingClient.city || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, city: e.target.value })}
                    placeholder="Ej: Barranquilla"
                    className="w-full bg-[#192b45] border border-[#334d6e] focus:border-[#38bdf8] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-200">Departamento</label>
                  </div>
                  <input
                    type="text"
                    value={editingClient.department || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, department: e.target.value })}
                    placeholder="Ej: Atlántico"
                    className="w-full bg-[#192b45] border border-[#334d6e] focus:border-[#38bdf8] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-200">Persona de Contacto</label>
                    {editingClient.contactPerson?.trim() ? (
                      <span className="text-[9.5px] text-emerald-400 font-semibold flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> OK
                      </span>
                    ) : (
                      <span className="text-[9.5px] text-amber-400 font-semibold flex items-center gap-0.5 bg-amber-500/10 px-1 rounded">
                        <AlertTriangle className="w-2.5 h-2.5" /> Pendiente
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={editingClient.contactPerson || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, contactPerson: e.target.value })}
                    placeholder="Ej: Dra. María Gómez - Compras"
                    className={`w-full bg-[#192b45] border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden ${
                      !editingClient.contactPerson?.trim() ? 'border-amber-500/60 focus:border-amber-400' : 'border-[#334d6e] focus:border-[#38bdf8]'
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-200">Teléfono / Celular</label>
                    {editingClient.contactPhone?.trim() ? (
                      <span className="text-[9.5px] text-emerald-400 font-semibold flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> OK
                      </span>
                    ) : (
                      <span className="text-[9.5px] text-amber-400 font-semibold flex items-center gap-0.5 bg-amber-500/10 px-1 rounded">
                        <AlertTriangle className="w-2.5 h-2.5" /> Pendiente
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={editingClient.contactPhone || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, contactPhone: e.target.value })}
                    placeholder="Ej: (605) 300-1234 / 310-0000000"
                    className={`w-full bg-[#192b45] border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden ${
                      !editingClient.contactPhone?.trim() ? 'border-amber-500/60 focus:border-amber-400' : 'border-[#334d6e] focus:border-[#38bdf8]'
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-200">Correo Electrónico</label>
                    {editingClient.contactEmail?.trim() ? (
                      <span className="text-[9.5px] text-emerald-400 font-semibold flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> OK
                      </span>
                    ) : (
                      <span className="text-[9.5px] text-amber-400 font-semibold flex items-center gap-0.5 bg-amber-500/10 px-1 rounded">
                        <AlertTriangle className="w-2.5 h-2.5" /> Pendiente
                      </span>
                    )}
                  </div>
                  <input
                    type="email"
                    value={editingClient.contactEmail || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, contactEmail: e.target.value })}
                    placeholder="Ej: compras@hospital.gov.co"
                    className={`w-full bg-[#192b45] border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden ${
                      !editingClient.contactEmail?.trim() ? 'border-amber-500/60 focus:border-amber-400' : 'border-[#334d6e] focus:border-[#38bdf8]'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-200 mb-1">Dirección Física</label>
                  <input
                    type="text"
                    value={editingClient.address || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, address: e.target.value })}
                    placeholder="Ej: Cra 50 # 80-100"
                    className="w-full bg-[#192b45] border border-[#334d6e] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-[#38bdf8]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#334d6e]">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#192b45] hover:bg-[#223b5d] text-slate-300 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Guardar Datos del Cliente</span>
                </button>
              </div>
            </form>
          )}

          {filteredClients.length === 0 ? (
            <div className="p-8 text-center bg-[#111c2e] rounded-xl border border-[#334d6e] space-y-2">
              <Building2 className="w-10 h-10 text-slate-500 mx-auto" />
              <p className="text-sm font-bold text-slate-300">No se encontraron clientes</p>
              <p className="text-xs text-slate-400">
                {searchTerm
                  ? `Ningún cliente coincide con "${searchTerm}".`
                  : selectedStatusFilter !== 'all'
                  ? 'No hay clientes con el filtro de estado seleccionado.'
                  : 'No hay clientes registrados en el directorio todavía.'}
              </p>
            </div>
          ) : (
            filteredClients.map((client) => {
              const norm = normalizeClientName(client.name);
              const quotesForClient = clientQuotesMap.get(norm) || [];
              const isExpanded = expandedClientId === client.id;
              const statusInfo = getClientDataStatus(client);

              return (
                <div
                  key={client.id}
                  className={`bg-[#111c2e] border rounded-xl p-3.5 transition shadow-sm space-y-3 ${
                    statusInfo.isComplete
                      ? 'border-[#334d6e] hover:border-emerald-500/50'
                      : 'border-amber-500/30 hover:border-amber-400/60 bg-[#111c2e]/90'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    {/* Left: Client info & pending badges */}
                    <div className="space-y-1.5 min-w-[260px] flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-black text-white">
                          {client.name}
                        </h4>

                        {client.nit ? (
                          <span className="text-[10px] bg-[#192b45] text-slate-200 px-2 py-0.5 rounded-md border border-[#334d6e] font-mono font-bold">
                            NIT: {client.nit}
                          </span>
                        ) : null}

                        {client.department && (
                          <span className="text-[10px] bg-[#0284c7]/20 text-[#38bdf8] px-2 py-0.5 rounded-md border border-[#0284c7]/40 font-semibold flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5" />
                            {client.city ? `${client.city}, ${client.department}` : client.department}
                          </span>
                        )}
                      </div>

                      {/* ESTADO DE DATOS (AFUERA EN CADA CLIENTE) */}
                      <div className="pt-0.5">
                        {statusInfo.isComplete ? (
                          <div className="inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10.5px] font-bold px-2.5 py-0.5 rounded-md">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Datos Completos (100%)</span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10.5px] font-bold text-amber-300 flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md">
                              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                              {statusInfo.missingFields.length} {statusInfo.missingFields.length === 1 ? 'pendiente' : 'pendientes'}:
                            </span>
                            {statusInfo.missingFields.map((f) => (
                              <span
                                key={f.key}
                                className="text-[10px] font-bold bg-amber-500/20 text-amber-200 border border-amber-500/40 px-2 py-0.5 rounded-md shadow-2xs"
                              >
                                Falta {f.label}
                              </span>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingClient(client);
                                setIsEditing(true);
                              }}
                              className="text-[10px] font-bold text-[#38bdf8] hover:text-white underline ml-1 cursor-pointer flex items-center gap-0.5"
                            >
                              <Edit2 className="w-2.5 h-2.5" /> Completar datos
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Contact & Location details */}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300 pt-1">
                        {client.contactPerson ? (
                          <span className="flex items-center gap-1">
                            <strong className="text-slate-400">Contacto:</strong> {client.contactPerson}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic text-[10.5px]">
                            Sin contacto asignado
                          </span>
                        )}

                        {client.contactPhone ? (
                          <span className="flex items-center gap-1 text-slate-300">
                            <Phone className="w-3 h-3 text-[#38bdf8]" />
                            {client.contactPhone}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic text-[10.5px]">
                            Sin teléfono
                          </span>
                        )}

                        {client.contactEmail ? (
                          <span className="flex items-center gap-1 text-slate-300">
                            <Mail className="w-3 h-3 text-[#38bdf8]" />
                            {client.contactEmail}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic text-[10.5px]">
                            Sin email
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Quotes summary & actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Quotes count pill */}
                      <button
                        type="button"
                        onClick={() => setExpandedClientId(isExpanded ? null : client.id)}
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-xl border transition cursor-pointer ${
                          quotesForClient.length > 0
                            ? 'bg-[#38bdf8]/15 border-[#38bdf8]/40 text-[#38bdf8] hover:bg-[#38bdf8]/25'
                            : 'bg-[#192b45] border-[#334d6e] text-slate-400 hover:text-slate-200'
                        }`}
                        title="Ver cotizaciones asociadas a este cliente"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>
                          {quotesForClient.length}{' '}
                          {quotesForClient.length === 1 ? 'Cotización' : 'Cotizaciones'}
                        </span>
                        {quotesForClient.length > 0 && (
                          isExpanded ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />
                        )}
                      </button>

                      {/* Select / Load to Quote button */}
                      {onSelectClient && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectClient(client);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition cursor-pointer"
                          title="Cargar estos datos en la cotización actual"
                        >
                          <span>Cargar a Cotización</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Edit button */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingClient(client);
                          setIsEditing(true);
                        }}
                        className="p-1.5 bg-[#192b45] hover:bg-[#223b5d] text-slate-300 hover:text-white border border-[#334d6e] rounded-lg transition cursor-pointer"
                        title="Editar cliente"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>

                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteClient(client.id, client.name)}
                        className="p-1.5 bg-[#192b45] hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-[#334d6e] rounded-lg transition cursor-pointer"
                        title="Eliminar del directorio"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Quotes List */}
                  {isExpanded && (
                    <div className="mt-2.5 pt-2.5 border-t border-[#334d6e] space-y-2 bg-[#0d1624] rounded-lg p-3 animate-fadeIn">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                        <span className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-[#38bdf8]" />
                          Cotizaciones Emitidas a este Cliente ({quotesForClient.length}):
                        </span>
                      </div>

                      {quotesForClient.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic">
                          Aún no se han guardado cotizaciones para este cliente. Puede crear una cotización y guardarla para que aparezca aquí automáticamente.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {quotesForClient.map((q) => (
                            <div
                              key={q.id}
                              className="bg-[#15253d] border border-[#334d6e] hover:border-[#38bdf8] rounded-lg p-2.5 transition flex flex-col justify-between gap-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono font-bold text-xs text-[#38bdf8]">
                                  {q.quoteNumber}
                                </span>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                    q.status === 'Aprobada'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : q.status === 'Enviada'
                                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                      : 'bg-slate-700/50 text-slate-300'
                                  }`}
                                >
                                  {q.status}
                                </span>
                              </div>

                              <div className="text-[11px] text-slate-300 space-y-0.5">
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-1 text-slate-400">
                                    <Calendar className="w-3 h-3" /> {q.date}
                                  </span>
                                  <span className="font-bold text-white flex items-center">
                                    <DollarSign className="w-3 h-3 text-emerald-400" />
                                    ${(q.total || 0).toLocaleString('es-CO')} COP
                                  </span>
                                </div>
                                <div className="text-[10.5px] text-slate-400 truncate">
                                  {q.items?.length || 0} ítems ({q.items?.map((it) => it.name).slice(0, 2).join(', ') || 'Sin ítems'}...)
                                </div>
                              </div>

                              {onViewQuote && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onViewQuote(q);
                                    onClose();
                                  }}
                                  className="w-full mt-1 py-1 bg-[#192b45] hover:bg-[#253e60] text-[#38bdf8] text-[11px] font-bold rounded-md border border-[#334d6e] transition flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <span>Abrir / Cargar Cotización</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#334d6e] bg-[#15253d] flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-slate-400">
            Mostrando {filteredClients.length} de {clients.length} clientes registrados
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#192b45] hover:bg-[#223b5d] text-slate-200 text-xs font-bold rounded-xl border border-[#334d6e] transition cursor-pointer"
          >
            Cerrar Directorio
          </button>
        </div>

        {/* Modal de confirmación para eliminar cliente sin depender de window.confirm */}
        {clientToDelete && (
          <div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-[#1e293b] border border-red-500/60 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-scaleUp">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">¿Eliminar cliente del directorio?</h4>
                  <p className="text-xs text-slate-400">Esta acción removerá el cliente permanentemente.</p>
                </div>
              </div>

              <div className="bg-[#0f172a] p-3 rounded-xl border border-slate-700/60 text-xs text-slate-300">
                Está a punto de eliminar a:
                <p className="mt-1 font-bold text-white text-sm">
                  {clientToDelete.name}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setClientToDelete(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-600 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteClient}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-red-900/40 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Sí, Eliminar Definitivamente
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
