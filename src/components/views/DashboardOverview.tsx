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
      color: 'var(--syd-accent)',
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
      color: 'var(--syd-accent)',
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
      badge: 'Ventana 7',
      title: 'Documentación Técnica & Gestión Biomédica',
      subtitle: 'Fichas técnicas, Hojas de Vida (Res. 3100) y Cronograma de Mantenimiento',
      icon: FolderArchive,
      color: '#34d399',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      hoverBorder: 'hover:border-emerald-400',
      accentColor: 'text-emerald-400',
      statLabel: 'Documentos custodiados',
      statValue: `${documents.length} archivos`,
      totalLabel: 'Herramientas oficiales',
      totalValue: `Hojas de Vida • Cronograma • Fichas PDF`,
      description:
        'Cree y gestione Hojas de Vida de equipos según Resolución 3100, programe el Cronograma Anual de Mantenimiento y genere Fichas Técnicas Oficiales en PDF.',
      bestFor: 'Gestión técnica biomédica, habilitación hospitalaria y consulta de documentos oficiales.',
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
    ordenes_venta: {
      title: 'Ventana 6: Órdenes de Venta y Facturación (OV & Facturas)',
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
        'Los seriales se vinculan automáticamente al expediente del contrato.',
      ],
    },
    documentacion: {
      title: 'Ventana 7: Documentación Técnica, Hojas de Vida & Mantenimiento',
      subtitle: 'Hojas de Vida Res. 3100, Cronograma Anual, Fichas Técnicas PDF e INVIMA',
      icon: FolderArchive,
      steps: [
        '1. Hojas de Vida de Equipos: Genera y custodia expedientes de equipos según estándar Resolución 3100 MinSalud para habilitación hospitalaria.',
        '2. Cronograma de Mantenimiento: Controla matriz mensual de intervenciones preventivas (P), ejecutadas (E), calibraciones metrológicas (C) y alertas (A).',
        '3. Fichas Técnicas Oficiales: Diseña y exporta fichas técnicas en formato PDF con especificaciones y logo institucional.',
        '4. Base Maestra y Contratos: Administra el archivo digital de registros INVIMA, manuales de usuario y protocolos de desinfección.',
      ],
      tips: [
        'Las Hojas de Vida y el Cronograma pueden imprimirse o guardarse directamente en PDF de alta resolución.',
        'Desde el Catálogo Maestro puedes generar la Ficha Técnica o la Hoja de Vida de cualquier equipo con un solo clic.',
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

  const userName = currentUser?.name || currentUser?.username || 'Usuario';
  const userInitial = (userName.trim().charAt(0) || 'U').toUpperCase();
  const roleLabel =
    currentUser?.role === 'admin' ? 'Administrador' : currentUser?.roleLabel || 'Usuario del sistema';

  const heroStats = [
    {
      label: 'Cliente en cotizador',
      value: quoteHeader.clientName || 'Sin asignar',
      hint: 'Destinatario actual',
      icon: Building2,
      accent: 'var(--syd-accent)',
    },
    {
      label: 'Cotización activa',
      value: quoteHeader.quoteNumber,
      hint: 'Documento en curso',
      icon: FileText,
      accent: '#818cf8',
    },
    {
      label: 'Equipos en catálogo',
      value: `${equipments.length} modelos`,
      hint: 'Base maestra',
      icon: Database,
      accent: '#22d3ee',
    },
    {
      label: 'Documentos técnicos',
      value: `${documents.length} archivos`,
      hint: 'En custodia',
      icon: FileCheck2,
      accent: '#34d399',
    },
  ];

  const flowSteps = [
    {
      n: 1,
      tab: 'catalogo' as ActiveTab,
      label: 'Catálogo',
      title: 'Elige los equipos',
      text: 'Busca por marca, modelo o registro INVIMA y envíalos a Costos o Licitaciones.',
      accent: '#60a5fa',
      icon: BookOpen,
    },
    {
      n: 2,
      tab: 'costos' as ActiveTab,
      label: 'Ventana 2',
      title: 'Calcula el precio',
      text: 'Ajusta accesorios y define la lista de margen (L1–L8 o factor libre).',
      accent: '#fbbf24',
      icon: PenLine,
    },
    {
      n: 3,
      tab: 'ventas' as ActiveTab,
      label: 'Ventana 1 / 4',
      title: 'Arma la propuesta',
      text: 'Completa el cliente y revisa las hojas membretadas o el pliego técnico.',
      accent: 'var(--syd-accent)',
      icon: FileSpreadsheet,
    },
    {
      n: 4,
      tab: 'ventas' as ActiveTab,
      label: 'Word / Excel',
      title: 'Exporta y guarda',
      text: 'Descarga el documento formal y guárdalo en el historial de cotizaciones.',
      accent: '#34d399',
      icon: PackageCheck,
    },
  ];

  return (
    <div id="dashboard-overview" className="space-y-6 animate-fadeIn w-full pb-10">
      {/* ===================================================================== */}
      {/* 1. HERO — identidad, sesión y estado del sistema                      */}
      {/* ===================================================================== */}
      <section className="sys-hero relative overflow-hidden rounded-[28px] border border-[var(--syd-border-color)] shadow-2xl">
        <div className="relative p-5 sm:p-7 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            <div className="min-w-0">
              <span className="sys-chip">
                <Building2 className="w-3.5 h-3.5" />
                Portal corporativo · SYD Colombia
              </span>

              <h1 className="mt-3 text-2xl sm:text-[2rem] leading-tight font-black tracking-tight text-white">
                Hola, <span className="sys-gradient-text">{userName}</span>
              </h1>

              <p className="mt-2 text-xs sm:text-sm text-slate-300/90 max-w-2xl leading-relaxed">
                Este es el centro de mando de tu operación. Elige una ventana para cotizar, calcular
                costos, preparar licitaciones o custodiar la documentación técnica.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="sys-chip sys-chip-muted">
                  <Activity className="w-3 h-3" />
                  Sistema operativo
                </span>
                <span className="sys-chip sys-chip-muted">
                  <ShieldCheck className="w-3 h-3" />
                  Acceso verificado
                </span>
              </div>
            </div>

            {/* Tarjeta de sesión */}
            <div className="sys-session">
              <div className="w-11 h-11 shrink-0 rounded-2xl bg-[var(--syd-accent)] text-slate-950 font-black text-lg flex items-center justify-center shadow-sm">
                {userInitial}
              </div>
              <div className="min-w-0">
                <p className="text-[9.5px] uppercase tracking-[0.18em] text-slate-400 font-bold">
                  Sesión activa
                </p>
                <p className="text-sm font-bold text-white truncate" title={userName}>
                  {userName}
                </p>
                <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {roleLabel}
                </p>
              </div>
            </div>
          </div>

          {/* Estado del sistema */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {heroStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="sys-kpi"
                  style={{ '--accent': stat.accent } as React.CSSProperties}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block text-[10px] uppercase tracking-[0.14em] font-bold text-slate-400">
                        {stat.label}
                      </span>
                      <strong
                        className="block text-[13px] font-black text-white truncate mt-1"
                        title={String(stat.value)}
                      >
                        {stat.value}
                      </strong>
                      <span className="block text-[10px] text-slate-500 mt-0.5">{stat.hint}</span>
                    </div>
                    <span className="sys-ico-sm">
                      <Icon className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Enlace público */}
          <div className="sys-link-row">
            <div className="flex items-center gap-3 min-w-0">
              <span className="sys-ico-sm text-sky-400">
                <Globe className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-white uppercase tracking-wide">
                    Enlace público del portal
                  </span>
                  <span className="text-[9.5px] bg-emerald-500/15 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Acceso abierto
                  </span>
                </div>
                <p
                  className="text-[11px] text-cyan-300 font-mono truncate mt-0.5 font-semibold"
                  title={currentWebUrl}
                >
                  {currentWebUrl}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
              <button
                type="button"
                onClick={handleCopyCurrentWebUrl}
                className={`flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                  copiedLink
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                    : 'bg-white/10 hover:bg-white/15 text-white border border-white/15'
                }`}
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Enlace copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar enlace</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleOpenInNewTab}
                title="Abrir el portal en una nueva pestaña"
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 border border-sky-400/30 transition cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Guía global de flujo */}
      <WorkflowPipelineGuide currentTab="inicio" onNavigateToTab={onNavigate} />

      {/* ===================================================================== */}
      {/* 2. VENTANAS DEL SISTEMA — navegación principal                        */}
      {/* ===================================================================== */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 px-1">
          <div>
            <div className="flex items-center gap-2">
              <span className="sys-ico-sm text-sky-400">
                <Layers className="w-4 h-4" />
              </span>
              <h2 className="text-base font-black text-white tracking-tight">
                Ventanas del sistema
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Seis módulos conectados. Elige por dónde empezar hoy.
            </p>
          </div>
          <span className="text-[10.5px] text-slate-400 bg-white/5 border border-white/10 rounded-full px-3 py-1 font-semibold self-start sm:self-auto">
            5 módulos + catálogo maestro
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {windowsList.map((win) => {
            const Icon = win.icon;
            return (
              <div
                key={win.id}
                id={`launch-card-${win.id}`}
                onClick={() => onNavigate(win.id)}
                style={{ '--accent': win.color } as React.CSSProperties}
                className="sys-tile group relative overflow-hidden rounded-2xl p-5 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="sys-ico">
                        <Icon className="w-[22px] h-[22px]" />
                      </span>
                      <div className="min-w-0">
                        <span className="sys-badge">{win.badge}</span>
                        <h3 className="text-[13.5px] font-bold text-white mt-1 leading-snug">
                          {win.title}
                        </h3>
                      </div>
                    </div>
                    <span className="sys-arrow">
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>

                  <p className="text-[11.5px] text-slate-300/90 leading-relaxed mb-3.5">
                    {win.description}
                  </p>

                  <div className="sys-tile-stats">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10.5px] text-slate-400">{win.statLabel}</span>
                      <strong className="text-[11.5px] text-slate-100 text-right">
                        {win.statValue}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1.5 mt-1.5 border-t border-white/10">
                      <span className="text-[10.5px] text-slate-400">{win.totalLabel}</span>
                      <strong className="text-[11px] font-bold text-right" style={{ color: win.color }}>
                        {win.totalValue}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-1 border-t border-white/10 flex items-center justify-between gap-2">
                  <span
                    className="text-[10.5px] text-slate-400 truncate"
                    title={win.bestFor}
                  >
                    {win.subtitle}
                  </span>
                  <span className="text-[11px] font-bold sys-enter">
                    Entrar
                    <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 3. DIRECTORIO DE CLIENTES Y COTIZACIONES                              */}
      {/* ===================================================================== */}
      <section className="sys-panel p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="sys-ico text-sky-400">
              <Users className="w-[22px] h-[22px]" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-white tracking-tight">
                  Clientes y cotizaciones
                </h2>
                <span className="sys-badge">{allClients.length} clientes</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Consulta cuántas propuestas se han emitido y a qué número, fecha y valor corresponden.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              onClick={() => setIsFullDirectoryModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/15 text-white font-bold text-xs px-3.5 py-2 rounded-xl border border-white/15 transition cursor-pointer flex-1 sm:flex-initial"
            >
              <Users className="w-4 h-4" />
              <span>Directorio</span>
            </button>
            <button
              onClick={() => onNavigate('ventas')}
              className="inline-flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-lg shadow-emerald-500/20 cursor-pointer flex-1 sm:flex-initial"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva cotización</span>
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="sys-kpi" style={{ '--accent': 'var(--syd-accent)' } as React.CSSProperties}>
            <span className="block text-[10px] uppercase tracking-[0.14em] font-bold text-slate-400">
              Clientes totales
            </span>
            <span className="block text-xl font-black text-white mt-1">{allClients.length}</span>
          </div>
          <div className="sys-kpi" style={{ '--accent': '#818cf8' } as React.CSSProperties}>
            <span className="block text-[10px] uppercase tracking-[0.14em] font-bold text-slate-400">
              Con cotizaciones
            </span>
            <span className="block text-xl font-black text-indigo-300 mt-1">
              {clientsWithQuotesCount}
            </span>
          </div>
          <div className="sys-kpi" style={{ '--accent': '#34d399' } as React.CSSProperties}>
            <span className="block text-[10px] uppercase tracking-[0.14em] font-bold text-slate-400">
              Cotizaciones emitidas
            </span>
            <span className="block text-xl font-black text-emerald-300 mt-1">
              {activeSavedQuotes.length}
            </span>
          </div>
          <div className="sys-kpi" style={{ '--accent': '#fbbf24' } as React.CSSProperties}>
            <span className="block text-[10px] uppercase tracking-[0.14em] font-bold text-slate-400">
              Total cotizado
            </span>
            <span className="block text-[13px] font-black text-amber-200 mt-1.5 truncate">
              ${formatCOP(totalQuotedValue)} COP
            </span>
          </div>
        </div>

        {/* Buscador y filtro */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre, NIT, municipio o contacto..."
              value={clientSearchTerm}
              onChange={(e) => setClientSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400/70 focus:bg-white/[0.07] transition"
            />
          </div>
          <select
            value={clientDeptFilter}
            onChange={(e) => setClientDeptFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-400/70 transition"
          >
            <option value="all">Todos los departamentos</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Listado */}
        {filteredClients.length === 0 ? (
          <div className="p-10 text-center bg-white/[0.03] rounded-2xl border border-dashed border-white/10 space-y-2">
            <Users className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs font-bold text-slate-300">No se encontraron clientes</p>
            <p className="text-[11px] text-slate-500">
              {clientSearchTerm
                ? `Ningún cliente coincide con "${clientSearchTerm}".`
                : 'Aún no hay clientes registrados en el sistema.'}
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
                  className="sys-client-card"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-[12px] font-black text-white leading-tight uppercase line-clamp-2">
                        {client.name}
                      </h4>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0 border ${
                          quotesForClient.length > 0
                            ? 'bg-sky-500/15 text-sky-300 border-sky-400/30'
                            : 'bg-white/5 text-slate-400 border-white/10'
                        }`}
                      >
                        {quotesForClient.length}{' '}
                        {quotesForClient.length === 1 ? 'cotización' : 'cotizaciones'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                      {client.nit && (
                        <span className="font-mono bg-white/5 text-slate-300 px-1.5 py-0.5 rounded border border-white/10">
                          NIT {client.nit}
                        </span>
                      )}
                      {client.department && (
                        <span className="text-sky-300 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-400/20 font-medium flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5" />
                          {client.city ? `${client.city}, ${client.department}` : client.department}
                        </span>
                      )}
                    </div>

                    {client.contactPerson && (
                      <p className="text-[11px] text-slate-400 truncate">
                        <strong className="text-slate-300">Contacto:</strong> {client.contactPerson}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 mt-2 border-t border-white/10 space-y-2">
                    <button
                      type="button"
                      onClick={() => setExpandedOverviewClientId(isExpanded ? null : client.id)}
                      className="w-full flex items-center justify-between text-[11px] font-bold text-slate-300 hover:text-white py-1 transition cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3 h-3 text-sky-400" />
                        <span>
                          {quotesForClient.length > 0
                            ? `${quotesForClient.length} propuesta(s) asociada(s)`
                            : 'Sin cotizaciones emitidas'}
                        </span>
                      </span>
                      {quotesForClient.length > 0 &&
                        (isExpanded ? (
                          <ChevronUp className="w-3 h-3 text-sky-400" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-sky-400" />
                        ))}
                    </button>

                    {isExpanded && quotesForClient.length > 0 && (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto sys-scroll bg-[#0b1626] p-2 rounded-xl border border-white/10 animate-fadeIn">
                        {quotesForClient.map((q) => (
                          <div
                            key={q.id}
                            className="bg-white/[0.04] border border-white/10 p-2 rounded-lg space-y-1 text-[10.5px]"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-sky-300">{q.quoteNumber}</span>
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
                              className="w-full mt-1 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 font-bold rounded-md text-[10px] border border-sky-400/25 flex items-center justify-center gap-1 transition cursor-pointer"
                            >
                              <span>Cargar en el editor</span>
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
          <div className="pt-1 text-center">
            <button
              onClick={() => setIsFullDirectoryModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl transition cursor-pointer"
            >
              <span>Ver los {allClients.length} clientes del directorio completo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* 4. TAREAS RÁPIDAS                                                     */}
      {/* ===================================================================== */}
      <section className="sys-panel p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="sys-ico text-amber-400">
            <Zap className="w-[22px] h-[22px]" />
          </span>
          <div>
            <h2 className="text-base font-black text-white tracking-tight">¿Qué necesitas hacer hoy?</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Elige tu objetivo y te llevamos directo al módulo correcto.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickScenarios.map((sc, idx) => {
            const Icon = sc.icon;
            return (
              <div
                key={idx}
                onClick={() => onNavigate(sc.targetTab)}
                className="sys-scenario group"
              >
                <div className="flex items-start gap-2.5 mb-2">
                  <span className={`sys-ico-sm shrink-0 ${sc.colorText}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <h4 className="text-[12px] font-bold text-white leading-snug">{sc.title}</h4>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">{sc.stepSummary}</p>

                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <span className={`text-[11px] font-bold ${sc.colorText}`}>{sc.actionText}</span>
                  <ChevronRight
                    className={`w-3.5 h-3.5 ${sc.colorText} transition-transform group-hover:translate-x-1`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 5. FLUJO RECOMENDADO EN 4 PASOS                                       */}
      {/* ===================================================================== */}
      <section className="sys-panel p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <span className="sys-ico text-sky-400">
            <Compass className="w-[22px] h-[22px]" />
          </span>
          <div>
            <h2 className="text-base font-black text-white tracking-tight">Flujo recomendado</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Cuatro pasos para preparar una propuesta sin errores.
            </p>
          </div>
        </div>

        <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {flowSteps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.n}
                onClick={() => onNavigate(step.tab)}
                style={{ '--accent': step.accent } as React.CSSProperties}
                className="sys-step group relative"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="sys-step-num">{step.n}</span>
                  <span className="sys-step-label">{step.label}</span>
                </div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className="w-4 h-4" style={{ color: step.accent }} />
                  <h3 className="text-[12.5px] font-bold text-white">{step.title}</h3>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{step.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 6. GUÍA DETALLADA POR VENTANA                                         */}
      {/* ===================================================================== */}
      <section className="sys-panel p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="sys-ico text-violet-400">
            <HelpCircle className="w-[22px] h-[22px]" />
          </span>
          <div>
            <h2 className="text-base font-black text-white tracking-tight">Guía de cada ventana</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Selecciona un módulo para ver su funcionamiento paso a paso y buenas prácticas.
            </p>
          </div>
        </div>

        <div className="flex gap-2 pb-4 overflow-x-auto sys-scroll">
          {[
            { id: 'ventas' as ActiveTab, label: 'Cotizaciones', icon: ShoppingCart },
            { id: 'costos' as ActiveTab, label: 'Costos', icon: PenLine },
            { id: 'catalogo' as ActiveTab, label: 'Catálogo', icon: BookOpen },
            { id: 'licitaciones' as ActiveTab, label: 'Licitaciones', icon: FileSpreadsheet },
            { id: 'seguimiento_oc' as ActiveTab, label: 'Seguimiento OC', icon: Truck },
            { id: 'ordenes_venta' as ActiveTab, label: 'Órdenes y facturas', icon: PackageCheck },
            { id: 'documentacion' as ActiveTab, label: 'Documentación', icon: FolderArchive },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = selectedGuideTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedGuideTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-[11.5px] font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer border ${
                  isActive
                    ? 'bg-sky-400 text-slate-950 border-sky-300 shadow-lg shadow-sky-500/25'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="sys-guide-body">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="sys-ico-sm text-sky-400">
                <GuideIcon className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white">{currentGuide.title}</h3>
                <p className="text-[11px] text-slate-400">{currentGuide.subtitle}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate(selectedGuideTab)}
              className="inline-flex items-center justify-center gap-1.5 bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl shadow-lg shadow-sky-500/20 transition cursor-pointer shrink-0"
            >
              <span>Abrir esta ventana</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-2.5">
              <h4 className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Instrucciones y funcionamiento</span>
              </h4>
              <div className="space-y-2">
                {currentGuide.steps.map((st, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 bg-white/[0.04] p-3 rounded-xl border border-white/10 text-[11.5px] text-slate-300 hover:border-sky-400/30 transition"
                  >
                    <span className="shrink-0 w-5 h-5 rounded-full bg-sky-500/15 text-sky-300 text-[10px] font-black flex items-center justify-center border border-sky-400/25">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{st}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              <h4 className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Consejos útiles</span>
              </h4>
              <div className="space-y-2">
                {currentGuide.tips.map((tip, i) => (
                  <div
                    key={i}
                    className="bg-amber-500/[0.08] border border-amber-400/20 p-3 rounded-xl text-[11.5px] text-amber-100/90 leading-relaxed"
                  >
                    {tip}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MODAL DIRECTORIO COMPLETO */}
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
