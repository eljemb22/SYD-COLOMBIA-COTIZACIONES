import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  Lock,
  X,
  AlertCircle,
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
import { extractGoogleDriveId } from '../../../utils/cloudLinkUtils';
import { detectFileClassification } from '../../common/UnifiedAttachmentSelector';

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

export function removeStoredContractFolder(contractKey: string, equipmentKey?: string): void {
  try {
    const current = getStoredContractFolders();
    const key = contractKey.trim().toLowerCase();
    if (current[key]) {
      if (equipmentKey) {
        if (current[key].equipmentSubfolders) {
          const eqK = equipmentKey.trim().toLowerCase();
          delete current[key].equipmentSubfolders[eqK];
          delete current[key].equipmentSubfolders[equipmentKey];
        }
      } else {
        delete current[key];
      }
      localStorage.setItem(CONTRACT_FOLDERS_STORAGE_KEY, JSON.stringify(current));
    }
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

// Smart detection of document type from file name
export function guessDocType(fileName: string = ''): string {
  const lower = fileName.toLowerCase();
  if (
    lower.includes('data sheet') ||
    lower.includes('datasheet') ||
    lower.includes('data-sheet') ||
    lower.includes('ficha') ||
    lower.includes('especificacion') ||
    lower.includes('especificaciones') ||
    lower.includes('spec') ||
    lower.includes('specs') ||
    lower.includes('ft') ||
    lower.includes('catalogo') ||
    lower.includes('catálogo')
  ) {
    return 'Ficha Técnica';
  }
  if (
    lower.includes('invima') ||
    lower.includes('registro') ||
    lower.includes('sanitario') ||
    lower.includes('reg.') ||
    lower.includes('reg ')
  ) {
    return 'Registro Sanitario INVIMA';
  }
  if (
    lower.includes('manual') ||
    lower.includes('usuario') ||
    lower.includes('servicio') ||
    lower.includes('service') ||
    lower.includes('operacion') ||
    lower.includes('instrucciones de uso')
  ) {
    return 'Manual de Usuario';
  }
  if (
    lower.includes('guia') ||
    lower.includes('guía') ||
    lower.includes('rapida') ||
    lower.includes('rápida') ||
    lower.includes('quick') ||
    lower.includes('instrucciones')
  ) {
    return 'Guía Rápida';
  }
  if (
    lower.includes('limpieza') ||
    lower.includes('desinfeccion') ||
    lower.includes('desinfección') ||
    lower.includes('protocolo')
  ) {
    return 'Protocolo de Limpieza';
  }
  return 'Otro';
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

  // Google Drive folders & batch copying states
  const [contractFolders, setContractFolders] = useState<Record<string, ContractFolderRecord>>(() => getStoredContractFolders());
  const [creatingFolderForContract, setCreatingFolderForContract] = useState<Record<string, boolean>>({});
  const [copyingForEquipment, setCopyingForEquipment] = useState<Record<string, boolean>>({});
  const [batchCopyingContract, setBatchCopyingContract] = useState<Record<string, boolean>>({});
  const [checkingFolderId, setCheckingFolderId] = useState<Record<string, boolean>>({});

  // Contract folder location creation modal
  const [folderModalTarget, setFolderModalTarget] = useState<UnifiedExpediente | null>(null);
  const [folderModalMode, setFolderModalMode] = useState<'select_existing' | 'create_new'>('select_existing');
  const [selectedExistingFolder, setSelectedExistingFolder] = useState<DriveFileItem | null>(null);
  const [existingFolderDirectInput, setExistingFolderDirectInput] = useState<string>('');
  const [folderModalName, setFolderModalName] = useState<string>('');
  const [folderModalLocation, setFolderModalLocation] = useState<'documentacion' | 'contratos' | 'root' | 'custom' | 'link'>('documentacion');
  const [folderModalCustomParentId, setFolderModalCustomParentId] = useState<string>('');
  const [folderModalAutoSubfolders, setFolderModalAutoSubfolders] = useState<boolean>(true);
  const [availableDriveFolders, setAvailableDriveFolders] = useState<DriveFileItem[]>([]);
  const [isLoadingAvailableFolders, setIsLoadingAvailableFolders] = useState<boolean>(false);
  const [folderSearchFilter, setFolderSearchFilter] = useState<string>('');
  const [isVerifyingDrive, setIsVerifyingDrive] = useState<boolean>(false);

  // States for folder deletion confirmation modal (in-app, no window.confirm)
  const [contractFolderToDelete, setContractFolderToDelete] = useState<{ exp: UnifiedExpediente; cFolder: ContractFolderRecord } | null>(null);
  const [equipmentFolderToDelete, setEquipmentFolderToDelete] = useState<{ exp: UnifiedExpediente; item: any; eqSubfolder: any } | null>(null);
  const [isDeletingDriveFolder, setIsDeletingDriveFolder] = useState<boolean>(false);

  // States for detecting and classifying files uploaded manually to Drive
  const [unclassifiedDriveFiles, setUnclassifiedDriveFiles] = useState<Record<string, DriveFileItem[]>>({});
  const [scanningDriveFolderId, setScanningDriveFolderId] = useState<Record<string, boolean>>({});
  const [classifyDriveModalTarget, setClassifyDriveModalTarget] = useState<{
    exp: UnifiedExpediente;
    item: any;
    eqSubfolder: any;
    files: DriveFileItem[];
    defaultDocType?: string;
  } | null>(null);
  const [modalSelectedDocType, setModalSelectedDocType] = useState<Record<string, string>>({});
  const [modalTargetItemId, setModalTargetItemId] = useState<Record<string, string>>({});
  const [modalInvimaNumber, setModalInvimaNumber] = useState<Record<string, string>>({});
  const [modalValidUntil, setModalValidUntil] = useState<Record<string, string>>({});
  const [isLinkingFile, setIsLinkingFile] = useState<Record<string, boolean>>({});

  // Helper to match an item to the MedicalEquipment catalog
  const findEquipmentMatch = useCallback(
    (item: any): MedicalEquipment | undefined => {
      if (!item || !equipments || equipments.length === 0) return undefined;
      return equipments.find(
        (e) =>
          (item.equipmentId && e.id === item.equipmentId) ||
          (item.id && e.id === item.id) ||
          (e.code && item.code && normalizeClean(e.code) === normalizeClean(item.code)) ||
          (e.code && item.equipmentCode && normalizeClean(e.code) === normalizeClean(item.equipmentCode)) ||
          (e.name && item.name && normalizeClean(e.name) === normalizeClean(item.name)) ||
          (e.name && item.equipmentName && normalizeClean(e.name) === normalizeClean(item.equipmentName))
      );
    },
    [equipments]
  );

  useEffect(() => {
    const handleStorage = () => {
      setContractFolders(getStoredContractFolders());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Comprehensive real-time verifier for Drive Folders AND Drive Documents
  const verifyDriveIntegrity = useCallback(
    async (isSilent = true) => {
      if (!googleWorkspaceService.isConnected()) return;

      try {
        if (!isSilent) setIsVerifyingDrive(true);

        // 1. Verify all contract folders & equipment subfolders in Google Drive
        const stored = getStoredContractFolders();
        const keys = Object.keys(stored);
        let foldersChanged = false;
        const checkedFolderIds = new Map<string, boolean>();
        const newUnclassifiedMap: Record<string, DriveFileItem[]> = {};

        for (const k of keys) {
          const record = stored[k];
          if (!record || !record.folderId) continue;

          let rootExists = checkedFolderIds.get(record.folderId);
          if (rootExists === undefined) {
            rootExists = await googleWorkspaceService.checkFileOrFolderExists(record.folderId);
            checkedFolderIds.set(record.folderId, rootExists);
          }

          if (!rootExists) {
            delete stored[k];
            foldersChanged = true;
            continue;
          }

          // Check equipment subfolders
          if (record.equipmentSubfolders) {
            const subKeys = Object.keys(record.equipmentSubfolders);
            for (const sk of subKeys) {
              const sub = record.equipmentSubfolders[sk];
              if (!sub || !sub.folderId) continue;
              let subExists = checkedFolderIds.get(sub.folderId);
              if (subExists === undefined) {
                subExists = await googleWorkspaceService.checkFileOrFolderExists(sub.folderId);
                checkedFolderIds.set(sub.folderId, subExists);
              }
              if (!subExists) {
                delete record.equipmentSubfolders[sk];
                foldersChanged = true;
              } else {
                // Active Scan: Detect files uploaded manually to this equipment subfolder in Google Drive
                try {
                  const driveItems = await googleWorkspaceService.listUserDriveFiles({
                    folderId: sub.folderId,
                    pageSize: 50,
                  });
                  const filesOnly = (driveItems || []).filter(
                    (f) => f.mimeType !== 'application/vnd.google-apps.folder'
                  );
                  const unlinked = filesOnly.filter((f) => {
                    const alreadyLinked = (documents || []).some((d) => {
                      if (d.driveFileId && d.driveFileId === f.id) return true;
                      if (d.fileUrl && d.fileUrl.includes(f.id)) return true;
                      if (d.fileData && d.fileData.includes(f.id)) return true;
                      const sameName = (d.fileName || '').trim().toLowerCase() === (f.name || '').trim().toLowerCase();
                      return sameName;
                    });
                    return !alreadyLinked;
                  });
                  newUnclassifiedMap[sub.folderId] = unlinked;
                  newUnclassifiedMap[sk] = unlinked;
                } catch (_) {}
              }
            }
          }
        }

        if (Object.keys(newUnclassifiedMap).length > 0) {
          setUnclassifiedDriveFiles((prev) => ({
            ...prev,
            ...newUnclassifiedMap,
          }));
        }

        if (foldersChanged) {
          localStorage.setItem(CONTRACT_FOLDERS_STORAGE_KEY, JSON.stringify(stored));
          setContractFolders({ ...stored });
          if (!isSilent) {
            showToast('⚠️ Se detectaron y desvincularon carpetas que fueron eliminadas en Google Drive.');
          }
        }

        // 2. Real-time verification of documents uploaded to Google Drive
        if (documents && Array.isArray(documents)) {
          for (const doc of documents) {
            const driveId =
              doc.driveFileId ||
              (doc.fileUrl ? extractGoogleDriveId(doc.fileUrl) : null) ||
              (doc.fileData && doc.fileData.includes('drive.google.com') ? extractGoogleDriveId(doc.fileData) : null);

            if (driveId) {
              let docExists = checkedFolderIds.get(driveId);
              if (docExists === undefined) {
                docExists = await googleWorkspaceService.checkFileOrFolderExists(driveId);
                checkedFolderIds.set(driveId, docExists);
              }

              if (!docExists) {
                // The user deleted the file in Google Drive! Purge from records
                onDeleteDocument(doc.id);
                showToast(`⚠️ El archivo "${doc.title || doc.fileName}" fue eliminado en Google Drive y se desvinculó.`);
              }
            }
          }
        }

        if (!isSilent) {
          showToast('✓ Sincronización en tiempo real con Google Drive verificada.');
        }
      } catch (err) {
        console.warn('Notice in verifyDriveIntegrity:', err);
      } finally {
        if (!isSilent) setIsVerifyingDrive(false);
      }
    },
    [documents, onDeleteDocument]
  );

  const verifyDriveIntegrityRef = useRef(verifyDriveIntegrity);
  verifyDriveIntegrityRef.current = verifyDriveIntegrity;

  // Auto-verify stored folders and documents in real time:
  // - On mount
  // - When the user focuses the window (returns from Google Drive tab)
  // - Periodically every 20 seconds
  useEffect(() => {
    verifyDriveIntegrityRef.current(true);

    const handleFocus = () => {
      verifyDriveIntegrityRef.current(true);
    };
    window.addEventListener('focus', handleFocus);

    const interval = setInterval(() => {
      verifyDriveIntegrityRef.current(true);
    }, 20000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, []);

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
      const matchedEq = (equipments || []).find(
        (e) =>
          e &&
          ((it.equipmentId && e.id === it.equipmentId) ||
            (it.code && e.code && normalizeClean(e.code) === normalizeClean(it.code)) ||
            (it.name && e.name && normalizeClean(e.name) === normalizeClean(it.name)))
      );
      const targetEquipmentId = it.equipmentId || it.id || matchedEq?.id || it.code || it.name;
      if (!targetEquipmentId) return;

      const matchingDocs = findMatchingCatalogDocs(
        {
          id: targetEquipmentId,
          equipmentId: targetEquipmentId,
          code: it.code || matchedEq?.code,
          name: it.name || it.equipmentName || matchedEq?.name,
          brand: it.brand || matchedEq?.brand,
          model: it.model || matchedEq?.model,
        },
        documents
      );
      if (matchingDocs.length === 0 || !onSaveDocument) return;

      matchingDocs.forEach((doc) => {
        if (!doc) return;
        // Already linked to this equipment: never create duplicate links.
        if (doc.equipmentId === targetEquipmentId) return;
        const alreadyLinked = (documents || []).some(
          (existing) =>
            existing &&
            existing.equipmentId === targetEquipmentId &&
            existing.docType === doc.docType &&
            (existing.title || existing.fileName) === (doc.title || doc.fileName) &&
            (existing.notes || '').includes('Vinculado automáticamente desde la Base de Datos del Catálogo')
        );
        if (alreadyLinked) return;

        const linkedDoc: TechnicalDocument = {
          ...doc,
          id: `doc-link-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          equipmentId: targetEquipmentId,
          equipmentCode: it.code || matchedEq?.code || doc.equipmentCode,
          equipmentName: it.name || it.equipmentName || matchedEq?.name || doc.equipmentName,
          uploadDate: new Date().toISOString().split('T')[0],
          notes: `Vinculado automáticamente desde la Base de Datos del Catálogo. ${doc.notes || ''}`.trim(),
        };
        onSaveDocument(linkedDoc);
        linkedCount++;
      });
    });

    if (linkedCount > 0) {
      showToast(`✓ Se vincularon ${linkedCount} documentos del Catálogo Maestro`);
    } else {
      showToast('✓ La documentación ya está vinculada');
    }
  };

  // Open the modal to choose location and name before creating or linking the contract folder
  const handleOpenCreateContractFolderModal = async (exp: UnifiedExpediente) => {
    // Ensure the contract/direct-OC equipment documentation is linked from the
    // master catalog before opening/creating its Drive folder.
    handleAutoLinkAllCatalogDocs(exp.items || []);
    const rawContractName = `${exp.processNumber} - ${exp.clientName}`.trim();
    const folderName = rawContractName.replace(/[\\/:*?"<>|]/g, '-').trim() || `Contrato-${exp.id}`;
    setFolderModalTarget(exp);
    setFolderModalMode('select_existing');
    setSelectedExistingFolder(null);
    setExistingFolderDirectInput('');
    setFolderSearchFilter('');
    setFolderModalName(folderName);
    setFolderModalLocation('documentacion');
    setFolderModalCustomParentId('');
    setFolderModalAutoSubfolders(true);
    loadAvailableDriveFolders(false);
  };

  // Link an already existing Google Drive folder directly to this contract
  const handleLinkExistingContractFolder = async (
    exp: UnifiedExpediente,
    folderId: string,
    folderName: string,
    webViewLink?: string
  ) => {
    const rawId = folderId.trim();
    if (!rawId) {
      showToast('⚠️ Por favor ingrese o seleccione una carpeta de Google Drive');
      return;
    }
    const realFolderId = extractGoogleDriveId(rawId) || rawId;
    const resolvedName = folderName.trim() || `Carpeta ${exp.processNumber}`;
    const resolvedWebLink = webViewLink || `https://drive.google.com/drive/folders/${realFolderId}`;

    setFolderModalTarget(null);
    setCreatingFolderForContract((prev) => ({ ...prev, [exp.id]: true }));

    try {
      if (googleWorkspaceService && typeof (googleWorkspaceService as any).ensureInitialized === 'function') {
        try {
          await (googleWorkspaceService as any).ensureInitialized();
        } catch (_) {}
      }

      // Check subfolders inside this existing folder for equipment matching
      const equipmentSubfolders: Record<string, { folderId: string; folderName: string; webViewLink?: string }> = {};
      if (googleWorkspaceService.isConnected()) {
        try {
          const filesInFolder = await googleWorkspaceService.listUserDriveFiles({
            folderId: realFolderId,
            pageSize: 100,
          });
          const subfolders = (filesInFolder || []).filter(
            (f) => f.mimeType === 'application/vnd.google-apps.folder'
          );

          (exp.items || []).forEach((it: any) => {
            const eqKey = it.id || it.code;
            const itCodeNorm = (it.code || '').toString().toLowerCase().trim();
            const itNameNorm = (it.name || '').toString().toLowerCase().trim();
            const itModelNorm = (it.model || '').toString().toLowerCase().trim();

            const matchedSub = subfolders.find((sf) => {
              const sfNorm = sf.name.toLowerCase();
              return (
                (itCodeNorm && itCodeNorm.length >= 3 && sfNorm.includes(itCodeNorm)) ||
                (itModelNorm && itModelNorm.length >= 3 && sfNorm.includes(itModelNorm)) ||
                (itNameNorm && itNameNorm.length >= 5 && sfNorm.includes(itNameNorm))
              );
            });

            if (matchedSub) {
              const subObj = {
                folderId: matchedSub.id,
                folderName: matchedSub.name,
                webViewLink: matchedSub.webViewLink,
              };
              equipmentSubfolders[eqKey] = subObj;
              if (it.code) equipmentSubfolders[it.code.toLowerCase().trim()] = subObj;
              if (it.id) equipmentSubfolders[it.id.toLowerCase().trim()] = subObj;
            }
          });
        } catch (subErr) {
          console.warn('Subfolder scanning warning:', subErr);
        }
      }

      const contractRecord: ContractFolderRecord = {
        folderId: realFolderId,
        folderName: resolvedName,
        webViewLink: resolvedWebLink,
        equipmentSubfolders,
      };

      saveStoredContractFolder(exp.processNumber, contractRecord);
      saveStoredContractFolder(exp.id, contractRecord);
      setContractFolders(getStoredContractFolders());

      showToast(`✅ Carpeta "${resolvedName}" vinculada correctamente al contrato`);
    } catch (err: any) {
      showToast(`⚠️ Error al vincular carpeta: ${err?.message || 'Error'}`);
    } finally {
      setCreatingFolderForContract((prev) => ({ ...prev, [exp.id]: false }));
    }
  };

  const loadAvailableDriveFolders = async (forceConnect = false) => {
    setIsLoadingAvailableFolders(true);
    try {
      if (forceConnect && !googleWorkspaceService.isConnected()) {
        await googleWorkspaceService.connectGoogleWorkspace();
      }
      let folders: DriveFileItem[] = [];
      if (googleWorkspaceService.isConnected()) {
        folders = await googleWorkspaceService.listDriveFolders();
      }

      // Also combine with stored contract folders so users always have instant access to established locations
      const stored = getStoredContractFolders();
      const combinedMap = new Map<string, DriveFileItem>();
      (folders || []).forEach((f) => combinedMap.set(f.id, f));

      Object.values(stored).forEach((rec) => {
        if (rec && rec.folderId && !combinedMap.has(rec.folderId)) {
          combinedMap.set(rec.folderId, {
            id: rec.folderId,
            name: rec.folderName || 'Carpeta de Contrato',
            mimeType: 'application/vnd.google-apps.folder',
            webViewLink: rec.webViewLink,
          });
        }
      });

      setAvailableDriveFolders(Array.from(combinedMap.values()));
    } catch (e) {
      console.warn('Error loading drive folders:', e);
    } finally {
      setIsLoadingAvailableFolders(false);
    }
  };

  // Confirm and execute creation of contract folder
  const handleConfirmCreateContractFolder = async () => {
    if (!folderModalTarget) return;
    const exp = folderModalTarget;
    const customName = folderModalName.trim() || `${exp.processNumber} - ${exp.clientName}`.trim();
    const autoSubs = folderModalAutoSubfolders;
    const loc = folderModalLocation;
    const customParent = folderModalCustomParentId;

    setFolderModalTarget(null);

    let resolvedParentId: string | undefined = undefined;
    try {
      if (loc === 'documentacion') {
        const masterFolder = await googleWorkspaceService.findOrCreateMasterDocFolder('DOCUMENTACION');
        resolvedParentId = masterFolder.id;
      } else if (loc === 'contratos') {
        const masterFolder = await googleWorkspaceService.findOrCreateMasterDocFolder('DOCUMENTACION');
        const cFolder = await googleWorkspaceService.findOrCreateMasterDocFolder('CONTRATOS', masterFolder.id);
        resolvedParentId = cFolder.id;
      } else if ((loc === 'custom' || loc === 'link') && customParent) {
        resolvedParentId = extractGoogleDriveId(customParent) || customParent.trim();
      } else if (loc === 'root') {
        resolvedParentId = undefined;
      }
    } catch (e) {
      console.warn('Parent resolution warning:', e);
    }

    await handleCreateContractDriveFolder(exp, autoSubs, resolvedParentId, customName);
  };

  // Create Google Drive folder for this Contract / Process and subfolders for each equipment
  const handleCreateContractDriveFolder = async (
    exp: UnifiedExpediente,
    autoCreateSubfolders = true,
    parentFolderId?: string,
    customName?: string
  ) => {
    const rawContractName = customName || `${exp.processNumber} - ${exp.clientName}`.trim();
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
      const contractFolderItem = await googleWorkspaceService.createDriveFolder(folderName, parentFolderId);

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
      const isAuthErr =
        err?.message?.includes('401') ||
        err?.message?.includes('expir') ||
        err?.message?.includes('authentication') ||
        err?.message?.includes('credentials') ||
        err?.message?.includes('Debe conectar');

      if (isAuthErr) {
        googleWorkspaceService.clearAuth();
        showToast('⚠️ Sesión de Google expirada. Reconectando cuenta...');
        try {
          await googleWorkspaceService.connectGoogleWorkspace();
          // Retry automatically after re-authentication
          const retryRecord = await handleCreateContractDriveFolder(exp, autoCreateSubfolders, parentFolderId, customName);
          return retryRecord;
        } catch (reauthErr) {
          showToast('⚠️ Sesión de Google expirada. Por favor conecte su cuenta de Google en la barra superior.');
          return null;
        }
      }

      showToast(`⚠️ Error al crear carpeta en Google Drive: ${err?.message || 'Verifique conexión'}`);
      return null;
    } finally {
      setCreatingFolderForContract((prev) => ({ ...prev, [exp.id]: false }));
    }
  };

  // Verify if a contract folder still exists in Google Drive (detect deletion)
  const handleVerifyContractFolder = async (exp: UnifiedExpediente) => {
    const cFolder =
      contractFolders[exp.processNumber.toLowerCase().trim()] ||
      contractFolders[exp.id.toLowerCase().trim()];
    if (!cFolder) return;

    setCheckingFolderId((prev) => ({ ...prev, [cFolder.folderId]: true }));
    try {
      const exists = await googleWorkspaceService.checkFileOrFolderExists(cFolder.folderId);
      if (!exists) {
        removeStoredContractFolder(exp.processNumber);
        removeStoredContractFolder(exp.id);
        setContractFolders(getStoredContractFolders());
        showToast(`⚠️ La carpeta "${cFolder.folderName}" fue eliminada en Google Drive. Se ha desvinculado para permitir crearla nuevamente.`);
      } else {
        showToast(`✓ La carpeta "${cFolder.folderName}" está activa y verificada en Google Drive.`);
      }
    } catch (e: any) {
      showToast(`Aviso al verificar carpeta: ${e?.message || 'Error'}`);
    } finally {
      setCheckingFolderId((prev) => ({ ...prev, [cFolder.folderId]: false }));
    }
  };

  // Delete contract folder directly in Google Drive AND remove from local state
  const handleDeleteContractFolderFromDrive = async (exp: UnifiedExpediente, cFolder: ContractFolderRecord) => {
    if (!cFolder?.folderId) return;
    setIsDeletingDriveFolder(true);
    try {
      if (googleWorkspaceService.isConnected()) {
        try {
          await googleWorkspaceService.deleteDriveFile(cFolder.folderId);
        } catch (driveErr) {
          console.warn('Google Drive deletion warning:', driveErr);
        }
      }
      removeStoredContractFolder(exp.processNumber);
      removeStoredContractFolder(exp.id);
      setContractFolders(getStoredContractFolders());
      showToast(`✓ Carpeta "${cFolder.folderName}" eliminada de Google Drive y del sistema.`);
    } catch (e: any) {
      removeStoredContractFolder(exp.processNumber);
      removeStoredContractFolder(exp.id);
      setContractFolders(getStoredContractFolders());
      showToast(`✓ Carpeta desvinculada: ${e?.message || ''}`);
    } finally {
      setIsDeletingDriveFolder(false);
      setContractFolderToDelete(null);
    }
  };

  // Scan an equipment's Drive folder to detect any files uploaded manually
  const scanEquipmentDriveFolder = useCallback(
    async (
      exp: UnifiedExpediente,
      item: any,
      eqSubfolder: any,
      showFeedback = false
    ) => {
      if (!eqSubfolder?.folderId || !googleWorkspaceService.isConnected()) return [];
      const eqKey = item.id || item.code || `${exp.id}-${item.name}`;
      setScanningDriveFolderId((prev) => ({ ...prev, [eqSubfolder.folderId]: true }));
      try {
        const realFolderId = extractGoogleDriveId(eqSubfolder.webViewLink || '') || eqSubfolder.folderId;
        let driveItems = await googleWorkspaceService.listUserDriveFiles({
          folderId: realFolderId,
          pageSize: 100,
        });

        if ((!driveItems || driveItems.length === 0) && realFolderId !== eqSubfolder.folderId) {
          driveItems = await googleWorkspaceService.listUserDriveFiles({
            folderId: eqSubfolder.folderId,
            pageSize: 100,
          });
        }

        // Fallback: If 0 files found in specific subfolder, also check if contract folder has matching subfolder
        if (!driveItems || driveItems.length === 0) {
          const contractRecord =
            contractFolders[exp.processNumber.toLowerCase().trim()] ||
            contractFolders[exp.id.toLowerCase().trim()];
          if (contractRecord?.folderId) {
            const contractDriveItems = await googleWorkspaceService.listUserDriveFiles({
              folderId: contractRecord.folderId,
              pageSize: 80,
            });
            const matchingSub = (contractDriveItems || []).find(
              (f) =>
                f.mimeType === 'application/vnd.google-apps.folder' &&
                ((item.code && f.name.toLowerCase().includes(String(item.code).toLowerCase())) ||
                  (item.model && f.name.toLowerCase().includes(String(item.model).toLowerCase())))
            );
            if (matchingSub && matchingSub.id !== realFolderId) {
              const subItems = await googleWorkspaceService.listUserDriveFiles({
                folderId: matchingSub.id,
                pageSize: 100,
              });
              if (subItems && subItems.length > 0) {
                driveItems = subItems;
              }
            }
          }
        }

        const filesOnly = (driveItems || []).filter(
          (f) => f.mimeType !== 'application/vnd.google-apps.folder'
        );

        const eqIdForDoc = item.equipmentId || item.id || item.code;

        // Check which files are not yet registered in app's documents
        const unlinked = filesOnly.filter((f) => {
          const alreadyLinked = (documents || []).some((d) => {
            if (d.driveFileId && d.driveFileId === f.id) return true;
            const sameName = (d.fileName || '').trim().toLowerCase() === (f.name || '').trim().toLowerCase();
            const sameEq = d.equipmentId === eqIdForDoc || (item.code && d.equipmentCode === item.code);
            return sameName && sameEq;
          });
          return !alreadyLinked;
        });

        setUnclassifiedDriveFiles((prev) => ({
          ...prev,
          [eqKey]: unlinked,
          [eqSubfolder.folderId]: unlinked,
          [realFolderId]: unlinked,
          ...(item.code ? { [item.code]: unlinked } : {}),
          ...(item.id ? { [item.id]: unlinked } : {}),
        }));

        if (showFeedback) {
          if (unlinked.length > 0) {
            showToast(`📥 Se detectó ${unlinked.length} archivo(s) en Google Drive pendientes de clasificar.`);
            setClassifyDriveModalTarget({
              exp,
              item,
              eqSubfolder,
              files: unlinked,
            });
          } else if (filesOnly.length > 0) {
            showToast(`✓ Los ${filesOnly.length} archivo(s) en Drive ya están vinculados en este equipo.`);
          } else {
            showToast(`No se encontraron archivos en la carpeta de Drive "${eqSubfolder.folderName}".`);
          }
        }

        return unlinked;
      } catch (err: any) {
        if (showFeedback) {
          showToast(`Aviso al escanear carpeta en Drive: ${err?.message || 'Error'}`);
        }
        return [];
      } finally {
        setScanningDriveFolderId((prev) => ({ ...prev, [eqSubfolder.folderId]: false }));
      }
    },
    [documents]
  );

  // Link an unclassified Drive file as an official TechnicalDocument
  const handleLinkDriveFileAsDocument = async (
    exp: UnifiedExpediente,
    item: any,
    file: DriveFileItem,
    chosenDocType: string,
    invimaNum?: string,
    valUntil?: string
  ) => {
    if (!onSaveDocument) return;
    const eqIdForDoc = item.equipmentId || item.id || item.code;
    const matchedEq = findEquipmentMatch(item);
    setIsLinkingFile((prev) => ({ ...prev, [file.id]: true }));

    try {
      const numSize = typeof file.size === 'number' ? file.size : Number(file.size);
      const formattedSize = !isNaN(numSize) && numSize > 0
        ? `${(numSize / (1024 * 1024)).toFixed(1)} MB`
        : 'Google Drive';

      const contractEquipmentDocId = `contract-${exp.id}-${item.id || item.code || ''}`;

      const newDoc: TechnicalDocument = {
        id: `doc-drive-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        equipmentId: eqIdForDoc,
        equipmentCode: item.code || matchedEq?.code,
        equipmentName: `${item.name} (${item.brand || matchedEq?.brand || ''})`.trim(),
        docType: chosenDocType,
        title: `${chosenDocType} - ${item.name}`,
        fileName: file.name,
        fileSize: formattedSize,
        fileType: file.mimeType || 'application/pdf',
        fileUrl: file.webViewLink,
        downloadUrl: file.webViewLink,
        isCloudLink: true,
        cloudProvider: 'google_drive',
        driveFileId: file.id,
        uploadDate: new Date().toISOString().split('T')[0],
        status: 'Vigente',
        invimaNumber: chosenDocType === 'Registro INVIMA' ? invimaNum?.trim() || matchedEq?.invimaRecordNumber : undefined,
        validUntil: chosenDocType === 'Registro INVIMA' ? valUntil || matchedEq?.invimaExpiryDate : undefined,
        notes: `[Contrato: ${exp.processNumber} - ${exp.clientName}] Archivo subido a Google Drive y clasificado como ${chosenDocType}.`,
      };

      onSaveDocument(newDoc);

      // Create contract-specific document so it appears directly under this contract
      const contractDoc: TechnicalDocument = {
        ...newDoc,
        id: `doc-contract-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        equipmentId: contractEquipmentDocId,
      };
      onSaveDocument(contractDoc);

      // Auto-replicate to Master Catalog if item matches master catalog
      if (matchedEq && matchedEq.id && matchedEq.id !== eqIdForDoc) {
        const masterDoc: TechnicalDocument = {
          ...newDoc,
          id: `doc-master-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          equipmentId: matchedEq.id,
          equipmentCode: matchedEq.code,
          equipmentName: `${matchedEq.name} (${matchedEq.brand})`,
          notes: `Documento ${chosenDocType} vinculado desde Google Drive (Contrato: ${exp.processNumber}).`,
        };
        onSaveDocument(masterDoc);
      }

      // Remove from unclassified files across all key mappings
      const eqKey = item.id || item.code || `${exp.id}-${item.name}`;
      const folderId = classifyDriveModalTarget?.eqSubfolder?.folderId;
      setUnclassifiedDriveFiles((prev) => {
        const next = { ...prev };
        const cleanList = (arr: DriveFileItem[] = []) => arr.filter((f) => f.id !== file.id);
        if (folderId) next[folderId] = cleanList(next[folderId]);
        next[eqKey] = cleanList(next[eqKey]);
        if (item.code) next[item.code] = cleanList(next[item.code]);
        if (item.id) next[item.id] = cleanList(next[item.id]);
        return next;
      });

      showToast(`✓ "${file.name}" vinculado como ${chosenDocType} exitosamente.`);

      // If modal is open, update remaining files in modal
      setClassifyDriveModalTarget((prev) => {
        if (!prev) return null;
        const remaining = prev.files.filter((f) => f.id !== file.id);
        if (remaining.length === 0) return null;
        return { ...prev, files: remaining };
      });
    } catch (e: any) {
      showToast(`Error al vincular archivo: ${e?.message || 'Error'}`);
    } finally {
      setIsLinkingFile((prev) => ({ ...prev, [file.id]: false }));
    }
  };

  // Verify if an equipment subfolder still exists in Google Drive AND scan for files
  const handleVerifyEquipmentFolder = async (exp: UnifiedExpediente, item: any, eqSubfolder: any) => {
    if (!eqSubfolder || !eqSubfolder.folderId) return;
    setCheckingFolderId((prev) => ({ ...prev, [eqSubfolder.folderId]: true }));
    try {
      const exists = await googleWorkspaceService.checkFileOrFolderExists(eqSubfolder.folderId);
      if (!exists) {
        const eqKey = item.id || item.code;
        removeStoredContractFolder(exp.processNumber, eqKey);
        removeStoredContractFolder(exp.id, eqKey);
        setContractFolders(getStoredContractFolders());
        showToast(`⚠️ La subcarpeta "${eqSubfolder.folderName}" fue eliminada en Google Drive. Se ha desvinculado para permitir crearla nuevamente.`);
      } else {
        // Active Drive scan for manually uploaded files
        await scanEquipmentDriveFolder(exp, item, eqSubfolder, true);
      }
    } catch (e: any) {
      showToast(`Aviso al verificar subcarpeta: ${e?.message || 'Error'}`);
    } finally {
      setCheckingFolderId((prev) => ({ ...prev, [eqSubfolder.folderId]: false }));
    }
  };

  // Delete equipment subfolder directly in Google Drive AND remove from local state
  const handleDeleteEquipmentFolderFromDrive = async (exp: UnifiedExpediente, item: any, eqSubfolder: any) => {
    if (!eqSubfolder?.folderId) return;
    const eqKey = item.id || item.code;
    setIsDeletingDriveFolder(true);
    try {
      if (googleWorkspaceService.isConnected()) {
        try {
          await googleWorkspaceService.deleteDriveFile(eqSubfolder.folderId);
        } catch (driveErr) {
          console.warn('Google Drive equipment folder deletion warning:', driveErr);
        }
      }
      removeStoredContractFolder(exp.processNumber, eqKey);
      removeStoredContractFolder(exp.id, eqKey);
      setContractFolders(getStoredContractFolders());
      showToast(`✓ Subcarpeta "${eqSubfolder.folderName}" eliminada de Google Drive y del sistema.`);
    } catch (e: any) {
      removeStoredContractFolder(exp.processNumber, eqKey);
      removeStoredContractFolder(exp.id, eqKey);
      setContractFolders(getStoredContractFolders());
      showToast(`✓ Subcarpeta desvinculada: ${e?.message || ''}`);
    } finally {
      setIsDeletingDriveFolder(false);
      setEquipmentFolderToDelete(null);
    }
  };

  // Create an individual equipment subfolder inside the contract's Drive folder
  // STRICT RULE: Requires contract folder to already exist!
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
      showToast(`⚠️ Debe crear primero la carpeta del contrato arriba para organizar las subcarpetas de los equipos.`);
      return null;
    }

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
            cloudProv = 'google_drive';
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
          invimaNumber: mDoc.invimaNumber || matchedEq.invimaRecordNumber || '',
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

        {/* Contract Filter Selector & Drive Real-time Sync Button */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => verifyDriveIntegrity(false)}
            disabled={isVerifyingDrive}
            className="h-[28px] px-2.5 rounded-lg bg-[#15253d] hover:bg-[#20375a] text-cyan-300 hover:text-white border border-[#334d6e] text-[10.5px] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Verificar en tiempo real con Google Drive si se eliminaron carpetas o archivos en la nube"
          >
            <RefreshCw className={`w-3 h-3 text-cyan-400 ${isVerifyingDrive ? 'animate-spin' : ''}`} />
            <span>Sincronizar Drive</span>
          </button>

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
                              <span className="truncate max-w-[140px] sm:max-w-[200px]" title={cFolder.folderName}>
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
                              <button
                                type="button"
                                onClick={() => handleVerifyContractFolder(exp)}
                                disabled={checkingFolderId[cFolder.folderId]}
                                className="text-slate-400 hover:text-cyan-300 transition p-0.5 cursor-pointer"
                                title="Verificar si la carpeta aún existe en Google Drive"
                              >
                                <RefreshCw className={`w-2.5 h-2.5 ${checkingFolderId[cFolder.folderId] ? 'animate-spin text-cyan-400' : ''}`} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenCreateContractFolderModal(exp)}
                                className="text-slate-400 hover:text-amber-300 transition p-0.5 cursor-pointer"
                                title="Cambiar o configurar la ubicación de esta carpeta en Google Drive"
                              >
                                <FolderPlus className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setContractFolderToDelete({ exp, cFolder })}
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
                                onClick={() => handleOpenCreateContractFolderModal(exp)}
                                disabled={creatingFolderForContract[exp.id]}
                                className="h-[28px] px-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[10.5px] transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                title={`Crear carpeta de este proceso en Google Drive: "${exp.processNumber} - ${exp.clientName}" con subcarpetas para cada equipo`}
                              >
                                {creatingFolderForContract[exp.id] ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <FolderPlus className="w-3.5 h-3.5" />
                                )}
                                <span>📁 Carpeta Drive: Vincular / Crear</span>
                              </button>
                            )
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

                        const procNumLower = exp.processNumber.toLowerCase().trim();

                        // Documents specifically copied or uploaded for this contract
                        const copiedDocsForThisContract = (documents || []).filter((d) => {
                          if (!d) return false;
                          if (d.equipmentId === contractEquipmentDocId) return true;
                          const dNotes = (d.notes || '').toLowerCase();
                          const matchesProc = dNotes.includes(procNumLower) || dNotes.includes(`contrato ${procNumLower}`);
                          if (d.equipmentId === eqIdForDoc && matchesProc) return true;
                          if (
                            matchesProc &&
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
                                (!d.notes || (!d.notes.toLowerCase().includes('copia para contrato') && !d.notes.toLowerCase().includes(procNumLower)))
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

                        const normalizeDocType = (t: string = '') =>
                          t.toLowerCase().replace(/^(reg\.|registro)\s*/i, '').replace(/técnica/i, 'tecnica').trim();

                        // Combined effective docs: contract docs prioritized, fallback to attached docs
                        const effectiveDocsMap = new Map<string, TechnicalDocument>();
                        copiedDocsForThisContract.forEach((d) => {
                          const norm = normalizeDocType(d.docType);
                          effectiveDocsMap.set(norm, d);
                        });
                        attachedDocs.forEach((d) => {
                          const norm = normalizeDocType(d.docType);
                          if (!effectiveDocsMap.has(norm)) {
                            effectiveDocsMap.set(norm, d);
                          }
                        });
                        const effectiveDocs = Array.from(effectiveDocsMap.values());

                        // Available master docs whose document type is NOT yet present in effectiveDocs for this contract equipment
                        const missingMasterDocs = masterDocsForEq.filter((mDoc) => {
                          const mType = normalizeDocType(mDoc.docType);
                          return !effectiveDocs.some((eDoc) => normalizeDocType(eDoc.docType) === mType);
                        });

                        return (
                          <div
                            key={`exp-item-row-${item.id || idx}`}
                            className={`rounded-lg p-2.5 transition space-y-1.5 ${
                              isPending
                                ? 'bg-amber-950/15 border border-amber-500/30'
                                : 'bg-[#15253d]/60 border border-[#334d6e]/60'
                            }`}
                          >
                            {/* TOP HEADER ROW: Equipment Identity & Overview + Drive Folder Toolbar */}
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 pb-2 border-b border-[#334d6e]/40">
                              {/* Left: Code, Brand, Name, Model, Quantity, Status Badge */}
                              <div className="flex items-center gap-2 flex-wrap min-w-0">
                                <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded border ${
                                  exp.isDirectOC 
                                    ? 'bg-purple-950/80 border-purple-500/50 text-purple-300' 
                                    : 'bg-[#192b45] border-[#334d6e] text-cyan-300'
                                }`}>
                                  {itemCode}
                                </span>
                                <span className="text-[10.5px] font-black text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded border border-blue-500/30">
                                  {itemBrand}
                                </span>
                                <h4 className="text-xs font-bold text-white truncate max-w-[280px] sm:max-w-[420px]" title={item.name}>
                                  {item.name}
                                </h4>
                                <span className="text-[11px] text-slate-400">
                                  Mod: <strong className="text-slate-200">{itemModel}</strong>
                                </span>
                                <span className="text-[10px] font-bold text-slate-300 bg-slate-800/90 px-1.5 py-0.5 rounded border border-slate-700">
                                  Cant: {item.quantity || 1}
                                </span>

                                {isPending ? (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1 shadow-2xs">
                                    <AlertTriangle className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                    <span>⚠️ Falta {missingTypes.join(' y ')}</span>
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1 shadow-2xs">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                                    <span>✓ Documentación Completa</span>
                                  </span>
                                )}
                              </div>

                              {/* Right: Drive Folder Management & Extra Action Buttons */}
                              <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                                {/* Drive Subfolder Toolbar */}
                                {eqSubfolder ? (
                                  <div className="flex items-center gap-1 bg-[#101c2e] p-1 rounded-lg border border-cyan-800/50 shadow-2xs">
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-700/40 text-[10px] font-semibold text-cyan-300 max-w-[180px]">
                                      <Folder className="w-3 h-3 text-cyan-400 shrink-0" />
                                      <span className="truncate" title={`Carpeta de este equipo: ${eqSubfolder.folderName}`}>
                                        {eqSubfolder.folderName}
                                      </span>
                                      {eqSubfolder.webViewLink && (
                                        <a
                                          href={eqSubfolder.webViewLink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-cyan-400 hover:text-white transition p-0.5"
                                          title="Abrir carpeta en Google Drive"
                                        >
                                          <ExternalLink className="w-2.5 h-2.5" />
                                        </a>
                                      )}
                                    </div>

                                    {/* Refresh / Check Drive */}
                                    <button
                                      type="button"
                                      onClick={() => handleVerifyEquipmentFolder(exp, item, eqSubfolder)}
                                      disabled={checkingFolderId[eqSubfolder.folderId]}
                                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition cursor-pointer"
                                      title="Verificar carpeta en Google Drive"
                                    >
                                      <RefreshCw className={`w-3 h-3 ${checkingFolderId[eqSubfolder.folderId] ? 'animate-spin text-cyan-400' : ''}`} />
                                    </button>

                                    {/* Prominent Detectar en Drive Button */}
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        showToast(`Buscando archivos en Google Drive en "${eqSubfolder.folderName}"...`);
                                        await scanEquipmentDriveFolder(exp, item, eqSubfolder, true);
                                      }}
                                      disabled={checkingFolderId[eqSubfolder.folderId] || scanningDriveFolderId[eqSubfolder.folderId]}
                                      className="h-[24px] px-2.5 rounded bg-gradient-to-r from-amber-500/20 to-amber-600/30 hover:from-amber-500/30 hover:to-amber-600/40 border border-amber-400/50 text-[10px] font-bold text-amber-200 transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                                      title="Detectar y clasificar archivos subidos a la carpeta de Drive de este equipo"
                                    >
                                      <Sparkles className={`w-3 h-3 text-amber-300 shrink-0 ${scanningDriveFolderId[eqSubfolder.folderId] ? 'animate-spin' : ''}`} />
                                      <span>Detectar Drive</span>
                                    </button>

                                    {/* Delete subfolder */}
                                    {!isReadOnly && (
                                      <button
                                        type="button"
                                        onClick={() => setEquipmentFolderToDelete({ exp, item, eqSubfolder })}
                                        className="p-1 rounded hover:bg-rose-950/70 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                                        title="Eliminar esta subcarpeta de Google Drive"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  !isReadOnly && (
                                    contractFolder ? (
                                      <button
                                        type="button"
                                        onClick={() => handleCreateEquipmentSubfolderInContract(exp, item, matchedEq)}
                                        className="h-[26px] px-2.5 rounded-lg bg-cyan-700/80 hover:bg-cyan-600 text-white text-[10px] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                        title="Crear carpeta de este equipo dentro del contrato en Google Drive"
                                      >
                                        <FolderPlus className="w-3 h-3 text-cyan-200" />
                                        <span>+ Carpeta Equipo</span>
                                      </button>
                                    ) : (
                                      <span
                                        className="h-[24px] inline-flex items-center gap-1 px-2 rounded bg-slate-800/80 border border-slate-700 text-[10px] font-medium text-slate-400"
                                        title="Primero debe crear la carpeta del contrato arriba para organizar las subcarpetas de los equipos"
                                      >
                                        <Lock className="w-2.5 h-2.5 text-amber-400" />
                                        <span>Requiere Carpeta Contrato</span>
                                      </span>
                                    )
                                  )
                                )}

                                {/* Unclassified Drive Files Notification Button */}
                                {(() => {
                                  const eqKey = item.id || item.code || `${exp.id}-${item.name}`;
                                  const unlinked =
                                    (eqSubfolder?.folderId ? unclassifiedDriveFiles[eqSubfolder.folderId] : null) ||
                                    unclassifiedDriveFiles[eqKey] ||
                                    (item.code ? unclassifiedDriveFiles[item.code] : null) ||
                                    (item.id ? unclassifiedDriveFiles[item.id] : null) ||
                                    [];
                                  if (unlinked.length === 0) return null;
                                  return (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setClassifyDriveModalTarget({
                                          exp,
                                          item,
                                          eqSubfolder,
                                          files: unlinked,
                                        })
                                      }
                                      className="h-[24px] px-2.5 rounded-lg bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400 text-amber-200 text-[10px] font-black transition flex items-center gap-1.5 cursor-pointer shadow-xs animate-pulse"
                                      title={`Se detectó ${unlinked.length} archivo(s) en Google Drive (${unlinked.map((f) => f.name).join(', ')}). Clic para asignar.`}
                                    >
                                      <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
                                      <span>📥 {unlinked.length} en Drive sin clasificar - Asignar</span>
                                    </button>
                                  );
                                })()}

                                {/* Integrated Serials & Hoja de Vida Button */}
                                {(linkedOCContract || exp.ocContractData) && (
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
                                    className="h-[24px] px-2.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/35 text-purple-200 border border-purple-500/40 text-[10px] font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
                                    title="Gestionar seriales físicos, plaqueta y hoja de vida para este equipo"
                                  >
                                    <Tag className="w-3 h-3 text-purple-300" />
                                    <span>🏷️ Seriales & H. Vida</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Base Maestra Detection Banner - Only if there are missing document types */}
                            {missingMasterDocs.length > 0 && (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-indigo-950/80 border border-indigo-500/50 text-indigo-200 text-[10.5px] shadow-sm animate-fadeIn">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Sparkles className="w-4 h-4 text-yellow-300 shrink-0" />
                                  <div className="min-w-0">
                                    <span className="font-bold text-white">Base Maestra detectada:</span>{' '}
                                    <strong>{matchedEq?.brand} {matchedEq?.model}</strong>{' '}
                                    {baseMaestraDriveFolder ? (
                                      <span className="text-cyan-300 font-mono text-[10px]">
                                        (Carpeta: "{baseMaestraDriveFolder.name}")
                                      </span>
                                    ) : null}{' '}
                                    — tiene <strong>{missingMasterDocs.length} documento(s)</strong> disponibles en Base Maestra ({missingMasterDocs.map((d) => d.docType).join(', ')}).
                                  </div>
                                </div>
                                {!isReadOnly && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopyDocumentsFromMaster(exp, item, matchedEq!, missingMasterDocs, contractEquipmentDocId)}
                                    disabled={copyingForEquipment[contractEquipmentDocId]}
                                    className="px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10.5px] transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 shadow-xs active:scale-95"
                                    title="Copiar los documentos faltantes desde Base Maestra a este contrato"
                                  >
                                    {copyingForEquipment[contractEquipmentDocId] ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                    <span>📋 Copiar a este Contrato ({missingMasterDocs.length})</span>
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Base Maestra Already Complete Indicator */}
                            {missingMasterDocs.length === 0 && masterDocsForEq.length > 0 && (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-[10px]">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span className="truncate">
                                    ✓ Documentación sincronizada con Base Maestra ({effectiveDocs.length} archivo(s): {effectiveDocs.map((d) => d.docType).join(', ')}).
                                  </span>
                                </div>
                                {!isReadOnly && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopyDocumentsFromMaster(exp, item, matchedEq!, masterDocsForEq, contractEquipmentDocId)}
                                    disabled={copyingForEquipment[contractEquipmentDocId]}
                                    className="px-2 py-0.5 rounded bg-emerald-900/50 hover:bg-emerald-800 text-emerald-300 hover:text-white border border-emerald-500/40 font-bold text-[9.5px] transition flex items-center gap-1 cursor-pointer shrink-0"
                                    title="Re-sincronizar o re-copiar desde Base Maestra"
                                  >
                                    <RefreshCw className={`w-2.5 h-2.5 ${copyingForEquipment[contractEquipmentDocId] ? 'animate-spin' : ''}`} />
                                    <span>Re-sincronizar</span>
                                  </button>
                                )}
                              </div>
                            )}

                            {/* DOCUMENTATION SLOTS GRID */}
                            <div className="pt-0.5">
                              {(() => {
                                const eqKey = item.id || item.code || `${exp.id}-${item.name}`;
                                const unlinked =
                                  (eqSubfolder?.folderId ? unclassifiedDriveFiles[eqSubfolder.folderId] : null) ||
                                  unclassifiedDriveFiles[eqKey] ||
                                  (item.code ? unclassifiedDriveFiles[item.code] : null) ||
                                  (item.id ? unclassifiedDriveFiles[item.id] : null) ||
                                  [];
                                const ftDoc = effectiveDocs.find((d) => d?.docType?.toLowerCase().includes('ficha'));
                                const invimaDoc = effectiveDocs.find((d) => d?.docType?.toLowerCase().includes('invima') || d?.docType?.toLowerCase().includes('sanitario'));
                                const manualDoc = effectiveDocs.find((d) => d?.docType?.toLowerCase().includes('manual'));
                                const guiaDoc = effectiveDocs.find((d) => d?.docType?.toLowerCase().includes('guía') || d?.docType?.toLowerCase().includes('guia'));
                                const limpiezaDoc = effectiveDocs.find((d) => d?.docType?.toLowerCase().includes('limpieza') || d?.docType?.toLowerCase().includes('protocolo'));

                                // Synchronized DIAN document: Checks effectiveDocs AND serial individual documents
                                const serialDianDoc = matchedOCItem?.serialNumbers?.flatMap((s: any) => s.documents || [])
                                  .find((d: any) => d?.docType === 'dian_import' || d?.title?.toLowerCase().includes('dian') || d?.dianDeclarationNumber);

                                const dianDoc = effectiveDocs.find((d) =>
                                  d?.docType?.toLowerCase().includes('dian') ||
                                  d?.docType?.toLowerCase().includes('manifiesto') ||
                                  d?.docType?.toLowerCase().includes('aduan')
                                ) || (serialDianDoc ? {
                                  id: serialDianDoc.id,
                                  equipmentId: eqIdForDoc,
                                  equipmentName: item.name,
                                  docType: 'Declaración DIAN',
                                  title: serialDianDoc.title || 'Declaración DIAN',
                                  fileName: serialDianDoc.fileName || (serialDianDoc.dianDeclarationNumber ? `DIAN_${serialDianDoc.dianDeclarationNumber}.pdf` : 'Declaracion_DIAN.pdf'),
                                  fileData: serialDianDoc.fileData,
                                  fileUrl: serialDianDoc.fileUrl,
                                  isCloudLink: serialDianDoc.isCloudLink,
                                  uploadDate: serialDianDoc.uploadDate,
                                } as TechnicalDocument : undefined);

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
                                    t.includes('protocolo') ||
                                    t.includes('dian') ||
                                    t.includes('aduan') ||
                                    t.includes('manifiesto')
                                  );
                                };
                                const extraDocs = attachedDocs.filter((d) => !isPresetDoc(d));

                                const renderSlot = (
                                  doc: TechnicalDocument | undefined,
                                  typeLabel: string,
                                  shortLabel: string,
                                  isRequired: boolean,
                                  IconComp: React.ComponentType<{ className?: string }>,
                                  theme: {
                                    activeBg: string;
                                    activeBorder: string;
                                    activeText: string;
                                    iconColor: string;
                                    emptyBg: string;
                                    emptyBorder: string;
                                    emptyText: string;
                                  }
                                ) => {
                                  if (!doc) {
                                    return (
                                      <button
                                        key={`contract-empty-${typeLabel}`}
                                        type="button"
                                        onClick={async () => {
                                          if (unlinked.length > 0) {
                                            setClassifyDriveModalTarget({
                                              exp,
                                              item,
                                              eqSubfolder,
                                              files: unlinked,
                                              defaultDocType: typeLabel,
                                            });
                                            return;
                                          }

                                          if (eqSubfolder?.folderId && googleWorkspaceService.isConnected()) {
                                            try {
                                              const found = await scanEquipmentDriveFolder(exp, item, eqSubfolder, false);
                                              if (found && found.length > 0) {
                                                setClassifyDriveModalTarget({
                                                  exp,
                                                  item,
                                                  eqSubfolder,
                                                  files: found,
                                                  defaultDocType: typeLabel,
                                                });
                                                return;
                                              }
                                            } catch (_) {}
                                          }

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
                                          );
                                        }}
                                        className={`h-[30px] px-2.5 rounded-lg border border-dashed transition cursor-pointer inline-flex items-center gap-1.5 shrink-0 hover:scale-[1.01] active:scale-[0.99] shadow-2xs ${
                                          isRequired
                                            ? 'bg-amber-950/25 hover:bg-amber-950/45 border-amber-500/50 hover:border-amber-400 text-amber-200'
                                            : `${theme.emptyBg} ${theme.emptyBorder} ${theme.emptyText}`
                                        }`}
                                        title={
                                          unlinked.length > 0
                                            ? `Vincular archivo de Drive como ${typeLabel} o subir nuevo`
                                            : `Adjuntar o buscar en Drive ${typeLabel}`
                                        }
                                      >
                                        <Plus className="w-3.5 h-3.5 stroke-[2.5] text-slate-400 shrink-0" />
                                        <span className="text-[10.5px] font-bold">{shortLabel}</span>
                                        {isRequired && (
                                          <span className="text-[7.5px] font-black uppercase tracking-wider text-amber-400 bg-amber-950/90 px-1 py-0.2 rounded border border-amber-500/40">
                                            Req
                                          </span>
                                        )}
                                      </button>
                                    );
                                  }

                                  const isInherited = doc.equipmentId !== eqIdForDoc;
                                  const isCloud = Boolean(doc.isCloudLink || (doc.fileData && doc.fileData.startsWith('http')) || doc.fileUrl);

                                  return (
                                    <div
                                      key={`contract-slot-${typeLabel}`}
                                      className={`h-[30px] inline-flex items-center gap-1.5 pl-2 pr-1 rounded-lg ${theme.activeBg} ${theme.activeBorder} border text-[10.5px] font-medium shadow-2xs transition shrink-0 max-w-[240px] overflow-hidden`}
                                      title={`${typeLabel}: ${doc.title || doc.fileName}`}
                                    >
                                      <IconComp className={`w-3.5 h-3.5 ${theme.iconColor} shrink-0`} />

                                      <div className="flex items-center gap-1 min-w-0">
                                        <span className={`text-[10px] font-black ${theme.activeText} shrink-0`}>
                                          {shortLabel}
                                        </span>

                                        {isCloud ? (
                                          <span className="text-[7.5px] font-bold text-amber-300 bg-amber-950/90 px-1 py-0.2 rounded border border-amber-500/40 shrink-0" title="Archivo alojado en Google Drive">
                                            ☁️
                                          </span>
                                        ) : isInherited ? (
                                          <span className="text-[7.5px] font-bold text-indigo-300 bg-indigo-950/90 px-1 py-0.2 rounded border border-indigo-500/40 shrink-0" title="Heredado de Base Maestra">
                                            Base
                                          </span>
                                        ) : null}

                                        <button
                                          type="button"
                                          onClick={() => onPreviewDoc(doc)}
                                          className="text-[9.5px] text-slate-300 hover:text-white truncate max-w-[90px] text-left cursor-pointer transition"
                                          title={`Visualizar: ${doc.title || doc.fileName}`}
                                        >
                                          {doc.title || doc.fileName}
                                        </button>
                                      </div>

                                      <div className="flex items-center ml-auto pl-1 border-l border-slate-700/60 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => onPreviewDoc(doc)}
                                          className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                                          title="Visualizar documento"
                                        >
                                          <Eye className="w-2.5 h-2.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => onDownloadDoc(doc)}
                                          className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-cyan-300 transition cursor-pointer"
                                          title="Descargar archivo"
                                        >
                                          <Download className="w-2.5 h-2.5" />
                                        </button>
                                        {!isReadOnly && (
                                          <button
                                            type="button"
                                            onClick={() => onDeleteDocument(doc.id)}
                                            className="p-1 rounded hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                                            title="Eliminar documento"
                                          >
                                            <Trash2 className="w-2.5 h-2.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                };

                                return (
                                  <div className="flex items-center justify-center gap-2 flex-wrap py-1">
                                    {renderSlot(ftDoc, 'Ficha Técnica', 'Ficha Técnica', true, FileText, {
                                      activeBg: 'bg-blue-950/80',
                                      activeBorder: 'border-blue-500/50',
                                      activeText: 'text-blue-300',
                                      iconColor: 'text-blue-400',
                                      emptyBg: 'bg-blue-500/10 hover:bg-blue-500/20',
                                      emptyBorder: 'border-blue-500/30 hover:border-blue-500/50',
                                      emptyText: 'text-blue-300',
                                    })}

                                    {renderSlot(invimaDoc, 'Registro INVIMA', 'Reg. INVIMA', true, ShieldCheck, {
                                      activeBg: 'bg-emerald-950/80',
                                      activeBorder: 'border-emerald-500/50',
                                      activeText: 'text-emerald-300',
                                      iconColor: 'text-emerald-400',
                                      emptyBg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
                                      emptyBorder: 'border-emerald-500/30 hover:border-emerald-500/50',
                                      emptyText: 'text-emerald-300',
                                    })}

                                    {renderSlot(dianDoc, 'Declaración DIAN', 'Declaración DIAN', false, FileCheck, {
                                      activeBg: 'bg-teal-950/80',
                                      activeBorder: 'border-teal-500/50',
                                      activeText: 'text-teal-300',
                                      iconColor: 'text-teal-400',
                                      emptyBg: 'bg-teal-500/10 hover:bg-teal-500/20',
                                      emptyBorder: 'border-teal-500/30 hover:border-teal-500/50',
                                      emptyText: 'text-teal-300',
                                    })}

                                    {renderSlot(manualDoc, 'Manual de Usuario', 'Manual', false, BookOpen, {
                                      activeBg: 'bg-amber-950/80',
                                      activeBorder: 'border-amber-500/50',
                                      activeText: 'text-amber-300',
                                      iconColor: 'text-amber-400',
                                      emptyBg: 'bg-slate-900/40 hover:bg-slate-800/60',
                                      emptyBorder: 'border-slate-700/70 hover:border-slate-500',
                                      emptyText: 'text-slate-300',
                                    })}

                                    {renderSlot(guiaDoc, 'Guía Rápida', 'Guía Rápida', false, Zap, {
                                      activeBg: 'bg-yellow-950/80',
                                      activeBorder: 'border-yellow-500/50',
                                      activeText: 'text-yellow-300',
                                      iconColor: 'text-yellow-400',
                                      emptyBg: 'bg-slate-900/40 hover:bg-slate-800/60',
                                      emptyBorder: 'border-slate-700/70 hover:border-slate-500',
                                      emptyText: 'text-slate-300',
                                    })}

                                    {renderSlot(limpiezaDoc, 'Protocolo de Limpieza', 'Prot. Limpieza', false, Sparkles, {
                                      activeBg: 'bg-cyan-950/80',
                                      activeBorder: 'border-cyan-500/50',
                                      activeText: 'text-cyan-300',
                                      iconColor: 'text-cyan-400',
                                      emptyBg: 'bg-slate-900/40 hover:bg-slate-800/60',
                                      emptyBorder: 'border-slate-700/70 hover:border-slate-500',
                                      emptyText: 'text-slate-300',
                                    })}

                                    {/* + Otro Documento button */}
                                    {!isReadOnly && (
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
                                        className="h-[30px] px-2.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-dashed border-purple-500/40 hover:border-purple-400 text-purple-200 text-[10.5px] font-bold transition cursor-pointer inline-flex items-center gap-1.5 shrink-0 shadow-2xs"
                                        title="Subir o adjuntar otro documento personalizado"
                                      >
                                        <Plus className="w-3.5 h-3.5 text-purple-300 shrink-0 stroke-[2.5]" />
                                        <span>Otro Doc</span>
                                      </button>
                                    )}

                                    {/* Additional Custom Attached Documents */}
                                    {extraDocs.map((doc, dIdx) => {
                                      const isInherited = doc.equipmentId !== eqIdForDoc;
                                      const isCloud = Boolean(doc.isCloudLink || (doc.fileData && doc.fileData.startsWith('http')) || doc.fileUrl);

                                      return (
                                        <div
                                          key={`doc-extra-${doc.id || dIdx}`}
                                          className="h-[30px] inline-flex items-center gap-1.5 pl-2 pr-1 rounded-lg bg-purple-950/70 border border-purple-500/40 text-[10.5px] font-medium shadow-2xs transition shrink-0 max-w-[240px] overflow-hidden"
                                          title={`${doc.docType}: ${doc.title || doc.fileName}`}
                                        >
                                          <File className="w-3.5 h-3.5 text-purple-400 shrink-0" />

                                          <div className="flex items-center gap-1 min-w-0">
                                            <span className="text-[10px] font-black text-purple-200 truncate shrink-0 max-w-[80px]">
                                              {doc.docType || 'Otro'}
                                            </span>

                                            {isCloud ? (
                                              <span className="text-[7.5px] font-bold text-amber-300 bg-amber-950/90 px-1 py-0.2 rounded border border-amber-500/40 shrink-0" title="Archivo alojado en Google Drive">
                                                ☁️
                                              </span>
                                            ) : isInherited ? (
                                              <span className="text-[7.5px] font-bold text-indigo-300 bg-indigo-950/90 px-1 py-0.2 rounded border border-indigo-500/40 shrink-0" title="Heredado de Base Maestra">
                                                Base
                                              </span>
                                            ) : null}

                                            <button
                                              type="button"
                                              onClick={() => onPreviewDoc(doc)}
                                              className="text-[9.5px] text-slate-300 hover:text-white truncate max-w-[85px] text-left cursor-pointer transition"
                                              title={`Visualizar: ${doc.title || doc.fileName}`}
                                            >
                                              {doc.title || doc.fileName}
                                            </button>
                                          </div>

                                          <div className="flex items-center ml-auto pl-1 border-l border-slate-700/60 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => onPreviewDoc(doc)}
                                              className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                                              title="Ver anexo"
                                            >
                                              <Eye className="w-2.5 h-2.5 text-purple-300" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => onDownloadDoc(doc)}
                                              className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-purple-200 transition cursor-pointer"
                                              title="Descargar anexo"
                                            >
                                              <Download className="w-2.5 h-2.5 text-purple-300" />
                                            </button>
                                            {!isReadOnly && (
                                              <button
                                                type="button"
                                                onClick={() => onDeleteDocument(doc.id)}
                                                className="p-1 rounded hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                                                title="Eliminar este anexo"
                                              >
                                                <Trash2 className="w-2.5 h-2.5" />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>

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

      {/* Contract Google Drive Folder Creation & Location Modal */}
      {folderModalTarget &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs animate-fadeIn">
            <div className="bg-[#14233a] border border-[#2b4468] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
            <div className="px-5 py-4 border-b border-[#243c5e] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/50">
                  <FolderPlus className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Carpeta de Contrato en Google Drive</h3>
                  <p className="text-[11px] text-slate-400">
                    {folderModalTarget.processNumber} — {folderModalTarget.clientName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFolderModalTarget(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switcher: Link Existing vs Create New */}
            <div className="px-5 pt-4 pb-1">
              <div className="grid grid-cols-2 p-1 bg-[#0e1828] border border-[#233854] rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setFolderModalMode('select_existing')}
                  className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    folderModalMode === 'select_existing'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>Vincular Carpeta Existente</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFolderModalMode('create_new')}
                  className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    folderModalMode === 'create_new'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Crear Nueva Carpeta</span>
                </button>
              </div>
            </div>

            {/* Mode 1: Vincular Carpeta Existente */}
            {folderModalMode === 'select_existing' ? (
              <div className="p-5 space-y-3.5 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-300">
                      Seleccionar carpeta existente de tu Google Drive:
                    </label>
                    <button
                      type="button"
                      onClick={() => loadAvailableDriveFolders(true)}
                      disabled={isLoadingAvailableFolders}
                      className="text-cyan-400 hover:text-cyan-300 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingAvailableFolders ? 'animate-spin' : ''}`} />
                      <span>Actualizar carpetas</span>
                    </button>
                  </div>
                  <p className="text-[10.5px] text-slate-400">
                    Si ya creaste la carpeta en Drive para este contrato, selecciónala de la lista o pega su enlace abajo:
                  </p>
                </div>

                {/* Filter input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={folderSearchFilter}
                    onChange={(e) => setFolderSearchFilter(e.target.value)}
                    placeholder="Buscar por número de proceso o nombre..."
                    className="w-full bg-[#16253d] border border-[#2d466b] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400 font-medium"
                  />
                </div>

                {/* Quick filter chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setFolderSearchFilter('')}
                    className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold transition cursor-pointer ${
                      !folderSearchFilter
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    Ver todas ({availableDriveFolders.length})
                  </button>
                  {folderModalTarget.processNumber && (
                    <button
                      type="button"
                      onClick={() => setFolderSearchFilter(folderModalTarget.processNumber)}
                      className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold transition cursor-pointer ${
                        folderSearchFilter === folderModalTarget.processNumber
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      Proceso: {folderModalTarget.processNumber}
                    </button>
                  )}
                  {folderModalTarget.clientName && (
                    <button
                      type="button"
                      onClick={() => {
                        const words = folderModalTarget.clientName.split(' ');
                        const keyword = words.length > 2 ? words[1] || words[0] : words[0];
                        setFolderSearchFilter(keyword);
                      }}
                      className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                    >
                      Filtrar por Cliente
                    </button>
                  )}
                </div>

                {/* List of folders */}
                {isLoadingAvailableFolders ? (
                  <div className="flex items-center justify-center gap-2 text-slate-400 text-xs py-6 bg-[#0f192b] border border-[#243c5e] rounded-xl">
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>Cargando carpetas de tu Google Drive...</span>
                  </div>
                ) : availableDriveFolders.length > 0 ? (
                  <div className="max-h-52 overflow-y-auto space-y-1 border border-[#243c5e] rounded-xl p-2 bg-[#0f192b]">
                    {availableDriveFolders
                      .filter((f) => !folderSearchFilter || f.name.toLowerCase().includes(folderSearchFilter.toLowerCase()))
                      .map((f) => {
                        const isSelected = selectedExistingFolder?.id === f.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                              setSelectedExistingFolder(f);
                              setExistingFolderDirectInput(f.webViewLink || f.id);
                            }}
                            className={`w-full px-3 py-2 rounded-lg text-left text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                              isSelected
                                ? 'bg-cyan-500/25 border border-cyan-400 text-cyan-200'
                                : 'text-slate-300 hover:bg-[#162740] hover:text-white'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <Folder className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              <span className="truncate">{f.name}</span>
                            </span>
                            {isSelected && <Check className="w-4 h-4 text-cyan-300 shrink-0 stroke-[3]" />}
                          </button>
                        );
                      })}
                  </div>
                ) : (
                  <div className="text-slate-400 text-xs py-4 text-center bg-[#0d1624] p-3 rounded-xl border border-slate-700/50 space-y-1">
                    <p>No se encontraron carpetas con ese nombre en Drive.</p>
                  </div>
                )}

                {/* Direct link input */}
                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-bold text-slate-300 block">
                    O pega el enlace directo / ID de la carpeta en Google Drive:
                  </label>
                  <input
                    type="text"
                    value={existingFolderDirectInput}
                    onChange={(e) => {
                      setExistingFolderDirectInput(e.target.value);
                      setSelectedExistingFolder(null);
                    }}
                    placeholder="https://drive.google.com/drive/folders/1abc... o ID de carpeta"
                    className="w-full bg-[#16253d] border border-[#2d466b] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>
            ) : (
              /* Mode 2: Crear Nueva Carpeta */
              <div className="p-5 space-y-4 text-xs">
                {/* Name input */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-300 block">Nombre de la Carpeta a Crear en Drive:</label>
                  <input
                    type="text"
                    value={folderModalName}
                    onChange={(e) => setFolderModalName(e.target.value)}
                    className="w-full bg-[#1b2d48] border border-[#334d6e] rounded-xl px-3 py-2 text-white font-medium outline-none focus:border-cyan-400"
                    placeholder="Ej: NoHBOC0000000640 - HOSPITAL..."
                  />
                </div>

                {/* Location selector */}
                <div className="space-y-2">
                  <label className="font-bold text-slate-300 block">¿Dónde deseas crear esta carpeta en Google Drive?</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFolderModalLocation('documentacion')}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                        folderModalLocation === 'documentacion'
                          ? 'bg-cyan-950/70 border-cyan-400 text-white shadow-xs'
                          : 'bg-[#1b2d48] border-[#334d6e] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-cyan-300">
                        <Folder className="w-3.5 h-3.5" />
                        <span>DOCUMENTACION</span>
                      </div>
                      <span className="text-[9.5px] text-slate-400">Carpeta central</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFolderModalLocation('contratos')}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                        folderModalLocation === 'contratos'
                          ? 'bg-cyan-950/70 border-cyan-400 text-white shadow-xs'
                          : 'bg-[#1b2d48] border-[#334d6e] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-300">
                        <Folder className="w-3.5 h-3.5" />
                        <span>CONTRATOS</span>
                      </div>
                      <span className="text-[9.5px] text-slate-400">En DOCUMENTACION/CONTRATOS</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFolderModalLocation('root')}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                        folderModalLocation === 'root'
                          ? 'bg-cyan-950/70 border-cyan-400 text-white shadow-xs'
                          : 'bg-[#1b2d48] border-[#334d6e] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-300">
                        <HardDrive className="w-3.5 h-3.5" />
                        <span>Mi Unidad</span>
                      </div>
                      <span className="text-[9.5px] text-slate-400">Raíz de tu Drive</span>
                    </button>
                  </div>
                </div>

                {/* Option to create equipment subfolders */}
                <label className="flex items-center gap-2.5 bg-[#1b2d48] p-3 rounded-xl border border-[#334d6e] cursor-pointer hover:bg-[#203657] transition">
                  <input
                    type="checkbox"
                    checked={folderModalAutoSubfolders}
                    onChange={(e) => setFolderModalAutoSubfolders(e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-500 focus:ring-0 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-white block">Crear subcarpetas para los equipos</span>
                    <span className="text-[11px] text-slate-400">
                      Crea automáticamente una subcarpeta para cada uno de los {folderModalTarget.items?.length || 0} equipos dentro de la carpeta del contrato
                    </span>
                  </div>
                </label>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="px-5 py-3.5 bg-[#101c2e] border-t border-[#243c5e] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setFolderModalTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Cancelar
              </button>
              {folderModalMode === 'select_existing' ? (
                <button
                  type="button"
                  onClick={() => {
                    const chosenId = selectedExistingFolder?.id || existingFolderDirectInput;
                    const chosenName = selectedExistingFolder?.name || `${folderModalTarget.processNumber} - ${folderModalTarget.clientName}`;
                    const chosenLink = selectedExistingFolder?.webViewLink;
                    handleLinkExistingContractFolder(folderModalTarget, chosenId, chosenName, chosenLink);
                  }}
                  disabled={!selectedExistingFolder && !existingFolderDirectInput.trim()}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>Vincular Carpeta Existente</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmCreateContractFolder}
                  disabled={!folderModalName.trim() || creatingFolderForContract[folderModalTarget.id]}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>Crear Carpeta en Drive</span>
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: Confirm Delete Contract Folder in Google Drive & App */}
      {contractFolderToDelete &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#14233a] border border-rose-500/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-scaleUp">
            <div className="px-5 py-4 border-b border-[#243c5e] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">¿Eliminar Carpeta en Google Drive?</h3>
                  <p className="text-[11px] text-slate-400">Contrato: {contractFolderToDelete.exp.processNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setContractFolderToDelete(null)}
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
                  📁 {contractFolderToDelete.cFolder.folderName}
                </p>
                <p className="text-[11px] text-slate-300">
                  Cliente: <strong className="text-white">{contractFolderToDelete.exp.clientName}</strong>
                </p>
              </div>

              <p className="text-[11.5px] text-slate-300">
                Al confirmar, la carpeta se <strong>eliminará de Google Drive</strong> y se desvinculará del sistema para que puedas volver a crearla en la ubicación que desees.
              </p>
            </div>

            <div className="px-5 py-3.5 bg-[#101c2e] border-t border-[#243c5e] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setContractFolderToDelete(null)}
                disabled={isDeletingDriveFolder}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteContractFolderFromDrive(contractFolderToDelete.exp, contractFolderToDelete.cFolder)}
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
        </div>,
        document.body
      )}

      {/* Modal: Confirm Delete Equipment Subfolder in Google Drive & App */}
      {equipmentFolderToDelete &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#14233a] border border-rose-500/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-scaleUp">
            <div className="px-5 py-4 border-b border-[#243c5e] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">¿Eliminar Subcarpeta de Equipo?</h3>
                  <p className="text-[11px] text-slate-400">{equipmentFolderToDelete.item.name}</p>
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
                  ⚠️ Se eliminará en Google Drive la subcarpeta del equipo:
                </p>
                <p className="font-mono text-white text-xs bg-black/40 p-2 rounded-lg break-all">
                  📁 {equipmentFolderToDelete.eqSubfolder.folderName}
                </p>
              </div>

              <p className="text-[11.5px] text-slate-300">
                Al confirmar, la subcarpeta se <strong>eliminará de Google Drive</strong> y quedará lista para volver a ser creada.
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
                onClick={() => handleDeleteEquipmentFolderFromDrive(equipmentFolderToDelete.exp, equipmentFolderToDelete.item, equipmentFolderToDelete.eqSubfolder)}
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
                    <span>Eliminar Subcarpeta en Drive</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: Classify Manually Uploaded Drive Files */}
      {classifyDriveModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#121f33] border border-cyan-500/40 rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-scaleUp">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#243c5e] bg-[#162742] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                  <HardDrive className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                    <span>Clasificar Archivos de Google Drive</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/25 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                      {classifyDriveModalTarget.files.length} pendiente{classifyDriveModalTarget.files.length > 1 ? 's' : ''}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-300 truncate max-w-md">
                    Equipo: <strong className="text-cyan-300">{classifyDriveModalTarget.item.name}</strong> ({classifyDriveModalTarget.item.brand || 'SYD'} {classifyDriveModalTarget.item.model || ''})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setClassifyDriveModalTarget(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg transition hover:bg-slate-800 cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Subheader info banner */}
            <div className="px-5 py-2.5 bg-[#0e1828] border-b border-[#1f334f] text-[11px] text-slate-300 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 truncate">
                <Folder className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">
                  Carpeta en Drive: <strong className="text-emerald-300 font-mono">{classifyDriveModalTarget.eqSubfolder?.folderName || 'Carpeta del equipo'}</strong>
                </span>
              </div>
              {classifyDriveModalTarget.eqSubfolder?.webViewLink && (
                <a
                  href={classifyDriveModalTarget.eqSubfolder.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 text-[10.5px] font-bold inline-flex items-center gap-1 shrink-0 transition"
                >
                  <span>Abrir en Drive</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Content: List of unclassified files */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-[11.5px] flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Subida manual detectada en Google Drive:</p>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Se encontraron archivos subidos directamente a la carpeta de este equipo en Google Drive. Selecciona a qué documento corresponde cada uno para vincularlo al expediente técnico de este contrato:
                  </p>
                </div>
              </div>

              {classifyDriveModalTarget.files.map((file) => {
                const currentDocType =
                  modalSelectedDocType[file.id] ||
                  classifyDriveModalTarget.defaultDocType ||
                  guessDocType(file.name);

                const isInvima = currentDocType === 'Registro INVIMA';
                const contractItems = classifyDriveModalTarget.exp.items || [];
                const targetItemId = modalTargetItemId[file.id] || (classifyDriveModalTarget.item.id || classifyDriveModalTarget.item.code);
                const targetItem =
                  contractItems.find((it: any) => (it.id || it.code) === targetItemId) ||
                  classifyDriveModalTarget.item;
                const matchedEq = findEquipmentMatch(targetItem);
                const currentInvimaNum =
                  modalInvimaNumber[file.id] !== undefined
                    ? modalInvimaNumber[file.id]
                    : (matchedEq?.invimaRecordNumber || '');
                const currentValidUntil =
                  modalValidUntil[file.id] !== undefined
                    ? modalValidUntil[file.id]
                    : (matchedEq?.invimaExpiryDate || '');

                const docOptions = [
                  { type: 'Ficha Técnica', label: 'Ficha Técnica', icon: '📄', color: 'border-blue-500/50 bg-blue-500/10 text-blue-300' },
                  { type: 'Registro INVIMA', label: 'Registro INVIMA', icon: '🛡️', color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' },
                  { type: 'Manual de Usuario', label: 'Manual de Usuario', icon: '📘', color: 'border-amber-500/50 bg-amber-500/10 text-amber-300' },
                  { type: 'Guía Rápida', label: 'Guía Rápida', icon: '⚡', color: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300' },
                  { type: 'Protocolo de Limpieza', label: 'Protocolo de Limpieza', icon: '🧼', color: 'border-teal-500/50 bg-teal-500/10 text-teal-300' },
                  { type: 'Otro', label: 'Otro / Anexo', icon: '📎', color: 'border-purple-500/50 bg-purple-500/10 text-purple-300' },
                ];

                const isLinking = isLinkingFile[file.id];
                const suggestedType = guessDocType(file.name);
                const numSize = typeof file.size === 'number' ? file.size : Number(file.size);
                const sizeDisplay = !isNaN(numSize) && numSize > 0
                  ? `${(numSize / (1024 * 1024)).toFixed(2)} MB`
                  : 'Google Drive';

                return (
                  <div
                    key={`unclassified-${file.id}`}
                    className="p-4 rounded-xl bg-[#162740] border border-[#2b446a] space-y-3.5 shadow-md"
                  >
                    {/* File Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#243c5e]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40 shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-white text-xs sm:text-[13px] truncate" title={file.name}>
                            {file.name}
                          </p>
                          <div className="flex items-center gap-2 text-[10.5px] text-slate-400 font-mono mt-0.5">
                            <span>{sizeDisplay}</span>
                            <span>•</span>
                            <span className="text-slate-400">{file.mimeType?.replace('application/', '') || 'pdf'}</span>
                            {suggestedType && suggestedType !== 'Otro' && (
                              <span className="text-amber-300 bg-amber-500/20 px-1.5 py-0.2 rounded font-sans font-bold text-[9.5px]">
                                💡 Sugerido: {suggestedType}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-[#20375a] hover:bg-[#284673] border border-[#334d6e] text-slate-200 text-[10.5px] font-bold inline-flex items-center gap-1.5 shrink-0 self-start sm:self-center transition"
                          title="Visualizar este archivo directamente en Google Drive"
                        >
                          <Eye className="w-3 h-3 text-cyan-300" />
                          <span>Ver en Drive</span>
                          <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                        </a>
                      )}
                    </div>

                    {/* Target Equipment Selector within Contract */}
                    {contractItems.length > 1 && (
                      <div className="space-y-1 p-2.5 rounded-lg bg-[#111e31] border border-[#233b5c]">
                        <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                          <Boxes className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Equipo al que corresponde este archivo en el contrato:</span>
                        </label>
                        <select
                          value={targetItemId}
                          onChange={(e) =>
                            setModalTargetItemId((prev) => ({
                              ...prev,
                              [file.id]: e.target.value,
                            }))
                          }
                          className="w-full bg-[#182942] border border-[#334d6e] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-400 font-medium"
                        >
                          {contractItems.map((ci: any, cIdx: number) => {
                            const ciKey = ci.id || ci.code || `item-${cIdx}`;
                            const ciLabel = `${ci.code ? `[${ci.code}] ` : ''}${ci.name || 'Equipo'} (${ci.brand || ''} ${ci.model || ''})`.trim();
                            return (
                              <option key={ciKey} value={ciKey}>
                                {ciLabel}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}

                    {/* Classification choices */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-300 block">
                        ¿A qué tipo de documento corresponde este archivo?
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {docOptions.map((opt) => {
                          const isSelected = currentDocType === opt.type;
                          return (
                            <button
                              key={opt.type}
                              type="button"
                              onClick={() =>
                                setModalSelectedDocType((prev) => ({
                                  ...prev,
                                  [file.id]: opt.type,
                                }))
                              }
                              className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${
                                isSelected
                                  ? `${opt.color} ring-2 ring-cyan-400 font-black shadow-sm`
                                  : 'border-[#2d466b] bg-[#1a2c47]/70 text-slate-300 hover:bg-[#203657] hover:text-white'
                              }`}
                            >
                              <span className="text-sm shrink-0">{opt.icon}</span>
                              <span className="text-[11px] font-bold truncate">{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* INVIMA fields if applicable */}
                    {isInvima && (
                      <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-2.5 animate-fadeIn">
                        <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Datos adicionales del Registro Sanitario INVIMA:</span>
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-[10.5px] text-slate-300 block mb-1">
                              Número de Registro INVIMA:
                            </label>
                            <input
                              type="text"
                              value={currentInvimaNum}
                              onChange={(e) =>
                                setModalInvimaNumber((prev) => ({
                                  ...prev,
                                  [file.id]: e.target.value,
                                }))
                              }
                              placeholder="Ej: INVIMA 2021EBC-0001234"
                              className="w-full bg-[#101b2c] border border-emerald-500/40 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-400 font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10.5px] text-slate-300 block mb-1">
                              Fecha de Vigencia / Vencimiento:
                            </label>
                            <input
                              type="date"
                              value={currentValidUntil}
                              onChange={(e) =>
                                setModalValidUntil((prev) => ({
                                  ...prev,
                                  [file.id]: e.target.value,
                                }))
                              }
                              className="w-full bg-[#101b2c] border border-emerald-500/40 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-400 font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Confirm Button for this file */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleLinkDriveFileAsDocument(
                            classifyDriveModalTarget.exp,
                            targetItem,
                            file,
                            currentDocType,
                            currentInvimaNum,
                            currentValidUntil
                          )
                        }
                        disabled={isLinking}
                        className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isLinking ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Vinculando...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Vincular como {currentDocType} a {targetItem.name || 'este equipo'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-[#101c2e] border-t border-[#243c5e] flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Al vincular, el archivo quedará registrado en el expediente técnico de este contrato.
              </span>
              <button
                type="button"
                onClick={() => setClassifyDriveModalTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
