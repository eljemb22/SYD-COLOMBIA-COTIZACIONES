import React from 'react';
import {
  Link2,
  ShieldCheck,
  Sparkles,
  FileText,
  Building2,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Tag,
  Hash,
  BookOpen,
} from 'lucide-react';
import { DetectedPurchaseOrder } from '../../services/gmailIntegrationService';
import { MedicalEquipment } from '../../types';
import { findRelatedWorkflowOrders, isPartAlreadyCreatedInApp } from '../../utils/orderWorkflowUtils';

interface WorkflowRelationshipChainProps {
  order: DetectedPurchaseOrder;
  allOrders: DetectedPurchaseOrder[];
  equipments: MedicalEquipment[];
  onSelectOrder: (order: DetectedPurchaseOrder) => void;
  onNavigateToTab?: (tab: string) => void;
}

export const WorkflowRelationshipChain: React.FC<WorkflowRelationshipChainProps> = ({
  order,
  allOrders,
  equipments,
  onSelectOrder,
  onNavigateToTab,
}) => {
  // Documentation emails are handled directly with their Ventana 7 card panel, not in a PO traceability chain
  if (order.emailType === 'documentation') {
    return null;
  }

  const workflow = findRelatedWorkflowOrders(order, allOrders);

  // Avoid visual saturation: only show traceability chain if there are at least 2 related stages
  if (workflow.stages.length < 2) {
    return null;
  }

  return (
    <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 my-2 space-y-2">
      {/* Header with Title and Related Badges */}
      <div className="flex items-center justify-between flex-wrap gap-1.5">
        <div className="flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] font-bold text-slate-300">
            Trazabilidad Vinculada ({workflow.stages.length} correos)
          </span>
        </div>

        {/* Global Key Identifiers in this Chain */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {workflow.ocNumbers.map((oc) => (
            <span
              key={`chain-oc-${oc}`}
              className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold bg-cyan-950/70 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-800/60"
            >
              <Hash className="w-2.5 h-2.5 text-cyan-400" />
              <span>OC: #{oc}</span>
            </span>
          ))}

          {workflow.partCodes.map((code) => {
            const alreadyInApp = isPartAlreadyCreatedInApp(code, equipments);
            return (
              <span
                key={`chain-part-${code}`}
                className={`inline-flex items-center gap-0.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                  alreadyInApp
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                }`}
                title={alreadyInApp ? `Parte #${code} creada en catálogo` : `Parte #${code} pendiente en catálogo`}
              >
                <Tag className="w-2.5 h-2.5" />
                <span>#{code}</span>
                {alreadyInApp && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 ml-0.5" />}
              </span>
            );
          })}
        </div>
      </div>

      {/* Workflow Sequence Steps - Compact Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
        {workflow.stages.map((st, idx) => {
          const isCurrent = st.isCurrent;
          const stageColors = {
            documentation: 'border-indigo-500/40 bg-indigo-950/20 text-indigo-300',
            authorization: 'border-amber-500/40 bg-amber-950/20 text-amber-300',
            part_created: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300',
            supplier_po: 'border-cyan-500/40 bg-cyan-950/20 text-cyan-300',
            client_po: 'border-purple-500/40 bg-purple-950/20 text-purple-300',
            other: 'border-slate-800 bg-slate-900/40 text-slate-300',
          }[st.stage];

          const stageIcons = {
            documentation: <BookOpen className="w-3 h-3 text-indigo-400" />,
            authorization: <ShieldCheck className="w-3 h-3 text-amber-400" />,
            part_created: <Sparkles className="w-3 h-3 text-emerald-400" />,
            supplier_po: <FileText className="w-3 h-3 text-cyan-400" />,
            client_po: <Building2 className="w-3 h-3 text-purple-400" />,
            other: <Link2 className="w-3 h-3 text-slate-400" />,
          }[st.stage];

          return (
            <button
              key={`workflow-stage-${st.order.id || st.order.messageId}-${idx}`}
              type="button"
              onClick={() => onSelectOrder(st.order)}
              className={`text-left p-2 rounded border transition cursor-pointer flex flex-col justify-between gap-1 ${
                isCurrent
                  ? 'ring-1.5 ring-cyan-400 bg-slate-900/95'
                  : 'hover:bg-slate-900/70 opacity-80 hover:opacity-100'
              } ${stageColors}`}
              title="Clic para ver este correo del flujo"
            >
              <div className="flex items-center justify-between gap-1 w-full">
                <span className="flex items-center gap-1 text-[11px] font-bold truncate">
                  {stageIcons}
                  <span className="truncate">{st.label}</span>
                </span>
                {isCurrent && (
                  <span className="text-[8px] uppercase px-1 py-0.2 rounded bg-cyan-500/30 text-cyan-200 font-black border border-cyan-400/40">
                    Actual
                  </span>
                )}
              </div>

              <div className="text-[10px] text-slate-300 truncate w-full" title={st.order.subject}>
                <span className="text-slate-400 block truncate text-[9px]">De: {st.sender}</span>
                <span className="font-medium text-white truncate block">{st.order.subject}</span>
              </div>

              <div className="flex items-center justify-between text-[9px] text-slate-400 pt-0.5 border-t border-slate-800/80 w-full">
                <span>{st.date ? new Date(st.date).toLocaleDateString('es-CO') : 'Reciente'}</span>
                <span className="text-cyan-400 font-semibold inline-flex items-center">
                  <span>Ver</span>
                  <ChevronRight className="w-2.5 h-2.5" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
