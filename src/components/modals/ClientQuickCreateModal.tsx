import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  X,
  CheckCircle2,
  AlertTriangle,
  FileText,
  User,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  Info,
  ShieldAlert,
} from 'lucide-react';
import {
  ClientRecord,
  saveOrUpdateClientRecord,
  getClientDataStatus,
  resolveDepartmentFromCity,
} from '../../utils/clientStorage';

interface ClientQuickCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  detectedData?: {
    name: string;
    sede?: string;
    nit?: string;
    city?: string;
    department?: string;
    address?: string;
    contactPerson?: string;
    contactPhone?: string;
    contactEmail?: string;
    notes?: string;
    source?: 'oc' | 'cotizacion' | 'licitacion' | 'manual';
  } | null;
  existingClient?: ClientRecord | null;
  onClientSaved: (savedClient: ClientRecord) => void;
}

export const ClientQuickCreateModal: React.FC<ClientQuickCreateModalProps> = ({
  isOpen,
  onClose,
  detectedData,
  existingClient,
  onClientSaved,
}) => {
  const [formData, setFormData] = useState<Partial<ClientRecord>>({
    name: '',
    sede: '',
    nit: '',
    city: '',
    department: '',
    address: '',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
    notes: '',
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize form when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (existingClient) {
      setFormData({
        id: existingClient.id,
        name: existingClient.name || '',
        sede: existingClient.sede || detectedData?.sede || '',
        nit: existingClient.nit || '',
        city: existingClient.city || detectedData?.city || '',
        department: existingClient.department || detectedData?.department || '',
        address: existingClient.address || detectedData?.address || '',
        contactPerson: existingClient.contactPerson || detectedData?.contactPerson || '',
        contactPhone: existingClient.contactPhone || detectedData?.contactPhone || '',
        contactEmail: existingClient.contactEmail || detectedData?.contactEmail || '',
        notes: existingClient.notes || detectedData?.notes || '',
        source: existingClient.source || detectedData?.source || 'oc',
      });
    } else if (detectedData) {
      const city = detectedData.city || '';
      const dept = detectedData.department || resolveDepartmentFromCity(city) || '';
      setFormData({
        name: detectedData.name || '',
        sede: detectedData.sede || '',
        nit: detectedData.nit || '',
        city,
        department: dept,
        address: detectedData.address || '',
        contactPerson: detectedData.contactPerson || '',
        contactPhone: detectedData.contactPhone || '',
        contactEmail: detectedData.contactEmail || '',
        notes: detectedData.notes || '',
        source: detectedData.source || 'oc',
      });
    }

    setSaveSuccess(false);
    setValidationError(null);
  }, [isOpen, detectedData, existingClient]);

  // Real-time calculation of pending/missing fields
  const status = useMemo(() => getClientDataStatus(formData), [formData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.name.trim()) {
      setValidationError('El nombre o razón social del cliente es obligatorio');
      return;
    }

    setSaving(true);
    setValidationError(null);

    try {
      const clientToSave: Partial<ClientRecord> & { name: string } = {
        ...formData,
        id: existingClient?.id || formData.id,
        name: formData.name.trim(),
        sede: formData.sede?.trim() || '',
        nit: formData.nit?.trim() || '',
        city: formData.city?.trim() || '',
        department: formData.department?.trim() || resolveDepartmentFromCity(formData.city || ''),
        address: formData.address?.trim() || '',
        contactPerson: formData.contactPerson?.trim() || '',
        contactPhone: formData.contactPhone?.trim() || '',
        contactEmail: formData.contactEmail?.trim() || '',
        notes: formData.notes?.trim() || '',
        source: formData.source || 'oc',
      };

      const saved = await saveOrUpdateClientRecord(clientToSave);
      setSaveSuccess(true);
      setTimeout(() => {
        onClientSaved(saved);
        onClose();
      }, 700);
    } catch (err: any) {
      setValidationError(err?.message || 'Error al guardar el cliente');
      setSaving(false);
    }
  };

  const isExisting = Boolean(existingClient);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {isExisting ? 'Actualizar Ficha de Cliente' : 'Crear Cliente en Base de Datos'}
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Detectado en PDF
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Extracción inteligente desde el encabezado oficial de la orden de compra
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Completeness & Missing Fields Notification Alert */}
        <div className="px-6 py-3 bg-slate-950/70 border-b border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-300">Completitud de Información:</span>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${
                  status.isComplete
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}
              >
                {status.completionPercentage}% ({status.completedCount} de {status.totalFields} datos clave)
              </span>
            </div>

            {/* Notification Badge */}
            {status.missingFields.length > 0 ? (
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  <strong>Pendientes:</strong>{' '}
                  {status.missingFields.map((f) => f.label).join(', ')}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Todos los campos clave completos</span>
              </div>
            )}
          </div>

          {/* Zero-Invention Policy Notice */}
          <div className="mt-2 text-[11px] text-slate-400 flex items-start gap-1.5 bg-slate-900/90 p-2 rounded-lg border border-slate-800">
            <ShieldAlert className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200">Política de Cero-Invención de Datos:</span>{' '}
              Los campos no especificados en el documento se guardan vacíos. La aplicación le notificará
              automáticamente qué datos hacen falta para que pueda completarlos cuando el cliente los suministre.
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {validationError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Main Institution Name */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Nombre Oficial / Razón Social del Cliente</span>
                <span className="text-rose-400">*</span>
              </label>
              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> Detectado en PDF
              </span>
            </div>
            <input
              type="text"
              required
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: FUNDACION HOSPITAL INFANTIL NAPOLEON FRANCO PAREJA"
              className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs font-semibold text-white focus:outline-none"
            />
          </div>

          {/* Sede & NIT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Sede / Sucursal</span>
                </label>
                {formData.sede ? (
                  <span className="text-[10px] text-cyan-400 font-semibold">Detectado en PDF</span>
                ) : (
                  <span className="text-[10px] text-slate-500">Opcional</span>
                )}
              </div>
              <input
                type="text"
                value={formData.sede || ''}
                onChange={(e) => setFormData({ ...formData, sede: e.target.value })}
                placeholder="Ej: CLÍNICA DE ESPECIALIDADES"
                className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <span>NIT / RUT</span>
                </label>
                {formData.nit?.trim() ? (
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Diligenciado
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-0.5 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    <AlertTriangle className="w-3 h-3" /> Pendiente (La app le notificará)
                  </span>
                )}
              </div>
              <input
                type="text"
                value={formData.nit || ''}
                onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                placeholder="Sin NIT detectado (dejar en blanco para completar luego)"
                className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none ${
                  !formData.nit?.trim() ? 'border-amber-500/50 focus:border-amber-400' : 'border-slate-700 focus:border-cyan-500'
                }`}
              />
            </div>
          </div>

          {/* Location: City & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Ciudad</span>
                </label>
                {formData.city?.trim() ? (
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3" /> OK
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-400 font-semibold">Pendiente</span>
                )}
              </div>
              <input
                type="text"
                value={formData.city || ''}
                onChange={(e) => {
                  const newCity = e.target.value;
                  const dept = resolveDepartmentFromCity(newCity) || formData.department;
                  setFormData({ ...formData, city: newCity, department: dept });
                }}
                placeholder="Ej: Barranquilla"
                className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300">Departamento</label>
              </div>
              <input
                type="text"
                value={formData.department || ''}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="Ej: Atlántico"
                className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Physical Address */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span>Dirección de Entrega / Instalación</span>
              </label>
              {formData.address && (
                <span className="text-[10px] text-cyan-400 font-semibold">Detectado en PDF</span>
              )}
            </div>
            <input
              type="text"
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Ej: CRA 43 50 59"
              className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
            />
          </div>

          {/* Contact Person & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Persona de Contacto / Usuario</span>
                </label>
                {formData.contactPerson?.trim() ? (
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3" /> OK
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-400 font-semibold">Pendiente</span>
                )}
              </div>
              <input
                type="text"
                value={formData.contactPerson || ''}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                placeholder="Ej: LAURA CRISTINA ALTAMONA BLANCO"
                className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Teléfono</span>
                </label>
                {formData.contactPhone?.trim() ? (
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3" /> OK
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-400 font-semibold">Pendiente</span>
                )}
              </div>
              <input
                type="text"
                value={formData.contactPhone || ''}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                placeholder="Ej: 3302636"
                className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-cyan-400" />
                <span>Correo Electrónico de Contacto</span>
              </label>
              {formData.contactEmail?.trim() ? (
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" /> OK
                </span>
              ) : (
                <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-0.5 bg-amber-500/10 px-1.5 py-0.5 rounded">
                  <AlertTriangle className="w-3 h-3" /> Pendiente (La app le notificará)
                </span>
              )}
            </div>
            <input
              type="email"
              value={formData.contactEmail || ''}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              placeholder="Sin correo detectado (dejar en blanco para completar luego)"
              className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none ${
                !formData.contactEmail?.trim() ? 'border-amber-500/50 focus:border-amber-400' : 'border-slate-700 focus:border-cyan-500'
              }`}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Notas y Trazabilidad del Cliente
            </label>
            <textarea
              rows={2}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Información adicional sobre el cliente o la orden de compra"
              className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <div className="text-[11px] text-slate-400">
              {status.missingFields.length > 0 ? (
                <span className="text-amber-400">
                  🔔 Se activará recordatorio de datos faltantes en la aplicación
                </span>
              ) : (
                <span className="text-emerald-400">
                  ✓ Registro completo y verificado
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || saveSuccess}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-slate-950" />
                    <span>¡Guardado Exitosamente!</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-slate-950" />
                    <span>{isExisting ? 'Actualizar Cliente' : 'Guardar en Base de Datos'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
