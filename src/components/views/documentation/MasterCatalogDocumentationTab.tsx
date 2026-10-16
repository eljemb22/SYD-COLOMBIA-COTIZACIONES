import React, { useState, useMemo } from 'react';
import {
  Database,
  Search,
  Filter,
  Plus,
  Trash2,
  Eye,
  Download,
  CheckCircle2,
  Check,
  FolderArchive,
  LayoutGrid,
  FileText,
  ShieldCheck,
  BookOpen,
  Wrench,
  Zap,
  HardDrive,
  ExternalLink,
  RefreshCw,
  Folder,
  FolderPlus,
} from 'lucide-react';
import {
  TechnicalDocument,
  MedicalEquipment,
} from '../../../types';
import { findMatchingCatalogDocs } from './ContractsDocumentationTab';

interface MasterCatalogDocumentationTabProps {
  equipments: MedicalEquipment[];
  documents: TechnicalDocument[];
  isReadOnly?: boolean;
  onOpenNewDocumentModal: (
    equipmentId?: string,
    docType?: string,
    equipmentData?: any,
    contractContext?: any
  ) => void;
  onPreviewDoc: (doc: TechnicalDocument) => void;
  onDownloadDoc: (doc: TechnicalDocument) => void;
  onDeleteDocument: (docId: string) => void;
  onOpenQuickTechSheet?: (equipment: MedicalEquipment) => void;
  onOpenLifeSheet?: (equipment: MedicalEquipment) => void;
  searchQuery?: string;
}

function getDocFileCategory(doc: TechnicalDocument): 'pdf' | 'image' | 'word' | 'other' {
  const fn = (doc.fileName || '').toLowerCase();
  const ft = (doc.fileType || '').toLowerCase();
  const fd = (doc.fileData || '').toLowerCase();

  if (fn.endsWith('.pdf') || ft.includes('pdf') || fd.startsWith('data:application/pdf')) return 'pdf';
  if (fn.endsWith('.jpg') || fn.endsWith('.jpeg') || fn.endsWith('.png') || ft.startsWith('image/') || fd.startsWith('data:image/')) return 'image';
  if (fn.endsWith('.doc') || fn.endsWith('.docx') || ft.includes('word') || ft.includes('officedocument')) return 'word';
  return 'other';
}

export const MasterCatalogDocumentationTab: React.FC<MasterCatalogDocumentationTabProps> = ({
  equipments,
  documents,
  isReadOnly,
  onOpenNewDocumentModal,
  onPreviewDoc,
  onDownloadDoc,
  onDeleteDocument,
  onOpenQuickTechSheet,
  onOpenLifeSheet,
  searchQuery = '',
}) => {
  const [subView, setSubView] = useState<'equipments' | 'files'>('equipments');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [docFilterStatus, setDocFilterStatus] = useState<string>('all');

  const categories = useMemo(() => {
    const set = new Set<string>();
    equipments.forEach((e) => {
      if (e.category) set.add(e.category);
    });
    return ['Todos', ...Array.from(set).sort()];
  }, [equipments]);

  // Map each equipment to its master documents
  const equipmentsWithMasterDocs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return equipments
      .map((eq) => {
        const attachedDocs = findMatchingCatalogDocs(eq, documents);
        return {
          equipment: eq,
          docs: attachedDocs,
          totalDocs: attachedDocs.length,
        };
      })
      .filter(({ equipment: eq, totalDocs, docs }) => {
        if (selectedCategory !== 'Todos' && eq.category !== selectedCategory) return false;
        if (docFilterStatus === 'with_docs' && totalDocs === 0) return false;
        if (docFilterStatus === 'no_docs' && totalDocs > 0) return false;
        if (docFilterStatus === 'with_invima' && !docs.some((d) => d.docType?.toLowerCase().includes('invima'))) return false;
        if (docFilterStatus === 'with_ft' && !docs.some((d) => d.docType?.toLowerCase().includes('ficha'))) return false;

        if (!q) return true;
        const matchName = eq.name.toLowerCase().includes(q);
        const matchCode = (eq.code || '').toLowerCase().includes(q);
        const matchBrand = (eq.brand || '').toLowerCase().includes(q);
        const matchModel = (eq.model || '').toLowerCase().includes(q);
        const matchInvima = (eq.invimaRecordNumber || '').toLowerCase().includes(q);
        const matchDocs = docs.some((d) => d.title.toLowerCase().includes(q) || d.fileName.toLowerCase().includes(q));

        return matchName || matchCode || matchBrand || matchModel || matchInvima || matchDocs;
      });
  }, [equipments, documents, searchQuery, selectedCategory, docFilterStatus]);

  // Filtered flat list of documents for 'files' mode
  const filteredFiles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return documents.filter((doc) => {
      if (!q) return true;
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.equipmentName.toLowerCase().includes(q) ||
        doc.fileName.toLowerCase().includes(q) ||
        doc.docType.toLowerCase().includes(q) ||
        (doc.invimaNumber && doc.invimaNumber.toLowerCase().includes(q)) ||
        (doc.equipmentCode && doc.equipmentCode.toLowerCase().includes(q))
      );
    });
  }, [documents, searchQuery]);

  return (
    <div className="space-y-3 animate-fadeIn">
      {/* Compact Top Filter Bar */}
      <div className="bg-[#192b45] border border-[#334d6e] rounded-xl px-3 py-2 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="flex items-center bg-[#15253d] p-0.5 rounded-lg border border-[#334d6e]">
            <button
              type="button"
              onClick={() => setSubView('equipments')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 ${
                subView === 'equipments'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Database className="w-3 h-3" />
              <span>Por Equipos ({equipmentsWithMasterDocs.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubView('files')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 ${
                subView === 'files'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Todos los Archivos ({documents.length})</span>
            </button>
          </div>

          <span className="text-slate-400 text-[10.5px] hidden md:inline">
            • Los documentos guardados aquí quedan almacenados para cualquier contrato.
          </span>
        </div>

        {/* Filters */}
        {subView === 'equipments' && (
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-[#15253d] border border-[#334d6e] text-[10.5px] font-bold text-slate-200 rounded-lg px-2 py-1 outline-none focus:border-emerald-400 cursor-pointer"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={docFilterStatus}
              onChange={(e) => setDocFilterStatus(e.target.value)}
              className="bg-[#15253d] border border-[#334d6e] text-[10.5px] font-bold text-slate-200 rounded-lg px-2 py-1 outline-none focus:border-emerald-400 cursor-pointer"
            >
              <option value="all">Todos</option>
              <option value="with_docs">Con Documentos</option>
              <option value="no_docs">Sin Documentos</option>
              <option value="with_invima">Con INVIMA</option>
              <option value="with_ft">Con Ficha Técnica</option>
            </select>
          </div>
        )}
      </div>

      {/* SUBVIEW 1: EQUIPMENT MASTER ROWS */}
      {subView === 'equipments' && (
        <div className="space-y-2">
          {equipmentsWithMasterDocs.length === 0 ? (
            <div className="bg-[#192b45] border border-[#334d6e] rounded-xl p-5 text-center text-slate-400 text-xs">
              No se encontraron equipos en la base de datos maestra con los filtros seleccionados.
            </div>
          ) : (
            equipmentsWithMasterDocs.map(({ equipment: eq, docs, totalDocs }, idx) => {
              let driveFolder: any = null;
              try {
                const rawF = localStorage.getItem('syd_equipment_drive_folders');
                if (rawF) {
                  const fMap = JSON.parse(rawF);
                  driveFolder =
                    fMap[`id_${eq.id.toLowerCase()}`] ||
                    fMap[`code_${eq.code?.toLowerCase()}`] ||
                    fMap[eq.id.toLowerCase()] ||
                    fMap[eq.code?.toLowerCase()] ||
                    null;
                }
              } catch (_) {}

              return (
                <div
                  key={`master-eq-${eq.id || idx}`}
                  className="bg-[#1e314b] border border-[#334d6e] hover:border-emerald-500/50 rounded-xl p-2.5 shadow-sm space-y-1.5 transition"
                >
                  {/* Line 1: Badges, Title, Upload Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10.5px] font-bold text-emerald-400 bg-[#15253d] px-1.5 py-0.2 rounded border border-[#334d6e]">
                          {eq.code}
                        </span>
                        <span className="text-[10px] font-black text-blue-300 bg-blue-500/20 px-1.5 py-0.2 rounded border border-blue-500/30">
                          {eq.brand}
                        </span>
                        <span className="text-[10.5px] text-slate-400">
                          Mod: <strong className="text-slate-200">{eq.model}</strong>
                        </span>
                        <span className="text-[10px] bg-[#15253d] text-cyan-300 font-bold px-1.5 py-0.2 rounded-full border border-[#334d6e]">
                          {eq.category}
                        </span>
                        {eq.invimaRecordNumber && (
                          <span className="text-[10px] text-emerald-400 font-mono">
                            INVIMA: {eq.invimaRecordNumber}
                          </span>
                        )}

                        {/* Equipment Drive Folder status */}
                        {driveFolder ? (
                          <div className="h-[22px] inline-flex items-center gap-1 px-1.5 rounded bg-emerald-950/70 border border-emerald-500/40 text-[9.5px] font-bold text-emerald-300 shadow-2xs">
                            <Folder className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="truncate max-w-[120px] sm:max-w-[160px]" title={driveFolder.name}>
                              {driveFolder.name}
                            </span>
                            {driveFolder.webViewLink && (
                              <a
                                href={driveFolder.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-400 hover:text-white transition p-0.5"
                                title="Abrir carpeta en Google Drive"
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        ) : null}
                      </div>

                      <h3 className="text-xs font-bold text-white leading-tight">
                        {eq.name}
                      </h3>
                    </div>

                  {/* Upload Buttons - Reflect already uploaded status */}
                  {/* Upload Buttons - Integrated Action Slots where attached documents show directly */}
                  {!isReadOnly && (() => {
                    const ftDoc = docs.find((d) => d.docType?.toLowerCase().includes('ficha'));
                    const invimaDoc = docs.find((d) => d.docType?.toLowerCase().includes('invima') || d.docType?.toLowerCase().includes('sanitario'));
                    const manualDoc = docs.find((d) => d.docType?.toLowerCase().includes('manual'));
                    const guiaDoc = docs.find((d) => d.docType?.toLowerCase().includes('guía') || d.docType?.toLowerCase().includes('guia'));
                    const limpiezaDoc = docs.find((d) => d.docType?.toLowerCase().includes('limpieza') || d.docType?.toLowerCase().includes('protocolo'));

                    const renderSlot = (
                      doc: TechnicalDocument | undefined,
                      typeLabel: string,
                      shortLabel: string,
                      colorConfig: { emptyBg: string; emptyText: string; emptyBorder: string }
                    ) => {
                      if (!doc) {
                        return (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenNewDocumentModal(eq.id, typeLabel, {
                                id: eq.id,
                                code: eq.code,
                                name: eq.name,
                                brand: eq.brand,
                                model: eq.model,
                                invimaRecordNumber: eq.invimaRecordNumber,
                                invimaExpiryDate: eq.invimaExpiryDate,
                              })
                            }
                            className={`h-[26px] px-2.5 rounded-md text-[10.5px] font-bold transition cursor-pointer inline-flex items-center gap-1.5 ${colorConfig.emptyBg} ${colorConfig.emptyText} ${colorConfig.emptyBorder} hover:scale-[1.01] active:scale-[0.99] shrink-0`}
                            title={`Adjuntar ${typeLabel}`}
                          >
                            <Plus className="w-3 h-3 stroke-[2.5]" />
                            <span>{shortLabel}</span>
                          </button>
                        );
                      }

                      return (
                        <div
                          key={`slot-${typeLabel}`}
                          className="h-[26px] inline-flex items-center rounded-md bg-emerald-950/60 hover:bg-emerald-950/80 border border-emerald-500/50 hover:border-emerald-400 text-emerald-200 text-[10.5px] font-bold shadow-2xs transition shrink-0 overflow-hidden"
                          title={`${typeLabel}: ${doc.title || doc.fileName}`}
                        >
                          {/* Label & click to preview */}
                          <button
                            type="button"
                            onClick={() => onPreviewDoc(doc)}
                            className="h-full px-2 flex items-center gap-1.5 hover:bg-emerald-500/20 text-emerald-300 hover:text-white transition cursor-pointer font-bold truncate max-w-[120px] sm:max-w-[155px]"
                            title={`Visualizar ${typeLabel}: ${doc.title || doc.fileName}`}
                          >
                            {Boolean(doc.isCloudLink || (doc.fileData && doc.fileData.startsWith('http')) || doc.fileUrl) ? (
                              <HardDrive className="w-3 h-3 text-amber-400 shrink-0" title="Google Drive" />
                            ) : (
                              <Check className="w-3 h-3 text-emerald-400 stroke-[3] shrink-0" />
                            )}
                            <span className="truncate">{shortLabel}</span>
                          </button>

                          {/* Compact inline micro-actions with exact matching height */}
                          <div className="flex items-center h-full border-l border-emerald-500/40 bg-emerald-900/25 px-0.5">
                            <button
                              type="button"
                              onClick={() => onPreviewDoc(doc)}
                              className="w-5 h-full flex items-center justify-center text-emerald-300 hover:text-white hover:bg-emerald-500/30 transition cursor-pointer"
                              title="Visualizar documento"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDownloadDoc(doc)}
                              className="w-5 h-full flex items-center justify-center text-emerald-300 hover:text-white hover:bg-emerald-500/30 transition cursor-pointer"
                              title="Descargar archivo"
                            >
                              <Download className="w-3 h-3" />
                            </button>
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() => onDeleteDocument(doc.id)}
                                className="w-5 h-full flex items-center justify-center text-slate-400 hover:text-rose-300 hover:bg-rose-500/30 transition cursor-pointer"
                                title="Eliminar documento"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    };

                    return (
                      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                        {renderSlot(ftDoc, 'Ficha Técnica', 'Ficha Técnica', {
                          emptyBg: 'bg-blue-500/15 hover:bg-blue-500/25',
                          emptyText: 'text-blue-300',
                          emptyBorder: 'border border-blue-500/35',
                        })}
                        {renderSlot(invimaDoc, 'Registro INVIMA', 'Reg. INVIMA', {
                          emptyBg: 'bg-emerald-500/15 hover:bg-emerald-500/25',
                          emptyText: 'text-emerald-300',
                          emptyBorder: 'border border-emerald-500/35',
                        })}
                        {renderSlot(manualDoc, 'Manual de Usuario', 'Manual', {
                          emptyBg: 'bg-amber-500/15 hover:bg-amber-500/25',
                          emptyText: 'text-amber-300',
                          emptyBorder: 'border border-amber-500/35',
                        })}
                        {renderSlot(guiaDoc, 'Guía Rápida', 'Guía Rápida', {
                          emptyBg: 'bg-yellow-500/15 hover:bg-yellow-500/25',
                          emptyText: 'text-yellow-300',
                          emptyBorder: 'border border-yellow-500/35',
                        })}
                        {renderSlot(limpiezaDoc, 'Protocolo de Limpieza', 'Prot. Limpieza', {
                          emptyBg: 'bg-teal-500/15 hover:bg-teal-500/25',
                          emptyText: 'text-teal-300',
                          emptyBorder: 'border border-teal-500/35',
                        })}

                        {/* ALWAYS VISIBLE BUTTON FOR CUSTOM ADDITIONAL DOCUMENTS */}
                        <button
                          type="button"
                          onClick={() =>
                            onOpenNewDocumentModal(eq.id, 'Otro Documento', {
                              id: eq.id,
                              code: eq.code,
                              name: eq.name,
                              brand: eq.brand,
                              model: eq.model,
                              invimaRecordNumber: eq.invimaRecordNumber,
                              invimaExpiryDate: eq.invimaExpiryDate,
                            })
                          }
                          className="h-[26px] px-2.5 rounded-md bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-400/50 text-[10.5px] font-bold transition cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                          title="Subir otro documento con clasificación manual personalizada"
                        >
                          <Plus className="w-3 h-3 text-purple-300 shrink-0 stroke-[2.5]" />
                          <span>Otro</span>
                        </button>

                        {/* SEPARADOR VISUAL PARA GENERADORES DESDE OTRAS PESTAÑAS */}
                        {(onOpenQuickTechSheet || onOpenLifeSheet) && (
                          <div className="flex items-center gap-1.5 pl-2 ml-1 border-l border-slate-700/80">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 hidden sm:inline mr-0.5">
                              Generar:
                            </span>
                            {onOpenQuickTechSheet && (
                              <button
                                type="button"
                                onClick={() => onOpenQuickTechSheet(eq)}
                                className="h-[26px] px-2.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10.5px] font-bold transition cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                title="Crear y redactar Ficha Técnica Oficial (Pestaña 3)"
                              >
                                <span>✨ Ficha Técnica</span>
                              </button>
                            )}
                            {onOpenLifeSheet && (
                              <button
                                type="button"
                                onClick={() => onOpenLifeSheet(eq)}
                                className="h-[26px] px-2.5 rounded-md bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-[10.5px] font-bold transition cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                title="Diligenciar Hoja de Vida Oficial Res. 3100 (Pestaña 4)"
                              >
                                <span>📋 Hoja de Vida</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Line 2: Attached Document Chips - ONLY custom extra documents that are not in the 5 preset slots */}
                {(() => {
                  const isPresetDoc = (d: TechnicalDocument) => {
                    const t = (d.docType || '').toLowerCase();
                    return (
                      t.includes('ficha') ||
                      t.includes('invima') ||
                      t.includes('sanitario') ||
                      t.includes('manual') ||
                      t.includes('guía') ||
                      t.includes('guia') ||
                      t.includes('limpieza') ||
                      t.includes('protocolo')
                    );
                  };
                  const extraDocs = docs.filter((d) => !isPresetDoc(d));

                  if (extraDocs.length === 0) return null;

                  return (
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <span className="text-[10px] font-bold text-purple-300/80 mr-0.5">
                        Otros Anexos:
                      </span>
                      {extraDocs.map((doc, dIdx) => (
                        <div
                          key={`master-doc-extra-${doc.id || dIdx}`}
                          className="h-[26px] inline-flex items-center rounded-md bg-[#111c2e] border border-purple-500/40 hover:border-purple-400/60 text-purple-200 text-[10.5px] font-semibold transition group shadow-2xs overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => onPreviewDoc(doc)}
                            className="h-full px-2 flex items-center gap-1.5 hover:bg-purple-500/20 text-purple-200 hover:text-white transition cursor-pointer truncate max-w-[160px]"
                            title={`Previsualizar: ${doc.docType}: ${doc.title}`}
                          >
                            {Boolean(doc.isCloudLink || (doc.fileData && doc.fileData.startsWith('http')) || doc.fileUrl) ? (
                              <HardDrive className="w-3 h-3 text-amber-400 shrink-0" title="Google Drive" />
                            ) : (
                              <FileText className="w-3 h-3 text-purple-400 shrink-0" />
                            )}
                            <span className="truncate">{doc.docType}: {doc.title}</span>
                          </button>
                          <div className="flex items-center h-full border-l border-[#334d6e] bg-purple-950/20 px-0.5">
                            <button
                              type="button"
                              onClick={() => onPreviewDoc(doc)}
                              className="w-5 h-full flex items-center justify-center text-purple-300 hover:text-white hover:bg-purple-500/30 transition cursor-pointer"
                              title="Previsualizar documento"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDownloadDoc(doc)}
                              className="w-5 h-full flex items-center justify-center text-purple-300 hover:text-white hover:bg-purple-500/30 transition cursor-pointer"
                              title="Descargar documento"
                            >
                              <Download className="w-3 h-3" />
                            </button>
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() => onDeleteDocument(doc.id)}
                                className="w-5 h-full flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/30 transition cursor-pointer"
                                title="Eliminar este anexo"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            );
          })
          )}
        </div>
      )}

      {/* SUBVIEW 2: ALL FILES REPOSITORY (COMPACT CARDS) */}
      {subView === 'files' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {filteredFiles.length === 0 ? (
            <div className="col-span-full bg-[#192b45] border border-[#334d6e] rounded-xl p-6 text-center text-slate-400 text-xs">
              No se encontraron archivos en la base de datos maestra con los filtros seleccionados.
            </div>
          ) : (
            filteredFiles.map((doc, docIdx) => {
              const cat = getDocFileCategory(doc);
              const isInvima = doc.docType === 'Registro INVIMA';

              return (
                <div
                  key={`flat-doc-card-${doc.id || docIdx}`}
                  className="bg-[#1e314b] border border-[#334d6e] hover:border-emerald-500/50 rounded-xl p-2.5 flex flex-col justify-between space-y-2 transition shadow-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#15253d] text-emerald-300 border border-[#334d6e]">
                        {doc.docType}
                      </span>
                      <span className="text-[9.5px] font-mono text-slate-400">
                        {doc.fileSize || 'PDF'}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-white truncate" title={doc.title}>
                      {doc.title}
                    </h4>

                    <div className="text-[10.5px] text-slate-400 truncate">
                      Equipo: <strong className="text-slate-200">{doc.equipmentName || 'General'}</strong>
                    </div>

                    {isInvima && doc.invimaNumber && (
                      <div className="text-[10px] text-emerald-400 font-mono">
                        INVIMA: {doc.invimaNumber}
                      </div>
                    )}
                  </div>

                  <div className="pt-1.5 border-t border-[#334d6e]/50 flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => onPreviewDoc(doc)}
                      className="px-2 py-0.5 rounded bg-[#15253d] hover:bg-[#20375a] text-slate-200 text-[10.5px] font-bold border border-[#334d6e] transition cursor-pointer flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3 text-cyan-400" />
                      <span>Ver</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onDownloadDoc(doc)}
                        className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10.5px] font-bold border border-emerald-500/40 transition cursor-pointer flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>Descargar</span>
                      </button>

                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => onDeleteDocument(doc.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
