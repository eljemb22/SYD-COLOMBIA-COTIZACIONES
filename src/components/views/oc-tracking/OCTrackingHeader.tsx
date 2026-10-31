import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Search,
  Building2,
  CreditCard,
  Activity,
  FolderTree,
  ListFilter,
  DollarSign,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  PAYMENT_TERMS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  OC_STATUS_OPTIONS,
} from '../../../utils/ocTrackingStorage';

interface OCTrackingHeaderProps {
  viewMode: 'hierarchy' | 'supplier' | 'table';
  onChangeViewMode: (mode: 'hierarchy' | 'supplier' | 'table') => void;
  lifecycleTab?: 'active' | 'archived' | 'all';
  onChangeLifecycleTab?: (tab: 'active' | 'archived' | 'all') => void;
  activeOCsCount?: number;
  archivedOCsCount?: number;
  totalOCsCount?: number;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filterSupplier: string;
  onFilterSupplierChange: (s: string) => void;
  filterPaymentTerms: string;
  onFilterPaymentTermsChange: (p: string) => void;
  filterPaymentStatus: string;
  onFilterPaymentStatusChange: (p: string) => void;
  filterStatus: string;
  onFilterStatusChange: (st: string) => void;
  filterAlertOnly: boolean;
  onFilterAlertOnlyChange: (val: boolean) => void;
  distinctSuppliers: string[];
  kpis: {
    pendingOCs: number;
    pendingItems: number;
    pendingTotalCostCOP: number;
    completedOCs: number;
    completedItems: number;
    completedTotalCostCOP: number;
    totalContracts: number;
    totalOCs: number;
    totalItems: number;
    totalCostCOP: number;
    totalCreditOrders?: number;
    totalAlerts?: number;
  };
  onOpenNewOCModal?: () => void;
  onOpenSuppliersModal: () => void;
  onExportExcel: () => void;
  onSyncAwarded: () => void;
  isReadOnly?: boolean;
}

export const OCTrackingHeader: React.FC<OCTrackingHeaderProps> = ({
  viewMode,
  onChangeViewMode,
  lifecycleTab = 'active',
  onChangeLifecycleTab,
  activeOCsCount = 0,
  archivedOCsCount = 0,
  totalOCsCount,
  searchTerm,
  onSearchChange,
  filterSupplier,
  onFilterSupplierChange,
  filterPaymentTerms,
  onFilterPaymentTermsChange,
  filterPaymentStatus,
  onFilterPaymentStatusChange,
  filterStatus,
  onFilterStatusChange,
  distinctSuppliers,
  kpis,
  onOpenSuppliersModal,
  onExportExcel,
  isReadOnly = false,
}) => {
  const [isKpiCollapsed, setIsKpiCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('oc_kpis_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleKpiCollapse = () => {
    setIsKpiCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('oc_kpis_collapsed', String(next));
      } catch {
        // Ignore local storage error
      }
      return next;
    });
  };

  return (
    <div className="space-y-3.5">
      {/* Top Action Bar */}
      <div className="flex items-center justify-end flex-wrap gap-2.5 pb-2 border-b border-[#334d6e]">
        <button
          type="button"
          onClick={onOpenSuppliersModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-bold transition shadow-sm cursor-pointer"
          title="Directorio de proveedores, modificar información, ver OCs ligadas y trazabilidad"
        >
          <Building2 className="w-4 h-4 text-purple-400" />
          <span>Directorio de Proveedores</span>
        </button>

        <button
          type="button"
          onClick={onExportExcel}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition cursor-pointer"
          title="Exportar base completa a Excel"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>Exportar Excel</span>
        </button>
      </div>

      {/* View Mode Selector + Filters Bar */}
      <div
        style={{
          backgroundColor: 'var(--syd-card-bg)',
          borderColor: 'var(--syd-border-color)',
        }}
        className="p-3 rounded-2xl border space-y-3"
      >
        {/* Lifecycle Filter Tabs: OCs Activas vs Entregadas & Archivadas vs Todas */}
        {onChangeLifecycleTab && (
          <div
            style={{
              backgroundColor: 'var(--syd-card-hover)',
              borderColor: 'var(--syd-border-color)',
            }}
            className="flex flex-wrap items-center justify-between gap-2 p-1.5 rounded-xl border shadow-sm"
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => onChangeLifecycleTab('active')}
                style={
                  lifecycleTab === 'active'
                    ? {
                        backgroundColor: 'var(--syd-accent)',
                        color: 'var(--syd-btn-text)',
                      }
                    : undefined
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  lifecycleTab === 'active'
                    ? 'shadow-sm font-black'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>OCs Activas / En Tránsito ({activeOCsCount})</span>
              </button>

              <button
                type="button"
                onClick={() => onChangeLifecycleTab('archived')}
                style={
                  lifecycleTab === 'archived'
                    ? {
                        backgroundColor: 'var(--syd-accent)',
                        color: 'var(--syd-btn-text)',
                      }
                    : undefined
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  lifecycleTab === 'archived'
                    ? 'shadow-sm font-black'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Entregadas & Archivadas ({archivedOCsCount})</span>
              </button>

              <button
                type="button"
                onClick={() => onChangeLifecycleTab('all')}
                style={
                  lifecycleTab === 'all'
                    ? {
                        backgroundColor: 'var(--syd-accent)',
                        color: 'var(--syd-btn-text)',
                      }
                    : undefined
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  lifecycleTab === 'all'
                    ? 'shadow-sm font-black'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <FolderTree className="w-3.5 h-3.5" />
                <span>Todas las OCs ({totalOCsCount !== undefined ? totalOCsCount : activeOCsCount + archivedOCsCount})</span>
              </button>
            </div>

            <span className="text-[11px] text-slate-400 italic hidden sm:block pr-2">
              {lifecycleTab === 'active'
                ? 'Los equipos marcados como «Entregado e Instalado» se archivan automáticamente de esta vista activa'
                : lifecycleTab === 'archived'
                ? 'Histórico de OCs y equipos culminados al 100% con seriales y facturas'
                : 'Mostrando todo el historial de órdenes de compra'}
            </span>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* View Mode Switcher */}
          <div
            style={{
              backgroundColor: 'var(--syd-card-hover)',
              borderColor: 'var(--syd-border-color)',
            }}
            className="flex items-center p-1 rounded-xl border"
          >
            <button
              type="button"
              onClick={() => onChangeViewMode('hierarchy')}
              style={
                viewMode === 'hierarchy'
                  ? {
                      backgroundColor: 'var(--syd-accent)',
                      color: 'var(--syd-btn-text)',
                    }
                  : undefined
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'hierarchy'
                  ? 'font-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Por Contrato / Cliente (Jerárquico)</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeViewMode('supplier')}
              style={
                viewMode === 'supplier'
                  ? {
                      backgroundColor: 'var(--syd-accent)',
                      color: 'var(--syd-btn-text)',
                    }
                  : undefined
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'supplier'
                  ? 'font-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Por Proveedor / Fabricante</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeViewMode('table')}
              style={
                viewMode === 'table'
                  ? {
                      backgroundColor: 'var(--syd-accent)',
                      color: 'var(--syd-btn-text)',
                    }
                  : undefined
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'table'
                  ? 'font-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Tabla Consolidada</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por Contrato, Cliente, OC, Proveedor, Equipo, Modelo..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{
                backgroundColor: 'var(--syd-card-hover)',
                borderColor: 'var(--syd-border-color)',
                color: 'var(--syd-text-primary)',
              }}
              className="w-full border rounded-xl pl-9 pr-3 py-1.5 text-xs placeholder-slate-400 outline-none focus:ring-1 focus:ring-[var(--syd-accent)]"
            />
          </div>
        </div>

        {/* Filter Dropdowns Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-[#223854] text-xs">
          {/* Supplier Filter */}
          <div className="flex items-center gap-1.5 bg-[#101b2b] px-2.5 py-1.5 rounded-xl border border-[#334d6e] focus-within:border-sky-400">
            <Building2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <select
              value={filterSupplier}
              onChange={(e) => onFilterSupplierChange(e.target.value)}
              className="w-full bg-[#101b2b] text-white font-semibold outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-[#101b2b] text-white">Todos los Proveedores</option>
              {Array.from(new Set(distinctSuppliers)).map((s, idx) => (
                <option key={`filter_sup_${s}_${idx}`} value={s} className="bg-[#101b2b] text-white">
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Forma de Pago Filter (Crédito, Contado, 50/50, etc.) */}
          <div className="flex items-center gap-1.5 bg-[#101b2b] px-2.5 py-1.5 rounded-xl border border-[#334d6e] focus-within:border-indigo-400">
            <CreditCard className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <select
              value={filterPaymentTerms}
              onChange={(e) => onFilterPaymentTermsChange(e.target.value)}
              className="w-full bg-[#101b2b] text-white font-semibold outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-[#101b2b] text-white">Todas las Formas de Pago</option>
              {PAYMENT_TERMS_OPTIONS.map((opt) => (
                <option key={opt.terms} value={opt.terms} className="bg-[#101b2b] text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Estado de Pago Filter */}
          <div className="flex items-center gap-1.5 bg-[#101b2b] px-2.5 py-1.5 rounded-xl border border-[#334d6e] focus-within:border-emerald-400">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <select
              value={filterPaymentStatus}
              onChange={(e) => onFilterPaymentStatusChange(e.target.value)}
              className="w-full bg-[#101b2b] text-white font-semibold outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-[#101b2b] text-white">Todos los Estados de Pago</option>
              {PAYMENT_STATUS_OPTIONS.map((opt) => (
                <option key={opt.status} value={opt.status} className="bg-[#101b2b] text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Estado Logístico Filter */}
          <div className="flex items-center gap-1.5 bg-[#101b2b] px-2.5 py-1.5 rounded-xl border border-[#334d6e] focus-within:border-purple-400">
            <Activity className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <select
              value={filterStatus}
              onChange={(e) => onFilterStatusChange(e.target.value)}
              className="w-full bg-[#101b2b] text-white font-semibold outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-[#101b2b] text-white">Todos los Estados Operativos</option>
              {OC_STATUS_OPTIONS.map((opt) => (
                <option key={opt.status} value={opt.status} className="bg-[#101b2b] text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
