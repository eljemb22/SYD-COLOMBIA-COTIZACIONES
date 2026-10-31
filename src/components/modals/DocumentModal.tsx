import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FolderArchive,
  UploadCloud,
  FileText,
  ShieldCheck,
  BookOpen,
  Wrench,
  Zap,
  Award,
  File,
  CheckCircle2,
  AlertCircle,
  X,
  Image as ImageIcon,
  FileType,
  Trash2,
  Plus,
  Check,
} from 'lucide-react';
import { TechnicalDocument, TechnicalDocumentType, MedicalEquipment } from '../../types';
import { UnifiedAttachmentSelector, AttachmentResult } from '../common/UnifiedAttachmentSelector';
import { googleWorkspaceService } from '../../services/googleWorkspaceService';

interface DocumentModalProps {
  isOpen: boolean;
  equipments: MedicalEquipment[];
  existingDocuments?: TechnicalDocument[];
  initialEquipmentId?: string;
  initialEquipmentData?: {
    id?: string;
    code?: string;
    name?: string;
    brand?: string;
    model?: string;
    invimaRecordNumber?: string;
    invimaExpiryDate?: string;
  };
  contractContext?: {
    processNumber: string;
    clientName: string;
    contractFolderId?: string;
    contractFolderName?: string;
  };
  initialDocType?: string;
  onClose: () => void;
  onSave: (doc: TechnicalDocument) => void;
}

export const DOCUMENT_TYPES: {
  type: string;
  label: string;
  icon: any;
  color: string;
  desc: string;
}[] = [
  {
    type: 'Ficha Técnica',
    label: '📋 Ficha Técnica',
    icon: FileText,
    color: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
    desc: 'Especificaciones de fábrica, curvas o accesorios',
  },
  {
    type: 'Registro INVIMA',
    label: '🏛️ Registro INVIMA',
    icon: ShieldCheck,
    color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    desc: 'Registro sanitario legal y resoluciones',
  },
  {
    type: 'Manual de Usuario',
    label: '📖 Manual de Usuario',
    icon: BookOpen,
    color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    desc: 'Guía de operación clínica para personal médico',
  },
  {
    type: 'Manual de Servicio',
    label: '🔧 Manual de Servicio',
    icon: Wrench,
    color: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
    desc: 'Planos, calibración y mantenimiento técnico',
  },
  {
    type: 'Guía Rápida',
    label: '⚡ Guía Rápida',
    icon: Zap,
    color: 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10',
    desc: 'Instrucciones resumidas de uso y manejo en 1-2 páginas',
  },
  {
    type: 'Protocolo de Limpieza',
    label: '🧼 Protocolo de Limpieza',
    icon: ShieldCheck,
    color: 'text-teal-400 border-teal-500/30 bg-teal-500/10',
    desc: 'Protocolo de limpieza, desinfección y esterilización',
  },
  {
    type: 'Certificado de Calibración',
    label: '⚙️ Certificado Calibración',
    icon: Wrench,
    color: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10',
    desc: 'Seguridad eléctrica, metrología y calibración biomédica',
  },
  {
    type: 'Carta de Representación',
    label: '📜 Carta Representación',
    icon: Award,
    color: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
    desc: 'Distribución autorizada, soporte o garantía de fábrica',
  },
  {
    type: 'Certificado Calidad',
    label: '🏅 Certificado Calidad',
    icon: Award,
    color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
    desc: 'Certificaciones ISO 13485, CE 0123 o FDA',
  },
  {
    type: 'Otro Documento',
    label: '📁 Otro / Personalizado',
    icon: File,
    color: 'text-purple-300 border-purple-500/40 bg-purple-500/10',
    desc: 'Escriba o clasifique libremente cualquier otro documento técnico',
  },
];

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];

export const DocumentModal: React.FC<DocumentModalProps> = ({
  isOpen,
  equipments,
  existingDocuments = [],
  initialEquipmentId,
  initialEquipmentData,
  contractContext,
  initialDocType,
  onClose,
  onSave,
}) => {
  const [equipmentId, setEquipmentId] = useState<string>(
    initialEquipmentId || equipments[0]?.id || ''
  );
  const [selectedType, setSelectedType] = useState<string>(
    initialDocType || 'Ficha Técnica'
  );
  const [customTypeName, setCustomTypeName] = useState('');
  const [title, setTitle] = useState('');
  const [invimaNumber, setInvimaNumber] = useState('');
  const [validUntil, setValidUntil] = useState('2028-12-31');
  const [status, setStatus] = useState<'Vigente' | 'En Trámite' | 'Vencido'>('Vigente');
  const [notes, setNotes] = useState('');
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // File state
  const [attachment, setAttachment] = useState<AttachmentResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [fileData, setFileData] = useState<string | undefined>(undefined);
  const [fileType, setFileType] = useState<string | undefined>(undefined);
  const [fileCategory, setFileCategory] = useState<'pdf' | 'image' | 'word' | 'other'>('pdf');
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleAttachmentChange = (att: AttachmentResult | null) => {
    setAttachment(att);
    if (att) {
      setFileName(att.fileName);
      setFileSize(att.fileSize);
      setFileData(att.fileData);
      setFileType(att.fileType);
      setErrorMessage(null);
      if (att.classification) {
        handleTypeSelect(att.classification);
      }
      if (att.invimaNumber) {
        setInvimaNumber(att.invimaNumber);
      }
      if (att.fileName && (!title || title.startsWith('Ficha Técnica Oficial') || title.startsWith('Registro Sanitario') || title.startsWith('Manual de Operación') || title.startsWith('Documento Técnico'))) {
        setTitle(att.fileName.replace(/\.[^/.]+$/, ''));
      }
    } else {
      setFileName('');
      setFileSize('');
      setFileData(undefined);
      setFileType(undefined);
    }
  };

  // Sync state with props when opening modal
  useEffect(() => {
    if (isOpen) {
      const selectedEqId = initialEquipmentId || equipments[0]?.id || '';
      setEquipmentId(selectedEqId);

      const targetType = initialDocType || 'Ficha Técnica';
      const isKnownType = DOCUMENT_TYPES.some((d) => d.type === targetType);
      if (isKnownType) {
        setSelectedType(targetType);
        setCustomTypeName('');
      } else {
        setSelectedType('Otro Documento');
        setCustomTypeName(targetType === 'Otro' ? '' : targetType);
      }

      let eq = equipments.find((e) => e.id === selectedEqId);
      if (!eq && initialEquipmentData) {
        eq = {
          id: selectedEqId,
          code: initialEquipmentData.code || '',
          name: initialEquipmentData.name || '',
          brand: initialEquipmentData.brand || 'SYD',
          model: initialEquipmentData.model || 'General',
          category: 'Biomédico',
          description: '',
          technicalSpecs: [],
          accessories: [],
          commercialConditions: '',
          invimaRecordNumber: initialEquipmentData.invimaRecordNumber || '',
          invimaExpiryDate: initialEquipmentData.invimaExpiryDate || '2028-12-31',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as unknown as MedicalEquipment;
      }
      const existingSameTypeCount = existingDocuments.filter(
        (d) => d.equipmentId === selectedEqId && d.docType === targetType
      ).length;

      if (eq) {
        if (targetType === 'Registro INVIMA') {
          setInvimaNumber(eq.invimaRecordNumber || '');
          setValidUntil(eq.invimaExpiryDate || '2028-12-31');
          setTitle(`Registro Sanitario INVIMA ${eq.invimaRecordNumber || ''} - ${eq.brand} ${eq.model}`);
        } else if (targetType === 'Ficha Técnica') {
          if (existingSameTypeCount > 0) {
            setTitle(`Ficha Técnica (${existingSameTypeCount + 1}) - ${eq.brand} ${eq.model}`);
          } else {
            setTitle(`Ficha Técnica Oficial - ${eq.brand} ${eq.model}`);
          }
        } else if (targetType === 'Manual de Usuario') {
          setTitle(`Manual de Operación - ${eq.brand} ${eq.model}`);
        } else if (targetType === 'Manual de Servicio') {
          setTitle(`Manual de Servicio Técnico - ${eq.brand} ${eq.model}`);
        } else if (targetType === 'Guía Rápida') {
          setTitle(`Guía Rápida de Manejo - ${eq.brand} ${eq.model}`);
        } else if (targetType === 'Protocolo de Limpieza') {
          setTitle(`Protocolo de Limpieza y Desinfección - ${eq.brand} ${eq.model}`);
        } else if (targetType === 'Certificado de Calibración') {
          setTitle(`Certificado de Calibración y Metrología - ${eq.brand} ${eq.model}`);
        } else if (targetType === 'Carta de Representación') {
          setTitle(`Carta de Representación y Garantía - ${eq.brand} ${eq.model}`);
        } else if (targetType === 'Certificado Calidad') {
          setTitle(`Certificado de Calidad ISO/CE - ${eq.brand} ${eq.model}`);
        } else {
          setTitle(`Documento Técnico (${targetType || 'Personalizado'}) - ${eq.brand} ${eq.model}`);
        }
      } else {
        setTitle('');
      }

      setAttachment(null);
      setFileName('');
      setFileSize('');
      setFileData(undefined);
      setFileType(undefined);
      setNotes('');
      setErrorMessage(null);
    }
  }, [isOpen, initialEquipmentId, initialDocType, equipments]);

  // Handle ESC key press to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleEquipmentChange = (newEqId: string) => {
    setEquipmentId(newEqId);
    setAttachment(null);
    setFileName('');
    setFileSize('');
    setFileData(undefined);
    setFileType(undefined);
    setErrorMessage(null);
    const eq = equipments.find((e) => e.id === newEqId);
    const effectiveType = selectedType === 'Otro Anexo' && customTypeName ? customTypeName : selectedType;
    if (eq) {
      if (effectiveType === 'Registro INVIMA') {
        setInvimaNumber(eq.invimaRecordNumber || '');
        setValidUntil(eq.invimaExpiryDate || '2028-12-31');
        setTitle(`Registro Sanitario INVIMA ${eq.invimaRecordNumber || ''} - ${eq.brand} ${eq.model}`);
      } else {
        setTitle(`${effectiveType} - ${eq.brand} ${eq.model}`);
      }
    }
  };

  const handleTypeSelect = (type: string) => {
    setSelectedType(type);
    const eq = equipments.find((e) => e.id === equipmentId);
    const existingSameTypeCount = existingDocuments.filter(
      (d) => d.equipmentId === equipmentId && d.docType === type
    ).length;

    if (eq) {
      if (type === 'Registro INVIMA') {
        setInvimaNumber(eq.invimaRecordNumber || '');
        setValidUntil(eq.invimaExpiryDate || '2028-12-31');
        setTitle(`Registro Sanitario INVIMA ${eq.invimaRecordNumber || ''} - ${eq.brand} ${eq.model}`);
      } else if (type === 'Ficha Técnica') {
        if (existingSameTypeCount > 0) {
          setTitle(`Ficha Técnica (${existingSameTypeCount + 1}) - ${eq.brand} ${eq.model}`);
        } else {
          setTitle(`Ficha Técnica Oficial - ${eq.brand} ${eq.model}`);
        }
      } else {
        setTitle(`${type} - ${eq.brand} ${eq.model}`);
      }
    }
  };

  let currentEquipment = equipments.find((e) => e.id === equipmentId);
  if (!currentEquipment && initialEquipmentData && (!initialEquipmentId || equipmentId === initialEquipmentId)) {
    currentEquipment = {
      id: equipmentId || initialEquipmentData.id || `eq-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      code: initialEquipmentData.code || '',
      name: initialEquipmentData.name || '',
      brand: initialEquipmentData.brand || 'SYD',
      model: initialEquipmentData.model || 'General',
      category: 'Biomédico',
      description: '',
      technicalSpecs: [],
      accessories: [],
      commercialConditions: '',
      invimaRecordNumber: initialEquipmentData.invimaRecordNumber || '',
      invimaExpiryDate: initialEquipmentData.invimaExpiryDate || '2028-12-31',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as MedicalEquipment;
  }

  const attachedForThisEq = existingDocuments.filter((d) => d.equipmentId === equipmentId);

  const validateAndProcessFile = (file: File) => {
    setErrorMessage(null);
    const name = file.name.toLowerCase();
    const isAllowed = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));

    if (!isAllowed) {
      setErrorMessage(
        `Formato de archivo no permitido ("${file.name}"). Solo se admiten archivos PDF (.pdf), Imágenes (.jpg, .jpeg, .png) o Documentos Word (.doc, .docx).`
      );
      return;
    }

    setFileName(file.name);
    setFileType(file.type || 'application/octet-stream');

    if (name.endsWith('.pdf') || file.type.includes('pdf')) {
      setFileCategory('pdf');
    } else if (
      name.endsWith('.jpg') ||
      name.endsWith('.jpeg') ||
      name.endsWith('.png') ||
      file.type.startsWith('image/')
    ) {
      setFileCategory('image');
    } else if (
      name.endsWith('.doc') ||
      name.endsWith('.docx') ||
      file.type.includes('word') ||
      file.type.includes('officedocument')
    ) {
      setFileCategory('word');
    } else {
      setFileCategory('other');
    }

    // Format size
    const sizeInKB = file.size / 1024;
    if (sizeInKB > 1024) {
      setFileSize(`${(sizeInKB / 1024).toFixed(1)} MB`);
    } else {
      setFileSize(`${Math.round(sizeInKB)} KB`);
    }

    // Read file as DataURL for true browser preview & download
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setFileData(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);

    if (!title.trim() && currentEquipment) {
      const effectiveType = selectedType === 'Otro Anexo' && customTypeName ? customTypeName : selectedType;
      setTitle(`${effectiveType} - ${currentEquipment.brand} ${currentEquipment.model}`);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setFileName('');
    setFileSize('');
    setFileData(undefined);
    setFileType(undefined);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const performSaveDocument = (closeAfter: boolean = true) => {
    if (!title.trim()) {
      setErrorMessage('Por favor ingrese un título o descripción para el documento.');
      return;
    }

    const hasAttachedFile = Boolean(
      (fileName && (fileData || attachment?.fileUrl || attachment?.downloadUrl || attachment?.driveFileId)) ||
      (attachment && (attachment.fileData || attachment.fileUrl || attachment.downloadUrl || attachment.driveFileId))
    );

    if (!hasAttachedFile) {
      setErrorMessage('Es obligatorio adjuntar un archivo (PDF, JPG, PNG, Word) o vincular un documento desde Google Drive.');
      return;
    }

    const isCustomType =
      selectedType === 'Otro Documento' ||
      selectedType === 'Otro Anexo' ||
      selectedType === 'Otro';

    const effectiveDocType =
      isCustomType && customTypeName.trim()
        ? customTypeName.trim()
        : selectedType;

    const selectedEq =
      equipments.find((eq) => eq.id === equipmentId) ||
      (initialEquipmentData?.code
        ? equipments.find(
            (eq) => eq.code && eq.code.trim().toLowerCase() === initialEquipmentData.code?.trim().toLowerCase()
          )
        : undefined) ||
      (initialEquipmentData?.name
        ? equipments.find(
            (eq) => eq.name && eq.name.trim().toLowerCase() === initialEquipmentData.name?.trim().toLowerCase()
          )
        : undefined);

    const docEquipmentId = equipmentId || selectedEq?.id || initialEquipmentData?.id;
    const docEquipmentCode = initialEquipmentData?.code || selectedEq?.code;
    const docEquipmentName = initialEquipmentData?.name || selectedEq?.name || 'General SYD';

    const baseNotes = notes.trim() || `Documento ${effectiveDocType} adjuntado para ${docEquipmentName}.`;
    const contractNotePrefix = contractContext?.processNumber
      ? `[Contrato: ${contractContext.processNumber} - ${contractContext.clientName}] `
      : '';

    const newDoc: TechnicalDocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      equipmentId: docEquipmentId,
      equipmentCode: docEquipmentCode,
      equipmentName: selectedEq ? `${selectedEq.name} (${selectedEq.brand})` : docEquipmentName,
      docType: effectiveDocType,
      title: title.trim(),
      fileName: (attachment?.fileName || fileName).trim(),
      fileSize: attachment?.fileSize || fileSize || (attachment?.isCloudLink ? 'Google Drive' : '1.5 MB'),
      fileData: attachment?.fileData || fileData,
      fileType: attachment?.fileType || fileType || (fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'),
      fileUrl: attachment?.fileUrl,
      downloadUrl: attachment?.downloadUrl,
      isCloudLink: attachment?.isCloudLink,
      cloudProvider: attachment?.cloudProvider,
      driveFileId: attachment?.driveFileId,
      uploadDate: new Date().toISOString().split('T')[0],
      status,
      invimaNumber:
        effectiveDocType === 'Registro INVIMA' ? invimaNumber.trim() || selectedEq?.invimaRecordNumber || initialEquipmentData?.invimaRecordNumber : undefined,
      validUntil: effectiveDocType === 'Registro INVIMA' ? validUntil || initialEquipmentData?.invimaExpiryDate : undefined,
      notes: `${contractNotePrefix}${baseNotes}`,
    };

    onSave(newDoc);

    // Auto-sync to Base Maestra: When uploaded in contract, replicate to master equipment in Base Maestra
    if (contractContext && selectedEq) {
      const alreadyInMaster = (existingDocuments || []).some(
        (d) =>
          d.equipmentId === selectedEq.id &&
          d.docType?.toLowerCase() === effectiveDocType.toLowerCase() &&
          (!d.notes || !d.notes.toLowerCase().includes('contrato'))
      );

      if (!alreadyInMaster) {
        const masterDoc: TechnicalDocument = {
          ...newDoc,
          id: `doc-master-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          equipmentId: selectedEq.id,
          equipmentCode: selectedEq.code,
          equipmentName: `${selectedEq.name} (${selectedEq.brand})`,
          notes: `Documento ${effectiveDocType} sincronizado automáticamente en Base Maestra desde Contrato ${contractContext.processNumber}.`,
        };
        onSave(masterDoc);

        // Ensure folder in DOCUMENTACION exists and copy file to master equipment folder
        if (googleWorkspaceService.isConnected()) {
          (async () => {
            try {
              const masterFolder = await googleWorkspaceService.findOrCreateMasterDocFolder('DOCUMENTACION');
              const eqFolderName = [selectedEq.code, selectedEq.name, selectedEq.brand, selectedEq.model]
                .filter(Boolean)
                .join(' - ')
                .replace(/[\\/:*?"<>|]/g, '-')
                .trim() || `Equipo-${selectedEq.id}`;
              const createdMasterFolder = await googleWorkspaceService.createDriveFolder(eqFolderName, masterFolder.id);

              const rawF = localStorage.getItem('syd_equipment_drive_folders');
              const fMap = rawF ? JSON.parse(rawF) : {};
              if (selectedEq.id) fMap[`id_${selectedEq.id.toLowerCase()}`] = createdMasterFolder;
              if (selectedEq.code) fMap[`code_${selectedEq.code.toLowerCase()}`] = createdMasterFolder;
              fMap[selectedEq.id.toLowerCase()] = createdMasterFolder;
              localStorage.setItem('syd_equipment_drive_folders', JSON.stringify(fMap));

              if (newDoc.driveFileId) {
                await googleWorkspaceService.copyDriveFile(
                  newDoc.driveFileId,
                  createdMasterFolder.id,
                  newDoc.fileName
                );
              }
            } catch (err) {
              console.warn('Auto master sync warning:', err);
            }
          })();
        }
      }
    }

    if (closeAfter) {
      onClose();
    } else {
      // Clear current file so user can immediately attach another one
      setAttachment(null);
      setFileName('');
      setFileSize('');
      setFileData(undefined);
      setFileType(undefined);
      setErrorMessage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setSaveSuccessMessage(`✓ Documento "${newDoc.title}" adjuntado y guardado correctamente. Ya puede subir el siguiente archivo.`);
      setTimeout(() => setSaveSuccessMessage(null), 6000);

      // Advance title for next file
      if (selectedEq) {
        setTitle(`${effectiveDocType} (Anexo adicional) - ${selectedEq.brand} ${selectedEq.model}`);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSaveDocument(true);
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/25 flex items-center justify-center p-2.5 sm:p-4 md:p-6 overflow-y-auto animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#192b45] border border-[#38bdf8]/50 rounded-2xl max-w-5xl lg:max-w-6xl w-full p-4 sm:p-5 shadow-2xl animate-scaleUp max-h-[92vh] h-[88vh] flex flex-col overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-[#334d6e] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
              <FolderArchive className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2 truncate">
                <span>Adjuntar Documento a Equipo</span>
              </h3>
              <p className="text-[11px] text-slate-300 truncate">
                Adjunte Fichas Técnicas, INVIMA, Manuales o Guías de Usuario
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 text-xs font-bold text-slate-300 hover:text-white hover:bg-red-500/20 hover:border-red-500/40 border border-[#334d6e] rounded-lg transition cursor-pointer flex items-center gap-1"
              title="Cerrar ventana"
            >
              <X className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Cerrar</span>
            </button>
          </div>
        </div>

        {/* Success Alert */}
        {saveSuccessMessage && (
          <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-xl p-3 flex items-start gap-2.5 text-emerald-300 text-xs animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <div className="flex-1 font-medium">{saveSuccessMessage}</div>
            <button
              onClick={() => setSaveSuccessMessage(null)}
              className="text-emerald-400 hover:text-emerald-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="bg-rose-500/15 border border-rose-500/40 rounded-xl p-3 flex items-start gap-2.5 text-rose-300 text-xs animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs overflow-y-auto pr-1 flex-1 scrollbar-thin">
          {/* Equipment Selector */}
          <div className="bg-[#15253d] p-3.5 rounded-xl border border-[#334d6e] space-y-2">
            <label className="text-slate-300 font-bold block flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-white">
                <span className="text-[#38bdf8]">1.</span> Equipo Biomédico Destino *
              </span>
              {currentEquipment && (
                <span className="text-[11px] font-mono text-[#38bdf8] font-semibold">
                  {currentEquipment.code}
                </span>
              )}
            </label>

            <select
              value={equipmentId}
              onChange={(e) => handleEquipmentChange(e.target.value)}
              className="w-full bg-[#1e314b] border border-[#334d6e] focus:border-[#38bdf8] rounded-xl p-2.5 text-white font-bold text-xs outline-none cursor-pointer"
            >
              {equipments.map((eq) => {
                const countDocs = existingDocuments.filter((d) => d.equipmentId === eq.id).length;
                return (
                  <option key={eq.id} value={eq.id}>
                    [{eq.brand}] {eq.name} ({eq.model}) — {countDocs} documentos ya adjuntos
                  </option>
                );
              })}
            </select>
          </div>

          {/* Document Type Selector Grid */}
          <div className="space-y-2">
            <label className="text-slate-300 font-bold block flex items-center gap-1.5">
              <span className="text-[#38bdf8]">2.</span> Tipo de Documento *
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DOCUMENT_TYPES.map((dt) => {
                const isSelected = selectedType === dt.type;
                const Icon = dt.icon;
                const countSameType = attachedForThisEq.filter((d) => d.docType === dt.type).length;

                return (
                  <button
                    key={dt.type}
                    type="button"
                    onClick={() => handleTypeSelect(dt.type)}
                    className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                      isSelected
                        ? `${dt.color} border-2 shadow-md`
                        : 'bg-[#15253d] border-[#334d6e] text-slate-300 hover:border-slate-400 hover:bg-[#1c2e47]'
                    }`}
                  >
                    <div className="p-1.5 rounded-lg bg-[#111c2e] shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-white truncate">{dt.label}</span>
                        {countSameType > 0 ? (
                          <span className="text-[9.5px] bg-emerald-500/25 border border-emerald-400 text-emerald-300 px-1.5 py-0.2 rounded font-black shrink-0 flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                            <span>{countSameType} Subido{countSameType > 1 ? 's' : ''}</span>
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5 line-clamp-1">
                        {dt.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Type Input if 'Otro Documento' or 'Otro Anexo' is selected */}
            {(selectedType === 'Otro Documento' || selectedType === 'Otro Anexo' || selectedType === 'Otro') && (
              <div className="pt-2.5 p-3 rounded-xl bg-[#111c2e] border border-purple-500/40 space-y-2.5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <label className="text-purple-300 font-bold text-xs flex items-center gap-1.5">
                    <span>Clasificación / Tipo de Documento Personalizado *</span>
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Escriba o seleccione una sugerencia rápida
                  </span>
                </div>

                {/* Quick Suggestion Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    'Protocolo de Limpieza',
                    'Guía Rápida',
                    'Certificado de Calibración',
                    'Carta de Representación',
                    'Certificado de Garantía',
                    'Reporte de Tecnovigilancia',
                    'Ficha de Accesorios',
                    'Hoja de Vida',
                    'Acta de Entrega',
                    'Pruebas de Seguridad Eléctrica',
                  ].map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => {
                        setCustomTypeName(sug);
                        const eq = equipments.find((e) => e.id === equipmentId);
                        if (eq) {
                          setTitle(`${sug} - ${eq.brand} ${eq.model}`);
                        }
                      }}
                      className={`px-2 py-0.5 rounded text-[10.5px] font-bold transition cursor-pointer border ${
                        customTypeName === sug
                          ? 'bg-purple-500 text-slate-950 border-purple-400 font-black shadow-xs'
                          : 'bg-[#15253d] text-slate-300 hover:text-white border-[#334d6e] hover:border-purple-400/50'
                      }`}
                    >
                      + {sug}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  required
                  value={customTypeName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomTypeName(val);
                    const eq = equipments.find((eqItem) => eqItem.id === equipmentId);
                    if (eq && val.trim()) {
                      setTitle(`${val.trim()} - ${eq.brand} ${eq.model}`);
                    }
                  }}
                  placeholder="Escriba aquí la clasificación manual (ej: Protocolo de Limpieza y Esterilización, Carta de Exclusividad...)"
                  className="w-full bg-[#15253d] border border-purple-400/60 rounded-xl px-3 py-2 text-xs text-white font-medium focus:border-purple-400 outline-none placeholder-slate-500"
                />
              </div>
            )}
          </div>

          {/* Notice if this document type is already attached for this equipment */}
          {(() => {
            const alreadySameDoc = attachedForThisEq.find(
              (d) => d.docType?.toLowerCase() === selectedType.toLowerCase()
            );
            if (!alreadySameDoc) return null;
            return (
              <div className="p-3 bg-emerald-950/70 border border-emerald-500/50 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-200 shadow-sm animate-fadeIn">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-bold text-white block truncate">
                      Ya existe un {selectedType}: "{alreadySameDoc.title || alreadySameDoc.fileName}"
                    </span>
                    <span className="text-[11px] text-emerald-300/80 block mt-0.5">
                      Adjuntado el {alreadySameDoc.uploadDate || 'recientemente'}. Puedes previsualizarlo o reemplazarlo seleccionando un nuevo archivo abajo.
                    </span>
                  </div>
                </div>
                {(alreadySameDoc.fileUrl || alreadySameDoc.downloadUrl || alreadySameDoc.fileData) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (alreadySameDoc.fileUrl) window.open(alreadySameDoc.fileUrl, '_blank');
                    }}
                    className="px-3 py-1.5 bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-300 hover:text-white rounded-lg font-bold text-xs transition cursor-pointer shrink-0 border border-emerald-500/40"
                  >
                    Ver archivo actual
                  </button>
                )}
              </div>
            );
          })()}

          {/* Unified File / Cloud Link / Drive Selector */}
          <UnifiedAttachmentSelector
            key={`att-sel-${equipmentId || currentEquipment?.id || 'eq'}-${contractContext?.contractFolderId || contractContext?.processNumber || 'no-contract'}-${selectedType}`}
            currentAttachment={
              attachment ||
              (fileName && (fileData || attachment?.fileUrl)
                ? {
                    fileName,
                    fileSize: fileSize || 'Documento adjunto',
                    fileData,
                    fileType,
                    fileUrl: attachment?.fileUrl,
                    downloadUrl: attachment?.downloadUrl,
                    isCloudLink: Boolean(attachment?.isCloudLink),
                    cloudProvider: attachment?.cloudProvider,
                    isFolder: Boolean(attachment?.isFolder),
                    driveFileId: attachment?.driveFileId,
                  }
                : null)
            }
            onAttachmentChange={handleAttachmentChange}
            label="3. Archivo Adjunto o Enlace de Descarga (PDF, Imagen, Word, Drive) *"
            equipmentName={currentEquipment ? currentEquipment.name : ''}
            equipmentData={
              currentEquipment
                ? {
                    partNumber: currentEquipment.code,
                    name: currentEquipment.name,
                    brand: currentEquipment.brand,
                    model: currentEquipment.model,
                    invimaRecordNumber: currentEquipment.invimaRecordNumber,
                  }
                : undefined
            }
            existingDocumentTypes={attachedForThisEq.map((d) => d.docType)}
            contractContext={contractContext}
            onDocumentClassified={(info) => {
              if (info.classification) {
                handleTypeSelect(info.classification);
              }
              if (info.invimaNumber) {
                setInvimaNumber(info.invimaNumber);
              }
            }}
          />

          {/* Document Title */}
          <div>
            <label className="text-slate-300 font-bold block mb-1">
              Título / Nombre Identificador del Documento *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Ficha Técnica Oficial Mindray ePM 12M con Accesorios"
              className="w-full bg-[#15253d] border border-[#334d6e] rounded-xl p-2.5 text-white font-medium focus:border-[#38bdf8] outline-none"
            />
          </div>

          {/* INVIMA Specific fields */}
          {selectedType === 'Registro INVIMA' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#15253d] p-3 rounded-xl border border-emerald-500/30">
              <div>
                <label className="text-slate-300 font-bold block mb-1">
                  Número de Registro Sanitario INVIMA *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: INVIMA 2021EBC-0021489"
                  value={invimaNumber}
                  onChange={(e) => setInvimaNumber(e.target.value)}
                  className="w-full bg-[#1e314b] border border-[#334d6e] rounded-xl p-2 text-emerald-300 font-mono font-bold focus:border-emerald-400 outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">
                  Fecha de Vencimiento Sanitario *
                </label>
                <input
                  type="date"
                  required
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full bg-[#1e314b] border border-[#334d6e] rounded-xl p-2 text-white font-medium focus:border-[#38bdf8] outline-none"
                />
              </div>
            </div>
          )}

          {/* Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-bold block mb-1">Estado de Vigencia</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-[#15253d] border border-[#334d6e] rounded-xl p-2.5 text-white font-bold focus:border-[#38bdf8] outline-none cursor-pointer"
              >
                <option value="Vigente">🟢 Vigente (Aprobado para Licitaciones)</option>
                <option value="En Trámite">🟡 En Trámite / Renovación</option>
                <option value="Vencido">🔴 Vencido / No Apto</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1">Nombre Registrado del Archivo</label>
              <input
                type="text"
                value={fileName}
                readOnly
                placeholder="Se genera automáticamente al cargar el archivo"
                className="w-full bg-[#15253d]/70 border border-[#334d6e] rounded-xl p-2.5 text-slate-300 font-mono text-xs outline-none cursor-not-allowed"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-slate-300 font-bold block mb-1">
              Observaciones / Notas para Licitaciones
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas sobre versión, accesorios incluidos o resoluciones..."
              className="w-full bg-[#15253d] border border-[#334d6e] rounded-xl p-2.5 text-white focus:border-[#38bdf8] outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-[#334d6e] shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#15253d] border border-[#334d6e] rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => performSaveDocument(false)}
                className="flex-1 sm:flex-none bg-[#1e314b] hover:bg-[#2a4569] text-sky-300 hover:text-white border border-sky-500/40 font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                title="Guarda este archivo en el equipo y limpia el formulario para adjuntar otro de inmediato"
              >
                <Plus className="w-4 h-4 text-sky-400" />
                <span>Guardar y Subir Otro Archivo</span>
              </button>
              <button
                type="submit"
                className="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs px-5 py-2.5 rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Guardar y Cerrar</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
