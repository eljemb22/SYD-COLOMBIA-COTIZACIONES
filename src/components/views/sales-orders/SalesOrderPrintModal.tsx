import React, { useRef } from 'react';
import { X, Printer, Download, Share2, PackageCheck, FileCheck2, Building2, MapPin, Calendar, Truck, UserCheck, ShieldCheck } from 'lucide-react';
import { SalesOrderRecord, ThemeSettings } from '../../../types';
import { SyDLogo } from '../../common/SyDLogo';

interface SalesOrderPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: SalesOrderRecord | null;
  customLetterheadUrl?: string | null;
}

export const SalesOrderPrintModal: React.FC<SalesOrderPrintModalProps> = ({
  isOpen,
  onClose,
  order,
  customLetterheadUrl,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedTotal = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(order.totalValueCOP || 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white">
      {/* Container */}
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:bg-white print:rounded-none">
        {/* Top bar (hidden in print) */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Remisión Oficial / Orden de Venta <span className="text-teal-400 font-mono">{order.salesOrderNumber}</span>
              </h3>
              <p className="text-xs text-slate-400">
                Documento de entrega oficial y recepción a satisfacción para {order.clientName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-teal-900/30 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir / Guardar PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Sheet */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-950/50 print:p-0 print:bg-white print:overflow-visible">
          <div
            ref={printAreaRef}
            id="printable-sales-order-document"
            className="bg-white text-slate-900 mx-auto max-w-[850px] p-6 sm:p-10 rounded-xl shadow-xl print:shadow-none print:p-8 print:max-w-none print:rounded-none"
            style={{ minHeight: '1050px', fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            {/* Header with Letterhead or SyD Branding */}
            <div className="border-b-2 border-teal-600 pb-4 mb-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-900 rounded-xl p-2 flex items-center justify-center text-teal-400">
                    <Building2 className="w-10 h-10 text-teal-500" />
                  </div>
                  <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">
                      SUMINISTROS & DOTACIONES DE COLOMBIA S.A.S.
                    </h1>
                    <p className="text-xs text-slate-600 font-medium">
                      NIT: 901.458.789-1 | PBX: (605) 385 4100 | Barranquilla - Colombia
                    </p>
                    <p className="text-[11px] text-teal-700 font-semibold">
                      Comercialización, Instalación y Servicio Técnico Especializado de Equipos Médicos
                    </p>
                  </div>
                </div>

                <div className="text-right border-l-2 border-teal-100 pl-4">
                  <div className="inline-block bg-teal-50 border border-teal-200 px-3 py-1 rounded-lg">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 block">
                      REMISIÓN / ORDEN DE VENTA
                    </span>
                    <span className="text-lg font-black text-teal-700 font-mono">
                      {order.salesOrderNumber}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Fecha Salida: <span className="font-bold text-slate-800">{order.dispatchDate}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Information Grid: Client & Logistics */}
            <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <h4 className="font-bold text-teal-800 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Datos del Cliente / Destinatario
                </h4>
                <div className="space-y-1 text-slate-700">
                  <p><span className="font-semibold text-slate-900">Entidad:</span> {order.clientName}</p>
                  <p><span className="font-semibold text-slate-900">NIT:</span> {order.clientNit}</p>
                  <p><span className="font-semibold text-slate-900">Ciudad / Dirección:</span> {order.clientCity} {order.clientAddress ? `- ${order.clientAddress}` : ''}</p>
                  <p><span className="font-semibold text-slate-900">Contacto / Teléfono:</span> {order.clientContactPerson || 'N/A'} {order.clientContactPhone ? `(${order.clientContactPhone})` : ''}</p>
                  <p><span className="font-semibold text-slate-900">Servicio Hospitalario:</span> <span className="text-teal-700 font-bold">{order.destinationHospitalService || 'Recepción General / Almacén Biomédico'}</span></p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-teal-800 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" /> Logística & Contrato Asociado
                </h4>
                <div className="space-y-1 text-slate-700">
                  <p><span className="font-semibold text-slate-900">Contrato / Proceso:</span> <span className="font-bold text-slate-900">{order.contractNumber || 'Venta Directa / Orden de Compra'}</span></p>
                  <p><span className="font-semibold text-slate-900">Transportadora / Enlace:</span> {order.carrierName || 'Transporte Especializado SYD'}</p>
                  <p><span className="font-semibold text-slate-900">N° Guía / Remisión:</span> <span className="font-mono font-bold text-slate-800">{order.trackingNumber || 'N/A'}</span></p>
                  <p><span className="font-semibold text-slate-900">Vehículo / Conductor:</span> {order.driverName || 'N/A'} {order.vehiclePlate ? `(Placa: ${order.vehiclePlate})` : ''}</p>
                  <p><span className="font-semibold text-slate-900">Estado de la Entrega:</span> <span className="font-bold text-slate-800">{order.status}</span></p>
                </div>
              </div>
            </div>

            {/* Equipment Items Table */}
            <div className="mb-6">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Relación de Equipos Médicos, Accesorios y Seriales Despachados</span>
                <span className="text-slate-500 font-normal lowercase">({order.items.length} ítems en despacho)</span>
              </h4>
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">Descripción del Equipo / Marca / Modelo</th>
                      <th className="py-2.5 px-3 w-16 text-center">Cant.</th>
                      <th className="py-2.5 px-3">Seriales Asignados & Placas</th>
                      <th className="py-2.5 px-3 text-right w-28">Valor Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {order.items.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50">
                        <td className="py-3 px-3 text-center font-bold text-slate-500">{idx + 1}</td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900 text-xs">{item.name}</p>
                          <p className="text-[11px] text-slate-600">
                            Marca: <span className="font-semibold text-slate-800">{item.brand}</span> | Modelo: <span className="font-semibold text-slate-800">{item.model}</span> | Código: <span className="font-mono text-slate-500">{item.code}</span>
                          </p>
                          {item.notes && (
                            <p className="text-[10px] text-slate-500 mt-0.5 italic">Nota: {item.notes}</p>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-black text-sm text-slate-900 bg-slate-50">
                          {item.quantityToDispatch}
                        </td>
                        <td className="py-3 px-3">
                          {item.assignedSerialNumbers && item.assignedSerialNumbers.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.assignedSerialNumbers.map((sn, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="inline-block bg-teal-50 border border-teal-200 text-teal-800 font-mono text-[10px] font-bold px-2 py-0.5 rounded"
                                >
                                  S/N: {sn}
                                  {item.inventoryPlates && item.inventoryPlates[sIdx] ? ` (Placa: ${item.inventoryPlates[sIdx]})` : ''}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">No especificados</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-800">
                          {new Intl.NumberFormat('es-CO', {
                            style: 'currency',
                            currency: 'COP',
                            maximumFractionDigits: 0,
                          }).format(item.totalSalePriceCOP || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-teal-50/70 border-t-2 border-teal-600 font-bold text-slate-900">
                      <td colSpan={2} className="py-2.5 px-3 text-right text-xs uppercase text-teal-900">
                        Total Valor de Equipos Despachados:
                      </td>
                      <td className="py-2.5 px-3 text-center text-sm font-black text-teal-900">
                        {order.items.reduce((acc, it) => acc + (it.quantityToDispatch || 0), 0)}
                      </td>
                      <td></td>
                      <td className="py-2.5 px-3 text-right text-sm font-black text-teal-900">
                        {formattedTotal}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Notes & Acceptance Clause */}
            <div className="mb-8 p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 leading-relaxed">
              <p className="font-bold text-slate-800 mb-1">CONDICIONES DE ENTREGA & RECEPCIÓN:</p>
              <p>
                Los equipos detallados en la presente Remisión / Orden de Venta son entregados en perfecto estado físico y operativo, con sus accesorios estándar correspondientes, empaques y manuales. La institución receptora certifica el ingreso a satisfacción conforme a los requerimientos del contrato adjudicado.
              </p>
              {order.notes && (
                <p className="mt-2 text-slate-800 font-medium">
                  <span className="font-bold">Observaciones adicionales:</span> {order.notes}
                </p>
              )}
            </div>

            {/* 3 Legal Signature Boxes: Entregado por SYD, Transportado por, Recibido a Satisfacción por Hospital */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-300 text-center text-xs">
              {/* SYD Dispatcher */}
              <div className="flex flex-col justify-between h-36 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                <p className="font-bold text-slate-800 text-[11px] uppercase text-teal-800">1. Entregado por S&D Colombia</p>
                <div className="border-b border-slate-400 w-3/4 mx-auto my-2"></div>
                <div>
                  <p className="font-bold text-slate-900 text-xs">{order.preparedBy || 'Ingeniería Biomédica SYD'}</p>
                  <p className="text-[10px] text-slate-500">Almacén & Logística SYD S.A.S.</p>
                  <p className="text-[9px] text-slate-400">Fecha: {order.dispatchDate}</p>
                </div>
              </div>

              {/* Carrier */}
              <div className="flex flex-col justify-between h-36 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                <p className="font-bold text-slate-800 text-[11px] uppercase text-teal-800">2. Transportador / Conductor</p>
                <div className="border-b border-slate-400 w-3/4 mx-auto my-2"></div>
                <div>
                  <p className="font-bold text-slate-900 text-xs">{order.driverName || 'Conductor Autorizado'}</p>
                  <p className="text-[10px] text-slate-500">C.C. ___________________</p>
                  <p className="text-[9px] text-slate-400">{order.carrierName || 'Transporte Especializado'}</p>
                </div>
              </div>

              {/* Hospital Receiver */}
              <div className="flex flex-col justify-between h-36 border-2 border-teal-300 rounded-xl p-3 bg-teal-50/30">
                <p className="font-black text-teal-900 text-[11px] uppercase">3. Recibido a Satisfacción (IPS / Hospital)</p>
                <div className="border-b border-teal-500 w-3/4 mx-auto my-2"></div>
                <div>
                  <p className="font-bold text-slate-900 text-xs">{order.clientContactPerson || 'Firma & Sello Responsable'}</p>
                  <p className="text-[10px] text-slate-500">C.C. ___________________ / Cargo</p>
                  <p className="text-[9px] text-teal-700 font-bold">Fecha y Hora de Recibido: ___/___/2026</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center text-[10px] text-slate-400 border-t border-slate-200 pt-3">
              Documento expedido por el Sistema de Gestión Comercial y Operativo de S&D Colombia S.A.S. | {order.salesOrderNumber} | Generado el {new Date().toLocaleDateString('es-CO')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
