import React, { useMemo, useState } from 'react';
import { X, Mail, AlertTriangle } from 'lucide-react';
import { SalesOrderRecord, SalesOrderItem, TechnicalDocument, DispatchSupportNoticeRecord, OCTrackingContract } from '../../../types';
import { gmailService } from '../../../services/gmailIntegrationService';

interface Props { order: SalesOrderRecord; contracts: OCTrackingContract[]; documents: TechnicalDocument[]; onClose: () => void; onSent: (notice: DispatchSupportNoticeRecord) => Promise<void>; }
const esc = (v: string) => v.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const norm = (v?: string) => (v || '').trim().toLowerCase();
const link = (d: any): string => {
  const candidate = d?.fileUrl || d?.downloadUrl || (d?.driveFileId ? `https://drive.google.com/open?id=${encodeURIComponent(d.driveFileId)}` : '');
  return /^https?:\/\//i.test(candidate) ? candidate : '';
};

export const DispatchSupportNoticeModal: React.FC<Props> = ({ order, contracts, documents, onClose, onSent }) => {
  const [to, setTo] = useState(''); const [lot, setLot] = useState('Despacho 1'); const [percent, setPercent] = useState('');
  const [selected, setSelected] = useState<string[]>(order.items.map(i => i.id)); const [visit, setVisit] = useState<Record<string, boolean>>(() => Object.fromEntries(order.items.map(i => [i.id, !!(order.contractNumber || order.contractId)])));
  const [dianNA, setDianNA] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false); const [error, setError] = useState('');
  const rows = useMemo(() => selected.map(id => order.items.find(i => i.id === id)!).filter(Boolean).map((item: SalesOrderItem) => {
    const docs = documents.filter(d => (d.equipmentId && d.equipmentId === item.equipmentId) || (d.equipmentCode && norm(d.equipmentCode) === norm(item.code)) || norm(d.equipmentName) === norm(item.name));
    const ficha = docs.find(d => /ficha/i.test(d.docType || d.type || ''));
    const manual = docs.find(d => /manual/i.test(d.docType || d.type || ''));
    const serials = (item.assignedSerialNumbers || item.serialNumbers || []).map((s: any) => typeof s === 'string' ? s : s?.serialNumber).filter(Boolean);
    const ocSerials = contracts.flatMap(c => c.items || []).filter(ci => (ci.salesOrderItemId && ci.salesOrderItemId === item.id) || (ci.equipmentId && ci.equipmentId === item.equipmentId) || (ci.code && norm(ci.code) === norm(item.code))).flatMap(ci => ci.serialNumbers || ci.serializedUnits || []);
    const dianDocs = ocSerials.flatMap((s: any) => [...(s.individualDocs || []), ...(s.documents || [])]).filter((d: any) => /dian|aduan|manifiesto/i.test(`${d.docType || ''} ${d.title || ''}`));
    const links = [ficha, manual].filter(Boolean).map(d => ({label: /ficha/i.test(d!.docType || d!.type || '') ? 'Ficha técnica' : 'Manual', url: link(d)})).filter(d => d.url);
    dianDocs.forEach((d: any) => { const url = link(d); if (url) links.push({label:'Documento DIAN',url}); });
    const hasDian = ocSerials.length > 0 && ocSerials.every((s: any) => s.dianDeclarationNumber || s.dianImportDeclaration || dianDocs.some((d: any) => d.fileUrl || d.driveFileId));
    return { item, docs, serials, links, hasDian, missing: [!serials.length && !item.equipmentId ? '' : (!serials.length ? 'serial' : ''), !hasDian && !dianNA[item.id] ? 'DIAN o marcar N/A' : '', !links.some(d => d.label === 'Ficha técnica') ? 'ficha técnica' : '', !links.some(d => d.label === 'Manual') ? 'manual' : ''].filter(Boolean) };
  }), [selected, order, documents, contracts, dianNA]);
  const send = async () => {
    setError(''); const recipients = to.split(/[;,\s]+/).map(s => s.trim()).filter(Boolean);
    if (!recipients.length || recipients.some(e => !/^\S+@\S+\.\S+$/.test(e))) return setError('Ingresa correos válidos del equipo técnico.');
    if (!rows.length) return setError('Selecciona al menos un equipo.');
    if (rows.some(r => r.missing.length)) return setError('Completa serial, DIAN (o indica que no aplica), ficha técnica y manual con enlaces antes de enviar.');
    if ((order.dispatchSupportNotices || []).some(n => norm(n.lotReference) === norm(lot))) return setError('Ya existe un aviso para este lote. Usa otra referencia para un despacho nuevo.');
    if (!gmailService.isConnected()) return setError('Conecta Gmail en la ventana 5.1 antes de enviar.');
    const needsVisit = rows.some(r => visit[r.item.id]); const mode = needsVisit ? 'technical_visit' : 'documents_only';
    const subject = `Despacho ${order.salesOrderNumber} · ${lot} · ${order.clientName}`;
    const html = `<h2>Despacho ${esc(order.salesOrderNumber)}</h2><p>Cliente: ${esc(order.clientName)} · Lote: ${esc(lot)}${percent ? ` · Hito: ${esc(percent)}%` : ''}</p><ul>${rows.map(r => `<li><b>${esc(r.item.name)}</b> (${esc(r.item.brand || '')} ${esc(r.item.model || '')}) · Seriales: ${r.serials.map(esc).join(', ')} · ${visit[r.item.id] ? 'Requiere visita técnica' : 'Documentación' }<br/>${r.links.map(d => `<a href="${esc(d.url)}">${esc(d.label)}</a>`).join(' · ')}</li>`).join('')}</ul>${needsVisit ? '<p>Coordinar contacto con el cliente para instalación o capacitación.</p>' : '<p>Se comparte la documentación para consulta; no se solicita visita.</p>'}`;
    setSending(true);
    try { const sent = await gmailService.sendRawEmail(recipients.join(', '), subject, html);
      await onSent({ id: crypto.randomUUID(), lotReference: lot.trim(), milestonePercent: percent ? Number(percent) : undefined, sentAt: new Date().toISOString(), recipients, gmailMessageId: sent.id, mode, items: rows.map(r => ({salesOrderItemId:r.item.id,name:r.item.name,quantity:Number(r.item.quantityToDispatch || r.item.quantity || 1),serialNumbers:r.serials,requiresTechnicalVisit:!!visit[r.item.id],documentLinks:r.links})) }); onClose();
    } catch(e:any) { setError(e?.message || 'No se pudo enviar el aviso.'); } finally { setSending(false); }
  };
  return <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4"><div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-auto p-5 text-slate-100"><div className="flex justify-between"><h2 className="font-bold text-lg">Aviso consolidado de despacho</h2><button onClick={onClose}><X/></button></div><p className="text-sm text-slate-400 mt-1">Un correo por lote; marca visita solo para equipos que la requieren.</p><div className="grid md:grid-cols-3 gap-3 my-4"><input className="bg-slate-800 p-2 rounded" placeholder="Correos técnicos" value={to} onChange={e=>setTo(e.target.value)}/><input className="bg-slate-800 p-2 rounded" value={lot} onChange={e=>setLot(e.target.value)} placeholder="Lote / hito"/><input className="bg-slate-800 p-2 rounded" type="number" min="0" max="100" value={percent} onChange={e=>setPercent(e.target.value)} placeholder="% contrato (opcional)"/></div>{order.items.map(i=><div key={i.id} className="flex gap-3 border-t border-slate-800 py-3 text-sm"><input type="checkbox" checked={selected.includes(i.id)} onChange={e=>setSelected(s=>e.target.checked?[...s,i.id]:s.filter(x=>x!==i.id))}/><span className="flex-1">{i.name} · {i.brand} {i.model}<small className="block text-slate-400">{i.assignedSerialNumbers?.length ? 'Serial asignado' : 'Revisa serial y documentación en catálogo'}</small></span><label><input type="checkbox" checked={!!visit[i.id]} onChange={e=>setVisit(s=>({...s,[i.id]:e.target.checked}))}/> Visita técnica</label><label><input type="checkbox" checked={!!dianNA[i.id]} onChange={e=>setDianNA(s=>({...s,[i.id]:e.target.checked}))}/> DIAN no aplica</label></div>)}{rows.some(r=>r.missing.length)&&<p className="text-amber-300 text-sm flex gap-2 mt-3"><AlertTriangle/>Pendiente completar: {rows.filter(r=>r.missing.length).map(r=>`${r.item.name}: ${r.missing.join(', ')}`).join('; ')}</p>}{error&&<p className="text-rose-300 my-3">{error}</p>}<button disabled={sending} onClick={send} className="mt-4 px-4 py-2 rounded bg-sky-600 disabled:opacity-50 flex gap-2"><Mail/>{sending?'Enviando…':'Enviar aviso y guardar en la OV'}</button></div></div>;
};
