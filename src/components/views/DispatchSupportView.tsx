import React, { useMemo, useState } from 'react';
import { BellRing, Mail, PackageCheck } from 'lucide-react';
import { AuthUser, DispatchSupportNoticeRecord, OCTrackingContract, SalesOrderRecord, TechnicalDocument } from '../../types';
import { DispatchSupportNoticeModal } from './sales-orders/DispatchSupportNoticeModal';
import { saveSingleSalesOrderToFirestore } from '../../services/realtimeSync';

interface Props {
  salesOrders: SalesOrderRecord[];
  onUpdateSalesOrders: (orders: SalesOrderRecord[]) => void;
  contracts: OCTrackingContract[];
  documents: TechnicalDocument[];
  currentUser?: AuthUser | null;
}

const DISPATCHED_STATUSES = new Set(['Entregada', 'Entregada Parcial', 'Entregada Total', 'Entregada al Cliente', 'Listo para Facturar', 'Facturada']);

export const DispatchSupportView: React.FC<Props> = ({ salesOrders, onUpdateSalesOrders, contracts, documents, currentUser }) => {
  const [selectedOrder, setSelectedOrder] = useState<SalesOrderRecord | null>(null);
  const [search, setSearch] = useState('');
  const isReadOnly = currentUser?.role === 'viewer' && !currentUser?.permissions?.canManageSalesOrders;
  const eligibleOrders = useMemo(() => (Array.isArray(salesOrders) ? salesOrders : [])
    .filter((order): order is SalesOrderRecord => Boolean(order && order.id))
    .filter(order => Boolean(order.dispatchDate || order.actualDeliveryDate || order.deliveryDate || order.status && DISPATCHED_STATUSES.has(order.status) || Array.isArray(order.items) && order.items.some(item => item && ['Despachado', 'Instalado'].includes(item.equipmentStatus))))
    .filter(order => `${order.salesOrderNumber || ''} ${order.clientName || ''}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => String(b.dispatchDate || b.actualDeliveryDate || b.deliveryDate || '').localeCompare(String(a.dispatchDate || a.actualDeliveryDate || a.deliveryDate || ''))), [salesOrders, search]);

  const persistNotice = async (notice: DispatchSupportNoticeRecord) => {
    if (!selectedOrder) return;
    const updated: SalesOrderRecord = {
      ...selectedOrder,
      items: Array.isArray(selectedOrder.items) ? selectedOrder.items : [],
      dispatchSupportNotices: [...(Array.isArray(selectedOrder.dispatchSupportNotices) ? selectedOrder.dispatchSupportNotices : []), notice],
      updatedAt: new Date().toISOString(),
    };
    onUpdateSalesOrders(salesOrders.map(order => order.id === updated.id ? updated : order));
    setSelectedOrder(null);
    try { await saveSingleSalesOrderToFirestore(updated); }
    catch (error) { console.warn('Aviso enviado; no se pudo sincronizar su historial en la nube:', error); }
  };

  return <section className="space-y-5">
    <header className="rounded-2xl border border-[var(--syd-border-color)] bg-[var(--syd-card-bg)] p-5">
      <h2 className="text-xl font-black text-[var(--syd-text-primary)] flex items-center gap-2"><BellRing className="h-5 w-5 text-[var(--syd-accent)]"/> Avisos de despacho a Soporte Técnico</h2>
      <p className="mt-2 text-sm text-[var(--syd-text-secondary)]">Aquí aparecen las OVs con despacho o entrega registrados. Abre una OV, selecciona los equipos y revisa seriales y enlaces antes de enviar un único correo por lote.</p>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="sr-only" htmlFor="support-order-search">Buscar orden o cliente</label>
      <input id="support-order-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar OV o cliente…" className="w-full max-w-sm rounded-xl border border-[var(--syd-border-color)] bg-[var(--syd-card-bg)] px-3 py-2 text-sm text-[var(--syd-text-primary)]"/>
      <span className="text-sm text-[var(--syd-text-secondary)]">{eligibleOrders.length} órdenes disponibles</span>
    </div>
    {eligibleOrders.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--syd-border-color)] p-9 text-center text-[var(--syd-text-secondary)]">No hay OVs despachadas que coincidan con la búsqueda.</div> : <div className="overflow-x-auto rounded-2xl border border-[var(--syd-border-color)] bg-[var(--syd-card-bg)]">
      <table className="w-full text-left text-sm"><thead className="bg-[var(--syd-sidebar-bg)] text-[var(--syd-text-secondary)]"><tr><th className="p-3">Orden de venta</th><th className="p-3">Cliente</th><th className="p-3">Fecha de despacho</th><th className="p-3">Equipos</th><th className="p-3">Avisos enviados</th><th className="p-3 text-right">Acción</th></tr></thead>
        <tbody>{eligibleOrders.map(order => <tr key={order.id} className="border-t border-[var(--syd-border-color)] text-[var(--syd-text-primary)]"><td className="p-3 font-bold">{order.salesOrderNumber || 'Sin número'}</td><td className="p-3">{order.clientName || 'Sin cliente'}</td><td className="p-3">{order.dispatchDate || order.actualDeliveryDate || order.deliveryDate || 'Registrado por estado'}</td><td className="p-3">{Array.isArray(order.items) ? order.items.length : 0}</td><td className="p-3">{Array.isArray(order.dispatchSupportNotices) ? order.dispatchSupportNotices.length : 0}</td><td className="p-3 text-right"><button disabled={isReadOnly} type="button" onClick={() => setSelectedOrder({...order, items: Array.isArray(order.items) ? order.items : []})} style={{backgroundColor:'var(--syd-btn-bg)',color:'var(--syd-btn-text)',borderRadius:'var(--syd-btn-radius)'}} className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold disabled:opacity-50"><PackageCheck className="h-4 w-4"/><Mail className="h-4 w-4"/> Preparar aviso</button></td></tr>)}</tbody>
      </table>
    </div>}
    {selectedOrder && <DispatchSupportNoticeModal order={selectedOrder} contracts={Array.isArray(contracts) ? contracts : []} documents={Array.isArray(documents) ? documents : []} onClose={() => setSelectedOrder(null)} onSent={persistNotice}/>}
  </section>;
};
