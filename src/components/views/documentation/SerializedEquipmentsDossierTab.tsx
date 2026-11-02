import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Tag,
  Search,
  Filter,
  FileText,
  ShieldCheck,
  Award,
  BookOpen,
  Wrench,
  Download,
  Printer,
  Eye,
  ExternalLink,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Boxes,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  FileCheck,
  X,
  Maximize2,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import {
  OCTrackingContract,
  OCTrackingItem,
  ItemSerialNumberRecord,
  TechnicalDocument,
  MedicalEquipment,
  AuthUser,
} from '../../../types';
import {
  findMatchingGeneralDocuments,
  generateHojaDeVidaHtml,
  generateActaEntregaHtml,
  generateConsolidatedDossierHtml,
} from '../../../utils/dossierGenerator';
import { ItemSerialsDossierModal } from '../oc-tracking/ItemSerialsDossierModal';
import {
  ExcelColumnConfig,
  ExcelColumnHeader,
  useExcelTableFilters,
} from '../../common/ExcelTableFilter';

export interface SerializedEquipmentsDossierTabProps {
  contracts: OCTrackingContract[];
  onUpdateContracts: (contracts: OCTrackingContract[]) => void;
  documents: TechnicalDocument[];
  equipments: MedicalEquipment[];
  currentUser?: AuthUser | null;
  onNavigateToOCTracking?: () => void;
}

export interface SerializedUnitItem {
  id: string; // unique key
  contractId: string;
  contractNumber: string;
  clientName: string;
  city: string;
  nit: string;
  item: OCTrackingItem;
  serialRecord: ItemSerialNumberRecord;
  unitIndex: number;
  equipmentMaster?: MedicalEquipment;
  matchedGeneralDocs: TechnicalDocument[];
}

const SERIALIZED_UNIT_COLUMNS: ExcelColumnConfig<SerializedUnitItem>[] = [
  {
    id: 'serialPlaca',
    label: 'Serial (S/N) & Placa',
    accessor: (u) => {
      const parts = [
        u.serialRecord.serialNumber ? `S/N: ${u.serialRecord.serialNumber}` : 'Sin Serial Asignado',
        u.serialRecord.inventoryPlate ? `Placa: ${u.serialRecord.inventoryPlate}` : '',
      ].filter(Boolean);
      return parts.join(' • ');
    },
    minWidth: '170px',
  },
  {
    id: 'equipment',
    label: 'Equipo & Modelo',
    accessor: (u) => [u.item.name, u.item.brand, u.item.model].filter(Boolean).join(' • '),
    minWidth: '180px',
  },
  {
    id: 'clientContract',
    label: 'Cliente / Contrato',
    accessor: (u) => [u.clientName, u.contractNumber, u.city].filter(Boolean).join(' - '),
    minWidth: '180px',
  },
  {
    id: 'dian',
    label: '🛃 Registro DIAN',
    accessor: (u) =>
      u.serialRecord.dianImportDeclaration?.trim()
        ? `DIAN: ${u.serialRecord.dianImportDeclaration}`
        : 'Sin Registro DIAN',
    minWidth: '170px',
  },
  {
    id: 'generalDocs',
    label: '📁 Docs Modelo (V6)',
    accessor: (u) =>
      u.matchedGeneralDocs.length > 0
        ? `${u.matchedGeneralDocs.length} archivo(s) modelo`
        : 'Sin Docs Modelo',
    minWidth: '140px',
  },
  {
    id: 'individualDocs',
    label: '📄 Docs Individuales',
    accessor: (u) =>
      (u.serialRecord.documents?.length || 0) > 0
        ? `${u.serialRecord.documents?.length} archivo(s) unidad`
        : 'Sin Archivos',
    minWidth: '140px',
  },
];

export const SerializedEquipmentsDossierTab: React.FC<SerializedEquipmentsDossierTabProps> = ({
  contracts,
  onUpdateContracts,
  documents,
  equipments,
  currentUser,
  onNavigateToOCTracking,
}) => {
  const isReadOnly = currentUser?.role === 'viewer' && !currentUser?.permissions?.canEditDocuments;

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState('ALL');
  const [filterDianStatus, setFilterDianStatus] = useState<'ALL' | 'WITH_DIAN' | 'WITHOUT_DIAN'>('ALL');
  const [filterDocStatus, setFilterDocStatus] = useState<'ALL' | 'COMPLETE' | 'PENDING'>('ALL');
  const [filterDeliveryStatus, setFilterDeliveryStatus] = useState('ALL');

  // Modals
  const [activeSerialsModal, setActiveSerialsModal] = useState<{
    contract: OCTrackingContract;
    item: OCTrackingItem;
  } | null>(null);

  const [dossierPreview, setDossierPreview] = useState<{
    title: string;
    type: 'dossier' | 'hoja_de_vida' | 'acta';
    htmlContent: string;
    serialNumber: string;
    itemName: string;
  } | null>(null);

  // Flatten all serialized units across all contracts and items
  const allSerializedUnits = useMemo((): SerializedUnitItem[] => {
    const list: SerializedUnitItem[] = [];

    contracts.forEach((contract) => {
      contract.items.forEach((item) => {
        const matchingDocs = findMatchingGeneralDocuments(item, documents, equipments);
        const masterEq = equipments.find(
          (e) =>
            (item.equipmentId && e.id === item.equipmentId) ||
            (e.code && item.code && e.code.toLowerCase() === item.code.toLowerCase()) ||
            (e.model && item.model && e.model.toLowerCase() === item.model.toLowerCase())
        );

        // If the item has serialNumbers array defined
        if (item.serialNumbers && item.serialNumbers.length > 0) {
          item.serialNumbers.forEach((sr, idx) => {
            list.push({
              id: `${contract.id}-${item.id}-${sr.id || idx}`,
              contractId: contract.id,
              contractNumber: contract.contractNumber,
              clientName: contract.clientName,
              city: contract.city,
              nit: contract.nit,
              item,
              serialRecord: sr,
              unitIndex: idx + 1,
              equipmentMaster: masterEq,
              matchedGeneralDocs: matchingDocs,
            });
          });
        } else {
          // If no serial records yet, create placeholder unit rows based on item quantity
          const qty = Math.max(1, item.quantity || 1);
          for (let i = 1; i <= qty; i++) {
            list.push({
              id: `${contract.id}-${item.id}-unit-${i}`,
              contractId: contract.id,
              contractNumber: contract.contractNumber,
              clientName: contract.clientName,
              city: contract.city,
              nit: contract.nit,
              item,
              serialRecord: {
                id: `ser-placeholder-${i}`,
                serialNumber: '',
                status: 'En Bodega',
                locationInHospital: '',
                technicianName: '',
                dianImportDeclaration: '',
                documents: [],
              },
              unitIndex: i,
              equipmentMaster: masterEq,
              matchedGeneralDocs: matchingDocs,
            });
          }
        }
      });
    });

    return list;
  }, [contracts, documents, equipments]);

  // Clients list for filter dropdown
  const uniqueClients = useMemo(() => {
    const set = new Set<string>();
    contracts.forEach((c) => {
      if (c.clientName) set.add(c.clientName);
    });
    return Array.from(set).sort();
  }, [contracts]);

  // Base Filtered serialized units (by top controls)
  const baseUnits = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return allSerializedUnits.filter((u) => {
      // Text search
      const matchesText =
        !term ||
        u.serialRecord.serialNumber.toLowerCase().includes(term) ||
        (u.serialRecord.inventoryPlate && u.serialRecord.inventoryPlate.toLowerCase().includes(term)) ||
        (u.serialRecord.dianImportDeclaration &&
          u.serialRecord.dianImportDeclaration.toLowerCase().includes(term)) ||
        u.item.name.toLowerCase().includes(term) ||
        u.item.brand.toLowerCase().includes(term) ||
        u.item.model.toLowerCase().includes(term) ||
        u.contractNumber.toLowerCase().includes(term) ||
        u.clientName.toLowerCase().includes(term) ||
        u.city.toLowerCase().includes(term) ||
        (u.serialRecord.locationInHospital &&
          u.serialRecord.locationInHospital.toLowerCase().includes(term));

      // Client filter
      const matchesClient = selectedClient === 'ALL' || u.clientName === selectedClient;

      // DIAN filter
      const hasDian = Boolean(
        u.serialRecord.dianImportDeclaration &&
          u.serialRecord.dianImportDeclaration.trim().length > 0
      );
      const matchesDian =
        filterDianStatus === 'ALL' ||
        (filterDianStatus === 'WITH_DIAN' && hasDian) ||
        (filterDianStatus === 'WITHOUT_DIAN' && !hasDian);

      // Doc completeness filter
      const hasSerial = Boolean(u.serialRecord.serialNumber && u.serialRecord.serialNumber.trim());
      const isComplete = hasSerial && hasDian && u.matchedGeneralDocs.length > 0;

      const matchesDoc =
        filterDocStatus === 'ALL' ||
        (filterDocStatus === 'COMPLETE' && isComplete) ||
        (filterDocStatus === 'PENDING' && !isComplete);

      // Delivery status filter
      const matchesDelivery =
        filterDeliveryStatus === 'ALL' || u.item.status === filterDeliveryStatus;

      return matchesText && matchesClient && matchesDian && matchesDoc && matchesDelivery;
    });
  }, [
    allSerializedUnits,
    searchTerm,
    selectedClient,
    filterDianStatus,
    filterDocStatus,
    filterDeliveryStatus,
  ]);

  const {
    filteredRows: filteredUnits,
    filters: excelFilters,
    sort: excelSort,
    onApplyFilter,
    onApplySort,
    onClearColumnFilter,
    onResetAllFilters,
    isFilteredOrSorted,
  } = useExcelTableFilters(baseUnits, SERIALIZED_UNIT_COLUMNS);

  // Metrics KPI calculations
  const kpis = useMemo(() => {
    const totalUnits = allSerializedUnits.length;
    const withSerialAssigned = allSerializedUnits.filter(
      (u) => u.serialRecord.serialNumber && u.serialRecord.serialNumber.trim().length > 0
    ).length;
    const withDianAssigned = allSerializedUnits.filter(
      (u) =>
        u.serialRecord.dianImportDeclaration &&
        u.serialRecord.dianImportDeclaration.trim().length > 0
    ).length;
    const withFullDossier = allSerializedUnits.filter(
      (u) =>
        u.serialRecord.serialNumber &&
        u.serialRecord.dianImportDeclaration &&
        u.matchedGeneralDocs.length > 0
    ).length;

    return {
      totalUnits,
      withSerialAssigned,
      withDianAssigned,
      withFullDossier,
    };
  }, [allSerializedUnits]);

  // Open Preview Modal
  const handleOpenPreview = (
    unit: SerializedUnitItem,
    type: 'dossier' | 'hoja_de_vida' | 'acta'
  ) => {
    const contract: OCTrackingContract =
      contracts.find((c) => c.id === unit.contractId) || {
        id: unit.contractId,
        sourceType: 'licitacion_adjudicada',
        contractNumber: unit.contractNumber,
        clientName: unit.clientName,
        nit: unit.nit,
        city: unit.city,
        totalCostCOP: 0,
        globalStatus: 'Listo para Despacho',
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        items: [unit.item],
      };
    const data = {
      contract,
      item: unit.item,
      serialRecord: unit.serialRecord,
      equipmentMaster: unit.equipmentMaster,
      generalDocs: unit.matchedGeneralDocs,
    };

    let html = '';
    let title = '';

    if (type === 'dossier') {
      html = generateConsolidatedDossierHtml(data);
      title = `Dossier Hospitalario Unificado - S/N ${unit.serialRecord.serialNumber || 'Sin Serial'}`;
    } else if (type === 'hoja_de_vida') {
      html = generateHojaDeVidaHtml(data);
      title = `Hoja de Vida Biomédica (Res. 3100) - S/N ${unit.serialRecord.serialNumber || 'Sin Serial'}`;
    } else if (type === 'acta') {
      html = generateActaEntregaHtml(data);
      title = `Acta Técnica de Entrega e Instalación - S/N ${unit.serialRecord.serialNumber || 'Sin Serial'}`;
    }

    setDossierPreview({
      title,
      type,
      htmlContent: html,
      serialNumber: unit.serialRecord.serialNumber || 'Sin Serial',
      itemName: unit.item.name,
    });
  };

  // Open Serials Modal to edit
  const handleOpenEditSerialModal = (unit: SerializedUnitItem) => {
    const contract = contracts.find((c) => c.id === unit.contractId);
    if (contract) {
      setActiveSerialsModal({
        contract,
        item: unit.item,
      });
    }
  };

  // Save changes from Serials Modal
  const handleSaveSerialsFromModal = (
    contractId: string,
    itemId: string,
    updatedSerials: ItemSerialNumberRecord[]
  ) => {
    const nextContracts = contracts.map((c) => {
      if (c.id !== contractId) return c;
      return {
        ...c,
        items: c.items.map((it) => {
          if (it.id !== itemId) return it;
          return {
            ...it,
            serialNumbers: updatedSerials,
            lastUpdatedAt: new Date().toISOString(),
          };
        }),
      };
    });

    onUpdateContracts(nextContracts);
  };

  // Export Matrix to CSV
  const handleExportCSV = () => {
    const headers = [
      'Contrato N°',
      'Cliente / IPS',
      'Ciudad',
      'NIT',
      'Equipo',
      'Marca',
      'Modelo',
      'Parte',
      'Unidad N°',
      'Serial (S/N)',
      'Placa Inventario',
      'Declaración Importación DIAN',
      'Fecha DIAN',
      'Ubicación Hospitalaria',
      'Técnico Responsable',
      'Estado Entrega',
      'Docs Generales Vinculados (Ventana 6)',
      'Docs Individuales Adjuntos',
    ];

    const rows = filteredUnits.map((u) => [
      `"${u.contractNumber || ''}"`,
      `"${u.clientName || ''}"`,
      `"${u.city || ''}"`,
      `"${u.nit || ''}"`,
      `"${u.item.name || ''}"`,
      `"${u.item.brand || ''}"`,
      `"${u.item.model || ''}"`,
      `"${u.item.code || ''}"`,
      u.unitIndex,
      `"${u.serialRecord.serialNumber || 'SIN ASIGNAR'}"`,
      `"${u.serialRecord.inventoryPlate || ''}"`,
      `"${u.serialRecord.dianImportDeclaration || 'SIN DECLARACIÓN'}"`,
      `"${u.serialRecord.dianDeclarationDate || ''}"`,
      `"${u.serialRecord.locationInHospital || ''}"`,
      `"${u.serialRecord.technicianName || ''}"`,
      `"${u.item.status || ''}"`,
      u.matchedGeneralDocs.length,
      u.serialRecord.documents?.length || 0,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Matriz_Seriales_DIAN_Dossier_SYD_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="serialized-equipments-dossier-tab" className="space-y-4 animate-fadeIn">
      {/* Top Banner & KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#192b45] border border-[#334d6e] rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Unidades Contratadas
            </span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-1">{kpis.totalUnits}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">En órdenes y contratos activos</p>
        </div>

        <div className="bg-[#192b45] border border-[#334d6e] rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Seriales Identificados (S/N)
            </span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-300 mt-1">
            {kpis.withSerialAssigned}{' '}
            <span className="text-xs text-slate-400 font-normal">/ {kpis.totalUnits}</span>
          </div>
          <p className="text-[10px] text-purple-300/80 mt-0.5">
            {kpis.totalUnits > 0
              ? `${Math.round((kpis.withSerialAssigned / kpis.totalUnits) * 100)}% identificados`
              : '0%'}
          </p>
        </div>

        <div className="bg-[#192b45] border border-[#334d6e] rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Declaraciones DIAN (Aduana)
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-300 mt-1">
            {kpis.withDianAssigned}{' '}
            <span className="text-xs text-slate-400 font-normal">/ {kpis.totalUnits}</span>
          </div>
          <p className="text-[10px] text-amber-300/80 mt-0.5">Nacionalización y registro DIAN</p>
        </div>

        <div className="bg-[#192b45] border border-[#334d6e] rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Dossiers Listos p/ Entrega
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-1">
            {kpis.withFullDossier}{' '}
            <span className="text-xs text-slate-400 font-normal">/ {kpis.totalUnits}</span>
          </div>
          <p className="text-[10px] text-emerald-400/80 mt-0.5">HV + DIAN + INVIMA + Manual</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#192b45] border border-[#334d6e] rounded-xl p-3 shadow-md space-y-2.5">
        <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por S/N Serial, Placa, DIAN, Modelo, Marca, Equipo, Cliente o Contrato..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#15253d] border border-[#334d6e] rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:border-[var(--syd-accent)] outline-none font-medium"
            />
          </div>

          {/* Client Filter */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="bg-[#15253d] border border-[#334d6e] rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200 focus:border-[var(--syd-accent)] outline-none cursor-pointer"
            >
              <option value="ALL">Todos los Clientes / Hospitales</option>
              {uniqueClients.map((cli) => (
                <option key={cli} value={cli}>
                  {cli}
                </option>
              ))}
            </select>
          </div>

          {/* DIAN Filter */}
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={filterDianStatus}
              onChange={(e) =>
                setFilterDianStatus(e.target.value as 'ALL' | 'WITH_DIAN' | 'WITHOUT_DIAN')
              }
              className="bg-[#15253d] border border-[#334d6e] rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200 focus:border-[var(--syd-accent)] outline-none cursor-pointer"
            >
              <option value="ALL">Filtro DIAN: Todos</option>
              <option value="WITH_DIAN">✅ Con Declaración DIAN</option>
              <option value="WITHOUT_DIAN">⚠️ Sin Registro DIAN</option>
            </select>
          </div>

          {/* Doc Completeness */}
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={filterDocStatus}
              onChange={(e) =>
                setFilterDocStatus(e.target.value as 'ALL' | 'COMPLETE' | 'PENDING')
              }
              className="bg-[#15253d] border border-[#334d6e] rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200 focus:border-[var(--syd-accent)] outline-none cursor-pointer"
            >
              <option value="ALL">Dossier: Todos</option>
              <option value="COMPLETE">🌟 Dossier Completo (100%)</option>
              <option value="PENDING">⏳ Pendiente de Datos</option>
            </select>
          </div>

          {/* Export Matrix Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow transition cursor-pointer shrink-0"
            title="Exportar base completa de seriales, DIAN y clientes a Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Matriz Excel</span>
          </button>
        </div>
      </div>

      {/* Main Table / Grid of Serialized Equipment */}
      {filteredUnits.length === 0 ? (
        <div className="bg-[#192b45] border border-[#334d6e] rounded-xl p-10 text-center text-slate-400 space-y-3 shadow-md flex flex-col items-center justify-center min-h-[220px]">
          <Tag className="w-10 h-10 text-slate-500" />
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-sm font-bold text-white">No se encontraron equipos serializados</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              No hay registros que coincidan con los filtros aplicados, o las órdenes de compra aún no tienen unidades registradas.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-[#192b45] border border-[#334d6e] rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#121f33] text-slate-300 border-b border-[#223854] text-[11px] uppercase tracking-wider font-bold">
                  {SERIALIZED_UNIT_COLUMNS.map((col) => (
                    <th
                      key={col.id}
                      className="py-2.5 px-3"
                      style={{ minWidth: col.minWidth, width: col.width }}
                    >
                      <ExcelColumnHeader
                        column={col}
                        allRows={baseUnits}
                        filters={excelFilters}
                        sort={excelSort}
                        onApplyFilter={onApplyFilter}
                        onApplySort={onApplySort}
                        onClearColumnFilter={onClearColumnFilter}
                      />
                    </th>
                  ))}
                  <th className="py-2.5 px-3 text-center min-w-[140px] text-slate-300 font-bold text-[11px] whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Acciones y Dossier</span>
                      {isFilteredOrSorted && (
                        <button
                          type="button"
                          onClick={onResetAllFilters}
                          className="inline-flex items-center gap-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded px-1.5 py-0.5 text-[9.5px] font-bold transition cursor-pointer"
                          title="Restablecer filtros Excel"
                        >
                          <RotateCcw className="w-2 h-2" />
                          <span>Limpiar</span>
                        </button>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1b2d46]">
                {filteredUnits.map((u) => {
                  const hasSerial = Boolean(
                    u.serialRecord.serialNumber && u.serialRecord.serialNumber.trim()
                  );
                  const hasDian = Boolean(
                    u.serialRecord.dianImportDeclaration &&
                      u.serialRecord.dianImportDeclaration.trim()
                  );
                  const indivDocsCount = u.serialRecord.documents?.length || 0;
                  const genDocsCount = u.matchedGeneralDocs.length;

                  return (
                    <tr key={u.id} className="hover:bg-[#15253d]/90 transition">
                      {/* Serial & Placa */}
                      <td className="py-3 px-3.5 align-top">
                        {u.serialRecord.identifierType === 'na' ? (
                          <span className="inline-flex items-center gap-1 bg-slate-800 text-slate-400 text-[10.5px] px-2 py-0.5 rounded border border-slate-700 font-mono italic">
                            No Aplica (N/A)
                          </span>
                        ) : u.serialRecord.identifierType === 'lote' ? (
                          <div className="inline-flex items-center gap-1 bg-amber-950/80 text-amber-200 border border-amber-500/40 text-xs font-mono font-bold px-2 py-0.5 rounded-lg">
                            <Boxes className="w-3 h-3 text-amber-400" />
                            <span>Lote: {u.serialRecord.serialNumber || 'Sin Lote'}</span>
                          </div>
                        ) : hasSerial ? (
                          <div className="inline-flex items-center gap-1 bg-purple-950/80 text-purple-200 border border-purple-500/40 text-xs font-mono font-bold px-2 py-0.5 rounded-lg">
                            <Tag className="w-3 h-3 text-purple-400" />
                            <span>{u.serialRecord.serialNumber}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-slate-800 text-slate-400 text-[10.5px] px-2 py-0.5 rounded border border-slate-700 font-mono">
                            Unidad #{u.unitIndex} (Sin S/N)
                          </span>
                        )}

                        {u.serialRecord.inventoryPlate && (
                          <div className="text-[10px] text-cyan-300 font-mono mt-1 flex items-center gap-1">
                            <span>Placa:</span>
                            <span className="font-bold">{u.serialRecord.inventoryPlate}</span>
                          </div>
                        )}

                        {u.serialRecord.locationInHospital && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            📍 {u.serialRecord.locationInHospital}
                          </div>
                        )}
                      </td>

                      {/* Equipment info */}
                      <td className="py-3 px-3.5 align-top">
                        <div className="font-bold text-white leading-tight">{u.item.name}</div>
                        <div className="text-[11px] text-sky-300 font-medium mt-0.5">
                          {u.item.brand} • <span className="text-slate-300">{u.item.model}</span>
                        </div>
                        {u.item.code && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Cód: {u.item.code}
                          </div>
                        )}
                      </td>

                      {/* Client / Contract */}
                      <td className="py-3 px-3.5 align-top">
                        <div className="font-bold text-slate-200">{u.clientName}</div>
                        <div className="text-[10px] text-purple-300 font-mono flex items-center gap-1 mt-0.5">
                          <span>Contrato:</span>
                          <span className="font-bold">{u.contractNumber}</span>
                        </div>
                        {u.city && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            🏙️ {u.city}
                          </div>
                        )}
                      </td>

                      {/* DIAN */}
                      <td className="py-3 px-3.5 align-top">
                        {hasDian ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 bg-amber-950/80 text-amber-200 border border-amber-500/50 text-[10.5px] font-mono font-bold px-2 py-0.5 rounded">
                              <ShieldCheck className="w-3 h-3 text-amber-400" />
                              <span>{u.serialRecord.dianImportDeclaration}</span>
                            </span>
                            {u.serialRecord.dianDeclarationDate && (
                              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Calendar className="w-2.5 h-2.5" />
                                <span>{u.serialRecord.dianDeclarationDate}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10.5px] text-slate-500 italic">
                            Sin registro DIAN
                          </span>
                        )}
                      </td>

                      {/* Matching General Docs from V6 */}
                      <td className="py-3 px-3.5 align-top">
                        {genDocsCount > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {u.matchedGeneralDocs.slice(0, 3).map((d, dIdx) => (
                              <span
                                key={`gen-doc-${d.id || 'doc'}-${dIdx}`}
                                className="bg-blue-950/70 text-blue-300 border border-blue-500/30 text-[9.5px] px-1.5 py-0.5 rounded font-medium"
                                title={`${d.docType}: ${d.title}`}
                              >
                                {d.docType.replace('Registro ', '').replace('Manual de ', 'M. ')}
                              </span>
                            ))}
                            {genDocsCount > 3 && (
                              <span className="bg-[#1e2f47] text-slate-400 text-[9px] px-1 py-0.5 rounded">
                                +{genDocsCount - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10.5px] text-slate-500">Sin docs modelo</span>
                        )}
                      </td>

                      {/* Individual docs attached */}
                      <td className="py-3 px-3.5 align-top">
                        {indivDocsCount > 0 ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[10.5px] px-2 py-0.5 rounded font-bold">
                            <FileCheck className="w-3 h-3 text-emerald-400" />
                            <span>{indivDocsCount} adjunto(s)</span>
                          </span>
                        ) : (
                          <span className="text-[10.5px] text-slate-500">0 adjuntos</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 align-top text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* Dossier Completo Unificado */}
                          <button
                            type="button"
                            onClick={() => handleOpenPreview(u, 'dossier')}
                            className="inline-flex items-center gap-1 bg-sky-600 hover:bg-sky-500 text-white text-[10.5px] font-bold px-2 py-1 rounded-lg shadow transition cursor-pointer"
                            title="Ver e imprimir Dossier Hospitalario Unificado Completo"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Dossier</span>
                          </button>

                          {/* Hoja de Vida */}
                          <button
                            type="button"
                            onClick={() => handleOpenPreview(u, 'hoja_de_vida')}
                            className="p-1 rounded-lg bg-[#1b2d46] hover:bg-[#253f63] text-emerald-300 hover:text-white border border-emerald-500/30 transition cursor-pointer"
                            title="Hoja de Vida Biomédica (MinSalud Res. 3100)"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          {/* Acta de Entrega */}
                          <button
                            type="button"
                            onClick={() => handleOpenPreview(u, 'acta')}
                            className="p-1 rounded-lg bg-[#1b2d46] hover:bg-[#253f63] text-purple-300 hover:text-white border border-purple-500/30 transition cursor-pointer"
                            title="Acta Técnica de Entrega e Instalación"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                          </button>

                          {/* Editar / Gestionar Serial */}
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditSerialModal(u)}
                              className="p-1 rounded-lg bg-[#1b2d46] hover:bg-[#253f63] text-slate-300 hover:text-white border border-[#334d6e] transition cursor-pointer"
                              title="Gestionar seriales, DIAN y subir archivos adjuntos"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Edit Serial & Dossier */}
      {activeSerialsModal && (
        <ItemSerialsDossierModal
          isOpen={true}
          onClose={() => setActiveSerialsModal(null)}
          contract={activeSerialsModal.contract}
          item={activeSerialsModal.item}
          allDocuments={documents}
          equipments={equipments}
          onSaveSerials={handleSaveSerialsFromModal}
        />
      )}

      {/* MODAL 2: Full Screen Dossier / Hoja de Vida / Acta HTML Preview & Print */}
      {dossierPreview &&
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-sm animate-fadeIn">
            {/* Modal Header */}
            <div className="bg-[#15253d] border-b border-[#334d6e] px-4 py-3 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  {dossierPreview.type === 'dossier' ? (
                    <Sparkles className="w-4 h-4" />
                  ) : dossierPreview.type === 'hoja_de_vida' ? (
                    <FileText className="w-4 h-4" />
                  ) : (
                    <FileCheck className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">{dossierPreview.title}</h3>
                  <p className="text-xs text-slate-400">
                    {dossierPreview.itemName} • S/N: {dossierPreview.serialNumber}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(dossierPreview.htmlContent);
                      printWindow.document.close();
                      printWindow.focus();
                      setTimeout(() => {
                        printWindow.print();
                      }, 500);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir / Guardar PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([dossierPreview.htmlContent], {
                      type: 'text/html;charset=utf-8',
                    });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${dossierPreview.title.replace(/[\/\s:]+/g, '_')}.html`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  }}
                  className="inline-flex items-center gap-1.5 bg-[#1b2d46] hover:bg-[#253f63] text-slate-200 text-xs font-bold px-3 py-1.5 rounded-xl border border-[#334d6e] transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar HTML</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDossierPreview(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#1b2d46] transition cursor-pointer ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: iFrame Preview */}
            <div className="flex-1 p-4 overflow-auto bg-slate-900 flex justify-center">
              <iframe
                title={dossierPreview.title}
                srcDoc={dossierPreview.htmlContent}
                className="w-full max-w-5xl h-full bg-white rounded-xl shadow-2xl border border-slate-700"
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
