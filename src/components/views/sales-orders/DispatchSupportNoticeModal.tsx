import React, { useMemo, useState } from 'react';
import { X, Mail, AlertTriangle } from 'lucide-react';
import { SalesOrderRecord, SalesOrderItem, TechnicalDocument, DispatchSupportNoticeRecord, OCTrackingContract } from '../../../types';
import { gmailService } from '../../../services/gmailIntegrationService';

interface Props { order: SalesOrderRecord; contracts: OCTrackingContract[]; documents: TechnicalDocument[]; onClose: () => void; onSent: (notice: DispatchSupportNoticeRecord) => Promise<void>; }
const esc = (v: string) => v.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const norm = (v?: string) => (v || '').trim().toLowerCase();
const link = (d: any): string => {
  const candidate = d?.fileUrl || d?.downloadUrl || d?.url || (d?.driveFileId ? `https://drive.google.com/open?id=${encodeURIComponent(d.driveFileId)}` : '');
  return /^https?:\/\//i.test(candidate) ? candidate : '';
};

export const DispatchSupportNoticeModal: React.FC<Props> = ({ order, contracts, documents, onClose, onSent }) => {
  const items = Array.isArray(order?.items) ? order.items.filter(Boolean) : [];
  const safeContracts = Array.isArray(contracts) ? contracts : [];
  const safeDocuments = Array.isArray(documents) ? documents : [];
  const [to, setTo] = useState(''); const [lot, setLot] = useState('Despacho 1'); const [percent, setPercent] = useState('');
  const [selected, setSelected] = useState<string[]>(items.map(i => i.id).filter(Boolean)); const [visit, setVisit] = useState<Record<string, boolean>>(() => Object.fromEntries(items.filter(i => i.id).map(i => [i.id, !!(order.contractNumber || order.contractId)])));
  const [dianNA, setDianNA] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false); const [error, setError] = useState('');
  const rows = useMemo(() => selected.map(id => order.items.find(i => i.id === id)!).filter(Boolean).map((item: SalesOrderItem) => {
    const docs = safeDocuments.filter(d => d && ((d.equipmentId && d.equipmentId === item.equipmentId) || (d.equipmentCode && norm(d.equipmentCode) === norm(item.code)) || norm(d.equipmentName) === norm(item.name)));
    const ficha = docs.find(d => /ficha/i.test(d.docType || d.type || ''));
    const manual = docs.find(d => /manual/i.test(d.docType || d.type || ''));
    const serialValue = Array.isArray(item.assignedSerialNumbers) ? item.assignedSerialNumbers : Array.isArray(item.serialNumbers) ? item.serialNumbers : [];
    const serials = serialValue.map((s: any) => typeof s === 'string' ? s : s?.serialNumber).filter(Boolean);
    const ocSerials = safeContracts.flatMap(c => Array.isArray(c?.items) ? c.items : []).filter(ci => ci && ((ci.salesOrderItemId && ci.salesOrderItemId === item.id) || (ci.equipmentId && ci.equipmentId === item.equipmentId) || (ci.code && norm(ci.code) === norm(item.code)))).flatMap(ci => Array.isArray(ci.serialNumbers) ? ci.serialNumbers : Array.isArray(ci.serializedUnits) ? ci.serializedUnits : []);
    const serialDocs = ocSerials.flatMap((s: any) => [...(s.individualDocs || []), ...(s.documents || [])]);
    const allDocCandidates = [...docs, ...serialDocs];
    const dianDocs = allDocCandidates.filter((d: any) => /dian|aduan|manifiesto|import/i.test(`${d.docType || ''} ${d.type || ''} ${d.title || ''} ${d.fileName || ''}`));
    // Include every shareable document for the equipment in the email, not only the manual and ficha.
    const links = allDocCandidates.map((d: any) => {
      const url = link(d);
      if (!url) return null;
      const type = `${d.docType || ''} ${d.type || ''} ${d.title || ''} ${d.fileName || ''}`;
      const label = /dian|aduan|manifiesto|import/i.test(type) ? 'Documento DIAN' :
        /ficha/i.test(type) ? 'Ficha técnica' : /manual/i.test(type) ? 'Manual' :
        d.title || d.fileName || d.docType || d.type || 'Documento del equipo';
      return {label, url};
    }).filter((d: any): d is {label: string; url: string} => Boolean(d));
    const uniqueLinks = links.filter((d: any, index: number) => links.findIndex((candidate: any) => candidate.url === d.url) === index);
    const dianReferences = [...new Set([
      ...ocSerials.map((s: any) => s.dianDeclarationNumber || s.dianImportDeclaration),
      ...serialValue.map((s: any) => typeof s === 'object' ? (s?.dianDeclarationNumber || s?.dianImportDeclaration) : ''),
    ].filter(Boolean))];
    const hasDianLink = dianDocs.some((d: any) => Boolean(link(d)));
    return { item, docs, serials, dianReferences, links: uniqueLinks, hasDianLink, missing: [!serials.length && !item.equipmentId ? '' : (!serials.length ? 'serial' : ''), !hasDianLink && !dianNA[item.id] ? 'enlace DIAN o marcar N/A' : '', !uniqueLinks.some(d => /ficha técnica/i.test(d.label)) ? 'ficha técnica' : '', !uniqueLinks.some(d => /manual/i.test(d.label)) ? 'manual' : ''].filter(Boolean) };
  }), [selected, order, safeDocuments, safeContracts, dianNA]);
  const send = async () => {
    setError(''); const recipients = to.split(/[;,\s]+/).map(s => s.trim()).filter(Boolean);
    if (!recipients.length || recipients.some(e => !/^\S+@\S+\.\S+$/.test(e))) return setError('Ingresa correos válidos del equipo técnico.');
    if (!rows.length) return setError('Selecciona al menos un equipo.');
    if (rows.some(r => r.missing.length)) return setError('Completa serial, enlace DIAN (o indica que no aplica), ficha técnica y manual con enlaces antes de enviar.');
    if ((order.dispatchSupportNotices || []).some(n => norm(n.lotReference) === norm(lot))) return setError('Ya existe un aviso para este lote. Usa otra referencia para un despacho nuevo.');
    if (!gmailService.isConnected()) return setError('Conecta Gmail en la ventana 5.1 antes de enviar.');
    const needsVisit = rows.some(r => visit[r.item.id]); const mode = needsVisit ? 'technical_visit' : 'documents_only';
    const subject = `Despacho ${order.salesOrderNumber} · ${lot} · ${order.clientName}`;
    const html = `<h2>Despacho ${esc(order.salesOrderNumber)}</h2><p>Cliente: ${esc(order.clientName)} · Lote: ${esc(lot)}${percent ? ` · Hito: ${esc(percent)}%` : ''}</p><ul>${rows.map(r => `<li><b>${esc(r.item.name)}</b> (${esc(r.item.brand || '')} ${esc(r.item.model || '')}) · Seriales: ${r.serials.map(esc).join(', ')}${r.dianReferences.length ? ` · Declaración DIAN: ${r.dianReferences.map(esc).join(', ')}` : ''} · ${visit[r.item.id] ? 'Requiere visita técnica' : 'Documentación' }<br/>${r.links.map(d => `<a href="${esc(d.url)}">${esc(d.label)}</a>`).join(' · ')}</li>`).join('')}</ul>${needsVisit ? '<p>Coordinar contacto con el cliente para instalación o capacitación.</p>' : '<p>Se comparte la documentación para consulta; no se solicita visita.</p>'}`;
    setSending(true);
    try { const sent = await gmailService.sendRawEmail(recipients.join(', '), subject, html);
      await onSent({ id: crypto.randomUUID(), lotReference: lot.trim(), milestonePercent: percent ? Number(percent) : undefined, sentAt: new Date().toISOString(), recipients, gmailMessageId: sent.id, mode, items: rows.map(r => ({salesOrderItemId:r.item.id,name:r.item.name,quantity:Number(r.item.quantityToDispatch || r.item.quantity || 1),serialNumbers:r.serials,requiresTechnicalVisit:!!visit[r.item.id],documentLinks:r.links})) }); onClose();
    } catch(e:any) { setError(e?.message || 'No se pudo enviar el aviso.'); } finally { setSending(false); }
  };
  return <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="support-dispatch-title">
    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-auto p-5 text-slate-100 shadow-2xl">
      <div className="flex items-start justify-between gap-4"><div><h2 id="support-dispatch-title" className="font-bold text-lg">Notificar despacho a soporte técnico</h2><p className="text-sm text-slate-400 mt-1">OV {order.salesOrderNumber} · {order.clientName}. Selecciona los equipos para este correo y revisa los enlaces de Drive antes de enviar.</p></div><button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X/></button></div>
      <div className="grid md:grid-cols-3 gap-3 my-4"><label className="text-xs text-slate-400">Correos de soporte<input className="mt-1 block w-full bg-slate-800 p-2 rounded text-sm text-slate-100" placeholder="soporte@empresa.com" value={to} onChange={e=>setTo(e.target.value)}/></label><label className="text-xs text-slate-400">Lote / referencia<input className="mt-1 block w-full bg-slate-800 p-2 rounded text-sm text-slate-100" value={lot} onChange={e=>setLot(e.target.value)} placeholder="Despacho 1"/></label><label className="text-xs text-slate-400">Hito del contrato (%)<input className="mt-1 block w-full bg-slate-800 p-2 rounded text-sm text-slate-100" type="number" min="0" max="100" value={percent} onChange={e=>setPercent(e.target.value)} placeholder="Opcional"/></label></div>
      <div className="space-y-3">{items.map(i=>{
        const row = rows.find(r => r.item.id === i.id);
        const linkedDocs = safeDocuments.filter(d => d && ((d.equipmentId && d.equipmentId === i.equipmentId) || (d.equipmentCode && norm(d.equipmentCode) === norm(i.code)) || norm(d.equipmentName) === norm(i.name)));
        const driveLinks = [...(row?.links || []), ...linkedDocs.map(d => ({label: d.title || d.docType || d.type || d.fileName || 'Documento', url: link(d)})).filter(d => d.url && !(row?.links || []).some(existing => existing.url === d.url))];
        const serialsForDisplay = Array.isArray(i.assignedSerialNumbers) ? i.assignedSerialNumbers : Array.isArray(i.serialNumbers) ? i.serialNumbers : [];
        const serialList = serialsForDisplay.map((s:any)=>typeof s==='string'?s:s?.serialNumber).filter(Boolean);
        return <div key={i.id} className={`rounded-xl border p-3 ${selected.includes(i.id)?'border-sky-500/50 bg-sky-500/5':'border-slate-700 bg-slate-950/40'}`}>
          <div className="flex flex-wrap items-start gap-3"><input aria-label={`Incluir ${i.name} en correo`} type="checkbox" checked={selected.includes(i.id)} onChange={e=>setSelected(s=>e.target.checked?[...s,i.id]:s.filter(x=>x!==i.id))} className="mt-1 h-4 w-4 accent-sky-500"/><div className="min-w-[220px] flex-1"><div className="font-semibold">{i.name} · {i.brand} {i.model}</div><div className="text-xs text-slate-400">Seriales: {serialList.join(', ') || 'Pendiente de asignar'}</div><div className="mt-2 flex flex-wrap gap-2">{driveLinks.length ? driveLinks.map((doc,index)=><a key={`${doc.url}-${index}`} href={doc.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-xs text-sky-200 hover:bg-sky-500/20"><span>{doc.label}</span><span aria-hidden="true">↗</span></a>) : <span className="text-xs text-amber-300">No se encontraron enlaces de Drive para este equipo.</span>}</div></div><label className="flex items-center gap-1.5 text-xs text-slate-300"><input type="checkbox" checked={!!visit[i.id]} onChange={e=>setVisit(s=>({...s,[i.id]:e.target.checked}))}/> Requiere visita técnica</label><label className="flex items-center gap-1.5 text-xs text-slate-300"><input type="checkbox" checked={!!dianNA[i.id]} onChange={e=>setDianNA(s=>({...s,[i.id]:e.target.checked}))}/> DIAN no aplica</label></div>
        </div>;
      })}</div>
      {rows.some(r=>r.missing.length)&&<p className="text-amber-300 text-sm mt-3 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0"/>Antes de enviar completa: {rows.filter(r=>r.missing.length).map(r=>`${r.item.name}: ${r.missing.join(', ')}`).join('; ')}</p>}
      {error&&<p role="alert" className="text-rose-300 my-3">{error}</p>}
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-800 pt-4"><span className="text-xs text-slate-400">Seleccionados: {selected.length} · Se enviará un solo correo por lote desde Gmail.</span><button type="button" disabled={sending || selected.length===0} onClick={send} className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 font-bold flex items-center gap-2"><Mail className="w-4 h-4"/>{sending?'Enviando…':'Enviar correo a soporte'}</button></div>
    </div>
  </div>;
};

