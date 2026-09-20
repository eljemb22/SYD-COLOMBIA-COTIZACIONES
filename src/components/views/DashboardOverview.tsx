import React, { useState, useMemo } from 'react';
import {
  Building2,
  ShoppingCart,
  PenLine,
  BookOpen,
  FileSpreadsheet,
  FolderArchive,
  History,
  ArrowRight,
  HelpCircle,
  Compass,
  FileText,
  ShieldCheck,
  Layers,
  ChevronRight,
  Info,
  CheckCircle2,
  Sparkles,
  Zap,
  Activity,
  FileCheck2,
  Truck,
  PackageCheck,
  Users,
  Database,
  Search,
  Calendar,
  DollarSign,
  MapPin,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  Plus,
  Share2,
  Copy,
  Globe,
  Check,
  ExternalLink,
} from 'lucide-react';
import { getPublicShareAppUrl } from '../../utils/appUrlHelper';
import { ActiveTab } from '../Navigation';
import {
  QuoteHeader,
  QuoteItem,
  MedicalEquipment,
  TenderItem,
  TechnicalDocument,
  AuthUser,
  SavedQuote,
  TenderClientProject,
  OCTrackingContract,
} from '../../types';
import { formatCOP } from '../../utils/formatters';
import {
  ClientRecord,
  harvestAllClientsFromSystem,
  normalizeClientName,
} from '../../utils/clientStorage';
import { getSavedQuotes } from '../../utils/quoteStorage';
import { ClientDirectoryModal } from '../modals/ClientDirectoryModal';
import { WorkflowPipelineGuide } from '../common/WorkflowPipelineGuide';

interface DashboardOverviewProps {
  quoteHeader: QuoteHeader;
  quoteItems: QuoteItem[];
  equipments: MedicalEquipment[];
  tenderItems: TenderItem[];
  documents: TechnicalDocument[];
  savedQuotes?: SavedQuote[];
  tenderClients?: TenderClientProject[];
  ocContracts?: OCTrackingContract[];
  onNavigate: (tab: ActiveTab) => void;
  onLoadQuoteIntoEditor?: (quote: SavedQuote) => void;
  currentUser?: AuthUser | null;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  quoteHeader,
  quoteItems,
  equipments,
  tenderItems,
  documents,
  savedQuotes: savedQuotesProp,
  tenderClients = [],
  ocContracts = [],
  onNavigate,
  onLoadQuoteIntoEditor,
  currentUser,
}) => {
  // Active tab in the interactive guide section
  const [selectedGuideTab, setSelectedGuideTab] = useState<ActiveTab>('ventas');
  const [isFullDirectoryModalOpen, setIsFullDirectoryModalOpen] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [clientDeptFilter, setClientDeptFilter] = useState('all');
  const [expandedOverviewClientId, setExpandedOverviewClientId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const currentWebUrl = getPublicShareAppUrl();

  const handleCopyCurrentWebUrl = () => {
    if (!navigator.clipboard) {
      const el = document.createElement('textarea');
      el.value = currentWebUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
      return;
    }

    navigator.clipboard.writeText(currentWebUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleOpenInNewTab = () => {
    window.open(currentWebUrl, '_blank', 'noopener,noreferrer');
  };

  const activeSavedQuotes = useMemo(() => {
    return savedQuotesProp && savedQuotesProp.length > 0 ? savedQuotesProp : getSavedQuotes();
  }, [savedQuotesProp]);

  // Harvest all registered clients across quotes, tenders, and OCs
  const allClients = useMemo(() => {
    return harvestAllClientsFromSystem(activeSavedQuotes, tenderClients, ocContracts);
  }, [activeSavedQuotes, tenderClients, ocContracts]);

  // Map quotes to clients for fast lookup
  const clientQuotesMap = useMemo(() => {
    const map = new Map<string, SavedQuote[]>();
    activeSavedQuotes.forEach((quote) => {
      const norm = normalizeClientName(quote.clientName);
      if (!norm) return;
      const list = map.get(norm) || [];
      list.push(quote);
      map.set(norm, list);
    });
    return map;
  }, [activeSavedQuotes]);

  // Total quotes count & total COP quoted
  const totalQuotedValue = useMemo(() => {
    return activeSavedQuotes.reduce((acc, q) => acc + (q.total || 0), 0);
  }, [activeSavedQuotes]);

  const clientsWithQuotesCount = useMemo(() => {
    return allClients.filter((c) => {
      const norm = normalizeClientName(c.name);
      return (clientQuotesMap.get(norm) || []).length > 0;
    }).length;
  }, [allClients, clientQuotesMap]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    allClients.forEach((c) => {
      if (c.department) set.add(c.department.trim());
    });
    return Array.from(set).sort();
  }, [allClients]);

  // Filtered clients in overview
  const filteredClients = useMemo(() => {
    return allClients.filter((c) => {
      const q = clientSearchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        (c.name || '').toLowerCase().includes(q) ||
        (c.nit || '').toLowerCase().includes(q) ||
        (c.city || '').toLowerCase().includes(q) ||
        (c.contactPerson || '').toLowerCase().includes(q);

      const matchDept = clientDeptFilter === 'all' || c.department === clientDeptFilter;
      return matchSearch && matchDept;
    });
  }, [allClients, clientSearchTerm, clientDeptFilter]);

  const quoteSubtotal = quoteItems.reduce((acc, it) => acc + it.totalSalePrice, 0);
  const quoteTotalWithIva = quoteSubtotal * (1 + quoteHeader.taxRate);
  const totalUnitsInQuote = quoteItems.reduce((acc, it) => acc + it.quantity, 0);

  const fichasCount = documents.filter((d) => d.docType === 'Ficha Técnica').length;
  const invimaCount = documents.filter((d) => d.docType === 'Registro INVIMA').length;
  const manualesCount = documents.filter((d) => d.docType === 'Manual y Guía').length;

  // Window definitions for cards
  const windowsList = [
    {
      id: 'ventas' as ActiveTab,
      badge: 'Ventana 1',
      title: 'Cotizaciones',
      subtitle: 'Propuesta comercial formal en Word e historial de cotizaciones',
      icon: ShoppingCart,
      color: '#38bdf8',
      bgColor: 'bg-sky-500/10',
      borderColor: 'border-sky-500/30',
      hoverBorder: 'hover:border-sky-400',
      accentColor: 'text-sky-400',
      statLabel: 'En cotizador activo',
      statValue: `${quoteItems.length} equipos (${totalUnitsInQuote} u.)`,
      totalLabel: 'Total con IVA',
      totalValue: `${formatCOP(quoteTotalWithIva)} COP`,
      description:
        'Elabore cotizaciones mercantiles con membrete oficial, liquide totales en tiempo real, gestione el historial de cotizaciones guardadas y descargue en Word (.docx).',
      bestFor: 'Crear cotizaciones oficiales, consultar historial y exportar a Word.',
    },
    {
      id: 'costos' as ActiveTab,
      badge: 'Ventana 2',
      title: 'Gestor de Costos',
      subtitle: 'Liquidación de precios, accesorios y márgenes',
      icon: PenLine,
      color: '#fbbf24',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      hoverBorder: 'hover:border-amber-400',
      accentColor: 'text-amber-400',
      statLabel: 'Equipos en cálculo',
      statValue: `${quoteItems.length} registrados`,
      totalLabel: 'Reglas de precio',
      totalValue: 'Listas L1 a L8 o Factor Libre',
      description:
        'Configure accesorios obligatorios/opcionales, costos unitarios y seleccione listas de margen para calcular el precio de venta final sincronizado.',
      bestFor: 'Ajustar rentabilidad, costos base de importación y multiplicadores de venta.',
    },
    {
      id: 'catalogo' as ActiveTab,
      badge: 'Catálogo',
      title: 'Catálogo de Equipos',
      subtitle: 'Inventario central de tecnología médica',
      icon: BookOpen,
      color: '#60a5fa',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      hoverBorder: 'hover:border-blue-400',
      accentColor: 'text-blue-400',
      statLabel: 'Equipos registrados',
      statValue: `${equipments.length} modelos`,
      totalLabel: 'Marcas líderes',
      totalValue: 'MINDRAY, BOVIE, EDAN...',
      description:
        'Banco maestro de equipos biomédicos. Permite consultar especificaciones técnicas, registros sanitarios INVIMA y transferir equipos a otras ventanas.',
      bestFor: 'Consultar el catálogo y enviar equipos a Cotizaciones, Licitaciones o Documentos.',
    },
    {
      id: 'licitaciones' as ActiveTab,
      badge: 'Ventana 4',
      title: 'Licitaciones y Contratos',
      subtitle: 'Anexos técnicos y matrices de cumplimiento',
      icon: FileSpreadsheet,
      color: '#c084fc',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
      hoverBorder: 'hover:border-purple-400',
      accentColor: 'text-purple-400',
      statLabel: 'Ítems en pliego',
      statValue: `${tenderItems.length} artículos`,
      totalLabel: 'Formatos de salida',
      totalValue: 'Word (.doc) y Excel (.xls)',
      description:
        'Estructure requerimientos técnicos punto a punto con consecutivo automático (1, 2, 3...) y exporte anexos técnicos para contratación pública o privada.',
      bestFor: 'Armar fichas técnicas licitatorias y responder pliegos de condiciones.',
    },
    {
      id: 'seguimiento_oc' as ActiveTab,
      badge: 'Ventana 5',
      title: 'Seguimiento de OC',
      subtitle: 'Gestión de órdenes de compra a proveedores y auditoría logística',
      icon: Truck,
      color: '#38bdf8',
      bgColor: 'bg-sky-500/10',
      borderColor: 'border-sky-500/30',
      hoverBorder: 'hover:border-sky-400',
      accentColor: 'text-sky-400',
      statLabel: 'Gestión logística',
      statValue: 'Control integral de OC',
      totalLabel: 'Alertas',
      totalValue: 'Motor 48h sin novedad',
      description:
        'Audite entregas, pagos a fábricas/proveedores, recepciones en bodega y bitácoras de seguimiento.',
      bestFor: 'Supervisar contratos adjudicados y compras a proveedores.',
    },
    {
      id: 'documentacion' as ActiveTab,
      badge: 'Ventana 6',
      title: 'Documentación Técnica',
      subtitle: 'Custodia de archivos INVIMA, fichas y manuales',
      icon: FolderArchive,
      color: '#34d399',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      hoverBorder: 'hover:border-emerald-400',
      accentColor: 'text-emerald-400',
      statLabel: 'Documentos custodiados',
      statValue: `${documents.length} archivos`,
      totalLabel: 'Desglose principal',
      totalValue: `${fichasCount} Fichas • ${invimaCount} INVIMA`,
      description:
        'Repositorio centralizado para consultar, visualizar y descargar documentos técnicos, registros sanitarios y manuales de servicio.',
      bestFor: 'Buscar y descargar certificaciones sanitarias y fichas técnicas oficiales.',
    },
  ];

  // Quick Action Scenarios for new users
  const quickScenarios = [
    {
      title: '¿Necesitas crear una cotización formal o consultar propuestas guardadas?',
      actionText: 'Ir a Ventana 1 (Cotizaciones)',
      targetTab: 'ventas' as ActiveTab,
      icon: ShoppingCart,
      colorText: 'text-sky-400',
      colorBg: 'bg-sky-500/10 hover:bg-sky-500/20 border-sky-500/30',
      stepSummary: 'Define los datos del cliente, verifica los equipos incluidos, consulta el historial guardado y descarga en Word.',
    },
    {
      title: '¿Deseas calcular el precio de venta según la lista de margen?',
      actionText: 'Ir a Ventana 2 (Costos)',
      targetTab: 'costos' as ActiveTab,
      icon: PenLine,
      colorText: 'text-amber-400',
      colorBg: 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30',
      stepSummary: 'Selecciona la lista (L1–L8 o factor libre) para calcular costos y precios que se reflejarán en la venta.',
    },
    {
      title: '¿Quieres buscar un equipo o agregarlo a una cotización o licitación?',
      actionText: 'Ir al Catálogo de Equipos',
      targetTab: 'catalogo' as ActiveTab,
      icon: BookOpen,
      colorText: 'text-blue-400',
      colorBg: 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30',
      stepSummary: 'Explora por categoría, marca o parte y haz clic en las acciones para transferir al módulo correspondiente.',
    },
    {
      title: '¿Debes preparar un anexo técnico para una licitación pública?',
      actionText: 'Ir a Ventana 4 (Licitaciones)',
      targetTab: 'licitaciones' as ActiveTab,
      icon: FileSpreadsheet,
      colorText: 'text-purple-400',
      colorBg: 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30',
      stepSummary: 'Gestiona los pliegos de condiciones, añade requerimientos técnicos y genera la matriz en Word o Excel.',
    },
    {
      title: '¿Buscas el Registro INVIMA, Ficha Técnica o Manual de un equipo?',
      actionText: 'Ir a Ventana 6 (Documentación)',
      targetTab: 'documentacion' as ActiveTab,
      icon: FolderArchive,
      colorText: 'text-emerald-400',
      colorBg: 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30',
      stepSummary: 'Filtra por tipo de documento o equipo médico para previsualizar y descargar archivos PDF o Word.',
    },
    {
      title: '¿Necesitas rastrear Órdenes de Compra y contratos adjudicados?',
      actionText: 'Ir a Ventana 5 (Seguimiento OC)',
      targetTab: 'seguimiento_oc' as ActiveTab,
      icon: Truck,
      colorText: 'text-sky-400',
      colorBg: 'bg-sky-500/10 hover:bg-sky-500/20 border-sky-500/30',
      stepSummary: 'Verifica llegada de equipos, estado de pago, despachos y alertas de 48h sin actualización.',
    },
  ];

  // Detailed guides per window for the interactive explanation section
  const windowGuides: Record<ActiveTab, { title: string; subtitle: string; icon: any; steps: string[]; tips: string[] }> = {
    inicio: {
      title: 'Pantalla de Inicio',
      subtitle: 'Centro de navegación y ayuda',
      icon: Compass,
      steps: [
        'Esta pantalla es tu punto de partida informativo.',
        'Haz clic en cualquiera de las tarjetas de ventanas para dirigirte al módulo de trabajo que necesites.',
        'Consulta el resumen del cliente activo y el flujo recomendado de 4 pasos.',
      ],
      tips: [
        'Para realizar cambios, crear o modificar equipos y cotizaciones, entra a la ventana correspondiente.',
      ],
    },
    ventas: {
      title: 'Ventana 1: Cotizaciones (Editor Oficial e Historial)',
      subtitle: 'Generación de propuestas comerciales formales y control de cotizaciones guardadas',
      icon: ShoppingCart,
      steps: [
        '1. Revisa los datos del cliente destinatario en el encabezado (Nombre, NIT, Ciudad, Asesor).',
        '2. Verifica los equipos cargados en la cotización con sus imágenes, marcas, modelos y descripciones.',
        '3. Ajusta cantidades y observa el cálculo del Subtotal, IVA (19%) y Total en pesos colombianos (COP).',
        '4. Revisa las 3 hojas oficiales membretadas: Carta de Presentación, Tabla Económica y Condiciones Comerciales con Firma.',
        '5. Guarda la cotización en el sistema y accede a la pestaña "Cotizaciones Guardadas" para consultar el historial, filtrar por estados o duplicar propuestas.',
        '6. Exporta el documento listo para enviar con el botón "Exportar Word (.docx)" o imprime directamente.',
      ],
      tips: [
        'El módulo unificado de Cotizaciones integra tanto el editor de propuestas en Word como el archivo histórico de cotizaciones guardadas en un solo lugar.',
        'Los precios de venta mostrados en esta ventana se alimentan directamente del Gestor de Costos (Ventana 2).',
      ],
    },
    costos: {
      title: 'Ventana 2: Gestor de Costos & Rentabilidad',
      subtitle: 'Cálculo de márgenes, listas de precios y accesorios',
      icon: PenLine,
      steps: [
        '1. Añade equipos desde el catálogo usando el botón "+ Agregar Equipos".',
        '2. Para cada equipo, configura su costo base de importación/compra y los accesorios incluidos.',
        '3. Selecciona la Lista de Margen deseada (L1 a L8) o ingresa un Factor Multiplicador Libre.',
        '4. El sistema calcula en tiempo real el costo total, margen de ganancia en COP y el Precio de Venta Unitario.',
        '5. Todos los precios calculados se sincronizan automáticamente con el Cotizador (Ventana 1).',
      ],
      tips: [
        'Las listas de precios (L1–L8) aplican factores estandarizados de ganancia sobre el costo base acumulado.',
        'Puedes desglosar accesorios estándar y opcionales para mayor precisión en la oferta económica.',
      ],
    },
    catalogo: {
      title: 'Ventana 3: Catálogo Maestro de Equipos Médicos',
      subtitle: 'Inventario central de equipos biomédicos',
      icon: BookOpen,
      steps: [
        '1. Busca equipos por nombre, marca, modelo, parte del fabricante o registro INVIMA en la barra superior.',
        '2. Filtra por categoría clínica: Monitoreo, Cirugía, Diagnóstico, Urgencias, Ginecología, Quirófano, etc.',
        '3. Revisa la ficha técnica resumida, procedencia, registro sanitario y costo de referencia.',
        '4. Para cotizar un equipo, utiliza el botón de acción para transferirlo a Costos (V2), Licitaciones (V4) o Documentos (V5).',
      ],
      tips: [
        'El catálogo actúa como la fuente de verdad técnica para toda la plataforma.',
        'Los usuarios con rol Administrador pueden crear y editar equipos nuevos directamente desde esta ventana.',
      ],
    },
    licitaciones: {
      title: 'Ventana 4: Licitaciones & Contratos',
      subtitle: 'Preparación de pliegos técnicos, contratación y tablas de cumplimiento',
      icon: FileSpreadsheet,
      steps: [
        '1. Selecciona o crea el cliente/proyecto de licitación institucional en el panel izquierdo.',
        '2. Agrega los equipos requeridos en el pliego de condiciones desde el catálogo.',
        '3. Edita las especificaciones técnicas requeridas y verifica que cada punto cumpla con lo exigido.',
        '4. La numeración secuencial técnica (Ítem 1, 2, 3...) se genera automáticamente sin huecos.',
        '5. Descarga el anexo técnico listo en formato Word (.doc) o la matriz de especificaciones en Excel (.xls).',
      ],
      tips: [
        'Puedes utilizar el Banco de Requisitos Técnicos para insertar cláusulas estándar de cumplimiento.',
        'Cada proyecto de licitación mantiene sus propios ítems y estado de preparación de forma independiente.',
      ],
    },
    seguimiento_oc: {
      title: 'Ventana 5: Seguimiento de Órdenes de Compra (OC)',
      subtitle: 'Control logístico de compras a proveedores, pagos y alertas de 48h',
      icon: Truck,
      steps: [
        '1. Revisa las Órdenes de Compra organizadas por proveedor, sincronizadas desde Licitaciones Adjudicadas o creadas manualmente.',
        '2. Cada OC soporta múltiples equipos médicos con sus marcas, modelos, cantidades y precios de costo.',
        '3. Actualiza el estado operativo y de pago: Pendiente de Pago, Pagado al Proveedor, Equipos en Bodega, En Ingreso Técnico, Despachado, etc.',
        '4. El motor de alertas inteligente te notifica con alertas de 48h si una orden o equipo lleva más de 2 días sin novedad.',
        '5. Registra novedades en la bitácora y exporta la matriz completa en Excel.',
      ],
      tips: [
        'Puedes alternar entre la Vista por Proveedor/OC y la Tabla Maestra Consolidada.',
        'Cada registro de novedad en la bitácora reinicia automáticamente el contador de alerta de 2 días.',
      ],
    },
    documentacion: {
      title: 'Ventana 6: Documentación Técnica Oficial',
      subtitle: 'Repositorio de registros INVIMA, manuales y fichas',
      icon: FolderArchive,
      steps: [
        '1. Explora los documentos clasificados por: Fichas Técnicas, Registros INVIMA, Manuales y Certificados.',
        '2. Utiliza el buscador para localizar documentos asociados a un equipo o marca específica.',
        '3. Haz clic en "Previsualizar" para ver el contenido del documento en pantalla.',
        '4. Descarga los archivos en formato PDF o Word cuando los requieras para adjuntar a una propuesta.',
      ],
      tips: [
        'Mantener los registros INVIMA vigentes es fundamental para la validez de las propuestas en Colombia.',
        'Los documentos pueden vincularse directamente a los equipos del catálogo para acceso rápido.',
      ],
    },
    ordenes_venta: {
      title: 'Ventana 7: Órdenes de Venta y Facturación (OV & Facturas)',
      subtitle: 'Despacho de equipos a clientes, asignación de seriales y facturación electrónica',
      icon: PackageCheck,
      steps: [
        '1. Genera una nueva Orden de Venta (ej: OV-2026-001) seleccionando el contrato adjudicado o cliente destinatario.',
        '2. Especifica los equipos y cantidades a despachar, asignando seriales físicos recibidos en bodega.',
        '3. Actualiza el estado de la OV: En Alistamiento, Despachada, Entregada con Acta o Facturada.',
        '4. Adjunta la Factura de Venta emitida por SyD al cliente en formato PDF junto con guías de transporte o actas de entrega.',
        '5. Consulta el Tablero 360° de Trazabilidad para comparar en tiempo real: Contrato ➔ OC Proveedor ➔ OV Despacho ➔ Facturación.',
      ],
      tips: [
        'Cada OV descuenta y controla los despachos acumulados sobre el total del contrato adjudicado.',
        'Las facturas electrónicas adjuntas quedan guardadas de forma segura y asociadas tanto al cliente como al contrato.',
      ],
    },
    historial: {
      title: 'Ventana 1: Cotizaciones Guardadas',
      subtitle: 'Control de versiones y seguimiento comercial',
      icon: ShoppingCart,
      steps: [
        '1. Visualiza todas las cotizaciones creadas con su fecha, cliente, asesor, total y estado.',
        '2. Filtra por estado: Borrador, Enviada al Cliente, Aprobada o Rechazada.',
        '3. Haz clic en "Cargar en Editor" para abrir una cotización en el editor y continuar editándola.',
        '4. Utiliza la opción de "Duplicar" para generar una nueva propuesta a partir de una existente.',
      ],
      tips: [
        'Cargar una cotización previa reemplaza la cotización activa en el editor con los datos guardados.',
      ],
    },
    gmail_compras: {
      title: 'Ventana 5.1: Conexión Gmail & Órdenes de Compra',
      subtitle: 'Detección automática de correos del departamento de compras y envío de solicitudes oficiales',
      icon: Mail,
      steps: [
        '1. Conecta tu cuenta corporativa de Gmail mediante autenticación segura de Google.',
        '2. Revisa la bandeja de entrada donde el sistema escanea y detecta automáticamente Órdenes de Compra y solicitudes de repuestos.',
        '3. Diligencia la Plantilla Oficial de "Creación de Partes / Equipos Nuevos" con nombre, marca, modelo, precio, IVA y proveedor.',
        '4. Envía Órdenes de Compra formales (OC) con cálculo de totales, desglose de IVA y destinatario configurable.',
        '5. Consulta el historial de correos enviados y añade partes detectadas directamente al Catálogo Maestro.',
      ],
      tips: [
        'La integración utiliza la API oficial de Gmail y genera correos con diseño HTML corporativo de SyD Colombia.',
      ],
    },
  };

  const currentGuide = windowGuides[selectedGuideTab] || windowGuides.ventas;
  const GuideIcon = currentGuide.icon;

  return (
    <div id="dashboard-overview" className="space-y-6 animate-fadeIn max-w-7xl mx-auto pb-10">
      {/* 1. HERO BANNER - Clean, informative, strictly navigation-oriented */}
      <div className="bg-gradient-to-br from-[#18283f] via-[#1a2e48] to-[#122033] border border-[#334d6e] rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-[#38bdf8]/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#38bdf8]/15 border border-[#38bdf8]/30 px-3 py-1 rounded-full text-[#38bdf8] text-xs font-bold mb-2.5">
              <Building2 className="w-3.5 h-3.5" />
              <span>SYD Colombia • Portal Principal de Navegación</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Centro de Gestión Comercial &amp; Licitaciones
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1.5 leading-relaxed">
              Seleccione la ventana a la que desea ingresar para gestionar cotizaciones en Word, liquidar costos con márgenes, consultar el catálogo, preparar licitaciones o descargar documentación técnica.
            </p>
          </div>

          {/* Quick status pill */}
          <div className="flex items-center gap-3 bg-[#111c2e]/90 border border-[#334d6e] px-4 py-3 rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-[#38bdf8]/15 text-[#38bdf8] flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                Usuario Activo
              </div>
              <div className="text-xs font-bold text-white">
                {currentUser?.name || currentUser?.username || 'Usuario'}
              </div>
              <div className="text-[10px] text-emerald-400 font-medium">
                {currentUser?.role === 'admin' ? 'Administrador' : currentUser?.roleLabel || 'Usuario del Sistema'}
              </div>
            </div>
          </div>
        </div>

        {/* Informative metadata bar (Read-only summary of current state) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-4 border-t border-[#334d6e]/60">
          <div className="bg-[#111c2e]/70 p-3 rounded-xl border border-[#334d6e]/40">
            <span className="text-[10.5px] uppercase tracking-wider font-semibold text-slate-400 block">
              Cliente en Cotizador
            </span>
            <strong className="text-xs text-white truncate block mt-0.5" title={quoteHeader.clientName}>
              {quoteHeader.clientName || 'Sin asignar'}
            </strong>
          </div>

          <div className="bg-[#111c2e]/70 p-3 rounded-xl border border-[#334d6e]/40">
            <span className="text-[10.5px] uppercase tracking-wider font-semibold text-slate-400 block">
              Cotización N°
            </span>
            <strong className="text-xs text-[#38bdf8] font-mono block mt-0.5">
              {quoteHeader.quoteNumber}
            </strong>
          </div>

          <div className="bg-[#111c2e]/70 p-3 rounded-xl border border-[#334d6e]/40">
            <span className="text-[10.5px] uppercase tracking-wider font-semibold text-slate-400 block">
              Equipos en Catálogo
            </span>
            <strong className="text-xs text-slate-200 block mt-0.5">
              {equipments.length} modelos disponibles
            </strong>
          </div>

          <div className="bg-[#111c2e]/70 p-3 rounded-xl border border-[#334d6e]/40">
            <span className="text-[10.5px] uppercase tracking-wider font-semibold text-slate-400 block">
              Documentos Técnicos
            </span>
            <strong className="text-xs text-emerald-400 font-bold block mt-0.5">
              {documents.length} archivos en custodia
            </strong>
          </div>
        </div>

        {/* Dynamic Enlace Web para Compartir y Abrir en Otros Dispositivos */}
        <div className="mt-4 p-3.5 bg-gradient-to-r from-sky-950/70 via-slate-900/90 to-indigo-950/70 rounded-xl border border-sky-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-inner">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30 shrink-0">
              <Globe className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-white">
                  Enlace Público Oficial para Abrir en Otros Equipos:
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Acceso Público
                </span>
              </div>
              <p className="text-[11px] text-cyan-300 font-mono truncate mt-0.5 font-semibold" title={currentWebUrl}>
                {currentWebUrl}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end flex-wrap">
            <button
              type="button"
              onClick={handleCopyCurrentWebUrl}
              className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition shadow-md active:scale-95 cursor-pointer ${
                copiedLink
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white border border-sky-400/40'
              }`}
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>¡Enlace Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Enlace</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleOpenInNewTab}
              title="Abrir enlace en una nueva pestaña"
              className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer active:scale-95"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Probar ↗</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Interactive Workflow Pipeline Guide */}
      <WorkflowPipelineGuide currentTab="inicio" onNavigateToTab={onNavigate} />

      {/* ========================================================================= */}
      {/* 2. DIRECTORIO DE CLIENTES & COTIZACIONES EMITIDAS (FIRST SCREEN FEATURE) */}
      {/* ========================================================================= */}
      <div className="bg-[#18263a] border border-[#38bdf8]/40 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-[#334d6e]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">
                  Directorio de Clientes &amp; Cotizaciones Emitidas
                </h2>
                <span className="text-xs bg-[#38bdf8]/20 text-[#38bdf8] px-2.5 py-0.5 rounded-full font-bold border border-[#38bdf8]/30">
                  {allClients.length} Clientes
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Consulte todos los clientes registrados, cuántas cotizaciones se han emitido y a qué número, fecha y valor corresponden.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              onClick={() => setIsFullDirectoryModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 bg-[#38bdf8] hover:bg-[#0284c7] text-slate-950 hover:text-white font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-md cursor-pointer flex-1 sm:flex-initial"
            >
              <Users className="w-4 h-4" />
              <span>Ver Directorio Completo</span>
            </button>
            <button
              onClick={() => onNavigate('ventas')}
              className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-md cursor-pointer flex-1 sm:flex-initial"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Cotización</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-[#111c2e] border border-[#334d6e] rounded-xl p-3">
            <span className="text-[11px] text-slate-400 font-semibold uppercase block">Clientes Totales</span>
            <span className="text-lg font-black text-white">{allClients.length}</span>
          </div>
          <div className="bg-[#111c2e] border border-[#334d6e] rounded-xl p-3">
            <span className="text-[11px] text-slate-400 font-semibold uppercase block">Con Cotizaciones</span>
            <span className="text-lg font-black text-[#38bdf8]">{clientsWithQuotesCount}</span>
          </div>
          <div className="bg-[#111c2e] border border-[#334d6e] rounded-xl p-3">
            <span className="text-[11px] text-slate-400 font-semibold uppercase block">Cotizaciones Emitidas</span>
            <span className="text-lg font-black text-emerald-400">{activeSavedQuotes.length}</span>
          </div>
          <div className="bg-[#111c2e] border border-[#334d6e] rounded-xl p-3">
            <span className="text-[11px] text-slate-400 font-semibold uppercase block">Total Cotizado</span>
            <span className="text-xs sm:text-sm font-black text-emerald-300 truncate block mt-1">
              ${formatCOP(totalQuotedValue)} COP
            </span>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#111c2e] p-3 rounded-xl border border-[#334d6e]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar cliente por nombre, NIT, municipio o contacto..."
              value={clientSearchTerm}
              onChange={(e) => setClientSearchTerm(e.target.value)}
              className="w-full bg-[#192b45] border border-[#334d6e] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-[#38bdf8]"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={clientDeptFilter}
              onChange={(e) => setClientDeptFilter(e.target.value)}
              className="bg-[#192b45] border border-[#334d6e] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-[#38bdf8]"
            >
              <option value="all">Todos los Departamentos</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Client Cards Display */}
        {filteredClients.length === 0 ? (
          <div className="p-8 text-center bg-[#111c2e] rounded-xl border border-[#334d6e] space-y-2">
            <Users className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-xs font-bold text-slate-300">No se encontraron clientes</p>
            <p className="text-[11px] text-slate-400">
              {clientSearchTerm
                ? `Ningún cliente coincide con "${clientSearchTerm}".`
                : 'No hay clientes registrados en el sistema.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredClients.slice(0, 6).map((client) => {
              const norm = normalizeClientName(client.name);
              const quotesForClient = clientQuotesMap.get(norm) || [];
              const isExpanded = expandedOverviewClientId === client.id;

              return (
                <div
                  key={client.id}
                  className="bg-[#111c2e] border border-[#334d6e] hover:border-[#38bdf8]/60 rounded-xl p-3.5 transition flex flex-col justify-between shadow-sm space-y-2.5"
                >
                  <div className="space-y-1.5">
                    {/* Header: Name + Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-black text-white leading-tight uppercase line-clamp-2">
                        {client.name}
                      </h4>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0 ${
                          quotesForClient.length > 0
                            ? 'bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {quotesForClient.length} {quotesForClient.length === 1 ? 'Cotización' : 'Cotizaciones'}
                      </span>
                    </div>

                    {/* Metadata: NIT and Location */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                      {client.nit && (
                        <span className="font-mono bg-[#192b45] text-slate-300 px-1.5 py-0.2 rounded border border-[#334d6e]">
                          NIT: {client.nit}
                        </span>
                      )}
                      {client.department && (
                        <span className="text-[#38bdf8] bg-[#38bdf8]/10 px-1.5 py-0.2 rounded border border-[#38bdf8]/20 font-medium flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5" />
                          {client.city ? `${client.city}, ${client.department}` : client.department}
                        </span>
                      )}
                    </div>

                    {/* Contact row */}
                    {client.contactPerson && (
                      <p className="text-[11px] text-slate-400 truncate">
                        <strong className="text-slate-300">Contacto:</strong> {client.contactPerson}
                      </p>
                    )}
                  </div>

                  {/* Quotes List / Expandable Accordion */}
                  <div className="pt-2 border-t border-[#334d6e]/70 space-y-2">
                    <button
                      type="button"
                      onClick={() => setExpandedOverviewClientId(isExpanded ? null : client.id)}
                      className="w-full flex items-center justify-between text-[11px] font-bold text-slate-300 hover:text-white py-1 transition cursor-pointer"
                    >
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3 text-[#38bdf8]" />
                        <span>
                          {quotesForClient.length > 0
                            ? `Ver ${quotesForClient.length} cotización(es) asociadas`
                            : 'Sin cotizaciones emitidas aún'}
                        </span>
                      </span>
                      {quotesForClient.length > 0 &&
                        (isExpanded ? (
                          <ChevronUp className="w-3 h-3 text-[#38bdf8]" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-[#38bdf8]" />
                        ))}
                    </button>

                    {/* Expanded details */}
                    {isExpanded && quotesForClient.length > 0 && (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto bg-[#0d1624] p-2 rounded-lg border border-[#334d6e] animate-fadeIn scrollbar-thin">
                        {quotesForClient.map((q) => (
                          <div
                            key={q.id}
                            className="bg-[#15253d] border border-[#334d6e] p-2 rounded-md space-y-1 text-[10.5px]"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-[#38bdf8]">{q.quoteNumber}</span>
                              <span className="text-slate-400 flex items-center gap-1">
                                <Calendar className="w-2.5 h-2.5" /> {q.date}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-300">
                                {q.items?.length || 0} equipos cotizados
                              </span>
                              <span className="font-bold text-emerald-400">
                                ${(q.total || 0).toLocaleString('es-CO')} COP
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                onLoadQuoteIntoEditor?.(q);
                                onNavigate('ventas');
                              }}
                              className="w-full mt-1 py-0.5 bg-[#192b45] hover:bg-[#253e60] text-[#38bdf8] font-bold rounded text-[10px] border border-[#334d6e] flex items-center justify-center gap-1 transition cursor-pointer"
                            >
                              <span>Cargar / Ver Cotización</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredClients.length > 6 && (
          <div className="pt-2 text-center">
            <button
              onClick={() => setIsFullDirectoryModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#38bdf8] hover:text-white bg-[#111c2e] hover:bg-[#192b45] border border-[#334d6e] px-4 py-2 rounded-xl transition cursor-pointer"
            >
              <span>Ver todos los {allClients.length} clientes en el directorio completo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 3. MAIN WINDOW LAUNCHER (6 Direct Navigation Hub Cards) */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#38bdf8]" />
              <span>Accesos Directos a las Ventanas del Sistema</span>
            </h2>
            <p className="text-xs text-slate-400">
              Haga clic en cualquiera de las opciones para ir directamente a la ventana correspondiente.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {windowsList.map((win) => {
            const Icon = win.icon;
            return (
              <div
                key={win.id}
                id={`launch-card-${win.id}`}
                onClick={() => onNavigate(win.id)}
                className={`bg-[#18263a] border ${win.borderColor} ${win.hoverBorder} rounded-2xl p-5 shadow-lg flex flex-col justify-between cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl group`}
              >
                <div>
                  {/* Top Bar with Icon & Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 rounded-xl ${win.bgColor} ${win.accentColor} flex items-center justify-center font-bold group-hover:scale-110 transition`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <span className={`text-[10.5px] font-extrabold uppercase px-2 py-0.5 rounded-full ${win.bgColor} ${win.accentColor} border ${win.borderColor}`}>
                          {win.badge}
                        </span>
                        <h3 className="text-sm font-bold text-white mt-1 group-hover:text-[#38bdf8] transition">
                          {win.title}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    {win.description}
                  </p>

                  {/* Stat pills (read-only) */}
                  <div className="bg-[#111c2e] rounded-xl p-3 border border-[#334d6e]/50 space-y-1.5 text-xs mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">{win.statLabel}:</span>
                      <strong className="text-slate-200">{win.statValue}</strong>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-[#334d6e]/40">
                      <span className="text-slate-400 text-[11px]">{win.totalLabel}:</span>
                      <strong className={`${win.accentColor} font-bold text-[11px]`}>{win.totalValue}</strong>
                    </div>
                  </div>
                </div>

                {/* Direct Entry Button */}
                <div className="pt-3 border-t border-[#334d6e]/60 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium truncate max-w-[170px]" title={win.bestFor}>
                    {win.subtitle}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate(win.id);
                    }}
                    className={`inline-flex items-center gap-1.5 text-xs font-bold ${win.accentColor} group-hover:translate-x-1 transition cursor-pointer`}
                  >
                    <span>Entrar</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. QUICK ONBOARDING & SCENARIO GUIDE: "¿Qué deseas hacer hoy?" */}
      <div className="bg-[#152438] border border-[#334d6e] rounded-2xl p-5 sm:p-6 shadow-md">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Guía de Tareas Rápidas: ¿Qué deseas hacer hoy?
            </h2>
            <p className="text-xs text-slate-400">
              Seleccione su objetivo actual para ser dirigido a la ventana adecuada con un solo clic.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
          {quickScenarios.map((sc, idx) => {
            const Icon = sc.icon;
            return (
              <div
                key={idx}
                onClick={() => onNavigate(sc.targetTab)}
                className={`p-3.5 rounded-xl border ${sc.colorBg} flex flex-col justify-between transition cursor-pointer shadow-sm group`}
              >
                <div>
                  <div className="flex items-start gap-2.5 mb-2">
                    <Icon className={`w-4 h-4 ${sc.colorText} shrink-0 mt-0.5`} />
                    <h4 className="text-xs font-bold text-white leading-snug">
                      {sc.title}
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                    {sc.stepSummary}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#334d6e]/40">
                  <span className={`text-xs font-bold ${sc.colorText} inline-flex items-center gap-1 group-hover:underline`}>
                    {sc.actionText}
                  </span>
                  <ChevronRight className={`w-3.5 h-3.5 ${sc.colorText} group-hover:translate-x-1 transition`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. WORKFLOW EXPLAINER (Flujo Recomendado de Trabajo en 4 Pasos) */}
      <div className="bg-[#18263a] border border-[#334d6e] rounded-2xl p-5 sm:p-6 shadow-md">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-sky-500/15 text-[#38bdf8]">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Flujo de Trabajo Recomendado (Paso a Paso)
            </h2>
            <p className="text-xs text-slate-400">
              Guía secuencial sugerida para preparar propuestas y ofertas técnicas sin errores.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative">
          {/* Step 1 */}
          <div
            onClick={() => onNavigate('catalogo')}
            className="bg-[#111c2e] border border-[#334d6e] hover:border-blue-400 p-4 rounded-xl transition cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 text-xs font-black flex items-center justify-center">
                1
              </span>
              <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded-full">
                Catálogo
              </span>
            </div>
            <h3 className="text-xs font-bold text-white mb-1 group-hover:text-blue-300 transition">
              Explorar Catálogo
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Busca los equipos médicos necesarios por marca o especialidad y envíalos a Costos o Licitaciones.
            </p>
          </div>

          {/* Step 2 */}
          <div
            onClick={() => onNavigate('costos')}
            className="bg-[#111c2e] border border-[#334d6e] hover:border-amber-400 p-4 rounded-xl transition cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-black flex items-center justify-center">
                2
              </span>
              <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full">
                Ventana 2
              </span>
            </div>
            <h3 className="text-xs font-bold text-white mb-1 group-hover:text-amber-300 transition">
              Liquidar Costos &amp; Margen
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Ajusta accesorios y elige la lista de precios (L1–L8 o factor libre) para determinar el precio de venta.
            </p>
          </div>

          {/* Step 3 */}
          <div
            onClick={() => onNavigate('ventas')}
            className="bg-[#111c2e] border border-[#334d6e] hover:border-sky-400 p-4 rounded-xl transition cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/40 text-[#38bdf8] text-xs font-black flex items-center justify-center">
                3
              </span>
              <span className="text-[10px] text-sky-400 font-bold bg-sky-500/10 px-2 py-0.5 rounded-full">
                Ventana 1 / 4
              </span>
            </div>
            <h3 className="text-xs font-bold text-white mb-1 group-hover:text-sky-300 transition">
              Elaborar Propuesta
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Completa los datos del cliente, verifica las 3 hojas oficiales membretadas o el pliego de licitación.
            </p>
          </div>

          {/* Step 4 */}
          <div
            onClick={() => onNavigate('ventas')}
            className="bg-[#111c2e] border border-[#334d6e] hover:border-emerald-400 p-4 rounded-xl transition cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-black flex items-center justify-center">
                4
              </span>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Word / Excel
              </span>
            </div>
            <h3 className="text-xs font-bold text-white mb-1 group-hover:text-emerald-300 transition">
              Exportar &amp; Guardar
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Descarga la cotización formal en Word (.doc) y guárdala en el historial para control y seguimiento.
            </p>
          </div>
        </div>
      </div>

      {/* 5. INTERACTIVE KNOWLEDGE BASE / WINDOW DETAIL TABS */}
      <div className="bg-[#18263a] border border-[#334d6e] rounded-2xl p-5 sm:p-6 shadow-md">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Guía Detallada de Cada Ventana
            </h2>
            <p className="text-xs text-slate-400">
              Seleccione una ventana para ver su funcionamiento paso a paso y mejores prácticas.
            </p>
          </div>
        </div>

        {/* Tab buttons */}
        <div className="flex flex-wrap gap-2 pb-3 border-b border-[#334d6e]">
          {[
            { id: 'ventas' as ActiveTab, label: 'Ventana 1: Cotizaciones', icon: ShoppingCart },
            { id: 'costos' as ActiveTab, label: 'Ventana 2: Costos', icon: PenLine },
            { id: 'catalogo' as ActiveTab, label: 'Ventana 3: Catálogo', icon: BookOpen },
            { id: 'licitaciones' as ActiveTab, label: 'Ventana 4: Licitaciones y Contratos', icon: FileSpreadsheet },
            { id: 'seguimiento_oc' as ActiveTab, label: 'Ventana 5: Seguimiento OC', icon: Truck },
            { id: 'documentacion' as ActiveTab, label: 'Ventana 6: Documentación', icon: FolderArchive },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = selectedGuideTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedGuideTab(tab.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-[#38bdf8] text-slate-950 shadow-md'
                    : 'bg-[#111c2e] text-slate-300 hover:bg-[#1f324d] hover:text-white border border-[#334d6e]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Display */}
        <div className="mt-4 bg-[#111c2e] border border-[#334d6e]/70 rounded-xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#334d6e]/50 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-sky-500/15 text-[#38bdf8]">
                <GuideIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{currentGuide.title}</h3>
                <p className="text-xs text-slate-400">{currentGuide.subtitle}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate(selectedGuideTab)}
              className="inline-flex items-center justify-center gap-1.5 bg-[#38bdf8] hover:bg-[#0284c7] text-slate-950 font-bold text-xs px-4 py-2 rounded-xl shadow transition cursor-pointer shrink-0"
            >
              <span>Abrir esta Ventana</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Steps Column */}
            <div className="lg:col-span-2 space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Instrucciones y Funcionamiento:</span>
              </h4>
              <div className="space-y-2">
                {currentGuide.steps.map((st, i) => (
                  <div key={i} className="flex items-start gap-2 bg-[#15253d] p-2.5 rounded-lg border border-[#334d6e]/40 text-xs text-slate-300">
                    <span className="text-[#38bdf8] font-bold shrink-0">•</span>
                    <span className="leading-relaxed">{st}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tips Column */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Consejos Útiles:</span>
              </h4>
              <div className="space-y-2">
                {currentGuide.tips.map((tip, i) => (
                  <div key={i} className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-xs text-amber-200 leading-relaxed">
                    {tip}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FULL CLIENT DIRECTORY MODAL */}
      {isFullDirectoryModalOpen && (
        <ClientDirectoryModal
          isOpen={isFullDirectoryModalOpen}
          onClose={() => setIsFullDirectoryModalOpen(false)}
          savedQuotes={activeSavedQuotes}
          tenderClients={tenderClients}
          ocContracts={ocContracts}
          onViewQuote={(quote) => {
            onLoadQuoteIntoEditor?.(quote);
            onNavigate('ventas');
          }}
        />
      )}
    </div>
  );
};
