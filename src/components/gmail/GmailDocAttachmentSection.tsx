import React, { useState } from 'react';
import {
  Paperclip,
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  Upload,
  FolderOpen,
  ShieldCheck,
  FileCheck,
} from 'lucide-react';
import { TechnicalDocument } from '../../types';
import { AttachedTechnicalDoc } from '../../services/gmailIntegrationService';

interface GmailDocAttachmentSectionProps {
  attachedDocs: AttachedTechnicalDoc[];
  onUpdateAttachedDocs: (docs: AttachedTechnicalDoc[]) => void;
  availableVentana7Docs: TechnicalDocument[];
  partNameForArchive: string;
  brandForArchive?: string;
  onSaveDocumentToVentana7?: (doc: TechnicalDocument) => void;
}

export const GmailDocAttachmentSection: React.FC<GmailDocAttachmentSectionProps> = ({
  attachedDocs,
  onUpdateAttachedDocs,
  availableVentana7Docs,
  partNameForArchive,
  brandForArchive = '',
  onSaveDocumentToVentana7,
}) => {
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);

  // Filter available docs (Ficha Técnica or Registro INVIMA)
  const filteredDocs = availableVentana7Docs.filter((d) => {
    const matchesSearch =
      !searchTerm ||
      d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.equipmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.invimaNumber && d.invimaNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  const handleSelectDoc = (doc: TechnicalDocument) => {
    // Check if already added
    if (attachedDocs.some((d) => d.id === doc.id || d.fileName === doc.fileName)) {
      return;
    }
    const newDoc: AttachedTechnicalDoc = {
      id: doc.id || `doc-${Date.now()}`,
      type: doc.docType === 'Registro INVIMA' ? 'Registro INVIMA' : 'Ficha Técnica',
      title: doc.title || doc.fileName,
      fileName: doc.fileName || doc.title,
      fileSize: doc.fileSize || '1.2 MB',
      fileData: doc.fileData,
      fileType: doc.fileType || 'application/pdf',
      invimaNumber: doc.invimaNumber,
      source: 'ventana_7',
    };
    onUpdateAttachedDocs([...attachedDocs, newDoc]);
    setShowDocPicker(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'Ficha Técnica' | 'Registro INVIMA') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = () => {
      const fileData = reader.result as string;
      const sizeKB = (file.size / 1024).toFixed(0);
      const fileSize = `${sizeKB} KB`;
      const docId = `doc-new-${Date.now()}`;

      const newAttachedDoc: AttachedTechnicalDoc = {
        id: docId,
        type,
        title: `${type} - ${partNameForArchive || file.name.replace(/\.[^/.]+$/, '')}`,
        fileName: file.name,
        fileSize,
        fileData,
        fileType: file.type,
        source: 'uploaded',
      };

      onUpdateAttachedDocs([...attachedDocs, newAttachedDoc]);

      // Automatically save to Documentación Técnica
      if (onSaveDocumentToVentana7) {
        const technicalDoc: TechnicalDocument = {
          id: docId,
          equipmentName: partNameForArchive || 'Nueva Parte / Repuesto',
          equipmentCode: 'PENDIENTE',
          docType: type,
          title: `${type} - ${partNameForArchive || file.name.replace(/\.[^/.]+$/, '')}`,
          fileName: file.name,
          fileSize,
          fileData,
          fileType: file.type,
          uploadDate: new Date().toISOString().split('T')[0],
          status: 'Vigente',
          notes: `Documento adjunto para solicitud de creación de parte (${brandForArchive || 'SYD Colombia'}). Guardado automáticamente en Documentación Técnica.`,
        };
        onSaveDocumentToVentana7(technicalDoc);
      }

      setUploadSuccessMsg(`✓ ${type} "${file.name}" adjuntada y guardada en Documentación Técnica.`);
      setTimeout(() => setUploadSuccessMsg(null), 4000);
    };

    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveDoc = (id: string) => {
    onUpdateAttachedDocs(attachedDocs.filter((d) => d.id !== id));
  };

  return (
    <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-4 space-y-3 shadow-inner">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
          <Paperclip className="w-4 h-4 text-cyan-400" />
          <span className="uppercase tracking-wider">Documentos Obligatorios Adjuntos</span>
          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40 font-semibold">
            Requerido: Ficha Técnica e INVIMA
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDocPicker(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 text-xs font-semibold transition cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Seleccionar de Documentación Técnica ({availableVentana7Docs.length})</span>
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-400">
        Para crear una parte en SYD siempre debe enviarse adjunta la <strong>Ficha Técnica</strong> y el <strong>Registro INVIMA</strong>. Puede seleccionarlos de los archivos guardados en el repositorio de Documentación Técnica o subir archivos nuevos (los cuales quedarán archivados con el nombre de la parte).
      </p>

      {uploadSuccessMsg && (
        <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/50 rounded-lg text-emerald-200 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{uploadSuccessMsg}</span>
        </div>
      )}

      {/* Quick Upload Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <label className="flex items-center justify-center gap-2 p-3 bg-slate-950/80 border border-dashed border-cyan-500/40 hover:border-cyan-400 rounded-xl cursor-pointer transition text-xs font-semibold text-cyan-300 group">
          <Upload className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
          <span>+ Subir Nueva Ficha Técnica</span>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.png"
            onChange={(e) => handleFileUpload(e, 'Ficha Técnica')}
            className="hidden"
          />
        </label>

        <label className="flex items-center justify-center gap-2 p-3 bg-slate-950/80 border border-dashed border-emerald-500/40 hover:border-emerald-400 rounded-xl cursor-pointer transition text-xs font-semibold text-emerald-300 group">
          <ShieldCheck className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          <span>+ Subir Nuevo Registro INVIMA</span>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.png"
            onChange={(e) => handleFileUpload(e, 'Registro INVIMA')}
            className="hidden"
          />
        </label>
      </div>

      {/* Attached Documents List */}
      {attachedDocs.length === 0 ? (
        <div className="p-3 text-center text-xs text-slate-500 bg-slate-950/40 rounded-lg border border-slate-800 italic">
          No hay documentos adjuntos aún. Seleccione de Documentación Técnica o cargue los archivos PDF.
        </div>
      ) : (
        <div className="space-y-2 pt-1">
          <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
            Documentos que se enviarán en la solicitud ({attachedDocs.length}):
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {attachedDocs.map((doc, docIdx) => (
              <div
                key={`att-doc-${doc.id || doc.fileName || 'file'}-${docIdx}`}
                className="flex items-center justify-between gap-2 p-2.5 bg-slate-950/90 border border-slate-800 rounded-lg text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`p-1.5 rounded ${
                      doc.type === 'Registro INVIMA'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-cyan-500/20 text-cyan-300'
                    }`}
                  >
                    <FileCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate text-xs">{doc.title || doc.fileName}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {doc.type} &bull; {doc.fileSize || 'PDF'} &bull;{' '}
                      <span className="text-cyan-400">
                        {doc.source === 'ventana_7' ? 'De Documentación Técnica' : 'Guardado en Documentación Técnica'}
                      </span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveDoc(doc.id)}
                  className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded transition cursor-pointer"
                  title="Quitar adjunto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Technical Documents Picker Modal */}
      {showDocPicker && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Seleccionar Documento Técnico</h3>
                  <p className="text-[11px] text-slate-400">Fichas técnicas y Registros INVIMA disponibles en el repositorio</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDocPicker(false)}
                className="text-slate-400 hover:text-white p-1 text-base font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por equipo, título o número INVIMA..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-400"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800">
              {filteredDocs.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No se encontraron documentos técnicos que coincidan con la búsqueda.
                </div>
              ) : (
                filteredDocs.map((d, dIdx) => (
                  <div key={`v7-doc-${d.id || d.fileName || 'doc'}-${dIdx}`} className="pt-2 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-white">{d.title || d.fileName}</div>
                      <div className="text-[11px] text-slate-400">
                        <span className="text-cyan-300 font-semibold">{d.docType}</span> &bull; {d.equipmentName}{' '}
                        {d.invimaNumber && `• INVIMA: ${d.invimaNumber}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectDoc(d)}
                      className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-lg transition cursor-pointer shrink-0"
                    >
                      Adjuntar
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowDocPicker(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 font-semibold text-xs rounded-xl hover:bg-slate-700 cursor-pointer"
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
