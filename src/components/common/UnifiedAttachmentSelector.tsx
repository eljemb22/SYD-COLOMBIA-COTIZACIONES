import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  UploadCloud,
  Link as LinkIcon,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  RefreshCw,
  Search,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  FileType,
  Folder,
  FolderPlus,
  FolderOpen,
  ChevronRight,
  Upload,
  ArrowLeft,
  Check,
  Sparkles,
  ShieldAlert,
  FileCheck2,
  BookOpen,
  Tag,
  X,
  FileUp,
  Layers,
  Edit3,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  analyzeCloudUrl,
  isHttpUrl,
  CloudProviderType,
} from '../../utils/cloudLinkUtils';
import {
  googleWorkspaceService,
  DriveFileItem,
} from '../../services/googleWorkspaceService';
import { PdfCanvasViewer } from '../gmail/PdfCanvasViewer';

export interface AttachmentResult {
  fileName: string;
  fileSize: string;
  fileData?: string; // base64 or URL
  fileType?: string;
  fileUrl?: string; // URL if cloud link
  downloadUrl?: string;
  isCloudLink: boolean;
  cloudProvider?: CloudProviderType;
  driveFileId?: string;
  isFolder?: boolean;
  classification?: string; // e.g. "Ficha Técnica", "Registro INVIMA", "Manual de Usuario"
  equipmentName?: string;
  invimaNumber?: string;
}

export interface EquipmentFolderData {
  partNumber?: string;
  name?: string; // Nombre del equipo (e.g. "Monitor de Signos Vitales ePM 12M")
  equipmentName?: string;
  brand?: string;
  model?: string;
  description?: string;
  invimaRecordNumber?: string;
  invimaNumber?: string;
}

/**
 * Builds equipment folder name in strict order requested by user:
 * 1. Número de Parte
 * 2. Nombre del equipo (NUNCA la descripción técnica larga)
 * 3. Marca
 * 4. Modelo
 */
export const buildEquipmentFolderName = (
  equipmentData?: EquipmentFolderData,
  fallbackName?: string
): string => {
  if (equipmentData) {
    const pNumber = equipmentData.partNumber?.trim() || '';

    // Strictly prioritize Nombre del equipo:
    let equipName =
      equipmentData.name?.trim() ||
      equipmentData.equipmentName?.trim() ||
      '';

    // If equipName is still empty, fallback to fallbackName
    if (!equipName && fallbackName?.trim()) {
      equipName = fallbackName.trim();
    }

    // Safety fallback: if only description was passed, clean and truncate so it never contains long technical paragraphs
    if (!equipName && equipmentData.description?.trim()) {
      const clean = equipmentData.description.trim().split(/[\n\r.,;]/)[0].trim();
      equipName = clean.length > 50 ? clean.slice(0, 50).trim() : clean;
    }

    const brand = equipmentData.brand?.trim() || '';
    const model = equipmentData.model?.trim() || '';

    // Strictly in this order: Número de parte, Nombre del equipo, Marca, Modelo
    const parts = [pNumber, equipName, brand, model].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(' - ');
    }
  }

  if (fallbackName && fallbackName.trim()) {
    return fallbackName.trim();
  }

  return 'Documentación de Equipo';
};

// =========================================================================
// DOCUMENT CLASSIFICATION CONSTANTS & STORAGE HELPERS
// =========================================================================
export interface DocumentClassificationItem {
  id: string;
  label: string;
  icon: string;
  desc: string;
  badgeClass: string;
  chipClass: string;
}

export const DOCUMENT_CLASSIFICATIONS: DocumentClassificationItem[] = [
  {
    id: 'Ficha Técnica',
    label: 'Ficha Técnica',
    icon: '📄',
    desc: 'Especificaciones técnicas, folleto o datasheet del fabricante',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    chipClass: 'border-rose-500/50 bg-rose-500/10 text-rose-200 hover:bg-rose-500/25',
  },
  {
    id: 'Registro INVIMA',
    label: 'Registro Sanitario INVIMA',
    icon: '🛡️',
    desc: 'Registro Sanitario oficial INVIMA vigente para Colombia',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    chipClass: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/25',
  },
  {
    id: 'Manual de Usuario',
    label: 'Manual de Usuario / Servicio',
    icon: '📖',
    desc: 'Manual de operación, guía rápida o manual de servicio técnico',
    badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    chipClass: 'border-sky-500/50 bg-sky-500/10 text-sky-200 hover:bg-sky-500/25',
  },
  {
    id: 'Certificado de Calibración',
    label: 'Certificado de Calibración',
    icon: '🔬',
    desc: 'Reporte de metrología, control de calidad o calibración biomédica',
    badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    chipClass: 'border-indigo-500/50 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/25',
  },
  {
    id: 'Declaración DIAN',
    label: 'Declaración DIAN / Importación',
    icon: '📋',
    desc: 'Manifiesto de aduana o declaración de importación DIAN',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    chipClass: 'border-amber-500/50 bg-amber-500/10 text-amber-200 hover:bg-amber-500/25',
  },
  {
    id: 'Garantía',
    label: 'Garantía del Fabricante',
    icon: '🔖',
    desc: 'Certificado o póliza de garantía y soporte oficial',
    badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    chipClass: 'border-purple-500/50 bg-purple-500/10 text-purple-200 hover:bg-purple-500/25',
  },
  {
    id: 'Otro Documento',
    label: 'Otro Documento / Anexo',
    icon: '📎',
    desc: 'Otro documento, anexo o soporte complementario del equipo',
    badgeClass: 'bg-slate-700/70 text-slate-300 border-slate-600',
    chipClass: 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700',
  },
];

const CLASSIFICATIONS_STORAGE_KEY = 'syd_drive_file_classifications';

export interface FileClassificationInfo {
  classification: string;
  equipmentName?: string;
  partNumber?: string;
  invimaNumber?: string;
  savedAt: string;
  customTitle?: string;
}

export function getStoredClassifications(): Record<string, FileClassificationInfo> {
  try {
    const raw = localStorage.getItem(CLASSIFICATIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveFileClassification(fileId: string, info: FileClassificationInfo) {
  try {
    const current = getStoredClassifications();
    current[fileId] = info;
    localStorage.setItem(CLASSIFICATIONS_STORAGE_KEY, JSON.stringify(current));
  } catch (e) {}
}

export function detectFileClassification(fileName: string, fileId?: string): {
  id: string;
  label: string;
  icon: string;
  badgeClass: string;
  equipmentName?: string;
} {
  // 1. Check stored classification
  if (fileId) {
    const stored = getStoredClassifications();
    if (stored[fileId]) {
      const match = DOCUMENT_CLASSIFICATIONS.find((c) => c.id === stored[fileId].classification);
      if (match) {
        return {
          ...match,
          equipmentName: stored[fileId].equipmentName,
        };
      }
      return {
        id: stored[fileId].classification,
        label: stored[fileId].classification,
        icon: '🏷️',
        badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        equipmentName: stored[fileId].equipmentName,
      };
    }
  }

  // 2. Check fileName heuristically
  const lower = fileName.toLowerCase();
  if (
    lower.includes('ficha') ||
    lower.includes('tecnica') ||
    lower.includes('técnica') ||
    lower.includes('datasheet') ||
    lower.includes('data sheet')
  ) {
    return DOCUMENT_CLASSIFICATIONS[0];
  }
  if (
    lower.includes('invima') ||
    lower.includes('sanitario') ||
    lower.includes('sanitaria')
  ) {
    return DOCUMENT_CLASSIFICATIONS[1];
  }
  if (
    lower.includes('manual') ||
    lower.includes('guia') ||
    lower.includes('guía') ||
    lower.includes('instrucciones')
  ) {
    return DOCUMENT_CLASSIFICATIONS[2];
  }
  if (
    lower.includes('calibracion') ||
    lower.includes('calibración') ||
    lower.includes('metrolog') ||
    lower.includes('calidad')
  ) {
    return DOCUMENT_CLASSIFICATIONS[3];
  }
  if (
    lower.includes('dian') ||
    lower.includes('importac') ||
    lower.includes('aduana') ||
    lower.includes('manifiesto')
  ) {
    return DOCUMENT_CLASSIFICATIONS[4];
  }
  if (
    lower.includes('garantia') ||
    lower.includes('garantía') ||
    lower.includes('poliza') ||
    lower.includes('póliza')
  ) {
    return DOCUMENT_CLASSIFICATIONS[5];
  }

  return {
    id: 'Documento',
    label: 'Documento',
    icon: '📄',
    badgeClass: 'bg-slate-800/80 text-slate-300 border-slate-700',
  };
}

/**
 * Builds suggested filename for Google Drive based on category & equipment
 */
export function generateSuggestedFileName(
  originalFileName: string,
  category: string,
  equipmentName?: string,
  invimaNumber?: string
): string {
  const lastDot = originalFileName.lastIndexOf('.');
  const ext = lastDot !== -1 ? originalFileName.substring(lastDot) : '';
  const baseName = lastDot !== -1 ? originalFileName.substring(0, lastDot) : originalFileName;
  const cleanEq = (equipmentName || '').trim();

  if (category === 'Registro INVIMA') {
    const invStr = invimaNumber?.trim() ? `INVIMA ${invimaNumber.trim()}` : '';
    if (invStr && cleanEq) {
      return `Registro INVIMA - ${invStr} - ${cleanEq}${ext}`;
    } else if (invStr) {
      return `Registro INVIMA - ${invStr} - ${baseName}${ext}`;
    } else if (cleanEq) {
      return `Registro INVIMA - ${cleanEq}${ext}`;
    }
    return `Registro INVIMA - ${baseName}${ext}`;
  }

  if (category === 'Ficha Técnica') {
    if (cleanEq) {
      return `Ficha Técnica - ${cleanEq}${ext}`;
    }
    return `Ficha Técnica - ${baseName}${ext}`;
  }

  if (category === 'Manual de Usuario') {
    if (cleanEq) {
      return `Manual de Usuario - ${cleanEq}${ext}`;
    }
    return `Manual de Usuario - ${baseName}${ext}`;
  }

  if (category === 'Certificado de Calibración') {
    if (cleanEq) {
      return `Certificado Calibración - ${cleanEq}${ext}`;
    }
    return `Certificado Calibración - ${baseName}${ext}`;
  }

  if (category === 'Declaración DIAN') {
    return `Declaración DIAN - ${baseName}${ext}`;
  }

  if (category === 'Garantía') {
    if (cleanEq) {
      return `Garantía - ${cleanEq}${ext}`;
    }
    return `Garantía - ${baseName}${ext}`;
  }

  return originalFileName;
};

export interface UnifiedAttachmentSelectorProps {
  currentAttachment?: AttachmentResult | null;
  onAttachmentChange: (attachment: AttachmentResult | null) => void;
  allowedExtensions?: string[];
  maxFileSizeMB?: number;
  label?: string;
  suggestedName?: string;
  equipmentName?: string;
  equipmentData?: EquipmentFolderData;
  existingDocumentTypes?: string[];
  parentFolderId?: string;
  parentFolderName?: string;
  contractContext?: {
    processNumber: string;
    clientName: string;
    contractFolderId?: string;
    contractFolderName?: string;
  };
  onDocumentClassified?: (docInfo: {
    driveFile: DriveFileItem;
    classification: string;
    equipmentName?: string;
    invimaNumber?: string;
  }) => void;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

export const UnifiedAttachmentSelector: React.FC<UnifiedAttachmentSelectorProps> = ({
  currentAttachment,
  onAttachmentChange,
  allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xlsx'],
  maxFileSizeMB = 35,
  label = 'Adjuntar Archivo de Soporte o Enlace en la Nube',
  suggestedName = '',
  equipmentName = '',
  equipmentData,
  existingDocumentTypes = [],
  parentFolderId,
  parentFolderName,
  contractContext,
  onDocumentClassified,
}) => {
  type ActiveMode = 'local' | 'cloud_link' | 'drive_picker';
  const [mode, setMode] = useState<ActiveMode>('local');
  const [showAttachmentPreview, setShowAttachmentPreview] = useState<boolean>(true);

  // Local file state
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Cloud link state
  const [cloudUrlInput, setCloudUrlInput] = useState('');
  const [customLinkName, setCustomLinkName] = useState(suggestedName);
  const [customLinkSize, setCustomLinkSize] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);

  // Google Drive state
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [isLoadingDriveFiles, setIsLoadingDriveFiles] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [driveSearchQuery, setDriveSearchQuery] = useState('');
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveSuccess, setDriveSuccess] = useState<string | null>(null);

  // Base breadcrumbs (Root of Drive or Contract/Parent Folder)
  const baseBreadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    if (contractContext?.contractFolderId) {
      return [
        { id: 'all', name: 'Mi Google Drive' },
        {
          id: contractContext.contractFolderId,
          name: contractContext.contractFolderName || `Contrato ${contractContext.processNumber} - ${contractContext.clientName}`,
        },
      ];
    }
    if (parentFolderId && parentFolderName) {
      return [
        { id: 'all', name: 'Mi Google Drive' },
        { id: parentFolderId, name: parentFolderName },
      ];
    }
    return [{ id: 'all', name: 'Mi Google Drive' }];
  }, [contractContext?.contractFolderId, contractContext?.contractFolderName, contractContext?.processNumber, parentFolderId, parentFolderName]);

  // Folder navigation in Drive
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>(baseBreadcrumbs);
  const currentFolder = breadcrumbs[breadcrumbs.length - 1] || { id: 'all', name: 'Mi Google Drive' };

  // Folder creation state (1 single button with equipment data)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const driveUploadInputRef = useRef<HTMLInputElement | null>(null);

  // Replacement state
  const [fileToReplace, setFileToReplace] = useState<DriveFileItem | null>(null);
  const [isReplacingFile, setIsReplacingFile] = useState(false);
  const replaceFileInputRef = useRef<HTMLInputElement | null>(null);

  // Deletion state
  const [fileToDelete, setFileToDelete] = useState<DriveFileItem | null>(null);
  const [isDeletingFile, setIsDeletingFile] = useState(false);

  // Preset upload tag state (Ficha Técnica, Registro INVIMA, Manual)
  const [uploadPresetTag, setUploadPresetTag] = useState<string | null>(null);

  // Drag and Drop on Google Drive area
  const [isDraggingOverDrive, setIsDraggingOverDrive] = useState(false);
  const driveDragCounterRef = useRef(0);

  // Classification & Upload Modal State
  const [isClassificationModalOpen, setIsClassificationModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingDriveItem, setPendingDriveItem] = useState<DriveFileItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Ficha Técnica');
  const [customDriveFileName, setCustomDriveFileName] = useState<string>('');
  const [customInvimaNumber, setCustomInvimaNumber] = useState<string>('');
  const [isUploadingClassified, setIsUploadingClassified] = useState(false);
  const [showClassificationGrid, setShowClassificationGrid] = useState<boolean>(false);
  const [resolvedDriveBlobUrl, setResolvedDriveBlobUrl] = useState<string | null>(null);
  const [resolvedDriveBlob, setResolvedDriveBlob] = useState<Blob | null>(null);
  const [isLoadingDriveBlob, setIsLoadingDriveBlob] = useState<boolean>(false);

  // Build target folder name in order: Número de parte, Nombre del equipo, Marca, Modelo
  const targetFolderName = useMemo(() => {
    return buildEquipmentFolderName(equipmentData, equipmentName);
  }, [equipmentData, equipmentName]);

  // Clean equipment name for labels and classifications
  const displayEquipmentName = useMemo(() => {
    return equipmentData?.name || equipmentData?.equipmentName || equipmentName || '';
  }, [equipmentData, equipmentName]);

  // Equipment unique identification key
  const equipmentKey = useMemo(() => {
    return (
      equipmentData?.id ||
      equipmentData?.partNumber ||
      equipmentData?.code ||
      equipmentName ||
      displayEquipmentName ||
      ''
    ).trim().toLowerCase();
  }, [equipmentData, targetFolderName, displayEquipmentName]);

  // Persisted known equipment folder state
  const [knownEquipmentFolder, setKnownEquipmentFolder] = useState<DriveFileItem | null>(null);
  const hasAutoNavigatedRef = useRef<string | null>(null);

  // Strict check if a folder name belongs to THIS equipment:
  // Strictly avoids cross-contamination or loose substring matching (e.g. matching "Monitor" across different monitors)
  const isFolderMatchingThisEquipment = (folderName?: string): boolean => {
    if (!folderName) return false;
    const cleanFName = folderName.toLowerCase().trim();
    const cleanTarget = (targetFolderName || '').toLowerCase().trim();
    const partNum = (equipmentData?.partNumber || equipmentData?.code || '').toLowerCase().trim();
    const fullEqName = (displayEquipmentName || '').toLowerCase().trim();
    const brand = (equipmentData?.brand || '').toLowerCase().trim();
    const model = (equipmentData?.model || '').toLowerCase().trim();

    // 1. Exact match with target folder name
    if (cleanTarget && cleanFName === cleanTarget) return true;

    // 2. Exact match of code/partNumber if at least 2 characters (e.g. "EQ-01" or starts with "EQ-01 -")
    if (partNum && partNum.length >= 2) {
      if (
        cleanFName === partNum ||
        cleanFName.startsWith(partNum + ' -') ||
        cleanFName.startsWith(partNum + ' ') ||
        cleanFName.startsWith(`[${partNum}]`)
      ) {
        return true;
      }
    }

    // 3. Match full name + brand or model (never a single common word like "monitor" or "bomba")
    if (fullEqName && fullEqName.length >= 6) {
      const hasBrand = brand && cleanFName.includes(brand);
      const hasModel = model && cleanFName.includes(model);
      if (cleanFName.includes(fullEqName) && (hasBrand || hasModel || cleanFName === fullEqName)) {
        return true;
      }
    }

    return false;
  };

  // Unique prefixed candidate keys for this equipment (prevents raw string collisions)
  const candidateEquipmentKeys = useMemo(() => {
    const keys: string[] = [];
    if (equipmentData?.id) keys.push(`id_${equipmentData.id.trim().toLowerCase()}`);
    if (equipmentData?.partNumber) keys.push(`code_${equipmentData.partNumber.trim().toLowerCase()}`);
    if (equipmentData?.code) keys.push(`code_${equipmentData.code.trim().toLowerCase()}`);
    if (targetFolderName) keys.push(`name_${targetFolderName.trim().toLowerCase()}`);
    return keys;
  }, [equipmentData?.id, equipmentData?.partNumber, equipmentData?.code, targetFolderName]);

  // Sync known folder from localStorage on mount or equipment change
  useEffect(() => {
    hasAutoNavigatedRef.current = null;
    // Always reset breadcrumbs to base when switching equipment
    setBreadcrumbs(baseBreadcrumbs);

    if (candidateEquipmentKeys.length === 0) {
      setKnownEquipmentFolder(null);
      return;
    }

    try {
      const raw = localStorage.getItem('syd_equipment_drive_folders');
      let matchedFolder: DriveFileItem | null = null;
      if (raw) {
        const map = JSON.parse(raw);
        for (const k of candidateEquipmentKeys) {
          if (map[k]) {
            const candidate = map[k];
            // Strict check: Ensure this folder name ACTUALLY belongs to this equipment
            if (isFolderMatchingThisEquipment(candidate.name)) {
              matchedFolder = candidate;
              break;
            } else {
              // Purge cross-contaminated entry
              delete map[k];
              localStorage.setItem('syd_equipment_drive_folders', JSON.stringify(map));
            }
          }
        }
      }

      setKnownEquipmentFolder(matchedFolder);
      if (matchedFolder) {
        setBreadcrumbs([...baseBreadcrumbs, { id: matchedFolder.id, name: matchedFolder.name }]);
      }
    } catch (_) {
      setKnownEquipmentFolder(null);
    }
  }, [equipmentKey, targetFolderName, baseBreadcrumbs]);

  // Resolve Google Drive file preview as local in-memory Blob URL to prevent Chrome iframe blocking
  useEffect(() => {
    let isCancelled = false;
    let createdUrlToRevoke: string | null = null;

    const resolveDrivePreview = async () => {
      if (!currentAttachment) {
        setResolvedDriveBlob(null);
        setResolvedDriveBlobUrl(null);
        return;
      }

      // If already has direct data: or blob:
      if (
        currentAttachment.fileData &&
        (currentAttachment.fileData.startsWith('data:') || currentAttachment.fileData.startsWith('blob:'))
      ) {
        if (currentAttachment.fileData.startsWith('data:')) {
          try {
            const byteString = atob(currentAttachment.fileData.split(',')[1]);
            const mimeString = currentAttachment.fileData.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            setResolvedDriveBlob(new Blob([ab], { type: mimeString || 'application/pdf' }));
          } catch (_) {}
        } else {
          fetch(currentAttachment.fileData)
            .then((r) => r.blob())
            .then((b) => {
              if (!isCancelled) setResolvedDriveBlob(b);
            })
            .catch(() => {});
        }
        setResolvedDriveBlobUrl(currentAttachment.fileData);
        return;
      }

      const driveId = currentAttachment.driveFileId;
      if (!driveId) {
        setResolvedDriveBlob(null);
        setResolvedDriveBlobUrl(null);
        return;
      }

      setIsLoadingDriveBlob(true);

      // 1. Try local disk cache on server (/api/documents/cached/:driveId)
      try {
        const cachedRes = await fetch(`/api/documents/cached/${driveId}`);
        if (cachedRes.ok) {
          const rawB = await cachedRes.blob();
          const blob = new Blob([rawB], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          createdUrlToRevoke = url;
          if (!isCancelled) {
            setResolvedDriveBlob(blob);
            setResolvedDriveBlobUrl(url);
            setIsLoadingDriveBlob(false);
          }
          return;
        }
      } catch (_) {}

      // 2. Try backend proxy (/api/drive/proxy-file/:driveId)
      try {
        const token = googleWorkspaceService.getAccessToken() || '';
        const proxyRes = await fetch(`/api/drive/proxy-file/${driveId}${token ? `?token=${token}` : ''}`);
        if (proxyRes.ok) {
          const rawB = await proxyRes.blob();
          const blob = new Blob([rawB], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          createdUrlToRevoke = url;
          if (!isCancelled) {
            setResolvedDriveBlob(blob);
            setResolvedDriveBlobUrl(url);
            setIsLoadingDriveBlob(false);
          }
          return;
        }
      } catch (_) {}

      // 3. Try Google Workspace OAuth direct client download
      try {
        const rawB = await googleWorkspaceService.fetchDriveFileBlob(driveId);
        if (rawB && rawB.size > 0) {
          const blob = new Blob([rawB], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          createdUrlToRevoke = url;

          // Cache on server for instant subsequent loads
          try {
            const reader = new FileReader();
            reader.onload = () => {
              if (reader.result) {
                fetch('/api/documents/cache', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: driveId, base64: reader.result as string }),
                }).catch(() => {});
              }
            };
            reader.readAsDataURL(blob);
          } catch (_) {}

          if (!isCancelled) {
            setResolvedDriveBlob(blob);
            setResolvedDriveBlobUrl(url);
            setIsLoadingDriveBlob(false);
          }
          return;
        }
      } catch (fErr) {
        console.warn('Could not fetch Drive file as blob:', fErr);
      }

      if (!isCancelled) {
        setIsLoadingDriveBlob(false);
        setResolvedDriveBlob(null);
        setResolvedDriveBlobUrl(null);
      }
    };

    resolveDrivePreview();

    return () => {
      isCancelled = true;
      if (createdUrlToRevoke) {
        URL.revokeObjectURL(createdUrlToRevoke);
      }
    };
  }, [currentAttachment?.driveFileId, currentAttachment?.fileData]);

  // Helper to persist known equipment folder under all candidate keys
  const saveKnownFolder = (folder: DriveFileItem) => {
    setKnownEquipmentFolder(folder);
    if (candidateEquipmentKeys.length === 0) return;
    try {
      const raw = localStorage.getItem('syd_equipment_drive_folders');
      const map = raw ? JSON.parse(raw) : {};
      const folderEntry = {
        id: folder.id,
        name: folder.name,
        mimeType: folder.mimeType || 'application/vnd.google-apps.folder',
        webViewLink: folder.webViewLink,
      };
      for (const k of candidateEquipmentKeys) {
        map[k] = folderEntry;
      }
      localStorage.setItem('syd_equipment_drive_folders', JSON.stringify(map));
    } catch (_) {}
  };

  // Check if current breadcrumbs/folder is already inside the equipment's folder
  const isInsideEquipmentFolder = useMemo(() => {
    if (currentFolder.id === 'all') return false;
    // If we are at the contract root, we are NOT inside the equipment subfolder yet
    if (contractContext?.contractFolderId && currentFolder.id === contractContext.contractFolderId) {
      return false;
    }
    if (knownEquipmentFolder && (currentFolder.id === knownEquipmentFolder.id || breadcrumbs.some((b) => b.id === knownEquipmentFolder.id))) {
      return true;
    }
    if (isFolderMatchingThisEquipment(currentFolder.name)) return true;

    // Check parent breadcrumbs (ignoring root and contract root)
    return breadcrumbs.some((b) => {
      if (b.id === 'all') return false;
      if (contractContext?.contractFolderId && b.id === contractContext.contractFolderId) return false;
      return isFolderMatchingThisEquipment(b.name);
    });
  }, [targetFolderName, currentFolder, breadcrumbs, equipmentData, displayEquipmentName, knownEquipmentFolder, contractContext]);

  // Check if equipment folder already exists in the current folder listing or cache
  const existingEquipmentFolder = useMemo(() => {
    if (!targetFolderName && !equipmentKey) return null;
    return driveFiles.find((f) => f.mimeType === 'application/vnd.google-apps.folder' && isFolderMatchingThisEquipment(f.name)) || null;
  }, [driveFiles, targetFolderName, equipmentData, displayEquipmentName, equipmentKey]);

  // Sync discovered folder from listing to storage
  useEffect(() => {
    if (existingEquipmentFolder && (!knownEquipmentFolder || knownEquipmentFolder.id !== existingEquipmentFolder.id)) {
      saveKnownFolder(existingEquipmentFolder);
    }
  }, [existingEquipmentFolder]);

  // Overall check: does an equipment folder already exist or are we in it?
  const hasEquipmentFolder = Boolean(
    knownEquipmentFolder ||
    existingEquipmentFolder ||
    isInsideEquipmentFolder
  );

  // Document preset upload indicators (Ficha Técnica, Registro INVIMA, Manual)
  const hasUploadedFT = useMemo(() => {
    return (
      (existingDocumentTypes || []).some((t) => t.toLowerCase().includes('ficha')) ||
      currentAttachment?.classification === 'Ficha Técnica' ||
      driveFiles.some((f) => detectFileClassification(f.name, f.id).id === 'Ficha Técnica')
    );
  }, [existingDocumentTypes, currentAttachment, driveFiles]);

  const hasUploadedINVIMA = useMemo(() => {
    return (
      (existingDocumentTypes || []).some((t) => t.toLowerCase().includes('invima') || t.toLowerCase().includes('sanitario')) ||
      currentAttachment?.classification === 'Registro INVIMA' ||
      driveFiles.some((f) => detectFileClassification(f.name, f.id).id === 'Registro INVIMA')
    );
  }, [existingDocumentTypes, currentAttachment, driveFiles]);

  const hasUploadedManual = useMemo(() => {
    return (
      (existingDocumentTypes || []).some((t) => t.toLowerCase().includes('manual')) ||
      currentAttachment?.classification === 'Manual de Usuario' ||
      driveFiles.some((f) => detectFileClassification(f.name, f.id).id === 'Manual de Usuario')
    );
  }, [existingDocumentTypes, currentAttachment, driveFiles]);

  // Check Drive connection status
  useEffect(() => {
    const hasToken = Boolean(googleWorkspaceService.getAccessToken());
    setIsDriveConnected(hasToken);
  }, []);

  // When suggestedName changes, default customLinkName if empty
  useEffect(() => {
    if (suggestedName && !customLinkName) {
      setCustomLinkName(suggestedName);
    }
  }, [suggestedName]);

  // Auto-navigate into equipment folder as soon as user enters Drive mode
  useEffect(() => {
    if (mode !== 'drive_picker' || !isDriveConnected) return;

    // If already inside equipment folder, nothing to do
    if (isInsideEquipmentFolder) return;

    // 1. If we already know the equipment folder from cache/state: jump in immediately!
    const target = knownEquipmentFolder || existingEquipmentFolder;
    if (target && target.id && currentFolder.id === 'all') {
      if (hasAutoNavigatedRef.current !== target.id) {
        hasAutoNavigatedRef.current = target.id;
        setBreadcrumbs([
          { id: 'all', name: 'Mi Google Drive' },
          { id: target.id, name: target.name },
        ]);
      }
      return;
    }

    // 2. If not yet in cache, search Google Drive for this equipment's folder in the background
    const searchKey = equipmentData?.partNumber || targetFolderName || displayEquipmentName;
    if (!target && searchKey && currentFolder.id === 'all' && hasAutoNavigatedRef.current !== searchKey) {
      hasAutoNavigatedRef.current = searchKey;
      (async () => {
        try {
          const files = await googleWorkspaceService.fetchDriveFiles(searchKey);
          const cleanTarget = targetFolderName.toLowerCase().trim();
          const partNum = (equipmentData?.partNumber || '').toLowerCase().trim();
          const eqName = (displayEquipmentName || '').toLowerCase().trim();

          const found = (files || []).find((f) => {
            if (f.mimeType !== 'application/vnd.google-apps.folder') return false;
            return isFolderMatchingThisEquipment(f.name);
          });

          if (found && currentFolder.id === 'all') {
            saveKnownFolder(found);
            setBreadcrumbs([
              { id: 'all', name: 'Mi Google Drive' },
              { id: found.id, name: found.name },
            ]);
          }
        } catch (e) {
          console.warn('Auto search equipment folder notice:', e);
        }
      })();
    }
  }, [
    mode,
    isDriveConnected,
    knownEquipmentFolder,
    existingEquipmentFolder,
    isInsideEquipmentFolder,
    currentFolder.id,
    targetFolderName,
    equipmentData,
    displayEquipmentName
  ]);

  // Load Drive files when entering drive_picker mode or folder changes
  useEffect(() => {
    if (mode === 'drive_picker' && isDriveConnected) {
      loadDriveFiles(driveSearchQuery, currentFolder.id);
    }
  }, [mode, isDriveConnected, currentFolder.id]);

  // Load files from Google Drive
  const loadDriveFiles = async (query = '', folderId = 'all') => {
    setIsLoadingDriveFiles(true);
    setDriveError(null);
    try {
      const parentId = folderId === 'all' ? undefined : folderId;
      let files: DriveFileItem[] = [];
      if (googleWorkspaceService && typeof (googleWorkspaceService as any).fetchDriveFiles === 'function') {
        files = await (googleWorkspaceService as any).fetchDriveFiles(query, parentId, 60);
      } else if (googleWorkspaceService && typeof (googleWorkspaceService as any).listUserDriveFiles === 'function') {
        files = await (googleWorkspaceService as any).listUserDriveFiles({
          searchQuery: query,
          folderId: parentId,
          pageSize: 60,
          mimeTypeFilter: 'all',
        });
      }

      // If at root and any folder matches this equipment, auto-navigate inside it immediately!
      if (folderId === 'all' && breadcrumbs.length === 1 && !query) {
        const matchingFolder = (files || []).find((f) => {
          if (f.mimeType !== 'application/vnd.google-apps.folder') return false;
          if (knownEquipmentFolder && f.id === knownEquipmentFolder.id) return true;
          return isFolderMatchingThisEquipment(f.name);
        });

        if (matchingFolder) {
          saveKnownFolder(matchingFolder);
          setBreadcrumbs([
            { id: 'all', name: 'Mi Google Drive' },
            { id: matchingFolder.id, name: matchingFolder.name },
          ]);
          return;
        }
      }

      setDriveFiles(files || []);
    } catch (err: any) {
      console.error('Error fetching Google Drive files:', err);
      setDriveError(err.message || 'No se pudieron cargar los archivos de Google Drive.');
    } finally {
      setIsLoadingDriveFiles(false);
    }
  };

  // Connect Google Drive via OAuth
  const handleConnectDrive = async () => {
    setIsConnectingDrive(true);
    setDriveError(null);
    try {
      if (googleWorkspaceService && typeof (googleWorkspaceService as any).ensureInitialized === 'function') {
        try {
          await (googleWorkspaceService as any).ensureInitialized();
        } catch (initErr) {
          console.warn('ensureInitialized notice:', initErr);
        }
      }
      if (googleWorkspaceService && typeof (googleWorkspaceService as any).connectGoogleWorkspace === 'function') {
        await (googleWorkspaceService as any).connectGoogleWorkspace();
      } else if (googleWorkspaceService && typeof (googleWorkspaceService as any).initiateAuthFlow === 'function') {
        await (googleWorkspaceService as any).initiateAuthFlow();
      } else {
        throw new Error('El servicio de Google Workspace no está inicializado.');
      }
      setIsDriveConnected(true);
      setDriveSuccess('✓ Conectado exitosamente con Google Workspace / Drive');
      setTimeout(() => setDriveSuccess(null), 4000);
      await loadDriveFiles('', currentFolder.id);
    } catch (err: any) {
      console.error('Error connecting to Drive:', err);
      setDriveError(err.message || 'No se pudo conectar con Google Drive.');
    } finally {
      setIsConnectingDrive(false);
    }
  };

  // Navigate into a folder
  const handleOpenFolder = (folder: DriveFileItem) => {
    setDriveSearchQuery('');
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };

  // Jump to a specific breadcrumb
  const handleJumpToBreadcrumb = (index: number) => {
    setDriveSearchQuery('');
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  };

  // Go up one level
  const handleGoUpOneLevel = () => {
    if (breadcrumbs.length > 1) {
      setDriveSearchQuery('');
      setBreadcrumbs((prev) => prev.slice(0, prev.length - 1));
    }
  };

  // Create folder: Directly created with equipment data (prevents duplicates if already inside or existing)
  const handleCreateEquipmentFolder = async () => {
    const targetName = targetFolderName.trim();
    if (!targetName) {
      setDriveError('No se especificaron datos del equipo para crear la carpeta.');
      return;
    }

    // If already inside equipment folder, do nothing and notify
    if (isInsideEquipmentFolder) {
      setDriveSuccess(`Ya te encuentras dentro de la carpeta del equipo: "${currentFolder.name}"`);
      setTimeout(() => setDriveSuccess(null), 3500);
      return;
    }

    // If existing folder is already known or found, verify that it actually matches this equipment
    const folderToOpen = existingEquipmentFolder || knownEquipmentFolder;
    if (folderToOpen && isFolderMatchingThisEquipment(folderToOpen.name)) {
      handleOpenFolder(folderToOpen);
      setDriveSuccess(`✓ Carpeta "${folderToOpen.name}" ya existe y fue abierta.`);
      setTimeout(() => setDriveSuccess(null), 3500);
      return;
    }

    setIsCreatingFolder(true);
    setDriveError(null);
    try {
      // Determine parent folder:
      // If contractContext is provided, equipment subfolder MUST be inside the contract folder!
      let parentId = currentFolder.id === 'all'
        ? (contractContext?.contractFolderId || parentFolderId || undefined)
        : currentFolder.id;

      // If contract context is present but contract folder was not yet created in Drive, create contract parent folder first!
      if (contractContext && !parentId) {
        const rawContractName = `${contractContext.processNumber} - ${contractContext.clientName}`.trim();
        const contractFolderName = rawContractName.replace(/[\\/:*?"<>|]/g, '-').trim() || `Contrato-${contractContext.processNumber}`;
        const contractFolderItem = await googleWorkspaceService.createDriveFolder(contractFolderName);
        parentId = contractFolderItem.id;
        try {
          const rawCF = localStorage.getItem('syd_contract_drive_folders');
          const cMap = rawCF ? JSON.parse(rawCF) : {};
          const pKey = contractContext.processNumber.toLowerCase().trim();
          cMap[pKey] = {
            folderId: contractFolderItem.id,
            folderName: contractFolderItem.name,
            webViewLink: contractFolderItem.webViewLink,
            equipmentSubfolders: {},
          };
          localStorage.setItem('syd_contract_drive_folders', JSON.stringify(cMap));
        } catch (_) {}
      }

      // First check Drive under this parent if folder already exists before creating another
      try {
        const matches = await googleWorkspaceService.fetchDriveFiles(targetName, parentId);
        const existing = matches.find(
          (f) => f.mimeType === 'application/vnd.google-apps.folder' && isFolderMatchingThisEquipment(f.name)
        );
        if (existing) {
          saveKnownFolder(existing);
          handleOpenFolder(existing);
          setDriveSuccess(`✓ Carpeta existente "${existing.name}" encontrada y abierta (se evitó duplicar)`);
          setTimeout(() => setDriveSuccess(null), 4000);
          return;
        }
      } catch (searchErr) {
        console.warn('Check existing folder notice:', searchErr);
      }

      const created = await googleWorkspaceService.createDriveFolder(targetName, parentId);
      saveKnownFolder(created);

      // If in a contract context, save this subfolder inside the contract's equipment subfolders record
      if (contractContext?.processNumber) {
        try {
          const rawCF = localStorage.getItem('syd_contract_drive_folders');
          const cMap = rawCF ? JSON.parse(rawCF) : {};
          const pKey = contractContext.processNumber.toLowerCase().trim();
          if (cMap[pKey]) {
            const subEntry = {
              folderId: created.id,
              folderName: created.name,
              webViewLink: created.webViewLink,
            };
            cMap[pKey].equipmentSubfolders = {
              ...(cMap[pKey].equipmentSubfolders || {}),
              [equipmentKey]: subEntry,
            };
            if (equipmentData?.code) {
              cMap[pKey].equipmentSubfolders[equipmentData.code.toLowerCase().trim()] = subEntry;
            }
            if (equipmentData?.id) {
              cMap[pKey].equipmentSubfolders[equipmentData.id.toLowerCase().trim()] = subEntry;
            }
            localStorage.setItem('syd_contract_drive_folders', JSON.stringify(cMap));
          }
        } catch (_) {}
      }

      setDriveSuccess(`✓ Carpeta "${created.name}" creada y lista en Google Drive`);
      setTimeout(() => setDriveSuccess(null), 5000);

      // Open into the folder so user is immediately inside
      handleOpenFolder(created);
      await loadDriveFiles(driveSearchQuery, created.id);
    } catch (err: any) {
      console.error('Error creating folder in Drive:', err);
      setDriveError(err.message || 'No se pudo crear la carpeta en Google Drive.');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Drag and Drop handlers for the Google Drive Area
  const handleDriveDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    driveDragCounterRef.current += 1;
    setIsDraggingOverDrive(true);
  };

  const handleDriveDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    driveDragCounterRef.current -= 1;
    if (driveDragCounterRef.current <= 0) {
      driveDragCounterRef.current = 0;
      setIsDraggingOverDrive(false);
    }
  };

  const handleDriveDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDriveDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    driveDragCounterRef.current = 0;
    setIsDraggingOverDrive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const detected = detectFileClassification(file.name, '');
      const presetToUse = uploadPresetTag || (detected.id !== 'Documento' ? detected.id : 'Ficha Técnica');
      handleQueueFileForClassification(file, presetToUse, Boolean(uploadPresetTag));
    }
  };

  // Open Classification Modal with a local File
  const handleQueueFileForClassification = (
    file: File,
    initialPreset: string = 'Ficha Técnica',
    isFromPresetButton: boolean = false
  ) => {
    setPendingFile(file);
    setPendingDriveItem(null);
    setSelectedCategory(initialPreset);
    // If user clicked a preset button (+ Ficha Técnica, + INVIMA, + Manual) or tag is present,
    // the document is already identified, so hide the classification selection grid!
    setShowClassificationGrid(!isFromPresetButton && !uploadPresetTag);
    const initialInvima = equipmentData?.invimaRecordNumber || equipmentData?.invimaNumber || '';
    setCustomInvimaNumber(initialInvima);

    const eqName = displayEquipmentName;
    const suggested = generateSuggestedFileName(file.name, initialPreset, eqName, initialInvima);
    setCustomDriveFileName(suggested);
    setIsClassificationModalOpen(true);
  };

  // Open Classification Modal to reclassify an existing Drive item
  const handleOpenReclassifyModal = (driveItem: DriveFileItem) => {
    setPendingFile(null);
    setPendingDriveItem(driveItem);
    const detected = detectFileClassification(driveItem.name, driveItem.id);
    setSelectedCategory(detected.id === 'Documento' ? 'Ficha Técnica' : detected.id);
    const stored = getStoredClassifications()[driveItem.id];
    setCustomInvimaNumber(stored?.invimaNumber || '');
    setCustomDriveFileName(driveItem.name);
    setShowClassificationGrid(true);
    setIsClassificationModalOpen(true);
  };

  // Update classification category in modal and auto-suggest new name
  const handleSelectModalCategory = (catId: string) => {
    setSelectedCategory(catId);
    const origName = pendingFile ? pendingFile.name : pendingDriveItem?.name || 'documento.pdf';
    const eqName = displayEquipmentName;
    const suggested = generateSuggestedFileName(origName, catId, eqName, customInvimaNumber);
    setCustomDriveFileName(suggested);
  };

  // Update INVIMA number and recalculate filename if INVIMA category is active
  const handleInvimaNumberChange = (newInvima: string) => {
    setCustomInvimaNumber(newInvima);
    if (selectedCategory === 'Registro INVIMA') {
      const origName = pendingFile ? pendingFile.name : pendingDriveItem?.name || 'documento.pdf';
      const eqName = displayEquipmentName;
      const suggested = generateSuggestedFileName(origName, 'Registro INVIMA', eqName, newInvima);
      setCustomDriveFileName(suggested);
    }
  };

  // Trigger upload with preset tag (Ficha Técnica, Registro INVIMA, Manual)
  const handleTriggerPresetUpload = (presetTag: string) => {
    setUploadPresetTag(presetTag);
    if (driveUploadInputRef.current) {
      driveUploadInputRef.current.click();
    }
  };

  // When user selects a file via hidden input
  const handleDriveFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isPreset = Boolean(uploadPresetTag);
    handleQueueFileForClassification(file, uploadPresetTag || 'Ficha Técnica', isPreset);
    e.target.value = '';
  };

  // Perform classified upload and save to Drive
  const handleConfirmClassificationAndUpload = async () => {
    if (!pendingFile && !pendingDriveItem) return;

    setIsUploadingClassified(true);
    setDriveError(null);

    try {
      const eqName = displayEquipmentName;
      const partNum = equipmentData?.partNumber || '';

      if (pendingFile) {
        // Resolve target folder: if in root ('all'), place into equipment's folder automatically
        let parentId: string | undefined = currentFolder.id === 'all' ? undefined : currentFolder.id;
        if (!parentId && targetFolderName) {
          try {
            if (existingEquipmentFolder?.id) {
              parentId = existingEquipmentFolder.id;
            } else {
              const eqFolder = await googleWorkspaceService.createDriveFolder(targetFolderName.trim());
              if (eqFolder?.id) {
                parentId = eqFolder.id;
              }
            }
          } catch (fErr) {
            console.warn('Could not auto-resolve equipment folder in Drive:', fErr);
          }
        }

        const finalName = customDriveFileName.trim() || pendingFile.name;

        const localBase64 = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => resolve('');
          r.readAsDataURL(pendingFile);
        });

        const uploaded = await googleWorkspaceService.uploadFileToFolder(
          pendingFile,
          finalName,
          pendingFile.type || 'application/pdf',
          parentId
        );

        // Cache on server for instant zero-auth preview
        if (localBase64) {
          fetch('/api/documents/cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: uploaded.id, base64: localBase64 }),
          }).catch(() => {});
        }

        // Save classification metadata
        saveFileClassification(uploaded.id, {
          classification: selectedCategory,
          equipmentName: eqName,
          partNumber: partNum,
          invimaNumber: customInvimaNumber.trim() || undefined,
          savedAt: new Date().toISOString(),
          customTitle: finalName,
        });

        setDriveSuccess(
          `✓ Archivo "${uploaded.name}" subido y clasificado como "${selectedCategory}" con éxito`
        );
        setTimeout(() => setDriveSuccess(null), 5000);

        // Close modal and clear
        setIsClassificationModalOpen(false);
        setPendingFile(null);
        setUploadPresetTag(null);

        // Reload Drive files to display in current folder immediately
        await loadDriveFiles(driveSearchQuery, currentFolder.id);

        // Auto-select as current attachment with preserved local base64
        handleSelectDriveItem(uploaded, false, selectedCategory, customInvimaNumber, localBase64);

        // Notify parent callback if provided
        if (onDocumentClassified) {
          onDocumentClassified({
            driveFile: uploaded,
            classification: selectedCategory,
            equipmentName: eqName,
            invimaNumber: customInvimaNumber.trim() || undefined,
          });
        }
      } else if (pendingDriveItem) {
        // Mode 2: Re-classify existing file in Google Drive
        saveFileClassification(pendingDriveItem.id, {
          classification: selectedCategory,
          equipmentName: eqName,
          partNumber: partNum,
          invimaNumber: customInvimaNumber.trim() || undefined,
          savedAt: new Date().toISOString(),
          customTitle: customDriveFileName.trim() || pendingDriveItem.name,
        });

        setDriveSuccess(
          `✓ Archivo "${pendingDriveItem.name}" clasificado como "${selectedCategory}"`
        );
        setTimeout(() => setDriveSuccess(null), 4000);

        setIsClassificationModalOpen(false);
        setPendingDriveItem(null);

        // Reload files to reflect badge
        await loadDriveFiles(driveSearchQuery, currentFolder.id);

        // If currently attached, update
        if (currentAttachment?.driveFileId === pendingDriveItem.id) {
          handleSelectDriveItem(pendingDriveItem, false, selectedCategory, customInvimaNumber);
        }

        if (onDocumentClassified) {
          onDocumentClassified({
            driveFile: pendingDriveItem,
            classification: selectedCategory,
            equipmentName: eqName,
            invimaNumber: customInvimaNumber.trim() || undefined,
          });
        }
      }
    } catch (err: any) {
      console.error('Error uploading/classifying file in Drive:', err);
      setDriveError(err.message || 'Error al subir o clasificar el archivo en Google Drive.');
    } finally {
      setIsUploadingClassified(false);
    }
  };

  // Initiate file replacement
  const handleInitiateReplace = (file: DriveFileItem) => {
    setFileToReplace(file);
    if (replaceFileInputRef.current) {
      replaceFileInputRef.current.click();
    }
  };

  // Perform file replacement
  const handlePerformFileReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFile = e.target.files?.[0];
    if (!newFile || !fileToReplace) return;

    setIsReplacingFile(true);
    setDriveError(null);
    try {
      const updated = await googleWorkspaceService.updateDriveFile(
        fileToReplace.id,
        newFile,
        newFile.name
      );

      setDriveSuccess(
        `✓ Archivo "${fileToReplace.name}" reemplazado exitosamente por "${newFile.name}" en Google Drive`
      );
      setTimeout(() => setDriveSuccess(null), 5000);

      // If this file is currently attached, update attachment
      if (currentAttachment?.driveFileId === fileToReplace.id) {
        handleSelectDriveItem(updated, false);
      }

      setFileToReplace(null);
      await loadDriveFiles(driveSearchQuery, currentFolder.id);
    } catch (err: any) {
      console.error('Error replacing file in Drive:', err);
      setDriveError(err.message || 'Error al cambiar el archivo en Google Drive.');
    } finally {
      setIsReplacingFile(false);
      if (replaceFileInputRef.current) {
        replaceFileInputRef.current.value = '';
      }
    }
  };

  // Confirm delete file or folder
  const handleConfirmDeleteDriveFile = async () => {
    if (!fileToDelete) return;

    setIsDeletingFile(true);
    setDriveError(null);
    try {
      await googleWorkspaceService.deleteDriveFile(fileToDelete.id);
      setDriveSuccess(`✓ Elemento "${fileToDelete.name}" eliminado de Google Drive`);
      setTimeout(() => setDriveSuccess(null), 4000);

      // If active attachment was this file, clear it
      if (currentAttachment?.driveFileId === fileToDelete.id) {
        onAttachmentChange(null);
      }

      setFileToDelete(null);
      await loadDriveFiles(driveSearchQuery, currentFolder.id);
    } catch (err: any) {
      console.error('Error deleting file in Drive:', err);
      setDriveError(err.message || 'No se pudo eliminar el archivo de Google Drive.');
    } finally {
      setIsDeletingFile(false);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle local file selection
  const processLocalFile = (file: File) => {
    setLocalError(null);

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      setLocalError(
        `Formato no admitido ("${file.name}"). Formatos permitidos: ${allowedExtensions.join(', ')}`
      );
      return;
    }

    if (file.size > maxFileSizeMB * 1024 * 1024) {
      setLocalError(`El archivo supera el límite máximo permitido de ${maxFileSizeMB} MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      const result: AttachmentResult = {
        fileName: file.name,
        fileSize: formatFileSize(file.size),
        fileData: base64,
        fileType: file.type || 'application/octet-stream',
        isCloudLink: false,
        equipmentName: displayEquipmentName,
      };
      onAttachmentChange(result);
    };
    reader.readAsDataURL(file);
  };

  const handleLocalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processLocalFile(e.dataTransfer.files[0]);
    }
  };

  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processLocalFile(e.target.files[0]);
    }
  };

  // Handle manual cloud link
  const handleApplyCloudLink = (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError(null);
    setLinkSuccess(null);

    const trimmedUrl = cloudUrlInput.trim();
    if (!trimmedUrl) {
      setLinkError('Por favor ingrese una URL válida.');
      return;
    }

    if (!isHttpUrl(trimmedUrl)) {
      setLinkError('La URL debe comenzar con http:// o https://');
      return;
    }

    const analysis = analyzeCloudUrl(trimmedUrl);
    const effectiveName = customLinkName.trim() || analysis.suggestedFileName || 'Documento en la Nube';
    const effectiveSize = customLinkSize.trim() || 'Enlace en la Nube';

    const result: AttachmentResult = {
      fileName: effectiveName,
      fileSize: effectiveSize,
      fileData: trimmedUrl,
      fileUrl: trimmedUrl,
      downloadUrl: analysis.downloadUrl,
      isCloudLink: true,
      cloudProvider: analysis.provider,
      driveFileId: analysis.fileId,
      equipmentName: displayEquipmentName,
    };

    onAttachmentChange(result);
    setLinkSuccess('✓ Enlace vinculado exitosamente.');
    setTimeout(() => setLinkSuccess(null), 3000);
  };

  // Select an item from Google Drive
  const handleSelectDriveItem = (
    driveItem: DriveFileItem,
    asFolder = false,
    explicitClassification?: string,
    invimaNum?: string,
    localFileData?: string
  ) => {
    const isFolder = asFolder || driveItem.mimeType === 'application/vnd.google-apps.folder';
    const info = analyzeCloudUrl(driveItem.webViewLink || '');

    const sizeKB = driveItem.size ? Number(driveItem.size) / 1024 : 0;
    const sizeStr = isFolder
      ? 'Carpeta en Google Drive'
      : sizeKB > 1024
      ? `${(sizeKB / 1024).toFixed(1)} MB (Google Drive)`
      : sizeKB > 0
      ? `${sizeKB.toFixed(0)} KB (Google Drive)`
      : 'Google Drive';

    const classified = explicitClassification || detectFileClassification(driveItem.name, driveItem.id).id;

    const result: AttachmentResult = {
      fileName: driveItem.name,
      fileSize: sizeStr,
      fileData: localFileData || driveItem.webViewLink,
      fileUrl: driveItem.webViewLink,
      downloadUrl: isFolder ? driveItem.webViewLink : info.downloadUrl,
      isCloudLink: true,
      cloudProvider: 'google_drive',
      driveFileId: driveItem.id,
      fileType: driveItem.mimeType || (isFolder ? 'application/vnd.google-apps.folder' : 'application/pdf'),
      isFolder: isFolder,
      classification: classified !== 'Documento' ? classified : undefined,
      equipmentName: displayEquipmentName,
      invimaNumber: invimaNum,
    };

    if (localFileData) {
      setResolvedDriveBlobUrl(localFileData);
      if (localFileData.startsWith('data:')) {
        try {
          const byteString = atob(localFileData.split(',')[1]);
          const mimeString = localFileData.split(',')[0].split(':')[1].split(';')[0];
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          setResolvedDriveBlob(new Blob([ab], { type: mimeString || 'application/pdf' }));
        } catch (_) {}
      } else if (localFileData.startsWith('blob:')) {
        fetch(localFileData)
          .then((r) => r.blob())
          .then((b) => setResolvedDriveBlob(b))
          .catch(() => {});
      }
    }

    onAttachmentChange(result);
  };

  const handleRemoveCurrent = () => {
    setResolvedDriveBlob(null);
    setResolvedDriveBlobUrl(null);
    onAttachmentChange(null);
    setCloudUrlInput('');
    setLocalError(null);
    setLinkError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // =========================================================================
  // RENDER: CURRENT ATTACHED CARD (CLEAN, PROMINENT, WITH CLASSIFICATION BADGE)
  // =========================================================================
  if (currentAttachment) {
    const isCloud =
      currentAttachment.isCloudLink ||
      isHttpUrl(currentAttachment.fileData) ||
      isHttpUrl(currentAttachment.fileUrl);
    const effectiveUrl = currentAttachment.fileUrl || currentAttachment.fileData;
    const provider =
      currentAttachment.cloudProvider || (isCloud ? analyzeCloudUrl(effectiveUrl || '').provider : undefined);
    const isFolder = Boolean(
      currentAttachment.isFolder ||
      currentAttachment.fileType === 'application/vnd.google-apps.folder' ||
      (effectiveUrl && effectiveUrl.includes('/folders/'))
    );

    const classificationBadge = currentAttachment.classification
      ? detectFileClassification(currentAttachment.fileName, currentAttachment.driveFileId)
      : null;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs sm:text-sm font-black text-slate-200 block tracking-wide">
            {label}
          </label>
          <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Documento / Destino Asignado</span>
          </span>
        </div>

        {/* EXPANDED PROMINENT ATTACHMENT CARD */}
        <div
          className={`border-2 rounded-2xl p-4 sm:p-5 transition-all shadow-xl animate-fadeIn ${
            isFolder
              ? 'bg-gradient-to-r from-[#17253b] via-[#1f2e45] to-[#17253b] border-amber-400/70 shadow-amber-500/10'
              : isCloud
              ? 'bg-gradient-to-r from-[#122238] via-[#182d49] to-[#122238] border-[#38bdf8]/70 shadow-sky-500/10'
              : 'bg-gradient-to-r from-[#122424] via-[#163333] to-[#122424] border-emerald-500/70 shadow-emerald-500/10'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Left: Icon & Title & Badges */}
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div
                className={`p-3.5 rounded-2xl border-2 shrink-0 shadow-inner ${
                  isFolder
                    ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                    : isCloud
                    ? 'bg-sky-500/20 border-sky-400/60 text-sky-300'
                    : 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                }`}
              >
                {isFolder ? (
                  <Folder className="w-7 h-7 text-amber-400" />
                ) : isCloud ? (
                  <HardDrive className="w-7 h-7 text-sky-400" />
                ) : (
                  <FileText className="w-7 h-7 text-emerald-400" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-black text-sm sm:text-base text-white truncate max-w-[280px] sm:max-w-lg">
                    {currentAttachment.fileName}
                  </span>

                  {/* Classification Badge if present */}
                  {classificationBadge && (
                    <span
                      className={`text-[11px] font-black px-2.5 py-0.5 rounded-lg border flex items-center gap-1 ${classificationBadge.badgeClass}`}
                    >
                      <span>{classificationBadge.icon}</span>
                      <span>{classificationBadge.label}</span>
                    </span>
                  )}

                  {isFolder ? (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40">
                      📁 Carpeta Google Drive
                    </span>
                  ) : isCloud ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30">
                      ☁️ {provider === 'google_drive' ? 'Google Drive' : 'Nube'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      💾 Archivo Local
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-300 flex-wrap">
                  <span>{currentAttachment.fileSize}</span>
                  {displayEquipmentName && (
                    <span className="text-slate-400">
                      • Equipo: <strong className="text-amber-300">{displayEquipmentName}</strong>
                    </span>
                  )}
                  {effectiveUrl && (
                    <a
                      href={effectiveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#38bdf8] hover:text-[#7dd3fc] inline-flex items-center gap-1 font-bold underline"
                    >
                      <span>Abrir en Google Drive</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => setShowAttachmentPreview(!showAttachmentPreview)}
                className="px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-600 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                title={showAttachmentPreview ? 'Ocultar vista previa del archivo' : 'Mostrar vista previa del archivo'}
              >
                {showAttachmentPreview ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-sky-400" />}
                <span>{showAttachmentPreview ? 'Ocultar Vista Previa' : 'Ver Vista Previa'}</span>
              </button>

              <button
                type="button"
                onClick={handleRemoveCurrent}
                className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border border-blue-400/40 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                title="Cambiar o reemplazar este archivo por otro"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Cambiar</span>
              </button>

              {currentAttachment.driveFileId && (
                <button
                  type="button"
                  onClick={() => {
                    handleOpenReclassifyModal({
                      id: currentAttachment.driveFileId!,
                      name: currentAttachment.fileName,
                      mimeType: currentAttachment.fileType || '',
                      webViewLink: currentAttachment.fileUrl,
                    });
                  }}
                  className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                  title="Cambiar la clasificación (Ficha Técnica, INVIMA, etc.)"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Clasificar</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleRemoveCurrent}
                className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-rose-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                title="Quitar este archivo adjunto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Quitar</span>
              </button>
            </div>
          </div>

          {/* FILE PREVIEW CONTAINER ("aqui quiero que se vea una vista previa del archivo y no asi") */}
          {!isFolder && (
            <div className="mt-4 pt-3.5 border-t border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-sky-400" />
                  <span>Vista Previa del Documento:</span>
                  <strong className="text-white truncate max-w-[200px] sm:max-w-md">{currentAttachment.fileName}</strong>
                </span>

                {effectiveUrl && (
                  <a
                    href={effectiveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/40 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    title="Abrir a pantalla completa en una nueva pestaña"
                  >
                    <span>Pantalla Completa</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {showAttachmentPreview && (() => {
                const isImage =
                  currentAttachment.fileType?.startsWith('image/') ||
                  /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(currentAttachment.fileName) ||
                  currentAttachment.fileData?.startsWith('data:image/');

                const isPdf =
                  /\.(pdf)$/i.test(currentAttachment.fileName) ||
                  currentAttachment.fileType === 'application/pdf' ||
                  currentAttachment.fileData?.startsWith('data:application/pdf');

                const hasLocalData =
                  Boolean(currentAttachment.fileData && (currentAttachment.fileData.startsWith('data:') || currentAttachment.fileData.startsWith('blob:')));

                // Normalize PDF data URI if browser stored it with octet-stream MIME
                const normalizedPdfData = (() => {
                  if (!currentAttachment.fileData) return null;
                  if (currentAttachment.fileData.startsWith('blob:') || currentAttachment.fileData.startsWith('data:application/pdf')) {
                    return currentAttachment.fileData;
                  }
                  if (currentAttachment.fileData.startsWith('data:') && (isPdf || !isImage)) {
                    return currentAttachment.fileData.replace(/^data:[^;]*/, 'data:application/pdf');
                  }
                  return null;
                })();

                return (
                  <div className="relative w-full rounded-xl overflow-hidden border-2 border-slate-700/80 bg-slate-950 shadow-2xl animate-fadeIn">
                    {/* 1. Prioritize uploaded/local Image preview */}
                    {isImage ? (
                      <div className="max-h-96 p-3 flex items-center justify-center bg-slate-950">
                        <img
                          src={resolvedDriveBlobUrl || currentAttachment.fileData || currentAttachment.fileUrl}
                          alt={currentAttachment.fileName}
                          className="max-h-80 sm:max-h-92 w-auto object-contain rounded-lg shadow-md"
                        />
                      </div>
                    ) : isLoadingDriveBlob ? (
                      /* 2. Loading state while fetching Drive PDF blob */
                      <div className="w-full h-80 sm:h-96 flex flex-col items-center justify-center bg-slate-950 text-slate-300 gap-3">
                        <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
                        <span className="text-sm font-bold text-white">Cargando vista previa del documento...</span>
                        <span className="text-xs text-slate-400">Preparando el visor integrado de alta resolución</span>
                      </div>
                    ) : resolvedDriveBlob ? (
                      /* 3. Render native PDF via HTML5 Canvas (Never blocked by Chrome) */
                      <div className="w-full h-80 sm:h-96 overflow-hidden bg-slate-950 flex flex-col">
                        <PdfCanvasViewer
                          blob={resolvedDriveBlob}
                          filename={currentAttachment.fileName}
                          blobUrl={resolvedDriveBlobUrl || undefined}
                          onOpenInNewTab={() => {
                            if (resolvedDriveBlobUrl) window.open(resolvedDriveBlobUrl, '_blank');
                          }}
                        />
                      </div>
                    ) : resolvedDriveBlobUrl || (hasLocalData && normalizedPdfData) ? (
                      /* Fallback PDF frame */
                      <iframe
                        src={resolvedDriveBlobUrl || normalizedPdfData || ''}
                        className="w-full h-80 sm:h-96 border-0 bg-slate-950"
                        title={`Vista previa PDF: ${currentAttachment.fileName}`}
                      />
                    ) : (
                      /* 4. Elegant Document Card with Direct Open (Never shows Chrome blocked page) */
                      <div className="p-8 text-center space-y-3 bg-[#0d1829] rounded-xl border border-slate-700/80">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-400/40 flex items-center justify-center mx-auto shadow-md">
                          <FileType className="w-8 h-8" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{currentAttachment.fileName}</p>
                          <p className="text-xs text-slate-400 mt-1">{currentAttachment.fileSize} • Archivo oficial en Google Drive</p>
                        </div>
                        <div className="flex items-center justify-center gap-2 pt-2">
                          <a
                            href={effectiveUrl || (currentAttachment.driveFileId ? `https://drive.google.com/file/d/${currentAttachment.driveFileId}/view` : '#')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-lg transition"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Abrir documento en Google Drive</span>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: ATTACHMENT SELECTOR (LARGE, SPACIOUS WITH FOLDERS & DRIVE DRILLDOWN)
  // =========================================================================
  return (
    <div className="space-y-3">
      {/* Hidden input for replacing a file in Google Drive */}
      <input
        ref={replaceFileInputRef}
        type="file"
        onChange={handlePerformFileReplace}
        className="hidden"
        id="drive-replace-file-input"
      />

      {/* Top Header: Label & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <label className="text-xs sm:text-sm font-black text-slate-200 block tracking-wide">
            {label}
          </label>
          <span className="text-[11px] text-slate-400">
            Sube un archivo local, vincula un enlace o arrastra directamente a Google Drive
          </span>
        </div>

        {/* Large Mode Selector Tabs */}
        <div className="flex items-center bg-[#0d1624] p-1 rounded-xl border border-[#223652] text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMode('local')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-2 cursor-pointer ${
              mode === 'local'
                ? 'bg-[#1e3450] text-[#38bdf8] shadow-md border border-[#38bdf8]/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Subir Archivo Local</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('cloud_link')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-2 cursor-pointer ${
              mode === 'cloud_link'
                ? 'bg-[#1e3450] text-[#38bdf8] shadow-md border border-[#38bdf8]/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            <span>Enlace / Drive URL</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('drive_picker')}
            className={`px-3.5 py-1.5 rounded-lg font-black transition flex items-center gap-2 cursor-pointer ${
              mode === 'drive_picker'
                ? 'bg-amber-500/25 text-amber-300 border border-amber-400/60 shadow-md'
                : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10'
            }`}
            title="Explorar, crear carpetas y gestionar archivos en Google Drive"
          >
            <HardDrive className="w-4 h-4 text-amber-400" />
            <span>Google Drive</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          TAB 1: LOCAL FILE UPLOAD
      ====================================================================== */}
      {mode === 'local' && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleLocalDrop}
          className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer min-h-[160px] flex flex-col items-center justify-center ${
            isDragging
              ? 'border-[#38bdf8] bg-sky-950/30'
              : 'border-[#263c5a] bg-[#0c1626]/70 hover:border-[#38bdf8]/60 hover:bg-[#0f1d33]'
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={allowedExtensions.join(',')}
            onChange={handleLocalFileChange}
            className="hidden"
          />

          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-400/30 flex items-center justify-center text-sky-400 mb-3 shadow-inner">
            <UploadCloud className="w-6 h-6" />
          </div>

          <p className="text-sm font-bold text-white">
            Haz clic para buscar o arrastra y suelta tu archivo aquí
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Formatos admitidos: {allowedExtensions.join(', ')} • Máximo {maxFileSizeMB} MB
          </p>
          {displayEquipmentName && (
            <p className="text-[11px] text-amber-300 font-bold mt-2 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-400/30">
              Equipo asignado: {displayEquipmentName}
            </p>
          )}

          {localError && (
            <div className="mt-3 p-2 bg-rose-500/15 border border-rose-500/30 rounded-lg text-xs text-rose-300 flex items-center gap-1.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{localError}</span>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: CLOUD LINK (URL)
      ====================================================================== */}
      {mode === 'cloud_link' && (
        <form onSubmit={handleApplyCloudLink} className="space-y-3.5 bg-[#0c1626]/80 p-4 sm:p-5 rounded-2xl border border-[#213550]">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">
              Enlace de Google Drive, Dropbox, OneDrive o URL directa *
            </label>
            <div className="relative">
              <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                required
                value={cloudUrlInput}
                onChange={(e) => setCloudUrlInput(e.target.value)}
                placeholder="https://drive.google.com/file/d/..."
                className="w-full bg-[#142338] border border-[#2c4467] focus:border-[#38bdf8] rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Nombre a mostrar para este documento
              </label>
              <input
                type="text"
                value={customLinkName}
                onChange={(e) => setCustomLinkName(e.target.value)}
                placeholder="Ej: Ficha Técnica Oficial Mindray"
                className="w-full bg-[#142338] border border-[#2c4467] focus:border-[#38bdf8] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none transition"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Tamaño o descripción corta (opcional)
              </label>
              <input
                type="text"
                value={customLinkSize}
                onChange={(e) => setCustomLinkSize(e.target.value)}
                placeholder="Ej: 3.5 MB • PDF Oficial"
                className="w-full bg-[#142338] border border-[#2c4467] focus:border-[#38bdf8] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none transition"
              />
            </div>
          </div>

          {linkError && (
            <div className="p-2.5 bg-rose-500/15 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{linkError}</span>
            </div>
          )}

          {linkSuccess && (
            <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{linkSuccess}</span>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Vincular este Enlace</span>
            </button>
          </div>
        </form>
      )}

      {/* =====================================================================
          TAB 3: GOOGLE DRIVE EXPLORER (LARGE, SPACIOUS WITH DRAG-AND-DROP & CLASSIFICATION)
      ====================================================================== */}
      {mode === 'drive_picker' && (
        <div className="space-y-3 bg-[#0a1320] p-3 sm:p-4 rounded-2xl border-2 border-amber-500/40">
          {!isDriveConnected ? (
            <div className="py-16 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center mx-auto text-amber-400 shadow-inner">
                <HardDrive className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-black text-white">Google Drive no está conectado</h4>
                <p className="text-xs text-slate-300 mt-1 max-w-md mx-auto">
                  Conéctate con tu cuenta autorizada para explorar carpetas, crear la carpeta del equipo, arrastrar archivos y clasificarlos como Ficha Técnica, INVIMA o Manuales.
                </p>
              </div>
              <button
                type="button"
                onClick={handleConnectDrive}
                disabled={isConnectingDrive}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-black text-xs rounded-xl shadow-lg transition cursor-pointer inline-flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isConnectingDrive ? 'animate-spin' : ''}`} />
                <span>{isConnectingDrive ? 'Conectando con Google...' : 'Conectar con Google Drive'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* TOP ACTION BAR: Breadcrumbs, 1 Single Create Folder Button, Upload to Drive, Refresh */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#0c1524] p-3 rounded-xl border border-[#213550]">
                {/* Breadcrumbs Navigation */}
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  {breadcrumbs.length > 1 && (
                    <button
                      type="button"
                      onClick={handleGoUpOneLevel}
                      className="p-1.5 bg-[#17253b] hover:bg-[#203452] border border-[#2d466b] text-slate-300 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer mr-1"
                      title="Subir un nivel"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Atrás</span>
                    </button>
                  )}

                  {breadcrumbs.map((crumb, idx) => {
                    const isLast = idx === breadcrumbs.length - 1;
                    return (
                      <React.Fragment key={crumb.id || idx}>
                        {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                        <button
                          type="button"
                          onClick={() => handleJumpToBreadcrumb(idx)}
                          className={`text-xs px-2.5 py-1 rounded-lg transition font-bold flex items-center gap-1.5 cursor-pointer truncate max-w-[150px] sm:max-w-[220px] ${
                            isLast
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40 shadow-sm'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}
                          title={crumb.name}
                        >
                          {idx === 0 ? (
                            <HardDrive className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          ) : (
                            <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          )}
                          <span className="truncate">{crumb.name}</span>
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Folder & Upload Actions: Avoid duplicate folder creation */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {/* If user is already inside this equipment's folder: show active badge, do NOT show create folder */}
                  {isInsideEquipmentFolder ? (
                    <div className="px-3.5 py-1.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="truncate max-w-[220px] sm:max-w-xs">Carpeta del Equipo Activa ({currentFolder.name})</span>
                    </div>
                  ) : hasEquipmentFolder ? (
                    /* If folder already exists or was created: show button to open it instead of creating duplicates */
                    <button
                      type="button"
                      onClick={() => handleOpenFolder(existingEquipmentFolder || knownEquipmentFolder!)}
                      className="px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-300 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                      title={`Abrir la carpeta existente de ${displayEquipmentName}`}
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                      <span className="truncate max-w-[220px] sm:max-w-xs">
                        Abrir Carpeta: {(existingEquipmentFolder || knownEquipmentFolder)?.name}
                      </span>
                    </button>
                  ) : targetFolderName ? (
                    /* Only if not inside and doesn't exist at all: show button to create it once */
                    <button
                      type="button"
                      onClick={handleCreateEquipmentFolder}
                      disabled={isCreatingFolder}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 max-w-full sm:max-w-md border border-amber-300/40"
                      title={`Crear carpeta en Google Drive con los datos del equipo: ${targetFolderName}`}
                    >
                      <FolderPlus className={`w-3.5 h-3.5 shrink-0 ${isCreatingFolder ? 'animate-spin' : ''}`} />
                      <span className="truncate">
                        {isCreatingFolder ? 'Creando Carpeta...' : `Crear Carpeta: ${targetFolderName}`}
                      </span>
                    </button>
                  ) : null}

                  {/* Upload directly to this Drive folder */}
                  <input
                    ref={driveUploadInputRef}
                    type="file"
                    onChange={handleDriveFileInputChange}
                    className="hidden"
                    id="direct-drive-upload-input"
                  />
                  <label
                    htmlFor="direct-drive-upload-input"
                    className="px-3 py-1.5 bg-sky-600/25 hover:bg-sky-600/40 border border-sky-500/40 text-sky-200 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                    title="Subir y clasificar un archivo desde tu computador a esta carpeta de Google Drive"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Subir a Drive</span>
                  </label>

                  {/* Refresh Button */}
                  <button
                    type="button"
                    onClick={() => loadDriveFiles(driveSearchQuery, currentFolder.id)}
                    disabled={isLoadingDriveFiles}
                    className="p-1.5 bg-[#17253b] hover:bg-[#203452] border border-[#2d466b] text-slate-300 rounded-xl transition cursor-pointer"
                    title="Actualizar lista"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDriveFiles ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* QUICK DOCUMENT UPLOAD BAR (For Ficha Técnica, Registro INVIMA, Manual) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#0d1726] px-3 py-2 rounded-xl border border-[#1f334d]">
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span>Subir directamente a <strong>{currentFolder.name}</strong>:</span>
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Ficha Técnica */}
                  <button
                    type="button"
                    onClick={() => handleTriggerPresetUpload('Ficha Técnica')}
                    className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition inline-flex items-center gap-1.5 cursor-pointer ${
                      hasUploadedFT
                        ? 'bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-400 text-emerald-200 shadow-xs'
                        : 'bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300'
                    }`}
                    title={hasUploadedFT ? 'Ficha Técnica ya subida para este equipo. Haz clic para cambiarla o subir nueva versión.' : 'Subir Ficha Técnica a esta carpeta de Google Drive'}
                  >
                    {hasUploadedFT ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" /> : <FileCheck2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                    <span>{hasUploadedFT ? '✓ Ficha Técnica (Subido)' : '+ Ficha Técnica'}</span>
                    {hasUploadedFT && <span className="text-[9px] px-1 py-0.2 bg-emerald-700/60 text-white rounded font-normal ml-0.5">Cambiar</span>}
                  </button>

                  {/* Registro INVIMA */}
                  <button
                    type="button"
                    onClick={() => handleTriggerPresetUpload('Registro INVIMA')}
                    className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition inline-flex items-center gap-1.5 cursor-pointer ${
                      hasUploadedINVIMA
                        ? 'bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-400 text-emerald-200 shadow-xs'
                        : 'bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300'
                    }`}
                    title={hasUploadedINVIMA ? 'Registro INVIMA ya subido para este equipo. Haz clic para cambiarlo o subir nueva versión.' : 'Subir Registro Sanitario INVIMA a esta carpeta de Google Drive'}
                  >
                    {hasUploadedINVIMA ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" /> : <ShieldAlert className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    <span>{hasUploadedINVIMA ? '✓ INVIMA (Subido)' : '+ INVIMA'}</span>
                    {hasUploadedINVIMA && <span className="text-[9px] px-1 py-0.2 bg-emerald-700/60 text-white rounded font-normal ml-0.5">Cambiar</span>}
                  </button>

                  {/* Manual de Usuario */}
                  <button
                    type="button"
                    onClick={() => handleTriggerPresetUpload('Manual de Usuario')}
                    className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition inline-flex items-center gap-1.5 cursor-pointer ${
                      hasUploadedManual
                        ? 'bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-400 text-emerald-200 shadow-xs'
                        : 'bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-sky-300'
                    }`}
                    title={hasUploadedManual ? 'Manual ya subido para este equipo. Haz clic para cambiarlo o subir nueva versión.' : 'Subir Manual de Usuario o Servicio a esta carpeta de Google Drive'}
                  >
                    {hasUploadedManual ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" /> : <BookOpen className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                    <span>{hasUploadedManual ? '✓ Manual (Subido)' : '+ Manual'}</span>
                    {hasUploadedManual && <span className="text-[9px] px-1 py-0.2 bg-emerald-700/60 text-white rounded font-normal ml-0.5">Cambiar</span>}
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={driveSearchQuery}
                  onChange={(e) => {
                    const q = e.target.value;
                    setDriveSearchQuery(q);
                    loadDriveFiles(q, currentFolder.id);
                  }}
                  placeholder={`Buscar en ${currentFolder.name} o en todo tu Google Drive...`}
                  className="w-full bg-[#0a121e] border border-[#2b4466] focus:border-amber-400 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>

              {/* SUCCESS / ERROR ALERTS */}
              {driveSuccess && (
                <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{driveSuccess}</span>
                </div>
              )}

              {driveError && (
                <div className="p-2.5 bg-rose-500/15 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{driveError}</span>
                </div>
              )}

              {/* DELETE CONFIRMATION BANNER */}
              {fileToDelete && (
                <div className="p-3 bg-rose-500/15 border-2 border-rose-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-200 animate-fadeIn shadow-lg">
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>
                      ¿Deseas eliminar permanentemente <strong>"{fileToDelete.name}"</strong> de tu Google Drive?
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setFileToDelete(null)}
                      disabled={isDeletingFile}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDeleteDriveFile}
                      disabled={isDeletingFile}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-black transition cursor-pointer flex items-center gap-1.5 shadow"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isDeletingFile ? 'Eliminando...' : 'Sí, Eliminar de Drive'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* EXPANDED DRIVE FILES & FOLDERS LIST WITH ACTIVE DRAG-AND-DROP (MIN 440px HEIGHT) */}
              <div
                onDragEnter={handleDriveDragEnter}
                onDragOver={handleDriveDragOver}
                onDragLeave={handleDriveDragLeave}
                onDrop={handleDriveDrop}
                className={`relative border-2 rounded-xl bg-[#080f1a] min-h-[440px] max-h-[580px] overflow-y-auto divide-y divide-slate-800/80 scrollbar-thin transition-all ${
                  isDraggingOverDrive
                    ? 'border-dashed border-amber-400 bg-amber-950/20 shadow-xl shadow-amber-500/10'
                    : 'border-[#233852]'
                }`}
              >
                {/* ACTIVE DRAG-AND-DROP OVERLAY */}
                {isDraggingOverDrive && (
                  <div className="absolute inset-0 z-40 bg-[#07111e]/90 backdrop-blur-xs border-2 border-dashed border-amber-400 rounded-xl flex flex-col items-center justify-center p-6 text-center animate-fadeIn pointer-events-none">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/25 border-2 border-amber-400/60 flex items-center justify-center text-amber-300 mb-3 shadow-lg animate-bounce">
                      <FileUp className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-black text-white">
                      ¡Suelta el documento aquí para cargarlo a Google Drive!
                    </h3>
                    <p className="text-xs text-amber-300 font-bold mt-1">
                      Destino: 📁 {currentFolder.name}
                    </p>
                    <p className="text-[11px] text-slate-300 mt-2 max-w-sm">
                      Al soltarlo podrás clasificarlo inmediatamente (Ficha Técnica, Registro INVIMA, Manual, etc.) para vincularlo al equipo.
                    </p>
                  </div>
                )}

                {isLoadingDriveFiles ? (
                  <div className="py-24 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="w-7 h-7 animate-spin text-amber-400" />
                    <span className="font-bold text-slate-300 text-sm">Cargando carpetas y archivos desde Google Drive...</span>
                  </div>
                ) : driveFiles.length === 0 ? (
                  <div
                    onClick={() => {
                      if (driveUploadInputRef.current) {
                        driveUploadInputRef.current.click();
                      }
                    }}
                    className="py-16 text-center text-xs text-slate-400 space-y-3 px-4 cursor-pointer hover:bg-slate-900/50 transition m-4 rounded-2xl border-2 border-dashed border-slate-700/80 hover:border-amber-400/60 group"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-slate-800/80 group-hover:bg-amber-500/20 border border-slate-700 group-hover:border-amber-400/50 flex items-center justify-center mx-auto text-slate-400 group-hover:text-amber-300 transition shadow-inner">
                      <FolderOpen className="w-8 h-8 text-amber-400" />
                    </div>
                    <div>
                      <p className="font-black text-white text-base group-hover:text-amber-300 transition">
                        Arrastra y suelta tus documentos aquí
                      </p>
                      <p className="text-slate-300 text-xs mt-1 max-w-md mx-auto">
                        O haz clic para seleccionar un archivo y cargarlo directamente a la carpeta <strong>"{currentFolder.name}"</strong>
                      </p>
                      <div className="flex items-center justify-center gap-2 mt-3.5 flex-wrap pointer-events-auto">
                        <button
                          type="button"
                          onClick={() => {
                            if (driveUploadInputRef.current) {
                              setUploadPresetTag(null);
                              driveUploadInputRef.current.click();
                            }
                          }}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600 hover:border-amber-400/50"
                        >
                          <Upload className="w-3.5 h-3.5 text-amber-400" />
                          <span>Explorar y subir archivo</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  driveFiles.map((file) => {
                    const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.mimeType?.includes('pdf');
                    const isSheet = file.mimeType?.includes('spreadsheet') || file.name.toLowerCase().endsWith('.xlsx');
                    const isImg = file.mimeType?.startsWith('image/');
                    const sizeKB = file.size ? Number(file.size) / 1024 : 0;
                    const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : sizeKB > 0 ? `${sizeKB.toFixed(0)} KB` : '';

                    // Detect classification badge for non-folder files
                    const classification = !isFolder ? detectFileClassification(file.name, file.id) : null;

                    return (
                      <div
                        key={file.id}
                        className={`p-3 sm:px-4 sm:py-3.5 flex items-center justify-between gap-3 transition group ${
                          isFolder
                            ? 'hover:bg-amber-950/20 bg-slate-900/40 border-l-4 border-l-amber-400/80'
                            : 'hover:bg-[#152336] bg-transparent'
                        }`}
                      >
                        {/* File / Folder Details */}
                        <div
                          className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                          onClick={() => {
                            if (isFolder) {
                              handleOpenFolder(file);
                            } else {
                              handleSelectDriveItem(file, false);
                            }
                          }}
                        >
                          <div
                            className={`p-2.5 rounded-xl border shrink-0 shadow-sm ${
                              isFolder
                                ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                                : isPdf
                                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                                : isSheet
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                : isImg
                                ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                                : 'bg-slate-800 border-slate-700 text-slate-300'
                            }`}
                          >
                            {isFolder ? (
                              <Folder className="w-5 h-5 text-amber-400" />
                            ) : isPdf ? (
                              <FileType className="w-5 h-5 text-rose-400" />
                            ) : isSheet ? (
                              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                            ) : isImg ? (
                              <ImageIcon className="w-5 h-5 text-sky-400" />
                            ) : (
                              <FileText className="w-5 h-5 text-slate-300" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="text-xs sm:text-sm font-bold text-white block truncate max-w-[220px] sm:max-w-md"
                                title={file.name}
                              >
                                {file.name}
                              </span>

                              {/* PROMINENT CLASSIFICATION BADGE (Ficha Técnica, Registro INVIMA, Manual, etc.) */}
                              {isFolder ? (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/40">
                                  Carpeta
                                </span>
                              ) : classification ? (
                                <span
                                  className={`text-[10px] font-black px-2 py-0.5 rounded-md border flex items-center gap-1 shrink-0 ${classification.badgeClass}`}
                                >
                                  <span>{classification.icon}</span>
                                  <span>{classification.label}</span>
                                </span>
                              ) : null}

                              {/* Equipment reference chip if stored */}
                              {classification?.equipmentName && (
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 truncate max-w-[180px]">
                                  🏷️ {classification.equipmentName}
                                </span>
                              )}
                            </div>

                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              {isFolder
                                ? 'Carpeta en Google Drive • Haz clic para abrir y ver contenido'
                                : sizeStr
                                ? `${sizeStr} • Archivo en Google Drive`
                                : 'Archivo en Google Drive'}
                            </span>
                          </div>
                        </div>

                        {/* Actions: Re-classify, View, Change/Replace, Delete, Select */}
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                          {isFolder ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenFolder(file)}
                                className="px-3 py-1.5 bg-[#1e3450] hover:bg-[#28466d] text-sky-300 border border-[#355785] rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
                                title="Abrir y explorar dentro de esta carpeta"
                              >
                                <span>Abrir</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSelectDriveItem(file, true)}
                                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-400/50 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
                                title="Vincular esta carpeta como destino documental"
                              >
                                <Check className="w-3.5 h-3.5 text-amber-400" />
                                <span>Seleccionar</span>
                              </button>
                            </>
                          ) : (
                            <>
                              {/* CLASSIFY / RE-CLASSIFY BUTTON */}
                              <button
                                type="button"
                                onClick={() => handleOpenReclassifyModal(file)}
                                className="p-1.5 bg-purple-500/15 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-xl transition cursor-pointer"
                                title="Clasificar o cambiar categoría de este archivo (Ficha Técnica, INVIMA, etc.)"
                              >
                                <Tag className="w-3.5 h-3.5" />
                              </button>

                              {/* View / Open in Drive */}
                              {file.webViewLink && (
                                <a
                                  href={file.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 bg-[#17253b] hover:bg-[#203452] border border-[#2d466b] text-sky-300 rounded-xl transition cursor-pointer"
                                  title="Abrir y ver en Google Drive"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}

                              {/* Replace / Change File in Drive */}
                              <button
                                type="button"
                                onClick={() => handleInitiateReplace(file)}
                                disabled={isReplacingFile}
                                className="p-1.5 bg-[#17253b] hover:bg-[#203452] border border-[#2d466b] text-amber-300 rounded-xl transition cursor-pointer"
                                title="Cambiar / Reemplazar este archivo en Google Drive por una versión actualizada"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${isReplacingFile && fileToReplace?.id === file.id ? 'animate-spin' : ''}`} />
                              </button>

                              {/* Delete File from Drive */}
                              <button
                                type="button"
                                onClick={() => setFileToDelete(file)}
                                className="p-1.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 rounded-xl transition cursor-pointer"
                                title="Eliminar este archivo de Google Drive"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Select as active document */}
                              <button
                                type="button"
                                onClick={() => handleSelectDriveItem(file, false)}
                                className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-400/50 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
                                title="Vincular este archivo como documento activo"
                              >
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Seleccionar</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          CLASSIFY & SAVE TO GOOGLE DRIVE MODAL (MODAL DE CLASIFICACIÓN)
      ====================================================================== */}
      {isClassificationModalOpen && (pendingFile || pendingDriveItem) && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isUploadingClassified) {
                setIsClassificationModalOpen(false);
                setPendingFile(null);
                setPendingDriveItem(null);
              }
            }}
          >
            <div className="bg-[#122238] border-2 border-amber-400/60 rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl animate-scaleUp text-white space-y-4 my-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#243c5e]">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/40">
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                      {uploadPresetTag || !showClassificationGrid
                        ? `Subir ${selectedCategory} a Google Drive`
                        : pendingFile
                        ? 'Guardar Documento en Google Drive'
                        : 'Reclasificar Documento en Google Drive'}
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {uploadPresetTag || !showClassificationGrid
                        ? `Documento identificado automáticamente como ${selectedCategory}`
                        : 'Asigna el tipo de documento biomédico correspondiente a este archivo'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!isUploadingClassified) {
                      setIsClassificationModalOpen(false);
                      setPendingFile(null);
                      setPendingDriveItem(null);
                      setShowClassificationGrid(false);
                    }
                  }}
                  disabled={isUploadingClassified}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Context Banner: Folder & Equipment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-[#0b1626] p-3 rounded-xl border border-[#213854]">
                <div className="flex items-center gap-2 min-w-0">
                  <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Carpeta Destino en Drive:</span>
                    <span className="font-bold text-white truncate block" title={currentFolder.name}>
                      {currentFolder.name}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 min-w-0">
                  <Layers className="w-4 h-4 text-sky-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Equipo Asociado:</span>
                    <span className="font-bold text-sky-300 truncate block" title={displayEquipmentName || 'Equipo Biomédico'}>
                      {displayEquipmentName || 'Equipo Biomédico'}
                    </span>
                  </div>
                </div>
              </div>

              {/* File Info Box */}
              <div className="flex items-center gap-3 bg-[#0d1a2c] p-3 rounded-xl border border-[#243d5c]">
                <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-400/40 shrink-0">
                  <FileType className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs sm:text-sm font-bold text-white block truncate">
                    {pendingFile ? pendingFile.name : pendingDriveItem?.name}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {pendingFile
                      ? `${formatFileSize(pendingFile.size)} • Listo para subir`
                      : 'Archivo existente en Google Drive'}
                  </span>
                </div>
              </div>

              {/* Classification: Identified Badge vs Selector Grid */}
              {showClassificationGrid ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-black text-slate-200 uppercase tracking-wider">
                      Selecciona la Clasificación del Documento *
                    </label>
                    {uploadPresetTag && (
                      <button
                        type="button"
                        onClick={() => setShowClassificationGrid(false)}
                        className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                      >
                        Ocultar opciones
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                    {DOCUMENT_CLASSIFICATIONS.map((cat) => {
                      const isSelected = selectedCategory === cat.id;

                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleSelectModalCategory(cat.id)}
                          className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                            isSelected
                              ? `${cat.chipClass} border-2 shadow-md ring-1 ring-amber-400/40`
                              : 'bg-[#0f1d30] border-[#223752] text-slate-300 hover:bg-[#16273f] hover:border-slate-500'
                          }`}
                        >
                          <span className="text-lg shrink-0 mt-0.5">{cat.icon}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-black text-xs block leading-tight text-white">
                                {cat.label}
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                            </div>
                            <span className="text-[10.5px] text-slate-400 block mt-0.5 leading-snug line-clamp-1">
                              {cat.desc}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Compact Identified Document Badge (Does not ask user to classify again) */
                <div className="p-3 bg-emerald-950/30 border border-emerald-500/40 rounded-xl flex items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center justify-center text-xl shrink-0">
                      {DOCUMENT_CLASSIFICATIONS.find((c) => c.id === selectedCategory)?.icon || '📄'}
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-black tracking-wider text-emerald-400 block">
                        Documento Identificado:
                      </span>
                      <span className="text-sm font-black text-white truncate block">
                        {selectedCategory}
                      </span>
                      <span className="text-[10.5px] text-slate-300 block">
                        Identificado automáticamente según el botón presionado (+ {selectedCategory}).
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowClassificationGrid(true)}
                    className="text-[11px] text-amber-400 hover:text-amber-300 underline font-bold shrink-0 cursor-pointer px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition"
                  >
                    Cambiar tipo
                  </button>
                </div>
              )}

              {/* Extra input if Registro INVIMA */}
              {selectedCategory === 'Registro INVIMA' && (
                <div className="p-3 rounded-xl bg-emerald-950/25 border border-emerald-500/40 space-y-2 animate-fadeIn">
                  <label className="text-xs font-bold text-emerald-300 block">
                    Número de Registro Sanitario INVIMA (Opcional):
                  </label>
                  <input
                    type="text"
                    value={customInvimaNumber}
                    onChange={(e) => handleInvimaNumberChange(e.target.value)}
                    placeholder="Ej: 2021EBC-0008450"
                    className="w-full bg-[#0a1826] border border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-400"
                  />
                  <span className="text-[10.5px] text-emerald-400/80 block">
                    Este número se integrará en el nombre del archivo y en la ficha del equipo.
                  </span>
                </div>
              )}

              {/* Final Name on Drive (Editable) */}
              <div>
                <label className="text-xs font-black text-slate-200 block mb-1 uppercase tracking-wider">
                  {showClassificationGrid ? '2. Nombre del Archivo en Google Drive:' : 'Nombre del Archivo en Google Drive:'}
                </label>
                <div className="relative">
                  <Edit3 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={customDriveFileName}
                    onChange={(e) => setCustomDriveFileName(e.target.value)}
                    placeholder="Nombre con el que se guardará en Google Drive..."
                    className="w-full bg-[#0b1727] border border-[#2b4465] focus:border-amber-400 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white font-medium outline-none transition"
                  />
                </div>
                <span className="text-[10.5px] text-slate-400 block mt-1">
                  Generado automáticamente según el tipo de documento y el equipo biomédico. Puedes editarlo antes de guardar.
                </span>
              </div>

              {/* Error inside modal */}
              {driveError && (
                <div className="p-2.5 bg-rose-500/15 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{driveError}</span>
                </div>
              )}

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#243c5e]">
                <button
                  type="button"
                  onClick={() => {
                    setIsClassificationModalOpen(false);
                    setPendingFile(null);
                    setPendingDriveItem(null);
                    setShowClassificationGrid(false);
                  }}
                  disabled={isUploadingClassified}
                  className="px-4 py-2 bg-[#17253b] hover:bg-[#203452] text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleConfirmClassificationAndUpload}
                  disabled={isUploadingClassified || !customDriveFileName.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isUploadingClassified ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Subiendo a Google Drive...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-slate-950" />
                      <span>{pendingFile ? `💾 Guardar y Subir ${selectedCategory} a Google Drive` : '💾 Guardar Clasificación'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
