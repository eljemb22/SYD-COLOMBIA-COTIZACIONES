import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardCopy, ExternalLink, FileText, Search } from 'lucide-react';
import { OCTrackingContract, SalesOrderItem, SalesOrderRecord, TechnicalDocument } from '../../../types';

interface Props {
  salesOrders: SalesOrderRecord[];
  contracts: OCTrackingContract[];
  documents: TechnicalDocument[];
  onOpenSupportNotices?: () => void;
}

interface DocLink { label: string; url: string; category: string }
interface DispatchRow {
  order: SalesOrderRecord;
  item: SalesOrderItem;
  serials: string[];
  dianReference: string[];
  links: DocLink[];
  missing: string[];
}

const norm = (value?: string) => String(value || '').trim().toLocaleLowerCase();
const dispatchedOrderStatuses = new Set(['Entregada', 'Entregada Total', 'Entregada al Cliente', 'Listo para Facturar', 'Facturada']);
const isOrderDispatched = (order: SalesOrderRecord) => Boolean(
  order.dispatchDate || order.actualDeliveryDate || order.deliveryDate ||
  (order.status && dispatchedOrderStatuses.has(order.status)) ||
  order.items?.some(item => ['Despachado', 'Instalado'].includes(item?.equipmentStatus || ''))
);

const getLink = (doc: any): string => {
  const candidate = doc?.fileUrl || doc?.downloadUrl || doc?.url ||
    (doc?.driveFileId ? `https://drive.google.com/open?id=${encodeURIComponent(doc.driveFileId)}` : '');
  return /^https?:\/\//i.test(candidate) ? candidate : '';
};

const classify = (doc: any): string => norm(`${doc?.docType || ''} ${doc?.type || ''} ${doc?.title || ''} ${doc?.fileName || ''}`);

export const DispatchDocumentationTab: React.FC<Props> = ({ salesOrders, contracts, documents, onOpenSupportNotices }) => {
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const rows = useMemo<DispatchRow[]>(() => {
    const safeContracts = Array.isArray(contracts) ? contracts : [];
    const safeDocs = Array.isArray(documents) ? documents : [];
    return (Array.isArray(salesOrders) ? salesOrders : [])
      .filter(order => order && isOrderDispatched(order))
      .flatMap(order => (Array.isArray(order.items) ? order.items : []).filter(Boolean).map(item => {
        const ocItems = safeContracts.flatMap(contract => Array.isArray(contract?.items) ? contract.items : [])
          .filter((entry: any) => (entry.salesOrderItemId && entry.salesOrderItemId === item.id) ||
            (entry.equipmentId && item.equipmentId && entry.equipmentId === item.equipmentId) ||
            (entry.code && item.code && norm(entry.code) === norm(item.code)));
        const serializedUnits = ocItems.flatMap((entry: any) => [
          ...(Array.isArray(entry.serialNumbers) ? entry.serialNumbers : []),
          ...(Array.isArray(entry.serializedUnits) ? entry.serializedUnits : []),
        ]);
        const rawSerials = Array.isArray(item.assignedSerialNumbers) && item.assignedSerialNumbers.length
          ? item.assignedSerialNumbers
          : Array.isArray(item.serialNumbers) ? item.serialNumbers : serializedUnits;
        const serials = [...new Set(rawSerials.map((serial: any) => typeof serial === 'string' ? serial : serial?.serialNumber).filter(Boolean))];
        const equipmentDocs = safeDocs.filter(doc => (doc.equipmentId && item.equipmentId && doc.equipmentId === item.equipmentId) ||
          (doc.equipmentCode && item.code && norm(doc.equipmentCode) === norm(item.code)) ||
          (doc.equipmentName && norm(doc.equipmentName) === norm(item.name)));
        const serialDocs = serializedUnits.flatMap((serial: any) => [
          ...(Array.isArray(serial?.individualDocs) ? serial.individualDocs : []),
          ...(Array.isArray(serial?.documents) ? serial.documents : []),
        ]);
        const candidates = [...equipmentDocs, ...serialDocs];
        const links = candidates.map((doc: any): DocLink | null => {
          const url = getLink(doc);
          if (!url) return null;
          const text = classify(doc);
          const category = /dian|aduan|manifiesto|import/.test(text) ? 'DIAN' :
            /ficha|technical.?sheet/.test(text) ? 'Ficha técnica' :
            /manual/.test(text) ? 'Manual' :
            /invima|registro/.test(text) ? 'Registro INVIMA' : 'Otro documento';
          return { label: doc?.title || doc?.fileName || doc?.docType || doc?.type || category, url, category };
        }).filter((entry): entry is DocLink => Boolean(entry));
        const uniqueLinks = links.filter((entry, index) => links.findIndex(other => other.url === entry.url) === index);
        const hasManual = candidates.some((doc: any) => /manual/.test(classify(doc)) && getLink(doc));
        const hasTechSheet = candidates.some((doc: any) => /ficha|technical.?sheet/.test(classify(doc)) && getLink(doc));
        const dianReference = [...new Set(serializedUnits.map((serial: any) => serial?.dianDeclarationNumber || serial?.dianImportDeclaration).filter(Boolean))];
        const hasDianLink = uniqueLinks.some(link => link.category === 'DIAN');
        const missing = [
          !serials.length ? 'serial' : '',
          !hasDianLink ? 'enlace DIAN' : '',
          !hasTechSheet ? 'ficha técnica' : '',
          !hasManual ? 'manual' : '',
        ].filter(Boolean);
        return { order, item, serials, dianReference, links: uniqueLinks, missing };
      }))
      .filter(row => `${row.order.salesOrderNumber} ${row.order.clientName} ${row.item.name} ${row.item.code || ''} ${row.serials.join(' ')}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
      .sort((a, b) => String(b.order.dispatchDate || b.order.actualDeliveryDate || b.order.deliveryDate || '').localeCompare(String(a.order.dispatchDate || a.order.actualDeliveryDate || a.order.deliveryDate || '')));
  }, [salesOrders, contracts, documents, query]);

  const copyLinks = async (row: DispatchRow) => {
    const text = row.links.map(link => `${link.label}: ${link.url}`).join('\n');
    if (!text || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(row.item.id);
      window.setTimeout(() => setCopied(current => current === row.item.id ? null : current), 1800);
    } catch { setCopied(null); }
  };

  return <section className="space-y-4">
    <div className="rounded-2xl border border-[var(--syd-border-color)] bg-[var(--syd-card-bg)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-[var(--syd-text-primary)]"><FileText className="h-5 w-5 text-[var(--syd-accent)]"/> Documentación para equipos despachados</h2>
          <p className="mt-1 max-w-3xl text-sm text-[var(--syd-text-secondary)]">Consulta desde aquí la carpeta documental de cada equipo que aparece en una OV despachada. Antes del aviso a soporte, verifica serial, documento DIAN, ficha técnica y manual; los enlaces disponibles se incluirán en el correo.</p>
        </div>
        {onOpenSupportNotices && <button type="button" onClick={onOpenSupportNotices} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold" style={{ backgroundColor: 'var(--syd-btn-bg)', color: 'var(--syd-btn-text)', borderRadius: 'var(--syd-btn-radius)' }}>Ir a avisos de soporte <ArrowRight className="h-4 w-4"/></button>}
      </div>
    </div>
    <label className="relative block max-w-md">
      <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--syd-text-secondary)]"/>
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar OV, cliente, equipo, código o serial…" className="w-full rounded-xl border border-[var(--syd-border-color)] bg-[var(--syd-card-bg)] py-2 pl-10 pr-3 text-sm text-[var(--syd-text-primary)]"/>
    </label>
    {!rows.length ? <div className="rounded-2xl border border-dashed border-[var(--syd-border-color)] p-8 text-center text-sm text-[var(--syd-text-secondary)]">No hay equipos despachados que coincidan con la búsqueda.</div> : <div className="space-y-3">
      {rows.map(row => <article key={`${row.order.id}-${row.item.id}`} className="rounded-2xl border border-[var(--syd-border-color)] bg-[var(--syd-card-bg)] p-4 text-[var(--syd-text-primary)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="font-bold">{row.item.name} {row.item.brand || ''} {row.item.model || ''}</div><div className="mt-1 text-xs text-[var(--syd-text-secondary)]">OV {row.order.salesOrderNumber} · {row.order.clientName} · Seriales: {row.serials.join(', ') || 'Pendientes'}</div>
            {row.dianReference.length > 0 && <div className="mt-1 text-xs text-[var(--syd-text-secondary)]">Declaración DIAN: {row.dianReference.join(', ')}</div>}
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${row.missing.length ? 'bg-amber-500/15 text-amber-600' : 'bg-emerald-500/15 text-emerald-600'}`}>
            {row.missing.length ? <><AlertTriangle className="h-3.5 w-3.5"/> Incompleta: {row.missing.join(', ')}</> : <><CheckCircle2 className="h-3.5 w-3.5"/> Documentación completa</>}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {row.links.length ? row.links.map((link, index) => <a key={`${link.url}-${index}`} href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--syd-border-color)] px-2.5 py-1.5 text-xs font-semibold text-[var(--syd-accent)] hover:opacity-80"><span>{link.category}: {link.label}</span><ExternalLink className="h-3.5 w-3.5"/></a>) : <span className="text-xs text-[var(--syd-text-secondary)]">No hay enlaces compartibles asociados a este equipo.</span>}
          <button type="button" disabled={!row.links.length} onClick={() => void copyLinks(row)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--syd-border-color)] px-2.5 py-1.5 text-xs font-semibold text-[var(--syd-text-primary)] disabled:opacity-50"><ClipboardCopy className="h-3.5 w-3.5"/>{copied === row.item.id ? 'Enlaces copiados' : 'Copiar enlaces'}</button>
        </div>
      </article>)}
    </div>}
  </section>;
};

