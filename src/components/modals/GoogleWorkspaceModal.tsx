import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  FileSpreadsheet,
  HardDrive,
  Mail,
  Database,
  Cloud,
  Layers,
  Sparkles,
  Download,
  Upload,
  Check,
  Folder,
  FileText,
  Clock,
  ShieldCheck,
  UserCheck,
  LogOut,
  Lock,
  Link2,
  Eye,
  FileCheck,
  Search,
  Filter,
  Plus,
  PlusCircle,
  Copy,
  CheckCheck,
  Wrench,
  Boxes,
  FilePlus2,
  Tag,
  ChevronLeft,
  ChevronRight,
  Target,
  Key,
  Info,
  Bell,
} from 'lucide-react';
import {
  googleWorkspaceService,
  GoogleWorkspaceProfile,
  DriveFileItem,
  SheetExportResult,
  ConnectedGoogleSheetInfo,
  DetectedSheetPart,
  TARGET_NFCO03_FILENAME,
} from '../../services/googleWorkspaceService';
import { gmailService } from '../../services/gmailIntegrationService';
import * as XLSX from 'xlsx';
import {
  MedicalEquipment,
  SavedQuote,
  OCTrackingContract,
  SalesOrderRecord,
  TechnicalDocument,
  StoredUserAccount,
  ThemeSettings,
  QuoteHeader,
  QuoteItem,
} from '../../types';
import { generateAppBackup } from '../../utils/backupRestoreUtils';
import { SyncConnectionStatus } from '../../services/realtimeSync';
import { CreateEquipmentFromPartModal } from './CreateEquipmentFromPartModal';

interface GoogleWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipments: MedicalEquipment[];
  quotes: SavedQuote[];
  ocContracts: OCTrackingContract[];
  salesOrders?: SalesOrderRecord[];
  documents?: TechnicalDocument[];
  users?: StoredUserAccount[];
  themeSettings?: ThemeSettings;
  activeLetterheadUrl?: string | null;
  quoteHeader?: QuoteHeader;
  quoteItems?: QuoteItem[];
  syncStatus?: SyncConnectionStatus;
  onNavigateToGmail?: () => void;
  onNavigateToBackup?: () => void;
  initialTab?: 'sheets' | 'drive';
  onAddEquipments?: (newEquipments: MedicalEquipment[]) => void;
}

export const GoogleWorkspaceModal: React.FC<GoogleWorkspaceModalProps> = ({
  isOpen,
  onClose,
  equipments,
  quotes,
  ocContracts,
  salesOrders = [],
  documents = [],
  users = [],
  themeSettings,
  activeLetterheadUrl,
  quoteHeader,
  quoteItems,
  syncStatus = 'connected',
  onNavigateToGmail,
  onNavigateToBackup,
  initialTab = 'sheets',
  onAddEquipments,
}) => {
  const [profile, setProfile] = useState<GoogleWorkspaceProfile | null>(() => googleWorkspaceService.getUserProfile());
  const [isConnected, setIsConnected] = useState<boolean>(() => googleWorkspaceService.isConnected());
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState<'sheets' | 'drive'>('sheets');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    const handleOpenWithTab = (e: any) => {
      if (e?.detail?.tab === 'sheets' || e?.detail?.tab === 'drive') {
        setActiveTab(e.detail.tab);
      }
      if (e?.detail?.subTab) {
        setConnectedSubTab(e.detail.subTab);
      }
    };
    window.addEventListener('syd-open-workspace-modal', handleOpenWithTab);
    return () => window.removeEventListener('syd-open-workspace-modal', handleOpenWithTab);
  }, []);

  // Existing Google Sheet (Read-Only) state
  const [connectedSheet, setConnectedSheet] = useState<ConnectedGoogleSheetInfo | null>(() => {
    const s = googleWorkspaceService.getConnectedSpreadsheet();
    if (s && s.id === 'catalogo_maestro') return null;
    return s;
  });
  const [existingDriveSheets, setExistingDriveSheets] = useState<
    Array<{ id: string; name: string; webViewLink?: string; modifiedTime?: string }>
  >([]);
  const [isLoadingDriveSheets, setIsLoadingDriveSheets] = useState(false);
  const [sheetInputUrl, setSheetInputUrl] = useState('');
  const [isConnectingSheet, setIsConnectingSheet] = useState(false);
  const [sheetConnectionError, setSheetConnectionError] = useState<string | null>(null);
  const [sheetConnectionSuccess, setSheetConnectionSuccess] = useState<string | null>(null);

  // Read-Only Preview State
  const [previewData, setPreviewData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [selectedSheetTab, setSelectedSheetTab] = useState<string>('');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [tablePageSize, setTablePageSize] = useState<number>(50);
  const [tableCurrentPage, setTableCurrentPage] = useState<number>(1);

  // Parts Detection & Management from Connected Sheet
  const [detectedParts, setDetectedParts] = useState<DetectedSheetPart[]>([]);
  const [partsSearchQuery, setPartsSearchQuery] = useState('');
  const [partsFilterType, setPartsFilterType] = useState<'ALL' | 'CREACION' | 'MODIFICACION' | 'INACTIVACION'>('ALL');
  const [connectedSubTab, setConnectedSubTab] = useState<'parts' | 'table'>('table');

  // Newly detected parts tracking & proactive notification
  const [newlyDetectedParts, setNewlyDetectedParts] = useState<DetectedSheetPart[]>([]);
  const [newPartNotification, setNewPartNotification] = useState<{
    parts: DetectedSheetPart[];
    timestamp: string;
    dismissed: boolean;
  } | null>(null);

  const getStoredKnownPartKeys = (): Set<string> => {
    try {
      const raw = localStorage.getItem('syd_known_drive_part_keys_v1');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          return new Set(arr.map((k: string) => String(k).trim().toLowerCase()));
        }
      }
    } catch (_) {}
    return new Set();
  };

  const playNotificationSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (_) {}
  };

  const markPartsAsKnown = (partsToMark?: DetectedSheetPart[]) => {
    try {
      const raw = localStorage.getItem('syd_known_drive_part_keys_v1');
      const existing: string[] = raw ? JSON.parse(raw) : [];
      const set = new Set(existing.map((k) => String(k).trim().toLowerCase()));
      const target = partsToMark || newlyDetectedParts || detectedParts;
      target.forEach((p) => {
        const k1 = (p.code || '').trim().toLowerCase();
        const k2 = (p.name || '').trim().toLowerCase();
        if (k1) set.add(k1);
        if (k2) set.add(k2);
      });
      localStorage.setItem('syd_known_drive_part_keys_v1', JSON.stringify(Array.from(set)));
    } catch (_) {}
    setNewPartNotification(null);
    setNewlyDetectedParts([]);
  };

  // Persistent tracking of created parts so they cannot be recreated
  const [createdPartCodes, setCreatedPartCodes] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('syd_created_sheet_parts_v1');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          return new Set(arr.map((c: string) => String(c).trim().toLowerCase()));
        }
      }
    } catch (_) {}
    return new Set();
  });

  // Modal for creating equipment directly from detected part or table row
  const [partForEquipmentModal, setPartForEquipmentModal] = useState<DetectedSheetPart | null>(null);
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);

  const isPartAlreadyCreated = (code?: string, name?: string): boolean => {
    const cleanCode = (code || '').trim().toLowerCase();
    const cleanName = (name || '').trim().toLowerCase();
    if (!cleanCode && !cleanName) return false;
    if (cleanCode && createdPartCodes.has(cleanCode)) return true;
    return (equipments || []).some((eq) => {
      const eqCode = (eq.code || '').trim().toLowerCase();
      const eqName = (eq.name || '').trim().toLowerCase();
      return (cleanCode && eqCode === cleanCode) || (cleanName && eqName === cleanName);
    });
  };

  const handleOpenCreateEquipmentModal = (part: DetectedSheetPart) => {
    setPartForEquipmentModal(part);
    setIsEquipmentModalOpen(true);
  };

  const handleSaveEquipmentFromPart = (newEq: MedicalEquipment) => {
    if (onAddEquipments) {
      onAddEquipments([newEq]);
    } else {
      try {
        const stored = localStorage.getItem('syd_equipments_catalog');
        const list = stored ? JSON.parse(stored) : [];
        if (!list.some((e: any) => e.code === newEq.code)) {
          list.push(newEq);
          localStorage.setItem('syd_equipments_catalog', JSON.stringify(list));
        }
      } catch (_) {}
    }

    const cleanCode = (newEq.code || '').trim().toLowerCase();
    const cleanName = (newEq.name || '').trim().toLowerCase();
    if (cleanCode) {
      setCreatedPartCodes((prev) => {
        const next = new Set(prev);
        next.add(cleanCode);
        try {
          localStorage.setItem('syd_created_sheet_parts_v1', JSON.stringify(Array.from(next)));
        } catch (_) {}
        return next;
      });
    }
    if (cleanCode || cleanName) {
      try {
        const raw = localStorage.getItem('syd_known_drive_part_keys_v1');
        const existing: string[] = raw ? JSON.parse(raw) : [];
        const set = new Set(existing.map((k) => String(k).trim().toLowerCase()));
        if (cleanCode) set.add(cleanCode);
        if (cleanName) set.add(cleanName);
        localStorage.setItem('syd_known_drive_part_keys_v1', JSON.stringify(Array.from(set)));
      } catch (_) {}
    }

    setSheetConnectionSuccess(
      `¡Equipo "${newEq.name}" (Parte: ${newEq.code}) creado exitosamente y añadido a la ventana de creación de equipos!`
    );
  };

  const handleOpenCreateFromRow = (row: string[], rowIndex: number) => {
    if (!previewData?.headers) return;
    const parts = googleWorkspaceService.detectPartsFromSpreadsheetData(previewData.headers, [row]);
    if (parts.length > 0) {
      handleOpenCreateEquipmentModal(parts[0]);
    } else {
      // Build candidate part from row cells
      const candidateCode =
        row.find((c) => /^\d{4,8}$/i.test(c.trim()) || /^[A-Z0-9\-_]{3,15}$/i.test(c.trim())) ||
        `PARTE-${rowIndex + 1}`;
      const candidateName =
        row.find((c) => c.length > 5 && !c.includes('@') && !/^\d+$/.test(c)) ||
        `Parte Fila ${rowIndex + 1}`;
      const candidatePart: DetectedSheetPart = {
        id: `row-part-${rowIndex}-${Date.now()}`,
        code: candidateCode,
        name: candidateName,
        supplier: row.find((c) => c.toLowerCase().includes('tecnica') || c.toLowerCase().includes('syd')) || 'SYD Biomedical',
        brand: row.find((c) => c.toLowerCase().includes('mindray')) || 'MINDRAY',
        model: 'Estándar',
        costCOP: 150000,
        hasIVA: '19%',
        invimaRegister: 'No Aplica',
        rawRow: {},
        rowIndex: rowIndex + 1,
      };
      handleOpenCreateEquipmentModal(candidatePart);
    }
  };

  // Dedicated N-FCO-03 search states
  const [isSearchingNFCO03, setIsSearchingNFCO03] = useState(false);
  const [nfcoSearchMatches, setNfcoSearchMatches] = useState<any[]>([]);
  const [nfcoSearchAttempted, setNfcoSearchAttempted] = useState(false);

  // Helper to prioritize the EQUIPOS tab
  const findPreferredSheetTab = (sheetNames?: string[]): string => {
    if (!sheetNames || sheetNames.length === 0) return '';
    const equipTab = sheetNames.find(
      (t) => t.toUpperCase().trim() === 'EQUIPOS' || t.toUpperCase().includes('EQUIPO')
    );
    return equipTab || sheetNames[0];
  };

  const [importedPartCodes, setImportedPartCodes] = useState<Set<string>>(new Set());
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Operation states
  const [isExportingSheet, setIsExportingSheet] = useState<string | null>(null);
  const [sheetSuccess, setSheetSuccess] = useState<SheetExportResult | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const [isSavingToDrive, setIsSavingToDrive] = useState(false);
  const [driveSuccess, setDriveSuccess] = useState<DriveFileItem | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [isLoadingDriveFiles, setIsLoadingDriveFiles] = useState(false);
  const [driveMimeFilter, setDriveMimeFilter] = useState<'all' | 'sheets' | 'docs' | 'folders'>('all');
  const [driveSearchQuery, setDriveSearchQuery] = useState('');

  useEffect(() => {
    const handleAuthChange = () => {
      setIsConnected(googleWorkspaceService.isConnected());
      setProfile(googleWorkspaceService.getUserProfile());
    };

    const handleSheetChange = () => {
      const s = googleWorkspaceService.getConnectedSpreadsheet();
      if (s && s.id === 'catalogo_maestro') {
        setConnectedSheet(null);
      } else {
        setConnectedSheet(s);
      }
    };

    window.addEventListener('syd-workspace-auth-changed', handleAuthChange);
    window.addEventListener('syd-connected-sheet-changed', handleSheetChange);

    const handleOpenWorkspace = (e: any) => {
      if (e?.detail?.openSubTab) {
        setConnectedSubTab(e.detail.openSubTab);
      }
      if (e?.detail?.partCode) {
        setPartsSearchQuery(e.detail.partCode);
      }
    };
    window.addEventListener('syd-open-workspace-modal', handleOpenWorkspace);

    return () => {
      window.removeEventListener('syd-workspace-auth-changed', handleAuthChange);
      window.removeEventListener('syd-connected-sheet-changed', handleSheetChange);
      window.removeEventListener('syd-open-workspace-modal', handleOpenWorkspace);
    };
  }, []);

  useEffect(() => {
    if (isOpen && isConnected) {
      loadDriveFiles();
      loadDriveSheets();
    }
  }, [isOpen, isConnected]);

  // Load preview ONLY when there is a real sheet connected (no fake data)
  useEffect(() => {
    if (isOpen) {
      const currentSheet = connectedSheet || googleWorkspaceService.getConnectedSpreadsheet();
      if (currentSheet && currentSheet.id !== 'catalogo_maestro') {
        const tabToLoad = selectedSheetTab || findPreferredSheetTab(currentSheet.sheetNames) || '';
        if (!selectedSheetTab && tabToLoad) {
          setSelectedSheetTab(tabToLoad);
        }
        loadSheetPreview(currentSheet.id, tabToLoad);
      } else {
        setPreviewData(null);
        setDetectedParts([]);
      }
    }
  }, [isOpen, connectedSheet?.id, selectedSheetTab]);

  const handleSearchAndConnectNFCO03 = async () => {
    if (!googleWorkspaceService.isConnected()) {
      setSheetConnectionError(
        'Para buscar en su Google Drive, primero conecte su cuenta de Google Workspace con el botón verde "Conectar Google".'
      );
      return;
    }
    setIsSearchingNFCO03(true);
    setSheetConnectionError(null);
    setSheetConnectionSuccess(null);
    setNfcoSearchAttempted(true);

    try {
      const res = await googleWorkspaceService.searchDriveForNFCO03();
      setNfcoSearchMatches(res.matches || []);

      if (res.bestMatch) {
        const connected = await googleWorkspaceService.connectExistingSpreadsheet(res.bestMatch.id);
        setConnectedSheet(connected);
        const preferredTab = findPreferredSheetTab(connected.sheetNames);
        setSelectedSheetTab(preferredTab);
        await loadSheetPreview(connected.id, preferredTab);
        setSheetConnectionSuccess(
          `¡Archivo oficial "${res.bestMatch.name}" localizado en Google Drive y conectado exitosamente!`
        );
      } else {
        setSheetConnectionSuccess(
          `Conexión establecida. Catálogo institucional activo (306 partes). No se detectó el archivo exacto "${TARGET_NFCO03_FILENAME}" en Drive. Puedes vincular una hoja abajo o cargar el archivo Excel local.`
        );
      }
    } catch (err: any) {
      setSheetConnectionError(err.message || 'Error al buscar en Google Drive.');
    } finally {
      setIsSearchingNFCO03(false);
    }
  };

  const handleLocalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingPreview(true);
    setSheetConnectionError(null);
    setSheetConnectionSuccess(null);

    try {
      const connected = await googleWorkspaceService.connectLocalExcelFile(file);
      setConnectedSheet(connected);
      const preferredTab = findPreferredSheetTab(connected.sheetNames);
      setSelectedSheetTab(preferredTab);
      await loadSheetPreview(connected.id, preferredTab);
      setSheetConnectionSuccess(
        `¡Archivo "${file.name}" cargado y sincronizado exitosamente! Mostrando todas las pestañas y filas exactas.`
      );
    } catch (err: any) {
      setSheetConnectionError(err.message || 'Error al procesar el archivo Excel local.');
    } finally {
      setIsLoadingPreview(false);
      e.target.value = '';
    }
  };

  const loadDriveSheets = async () => {
    if (!googleWorkspaceService.isConnected()) return;
    setIsLoadingDriveSheets(true);
    try {
      const sheets = await googleWorkspaceService.listSpreadsheetsFromDrive();
      setExistingDriveSheets(sheets);
    } catch (e) {
      console.warn('Error al buscar hojas de Google Sheets en Drive:', e);
    } finally {
      setIsLoadingDriveSheets(false);
    }
  };

  const loadSheetPreview = async (spreadsheetId: string, sheetTab?: string) => {
    setIsLoadingPreview(true);
    try {
      const data = await googleWorkspaceService.fetchSpreadsheetPreview(spreadsheetId, sheetTab);
      setPreviewData({ headers: data.headers, rows: data.rows });
      const parts = googleWorkspaceService.detectPartsFromSpreadsheetData(data.headers, data.rows);
      setDetectedParts(parts);

      // Persist detected parts for global alerts and notify system
      try {
        localStorage.setItem('syd_detected_sheet_parts_v1', JSON.stringify(parts));
        window.dispatchEvent(new CustomEvent('syd-detected-sheet-parts-updated', { detail: parts }));
      } catch (_) {}

      // Identify newly created / added parts in Drive
      const knownKeys = getStoredKnownPartKeys();
      const newItems = parts.filter((part) => {
        const codeKey = (part.code || '').trim().toLowerCase();
        const nameKey = (part.name || '').trim().toLowerCase();
        const key = codeKey || nameKey;
        if (!key) return false;

        // If previously acknowledged in this browser
        if (knownKeys.has(key)) return false;

        // If already present in equipments catalog
        const alreadyInCatalog = isPartAlreadyCreated(part.code, part.name);
        if (alreadyInCatalog) return false;

        return true;
      });

      if (newItems.length > 0) {
        setNewlyDetectedParts(newItems);
        setNewPartNotification({
          parts: newItems,
          timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
          dismissed: false,
        });
        playNotificationSound();
        window.dispatchEvent(
          new CustomEvent('syd-new-part-detected-notification', { detail: { parts: newItems } })
        );
      }

      // If sheet returned updated sheet names, reflect them
      if (data.sheetNames && data.sheetNames.length > 0) {
        setConnectedSheet((prev) => (prev ? { ...prev, sheetNames: data.sheetNames } : prev));
      }
    } catch (e: any) {
      console.warn('Error al cargar vista previa de hoja:', e);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleImportPartToCatalog = (part: DetectedSheetPart) => {
    const newEq: MedicalEquipment = {
      id: `eq-part-${part.code}-${Date.now()}`,
      code: part.code,
      name: part.name,
      brand: part.brand || 'SYD Biomedical',
      model: part.model || 'Estándar',
      category: 'Accesorios',
      baseCostCOP: part.costCOP || 250000,
      defaultMarginList: 'L3',
      invimaRecordNumber: 'En Trámite',
      warrantyMonths: 12,
      originCountry: 'Colombia',
      description: part.observations ? `${part.name} - ${part.observations}` : `Parte oficial detectada en Google Sheets (Ref: ${part.code})`,
      technicalSpecs: [`Código de parte: ${part.code}`, `Tipo de solicitud: ${part.requestType || 'Creación'}`],
      standardAccessories: [],
      hasDocSheet: false,
      hasInvimaDoc: false,
      hasManual: false,
      hasQualityCert: false,
    };

    if (onAddEquipments) {
      onAddEquipments([newEq]);
    } else {
      try {
        const stored = localStorage.getItem('syd_equipments_catalog');
        const list = stored ? JSON.parse(stored) : [];
        if (!list.some((e: any) => e.code === newEq.code)) {
          list.push(newEq);
          localStorage.setItem('syd_equipments_catalog', JSON.stringify(list));
        }
      } catch (_) {}
    }

    setImportedPartCodes((prev) => new Set([...prev, part.code]));

    // Record as known part
    const cleanCode = (part.code || '').trim().toLowerCase();
    const cleanName = (part.name || '').trim().toLowerCase();
    if (cleanCode || cleanName) {
      try {
        const raw = localStorage.getItem('syd_known_drive_part_keys_v1');
        const existing: string[] = raw ? JSON.parse(raw) : [];
        const set = new Set(existing.map((k) => String(k).trim().toLowerCase()));
        if (cleanCode) set.add(cleanCode);
        if (cleanName) set.add(cleanName);
        localStorage.setItem('syd_known_drive_part_keys_v1', JSON.stringify(Array.from(set)));
      } catch (_) {}
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleConnectExistingSheet = async (idOrUrl: string) => {
    if (!idOrUrl.trim()) return;
    setIsConnectingSheet(true);
    setSheetConnectionError(null);
    setSheetConnectionSuccess(null);
    try {
      const sheet = await googleWorkspaceService.connectExistingSpreadsheet(idOrUrl);
      setConnectedSheet(sheet);
      setSheetConnectionSuccess(`¡Hoja "${sheet.name}" conectada con éxito!`);
      const preferredTab = findPreferredSheetTab(sheet.sheetNames);
      setSelectedSheetTab(preferredTab);
      await loadSheetPreview(sheet.id, preferredTab);
      setSheetInputUrl('');
    } catch (err: any) {
      setSheetConnectionError(err.message || 'Error al conectar la hoja de Google Sheets.');
    } finally {
      setIsConnectingSheet(false);
    }
  };

  const handleDisconnectSheet = () => {
    googleWorkspaceService.disconnectSpreadsheet();
    setConnectedSheet(null);
    setPreviewData(null);
    setSheetConnectionSuccess(null);
    setSheetConnectionError(null);
  };

  const handleRestoreMasterCatalog = async () => {
    setIsLoadingPreview(true);
    setSheetConnectionError(null);
    try {
      const sheet = await googleWorkspaceService.connectExistingSpreadsheet('catalogo_maestro');
      setConnectedSheet(sheet);
      const preferredTab = findPreferredSheetTab(sheet.sheetNames);
      setSelectedSheetTab(preferredTab);
      await loadSheetPreview(sheet.id, preferredTab);
      setSheetConnectionSuccess('¡Catálogo institucional SYD cargado exitosamente!');
    } catch (err: any) {
      setSheetConnectionError(err.message || 'Error al cargar el catálogo maestro.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const loadDriveFiles = async (filter?: 'all' | 'sheets' | 'docs' | 'folders', query?: string) => {
    if (!googleWorkspaceService.isConnected()) return;
    setIsLoadingDriveFiles(true);
    setDriveError(null);
    try {
      const activeFilter = filter !== undefined ? filter : driveMimeFilter;
      const activeQuery = query !== undefined ? query : driveSearchQuery;
      const files = await googleWorkspaceService.listUserDriveFiles({
        pageSize: 100,
        mimeTypeFilter: activeFilter,
        searchQuery: activeQuery,
      });
      setDriveFiles(files);
    } catch (e: any) {
      console.warn('Error loading drive files:', e);
      setDriveError(e?.message || 'Error al consultar archivos de Google Drive.');
    } finally {
      setIsLoadingDriveFiles(false);
    }
  };

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    setSheetError(null);
    setDriveError(null);
    setSheetConnectionError(null);
    try {
      const res = await googleWorkspaceService.connectGoogleWorkspace();
      setIsConnected(true);
      setProfile(res.profile);
      await Promise.all([
        loadDriveFiles(),
        loadDriveSheets(),
      ]);
      // Auto-connect N-FCO-03 if available, or stay on master catalog
      if (!connectedSheet || connectedSheet.id === 'catalogo_maestro') {
        try {
          await handleSearchAndConnectNFCO03();
        } catch (searchErr) {
          console.warn('Auto search N-FCO-03 skipped:', searchErr);
        }
      }
    } catch (err: any) {
      const msg = err.message || 'No se pudo conectar con Google.';
      setSheetError(msg);
      setSheetConnectionError(msg);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectDirect = (email: string, name?: string) => {
    try {
      setSheetError(null);
      setDriveError(null);
      setSheetConnectionError(null);
      const res = googleWorkspaceService.connectDirectAccount(email, name);
      setIsConnected(true);
      setProfile(res.profile);
      setSheetConnectionSuccess(`¡Cuenta ${res.profile.email} conectada con éxito!`);
    } catch (err: any) {
      setSheetConnectionError(err.message || 'Error al conectar la cuenta.');
    }
  };

  const handleConnectSheetFromDrive = async (sheetIdOrUrl: string) => {
    setActiveTab('sheets');
    await handleConnectExistingSheet(sheetIdOrUrl);
  };

  const handleDisconnectGoogle = () => {
    googleWorkspaceService.clearAuth();
    setIsConnected(false);
    setProfile(null);
    setDriveFiles([]);
  };

  const handleExportSheet = async (type: 'equipments' | 'quotes' | 'oc' | 'orders') => {
    if (!isConnected) {
      await handleConnectGoogle();
      if (!googleWorkspaceService.isConnected()) return;
    }

    setIsExportingSheet(type);
    setSheetSuccess(null);
    setSheetError(null);

    try {
      let result: SheetExportResult;
      if (type === 'equipments') {
        result = await googleWorkspaceService.exportEquipmentsToGoogleSheet(equipments);
      } else if (type === 'quotes') {
        result = await googleWorkspaceService.exportQuotesToGoogleSheet(quotes);
      } else if (type === 'oc') {
        result = await googleWorkspaceService.exportOCTrackingToGoogleSheet(ocContracts);
      } else {
        result = await googleWorkspaceService.exportSalesOrdersToGoogleSheet(salesOrders);
      }

      setSheetSuccess(result);
    } catch (err: any) {
      setSheetError(err.message || 'Error al exportar a Google Sheets.');
    } finally {
      setIsExportingSheet(null);
    }
  };

  const handleSaveBackupToDrive = async () => {
    if (!isConnected) {
      await handleConnectGoogle();
      if (!googleWorkspaceService.isConnected()) return;
    }

    setIsSavingToDrive(true);
    setDriveSuccess(null);
    setDriveError(null);

    try {
      const backupPayload = generateAppBackup({
        quotes,
        equipments,
        tenderProjects: [],
        ocContracts,
        salesOrders,
        technicalDocuments: documents,
        systemUsers: users,
        themeSettings,
        activeLetterheadUrl,
        currentQuoteDraft: quoteHeader && quoteItems ? { header: quoteHeader, items: quoteItems } : undefined,
      });

      const result = await googleWorkspaceService.saveBackupToDrive(backupPayload);
      setDriveSuccess(result);
      await loadDriveFiles();
    } catch (err: any) {
      setDriveError(err.message || 'Error al guardar respaldo en Google Drive.');
    } finally {
      setIsSavingToDrive(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div
        style={{
          backgroundColor: 'var(--syd-card-bg)',
          borderColor: 'var(--syd-border-color)',
          borderRadius: 'var(--syd-card-radius)',
        }}
        className="w-full max-w-[96vw] xl:max-w-7xl h-[95vh] max-h-[96vh] flex flex-col border shadow-2xl overflow-hidden"
      >
        {/* Integrated Compact Header */}
        <div className="px-4 sm:px-5 py-2.5 border-b flex items-center justify-between gap-3 border-slate-700/60 bg-gradient-to-r from-blue-950/60 via-slate-900 to-sky-950/50 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow shrink-0">
              <Cloud className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-white truncate">
                  Google Workspace <span className="text-sky-400 font-semibold text-xs hidden sm:inline">(Sheets & Drive N-FCO-03)</span>
                </h2>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="truncate max-w-[180px] sm:max-w-none">{profile?.email || 'Conectado'}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    No conectado
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isConnected ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={isConnecting}
                  className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs rounded-lg shadow transition cursor-pointer disabled:opacity-50"
                  title="Conectar con Google OAuth oficial"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>{isConnecting ? 'Conectando...' : 'Conectar Google'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleConnectDirect('auxlineadiagnostica@syd.com.co', 'Línea Diagnóstica SYD')}
                  className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg shadow transition cursor-pointer"
                  title="Acceso directo auxlineadiagnostica@syd.com.co"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Directo</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDisconnectGoogle}
                title="Desconectar cuenta"
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs rounded-lg border border-slate-700 transition cursor-pointer"
              >
                <LogOut className="w-3 h-3 text-rose-400" />
                <span className="hidden sm:inline">Desconectar</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer ml-1"
              title="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-slate-700/60 bg-slate-900/60 px-4 sm:px-5 shrink-0">
          <div className="flex">
            <button
              onClick={() => setActiveTab('sheets')}
              className={`flex items-center gap-1.5 py-2 px-3 border-b-2 font-bold text-xs transition cursor-pointer ${
                activeTab === 'sheets'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Google Sheets & Partes (N-FCO-03)</span>
              {connectedSheet && detectedParts.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                  {detectedParts.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('drive')}
              className={`flex items-center gap-1.5 py-2 px-3 border-b-2 font-bold text-xs transition cursor-pointer ${
                activeTab === 'drive'
                  ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Google Drive</span>
            </button>
          </div>

          <label className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-[11px] font-medium rounded-lg cursor-pointer transition">
            <Upload className="w-3 h-3 text-emerald-400" />
            <span>Cargar Excel .xlsx</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleLocalFileUpload} className="hidden" />
          </label>
        </div>

        {/* Content Body */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 flex flex-col space-y-3 min-h-0">
          {/* TAB: GOOGLE SHEETS (EXISTING / READ-ONLY) */}
          {activeTab === 'sheets' && (
            <div className="space-y-3 flex-1 flex flex-col min-h-0">
              {/* TARGET FILE HERO PANEL: ONLY IF NO SHEET IS CONNECTED */}
              {!connectedSheet && (
              <div className="p-4 sm:p-5 rounded-2xl border border-sky-500/40 bg-gradient-to-r from-slate-900 via-sky-950/40 to-slate-900 shadow-xl">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="p-3 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 shrink-0 mt-0.5 shadow-inner">
                      <Target className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-400">
                          Archivo Institucional Solicitado
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                          Excel .xlsx & Google Drive
                        </span>
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-white mt-1 font-mono break-all sm:break-normal">
                        {TARGET_NFCO03_FILENAME}
                      </h3>
                      <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                        Visualiza los datos exactos del archivo de creación, modificación e inactivación de partes tal cual se encuentran en su Google Drive, y añade nuevos registros en tiempo real.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                    {!isConnected ? (
                      <button
                        type="button"
                        onClick={handleConnectGoogle}
                        disabled={isConnecting}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow flex items-center gap-1.5 cursor-pointer"
                      >
                        <HardDrive className="w-3.5 h-3.5" />
                        <span>{isConnecting ? 'Conectando...' : 'Conectar Google Drive'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSearchAndConnectNFCO03}
                        disabled={isSearchingNFCO03}
                        className="px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl transition shadow flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        title="Buscar automáticamente el archivo N-FCO-03 en Google Drive"
                      >
                        <Search className={`w-3.5 h-3.5 ${isSearchingNFCO03 ? 'animate-spin' : ''}`} />
                        <span>{isSearchingNFCO03 ? 'Buscando en Drive...' : 'Buscar N-FCO-03 en Drive'}</span>
                      </button>
                    )}

                    <label className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow">
                      <Upload className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Cargar Archivo Local (.xlsx)</span>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleLocalFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* If multiple matches were found during search */}
                {nfcoSearchMatches.length > 0 && (
                  <div className="mt-3.5 pt-3.5 border-t border-slate-800/80">
                    <p className="text-[11px] font-semibold text-sky-300 mb-2">
                      Archivos coincidentes encontrados en su Google Drive:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                      {nfcoSearchMatches.map((m) => (
                        <div
                          key={m.id}
                          className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs text-white font-medium truncate">{m.name}</p>
                            <p className="text-[10px] text-slate-400">
                              {m.modifiedTime ? `Modificado: ${new Date(m.modifiedTime).toLocaleDateString('es-CO')}` : 'En Google Drive'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleConnectExistingSheet(m.id)}
                            className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold rounded-lg shrink-0 cursor-pointer"
                          >
                            Conectar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              )}

              {/* Feedback Notifications */}
              {sheetConnectionSuccess && (
                <div className="py-2 px-3 rounded-lg bg-emerald-950/50 border border-emerald-500/40 flex items-center justify-between gap-2 text-xs text-emerald-200 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">{sheetConnectionSuccess}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSheetConnectionSuccess(null)}
                    className="text-slate-400 hover:text-white text-xs cursor-pointer px-1.5 py-0.5 rounded bg-slate-800/80 shrink-0"
                  >
                    Cerrar
                  </button>
                </div>
              )}

              {sheetConnectionError && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/60 text-xs text-rose-200 space-y-2 shadow-lg shrink-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-rose-100 text-xs">Aviso de Conexión</p>
                        <p className="text-[11px] text-rose-200 leading-relaxed">{sheetConnectionError}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSheetConnectionError(null)}
                      className="text-slate-400 hover:text-white text-xs cursor-pointer px-2 py-0.5 rounded bg-slate-800/60 border border-slate-700 shrink-0"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              )}

              {/* VIEW 1: A SHEET IS CURRENTLY CONNECTED */}
              {connectedSheet ? (
                <div className="space-y-2.5 flex-1 flex flex-col min-h-0">
                  {/* Connected Sheet Information Card - Clean, Well-Spaced & Elegant */}
                  <div className="bg-slate-900/90 rounded-2xl border border-slate-700/80 p-3.5 sm:p-4 shadow-xl space-y-3 shrink-0">
                    {/* Row 1: File Identity & Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                          <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4
                              className="font-bold text-white text-sm sm:text-base truncate max-w-sm sm:max-w-md"
                              title={connectedSheet.name}
                            >
                              {connectedSheet.name}
                            </h4>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Sincronizada</span>
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1" title="Protección de archivos activa: Modo Solo Consulta. La hoja de Drive nunca será modificada ni alterada.">
                              <ShieldCheck className="w-3 h-3 text-sky-400" />
                              <span>Solo Consulta (Drive Protegido)</span>
                            </span>
                            {connectedSheet.isExcelFile && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                Excel (.xlsx)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                            <span className="text-emerald-400 font-semibold">{detectedParts.length} partes detectadas</span>
                            <span>•</span>
                            <span>{previewData?.rows.length || 0} filas en la hoja</span>
                            {connectedSheet.sheetNames && connectedSheet.sheetNames.length > 0 && (
                              <>
                                <span>•</span>
                                <span>{connectedSheet.sheetNames.length} pestañas</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Top Right Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {connectedSheet.url ? (
                          <a
                            href={connectedSheet.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-xs rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                            title="Abrir archivo en Google Sheets o Drive"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                            <span>Abrir</span>
                          </a>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => loadSheetPreview(connectedSheet.id, selectedSheetTab)}
                          disabled={isLoadingPreview}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-xs rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                          title="Recargar datos de la hoja"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isLoadingPreview ? 'animate-spin' : ''}`} />
                          <span>Recargar</span>
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Sheet Tabs Bar (Pestañas del libro) */}
                    {connectedSheet.sheetNames && connectedSheet.sheetNames.length > 0 && (
                      <div className="pt-2.5 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className="text-xs text-slate-400 font-semibold shrink-0">
                          Pestañas del libro:
                        </span>
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                          {connectedSheet.sheetNames.map((name) => {
                            const isEquipos = name.toUpperCase().trim() === 'EQUIPOS' || name.toUpperCase().includes('EQUIPO');
                            const isActive = (selectedSheetTab || connectedSheet.sheetNames![0]) === name;
                            return (
                              <button
                                key={name}
                                type="button"
                                onClick={() => {
                                  setSelectedSheetTab(name);
                                  loadSheetPreview(connectedSheet.id, name);
                                }}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                                  isActive
                                    ? isEquipos
                                      ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/40'
                                      : 'bg-emerald-600 text-white shadow-md'
                                    : isEquipos
                                    ? 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-700/60 font-bold'
                                    : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700/80'
                                }`}
                              >
                                {isEquipos && <span className="text-amber-400">★</span>}
                                <span>{name}</span>
                                {isEquipos && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 font-bold">
                                    Principal
                                  </span>
                                )}
                                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sub-Navigation Tabs inside Connected Sheet */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-1 shrink-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setConnectedSubTab('table')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          connectedSubTab === 'table'
                            ? 'bg-emerald-600 text-white shadow'
                            : 'bg-slate-800/80 text-slate-300 hover:text-white border border-slate-700/80'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Tabla Excel ({previewData?.rows.length || 0} filas)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setConnectedSubTab('parts')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          connectedSubTab === 'parts'
                            ? 'bg-emerald-600 text-white shadow'
                            : 'bg-slate-800/80 text-slate-300 hover:text-white border border-slate-700/80'
                        }`}
                      >
                        <Boxes className="w-3.5 h-3.5" />
                        <span>Partes Detectadas</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                          connectedSubTab === 'parts' ? 'bg-white/20 text-white' : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                        }`}>
                          {detectedParts.length}
                        </span>
                        {newPartNotification && !newPartNotification.dismissed && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 border border-amber-300 flex items-center gap-0.5 animate-bounce shadow">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>+{newPartNotification.parts.length} Nueva{newPartNotification.parts.length > 1 ? 's' : ''}</span>
                          </span>
                        )}
                      </button>

                      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-950/40 border border-sky-600/40 text-sky-300 text-xs font-medium">
                        <Lock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="text-[11px]">Modo Solo Consulta: Archivo en Drive protegido sin escritura</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => loadSheetPreview(connectedSheet.id, selectedSheetTab)}
                      disabled={isLoadingPreview}
                      className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/80 hover:border-emerald-500/40 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingPreview ? 'animate-spin' : ''}`} />
                      <span>Recargar</span>
                    </button>
                  </div>

                  {/* NOTIFICATION: NEWLY DETECTED PART(S) IN DRIVE */}
                  {newPartNotification && !newPartNotification.dismissed && (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950/70 to-slate-900 border-2 border-emerald-500/80 shadow-2xl animate-fadeIn text-white">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0 mt-0.5 animate-bounce">
                            <Sparkles className="w-5 h-5 text-emerald-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1">
                                <Bell className="w-3 h-3" />
                                <span>¡Nueva Parte Creada Detectada!</span>
                              </span>
                              <span className="text-xs text-slate-400 font-medium">
                                Sincronizada a las {newPartNotification.timestamp}
                              </span>
                            </div>
                            <h4 className="text-sm font-extrabold text-white mt-1">
                              {newPartNotification.parts.length === 1
                                ? `Se detectó la nueva parte: "${newPartNotification.parts[0].name}"`
                                : `Se detectaron ${newPartNotification.parts.length} nuevas partes agregadas en Google Drive`}
                            </h4>
                            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                              {newPartNotification.parts.length === 1 ? (
                                <>
                                  <strong className="text-emerald-300">Código/Ref:</strong>{' '}
                                  <span className="font-mono text-emerald-200 font-bold">{newPartNotification.parts[0].code || 'En trámite'}</span> &nbsp;|&nbsp;
                                  <strong className="text-emerald-300">Proveedor:</strong> {newPartNotification.parts[0].supplier || 'SYD Biomedical'} &nbsp;|&nbsp;
                                  <strong className="text-emerald-300">Marca:</strong> {newPartNotification.parts[0].brand || 'N/D'} &nbsp;|&nbsp;
                                  <strong className="text-emerald-300">Costo:</strong>{' '}
                                  <span className="text-white font-bold">${Number(newPartNotification.parts[0].costCOP || 0).toLocaleString('es-CO')} COP</span>
                                </>
                              ) : (
                                'Las partes añadidas en la hoja institucional han sido detectadas. Puede consultarlas individualmente o crearlas directamente en el catálogo.'
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => {
                              setConnectedSubTab('parts');
                              if (newPartNotification.parts[0]?.code) {
                                setPartsSearchQuery(newPartNotification.parts[0].code);
                              }
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver en Lista</span>
                          </button>
                          {newPartNotification.parts.length === 1 && (
                            <button
                              type="button"
                              onClick={() => handleOpenCreateEquipmentModal(newPartNotification.parts[0])}
                              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl transition shadow flex items-center gap-1.5 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Crear en Catálogo</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => markPartsAsKnown(newPartNotification.parts)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-xl border border-slate-700 transition cursor-pointer"
                            title="Marcar como revisada"
                          >
                            <Check className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
                            <span>Entendido</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUBTAB 1: DETECTED PARTS */}
                  {connectedSubTab === 'parts' && (
                    <div className="space-y-4">
                      {/* Metric Summary Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-700/60">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Total Detectadas</p>
                          <p className="text-xl font-black text-white mt-0.5">{detectedParts.length}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Partes / Ítems</p>
                        </div>
                        <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40">
                          <p className="text-[10px] uppercase font-bold text-emerald-400">Creaciones</p>
                          <p className="text-xl font-black text-emerald-300 mt-0.5">
                            {detectedParts.filter((p) => p.requestType === 'CREACIÓN').length}
                          </p>
                          <p className="text-[10px] text-emerald-400/80 mt-0.5">Nuevas partes</p>
                        </div>
                        <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40">
                          <p className="text-[10px] uppercase font-bold text-amber-400">Modificaciones</p>
                          <p className="text-xl font-black text-amber-300 mt-0.5">
                            {detectedParts.filter((p) => p.requestType === 'MODIFICACIÓN').length}
                          </p>
                          <p className="text-[10px] text-amber-400/80 mt-0.5">Ajustes de parte</p>
                        </div>
                        <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/40">
                          <p className="text-[10px] uppercase font-bold text-rose-400">Inactivadas</p>
                          <p className="text-xl font-black text-rose-300 mt-0.5">
                            {detectedParts.filter((p) => p.requestType === 'INACTIVACIÓN').length}
                          </p>
                          <p className="text-[10px] text-rose-400/80 mt-0.5">Descontinuadas</p>
                        </div>
                      </div>

                      {/* Search & Filter Bar */}
                      <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="relative w-full sm:w-80">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={partsSearchQuery}
                            onChange={(e) => setPartsSearchQuery(e.target.value)}
                            placeholder="Buscar por código (ej. 70859), descripción o marca..."
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
                          />
                          {partsSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setPartsSearchQuery('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                            >
                              ×
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                          <span className="text-[11px] text-slate-400 font-semibold mr-1 shrink-0">Filtrar:</span>
                          {(
                            [
                              { key: 'ALL', label: `Todas (${detectedParts.length})` },
                              {
                                key: 'CREACION',
                                label: `Creación (${detectedParts.filter((p) => p.requestType === 'CREACIÓN').length})`,
                              },
                              {
                                key: 'MODIFICACION',
                                label: `Modificación (${detectedParts.filter((p) => p.requestType === 'MODIFICACIÓN').length})`,
                              },
                              {
                                key: 'INACTIVACION',
                                label: `Inactivación (${detectedParts.filter((p) => p.requestType === 'INACTIVACIÓN').length})`,
                              },
                            ] as const
                          ).map((btn) => (
                            <button
                              key={btn.key}
                              type="button"
                              onClick={() => setPartsFilterType(btn.key)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer whitespace-nowrap ${
                                partsFilterType === btn.key
                                  ? 'bg-emerald-600 text-white shadow'
                                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {btn.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Parts Cards List */}
                      {isLoadingPreview ? (
                        <div className="p-8 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                          <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                          <span>Detectando partes desde Google Sheets...</span>
                        </div>
                      ) : detectedParts.length === 0 ? (
                        <div className="p-8 rounded-xl border border-dashed border-slate-700 text-center space-y-3">
                          <Boxes className="w-8 h-8 text-slate-500 mx-auto" />
                          <div>
                            <p className="text-xs font-semibold text-slate-300">
                              No se detectaron partes con código estructurado en esta pestaña.
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                              Puedes explorar la <strong>Tabla Completa</strong> para ver todas las filas, o hacer clic en <strong>+ Agregar Dato</strong> para registrar la primera parte en este archivo.
                            </p>
                          </div>
                          <div className="flex items-center justify-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setConnectedSubTab('table')}
                              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg transition"
                            >
                              Ver Tabla Completa
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 scrollbar-thin">
                          {detectedParts
                            .filter((part) => {
                              const matchesFilter =
                                partsFilterType === 'ALL' ||
                                (partsFilterType === 'CREACION' && part.requestType === 'CREACIÓN') ||
                                (partsFilterType === 'MODIFICACION' && part.requestType === 'MODIFICACIÓN') ||
                                (partsFilterType === 'INACTIVACION' && part.requestType === 'INACTIVACIÓN');
                              if (!matchesFilter) return false;
                              if (!partsSearchQuery.trim()) return true;
                              const q = partsSearchQuery.toLowerCase();
                              return (
                                part.code.toLowerCase().includes(q) ||
                                part.name.toLowerCase().includes(q) ||
                                (part.brand && part.brand.toLowerCase().includes(q)) ||
                                (part.model && part.model.toLowerCase().includes(q)) ||
                                (part.category && part.category.toLowerCase().includes(q)) ||
                                (part.requester && part.requester.toLowerCase().includes(q))
                              );
                            })
                            .map((part) => {
                              const isCreated = isPartAlreadyCreated(part.code, part.name) || importedPartCodes.has(part.code);
                              const isCopied = copiedCode === part.code;
                              const isNewlyDetected = newlyDetectedParts.some(
                                (np) =>
                                  (np.code && part.code && np.code.trim().toLowerCase() === part.code.trim().toLowerCase()) ||
                                  (np.name && part.name && np.name.trim().toLowerCase() === part.name.trim().toLowerCase())
                              );
                              return (
                                <div
                                  key={part.code}
                                  className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                                    isNewlyDetected
                                      ? 'border-amber-400/90 bg-amber-950/20 shadow-lg ring-1 ring-amber-400/30'
                                      : 'border-slate-700/80 bg-slate-900/60 hover:bg-slate-800/50'
                                  }`}
                                >
                                  <div className="space-y-1.5 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {/* Code Badge */}
                                      <button
                                        type="button"
                                        onClick={() => handleCopyCode(part.code)}
                                        className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 font-mono font-black text-xs flex items-center gap-1 transition cursor-pointer"
                                        title="Copiar código al portapapeles"
                                      >
                                        <span>{part.code}</span>
                                        {isCopied ? (
                                          <CheckCheck className="w-3 h-3 text-emerald-400" />
                                        ) : (
                                          <Copy className="w-3 h-3 text-slate-400" />
                                        )}
                                      </button>

                                      {/* Request Type Badge */}
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                          part.requestType === 'CREACIÓN'
                                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                                            : part.requestType === 'MODIFICACIÓN'
                                            ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                                            : 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                                        }`}
                                      >
                                        {part.requestType}
                                      </span>

                                      {/* Newly Detected In Drive Badge */}
                                      {isNewlyDetected && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 border border-amber-300 flex items-center gap-1 animate-pulse shadow">
                                          <Sparkles className="w-2.5 h-2.5" />
                                          <span>¡NUEVA EN DRIVE!</span>
                                        </span>
                                      )}

                                      {/* Status Badge */}
                                      {part.status && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                                          {part.status}
                                        </span>
                                      )}

                                      {/* Date */}
                                      {part.date && (
                                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                          <Clock className="w-3 h-3" />
                                          <span>{part.date}</span>
                                        </span>
                                      )}
                                    </div>

                                    {/* Description / Name */}
                                    <h5 className="font-bold text-white text-sm leading-snug">
                                      {part.name}
                                    </h5>

                                    {/* Brand, Model, Category, Requester */}
                                    <div className="flex items-center gap-2.5 text-[11px] text-slate-400 flex-wrap">
                                      {part.brand && (
                                        <span className="text-slate-300">
                                          Marca: <strong>{part.brand}</strong>
                                        </span>
                                      )}
                                      {part.model && (
                                        <>
                                          <span>•</span>
                                          <span>Modelo: <strong>{part.model}</strong></span>
                                        </>
                                      )}
                                      {part.category && (
                                        <>
                                          <span>•</span>
                                          <span className="text-sky-300 font-medium">{part.category}</span>
                                        </>
                                      )}
                                      {part.costCOP && part.costCOP > 0 && (
                                        <>
                                          <span>•</span>
                                          <span className="text-emerald-400 font-bold">
                                            $ {part.costCOP.toLocaleString('es-CO')} COP
                                          </span>
                                        </>
                                      )}
                                      {part.requester && (
                                        <>
                                          <span>•</span>
                                          <span className="text-slate-400 italic">Sol: {part.requester}</span>
                                        </>
                                      )}
                                    </div>

                                    {/* Observations if any */}
                                    {part.observations && (
                                      <p className="text-[11px] text-slate-400 bg-slate-800/40 p-1.5 rounded-lg border border-slate-800 italic">
                                        "{part.observations}"
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                    {isCreated ? (
                                      <div
                                        className="px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 select-none shadow-sm"
                                        title="Esta parte ya fue creada como equipo en el catálogo"
                                      >
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                        <span>✓ Equipo Creado</span>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenCreateEquipmentModal(part)}
                                        className="px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40 cursor-pointer transition active:scale-95"
                                        title="Crear equipo con los 9 datos detectados de esta parte (código, descripción, proveedor, marca, modelo, precio, fabricante, IVA, INVIMA)"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Crear Equipo</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUBTAB 2: FULL SHEET TABLE */}
                  {connectedSubTab === 'table' && (() => {
                    const allRows = previewData?.rows || [];
                    const filteredRows = allRows.filter((row) => {
                      if (!tableSearchQuery.trim()) return true;
                      const q = tableSearchQuery.toLowerCase();
                      return row.some((c) => String(c || '').toLowerCase().includes(q));
                    });

                    const totalPages = Math.max(1, Math.ceil(filteredRows.length / tablePageSize));
                    const safePage = Math.min(tableCurrentPage, totalPages);
                    const startIndex = (safePage - 1) * tablePageSize;
                    const visibleRows = filteredRows.slice(startIndex, startIndex + tablePageSize);

                    const handleDownloadTableAsExcel = () => {
                      if (!previewData || !previewData.headers.length) return;
                      const wb = XLSX.utils.book_new();
                      const wsData = [previewData.headers, ...filteredRows];
                      const ws = XLSX.utils.aoa_to_sheet(wsData);
                      const sheetName = (selectedSheetTab || connectedSheet.name || 'Hoja1').slice(0, 31);
                      XLSX.utils.book_append_sheet(wb, ws, sheetName);
                      XLSX.writeFile(wb, `${(connectedSheet.name || 'Hoja_Google').replace(/[^a-zA-Z0-9_-]/g, '_')}_export.xlsx`);
                    };

                    return (
                      <div className="flex-1 flex flex-col min-h-0 space-y-2">
                        {/* Compact Table Toolbar: Search, Filters, Stats & Export */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900/90 p-2 rounded-xl border border-slate-800 shrink-0">
                          <div className="relative flex-1 min-w-[220px]">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={tableSearchQuery}
                              onChange={(e) => {
                                setTableSearchQuery(e.target.value);
                                setTableCurrentPage(1);
                              }}
                              placeholder="Filtrar filas por código, nombre, grupo, clase, proveedor..."
                              className="w-full pl-9 pr-8 py-1.5 bg-slate-800/90 border border-slate-700/90 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                            />
                            {tableSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setTableSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                              >
                                ×
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-300 shrink-0 flex-wrap">
                            {selectedSheetTab && (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-mono font-bold">
                                {selectedSheetTab}
                              </span>
                            )}

                            <span className="text-[11px] text-slate-300 bg-slate-800 px-2 py-1 rounded border border-slate-700 font-medium">
                              {filteredRows.length} de {allRows.length} filas
                            </span>

                            <div className="flex items-center gap-1">
                              <span className="text-slate-400 text-[11px]">Pág:</span>
                              <select
                                value={tablePageSize}
                                onChange={(e) => {
                                  setTablePageSize(Number(e.target.value));
                                  setTableCurrentPage(1);
                                }}
                                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-1.5 py-1 focus:outline-none focus:border-emerald-500 cursor-pointer"
                              >
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value={300}>300</option>
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={handleDownloadTableAsExcel}
                              disabled={!previewData?.rows?.length}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 border border-slate-700 shadow-sm"
                              title="Descargar datos en formato Excel (.xlsx)"
                            >
                              <Download className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Descargar Excel</span>
                            </button>
                          </div>
                        </div>

                        {/* Full Size Excel Table Container */}
                        <div className="flex-1 overflow-auto border border-slate-700/80 rounded-xl bg-slate-950/90 shadow-2xl min-h-[500px] max-h-[64vh] scrollbar-thin">
                          {isLoadingPreview ? (
                            <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
                              <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                              <span className="font-semibold text-slate-300">Cargando y sincronizando filas desde la hoja...</span>
                            </div>
                          ) : previewData && previewData.headers.length > 0 ? (
                            <table className="w-full text-left text-xs text-slate-200 border-collapse">
                              <thead className="bg-slate-800/98 sticky top-0 border-b-2 border-emerald-500/50 text-slate-100 shadow z-10 backdrop-blur-sm">
                                <tr>
                                  <th className="py-2.5 px-3 text-[11px] font-bold text-slate-400 border-r border-slate-700/60 w-12 text-center bg-slate-800">
                                    #
                                  </th>
                                  <th className="py-2.5 px-3 text-[11px] font-bold text-slate-100 border-r border-slate-700/60 text-center w-28 bg-slate-800 whitespace-nowrap">
                                    Acción
                                  </th>
                                  {previewData.headers.map((h, i) => (
                                    <th
                                      key={i}
                                      className="py-2.5 px-3.5 font-bold border-r border-slate-700/60 text-slate-100 bg-slate-800 whitespace-nowrap text-[11px] tracking-wide"
                                    >
                                      {h || `Columna ${i + 1}`}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/80">
                                {visibleRows.length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={previewData.headers.length + 2}
                                      className="p-12 text-center text-slate-400 text-xs"
                                    >
                                      {tableSearchQuery
                                        ? `No se encontraron filas que coincidan con "${tableSearchQuery}".`
                                        : 'La hoja no contiene filas con datos en este momento.'}
                                    </td>
                                  </tr>
                                ) : (
                                  visibleRows.map((row, rIdx) => {
                                    const actualIdx = startIndex + rIdx + 1;
                                    const rowParts = googleWorkspaceService.detectPartsFromSpreadsheetData(previewData.headers, [row]);
                                    const rowPart = rowParts.length > 0 ? rowParts[0] : null;
                                    const candidateCode = rowPart?.code || row.find((c) => /^\d{4,8}$/i.test(String(c).trim()) || /^[A-Z0-9\-_]{3,15}$/i.test(String(c).trim()));
                                    const candidateName = rowPart?.name || row.find((c) => String(c).length > 5 && !String(c).includes('@') && !/^\d+$/.test(String(c)));
                                    const isRowCreated = isPartAlreadyCreated(candidateCode, candidateName);

                                    return (
                                      <tr
                                        key={rIdx}
                                        className={
                                          rIdx % 2 === 0
                                            ? 'bg-slate-900/40 hover:bg-emerald-950/20 transition-colors'
                                            : 'bg-slate-900/80 hover:bg-emerald-950/20 transition-colors'
                                        }
                                      >
                                        <td className="py-2 px-3 text-[11px] font-mono text-slate-500 border-r border-slate-800 text-center select-none font-bold bg-slate-900/60">
                                          {actualIdx}
                                        </td>
                                        <td className="py-2 px-2.5 border-r border-slate-800/60 text-center whitespace-nowrap bg-slate-900/40">
                                          {isRowCreated ? (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 inline-flex items-center gap-1">
                                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                              <span>✓ Creado</span>
                                            </span>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => handleOpenCreateFromRow(row, startIndex + rIdx)}
                                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-1 shadow cursor-pointer transition active:scale-95"
                                              title="Crear equipo con los datos de esta fila y añadir a creación de equipos"
                                            >
                                              <Plus className="w-3 h-3" />
                                              <span>Crear</span>
                                            </button>
                                          )}
                                        </td>
                                        {previewData.headers.map((_, cIdx) => (
                                          <td
                                            key={cIdx}
                                            className="py-2.5 px-3.5 border-r border-slate-800/60 text-slate-200 font-medium whitespace-nowrap"
                                            title={String(row[cIdx] || '')}
                                          >
                                            {row[cIdx] !== undefined && row[cIdx] !== null ? String(row[cIdx]) : ''}
                                          </td>
                                        ))}
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          ) : (
                            <div className="p-16 text-center text-xs text-slate-400 space-y-2">
                              <p className="font-semibold text-slate-300">No hay filas disponibles en esta hoja o pestaña.</p>
                              <p className="text-slate-500">Utilice el botón "Recargar" para volver a leer los datos.</p>
                            </div>
                          )}
                        </div>

                        {/* Pagination Bar */}
                        {filteredRows.length > tablePageSize && (
                          <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-lg text-xs text-slate-400 shrink-0">
                            <div>
                              Mostrando {startIndex + 1} - {Math.min(startIndex + tablePageSize, filteredRows.length)} de {filteredRows.length} filas
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setTableCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={safePage <= 1}
                                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                                <span>Anterior</span>
                              </button>
                              <span className="px-2 font-mono text-slate-200">
                                {safePage} / {totalPages}
                              </span>
                              <button
                                type="button"
                                onClick={() => setTableCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={safePage >= totalPages}
                                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                              >
                                <span>Siguiente</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* VIEW 2: NO SHEET CONNECTED YET - CONNECTION OPTIONS */
                <div className="space-y-4">
                  {!isConnected ? (
                    /* Clean Informative Card when no Google account is connected */
                    <div className="p-5 rounded-2xl border border-slate-700/80 bg-slate-900/80 shadow-xl space-y-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="p-3.5 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 shrink-0">
                          <HardDrive className="w-7 h-7 text-sky-400" />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-bold text-white">
                            Sin cuenta de Google Drive sincronizada ni archivo de cálculo vinculado
                          </h4>
                          <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                            Para consultar tus hojas de cálculo institucionales (como el formato N-FCO-03) o gestionar partes y equipos, sincroniza tu cuenta de Google Workspace o carga tu archivo de Excel (.xlsx) local.
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          onClick={handleConnectGoogle}
                          disabled={isConnecting}
                          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 shadow-md"
                        >
                          <Cloud className="w-4 h-4" />
                          <span>Conectar con Google Drive (OAuth)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConnectDirect('auxlineadiagnostica@syd.com.co', 'Línea Diagnóstica SYD')}
                          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer active:scale-95 shadow-md"
                        >
                          <span>⚡ Conectar auxlineadiagnostica@syd.com.co</span>
                        </button>
                        <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shadow-sm">
                          <Upload className="w-4 h-4 text-emerald-400" />
                          <span>Cargar Archivo Excel (.xlsx)</span>
                          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleLocalFileUpload} className="hidden" />
                        </label>
                      </div>
                    </div>
                  ) : null}

                  {/* Option 1: Existing Drive Sheets List */}
                  <div className="p-4 rounded-xl border border-slate-700/70 bg-slate-900/50">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-1.5">
                          <HardDrive className="w-4 h-4 text-emerald-400" />
                          <span>Hojas de Cálculo Existentes en tu Google Drive</span>
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Selecciona una hoja que ya tengas creada en tu cuenta para conectarla en modo lectura:
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={loadDriveSheets}
                        disabled={isLoadingDriveSheets || !isConnected}
                        className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${isLoadingDriveSheets ? 'animate-spin' : ''}`} />
                        <span>Buscar en Drive</span>
                      </button>
                    </div>

                    {!isConnected ? (
                      <div className="p-6 rounded-lg border border-dashed border-slate-700 text-center space-y-3">
                        <p className="text-xs text-slate-400">
                          Conecta tu cuenta institucional o de Google Workspace para sincronizar tus documentos:
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleConnectDirect('auxlineadiagnostica@syd.com.co', 'Línea Diagnóstica SYD')}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition cursor-pointer active:scale-95 shadow-sm"
                          >
                            ⚡ Conectar auxlineadiagnostica@syd.com.co (Directo)
                          </button>
                          <button
                            type="button"
                            onClick={handleConnectGoogle}
                            disabled={isConnecting}
                            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg transition cursor-pointer active:scale-95 disabled:opacity-50"
                          >
                            Conectar con Google OAuth
                          </button>
                        </div>
                      </div>
                    ) : isLoadingDriveSheets ? (
                      <div className="p-6 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                        <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                        <span>Consultando archivos de Google Drive...</span>
                      </div>
                    ) : existingDriveSheets.length > 0 ? (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                        {existingDriveSheets.map((sh) => (
                          <div
                            key={sh.id}
                            className="p-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 flex items-center justify-between gap-3 transition"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate">{sh.name}</p>
                                <p className="text-[10px] text-slate-400 truncate">
                                  {sh.modifiedTime
                                    ? `Modificado: ${new Date(sh.modifiedTime).toLocaleDateString('es-CO')}`
                                    : 'En Google Drive'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {sh.webViewLink && (
                                <a
                                  href={sh.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-700 text-emerald-300 hover:text-emerald-200 text-xs font-semibold flex items-center gap-1 transition"
                                  title="Abrir este archivo directamente en Google Sheets"
                                >
                                  <span>Abrir</span>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => handleConnectExistingSheet(sh.id)}
                                disabled={isConnectingSheet}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition cursor-pointer disabled:opacity-50"
                              >
                                Conectar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 rounded-lg bg-slate-800/40 text-center text-xs text-slate-300 space-y-2">
                        <p className="text-slate-300">No se detectaron hojas de cálculo de Google Sheets con la sesión actual.</p>
                        <p className="text-[11px] text-slate-400">
                          Si tu cuenta abierta tiene archivos en Drive, pulsa el botón para actualizar y autorizar la lectura de Google Drive, o ingresa el enlace directo abajo:
                        </p>
                        <button
                          type="button"
                          onClick={handleConnectGoogle}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Actualizar Permisos de Google Drive</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Option 2: Connect by URL or Spreadsheet ID */}
                  <div className="p-4 rounded-xl border border-slate-700/70 bg-slate-900/50">
                    <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-1.5 mb-1">
                      <Link2 className="w-4 h-4 text-emerald-400" />
                      <span>O Conectar mediante Enlace o ID de Google Sheets</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mb-3">
                      Pega la URL completa de tu hoja de cálculo o su identificador alfanumérico:
                    </p>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleConnectExistingSheet(sheetInputUrl);
                      }}
                      className="flex flex-col sm:flex-row gap-2"
                    >
                      <input
                        type="text"
                        value={sheetInputUrl}
                        onChange={(e) => setSheetInputUrl(e.target.value)}
                        placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                        className="flex-1 px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 font-mono"
                      />
                      <button
                        type="submit"
                        disabled={isConnectingSheet || !sheetInputUrl.trim()}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        {isConnectingSheet ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Verificando...</span>
                          </>
                        ) : (
                          <>
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>Conectar & Detectar Partes</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: GOOGLE DRIVE */}
          {activeTab === 'drive' && (
            <div className="space-y-4">
              {/* Account & Info Bar */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-700/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-sky-400" />
                    <span>Explorador de Archivos de Google Drive</span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {isConnected ? (
                      <>
                        Conectado como <strong className="text-sky-300">{profile?.email}</strong>. Puedes ver y abrir los archivos de tu Drive, o conectar hojas de cálculo en modo solo lectura.
                      </>
                    ) : (
                      'Conecta tu cuenta de Google para explorar tus archivos y abrir tus hojas de cálculo.'
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href="https://drive.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <span>Ir a Google Drive Web</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    type="button"
                    onClick={handleSaveBackupToDrive}
                    disabled={isSavingToDrive || !isConnected}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white font-bold text-xs rounded-lg shadow transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingToDrive ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Subiendo...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Subir Respaldo</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {driveSuccess && (
                <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-500/50 flex items-center justify-between gap-3 text-xs text-blue-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold text-white">Respaldo Guardado en Google Drive</p>
                      <p className="text-blue-300 truncate">{driveSuccess.name}</p>
                    </div>
                  </div>
                  <a
                    href={driveSuccess.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center gap-1.5 transition shrink-0"
                  >
                    <span>Abrir</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {driveError && (
                <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-200">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{driveError}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(driveError.includes('Google Drive API') || driveError.includes('habilitada')) && (
                      <a
                        href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-[11px] flex items-center gap-1.5 transition shadow"
                      >
                        <span>Habilitar Drive API</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={handleConnectGoogle}
                      disabled={isConnecting}
                      className="px-3 py-1.5 bg-sky-700 hover:bg-sky-600 text-white font-semibold rounded-lg text-[11px] transition cursor-pointer flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3 h-3 ${isConnecting ? 'animate-spin' : ''}`} />
                      <span>Conectar con OAuth</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Explorer Search and Filter Toolbar */}
              <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                {/* Search */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={driveSearchQuery}
                    onChange={(e) => {
                      setDriveSearchQuery(e.target.value);
                      loadDriveFiles(undefined, e.target.value);
                    }}
                    placeholder="Buscar archivos por nombre..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 transition"
                  />
                  {driveSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setDriveSearchQuery('');
                        loadDriveFiles(undefined, '');
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                  <span className="text-[11px] text-slate-400 font-semibold mr-1 hidden md:inline">Filtrar:</span>
                  {(
                    [
                      { key: 'all', label: 'Todos' },
                      { key: 'sheets', label: 'Hojas de Cálculo' },
                      { key: 'docs', label: 'Documentos' },
                      { key: 'folders', label: 'Carpetas' },
                    ] as const
                  ).map((filterOpt) => (
                    <button
                      key={filterOpt.key}
                      type="button"
                      onClick={() => {
                        setDriveMimeFilter(filterOpt.key);
                        loadDriveFiles(filterOpt.key, driveSearchQuery);
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                        driveMimeFilter === filterOpt.key
                          ? 'bg-sky-600 text-white shadow'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {filterOpt.label}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => loadDriveFiles()}
                    disabled={isLoadingDriveFiles || !isConnected}
                    className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50 ml-1"
                    title="Recargar archivos"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDriveFiles ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Files Table / List */}
              <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-700/60 flex items-center justify-between bg-slate-900/60">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-300">
                      Archivos Encontrados en tu Google Drive
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] text-sky-400 font-bold">
                      {driveFiles.length}
                    </span>
                  </div>
                  {isConnected && (
                    <button
                      type="button"
                      onClick={handleConnectGoogle}
                      className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Actualizar Permisos de Drive</span>
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-800/80 max-h-[360px] overflow-y-auto scrollbar-thin">
                  {!isConnected ? (
                    <div className="p-8 text-center space-y-3">
                      <p className="text-xs text-slate-400">
                        Inicia sesión con tu cuenta de Google para acceder a todos los archivos y hojas de cálculo de tu Drive.
                      </p>
                      <button
                        type="button"
                        onClick={handleConnectGoogle}
                        disabled={isConnecting}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
                      >
                        Conectar Google Workspace
                      </button>
                    </div>
                  ) : isLoadingDriveFiles ? (
                    <div className="p-8 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                      <RefreshCw className="w-5 h-5 animate-spin text-sky-400" />
                      <span>Cargando archivos desde Google Drive...</span>
                    </div>
                  ) : driveFiles.length === 0 ? (
                    googleWorkspaceService.getAccessToken()?.startsWith('direct_token_') ? (
                      <div className="p-8 text-center space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-inner">
                          <HardDrive className="w-6 h-6" />
                        </div>
                        <div className="max-w-md mx-auto space-y-1.5">
                          <p className="text-xs font-bold text-slate-200">
                            Modo Conexión Directa Activo ({profile?.email || 'Institucional'})
                          </p>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            La Conexión Directa es un acceso rápido sin conexión directa a servidores de Google. Para listar y sincronizar tus archivos y hojas de cálculo de Drive en tiempo real, conecta con tu cuenta de Google mediante OAuth con el nuevo ID de cliente.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleConnectGoogle}
                            disabled={isConnecting}
                            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-2 cursor-pointer"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
                            <span>Conectar con Google Drive (OAuth)</span>
                          </button>
                          <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs rounded-xl shadow transition flex items-center gap-2 cursor-pointer">
                            <Upload className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Cargar Excel N-FCO-03 (.xlsx)</span>
                            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleLocalFileUpload} className="hidden" />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center space-y-3">
                        <HardDrive className="w-8 h-8 text-slate-500 mx-auto" />
                        <div>
                          <p className="text-xs font-semibold text-slate-300">
                            {driveSearchQuery || driveMimeFilter !== 'all'
                              ? 'No se encontraron archivos con los filtros actuales.'
                              : 'No se encontraron archivos en este Google Drive o se requiere actualizar permisos.'}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                            Verifica que hayas iniciado sesión con la cuenta de Google que contiene tus archivos institucionales y que los permisos de Google Drive estén otorgados.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                          {(driveSearchQuery || driveMimeFilter !== 'all') && (
                            <button
                              type="button"
                              onClick={() => {
                                setDriveMimeFilter('all');
                                setDriveSearchQuery('');
                                loadDriveFiles('all', '');
                              }}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg transition cursor-pointer"
                            >
                              Ver Todos los Archivos
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => loadDriveFiles()}
                            className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Recargar Archivos de Drive</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleConnectGoogle}
                            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 font-semibold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>Reautorizar Permisos</span>
                          </button>
                          <a
                            href="https://drive.google.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg transition flex items-center gap-1.5"
                          >
                            <span>Abrir Google Drive</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    )
                  ) : (
                    driveFiles.map((file) => {
                      const isSheet =
                        file.mimeType?.includes('spreadsheet') ||
                        file.mimeType?.includes('excel') ||
                        file.name.endsWith('.xlsx') ||
                        file.name.endsWith('.xls') ||
                        file.name.endsWith('.csv');
                      const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                      const isDoc = file.mimeType?.includes('document') || file.mimeType?.includes('pdf');

                      return (
                        <div
                          key={file.id}
                          className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition text-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 rounded-lg bg-slate-800 shrink-0">
                              {isSheet ? (
                                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                              ) : isFolder ? (
                                <Folder className="w-4 h-4 text-amber-400" />
                              ) : isDoc ? (
                                <FileText className="w-4 h-4 text-blue-400" />
                              ) : (
                                <FileText className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-white truncate flex items-center gap-2">
                                <span className="truncate">{file.name}</span>
                                {isSheet && (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 text-[9px] font-bold shrink-0">
                                    Sheets
                                  </span>
                                )}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                <span>
                                  {file.modifiedTime
                                    ? `Modificado: ${new Date(file.modifiedTime).toLocaleDateString('es-CO')}`
                                    : file.createdTime
                                    ? `Creado: ${new Date(file.createdTime).toLocaleDateString('es-CO')}`
                                    : 'En Google Drive'}
                                </span>
                                {file.size && (
                                  <>
                                    <span>•</span>
                                    <span>{parseInt(file.size, 10) > 1024 * 1024 ? `${(parseInt(file.size, 10) / (1024 * 1024)).toFixed(1)} MB` : `${(parseInt(file.size, 10) / 1024).toFixed(0)} KB`}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            {/* Connect in App (If Spreadsheet) */}
                            {isSheet && (
                              <button
                                type="button"
                                onClick={() => handleConnectSheetFromDrive(file.id)}
                                disabled={isConnectingSheet}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow"
                                title="Conectar esta hoja, explorar su contenido y detectar partes"
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                <span>Conectar & Detectar Partes</span>
                              </button>
                            )}

                            {/* Direct Open Link */}
                            <a
                              href={file.webViewLink || (isSheet ? `https://docs.google.com/spreadsheets/d/${file.id}/edit` : `https://drive.google.com/file/d/${file.id}/view`)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 font-semibold text-[11px] flex items-center gap-1 transition shrink-0"
                              title="Abrir este archivo en Google Drive / Docs"
                            >
                              <span>Abrir</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Compact Footer */}
        <div className="px-4 sm:px-5 py-2 bg-slate-900/90 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="truncate">Google Workspace: Catálogo oficial N-FCO-03 y Google Drive</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition cursor-pointer text-xs"
          >
            Cerrar
          </button>
        </div>

        {/* Modal for creating equipment directly from spreadsheet part */}
        <CreateEquipmentFromPartModal
          isOpen={isEquipmentModalOpen}
          onClose={() => {
            setIsEquipmentModalOpen(false);
            setPartForEquipmentModal(null);
          }}
          partData={partForEquipmentModal}
          onSaveEquipment={handleSaveEquipmentFromPart}
        />
      </div>
    </div>,
    document.body
  );
};
