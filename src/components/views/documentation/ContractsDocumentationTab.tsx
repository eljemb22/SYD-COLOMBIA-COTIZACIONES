import React, { useState, useMemo } from 'react';
import {
  Building2,
  FileText,
  ShieldCheck,
  BookOpen,
  Wrench,
  Zap,
  Award,
  File,
  Eye,
  Download,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Search,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Filter,
  Boxes,
  Tag,
  FileCheck,
  Printer,
  Layers,
} from 'lucide-react';
import {
  TechnicalDocument,
  MedicalEquipment,
  TenderClientProject,
  OCTrackingContract,
  TenderItem,
  OCTrackingItem,
} from '../../../types';
import { normalizeClean, formatExactCOP } from '../../../utils/formatters';
import { ItemSerialsDossierModal } from '../oc-tracking/ItemSerialsDossierModal';

interface ContractsDocumentationTabProps {
  tenderClients?: TenderClientProject[];
  ocContracts?: OCTrackingContract[];
  equipments: MedicalEquipment[];
  documents: TechnicalDocument[];
  isReadOnly?: boolean;
  onOpenNewDocumentModal: (equipmentId?: string, docType?: string) => void;
  onPreviewDoc: (doc: TechnicalDocument) => void;
  onDownloadDoc: (doc: TechnicalDocument) => void;
  onDeleteDocument: (docId: string) => void;
  onSaveDocument?: (newDoc: TechnicalDocument) => void;
  onUpdateContracts?: (contracts: OCTrackingContract[]) => void;
  mode?: 'all' | 'tenders' | 'direct_oc';
  searchQuery?: string;
  onNavigateToTenders?: () => void;
  onNavigateToOCTracking?: () => void;
}

// Helper to determine file category
function getDocFileCategory(doc: TechnicalDocument): 'pdf' | 'image' | 'word' | 'other' {
  if (!doc) return 'other';
  const fn = (doc.fileName || '').toLowerCase();
  const ft = (doc.fileType || '').toLowerCase();
  const fd = (doc.fileData || '').toLowerCase();

  if (fn.endsWith('.pdf') || ft.includes('pdf') || fd.startsWith('data:application/pdf')) {
    return 'pdf';
  }
  if (
    fn.endsWith('.jpg') ||
    fn.endsWith('.jpeg') ||
    fn.endsWith('.png') ||
    ft.startsWith('image/') ||
    fd.startsWith('data:image/')
  ) {
    return 'image';
  }
  if (
    fn.endsWith('.doc') ||
    fn.endsWith('.docx') ||
    ft.includes('word') ||
    ft.includes('officedocument')
  ) {
    return 'word';
  }
  return 'other';
}

// Find master catalog documents for an equipment
export function findMatchingCatalogDocs(
  eqItem: { id?: string; equipmentId?: string; code?: string; name?: string; brand?: string; model?: string },
  allDocs: TechnicalDocument[] = []
): TechnicalDocument[] {
  if (!eqItem || !Array.isArray(allDocs)) return [];
  const normName = normalizeClean(eqItem.name || '');
  const normCode = normalizeClean(eqItem.code || '');
  const targetId = eqItem.equipmentId || eqItem.id;

  return allDocs.filter((d) => {
    if (!d) return false;
    if (targetId && d.equipmentId === targetId) return true;
    if (normCode && d.equipmentCode && normalizeClean(d.equipmentCode) === normCode) return true;
    const docName = normalizeClean(d.equipmentName || '');
    if (docName && normName && (docName === normName || docName.includes(normName) || normName.includes(docName))) {
      return true;
    }
    return false;
  });
}

export const ContractsDocumentationTab: React.FC<ContractsDocumentationTabProps> = ({
  tenderClients = [],
  ocContracts = [],
  equipments = [],
  documents = [],
  isReadOnly,
  onOpenNewDocumentModal,
  onPreviewDoc,
  onDownloadDoc,
  onDeleteDocument,
  onSaveDocument,
  onUpdateContracts,
  mode = 'all',
  searchQuery = '',
  onNavigateToTenders,
  onNavigateToOCTracking,
}) => {
  const [collapsedContracts, setCollapsedContracts] = useState<Record<string, boolean>>({});
  const [contractFilter, setContractFilter] = useState<string>('all');
  const [subFilter, setSubFilter] = useState<'all' | 'tenders' | 'direct_oc'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Serialized dossier modal state
  const [serialsModalTarget, setSerialsModalTarget] = useState<{
    contract: OCTrackingContract;
    item: OCTrackingItem;
  } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const toggleCollapse = (id: string) => {
    setCollapsedContracts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Safe active filter calculations
  const activeTenders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!Array.isArray(tenderClients)) return [];
    return tenderClients.filter((t) => {
      if (!t) return false;
      const clientName = t.clientName || t.header?.entityName || '';
      if (!clientName && !t.id) return false;
      if (contractFilter !== 'all' && t.id !== contractFilter) return false;
      if (!q) return true;
      const matchClient = clientName.toLowerCase().includes(q);
      const matchProc = (t.header?.processNumber || '').toLowerCase().includes(q);
      const itemsList = t.items || (t as any).equipos || [];
      const matchItems = Array.isArray(itemsList) && itemsList.some(
        (it: any) =>
          (it?.name || '').toLowerCase().includes(q) ||
          (it?.brand || '').toLowerCase().includes(q) ||
          (it?.code || '').toLowerCase().includes(q)
      );
      return matchClient || matchProc || matchItems;
    });
  }, [tenderClients, contractFilter, searchQuery]);

  const activeDirectOCs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!Array.isArray(ocContracts)) return [];
    return ocContracts.filter((c) => {
      if (!c) return false;
      const clientName = c.clientName || '';
      if (!clientName && !c.id && !c.ocNumber) return false;
      if (contractFilter !== 'all' && c.id !== contractFilter) return false;
      if (!q) return true;
      const matchClient = clientName.toLowerCase().includes(q);
      const matchOC = (c.ocNumber || '').toLowerCase().includes(q);
      const matchContract = (c.contractNumber || '').toLowerCase().includes(q);
      const matchSupplier = (c.supplier || '').toLowerCase().includes(q);
      const itemsList = c.items || (c as any).equipos || [];
      const matchItems = Array.isArray(itemsList) && itemsList.some(
        (it: any) =>
          (it?.name || '').toLowerCase().includes(q) ||
          (it?.brand || '').toLowerCase().includes(q) ||
          (it?.code || '').toLowerCase().includes(q)
      );
      return matchClient || matchOC || matchContract || matchSupplier || matchItems;
    });
  }, [ocContracts, contractFilter, searchQuery]);

  // Handler to link all matching catalog documents into a contract
  const handleAutoLinkAllCatalogDocs = (items: any[]) => {
    if (!Array.isArray(items)) return;
    let linkedCount = 0;
    items.forEach((it) => {
      if (!it) return;
      const matchingDocs = findMatchingCatalogDocs(it, documents);
      if (matchingDocs.length > 0 && onSaveDocument) {
        matchingDocs.forEach((doc) => {
          if (doc.equipmentId !== it.equipmentId && it.equipmentId) {
            const linkedDoc: TechnicalDocument = {
              ...doc,
              id: `doc-link-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              equipmentId: it.equipmentId,
              equipmentCode: it.code || doc.equipmentCode,
              equipmentName: it.name || doc.equipmentName,
              uploadDate: new Date().toISOString().split('T')[0],
              notes: `Vinculado automáticamente desde la Base de Datos del Catálogo. ${doc.notes || ''}`,
            };
            onSaveDocument(linkedDoc);
            linkedCount++;
          }
        });
      }
    });

    if (linkedCount > 0) {
      showToast(`✓ Se vincularon ${linkedCount} documentos del Catálogo Maestro`);
    } else {
      showToast('✓ La documentación ya está vinculada');
    }
  };

  // Determine what sections to show based on mode and subFilter
  const showTenders =
    (mode === 'all' || mode === 'tenders') &&
    (subFilter === 'all' || subFilter === 'tenders');

  const showDirectOCs =
    (mode === 'all' || mode === 'direct_oc') &&
    (subFilter === 'all' || subFilter === 'direct_oc');

  const totalFilteredCount = (showTenders ? activeTenders.length : 0) + (showDirectOCs ? activeDirectOCs.length : 0);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#192b45] border border-amber-400 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-2xl animate-bounce flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Compact Header Filter Bar */}
      <div className="bg-[#192b45] border border-[#334d6e] rounded-xl px-3.5 py-2.5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {mode === 'all' ? (
            <div className="bg-[#15253d] p-0.5 rounded-lg border border-[#334d6e] flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSubFilter('all')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  subFilter === 'all'
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>Todos ({activeTenders.length + activeDirectOCs.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSubFilter('tenders')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  subFilter === 'tenders'
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-xs'
                    : 'text-cyan-300 hover:text-white'
                }`}
              >
                <Building2 className="w-3 h-3" />
                <span>Licitaciones ({activeTenders.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSubFilter('direct_oc')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  subFilter === 'direct_oc'
                    ? 'bg-purple-500 text-white font-black shadow-xs'
                    : 'text-purple-300 hover:text-white'
                }`}
              >
                <Boxes className="w-3 h-3" />
                <span>OCs Directas ({activeDirectOCs.length})</span>
              </button>
            </div>
          ) : (
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              {mode === 'tenders' ? (
                <>
                  <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Expedientes por Contratos & Licitaciones ({activeTenders.length})</span>
                </>
              ) : (
                <>
                  <Boxes className="w-3.5 h-3.5 text-purple-400" />
                  <span>Expedientes por Órdenes de Compra Directas ({activeDirectOCs.length})</span>
                </>
              )}
            </span>
          )}

          <span className="text-slate-400 text-[11px] hidden lg:inline">
            • Los documentos se heredan de la Base Maestra del Catálogo y se asocian a cada contrato.
          </span>
        </div>

        {/* Contract Filter Selector */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={contractFilter}
            onChange={(e) => setContractFilter(e.target.value)}
            className="bg-[#15253d] border border-[#334d6e] text-[11px] font-bold text-slate-200 rounded-lg px-2.5 py-1 outline-none focus:border-cyan-400 cursor-pointer max-w-[260px] truncate"
          >
            <option value="all">Ver Todos ({(tenderClients?.length || 0) + (ocContracts?.length || 0)})</option>
            {tenderClients && tenderClients.length > 0 && (
              <optgroup label="🏛️ Licitaciones / Contratos">
                {tenderClients.map((t) => (
                  <option key={`opt-t-${t.id}`} value={t.id}>
                    🏛️ {t.header?.processNumber || 'LIC'}: {t.clientName || t.header?.entityName || 'Licitación'}
                  </option>
                ))}
              </optgroup>
            )}
            {ocContracts && ocContracts.length > 0 && (
              <optgroup label="📦 Órdenes de Compra Directas">
                {ocContracts.map((c) => (
                  <option key={`opt-oc-${c.id}`} value={c.id}>
                    📦 {c.ocNumber || 'OC'}: {c.clientName || c.supplier || 'Contrato OC'}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>

      {/* Empty State when no items exist across selected views */}
      {totalFilteredCount === 0 && (
        <div className="bg-[#192b45] border border-[#334d6e] rounded-xl p-8 text-center text-slate-400 space-y-2.5">
          <Building2 className="w-8 h-8 text-slate-500 mx-auto" />
          <h4 className="text-sm font-bold text-white">No hay expedientes ni contratos registrados que coincidan</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {searchQuery
              ? `No se encontraron resultados para "${searchQuery}". Intenta con otro término de búsqueda.`
              : 'Cuando crees licitaciones en el módulo de Licitaciones o contratos en Seguimiento de OCs, sus expedientes técnicos aparecerán automáticamente aquí.'}
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECCIÓN 1: CONTRATOS EN LICITACIÓN (COMPACT DENSE CARDS)                   */}
      {/* ========================================================================= */}
      {showTenders && activeTenders.length > 0 && (
        <div className="space-y-3">
          {mode === 'all' && showDirectOCs && (
            <div className="flex items-center gap-2 pt-1 pb-0.5">
              <Building2 className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-cyan-300">
                Licitaciones & Contratos Públicos ({activeTenders.length})
              </h3>
            </div>
          )}

          {activeTenders.map((tender) => {
            const isCollapsed = Boolean(collapsedContracts[tender.id]);
            const tenderItems = tender?.items || (tender as any)?.equipos || [];
            const processNum = tender?.header?.processNumber || `LIC-${String(tender?.id || '').slice(-4)}`;

            // Find matching OC contract for serials & dispatch dossier integration
            const linkedOCContract = (ocContracts || []).find(
              (c) =>
                c &&
                (c.tenderClientId === tender.id ||
                  c.id === tender.id ||
                  (c.contractNumber && processNum && c.contractNumber.includes(processNum)))
            );

            // Calculate documentation completion status for each equipment
            let pendingEquipments = 0;
            let totalCatalogDocsAvailable = 0;

            const equipmentRows = (tenderItems || []).map((item: any, itIdx: number) => {
              if (!item) {
                return {
                  item: { name: 'Equipo biomédico', quantity: 1 },
                  matchedEq: null,
                  attachedDocs: [],
                  missingTypes: [],
                  isPending: false,
                  eqIdForDoc: `tender-item-${tender.id}-${itIdx}`,
                  matchedOCItem: null,
                };
              }

              const itemName = item?.name || item?.equipmentName || item?.nombre || 'Equipo biomédico';
              const itemCode = item?.code || item?.codigo || '';
              const itemBrand = item?.brand || item?.marca || '';
              const itemModel = item?.model || item?.modelo || '';
              const eqId = item?.equipmentId || item?.id;

              const matchedEq = (equipments || []).find(
                (e) =>
                  e &&
                  ((eqId && e.id === eqId) ||
                    (itemCode && e.code && e.code.trim().toLowerCase() === itemCode.trim().toLowerCase()) ||
                    (itemName && e.name && e.name.trim().toLowerCase() === itemName.trim().toLowerCase()))
              );

              const attachedDocs = findMatchingCatalogDocs(
                {
                  id: eqId || matchedEq?.id,
                  equipmentId: eqId || matchedEq?.id,
                  code: itemCode || matchedEq?.code,
                  name: itemName,
                  brand: itemBrand || matchedEq?.brand,
                  model: itemModel || matchedEq?.model,
                },
                documents || []
              );

              const hasFichaTecnica = attachedDocs.some((d) => d?.docType?.toLowerCase().includes('ficha'));
              const hasInvima = attachedDocs.some(
                (d) => d?.docType?.toLowerCase().includes('invima') || d?.docType?.toLowerCase().includes('sanitario')
              );

              const missingTypes: string[] = [];
              if (!hasFichaTecnica) missingTypes.push('Ficha Técnica');
              if (!hasInvima) missingTypes.push('Reg. INVIMA');

              const isPending = missingTypes.length > 0;
              if (isPending) pendingEquipments++;
              totalCatalogDocsAvailable += attachedDocs.length;

              // Matched OC item for serials
              const matchedOCItem = (linkedOCContract?.items || []).find(
                (oi: any) =>
                  oi &&
                  ((oi.equipmentId && eqId && oi.equipmentId === eqId) ||
                    (oi.code && itemCode && oi.code.trim().toLowerCase() === itemCode.trim().toLowerCase()) ||
                    (oi.name && itemName && oi.name.trim().toLowerCase() === itemName.trim().toLowerCase()))
              );

              return {
                item: {
                  ...item,
                  name: itemName,
                  code: itemCode,
                  brand: itemBrand,
                  model: itemModel,
                  quantity: item?.quantity || item?.cantidad || 1,
                },
                matchedEq,
                attachedDocs,
                missingTypes,
                isPending,
                eqIdForDoc: eqId || matchedEq?.id || `tender-item-${tender.id}-${itIdx}`,
                matchedOCItem,
              };
            });

            return (
              <div
                key={`tender-box-${tender.id}`}
                className={`bg-[#192b45] border rounded-xl shadow-md transition overflow-hidden ${
                  pendingEquipments > 0
                    ? 'border-amber-500/40 hover:border-amber-400'
                    : 'border-[#334d6e] hover:border-cyan-500/50'
                }`}
              >
                {/* Compact Contract Box Header */}
                <div className="px-3.5 py-2.5 bg-[#15253d] border-b border-[#334d6e] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[11px] font-black font-mono">
                        {processNum}
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded text-[10.5px] font-bold border ${
                          tender.status === 'Adjudicada'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        }`}
                      >
                        {tender.status || 'En Preparación'}
                      </span>

                      {/* Compact Yellow Pending Alert Badge */}
                      {pendingEquipments > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10.5px] font-black flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          <span>⚠️ {pendingEquipments} equipo{pendingEquipments > 1 ? 's' : ''} pendiente{pendingEquipments > 1 ? 's' : ''}</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10.5px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Completo</span>
                        </span>
                      )}

                      <span className="text-[11px] text-slate-400">
                        • {tenderItems.length} equipos
                      </span>
                    </div>

                    <h3 className="text-xs sm:text-sm font-black text-white truncate">
                      {tender.clientName || tender.header?.entityName || 'Cliente sin nombre'}
                    </h3>

                    <div className="flex items-center gap-2 text-[10.5px] text-slate-400 flex-wrap">
                      <span>NIT: <strong className="text-slate-300 font-mono">{tender.nit || tender.header?.nit || 'N/A'}</strong></span>
                      <span>•</span>
                      <span>Ciudad: <strong className="text-slate-300">{tender.header?.city || 'Colombia'}</strong></span>
                      <span>•</span>
                      <span>Presupuesto: <strong className="text-cyan-300 font-bold">{formatExactCOP(tender.header?.budgetCOP || 0)}</strong></span>
                    </div>
                  </div>

                  {/* Compact Header Actions */}
                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    {!isReadOnly && totalCatalogDocsAvailable > 0 && (
                      <button
                        type="button"
                        onClick={() => handleAutoLinkAllCatalogDocs(tenderItems)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10.5px] transition shadow-xs flex items-center gap-1 cursor-pointer active:scale-95"
                        title="Vincular automáticamente fichas técnicas e INVIMA desde la base maestra del catálogo"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Vincular Catálogo ({totalCatalogDocsAvailable})</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleCollapse(tender.id)}
                      className="px-2 py-1 rounded-lg bg-[#192b45] hover:bg-[#20375a] border border-[#334d6e] text-slate-300 hover:text-white text-[10.5px] font-bold transition cursor-pointer flex items-center gap-1"
                    >
                      {isCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <span>{isCollapsed ? 'Ver Equipos' : 'Ocultar'}</span>
                    </button>
                  </div>
                </div>

                {/* Compact Equipment Rows */}
                {!isCollapsed && (
                  <div className="p-2.5 sm:p-3 space-y-2">
                    {tenderItems.length === 0 ? (
                      <div className="text-center py-3 text-slate-400 text-[11px]">
                        Sin equipos registrados en este proceso.
                      </div>
                    ) : (
                      equipmentRows.map(({ item, matchedEq, attachedDocs, missingTypes, isPending, eqIdForDoc, matchedOCItem }, idx) => {
                        const itemCode = item.code || matchedEq?.code || `EQ-${idx + 1}`;
                        const itemBrand = item.brand || matchedEq?.brand || 'SYD';
                        const itemModel = item.model || matchedEq?.model || 'General';

                        return (
                          <div
                            key={`t-item-compact-${item.id || idx}`}
                            className={`rounded-lg p-2.5 transition space-y-1.5 ${
                              isPending
                                ? 'bg-amber-950/15 border border-amber-500/30'
                                : 'bg-[#15253d]/60 border border-[#334d6e]/60'
                            }`}
                          >
                            {/* Line 1: Code, Brand, Model, Qty + Alert Badge + Quick Actions */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <span className="font-mono text-[10.5px] font-bold text-cyan-300 bg-[#192b45] px-1.5 py-0.2 rounded border border-[#334d6e]">
                                  {itemCode}
                                </span>
                                <span className="text-[10px] font-black text-blue-300 bg-blue-500/20 px-1.5 py-0.2 rounded border border-blue-500/30">
                                  {itemBrand}
                                </span>
                                <span className="text-[10.5px] text-slate-400 truncate">
                                  Mod: <strong className="text-slate-200">{itemModel}</strong> (Cant: {item.quantity || 1})
                                </span>

                                {/* Compact Yellow Pending Badge ONLY for Tenders */}
                                {isPending && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/25 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1">
                                    <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                                    <span>⚠️ Falta {missingTypes.join(' y ')}</span>
                                  </span>
                                )}
                              </div>

                              {/* Compact Action Buttons */}
                              {!isReadOnly && (
                                <div className="flex items-center gap-1 flex-wrap shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => onOpenNewDocumentModal(eqIdForDoc, 'Ficha Técnica')}
                                    className="px-2 py-0.5 rounded bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-[10px] font-bold transition cursor-pointer"
                                    title="Adjuntar Ficha Técnica"
                                  >
                                    + Ficha Técnica
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onOpenNewDocumentModal(eqIdForDoc, 'Registro INVIMA')}
                                    className="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold transition cursor-pointer"
                                    title="Adjuntar Registro INVIMA"
                                  >
                                    + Reg. INVIMA
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onOpenNewDocumentModal(eqIdForDoc, 'Manual de Usuario')}
                                    className="px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] font-bold transition cursor-pointer"
                                    title="Adjuntar Manual de Usuario"
                                  >
                                    + Manual
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onOpenNewDocumentModal(eqIdForDoc, 'Guía Rápida')}
                                    className="px-2 py-0.5 rounded bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-300 border border-yellow-500/30 text-[10px] font-bold transition cursor-pointer"
                                    title="Adjuntar Guía Rápida"
                                  >
                                    + Guía Rápida
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onOpenNewDocumentModal(eqIdForDoc, 'Protocolo de Limpieza')}
                                    className="px-2 py-0.5 rounded bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-[10px] font-bold transition cursor-pointer"
                                    title="Adjuntar Protocolo de Limpieza y Desinfección"
                                  >
                                    + Prot. Limpieza
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onOpenNewDocumentModal(eqIdForDoc, 'Otro Documento')}
                                    className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-400/50 text-[10px] font-black transition cursor-pointer flex items-center gap-1 shadow-xs"
                                    title="Subir otro documento con clasificación manual personalizada (siempre disponible para subir más)"
                                  >
                                    <Plus className="w-3 h-3 text-purple-300" />
                                    <span>+ Otro Documento</span>
                                  </button>

                                  {/* Integrated Serials & Hoja de Vida Button */}
                                  {linkedOCContract && matchedOCItem && (
                                    <button
                                      type="button"
                                      onClick={() => setSerialsModalTarget({ contract: linkedOCContract, item: matchedOCItem })}
                                      className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                                      title="Gestionar seriales, placas y hoja de vida del equipo"
                                    >
                                      <Tag className="w-2.5 h-2.5 text-purple-300" />
                                      <span>🏷️ Seriales & Hoja de Vida</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Line 2: Equipment Name */}
                            <h4 className="text-xs font-bold text-white leading-tight">
                              {item.name}
                            </h4>

                            {/* Line 3: Compact Attached Documents Chips */}
                            {attachedDocs.length > 0 ? (
                              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                {attachedDocs.map((doc, dIdx) => {
                                  const isInherited = doc.equipmentId !== eqIdForDoc;

                                  return (
                                    <div
                                      key={`t-doc-${doc.id || dIdx}`}
                                      className="inline-flex items-center gap-1.5 bg-[#111c2e] border border-[#334d6e] hover:border-cyan-400/50 rounded-md px-2 py-1 text-[10.5px] transition group shadow-2xs"
                                    >
                                      <span className="font-bold text-cyan-300 truncate max-w-[150px]" title={doc.title}>
                                        {doc.docType}: {doc.title}
                                      </span>
                                      {isInherited && (
                                        <span className="text-[9px] text-indigo-300 bg-indigo-950/60 px-1 py-0.2 rounded font-medium">
                                          Catálogo
                                        </span>
                                      )}
                                      <div className="flex items-center gap-1 pl-1 border-l border-[#334d6e]">
                                        <button
                                          type="button"
                                          onClick={() => onPreviewDoc(doc)}
                                          className="text-slate-300 hover:text-white transition cursor-pointer"
                                          title="Ver documento"
                                        >
                                          <Eye className="w-3 h-3 text-cyan-400" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => onDownloadDoc(doc)}
                                          className="text-slate-300 hover:text-emerald-300 transition cursor-pointer"
                                          title="Descargar"
                                        >
                                          <Download className="w-3 h-3 text-emerald-400" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-[10.5px] text-slate-400 italic">
                                Sin documentos adjuntos todavía.
                              </div>
                            )}

                            {/* Line 4: Integrated Serials, Despachos & Hojas de Vida summary */}
                            {linkedOCContract && matchedOCItem && (
                              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[#334d6e]/40 text-[10.5px]">
                                <span className="text-purple-300 font-semibold flex items-center gap-1">
                                  <Tag className="w-3 h-3 text-purple-400" />
                                  <span>Seriales & Despacho:</span>
                                </span>
                                {matchedOCItem.serialNumbers && matchedOCItem.serialNumbers.length > 0 ? (
                                  matchedOCItem.serialNumbers.map((s: any, sIdx: number) => (
                                    <span
                                      key={`sn-${s.id || sIdx}`}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-purple-950/60 text-purple-200 border border-purple-500/30 font-mono text-[10px]"
                                    >
                                      <strong>{s.serialNumber || `SN-${sIdx + 1}`}</strong>
                                      <span className="text-[9px] text-slate-400">({s.status || 'En Bodega'})</span>
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-slate-400 italic text-[10px]">
                                    (0/{item.quantity || 1} seriales asignados)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECCIÓN 2: OCS DIRECTAS (COMPACT DENSE CARDS)                             */}
      {/* ========================================================================= */}
      {showDirectOCs && activeDirectOCs.length > 0 && (
        <div className="space-y-3">
          {mode === 'all' && showTenders && (
            <div className="flex items-center gap-2 pt-2 pb-0.5">
              <Boxes className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-purple-300">
                Órdenes de Compra Directas ({activeDirectOCs.length})
              </h3>
            </div>
          )}

          {activeDirectOCs.map((contract) => {
            const isCollapsed = Boolean(collapsedContracts[contract.id]);
            const contractItems = contract?.items || (contract as any)?.equipos || [];

            return (
              <div
                key={`oc-box-${contract.id}`}
                className="bg-[#192b45] border border-[#334d6e] hover:border-purple-500/50 rounded-xl shadow-md transition overflow-hidden"
              >
                {/* Compact OC Header */}
                <div className="px-3.5 py-2.5 bg-[#15253d] border-b border-[#334d6e] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[11px] font-black font-mono">
                        {contract.ocNumber || 'OC Directa'}
                      </span>
                      {contract.supplier && (
                        <span className="px-2 py-0.5 rounded bg-[#192b45] text-slate-200 border border-[#334d6e] text-[10.5px] font-bold">
                          Prov: {contract.supplier}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10.5px] font-bold">
                        {contract.globalStatus || 'Emitida'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        • {contractItems.length} equipos
                      </span>
                    </div>

                    <h3 className="text-xs sm:text-sm font-black text-white truncate">
                      {contract.clientName || contract.supplier || 'Contrato de Compra'}
                    </h3>

                    <div className="flex items-center gap-2 text-[10.5px] text-slate-400 flex-wrap">
                      <span>Ref: <strong className="text-slate-300 font-mono">{contract.contractNumber || 'N/A'}</strong></span>
                      <span>•</span>
                      <span>Costo: <strong className="text-purple-300 font-bold">{formatExactCOP(contract.totalCostCOP || 0)}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleCollapse(contract.id)}
                      className="px-2 py-1 rounded-lg bg-[#192b45] hover:bg-[#20375a] border border-[#334d6e] text-slate-300 hover:text-white text-[10.5px] font-bold transition cursor-pointer flex items-center gap-1"
                    >
                      {isCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <span>{isCollapsed ? 'Ver Equipos' : 'Ocultar'}</span>
                    </button>
                  </div>
                </div>

                {/* Compact Items */}
                {!isCollapsed && (
                  <div className="p-2.5 sm:p-3 space-y-2">
                    {contractItems.length === 0 ? (
                      <div className="text-center py-3 text-slate-400 text-[11px]">
                        Sin equipos registrados.
                      </div>
                    ) : (
                      contractItems.map((item: any, idx: number) => {
                        const itemName = item?.name || item?.equipmentName || item?.nombre || 'Equipo biomédico';
                        const itemCode = item?.code || item?.codigo || '';
                        const itemBrand = item?.brand || item?.marca || 'SYD';
                        const itemModel = item?.model || item?.modelo || 'General';
                        const itemQty = item?.quantity || item?.cantidad || 1;
                        const eqId = item?.equipmentId || item?.id;

                        const matchedEq = (equipments || []).find(
                          (e) =>
                            e &&
                            ((eqId && e.id === eqId) ||
                              (itemCode && e.code && e.code.trim().toLowerCase() === itemCode.trim().toLowerCase()) ||
                              (itemName && e.name && e.name.trim().toLowerCase() === itemName.trim().toLowerCase()))
                        );

                        const attachedDocs = findMatchingCatalogDocs(
                          {
                            id: eqId || matchedEq?.id,
                            equipmentId: eqId || matchedEq?.id,
                            code: itemCode || matchedEq?.code,
                            name: itemName,
                            brand: itemBrand || matchedEq?.brand,
                            model: itemModel || matchedEq?.model,
                          },
                          documents || []
                        );

                        const eqIdForDoc = eqId || matchedEq?.id || `oc-item-${contract.id}-${idx}`;

                        return (
                          <div key={`oc-item-compact-${item.id || idx}`} className="rounded-lg p-2.5 bg-[#15253d]/60 border border-[#334d6e]/60 space-y-1.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <span className="font-mono text-[10.5px] font-bold text-purple-300 bg-[#192b45] px-1.5 py-0.2 rounded border border-[#334d6e]">
                                  {itemCode || `EQ-${idx + 1}`}
                                </span>
                                <span className="text-[10px] font-black text-blue-300 bg-blue-500/20 px-1.5 py-0.2 rounded border border-blue-500/30">
                                  {itemBrand}
                                </span>
                                <span className="text-[10.5px] text-slate-400 truncate">
                                  Mod: <strong className="text-slate-200">{itemModel}</strong> (Cant: {itemQty})
                                </span>
                              </div>

                              {!isReadOnly && (
                                <div className="flex items-center gap-1 flex-wrap shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => onOpenNewDocumentModal(eqIdForDoc, 'Ficha Técnica')}
                                    className="px-2 py-0.5 rounded bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-[10px] font-bold transition cursor-pointer"
                                    title="Adjuntar Ficha Técnica"
                                  >
                                    + Ficha Técnica
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onOpenNewDocumentModal(eqIdForDoc, 'Registro INVIMA')}
                                    className="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold transition cursor-pointer"
                                    title="Adjuntar Registro INVIMA"
                                  >
                                    + Reg. INVIMA
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onOpenNewDocumentModal(eqIdForDoc, 'Manual de Usuario')}
                                    className="px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] font-bold transition cursor-pointer"
                                    title="Adjuntar Manual de Usuario"
                                  >
                                    + Manual
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onOpenNewDocumentModal(eqIdForDoc, 'Guía Rápida')}
                                    className="px-2 py-0.5 rounded bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-300 border border-yellow-500/30 text-[10px] font-bold transition cursor-pointer"
                                    title="Adjuntar Guía Rápida"
                                  >
                                    + Guía Rápida
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onOpenNewDocumentModal(eqIdForDoc, 'Protocolo de Limpieza')}
                                    className="px-2 py-0.5 rounded bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-[10px] font-bold transition cursor-pointer"
                                    title="Adjuntar Protocolo de Limpieza y Desinfección"
                                  >
                                    + Prot. Limpieza
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onOpenNewDocumentModal(eqIdForDoc, 'Otro Documento')}
                                    className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-400/50 text-[10px] font-black transition cursor-pointer flex items-center gap-1 shadow-xs"
                                    title="Subir otro documento con clasificación manual personalizada (siempre disponible para subir más)"
                                  >
                                    <Plus className="w-3 h-3 text-purple-300" />
                                    <span>+ Otro Documento</span>
                                  </button>

                                  {/* Integrated Serials & Hoja de Vida Button */}
                                  <button
                                    type="button"
                                    onClick={() => setSerialsModalTarget({ contract, item })}
                                    className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                                    title="Gestionar seriales, placas y hoja de vida del equipo"
                                  >
                                    <Tag className="w-2.5 h-2.5 text-purple-300" />
                                    <span>🏷️ Seriales & Hoja de Vida</span>
                                  </button>
                                </div>
                              )}
                            </div>

                            <h4 className="text-xs font-bold text-white leading-tight">
                              {itemName}
                            </h4>

                            {attachedDocs.length > 0 ? (
                              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                {attachedDocs.map((doc, dIdx) => (
                                  <div
                                    key={`oc-doc-${doc.id || dIdx}`}
                                    className="inline-flex items-center gap-1.5 bg-[#111c2e] border border-[#334d6e] hover:border-purple-400/50 rounded-md px-2 py-1 text-[10.5px] transition group shadow-2xs"
                                  >
                                    <span className="font-bold text-purple-300 truncate max-w-[150px]" title={doc.title}>
                                      {doc.docType}: {doc.title}
                                    </span>
                                    <div className="flex items-center gap-1 pl-1 border-l border-[#334d6e]">
                                      <button
                                        type="button"
                                        onClick={() => onPreviewDoc(doc)}
                                        className="text-slate-300 hover:text-white transition cursor-pointer"
                                        title="Ver"
                                      >
                                        <Eye className="w-3 h-3 text-purple-400" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onDownloadDoc(doc)}
                                        className="text-slate-300 hover:text-emerald-300 transition cursor-pointer"
                                        title="Descargar"
                                      >
                                        <Download className="w-3 h-3 text-emerald-400" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[10.5px] text-slate-400 italic">
                                Sin documentos adjuntos todavía.
                              </div>
                            )}

                            {/* Line 4: Integrated Serials, Despachos & Hojas de Vida summary */}
                            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[#334d6e]/40 text-[10.5px]">
                              <span className="text-purple-300 font-semibold flex items-center gap-1">
                                <Tag className="w-3 h-3 text-purple-400" />
                                <span>Seriales & Despacho:</span>
                              </span>
                              {item.serialNumbers && item.serialNumbers.length > 0 ? (
                                item.serialNumbers.map((s: any, sIdx: number) => (
                                  <span
                                    key={`sn-oc-${s.id || sIdx}`}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-purple-950/60 text-purple-200 border border-purple-500/30 font-mono text-[10px]"
                                  >
                                    <strong>{s.serialNumber || `SN-${sIdx + 1}`}</strong>
                                    <span className="text-[9px] text-slate-400">({s.status || 'En Bodega'})</span>
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 italic text-[10px]">
                                  (0/{itemQty} seriales asignados)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: ITEM SERIALS, DOSSIER & HOJA DE VIDA */}
      {serialsModalTarget && (
        <ItemSerialsDossierModal
          isOpen={Boolean(serialsModalTarget)}
          onClose={() => setSerialsModalTarget(null)}
          contract={serialsModalTarget.contract}
          item={serialsModalTarget.item}
          equipments={equipments}
          allDocuments={documents}
          onSaveSerials={(contractId, itemId, newSerials) => {
            if (onUpdateContracts) {
              const updated = ocContracts.map((c) => {
                if (c.id !== contractId) return c;
                return {
                  ...c,
                  items: c.items.map((it) => {
                    if (it.id !== itemId) return it;
                    return {
                      ...it,
                      serialNumbers: newSerials,
                    };
                  }),
                  lastUpdatedAt: new Date().toISOString(),
                };
              });
              onUpdateContracts(updated);
            }
            setSerialsModalTarget(null);
            showToast('✓ Seriales, despachos y hojas de vida actualizados');
          }}
          onOpenNewGeneralDocument={(eqId, eqName) => {
            onOpenNewDocumentModal(eqId, 'Ficha Técnica');
          }}
        />
      )}
    </div>
  );
};
