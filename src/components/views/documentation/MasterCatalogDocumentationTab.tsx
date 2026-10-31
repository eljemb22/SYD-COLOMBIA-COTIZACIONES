import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  X,
  CheckCheck,
} from 'lucide-react';
import {
  TechnicalDocument,
  MedicalEquipment,
} from '../../../types';
import { findMatchingCatalogDocs } from './ContractsDocumentationTab';
import { googleWorkspaceService, DriveFileItem } from '../../../services/googleWorkspaceService';
import { extractGoogleDriveId } from '../../../utils/cloudLinkUtils';

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

  // Google Drive folders management state
  const [showDriveFoldersModal, setShowDriveFoldersModal] = useState<boolean>(false);
  const [isBatchCreating, setIsBatchCreating] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [isVerifyingFolders, setIsVerifyingFolders] = useState<boolean>(false);
  const [checkingEqId, setCheckingEqId] = useState<Record<string, boolean>>({});
  const [creatingEqId, setCreatingEqId] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [, setFolderVersion] = useState<number>(0);

  // States for folder deletion confirmation modal (in-app, no window.confirm)
  const [equipmentFolderToDelete, setEquipmentFolderToDelete] = useState<{ eq: MedicalEquipment; folder: DriveFileItem } | null>(null);
  const [isDeletingDriveFolder, setIsDeletingDriveFolder] = useState<boolean>(false);

  const documentsRef = React.useRef(documents);
  documentsRef.current = documents;
  const onDeleteDocumentRef = React.useRef(onDeleteDocument);
  onDeleteDocumentRef.current = onDeleteDocument;

  // Auto-verify folders on mount to detect deleted folders in Google Drive
  React.useEffect(() => {
    if (!googleWorkspaceService.isConnected()) return;

    let isCancelled = false;
    const verifyFolders = async () => {
      try {
        const rawF = localStorage.getItem('syd_equipment_drive_folders');
        if (!rawF) return;
        const fMap = JSON.parse(rawF);
        const keys = Object.keys(fMap);
        let changed = false;
        const checkedFolderIds = new Map<string, boolean>();

        for (const k of keys) {
          if (isCancelled) break;
          const folder = fMap[k];
          if (!folder || !folder.id) continue;
          let exists = checkedFolderIds.get(folder.id);
          if (exists === undefined) {
            exists = await googleWorkspaceService.checkFileOrFolderExists(folder.id);
            checkedFolderIds.set(folder.id, exists);
          }
          if (!exists) {
            delete fMap[k];
            changed = true;
          }
        }

        if (changed && !isCancelled) {
          localStorage.setItem('syd_equipment_drive_folders', JSON.stringify(fMap));
          setFolderVersion((v) => v + 1);
        }

        // 2. Verify all documents in Google Drive in real time
        const currentDocs = documentsRef.current;
        const currentDelete = onDeleteDocumentRef.current;
        if (currentDocs && Array.isArray(currentDocs) && currentDelete) {
          for (const doc of currentDocs) {
            if (isCancelled) break;
            const driveId =
              doc.driveFileId ||
              (doc.fileUrl && doc.fileUrl.includes('drive.google.com') ? extractGoogleDriveId(doc.fileUrl) : null) ||
              (doc.fileData && doc.fileData.includes('drive.google.com') ? extractGoogleDriveId(doc.fileData) : null);

            if (driveId) {
              let docExists = checkedFolderIds.get(driveId);
              if (docExists === undefined) {
                docExists = await googleWorkspaceService.checkFileOrFolderExists(driveId);
                checkedFolderIds.set(driveId, docExists);
              }

              if (!docExists) {
                console.warn(`[RealTime] Document "${doc.title || doc.fileName}" deleted in Drive. Purging.`);
                currentDelete(doc.id);
                showToast(`⚠️ El archivo "${doc.title || doc.fileName}" fue eliminado en Google Drive.`);
              }
            }
          }
        }
      } catch (_) {}
    };

    verifyFolders().catch(() => {});

    const handleFocus = () => {
      verifyFolders().catch(() => {});
    };
    window.addEventListener('focus', handleFocus);

    const interval = setInterval(() => {
      verifyFolders().catch(() => {});
    }, 20000);

    return () => {
      isCancelled = true;
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const getStoredFolderForEquipment = (eq: MedicalEquipment) => {
    try {
      const rawF = localStorage.getItem('syd_equipment_drive_folders');
      if (!rawF) return null;
      const fMap = JSON.parse(rawF);
      return (
        fMap[`id_${eq.id.toLowerCase()}`] ||
        fMap[`code_${eq.code?.toLowerCase()}`] ||
        fMap[eq.id.toLowerCase()] ||
        fMap[eq.code?.toLowerCase()] ||
        null
      );
    } catch (_) {
      return null;
    }
  };

  const saveEquipmentFolder = (eq: MedicalEquipment, folder: DriveFileItem) => {
    try {
      const rawF = localStorage.getItem('syd_equipment_drive_folders');
      const fMap = rawF ? JSON.parse(rawF) : {};
      if (eq.id) fMap[`id_${eq.id.toLowerCase()}`] = folder;
      if (eq.code) fMap[`code_${eq.code.toLowerCase()}`] = folder;
      localStorage.setItem('syd_equipment_drive_folders', JSON.stringify(fMap));
      setFolderVersion((v) => v + 1);
    } catch (_) {}
  };

  const unlinkEquipmentFolder = (eq: MedicalEquipment) => {
    try {
      const rawF = localStorage.getItem('syd_equipment_drive_folders');
      if (rawF) {
        const fMap = JSON.parse(rawF);
        if (eq.id) delete fMap[`id_${eq.id.toLowerCase()}`];
        if (eq.code) delete fMap[`code_${eq.code.toLowerCase()}`];
        delete fMap[eq.id.toLowerCase()];
        if (eq.code) delete fMap[eq.code.toLowerCase()];
        localStorage.setItem('syd_equipment_drive_folders', JSON.stringify(fMap));
        setFolderVersion((v) => v + 1);
      }
    } catch (_) {}
  };

  const handleCreateSingleEquipmentMasterFolder = async (eq: MedicalEquipment) => {
    setCreatingEqId((prev) => ({ ...prev, [eq.id]: true }));
    try {
      if (!googleWorkspaceService.isConnected()) {
        await googleWorkspaceService.connectGoogleWorkspace();
      }
      const masterFolder = await googleWorkspaceService.findOrCreateMasterDocFolder('DOCUMENTACION');
      const eqFolderName = [eq.code, eq.name, eq.brand, eq.model].filter(Boolean).join(' - ').replace(/[\\/:*?"<>|]/g, '-').trim() || `Equipo-${eq.id}`;
      const createdFolder = await googleWorkspaceService.createDriveFolder(eqFolderName, masterFolder.id);
      saveEquipmentFolder(eq, createdFolder);
      showToast(`✅ Carpeta para "${eq.name}" creada en Google Drive (DOCUMENTACION)`);
    } catch (e: any) {
      showToast(`⚠️ Error al crear carpeta: ${e?.message || 'Error'}`);
    } finally {
      setCreatingEqId((prev) => ({ ...prev, [eq.id]: false }));
    }
  };

  const handleVerifyEquipmentMasterFolder = async (eq: MedicalEquipment) => {
    const folder = getStoredFolderForEquipment(eq);
    if (!folder || !folder.id) return;
    setCheckingEqId((prev) => ({ ...prev, [eq.id]: true }));
    try {
      const exists = await googleWorkspaceService.checkFileOrFolderExists(folder.id);
      if (!exists) {
        unlinkEquipmentFolder(eq);
        showToast(`⚠️ La carpeta de "${eq.name}" fue eliminada en Google Drive. Se ha desvinculado para permitir crearla nuevamente.`);
      } else {
        showToast(`✓ Carpeta de "${eq.name}" activa y verificada en Google Drive.`);
      }
    } catch (e: any) {
      showToast(`Aviso: ${e?.message || 'Error'}`);
    } finally {
      setCheckingEqId((prev) => ({ ...prev, [eq.id]: false }));
    }
  };

  const handleUnlinkEquipmentMasterFolder = (eq: MedicalEquipment) => {
    unlinkEquipmentFolder(eq);
    showToast(`✓ Carpeta desvinculada para "${eq.name}". Ya puede volver a crearla.`);
  };

  // Delete equipment master folder in Google Drive AND remove from local state
  const handleDeleteEquipmentMasterFolderFromDrive = async (eq: MedicalEquipment, folder: DriveFileItem) => {
    if (!folder?.id) return;
    setIsDeletingDriveFolder(true);
    try {
      if (googleWorkspaceService.isConnected()) {
        try {
          await googleWorkspaceService.deleteDriveFile(folder.id);
        } catch (driveErr) {
          console.warn('Google Drive deletion warning:', driveErr);
        }
      }
      unlinkEquipmentFolder(eq);
      showToast(`✓ Carpeta de "${eq.name}" eliminada de Google Drive y del sistema.`);
    } catch (e: any) {
      unlinkEquipmentFolder(eq);
      showToast(`✓ Carpeta desvinculada del sistema: ${e?.message || ''}`);
    } finally {
      setIsDeletingDriveFolder(false);
      setEquipmentFolderToDelete(null);
    }
  };

  const handleBatchCreateMasterFolders = async () => {
    setIsBatchCreating(true);
    setBatchProgress('Iniciando conexión con Google Drive...');
    try {
      if (!googleWorkspaceService.isConnected()) {
        await googleWorkspaceService.connectGoogleWorkspace();
      }
      setBatchProgress('Localizando carpeta central DOCUMENTACION en Drive...');
      const masterFolder = await googleWorkspaceService.findOrCreateMasterDocFolder('DOCUMENTACION');

      let createdCount = 0;
      for (let i = 0; i < equipments.length; i++) {
        const eq = equipments[i];
        if (!eq) continue;
        const existing = getStoredFolderForEquipment(eq);
        if (existing) continue;

        setBatchProgress(`Creando (${i + 1}/${equipments.length}): ${eq.name.slice(0, 30)}...`);
        const eqFolderName = [eq.code, eq.name, eq.brand, eq.model].filter(Boolean).join(' - ').replace(/[\\/:*?"<>|]/g, '-').trim() || `Equipo-${eq.id}`;
        try {
          const createdFolder = await googleWorkspaceService.createDriveFolder(eqFolderName, masterFolder.id);
          saveEquipmentFolder(eq, createdFolder);
          createdCount++;
        } catch (subErr) {
          console.warn('Batch folder notice:', subErr);
        }
      }
      showToast(`✅ Se crearon ${createdCount} carpetas en DOCUMENTACION de Google Drive`);
    } catch (e: any) {
      showToast(`⚠️ Error en proceso por lotes: ${e?.message || 'Error'}`);
    } finally {
      setIsBatchCreating(false);
      setBatchProgress(null);
    }
  };

  const handleVerifyAllMasterFolders = async () => {
    setIsVerifyingFolders(true);
    try {
      let removedCount = 0;
      for (const eq of equipments) {
        const folder = getStoredFolderForEquipment(eq);
        if (folder && folder.id) {
          const exists = await googleWorkspaceService.checkFileOrFolderExists(folder.id);
          if (!exists) {
            unlinkEquipmentFolder(eq);
            removedCount++;
          }
        }
      }
      if (removedCount > 0) {
        showToast(`⚠️ Se detectaron y desvincularon ${removedCount} carpeta(s) que habían sido eliminadas en Google Drive.`);
      } else {
        showToast(`✓ Todas las carpetas registradas están activas en Google Drive.`);
      }
    } catch (e: any) {
      showToast(`Aviso: ${e?.message || 'Error'}`);
    } finally {
      setIsVerifyingFolders(false);
    }
  };

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

            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setShowDriveFoldersModal(true)}
                className="h-[28px] px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10.5px] transition shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                title="Gestionar y generar carpetas de todos los equipos en la carpeta DOCUMENTACION de Google Drive"
              >
                <FolderPlus className="w-3.5 h-3.5 text-emerald-200" />
                <span>📁 Carpetas en Drive (DOCUMENTACION)</span>
              </button>
            )}
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
                            <span className="truncate max-w-[110px] sm:max-w-[150px]" title={driveFolder.name}>
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
                            <button
                              type="button"
                              onClick={() => handleVerifyEquipmentMasterFolder(eq)}
                              disabled={checkingEqId[eq.id]}
                              className="text-slate-400 hover:text-cyan-300 transition p-0.5 cursor-pointer"
                              title="Verificar si la carpeta aún existe en Google Drive"
                            >
                              <RefreshCw className={`w-2.5 h-2.5 ${checkingEqId[eq.id] ? 'animate-spin text-cyan-400' : ''}`} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const f = getStoredFolderForEquipment(eq);
                                if (f) {
                                  setEquipmentFolderToDelete({ eq, folder: f });
                                } else {
                                  unlinkEquipmentFolder(eq);
                                }
                              }}
                              className="text-slate-400 hover:text-rose-400 transition p-0.5 cursor-pointer"
                              title="Eliminar esta carpeta de Google Drive y del sistema"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ) : (
                          !isReadOnly && (
                            <button
                              type="button"
                              onClick={() => handleCreateSingleEquipmentMasterFolder(eq)}
                              disabled={creatingEqId[eq.id]}
                              className="h-[22px] px-1.5 rounded bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 border border-emerald-600/40 text-[9.5px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="Crear carpeta de este equipo en Google Drive dentro de DOCUMENTACION"
                            >
                              {creatingEqId[eq.id] ? (
                                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                              ) : (
                                <FolderPlus className="w-2.5 h-2.5 text-emerald-400" />
                              )}
                              <span>+ Carpeta en Drive</span>
                            </button>
                          )
                        )}
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
                              <HardDrive className="w-3 h-3 text-amber-400 shrink-0" />
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
                              <HardDrive className="w-3 h-3 text-amber-400 shrink-0" />
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

      {/* Drive Folders Management Modal for Master Catalog */}
      {showDriveFoldersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#14233a] border border-[#2b4468] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-[#243c5e] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-950/80 border border-emerald-500/50">
                  <FolderPlus className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Carpetas en Google Drive (DOCUMENTACION)</h3>
                  <p className="text-[11px] text-slate-400">
                    Estructura central de la Base Maestra en Google Drive
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDriveFoldersModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-[#1b2d48] border border-[#334d6e] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Carpeta Raíz en Drive:</span>
                  <span className="font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                    📁 DOCUMENTACION
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total equipos en catálogo:</span>
                  <span className="font-bold text-white">{equipments.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Equipos con carpeta vinculada:</span>
                  <span className="font-bold text-emerald-400">
                    {equipments.filter((e) => Boolean(getStoredFolderForEquipment(e))).length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Equipos pendientes:</span>
                  <span className="font-bold text-amber-400">
                    {equipments.filter((e) => !getStoredFolderForEquipment(e)).length}
                  </span>
                </div>
              </div>

              {batchProgress && (
                <div className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-200 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                  <span className="text-[11px] font-bold">{batchProgress}</span>
                </div>
              )}

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleBatchCreateMasterFolders}
                  disabled={isBatchCreating}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isBatchCreating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <FolderPlus className="w-4 h-4" />
                  )}
                  <span>
                    {isBatchCreating
                      ? 'Creando carpetas en Drive...'
                      : '🚀 Generar Carpetas de Todos los Equipos en Drive'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleVerifyAllMasterFolders}
                  disabled={isVerifyingFolders || isBatchCreating}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#1b2d48] hover:bg-[#22395a] text-slate-200 border border-[#334d6e] font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isVerifyingFolders ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-cyan-400" />
                  )}
                  <span>
                    {isVerifyingFolders
                      ? 'Verificando existencia en Drive...'
                      : '🔄 Verificar Carpetas en Drive (detectar eliminadas)'}
                  </span>
                </button>
              </div>
            </div>

            <div className="px-5 py-3 bg-[#101c2e] border-t border-[#243c5e] flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowDriveFoldersModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete Equipment Folder in Google Drive & App */}
      {equipmentFolderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#14233a] border border-rose-500/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-scaleUp">
            <div className="px-5 py-4 border-b border-[#243c5e] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">¿Eliminar Carpeta en Google Drive?</h3>
                  <p className="text-[11px] text-slate-400">Equipo: {equipmentFolderToDelete.eq.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEquipmentFolderToDelete(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl space-y-1.5">
                <p className="font-bold text-rose-200">
                  ⚠️ Esta acción eliminará directamente en tu Google Drive la carpeta:
                </p>
                <p className="font-mono text-white text-xs bg-black/40 p-2 rounded-lg break-all">
                  📁 {equipmentFolderToDelete.folder.name}
                </p>
              </div>

              <p className="text-[11.5px] text-slate-300">
                Al confirmar, la carpeta se <strong>eliminará de Google Drive</strong> y se desvinculará del sistema para que puedas volver a crearla cuando lo necesites.
              </p>
            </div>

            <div className="px-5 py-3.5 bg-[#101c2e] border-t border-[#243c5e] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEquipmentFolderToDelete(null)}
                disabled={isDeletingDriveFolder}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteEquipmentMasterFolderFromDrive(equipmentFolderToDelete.eq, equipmentFolderToDelete.folder)}
                disabled={isDeletingDriveFolder}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeletingDriveFolder ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Eliminando en Drive...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Eliminar en Drive y Sistema</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Message */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#14233a] border border-cyan-500/50 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
