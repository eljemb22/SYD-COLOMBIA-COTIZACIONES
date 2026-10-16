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
  Check,
  Sparkles,
  Search,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  HardDrive,
  Filter,
  Boxes,
  Tag,
  FileCheck,
  Printer,
  Layers,
  RefreshCw,
  Folder,
  FolderPlus,
  Copy,
  FolderArchive,
  UploadCloud,
  CheckCheck,
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
import { saveStoredOCTrackingContracts } from '../../../utils/ocTrackingStorage';
import { googleWorkspaceService, DriveFileItem } from '../../../services/googleWorkspaceService';

export interface ContractFolderRecord {
  folderId: string;
  folderName: string;
  webViewLink?: string;
  equipmentSubfolders?: Record<string, { folderId: string; folderName: string; webViewLink?: string }>;
}

export const CONTRACT_FOLDERS_STORAGE_KEY = 'syd_contract_drive_folders';

export function getStoredContractFolders(): Record<string, ContractFolderRecord> {
  try {
    const raw = localStorage.getItem(CONTRACT_FOLDERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

export function saveStoredContractFolder(contractKey: string, record: ContractFolderRecord): void {
  try {
    const current = getStoredContractFolders();
    current[contractKey.trim().toLowerCase()] = record;
    localStorage.setItem(CONTRACT_FOLDERS_STORAGE_KEY, JSON.stringify(current));
  } catch (_) {}
}

interface ContractsDocumentationTabProps {
  tenderClients?: TenderClientProject[];
  ocContracts?: OCTrackingContract[];
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
  onSaveDocument?: (newDoc: TechnicalDocument) => void;
  onUpdateContracts?: (contracts: OCTrackingContract[]) => void;
  mode?: 'all' | 'tenders' | 'direct_oc';
  searchQuery?: string;
  onNavigateToTenders?: () => void;
  onNavigateToOCTracking?: () => void;
}

interface UnifiedExpediente {
  id: string;
  sourceType: 'tender' | 'direct_oc';
  isDirectOC: boolean;
  typeLabel: string;
  processNumber: string;
  clientName: string;
  nit: string;
  city: string;
  status: string;
  budgetCOP: number;
  totalCostCOP: number;
  supplier?: string;
  items: any[];
  tenderData?: TenderClientProject;
  ocContractData?: OCTrackingContract;
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

// Helper to check if a process or contract is a direct purchase order
function checkIsDirectOC(processNum: string, clientName: string, extra?: any): boolean {
  if (extra?.isDirectOC) return true;
  const p = (processNum || '').toUpperCase();
  const t = (extra?.header?.processType || extra?.header?.contractType || '').toLowerCase();
  if (t.includes('direct') || t.includes('oc')) return true;
  if (/^(?:OC|HBOC|NoHBOC|ORDEN|PO|DIRECTA)/i.test(p) || p.includes('HBOC') || p.includes('OC-') || p.includes('OC_')) {
    return true;
  }
  return false;
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

  // 1. Build unified, deduplicated list of all expedientes
  const unifiedExpedientes = useMemo<UnifiedExpediente[]>(() => {
    const list: UnifiedExpediente[] = [];
    const matchedOCContractIds = new Set<string>();

    // Step A: Process all tender clients / projects
    (tenderClients || []).forEach((tender) => {
      if (!tender) return;
      const clientName = tender.clientName || tender.header?.entityName || '';
      if (!clientName && !tender.id) return;

      const processNum = tender.header?.processNumber || `LIC-${String(tender.id || '').slice(-4)}`;
      let isDirect = checkIsDirectOC(processNum, clientName, tender);

      // Find matching OC contract in ocContracts to link and avoid duplicating
      const linkedOC = (ocContracts || []).find((c) => {
        if (!c) return false;
        if (c.tenderClientId && c.tenderClientId === tender.id) return true;
        if (c.id === tender.id) return true;
        const cProc = (c.contractNumber || c.ocNumber || '').trim().toLowerCase();
        const tProc = processNum.trim().toLowerCase();
        if (cProc && tProc && (cProc === tProc || cProc.includes(tProc) || tProc.includes(cProc))) {
          return true;
        }
        if (
          c.clientName &&
          clientName &&
          c.clientName.trim().toLowerCase() === clientName.trim().toLowerCase() &&
          c.contractNumber &&
          processNum &&
          c.contractNumber.includes(processNum)
        ) {
          return true;
        }
        return false;
      });

      if (linkedOC) {
        matchedOCContractIds.add(linkedOC.id);
        if (linkedOC.isDirectOC || linkedOC.ocNumber || checkIsDirectOC(linkedOC.ocNumber || '', linkedOC.clientName, linkedOC)) {
          isDirect = true;
        }
      }

      const tenderItems = tender.items || (tender as any).equipos || [];

      list.push({
        id: tender.id,
        sourceType: 'tender',
        isDirectOC: isDirect,
        typeLabel: isDirect ? 'OC Directa' : 'Licitación Normal',
        processNumber: processNum,
        clientName: clientName || 'Cliente sin nombre',
        nit: tender.nit || tender.header?.nit || 'N/A',
        city: tender.header?.city || 'Colombia',
        status: tender.status || 'En Preparación',
        budgetCOP: tender.header?.budgetCOP || linkedOC?.totalCostCOP || 0,
        totalCostCOP: linkedOC?.totalCostCOP || tender.header?.budgetCOP || 0,
        supplier: linkedOC?.supplier,
        items: tenderItems,
        tenderData: tender,
        ocContractData: linkedOC,
      });
    });

    // Step B: Process standalone OC contracts that were NOT linked to any tender
    (ocContracts || []).forEach((c) => {
      if (!c || matchedOCContractIds.has(c.id)) return;

      const clientName = c.clientName || c.supplier || '';
      if (!clientName && !c.id && !c.ocNumber) return;

      const processNum = c.ocNumber || c.contractNumber || `OC-${String(c.id || '').slice(-4)}`;

      // Check if already covered by an existing item in list
      const alreadyInList = list.some((u) => {
        const uProc = u.processNumber.trim().toLowerCase();
        const cProc = (c.contractNumber || c.ocNumber || '').trim().toLowerCase();
        const uName = u.clientName.trim().toLowerCase();
        const cName = clientName.trim().toLowerCase();
        return (
          u.id === c.id ||
          (uName === cName && cProc && uProc && (uProc === cProc || uProc.includes(cProc) || cProc.includes(uProc)))
        );
      });

      if (alreadyInList) {
        matchedOCContractIds.add(c.id);
        return;
      }

      const cItems = c.items || (c as any).equipos || [];
      const isDirect = true; // Standalone OC is direct

      list.push({
        id: c.id,
        sourceType: 'direct_oc',
        isDirectOC: isDirect,
        typeLabel: 'OC Directa',
        processNumber: processNum,
        clientName: clientName || 'Contrato de Compra Directa',
        nit: 'N/A',
        city: 'Colombia',
        status: c.globalStatus || 'Emitida',
        budgetCOP: c.totalCostCOP || 0,
        totalCostCOP: c.totalCostCOP || 0,
        supplier: c.supplier,
        items: cItems,
        ocContractData: c,
      });
    });

    return list;
  }, [tenderClients, ocContracts]);

  // Counts for tabs
  const totalCount = unifiedExpedientes.length;
  const tendersCount = useMemo(() => unifiedExpedientes.filter((e) => !e.isDirectOC).length, [unifiedExpedientes]);
  const directOCsCount = useMemo(() => unifiedExpedientes.filter((e) => e.isDirectOC).length, [unifiedExpedientes]);

  // Active filtered list
  const activeExpedientes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return unifiedExpedientes.filter((exp) => {
      // 1. Subfilter check
      if (subFilter === 'tenders' && exp.isDirectOC) return false;
      if (subFilter === 'direct_oc' && !exp.isDirectOC) return false;

      // 2. Select dropdown contract filter
      if (contractFilter !== 'all') {
        const matchesId =
          exp.id === contractFilter ||
          exp.tenderData?.id === contractFilter ||
          exp.ocContractData?.id === contractFilter;
        if (!matchesId) return false;
      }

      // 3. Search query
      if (!q) return true;
      const matchClient = exp.clientName.toLowerCase().includes(q);
      const matchProc = exp.processNumber.toLowerCase().includes(q);
      const matchSupplier = (exp.supplier || '').toLowerCase().includes(q);
      const matchItems = Array.isArray(exp.items) && exp.items.some(
        (it: any) =>
          (it?.name || '').toLowerCase().includes(q) ||
          (it?.brand || '').toLowerCase().includes(q) ||
          (it?.code || '').toLowerCase().includes(q)
      );

      return matchClient || matchProc || matchSupplier || matchItems;
    });
  }, [unifiedExpedientes, subFilter, contractFilter, searchQuery]);

  // Handler to link all matching catalog documents into an expediente
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

  // Create Google Drive folder for this Contract / Process and subfolders for each equipment
  const handleCreateContractDriveFolder = async (exp: UnifiedExpediente, autoCreateSubfolders = true) => {
    const rawContractName = `${exp.processNumber} - ${exp.clientName}`.trim();
    const folderName = rawContractName.replace(/[\\/:*?"<>|]/g, '-').trim() || `Contrato-${exp.id}`;

    setCreatingFolderForContract((prev) => ({ ...prev, [exp.id]: true }));
    try {
      if (googleWorkspaceService && typeof (googleWorkspaceService as any).ensureInitialized === 'function') {
        try {
          await (googleWorkspaceService as any).ensureInitialized();
        } catch (_) {}
      }

      if (!googleWorkspaceService.isConnected()) {
        if (typeof (googleWorkspaceService as any).connectGoogleWorkspace === 'function') {
          await (googleWorkspaceService as any).connectGoogleWorkspace();
        }
      }

      // 1. Create or get root contract folder in Drive
      const contractFolderItem = await googleWorkspaceService.createDriveFolder(folderName);

      const equipmentSubfolders: Record<string, { folderId: string; folderName: string; webViewLink?: string }> = {};

      // 2. Automatically create subfolders for each equipment in this contract
      const expItems = exp.items || [];
      if (autoCreateSubfolders && Array.isArray(expItems)) {
        for (let i = 0; i < expItems.length; i++) {
          const it = expItems[i];
          if (!it) continue;
          const eqKey = it.id || it.code || `item-${i}`;
          const eqName = [it.code, it.name, it.brand, it.model].filter(Boolean).join(' - ').replace(/[\\/:*?"<>|]/g, '-').trim() || `Equipo-${i + 1}`;
          try {
            const sub = await googleWorkspaceService.createDriveFolder(eqName, contractFolderItem.id);
            equipmentSubfolders[eqKey] = {
              folderId: sub.id,
              folderName: sub.name,
              webViewLink: sub.webViewLink,
            };
            if (it.code) {
              equipmentSubfolders[it.code.toLowerCase().trim()] = equipmentSubfolders[eqKey];
            }
          } catch (subErr) {
            console.warn('Subfolder creation notice:', subErr);
          }
        }
      }

      const record: ContractFolderRecord = {
        folderId: contractFolderItem.id,
        folderName: contractFolderItem.name,
        webViewLink: contractFolderItem.webViewLink,
        equipmentSubfolders,
      };

      saveStoredContractFolder(exp.processNumber, record);
      saveStoredContractFolder(exp.id, record);
      setContractFolders(getStoredContractFolders());

      showToast(`✅ Carpeta de Contrato creada en Google Drive con subcarpetas para ${expItems.length} equipos`);
      return record;
    } catch (err: any) {
      console.error('Error creating contract drive folder:', err);
      showToast(`⚠️ Error al crear carpeta en Google Drive: ${err?.message || 'Verifique conexión'}`);
      return null;
    } finally {
      setCreatingFolderForContract((prev) => ({ ...prev, [exp.id]: false }));
    }
  };

  // Create an individual equipment subfolder inside the contract's Drive folder
  const handleCreateEquipmentSubfolderInContract = async (
    exp: UnifiedExpediente,
    item: any,
    matchedEq?: MedicalEquipment | null
  ) => {
    // 1. Ensure contract folder exists
    let contractRecord =
      contractFolders[exp.processNumber.toLowerCase().trim()] ||
      contractFolders[exp.id.toLowerCase().trim()] ||
      null;

    if (!contractRecord) {
      contractRecord = await handleCreateContractDriveFolder(exp, false);
    }
    if (!contractRecord) return null;

    const code = item.code || matchedEq?.code || '';
    const name = item.name || matchedEq?.name || '';
    const brand = item.brand || matchedEq?.brand || '';
    const model = item.model || matchedEq?.model || '';
    const eqKey = item.id || item.code || [code, name].filter(Boolean).join('-');
    const eqFolderName = [code, name, brand, model].filter(Boolean).join(' - ').replace(/[\\/:*?"<>|]/g, '-').trim() || `Equipo-${eqKey}`;

    try {
      const sub = await googleWorkspaceService.createDriveFolder(eqFolderName, contractRecord.folderId);
      const updatedSubfolders = {
        ...(contractRecord.equipmentSubfolders || {}),
        [eqKey]: {
          folderId: sub.id,
          folderName: sub.name,
          webViewLink: sub.webViewLink,
        },
      };
      if (code) {
        updatedSubfolders[code.toLowerCase().trim()] = updatedSubfolders[eqKey];
      }
      if (item.id) {
        updatedSubfolders[item.id.toLowerCase().trim()] = updatedSubfolders[eqKey];
      }
      contractRecord = { ...contractRecord, equipmentSubfolders: updatedSubfolders };
      saveStoredContractFolder(exp.processNumber, contractRecord);
      saveStoredContractFolder(exp.id, contractRecord);
      setContractFolders(getStoredContractFolders());
      showToast(`✅ Carpeta para "${eqFolderName}" creada dentro del contrato en Google Drive`);
      return sub;
    } catch (err: any) {
      showToast(`⚠️ Error al crear subcarpeta del equipo: ${err?.message || 'Error'}`);
      return null;
    }
  };

  // Copy documents and files from Base Maestra into the contract folder and equipment subfolder
  const handleCopyDocumentsFromMaster = async (
    exp: UnifiedExpediente,
    item: any,
    matchedEq: MedicalEquipment,
    masterDocs: TechnicalDocument[],
    eqIdForDoc: string
  ) => {
    if (!masterDocs || masterDocs.length === 0) {
      showToast('No hay documentos disponibles en Base Maestra para este equipo');
      return;
    }

    setCopyingForEquipment((prev) => ({ ...prev, [eqIdForDoc]: true }));
    try {
      // 1. Ensure Contract folder exists
      let contractRecord =
        contractFolders[exp.processNumber.toLowerCase().trim()] ||
        contractFolders[exp.id.toLowerCase().trim()] ||
        null;

      if (!contractRecord) {
        contractRecord = await handleCreateContractDriveFolder(exp, false);
      }

      if (!contractRecord) {
        throw new Error('No se pudo acceder a la carpeta del contrato en Google Drive.');
      }

      // 2. Ensure equipment subfolder exists inside contract folder
      const eqKey = item.id || item.code || eqIdForDoc;
      let eqSub =
        contractRecord.equipmentSubfolders?.[eqKey] ||
        contractRecord.equipmentSubfolders?.[item.code?.toLowerCase().trim()];

      if (!eqSub) {
        const eqFolderName = [
          item.code || matchedEq.code,
          item.name || matchedEq.name,
          item.brand || matchedEq.brand,
          item.model || matchedEq.model,
        ]
          .filter(Boolean)
          .join(' - ')
          .replace(/[\\/:*?"<>|]/g, '-')
          .trim() || `Equipo-${eqIdForDoc}`;

        const createdSub = await googleWorkspaceService.createDriveFolder(eqFolderName, contractRecord.folderId);
        eqSub = {
          folderId: createdSub.id,
          folderName: createdSub.name,
          webViewLink: createdSub.webViewLink,
        };
        const updatedEquipmentSubfolders = {
          ...(contractRecord.equipmentSubfolders || {}),
          [eqKey]: eqSub,
        };
        if (item.code) {
          updatedEquipmentSubfolders[item.code.toLowerCase().trim()] = eqSub;
        }
        contractRecord = { ...contractRecord, equipmentSubfolders: updatedEquipmentSubfolders };
        saveStoredContractFolder(exp.processNumber, contractRecord);
        saveStoredContractFolder(exp.id, contractRecord);
        setContractFolders(getStoredContractFolders());
      }

      // 3. Copy files and generate document entries
      let copiedCount = 0;
      for (const mDoc of masterDocs) {
        if (!mDoc) continue;
        let newFileUrl = mDoc.fileUrl;
        let newDriveFileId = mDoc.driveFileId;
        let isCloud = Boolean(mDoc.isCloudLink);
        let cloudProv = mDoc.cloudProvider;

        // If stored in Google Drive, make a physical copy into the contract's equipment subfolder!
        if (mDoc.driveFileId) {
          try {
            const copiedFile = await googleWorkspaceService.copyDriveFile(
              mDoc.driveFileId,
              eqSub.folderId,
              mDoc.fileName || mDoc.title
            );
            newDriveFileId = copiedFile.id;
            newFileUrl = copiedFile.webViewLink;
            isCloud = true;
            cloudProv = 'Google Drive';
          } catch (copyErr) {
            console.warn('Physical Drive copy fallback:', copyErr);
          }
        }

        const copiedDoc: TechnicalDocument = {
          id: `doc-copy-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          equipmentId: eqIdForDoc,
          equipmentCode: item.code || matchedEq.code || '',
          equipmentName: item.name || matchedEq.name || '',
          docType: mDoc.docType,
          title: mDoc.title,
          fileName: mDoc.fileName,
          fileSize: mDoc.fileSize,
          fileType: mDoc.fileType,
          fileData: mDoc.fileData,
          fileUrl: newFileUrl,
          downloadUrl: mDoc.downloadUrl,
          isCloudLink: isCloud,
          cloudProvider: cloudProv,
          driveFileId: newDriveFileId,
          invimaRecordNumber: mDoc.invimaRecordNumber || matchedEq.invimaRecordNumber,
          validUntil: mDoc.validUntil || matchedEq.invimaExpiryDate,
          status: mDoc.status || 'Vigente',
          uploadDate: new Date().toISOString().split('T')[0],
          notes: `Copia para contrato ${exp.processNumber} (${exp.clientName}) desde Base Maestra. ${mDoc.notes || ''}`.trim(),
        };

        if (onSaveDocument) {
          onSaveDocument(copiedDoc);
          copiedCount++;
        }
      }

      showToast(`✅ Se copiaron exitosamente ${copiedCount} documento(s) a la carpeta de este Contrato en Google Drive`);
    } catch (err: any) {
      console.error('Error copying master documents:', err);
      showToast(`⚠️ Error al copiar documentos: ${err?.message || 'Error desconocido'}`);
    } finally {
      setCopyingForEquipment((prev) => ({ ...prev, [eqIdForDoc]: false }));
    }
  };

  // Batch copy all documents from master catalog for all matching equipments in a contract
  const handleBatchCopyAllFromMaster = async (exp: UnifiedExpediente, expItems: any[]) => {
    setBatchCopyingContract((prev) => ({ ...prev, [exp.id]: true }));
    let totalCopied = 0;
    try {
      for (let i = 0; i < expItems.length; i++) {
        const it = expItems[i];
        if (!it) continue;
        const matched = equipments.find(
          (e) =>
            e.id === it.equipmentId ||
            (e.code && it.code && normalizeClean(e.code) === normalizeClean(it.code)) ||
            (e.name && it.name && normalizeClean(e.name) === normalizeClean(it.name))
        );
        if (!matched) continue;
        const mDocs = findMatchingCatalogDocs(matched, documents || []);
        if (mDocs.length > 0) {
          const eqId = it.equipmentId || it.id || matched.id || `exp-item-${exp.id}-${i}`;
          await handleCopyDocumentsFromMaster(exp, it, matched, mDocs, eqId);
          totalCopied += mDocs.length;
        }
      }
      showToast(`✅ Proceso finalizado: ${totalCopied} documentos copiados a las carpetas del contrato`);
    } catch (err: any) {
      console.error('Batch copy error:', err);
      showToast(`⚠️ Error en copia masiva: ${err?.message || 'Error'}`);
    } finally {
      setBatchCopyingContract((prev) => ({ ...prev, [exp.id]: false }));
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#192b45] border border-amber-400 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-2xl animate-bounce flex items-center gap-2 pointer-events-none">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Compact Header Filter Bar */}
      <div className="bg-[#192b45] border border-[#334d6e] rounded-xl px-3.5 py-2.5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Sub-filter tabs: Todos | Licitaciones | OCs Directas */}
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
              <span>Todos ({totalCount})</span>
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
              <span>Licitaciones ({tendersCount})</span>
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
              <span>OCs Directas ({directOCsCount})</span>
            </button>
          </div>

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
            <option value="all">Ver Todos ({totalCount})</option>
            {unifiedExpedientes.map((exp) => (
              <option key={`opt-exp-${exp.id}`} value={exp.id}>
                {exp.isDirectOC ? '📦 OC Directa: ' : '🏛️ Licitación: '}
                {exp.processNumber} - {exp.clientName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Empty State when no items exist across selected views */}
      {activeExpedientes.length === 0 && (
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
      {/* UNIFIED DEDUPLICATED EXPEDIENTE CARDS                                    */}
      {/* ========================================================================= */}
      {activeExpedientes.length > 0 && (
        <div className="space-y-3">
          {activeExpedientes.map((exp) => {
            const isCollapsed = Boolean(collapsedContracts[exp.id]);
            const expItems = exp.items || [];
            const linkedOCContract = exp.ocContractData;

            // Calculate documentation completion status for each equipment
            let pendingEquipments = 0;
            let totalCatalogDocsAvailable = 0;

            const equipmentRows = expItems.map((item: any, itIdx: number) => {
              if (!item) {
                return {
                  item: { name: 'Equipo biomédico', quantity: 1 },
                  matchedEq: null,
                  attachedDocs: [],
                  missingTypes: [],
                  isPending: false,
                  eqIdForDoc: `exp-item-${exp.id}-${itIdx}`,
                  matchedOCItem: null,
                };
              }

              const itemName = item?.name || item?.equipmentName || item?.nombre || 'Equipo biomédico';
              const itemCode = item?.code || item?.codigo || '';
              const itemBrand = item?.brand || item?.marca || 'SYD';
              const itemModel = item?.model || item?.modelo || 'General';
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

              // Matched OC item for serials & dispatch
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
                eqIdForDoc: eqId || matchedEq?.id || `exp-item-${exp.id}-${itIdx}`,
                matchedOCItem,
              };
            });

            return (
              <div
                key={`exp-box-${exp.id}`}
                className={`bg-[#192b45] border rounded-xl shadow-md transition overflow-hidden ${
                  exp.isDirectOC
                    ? 'border-purple-500/40 hover:border-purple-400'
                    : pendingEquipments > 0
                    ? 'border-amber-500/40 hover:border-amber-400'
                    : 'border-[#334d6e] hover:border-cyan-500/50'
                }`}
              >
                {/* Compact Contract Box Header */}
                <div className="px-3.5 py-2.5 bg-[#15253d] border-b border-[#334d6e] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Classification Badge: OC Directa vs Licitación Normal */}
                      {exp.isDirectOC ? (
                        <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10.5px] font-bold flex items-center gap-1">
                          <Boxes className="w-3 h-3 text-purple-400" />
                          <span>📦 OC Directa</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10.5px] font-bold flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-cyan-400" />
                          <span>🏛️ Licitación Normal</span>
                        </span>
                      )}

                      {/* Process Number */}
                      <span className="px-2 py-0.5 rounded bg-[#192b45] text-slate-200 border border-[#334d6e] text-[11px] font-black font-mono">
                        {exp.processNumber}
                      </span>

                      {/* Status */}
                      <span
                        className={`px-2 py-0.5 rounded text-[10.5px] font-bold border ${
                          exp.status === 'Adjudicada' || exp.status === 'Cerrado / Concluido' || exp.status === 'Cumplido / Archivado'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        }`}
                      >
                        {exp.status}
                      </span>

                      {/* Pending Documents Alert Badge */}
                      {pendingEquipments > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10.5px] font-black flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          <span>⚠️ {pendingEquipments} equipo{pendingEquipments > 1 ? 's' : ''} pendiente{pendingEquipments > 1 ? 's' : ''}</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10.5px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Documentos Completos</span>
                        </span>
                      )}

                      <span className="text-[11px] text-slate-400">
                        • {expItems.length} equipos
                      </span>
                    </div>

                    {/* Client Name */}
                    <h3 className="text-xs sm:text-sm font-black text-white truncate">
                      {exp.clientName}
                    </h3>

                    {/* Reference and Financial Info */}
                    <div className="flex items-center gap-2 text-[10.5px] text-slate-400 flex-wrap">
                      {exp.nit && exp.nit !== 'N/A' && (
                        <>
                          <span>NIT: <strong className="text-slate-300 font-mono">{exp.nit}</strong></span>
                          <span>•</span>
                        </>
                      )}
                      {exp.city && (
                        <>
                          <span>Ciudad: <strong className="text-slate-300">{exp.city}</strong></span>
                          <span>•</span>
                        </>
                      )}
                      {exp.supplier && (
                        <>
                          <span>Prov: <strong className="text-slate-300">{exp.supplier}</strong></span>
                          <span>•</span>
                        </>
                      )}
                      <span>
                        {exp.isDirectOC ? 'Costo OCs: ' : 'Presupuesto: '}
                        <strong className={exp.isDirectOC ? 'text-purple-300 font-bold' : 'text-cyan-300 font-bold'}>
                          {formatExactCOP(exp.budgetCOP || exp.totalCostCOP || 0)}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Header Actions */}
                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    {/* Contract Drive Folder Integration */}
                    {(() => {
                      const cFolder =
                        contractFolders[exp.processNumber.toLowerCase().trim()] ||
                        contractFolders[exp.id.toLowerCase().trim()] ||
                        null;

                      // Count master docs available for this contract
                      let masterCount = 0;
                      expItems.forEach((it: any) => {
                        const mEq = equipments.find(
                          (e) =>
                            e.id === it.equipmentId ||
                            (e.code && it.code && normalizeClean(e.code) === normalizeClean(it.code)) ||
                            (e.name && it.name && normalizeClean(e.name) === normalizeClean(it.name))
                        );
                        if (mEq) {
                          const mDocs = findMatchingCatalogDocs(mEq, documents || []).filter(
                            (d) => d && d.equipmentId === mEq.id
                          );
                          masterCount += mDocs.length;
                        }
                      });

                      return (
                        <>
                          {cFolder ? (
                            <div className="h-[28px] flex items-center gap-1.5 bg-emerald-950/70 border border-emerald-500/50 rounded-lg px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                              <Folder className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="truncate max-w-[150px] sm:max-w-[210px]" title={cFolder.folderName}>
                                {cFolder.folderName}
                              </span>
                              {cFolder.webViewLink && (
                                <a
                                  href={cFolder.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-400 hover:text-white transition p-0.5"
                                  title="Abrir carpeta del contrato en Google Drive"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          ) : (
                            !isReadOnly && (
                              <button
                                type="button"
                                onClick={() => handleCreateContractDriveFolder(exp)}
                                disabled={creatingFolderForContract[exp.id]}
                                className="h-[28px] px-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[10.5px] transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                title={`Crear carpeta de este proceso en Google Drive: "${exp.processNumber} - ${exp.clientName}" con subcarpetas para cada equipo`}
                              >
                                {creatingFolderForContract[exp.id] ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <FolderPlus className="w-3.5 h-3.5" />
                                )}
                                <span>📁 Crear Carpeta Drive</span>
                              </button>
                            )
                          )}

                          {!isReadOnly && masterCount > 0 && (
                            <button
                              type="button"
                              onClick={() => handleBatchCopyAllFromMaster(exp, expItems)}
                              disabled={batchCopyingContract[exp.id]}
                              className="h-[28px] px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10.5px] transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                              title="Copiar todos los documentos detectados en la Base Maestra hacia este contrato en Google Drive"
                            >
                              {batchCopyingContract[exp.id] ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span>Copiar Todo de Base Maestra ({masterCount})</span>
                            </button>
                          )}
                        </>
                      );
                    })()}

                    <button
                      type="button"
                      onClick={() => toggleCollapse(exp.id)}
                      className="h-[28px] px-2 py-1 rounded-lg bg-[#192b45] hover:bg-[#20375a] border border-[#334d6e] text-slate-300 hover:text-white text-[10.5px] font-bold transition cursor-pointer flex items-center gap-1"
                    >
                      {isCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <span>{isCollapsed ? 'Ver Equipos' : 'Ocultar'}</span>
                    </button>
                  </div>
                </div>

                {/* Equipment Rows */}
                {!isCollapsed && (
                  <div className="p-2.5 sm:p-3 space-y-2">
                    {expItems.length === 0 ? (
                      <div className="text-center py-3 text-slate-400 text-[11px]">
                        Sin equipos registrados en este proceso.
                      </div>
                    ) : (
                      equipmentRows.map(({ item, matchedEq, attachedDocs, missingTypes, isPending, eqIdForDoc, matchedOCItem }, idx) => {
                        const itemCode = item.code || matchedEq?.code || `EQ-${idx + 1}`;
                        const itemBrand = item.brand || matchedEq?.brand || 'SYD';
                        const itemModel = item.model || matchedEq?.model || 'General';

                        const contractFolder =
                          contractFolders[exp.processNumber.toLowerCase().trim()] ||
                          contractFolders[exp.id.toLowerCase().trim()] ||
                          null;
                        const eqKey = item.id || item.code || `item-${idx}`;
                        const eqSubfolder =
                          contractFolder?.equipmentSubfolders?.[eqKey] ||
                          (item.code ? contractFolder?.equipmentSubfolders?.[item.code.toLowerCase().trim()] : null) ||
                          (item.id ? contractFolder?.equipmentSubfolders?.[item.id.toLowerCase().trim()] : null);

                        // Scoped ID specifically for this contract and this equipment
                        const contractEquipmentDocId = `contract-${exp.id}-${item.id || item.code || idx}`;

                        // Documents specifically copied or uploaded for this contract
                        const copiedDocsForThisContract = (documents || []).filter((d) => {
                          if (!d) return false;
                          if (d.equipmentId === contractEquipmentDocId) return true;
                          if (d.equipmentId === eqIdForDoc && d.notes?.toLowerCase().includes(`contrato ${exp.processNumber.toLowerCase()}`)) return true;
                          if (
                            d.notes?.toLowerCase().includes(`contrato ${exp.processNumber.toLowerCase()}`) &&
                            ((itemCode && d.equipmentCode && normalizeClean(d.equipmentCode) === normalizeClean(itemCode)) ||
                              (item.name && d.equipmentName && normalizeClean(d.equipmentName) === normalizeClean(item.name)))
                          ) {
                            return true;
                          }
                          return false;
                        });

                        // Documents in Base Maestra for this equipment
                        const masterDocsForEq = matchedEq
                          ? (documents || []).filter(
                              (d) =>
                                d &&
                                d.equipmentId === matchedEq.id &&
                                (!d.notes || !d.notes.toLowerCase().includes('copia para contrato'))
                            )
                          : [];

                        // Check if Base Maestra equipment also has a Drive folder in equipment storage
                        let baseMaestraDriveFolder: any = null;
                        try {
                          const rawEqF = localStorage.getItem('syd_equipment_drive_folders');
                          if (rawEqF && matchedEq) {
                            const efMap = JSON.parse(rawEqF);
                            baseMaestraDriveFolder =
                              efMap[`id_${matchedEq.id.toLowerCase()}`] ||
                              efMap[`code_${matchedEq.code?.toLowerCase()}`] ||
                              efMap[matchedEq.id.toLowerCase()] ||
                              efMap[matchedEq.code?.toLowerCase()] ||
                              null;
                          }
                        } catch (_) {}

                        const alreadyCopiedToContract = copiedDocsForThisContract.length > 0;
                        const effectiveDocs = alreadyCopiedToContract ? copiedDocsForThisContract : attachedDocs;

                        return (
                          <div
                            key={`exp-item-row-${item.id || idx}`}
                            className={`rounded-lg p-2.5 transition space-y-1.5 ${
                              isPending
                                ? 'bg-amber-950/15 border border-amber-500/30'
                                : 'bg-[#15253d]/60 border border-[#334d6e]/60'
                            }`}
                          >
                            {/* Line 1: Code, Brand, Model, Qty + Alert Badge + Subfolder + Quick Actions */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <span className={`font-mono text-[10.5px] font-bold bg-[#192b45] px-1.5 py-0.2 rounded border border-[#334d6e] ${
                                  exp.isDirectOC ? 'text-purple-300' : 'text-cyan-300'
                                }`}>
                                  {itemCode}
                                </span>
                                <span className="text-[10px] font-black text-blue-300 bg-blue-500/20 px-1.5 py-0.2 rounded border border-blue-500/30">
                                  {itemBrand}
                                </span>
                                <span className="text-[10.5px] text-slate-400 truncate">
                                  Mod: <strong className="text-slate-200">{itemModel}</strong> (Cant: {item.quantity || 1})
                                </span>

                                {/* Equipment Subfolder status inside Contract */}
                                {eqSubfolder ? (
                                  <div className="h-[22px] inline-flex items-center gap-1 px-1.5 rounded bg-emerald-950/70 border border-emerald-500/40 text-[9.5px] font-bold text-emerald-300 shadow-2xs">
                                    <Folder className="w-3 h-3 text-emerald-400 shrink-0" />
                                    <span className="truncate max-w-[120px] sm:max-w-[160px]" title={eqSubfolder.folderName}>
                                      {eqSubfolder.folderName}
                                    </span>
                                    {eqSubfolder.webViewLink && (
                                      <a
                                        href={eqSubfolder.webViewLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-emerald-400 hover:text-white transition p-0.5"
                                        title="Abrir carpeta de este equipo en Google Drive"
                                      >
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    )}
                                  </div>
                                ) : (
                                  !isReadOnly && (
                                    <button
                                      type="button"
                                      onClick={() => handleCreateEquipmentSubfolderInContract(exp, item, matchedEq)}
                                      className="h-[22px] px-1.5 rounded bg-cyan-800/80 hover:bg-cyan-700 text-white text-[9.5px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                      title="Crear carpeta de este equipo dentro de la carpeta del contrato en Google Drive"
                                    >
                                      <FolderPlus className="w-2.5 h-2.5 text-cyan-300" />
                                      <span>+ Carpeta Equipo</span>
                                    </button>
                                  )
                                )}

                                {isPending && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/25 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1">
                                    <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                                    <span>⚠️ Falta {missingTypes.join(' y ')}</span>
                                  </span>
                                )}
                              </div>

                              {/* Action Buttons - Integrated Action Slots where attached documents show directly */}
                              {!isReadOnly && (() => {
                                const ftDoc = effectiveDocs.find((d) => d?.docType?.toLowerCase().includes('ficha'));
                                const invimaDoc = effectiveDocs.find((d) => d?.docType?.toLowerCase().includes('invima') || d?.docType?.toLowerCase().includes('sanitario'));
                                const manualDoc = effectiveDocs.find((d) => d?.docType?.toLowerCase().includes('manual'));
                                const guiaDoc = effectiveDocs.find((d) => d?.docType?.toLowerCase().includes('guía') || d?.docType?.toLowerCase().includes('guia'));
                                const limpiezaDoc = effectiveDocs.find((d) => d?.docType?.toLowerCase().includes('limpieza') || d?.docType?.toLowerCase().includes('protocolo'));

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
                                          onOpenNewDocumentModal(
                                            eqIdForDoc,
                                            typeLabel,
                                            {
                                              id: eqIdForDoc,
                                              code: itemCode,
                                              name: item.name,
                                              brand: itemBrand,
                                              model: itemModel,
                                              invimaRecordNumber: matchedEq?.invimaRecordNumber,
                                              invimaExpiryDate: matchedEq?.invimaExpiryDate,
                                            },
                                            {
                                              processNumber: exp.processNumber,
                                              clientName: exp.clientName,
                                              contractFolderId: eqSubfolder?.folderId || contractFolder?.folderId,
                                              contractFolderName: eqSubfolder?.folderName || contractFolder?.folderName,
                                            }
                                          )
                                        }
                                        className={`h-[26px] px-2.5 rounded-md text-[10.5px] font-bold transition cursor-pointer inline-flex items-center gap-1.5 ${colorConfig.emptyBg} ${colorConfig.emptyText} ${colorConfig.emptyBorder} hover:scale-[1.01] active:scale-[0.99] shrink-0`}
                                        title={`Adjuntar ${typeLabel}`}
                                      >
                                        <Plus className="w-3 h-3 stroke-[2.5]" />
                                        <span>{shortLabel}</span>
                                      </button>
                                    );
                                  }

                                  const isInherited = doc.equipmentId !== eqIdForDoc;

                                  return (
                                    <div
                                      key={`contract-slot-${typeLabel}`}
                                      className="h-[26px] inline-flex items-center rounded-md bg-emerald-950/60 hover:bg-emerald-950/80 border border-emerald-500/50 hover:border-emerald-400 text-emerald-200 text-[10.5px] font-bold shadow-2xs transition shrink-0 overflow-hidden"
                                      title={`${typeLabel}: ${doc.title || doc.fileName}`}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => onPreviewDoc(doc)}
                                        className="h-full px-2 flex items-center gap-1.5 hover:bg-emerald-500/20 text-emerald-300 hover:text-white transition cursor-pointer font-bold truncate max-w-[110px] sm:max-w-[140px]"
                                        title={`Visualizar ${typeLabel}: ${doc.title || doc.fileName}`}
                                      >
                                        {Boolean(doc.isCloudLink || (doc.fileData && doc.fileData.startsWith('http')) || doc.fileUrl) ? (
                                          <HardDrive className="w-3 h-3 text-amber-400 shrink-0" title="Google Drive" />
                                        ) : (
                                          <Check className="w-3 h-3 text-emerald-400 stroke-[3] shrink-0" />
                                        )}
                                        <span className="truncate">{shortLabel}</span>
                                      </button>

                                      {isInherited && (
                                        <span className="text-[8px] text-indigo-300 bg-indigo-950/80 px-1 py-0.5 rounded font-medium mr-0.5">
                                          Base
                                        </span>
                                      )}

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
                                  <div className="flex items-center gap-1 flex-wrap shrink-0">
                                    {renderSlot(ftDoc, 'Ficha Técnica', 'Ficha Técnica', {
                                      emptyBg: 'bg-blue-500/15 hover:bg-blue-500/25',
                                      emptyText: 'text-blue-300',
                                      emptyBorder: 'border border-blue-500/30',
                                    })}
                                    {renderSlot(invimaDoc, 'Registro INVIMA', 'Reg. INVIMA', {
                                      emptyBg: 'bg-emerald-500/15 hover:bg-emerald-500/25',
                                      emptyText: 'text-emerald-300',
                                      emptyBorder: 'border border-emerald-500/30',
                                    })}
                                    {renderSlot(manualDoc, 'Manual de Usuario', 'Manual', {
                                      emptyBg: 'bg-amber-500/15 hover:bg-amber-500/25',
                                      emptyText: 'text-amber-300',
                                      emptyBorder: 'border border-amber-500/30',
                                    })}
                                    {renderSlot(guiaDoc, 'Guía Rápida', 'Guía Rápida', {
                                      emptyBg: 'bg-yellow-500/15 hover:bg-yellow-500/25',
                                      emptyText: 'text-yellow-300',
                                      emptyBorder: 'border border-yellow-500/30',
                                    })}
                                    {renderSlot(limpiezaDoc, 'Protocolo de Limpieza', 'Prot. Limpieza', {
                                      emptyBg: 'bg-teal-500/15 hover:bg-teal-500/25',
                                      emptyText: 'text-teal-300',
                                      emptyBorder: 'border border-teal-500/30',
                                    })}

                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenNewDocumentModal(
                                          eqIdForDoc,
                                          'Otro Documento',
                                          {
                                            id: eqIdForDoc,
                                            code: itemCode,
                                            name: item.name,
                                            brand: itemBrand,
                                            model: itemModel,
                                            invimaRecordNumber: matchedEq?.invimaRecordNumber,
                                            invimaExpiryDate: matchedEq?.invimaExpiryDate,
                                          },
                                          {
                                            processNumber: exp.processNumber,
                                            clientName: exp.clientName,
                                            contractFolderId: eqSubfolder?.folderId || contractFolder?.folderId,
                                            contractFolderName: eqSubfolder?.folderName || contractFolder?.folderName,
                                          }
                                        )
                                      }
                                      className="h-[26px] px-2.5 rounded-md bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-400/50 text-[10.5px] font-bold transition cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                      title="Subir otro documento con clasificación manual personalizada"
                                    >
                                      <Plus className="w-3 h-3 text-purple-300 shrink-0 stroke-[2.5]" />
                                      <span>Otro</span>
                                    </button>
                                  </div>
                                );
                              })()}

                              {/* Integrated Serials & Hoja de Vida Button (Dossier de equipos de la OC) */}
                              {(linkedOCContract || exp.ocContractData) && (
                                <div className="flex items-center gap-1 pl-2 ml-1 border-l border-purple-500/40">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const c = linkedOCContract || exp.ocContractData!;
                                      const targetItem = matchedOCItem || c.items?.[idx] || c.items?.[0] || {
                                        id: `item-${Date.now()}`,
                                        name: item.name,
                                        brand: item.brand,
                                        model: item.model,
                                        quantity: item.quantity || 1,
                                      };
                                      setSerialsModalTarget({ contract: c, item: targetItem as OCTrackingItem });
                                    }}
                                    className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/35 text-purple-200 border border-purple-500/40 text-[10px] font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
                                    title="Gestionar seriales físicos, plaqueta y hoja de vida para este equipo de la OC"
                                  >
                                    <Tag className="w-2.5 h-2.5 text-purple-300" />
                                    <span>🏷️ Seriales & Hoja de Vida</span>
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Base Maestra Detection Banner */}
                            {masterDocsForEq.length > 0 && !alreadyCopiedToContract && (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 rounded-lg bg-indigo-950/80 border border-indigo-500/50 text-indigo-200 text-[10.5px] shadow-sm animate-fadeIn">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Sparkles className="w-4 h-4 text-yellow-300 shrink-0" />
                                  <div className="min-w-0">
                                    <span className="font-bold text-white">Base Maestra detectada:</span>{' '}
                                    <strong>{matchedEq?.brand} {matchedEq?.model}</strong>{' '}
                                    {baseMaestraDriveFolder ? (
                                      <span className="text-cyan-300 font-mono text-[10px]">
                                        (Carpeta en Drive: "{baseMaestraDriveFolder.name}")
                                      </span>
                                    ) : null}{' '}
                                    — tiene <strong>{masterDocsForEq.length} documento(s)</strong> en Base Maestra ({masterDocsForEq.map((d) => d.docType).join(', ')}).
                                  </div>
                                </div>
                                {!isReadOnly && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopyDocumentsFromMaster(exp, item, matchedEq!, masterDocsForEq, contractEquipmentDocId)}
                                    disabled={copyingForEquipment[contractEquipmentDocId]}
                                    className="px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10.5px] transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 shadow-xs active:scale-95"
                                    title="Crear la carpeta del equipo en este contrato y copiar los documentos desde Base Maestra a Google Drive"
                                  >
                                    {copyingForEquipment[contractEquipmentDocId] ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                    <span>📋 Copiar a este Contrato</span>
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Base Maestra Already Copied Indicator */}
                            {alreadyCopiedToContract && (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 text-[10.5px]">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span className="truncate">
                                    Documentos vinculados en este contrato: <strong>{copiedDocsForThisContract.length} archivo(s)</strong> en Google Drive ({copiedDocsForThisContract.map((d) => d.docType).join(', ')}).
                                  </span>
                                </div>
                                {!isReadOnly && masterDocsForEq.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopyDocumentsFromMaster(exp, item, matchedEq!, masterDocsForEq, contractEquipmentDocId)}
                                    disabled={copyingForEquipment[contractEquipmentDocId]}
                                    className="px-2 py-0.5 rounded bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 hover:text-white border border-emerald-500/40 font-bold text-[10px] transition flex items-center gap-1 cursor-pointer shrink-0"
                                    title="Re-sincronizar o re-copiar desde Base Maestra"
                                  >
                                    <RefreshCw className={`w-2.5 h-2.5 ${copyingForEquipment[contractEquipmentDocId] ? 'animate-spin' : ''}`} />
                                    <span>Re-sincronizar</span>
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Line 2: Equipment Name */}
                            <h4 className="text-xs font-bold text-white leading-tight">
                              {item.name}
                            </h4>

                            {/* Line 3: Attached Documents Chips - ONLY custom extra documents not in the 5 preset slots */}
                            {(() => {
                              const isPresetDoc = (d: TechnicalDocument) => {
                                const t = (d?.docType || '').toLowerCase();
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
                              const extraDocs = attachedDocs.filter((d) => !isPresetDoc(d));

                              if (extraDocs.length === 0) return null;

                              return (
                                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                  <span className="text-[10px] font-bold text-purple-300/80 mr-0.5">
                                    Otros Anexos:
                                  </span>
                                  {extraDocs.map((doc, dIdx) => {
                                    const isInherited = doc.equipmentId !== eqIdForDoc;

                                    return (
                                      <div
                                        key={`doc-chip-${doc.id || dIdx}`}
                                        className="inline-flex items-center gap-1.5 bg-[#111c2e] border border-purple-500/40 hover:border-purple-400/60 rounded-md px-2 py-1 text-[10.5px] transition group shadow-2xs"
                                      >
                                        {Boolean(doc.isCloudLink || (doc.fileData && doc.fileData.startsWith('http')) || doc.fileUrl) && (
                                          <span title="Alojado en Google Drive / Nube">
                                            <HardDrive className="w-3 h-3 text-amber-400 shrink-0" />
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => onPreviewDoc(doc)}
                                          className="font-bold text-purple-200 hover:text-white truncate max-w-[150px] text-left cursor-pointer transition"
                                          title={`Previsualizar: ${doc.docType}: ${doc.title}`}
                                        >
                                          {doc.docType}: {doc.title}
                                        </button>
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
                                            <Eye className="w-3 h-3 text-purple-300" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => onDownloadDoc(doc)}
                                            className="text-slate-300 hover:text-purple-200 transition cursor-pointer"
                                            title="Descargar"
                                          >
                                            <Download className="w-3 h-3 text-purple-300" />
                                          </button>
                                          {!isReadOnly && (
                                            <button
                                              type="button"
                                              onClick={() => onDeleteDocument(doc.id)}
                                              className="text-slate-400 hover:text-rose-400 transition cursor-pointer"
                                              title="Eliminar este anexo"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}

                            {/* Line 4: Integrated Serials Summary */}
                            {matchedOCItem && (
                              (matchedOCItem.serialNumbers && matchedOCItem.serialNumbers.length > 0) ||
                              (matchedOCItem.serialNumber && matchedOCItem.serialNumber.trim()) ||
                              (matchedOCItem.assignedSerialNumbers && matchedOCItem.assignedSerialNumbers.length > 0)
                            ) && (
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
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-purple-950/60 text-purple-200 border border-purple-500/30 font-mono text-[10px]">
                                    <strong>{matchedOCItem.serialNumber || matchedOCItem.assignedSerialNumbers?.join(', ')}</strong>
                                    <span className="text-[9px] text-slate-400">(Registrado)</span>
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
            const primarySerial = (newSerials || []).find((s) => s.serialNumber && s.serialNumber.trim())?.serialNumber?.trim() || '';
            const allSerialsList = (newSerials || []).map((s) => s.serialNumber?.trim()).filter(Boolean);
            const targetCId = serialsModalTarget.contract?.id || contractId;
            const targetItemId = serialsModalTarget.item?.id || itemId;
            const targetItemName = normalizeClean(serialsModalTarget.item?.name || '');

            const updated = (ocContracts || []).map((c) => {
              const isMatchContract =
                c.id === targetCId ||
                c.id === contractId ||
                c.tenderClientId === targetCId ||
                c.tenderClientId === contractId ||
                (serialsModalTarget.contract?.contractNumber && c.contractNumber === serialsModalTarget.contract.contractNumber);

              if (!isMatchContract) return c;

              const updatedItems = (c.items || []).map((it) => {
                const isMatchItem =
                  it.id === targetItemId ||
                  it.id === itemId ||
                  (serialsModalTarget.item?.equipmentId && it.equipmentId === serialsModalTarget.item.equipmentId) ||
                  (targetItemName && normalizeClean(it.name) === targetItemName);

                if (!isMatchItem) return it;

                return {
                  ...it,
                  serialNumber: primarySerial || it.serialNumber || '',
                  assignedSerialNumbers: allSerialsList.length > 0 ? allSerialsList : (it.assignedSerialNumbers || []),
                  serialNumbers: newSerials,
                  lastUpdatedAt: new Date().toISOString(),
                };
              });

              return {
                ...c,
                items: updatedItems,
                lastUpdatedAt: new Date().toISOString(),
              };
            });

            // Guardar directamente en almacenamiento local y notificar eventos
            saveStoredOCTrackingContracts(updated);
            window.dispatchEvent(new Event('syd-oc-tracking-updated'));
            window.dispatchEvent(new Event('storage'));

            // Sincronizar en el almacén de configuración de equipos para el Cronograma de Mantenimiento
            if (primarySerial) {
              try {
                const rawSettings = localStorage.getItem('syd_maintenance_equipment_settings_v4');
                const parsed = rawSettings ? JSON.parse(rawSettings) : {};
                const cSettings = parsed[targetCId] || {};
                const itSettings = cSettings[targetItemId] || {};
                parsed[targetCId] = {
                  ...cSettings,
                  [targetItemId]: {
                    ...itSettings,
                    serialNumber: primarySerial,
                  },
                };
                if (contractId && contractId !== targetCId) {
                  const altCSettings = parsed[contractId] || {};
                  parsed[contractId] = {
                    ...altCSettings,
                    [itemId]: {
                      ...(altCSettings[itemId] || {}),
                      serialNumber: primarySerial,
                    },
                  };
                }
                localStorage.setItem('syd_maintenance_equipment_settings_v4', JSON.stringify(parsed));
              } catch (e) {}
            }

            if (onUpdateContracts) {
              onUpdateContracts(updated);
            }

            setSerialsModalTarget(null);
            showToast(`✓ Serie "${primarySerial || 'registrada'}", despachos y hoja de vida guardados.`);
          }}
          onOpenNewGeneralDocument={(eqId, eqName) => {
            onOpenNewDocumentModal(eqId, 'Ficha Técnica');
          }}
        />
      )}
    </div>
  );
};
