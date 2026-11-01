import { ActiveTab, BotActionOption, BotActionType } from '../types';
import { getStoredOCTrackingContracts } from './ocTrackingStorage';
import { getSavedQuotes } from './quoteStorage';
import { getStoredSalesOrders, getStoredSalesInvoices } from './salesOrdersStorage';

export interface DynamicSystemContext {
  activeTab: ActiveTab;
  userName: string;
  userRole: string;
  totalEquipments: number;
  totalQuotes: number;
  totalTenderClients: number;
  totalOCContracts: number;
  totalSalesOrders: number;
  totalSalesInvoices: number;
  totalSuppliers: number;
  totalDocuments: number;
  totalAlerts: number;
  liveTRM: number;
  recommendedTRM: number;
  installedModules: string[];
  recentUpdates: string[];
}

/**
 * Gather live dynamic application state from memory, localStorage, and services
 */
export function getLiveDynamicSystemContext(
  currentActiveTab: ActiveTab = 'inicio',
  user?: { name?: string; roleLabel?: string } | null,
  customStats?: {
    equipmentsCount?: number;
    quotesCount?: number;
    tenderClientsCount?: number;
    ocContractsCount?: number;
    salesOrdersCount?: number;
    salesInvoicesCount?: number;
    suppliersCount?: number;
    documentsCount?: number;
    alertsCount?: number;
  }
): DynamicSystemContext {
  let totalEquipments = customStats?.equipmentsCount ?? 0;
  if (!totalEquipments) {
    try {
      const storedEq = localStorage.getItem('syd_equipments_catalog');
      if (storedEq) totalEquipments = JSON.parse(storedEq).length;
    } catch {
      totalEquipments = 0;
    }
  }

  let totalQuotes = customStats?.quotesCount ?? 0;
  if (!totalQuotes) {
    try {
      totalQuotes = getSavedQuotes().length;
    } catch {
      totalQuotes = 0;
    }
  }

  let totalTenderClients = customStats?.tenderClientsCount ?? 0;
  if (!totalTenderClients) {
    try {
      const storedTenders = localStorage.getItem('syd_tender_clients_v2');
      if (storedTenders) totalTenderClients = JSON.parse(storedTenders).length;
    } catch {
      totalTenderClients = 0;
    }
  }

  let totalOCContracts = customStats?.ocContractsCount ?? 0;
  if (!totalOCContracts) {
    try {
      totalOCContracts = getStoredOCTrackingContracts().length;
    } catch {
      totalOCContracts = 0;
    }
  }

  let totalSalesOrders = customStats?.salesOrdersCount ?? 0;
  if (!totalSalesOrders) {
    try {
      totalSalesOrders = getStoredSalesOrders().length;
    } catch {
      totalSalesOrders = 0;
    }
  }

  let totalSalesInvoices = customStats?.salesInvoicesCount ?? 0;
  if (!totalSalesInvoices) {
    try {
      totalSalesInvoices = getStoredSalesInvoices().length;
    } catch {
      totalSalesInvoices = 0;
    }
  }

  let totalSuppliers = customStats?.suppliersCount ?? 0;
  if (!totalSuppliers) {
    try {
      const storedSuppliers = localStorage.getItem('syd_suppliers_directory_v1');
      if (storedSuppliers) totalSuppliers = JSON.parse(storedSuppliers).length;
      else totalSuppliers = 16;
    } catch {
      totalSuppliers = 16;
    }
  }

  let totalDocuments = customStats?.documentsCount ?? 0;
  if (!totalDocuments) {
    try {
      const storedDocs = localStorage.getItem('syd_technical_documents_v3');
      if (storedDocs) totalDocuments = JSON.parse(storedDocs).length;
    } catch {
      totalDocuments = 0;
    }
  }

  let totalAlerts = customStats?.alertsCount ?? 0;

  // Retrieve TRM
  let liveTRM = 4185;
  let recommendedTRM = 4400;
  try {
    const storedTrm = localStorage.getItem('syd_trm_data_v2');
    if (storedTrm) {
      const parsed = JSON.parse(storedTrm);
      if (parsed.rate) liveTRM = parsed.rate;
      if (parsed.analysis?.recommendedRoundRate) {
        recommendedTRM = parsed.analysis.recommendedRoundRate;
      } else {
        recommendedTRM = Math.ceil((liveTRM * 1.05) / 50) * 50;
      }
    }
  } catch {
    // defaults
  }

  const installedModules = [
    'Inicio (Dashboard General & TRM en Vivo)',
    'Ventas (Cotizador Comercial Oficial con PDF y Membrete)',
    'Historial (Gestión y Reutilización de Cotizaciones)',
    'Costos (Gestor de Costos, TRM en vivo cada 2h & Márgenes L1-L8)',
    'Catálogo (Catálogo Multimarca con IA & Registros Sanitarios INVIMA)',
    'Licitaciones (Proyectos Hospitalarios SECOP II & Optimizador de Rangos Holgados)',
    'Seguimiento OC (Trazabilidad Logística Internacional de 11 Estados, Seriales & Manifiestos DIAN)',
    'Órdenes de Venta (OV) & Facturación (Despachos, Remisiones de Entrega, Radicación & Cartera)',
    'Directorio de Proveedores y Fabricantes (Gestión con Marcas & Ficha Lateral)',
    'Base de Datos & Excel (Exportación/Restauración .xlsx Multi-hoja & Respaldos Automáticos)',
    'Consola Relacional & Analítica SQL (Consultas Interactivas protegidas por Clave de Administrador)',
    'Documentación (Repositorio Técnico, Manuales & Registros Sanitarios)',
    'Alertas Inteligentes (Widget Flotante de Notificaciones en Tiempo Real)',
    'Chat Dual (Mara IA Biomédica + Mensajería de Equipo SYD)',
    'Gestión de Usuarios & Seguridad RBAC (14 Permisos Granulares sin Bloqueos)',
    'Centro de Actualizaciones y Notificaciones en Tiempo Real',
    'Personalización de Identidad Visual & Membrete Corporativo',
    'Accesibilidad & Atajo Universal de Cierre con Tecla ESC en todos los modales',
  ];

  const recentUpdates = [
    'Gestor integral de Órdenes de Venta (OV) y Facturación con remisiones firmadas, actas y radicación de facturas.',
    'Vinculación automatizada de Órdenes de Compra (OC) por Contrato/OV en cajas delimitadas sin duplicados.',
    'Trazabilidad avanzada de seriales de activos, lotes y manifiestos de importación aduanera DIAN.',
    'Consola SQL Relacional interactiva protegida con contraseña de Administrador en el módulo de Base de Datos.',
    'Corrección de edición fluida de permisos de usuario sin reinicio a cuenta de administrador.',
    'Base de Datos Maestra con exportación e importación completa en formato Excel (.xlsx) y respaldos periódicos.',
    'Centro dinámico de avisos y actualizaciones automáticas del sistema con botón Aplicar y Actualizar.',
  ];

  return {
    activeTab: currentActiveTab,
    userName: user?.name || 'Usuario SYD',
    userRole: user?.roleLabel || 'Miembro del Equipo',
    totalEquipments,
    totalQuotes,
    totalTenderClients,
    totalOCContracts,
    totalSalesOrders,
    totalSalesInvoices,
    totalSuppliers,
    totalDocuments,
    totalAlerts,
    liveTRM,
    recommendedTRM,
    installedModules,
    recentUpdates,
  };
}

export function cleanBotReplyText(rawText: string): string {
  if (!rawText) return '';
  let text = rawText;

  // 1. Remove LaTeX block and inline math markers
  text = text.replace(/\$\$\s*\\text\{([^}]+)\}\s*=\s*\\frac\{([^}]+)\}\{([^}]+)\}\s*\$\$/g, '$1 = $2 / $3');
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_match, p1) => {
    return p1
      .replace(/\\text\{([^}]+)\}/g, '$1')
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 / $2')
      .replace(/\\times/g, ' × ')
      .replace(/\\circ/g, ' grados')
      .replace(/\\%/g, '%')
      .replace(/\\/g, '')
      .replace(/[{}]/g, '')
      .trim();
  });

  text = text.replace(/\$([^\$\n]+)\$/g, (_match, p1) => {
    return p1
      .replace(/\\text\{([^}]+)\}/g, '$1')
      .replace(/\\circ/g, ' grados')
      .replace(/\^\\circ/g, ' grados')
      .replace(/\^circ/g, ' grados')
      .replace(/\\times/g, ' × ')
      .replace(/\\%/g, '%')
      .replace(/\\_/g, '_')
      .replace(/\\/g, '')
      .replace(/[{}]/g, '')
      .trim();
  });

  // 2. Remove Markdown header hashes (#, ##, ###, ####, etc.)
  text = text.replace(/^#{1,6}\s+/gm, '');

  // 3. Remove bold / italic markdown asterisks
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*\n]+)\*/g, '$1');

  // 4. Convert bullet asterisks at line starts to clean bullet or dash
  text = text.replace(/^[\s]*\*\s+/gm, '• ');
  text = text.replace(/^[\s]*-\s+/gm, '• ');

  // 5. Remove any leftover isolated asterisks
  text = text.replace(/(?<=\s)\*(?=\s)/g, '×');
  text = text.replace(/\*/g, '');

  // 6. Clean up LaTeX artifacts and backslashes
  text = text.replace(/\\%/g, '%');
  text = text.replace(/\\circ/g, ' grados');
  text = text.replace(/\^circ/g, ' grados');
  text = text.replace(/\^o/g, ' grados');

  // 7. Remove markdown underscore formatting like __bold__ or _italic_
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/(^|\s)_([^_]+)_(\s|$)/g, '$1$2$3');

  // 8. Normalize spacing and linebreaks
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

function tryEvaluateMath(text: string): string | null {
  const clean = text
    .toLowerCase()
    .replace(/cuanto\s+es/gi, '')
    .replace(/cuánto\s+es/gi, '')
    .replace(/calcula/gi, '')
    .replace(/resultado\s+de/gi, '')
    .replace(/por/g, '*')
    .replace(/x/g, '*')
    .replace(/÷/g, '/')
    .replace(/[^\d\+\-\*\/\.\(\)\s]/g, '')
    .trim();

  if (!clean || !/[\d]/.test(clean) || !/[\+\-\*\/]/.test(clean)) return null;

  try {
    if (/^[\d\s\+\-\*\/\.\(\)]+$/.test(clean)) {
      // eslint-disable-next-line no-new-func
      const result = Function(`'use strict'; return (${clean})`)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        const formatted = Number.isInteger(result)
          ? result.toString()
          : result.toLocaleString('es-CO', { maximumFractionDigits: 4 });
        return `${clean.replace(/\*/g, ' × ')} es igual a ${formatted}. ¿En qué más te puedo ayudar?`;
      }
    }
  } catch (_) {}
  return null;
}

export interface TabNavigationTarget {
  tab: ActiveTab;
  tabNumber: string;
  name: string;
  description: string;
}

export function resolveNavigationIntent(query: string): TabNavigationTarget | null {
  const q = query.toLowerCase().replace(/[¡!¿?.,:;]/g, ' ').replace(/\s+/g, ' ').trim();

  // Ventana 7: Documentación
  if (
    q.includes('ventana 7') ||
    q.includes('pestaña 7') ||
    q.includes('modulo 7') ||
    q.includes('módulo 7') ||
    q.includes('seccion 7') ||
    q.includes('sección 7') ||
    q.includes('a la 7') ||
    q.includes('ir a 7') ||
    q.includes('documentacion') ||
    q.includes('documentación') ||
    q.includes('manuales') ||
    q.includes('fichas tecnicas') ||
    q.includes('fichas técnicas') ||
    q.includes('repositorio') ||
    q.includes('guías') ||
    q.includes('guias') ||
    q.includes('registros sanitarios') ||
    q.includes('invima') ||
    q.includes('módulo de documentación') ||
    q.includes('documentos técnicos')
  ) {
    return {
      tab: 'documentacion',
      tabNumber: '7',
      name: 'Documentación',
      description: 'Repositorio de manuales técnicos, guías y registros sanitarios INVIMA',
    };
  }

  // Ventana 6: Órdenes de Venta y Facturación
  if (
    q.includes('ventana 6') ||
    q.includes('pestaña 6') ||
    q.includes('modulo 6') ||
    q.includes('módulo 6') ||
    q.includes('seccion 6') ||
    q.includes('sección 6') ||
    q.includes('a la 6') ||
    q.includes('ir a 6') ||
    q.includes('ordenes de venta') ||
    q.includes('órdenes de venta') ||
    q.includes('orden de venta') ||
    q.includes('ov') ||
    q.includes('facturacion') ||
    q.includes('facturación') ||
    q.includes('remision') ||
    q.includes('remisión') ||
    q.includes('despacho') ||
    q.includes('radicacion') ||
    q.includes('radicación') ||
    q.includes('cartera') ||
    q.includes('módulo de órdenes de venta') ||
    q.includes('facturación y despacho')
  ) {
    return {
      tab: 'ordenes_venta',
      tabNumber: '6',
      name: 'Órdenes de Venta y Facturación',
      description: 'Despachos hospitalarios, remisiones firmadas, radicación de facturas y control de cartera',
    };
  }

  // Ventana 5.1: Conexión Gmail & OCs
  if (
    q.includes('5.1') ||
    q.includes('ventana 5.1') ||
    q.includes('pestaña 5.1') ||
    q.includes('gmail') ||
    q.includes('gmail compras') ||
    q.includes('correo compras') ||
    q.includes('bandeja gmail') ||
    q.includes('extraer oc')
  ) {
    return {
      tab: 'gmail_compras',
      tabNumber: '5.1',
      name: 'Conexión Gmail & OCs',
      description: 'Bandeja de extracción y lectura inteligente de órdenes de compra recibidas',
    };
  }

  // Ventana 5: Seguimiento de OC
  if (
    q.includes('ventana 5') ||
    q.includes('pestaña 5') ||
    q.includes('modulo 5') ||
    q.includes('módulo 5') ||
    q.includes('seccion 5') ||
    q.includes('sección 5') ||
    q.includes('a la 5') ||
    q.includes('ir a 5') ||
    q.includes('seguimiento oc') ||
    q.includes('seguimiento de oc') ||
    q.includes('trazabilidad oc') ||
    q.includes('órdenes de compra') ||
    q.includes('ordenes de compra') ||
    q.includes('seguimiento de compras')
  ) {
    return {
      tab: 'seguimiento_oc',
      tabNumber: '5',
      name: 'Seguimiento de OC',
      description: 'Trazabilidad de 11 estados logísticos, seriales, lotes y manifiestos aduaneros DIAN',
    };
  }

  // Ventana 4: Licitaciones y Contratos
  if (
    q.includes('ventana 4') ||
    q.includes('pestaña 4') ||
    q.includes('modulo 4') ||
    q.includes('módulo 4') ||
    q.includes('seccion 4') ||
    q.includes('sección 4') ||
    q.includes('a la 4') ||
    q.includes('ir a 4') ||
    q.includes('licitaciones') ||
    q.includes('contratos') ||
    q.includes('secop') ||
    q.includes('pliego') ||
    q.includes('módulo de licitaciones')
  ) {
    return {
      tab: 'licitaciones',
      tabNumber: '4',
      name: 'Licitaciones y Contratos',
      description: 'Proyectos hospitalarios SECOP II y análisis de pliegos técnicos',
    };
  }

  // Ventana 3: Creación Equipos / Catálogo
  if (
    q.includes('ventana 3') ||
    q.includes('pestaña 3') ||
    q.includes('modulo 3') ||
    q.includes('módulo 3') ||
    q.includes('seccion 3') ||
    q.includes('sección 3') ||
    q.includes('a la 3') ||
    q.includes('ir a 3') ||
    q.includes('creacion equipos') ||
    q.includes('creación equipos') ||
    q.includes('catalogo') ||
    q.includes('catálogo') ||
    q.includes('catálogo de equipos') ||
    q.includes('equipos biomédicos') ||
    q.includes('registro invima') ||
    q.includes('módulo de catálogo')
  ) {
    return {
      tab: 'catalogo',
      tabNumber: '3',
      name: 'Creación Equipos',
      description: 'Catálogo multimarca de equipos biomédicos y registros sanitarios INVIMA',
    };
  }

  // Ventana 2: Costos y Rentabilidad
  if (
    q.includes('ventana 2') ||
    q.includes('pestaña 2') ||
    q.includes('modulo 2') ||
    q.includes('módulo 2') ||
    q.includes('seccion 2') ||
    q.includes('sección 2') ||
    q.includes('a la 2') ||
    q.includes('ir a 2') ||
    q.includes('costos') ||
    q.includes('rentabilidad') ||
    q.includes('gestor de costos') ||
    q.includes('márgenes') ||
    q.includes('margenes') ||
    q.includes('módulo de costos')
  ) {
    return {
      tab: 'costos',
      tabNumber: '2',
      name: 'Costos y Rentabilidad',
      description: 'Gestor de costos base, TRM oficial cada 2 horas y márgenes de utilidad L1 a L8',
    };
  }

  // Ventana 1: Cotizaciones
  if (
    q.includes('ventana 1') ||
    q.includes('pestaña 1') ||
    q.includes('modulo 1') ||
    q.includes('módulo 1') ||
    q.includes('seccion 1') ||
    q.includes('sección 1') ||
    q.includes('a la 1') ||
    q.includes('ir a 1') ||
    q.includes('cotizaciones') ||
    q.includes('cotizador') ||
    q.includes('ventas') ||
    q.includes('cotizar') ||
    q.includes('propuesta comercial') ||
    q.includes('módulo de cotizaciones')
  ) {
    return {
      tab: 'ventas',
      tabNumber: '1',
      name: 'Cotizaciones',
      description: 'Cotizador comercial oficial, propuesta con membrete y descargas en Word o PDF',
    };
  }

  return null;
}

/**
 * Detecta si el usuario quiere ejecutar una acción autónoma (no solo navegar)
 */
export function resolveAutonomousAction(query: string, context: DynamicSystemContext): { label: string; type: BotActionType; tab?: ActiveTab; modalAction?: string; autoExecute: boolean; confirmationRequired: boolean; description: string } | null {
  const q = query.toLowerCase().replace(/[¡!¿?.,:;]/g, ' ').replace(/\s+/g, ' ').trim();

  // Acciones de creación de entidades (seguras, auto-ejecutables)
  if (q.includes('crea una cotización') || q.includes('crear cotización') || q.includes('nueva cotización') || q.includes('cotizar')) {
    return {
      label: 'Crear Nueva Cotización',
      type: 'execute',
      tab: 'ventas',
      autoExecute: true,
      confirmationRequired: false,
      description: 'Abre el cotizador y prepara una nueva cotización comercial',
    };
  }

  if (q.includes('registra un equipo') || q.includes('nuevo equipo') || q.includes('crear equipo') || q.includes('agregar equipo')) {
    return {
      label: 'Registrar Nuevo Equipo',
      type: 'modal',
      modalAction: 'new_equipment',
      autoExecute: true,
      confirmationRequired: false,
      description: 'Abre el modal para registrar un nuevo equipo biomédico en el catálogo',
    };
  }

  if (q.includes('nueva orden de compra') || q.includes('crea una oc') || q.includes('crear oc') || q.includes('nueva oc')) {
    return {
      label: 'Crear Nueva Orden de Compra',
      type: 'modal',
      modalAction: 'new_oc',
      autoExecute: true,
      confirmationRequired: false,
      description: 'Abre el modal para crear una nueva Orden de Compra (OC)',
    };
  }

  // Acciones críticas (requieren confirmación)
  if (q.includes('facturar') || q.includes('radicar factura') || q.includes('emitir factura')) {
    return {
      label: 'Ir a Órdenes de Venta y Facturar',
      type: 'navigate',
      tab: 'ordenes_venta',
      autoExecute: true,
      confirmationRequired: true,
      description: 'Navega a Órdenes de Venta para gestionar facturación y radicación',
    };
  }

  if (q.includes('eliminar') || q.includes('borrar') || q.includes('desactivar')) {
    return {
      label: 'Acción de Eliminación',
      type: 'execute',
      autoExecute: false,
      confirmationRequired: true,
      description: 'Requiere confirmación previa antes de ejecutar eliminación',
    };
  }

  return null;
}

/**
 * Intelligent Fallback & Rule-Based Mara Assistant Engine
 */
export function getIntelligentMaraFallbackReply(
  query: string,
  context: DynamicSystemContext
): { reply: string; actions: BotActionOption[] } {
  const q = query.toLowerCase().trim();
  const cleanQ = q.replace(/[¡!¿?.,:;]/g, '').trim();

  // -2. Navegación directa por número o nombre de ventana
  // PASO 0: Detección de acción autónoma (Mara puede ejecutar directamente)
  const autonomousAction = resolveAutonomousAction(query, context);
  if (autonomousAction) {
    const userFirst = context.userName ? context.userName.split(' ')[0] : '';
    const greeting = userFirst && userFirst !== 'Usuario' ? `Con gusto, ${userFirst}. ` : 'Con gusto. ';
    const confirmText = autonomousAction.confirmationRequired ? ' Esta acción requiere tu confirmación antes de ejecutarse.' : '';
    const actionText = autonomousAction.autoExecute ? 'Voy a ejecutar esta acción por ti.' : 'Puedo ayudarte con esto.';

    return {
      reply: cleanBotReplyText(`${greeting}${actionText}${confirmText} ${autonomousAction.description}. ¿En qué más te puedo colaborar hoy?`),
      actions: [
        {
          label: autonomousAction.label,
          type: autonomousAction.type,
          tab: autonomousAction.tab,
          modalAction: autonomousAction.modalAction,
          primary: true,
          autoExecute: autonomousAction.autoExecute,
          confirmationRequired: autonomousAction.confirmationRequired,
          description: autonomousAction.description,
        },
      ],
    };
  }

  const navTarget = resolveNavigationIntent(query);
  if (navTarget) {
    const userFirst = context.userName ? context.userName.split(' ')[0] : '';
    const greeting = userFirst && userFirst !== 'Usuario' ? `Con gusto, ${userFirst}. ` : 'Con gusto. ';
    return {
      reply: cleanBotReplyText(`${greeting}Te dirijo de inmediato a la Ventana ${navTarget.tabNumber}: ${navTarget.name}. ¿En qué más te puedo colaborar hoy?`),
      actions: [
        { label: `Ir a ${navTarget.name}`, type: 'navigate', tab: navTarget.tab, primary: true, autoExecute: true, description: `Navega a ${navTarget.name}` },
      ],
    };
  }

  // 0. Saludos cortos y consultas sencillas (Respuestas breves, cálidas y al grano)
  const shortGreetings = [
    'hola',
    'buenas',
    'buen dia',
    'buenos dias',
    'buenos días',
    'buenas tardes',
    'buenas noches',
    'que tal',
    'qué tal',
    'como estas',
    'cómo estás',
    'hey',
    'saludos',
    'hola mara',
    'hola buenas',
  ];
  if (shortGreetings.includes(cleanQ) || (cleanQ.startsWith('hola') && cleanQ.length <= 15)) {
    const firstName = context.userName ? context.userName.split(' ')[0] : '';
    const greetingName = firstName && firstName !== 'Usuario' ? ` ${firstName}` : '';
    return {
      reply: cleanBotReplyText(`¡Hola${greetingName}! Con mucho gusto te colaboro hoy. ¿En qué te puedo ayudar o qué necesitas realizar?`),
      actions: [
        { label: 'Ir al Cotizador', type: 'navigate', tab: 'ventas', primary: true },
        { label: 'Gestor de Costos', type: 'navigate', tab: 'costos' },
        { label: 'Órdenes de Venta (OV)', type: 'navigate', tab: 'ordenes_venta' },
      ],
    };
  }

  // 0.1 Cortesías y confirmaciones simples
  if (['gracias', 'muchas gracias', 'mil gracias', 'ok', 'vale', 'listo', 'entendido', 'perfecto'].includes(cleanQ)) {
    return {
      reply: cleanBotReplyText(`¡Con el mayor gusto! Aquí sigo a tu entera disposición. ¿Hay algo más en lo que te pueda colaborar?`),
      actions: [
        { label: 'Ir al Cotizador', type: 'navigate', tab: 'ventas', primary: true },
        { label: 'Gestor de Costos', type: 'navigate', tab: 'costos' },
      ],
    };
  }

  // -1. Matemáticas y Cálculos Directos
  const mathResult = tryEvaluateMath(query);
  if (mathResult) {
    return {
      reply: cleanBotReplyText(mathResult),
      actions: [
        { label: 'Ir al Gestor de Costos', type: 'navigate', tab: 'costos', primary: true },
        { label: 'Ir al Cotizador', type: 'navigate', tab: 'ventas' },
      ],
    };
  }

  // -0.5 Soluciones, Opiniones y Recomendaciones Estratégicas
  if (
    q.includes('que opinas') ||
    q.includes('qué opinas') ||
    q.includes('que piensas') ||
    q.includes('qué piensas') ||
    q.includes('que debo hacer') ||
    q.includes('qué debo hacer') ||
    q.includes('que me recomiendas') ||
    q.includes('qué me recomiendas') ||
    q.includes('que solucion') ||
    q.includes('qué solución') ||
    q.includes('consejo') ||
    q.includes('que hago') ||
    q.includes('qué hago')
  ) {
    return {
      reply: cleanBotReplyText(`Como tu copiloto experta, mi recomendación estratégica y técnica es la siguiente:

1. Diagnóstico y Prioridad: Evalúa primero el impacto comercial y operativo. Si es una cotización urgente, utiliza la opción "Cotizar Parte no creada" para no demorar la propuesta al cliente.
2. Trazabilidad y Control: Si se trata de compras o despacho, asegúrate de vincular los seriales, lotes y manifiestos DIAN en el módulo de Seguimiento de OC antes de emitir la remisión de entrega.
3. Protección del Margen: Para ofertas comerciales, utiliza listas de precios con margen mínimo del 25% (L2.5) o superior, considerando la TRM de seguridad recomendada ($${context.recommendedTRM.toLocaleString('es-CO')} COP).
4. Próximo Paso Sugerido: Te aconsejo formalizar el requerimiento en el módulo correspondiente para que quede respaldado en la base de datos de la empresa.

¿Deseas que te ayude a ejecutar alguno de estos pasos en este momento?`),
      actions: [
        { label: 'Ir a Cotizador', type: 'navigate', tab: 'ventas', primary: true },
        { label: 'Gestor de Costos', type: 'navigate', tab: 'costos' },
        { label: 'Órdenes de Venta (OV)', type: 'navigate', tab: 'ordenes_venta' },
      ],
    };
  }

  // 0. Cotizar Parte no creada (Requerimiento de Emergencia) & Empalme con Drive N-FCO-03
  if (q.includes('no cread') || q.includes('emergencia') || q.includes('pendiente por crear') || q.includes('cotizar parte')) {
    return {
      reply: `La función **"Cotizar Parte no creada"** te permite cotizar de urgencia cualquier equipo médico que aún no exista en el Catálogo Maestro:\n\n1. **Ingreso Rápido con 5 Datos**: En el **Gestor de Costos**, haz clic en el botón naranja **"Cotizar Parte no creada"**. Solo te solicitará:\n   • **Nombre del Equipo**\n   • **Marca**\n   • **Modelo**\n   • **Cantidad**\n   • **Precio Costo Base**\n2. **Cálculo Inmediato de Venta**: El precio de venta se calcula de forma automática con los factores L1–L8 y la TRM vigente.\n3. **Pestaña "Pendientes por Crear"**: El equipo cotizado se envía a la subpestaña especial en el **Catálogo de Equipos**, donde podrás:\n   • **Crear en Catálogo**: Completar los datos finales (código de parte, proveedor, INVIMA).\n   • **Enlazar con Drive**: Empalmar directamente con el formato oficial N-FCO-03 de Google Drive para adoptarlo sin digitar todo de nuevo.\n   • **Eliminar**: Descartar el requerimiento si ya no es necesario.`,
      actions: [
        { label: 'Ir al Gestor de Costos', type: 'navigate', tab: 'costos', primary: true },
        { label: 'Ver Catálogo de Equipos', type: 'navigate', tab: 'catalogo' },
        { label: 'Ir a Cotizador', type: 'navigate', tab: 'ventas' },
      ],
    };
  }

  // 0.1 Empalme con Google Drive (N-FCO-03) & Partes Inactivadas
  if (q.includes('empalmar') || q.includes('n-fco-03') || q.includes('enlazar con drive') || q.includes('reemplaz') || q.includes('inactiv')) {
    return {
      reply: `En la integración con **Google Drive & Formato N-FCO-03**:\n\n• **Empalmar con Drive**: Puedes asociar equipos cotizados de emergencia con las partes oficiales registradas en el libro N-FCO-03 de Google Drive. Al empalmar, la parte pasa automáticamente al Catálogo Maestro.\n• **Gestión de Partes Inactivadas**: Si una parte es dada de baja o reemplazada en la hoja de Drive (ej. 67292 reemplazada por 70999, o 63699 por 71003), el sistema te avisa y te permite actualizar el catálogo en 1 clic.\n• **Memoria Persistente de Resolución**: Una vez actualizadas o descartadas, el sistema guarda la confirmación de manera permanente para que no vuelva a pedirte la misma actualización cada vez que inicias sesión.`,
      actions: [
        { label: 'Abrir Google Workspace', type: 'modal', modalAction: 'google_workspace_modal', primary: true },
        { label: 'Ver Catálogo de Equipos', type: 'navigate', tab: 'catalogo' },
      ],
    };
  }

  // 0.2 Selección de Equipos por Orden de Venta (OV) en Licitaciones Adjudicadas
  if ((q.includes('orden de venta') || q.includes('ov')) && (q.includes('licitacion') || q.includes('contrato') || q.includes('seleccionar') || q.includes('particion') || q.includes('partición') || q.includes('despacho'))) {
    return {
      reply: `Para contratos de licitación adjudicados con múltiples entregas:\n\n1. **Selección Precisa de Equipos**: Al crear una **Nueva Orden de Venta (OV)** y elegir un Contrato Adjudicado, el sistema te permite seleccionar exactamente los equipos y cantidades que corresponden al lote o despacho que vas a realizar.\n2. **Exclusión Automática de Equipos ya Despachados**: Una vez generada la OV, los equipos y unidades ya vinculadas no volverán a aparecer para ese contrato al hacer otra OV subsecuente.\n3. **Trazabilidad de Entregas Parciales**: Puedes hacer tantas OVs como requiera el cronograma del hospital hasta completar la totalidad de equipos adjudicados.`,
      actions: [
        { label: 'Ir a Órdenes de Venta (OV)', type: 'navigate', tab: 'ordenes_venta', primary: true },
        { label: 'Ver Licitaciones', type: 'navigate', tab: 'licitaciones' },
        { label: 'Seguimiento de OC', type: 'navigate', tab: 'seguimiento_oc' },
      ],
    };
  }

  // 0.3 Buscador de Fotos e Imágenes Biomédicas de Alta Resolución
  if (q.includes('foto') || q.includes('imagen') || q.includes('fotografia') || q.includes('fotos') || q.includes('imagenes') || q.includes('alta resolucion') || q.includes('alta resolución')) {
    return {
      reply: `El sistema cuenta con un **Buscador Inteligente de Fotografías Biomédicas**:\n\n• **Búsqueda Automatizada**: Puedes buscar imágenes usando el **Nombre, Marca y Modelo** del equipo (ej: Mindray Digieye 350, Edan Sonotrax II Pro, David HKN-9010).\n• **Resolución Hospitalaria**: Prioriza imágenes de alta resolución sobre fondos limpios o fondo neutro hospitalario.\n• **Inclusión en Cotizaciones & Word/PDF**: Las imágenes se incorporan en la ficha visual de la oferta comercial y se optimizan en tamaño para no generar páginas en blanco innecesarias.`,
      actions: [
        { label: 'Ir al Cotizador', type: 'navigate', tab: 'ventas', primary: true },
        { label: 'Ver Catálogo', type: 'navigate', tab: 'catalogo' },
      ],
    };
  }

  // 1. Órdenes de Venta (OV) y Facturación
  if (q.includes('orden de venta') || q.includes('órdenes de venta') || q.includes('ov') || q.includes('factur') || q.includes('remision') || q.includes('remisión') || q.includes('despacho') || q.includes('radicacion') || q.includes('radicación') || q.includes('cartera')) {
    return {
      reply: `El módulo de **Órdenes de Venta (OV) & Facturación** te permite gestionar el ciclo comercial de despacho y cobro:\n\n1. **Generación de OV**: Puedes crear una Orden de Venta directamente desde una cotización aprobada o desde un contrato de licitación adjudicado.\n2. **Remisiones de Entrega**: Genera y registra remisiones de despacho formal con transportadora, número de guía, fecha y firmas de entrega al hospital.\n3. **Radicación de Facturas Electrónicas**: Registra el número de factura DIAN, fecha de expedición, radicación ante la IPS/Cliente y control de cartera (Pendiente, Parcial o Pagada).\n4. **Actas de Entrega**: Genera actas de recibido a satisfacción para soporte de cobro hospitalario.\n\nTienes **${context.totalSalesOrders} órdenes de venta** y **${context.totalSalesInvoices} facturas** registradas actualmente.`,
      actions: [
        { label: 'Ir a Órdenes de Venta (OV)', type: 'navigate', tab: 'ordenes_venta', primary: true },
        { label: 'Ver Historial de Cotizaciones', type: 'navigate', tab: 'historial' },
        { label: 'Seguimiento de OC', type: 'navigate', tab: 'seguimiento_oc' },
      ],
    };
  }

  // 2. Consola Relacional & Analítica SQL
  if (q.includes('sql') || q.includes('consola sql') || q.includes('query') || q.includes('base de datos relacional') || q.includes('consulta sql') || q.includes('analytics sql')) {
    return {
      reply: `La **Consola Relacional & Analítica SQL** permite a los usuarios administradores ejecutar consultas avanzadas sobre toda la información del sistema:\n\n• **Acceso Protegido**: Ubicada de forma discreta dentro del botón **"Base de Datos / Excel"** de la barra superior. Requiere autenticación con la contraseña de tu cuenta de Administrador.\n• **Tablas Disponibles**: Puedes consultar y cruzar datos de \`equipments\`, \`saved_quotes\`, \`tender_clients\`, \`oc_contracts\`, \`sales_orders\`, \`sales_invoices\` y más.\n• **Consultas Rápidas**: Incluye botones para consultas instantáneas como Catálogo de Equipos, Top Cotizaciones, Trazabilidad de OCs y Estado de Cartera.`,
      actions: [
        { label: 'Abrir Base de Datos & Excel', type: 'modal', modalAction: 'backup_modal', primary: true },
        { label: 'Ver Gestor de Costos', type: 'navigate', tab: 'costos' },
      ],
    };
  }

  // 3. Base de Datos Excel (.xlsx) y Copias de Seguridad
  if (q.includes('excel') || q.includes('backup') || q.includes('copia de seguridad') || q.includes('respaldo') || q.includes('descargar excel') || q.includes('exportar')) {
    return {
      reply: `En el centro de **Base de Datos & Excel** puedes administrar y proteger todos los datos de la empresa:\n\n• **Descarga en Excel (.xlsx)**: Genera un libro multi-hoja con pestañas dedicadas para Equipos, Cotizaciones, Licitaciones, OCs, Órdenes de Venta, Proveedores y Documentos.\n• **Restauración desde Excel**: Puedes cargar un archivo Excel para actualizar o restaurar datos maestros.\n• **Respaldos Periódicos**: Sincronización continua en Firestore y envío de respaldos por correo electrónico.\n• **Consola SQL**: Acceso integrado para analítica avanzada.`,
      actions: [
        { label: 'Abrir Base de Datos & Excel', type: 'modal', modalAction: 'backup_modal', primary: true },
        { label: 'Ir a Catálogo de Equipos', type: 'navigate', tab: 'catalogo' },
      ],
    };
  }

  // 4. Permisos de Usuario y Roles RBAC
  if (q.includes('permiso') || q.includes('rol') || q.includes('usuario') || q.includes('acceso') || q.includes('admin') || q.includes('solo lectura')) {
    return {
      reply: `En la **Gestión de Usuarios y Permisos RBAC** el Administrador puede configurar con precisión los accesos de cada colaborador:\n\n• **14 Permisos Granulares**: Edición de Ventas, Costos, Catálogo, Licitaciones, Seguimiento de OC, Documentos, Órdenes de Venta, Historial, Proveedores, Seriales, Marca, Exportación, Respaldos y Consola SQL.\n• **Edición Ágil y Consecutiva**: Puedes alternar múltiples permisos de seguido para cualquier usuario sin que el sistema reinicie la selección a la cuenta admin.\n• **Acciones Rápidas**: Botones para **"Habilitar Todos los Permisos"** o **"Solo Lectura Total"** con un solo clic.`,
      actions: [
        { label: 'Administrar Usuarios & Permisos', type: 'modal', modalAction: 'user_management', primary: true },
        { label: 'Ir a Inicio', type: 'navigate', tab: 'inicio' },
      ],
    };
  }

  // 5. Seriales, Lotes y Manifiestos de Importación DIAN
  if (q.includes('serial') || q.includes('lote') || q.includes('manifiesto') || q.includes('dian') || q.includes('importacion') || q.includes('importación') || q.includes('placa')) {
    return {
      reply: `Para la trazabilidad regulatoria de tecnología biomédica:\n\n• **Seriales Físicos y Lotes**: En el módulo de **Seguimiento de OC** y en **Órdenes de Venta**, puedes registrar el número de serie de cada dispositivo entregado o en aduana.\n• **Manifiestos DIAN**: Registra la declaración de importación aduanera y fecha de nacionalización para certificar la legalidad del equipo en territorio colombiano.\n• **Actas de Entrega**: Los seriales se imprimen automáticamente en las remisiones de entrega y actas hospitalarias.`,
      actions: [
        { label: 'Seguimiento de OC', type: 'navigate', tab: 'seguimiento_oc', primary: true },
        { label: 'Órdenes de Venta (OV)', type: 'navigate', tab: 'ordenes_venta' },
      ],
    };
  }

  // 6. Proveedores y Fabricantes
  if (q.includes('proveedor') || q.includes('fabricante') || q.includes('directorio') || q.includes('ficha')) {
    return {
      reply: `En el **Directorio de Proveedores y Fabricantes** (ubicado dentro del módulo de **Seguimiento de OC**) puedes gestionar todos tus aliados comerciales:\n\n1. **Visualizar la Lista**: Al entrar, verás la lista completa de proveedores a la izquierda sin formularios que tapen la vista.\n2. **Crear Nuevo Proveedor**: Haz clic en el botón superior **"Nuevo Proveedor"** y se abrirá el formulario a la derecha en paralelo.\n3. **Gestionar Fichas**: Al hacer clic en un proveedor de la lista se despliega su ficha de datos y marcas autorizadas. Puedes deseleccionarlo en cualquier momento pulsando el botón **"Quitar Ficha"** o haciendo clic de nuevo sobre él.\n\nActualmente tienes **${context.totalSuppliers} proveedores** registrados en la plataforma.`,
      actions: [
        { label: 'Ir a Seguimiento de OC', type: 'navigate', tab: 'seguimiento_oc', primary: true },
        { label: 'Abrir Directorio de Proveedores', type: 'modal', modalAction: 'manage_suppliers' },
        { label: 'Ver Gestor de Costos', type: 'navigate', tab: 'costos' },
      ],
    };
  }

  // 7. Seguimiento de Órdenes de Compra (OC) y Alertas 48h
  if (q.includes('oc') || q.includes('orden de compra') || q.includes('logística') || q.includes('logistica') || q.includes('48h') || q.includes('alerta') || q.includes('embarque') || q.includes('aduana')) {
    return {
      reply: `El módulo de **Seguimiento de Órdenes de Compra (OC)** te permite hacer trazabilidad completa desde la adjudicación o aprobación comercial hasta la entrega e instalación hospitalaria:\n\n• **11 Estados Logísticos**: Borrador, Emitida, Confirmada, En Fabricación, En Tránsito, En Aduana / Nacionalización, En Bodega SYD, Ingreso Técnico, Listo para Despacho, Despachado, Entregado e Instalado.\n• **Alertas de 48 Horas**: El sistema resalta automáticamente en color ámbar/rojo cualquier equipo que lleve más de 48 horas en un estado crítico (como aduana o listo en fábrica).\n• **Estados de Pago**: Control de anticipos (50%), saldos pendientes, contado o crédito (30/60/90 días).\n\nTienes **${context.totalOCContracts} contratos y OCs** registrados actualmente en el sistema.`,
      actions: [
        { label: 'Ir a Seguimiento de OC', type: 'navigate', tab: 'seguimiento_oc', primary: true },
        { label: 'Ver Alertas del Sistema', type: 'modal', modalAction: 'alerts_widget' },
        { label: 'Consultar Licitaciones', type: 'navigate', tab: 'licitaciones' },
      ],
    };
  }

  // 8. TRM y Auto-actualización
  if (q.includes('trm') || q.includes('dolar') || q.includes('dólar') || q.includes('tasa') || q.includes('cambio') || q.includes('2 horas') || q.includes('banco de la republica')) {
    return {
      reply: `En SYD Colombia la **TRM se actualiza automáticamente cada 2 horas** en segundo plano conectándose con la Superfinanciera y el Banco de la República:\n\n• **TRM Spot en Vivo**: $${context.liveTRM.toLocaleString('es-CO')} COP\n• **TRM Recomendada (+5%)**: $${context.recommendedTRM.toLocaleString('es-CO')} COP (con colchón de seguridad cambiario para vigencias de 15 a 30 días).\n• **Impacto Automático**: Se recalcula de inmediato en el Gestor de Costos, Catálogo y Cotizaciones para proteger el margen de utilidad de la empresa ante fluctuaciones del dólar.`,
      actions: [
        { label: 'Abrir Gestor de Costos & TRM', type: 'navigate', tab: 'costos', primary: true },
        { label: 'Ir al Cotizador', type: 'navigate', tab: 'ventas' },
      ],
    };
  }

  // 9. Licitaciones, Pliegos SECOP II y Rangos
  if (q.includes('licitacion') || q.includes('licitación') || q.includes('secop') || q.includes('pliego') || q.includes('rango') || q.includes('especificacion') || q.includes('especificación')) {
    return {
      reply: `En el módulo de **Licitaciones & SECOP II** puedes estructurar pliegos técnicos y blindar tus propuestas:\n\n1. **Optimizador de Especificaciones IA**: Detecta parámetros medibles biomédicos (pantallas, voltajes, frecuencias, volúmenes, presiones) y genera **rangos amplios y holgados** (ej: "entre 10 a 12.1 pulgadas", "15 a 300 lpm", "10 a 270 mmHg") para evitar pliegos restrictivos.\n2. **4 Variantes de Redacción**: 'between' (entre Min a Max), 'min' (mínimo), 'max' (máximo) y 'fixed' (nominal fija).\n3. **Blindaje Diferencial ('isUnique')**: Resalta las tecnologías exclusivas de tu equipo para ganar puntos técnicos.\n4. **Importación Excel**: Puedes importar pliegos completos directamente desde archivos Excel.\n\nTienes **${context.totalTenderClients} proyectos licitatorios** activos en el sistema.`,
      actions: [
        { label: 'Ir a Licitaciones SECOP II', type: 'navigate', tab: 'licitaciones', primary: true },
        { label: 'Ver Catálogo de Equipos', type: 'navigate', tab: 'catalogo' },
        { label: 'Seguimiento de OC', type: 'navigate', tab: 'seguimiento_oc' },
      ],
    };
  }

  // 10. Cotizaciones y Ventas
  if (q.includes('cotiz') || q.includes('propuesta') || q.includes('iva') || q.includes('pdf') || q.includes('descuento') || q.includes('cliente')) {
    return {
      reply: `Para generar una cotización comercial profesional en el **Cotizador (Ventas)**:\n\n1. **Selecciona Equipos**: Agrega equipos del catálogo biomédico con sus accesorios base u opcionales.\n2. **Ajusta Parámetros**: Define IVA (19% general o 0% exento para dispositivos médicos específicos) y aplica descuentos si se requieren.\n3. **Selecciona Margen**: Elige entre las listas L1 (15%) a L8 (80%) para fijar el precio de venta sugerido.\n4. **Exporta e Imprime**: Haz clic en **"Vista Previa / Imprimir PDF"** para obtener el documento oficial con membrete corporativo, tabla de precios y condiciones comerciales.\n\nActualmente hay **${context.totalQuotes} cotizaciones** guardadas en el historial.`,
      actions: [
        { label: 'Abrir Cotizador Comercial', type: 'navigate', tab: 'ventas', primary: true },
        { label: 'Ver Historial de Cotizaciones', type: 'navigate', tab: 'historial' },
        { label: 'Vista Previa / Imprimir PDF', type: 'modal', modalAction: 'print_preview' },
      ],
    };
  }

  // 11. Márgenes de utilidad (L1 a L8) y Costos
  if (q.includes('margen') || q.includes('l1') || q.includes('l2') || q.includes('l3') || q.includes('l4') || q.includes('l5') || q.includes('l6') || q.includes('l7') || q.includes('l8') || q.includes('costo')) {
    return {
      reply: `En SYD Colombia el cálculo de precios se realiza bajo la fórmula estándar de cobertura de margen:\n\n$$\\text{Precio de Venta} = \\frac{\\text{Costo Base}}{1 - \\%\\text{Margen}}$$\n\n• **L1**: 15% de utilidad\n• **L2**: 20% de utilidad\n• **L2.5**: 25% de utilidad\n• **L3**: 30% de utilidad\n• **L3.5**: 35% de utilidad\n• **L4**: 40% de utilidad\n• **L5**: 50% de utilidad\n• **L6**: 60% de utilidad\n• **L7**: 70% de utilidad\n• **L8**: 80% de utilidad\n\nPuedes consultar la matriz comparativa de todos los equipos y accesorios en el **Gestor de Costos**.`,
      actions: [
        { label: 'Abrir Gestor de Costos', type: 'navigate', tab: 'costos', primary: true },
        { label: 'Ir al Cotizador', type: 'navigate', tab: 'ventas' },
      ],
    };
  }

  // 12. Catálogo de Equipos y Registro INVIMA
  if (q.includes('equipo') || q.includes('catalogo') || q.includes('catálogo') || q.includes('invima') || q.includes('mindray') || q.includes('edan') || q.includes('ge') || q.includes('philips')) {
    return {
      reply: `En el **Catálogo de Equipos Médicos** puedes gestionar todo el portafolio biomédico de SYD Colombia:\n\n• **Generador de Descripciones con IA**: Redacta automáticamente descripciones clínicas y especificaciones de pliego.\n• **Registros INVIMA**: Control de vigencia y alertas preventivas antes de que caduquen.\n• **Accesorios y Costos**: Asigna accesorios de fábrica y opcionales.\n• **Sincronización**: Vinculado directamente con el Cotizador, Gestor de Costos y Licitaciones.\n\nActualmente hay **${context.totalEquipments} equipos médicos** registrados.`,
      actions: [
        { label: 'Ver Catálogo de Equipos', type: 'navigate', tab: 'catalogo', primary: true },
        { label: 'Registrar Nuevo Equipo', type: 'modal', modalAction: 'new_equipment' },
        { label: 'Subir Registro / Ficha INVIMA', type: 'modal', modalAction: 'new_document' },
      ],
    };
  }

  // 13. Atajos de teclado y Tecla ESC
  if (q.includes('esc') || q.includes('escape') || q.includes('cerrar') || q.includes('atajo') || q.includes('teclado')) {
    return {
      reply: `En toda la aplicación SYD Colombia está implementado el **cierre universal con la tecla Escape (ESC)**:\n\n• Puedes presionar **ESC** en tu teclado en cualquier momento para cerrar al instante cualquier modal, ventana emergente, formulario, panel flotante o este chat.\n• También puedes usar **Ctrl+L** o **Alt+S** para suspender y bloquear la pantalla de forma segura.`,
      actions: [
        { label: 'Ir al Cotizador', type: 'navigate', tab: 'ventas', primary: true },
        { label: 'Seguimiento de OC', type: 'navigate', tab: 'seguimiento_oc' },
        { label: 'Ver Catálogo', type: 'navigate', tab: 'catalogo' },
      ],
    };
  }

  // 14. Actualizaciones y Novedades del Sistema
  if (q.includes('actualiz') || q.includes('version') || q.includes('versión') || q.includes('novedad') || q.includes('cambio') || q.includes('update')) {
    return {
      reply: `¡El sistema cuenta con un **Centro de Actualizaciones y Notificaciones en Tiempo Real**!\n\n• **Versión Actual**: ✨ **v2.7.0 (Lanzamiento 22 de Septiembre 2026)** con grandes mejoras:\n  - 🚫 **Validación N-FCO-03**: Detección estricta de solicitudes de inactivación en Google Sheets, bloqueando la creación de partes descontinuadas y marcándolas como "Inactivada (No Utilizable)".\n  - 🏢 **Unificación de Proveedores**: Fusión automática de proveedores (Técnica Electromédica y Técnica unificadas con marcas Welch Allyn, Seca, Ca-Mi, Comen, Mindray y 212 equipos vinculados).\n  - 🗑️ **Directorio de Clientes**: Eliminación interactiva segura con modal nativo y borrado permanente en Firestore.\n  - 📧 **Gmail Compras**: Consulta optimizada de correos con caché local para cuidar la cuota de la API.\n• **Botón de Actualización**: En la barra superior tienes el botón **"Actualizar"** para refrescar la memoria del navegador y sincronizar con la nube al instante.\n• **Historial de Novedades**: Haz clic en el botón de versión para consultar todas las mejoras aplicadas y buscar actualizaciones en la nube.`,
      actions: [
        { label: 'Ver Centro de Actualizaciones', type: 'modal', modalAction: 'app_updates', primary: true },
        { label: 'Ir a Órdenes de Venta', type: 'navigate', tab: 'ordenes_venta' },
        { label: 'Seguimiento de OC', type: 'navigate', tab: 'seguimiento_oc' },
      ],
    };
  }

  // Default Advice
  const userFirst = context.userName ? context.userName.split(' ')[0] : '';
  const greeting = userFirst && userFirst !== 'Usuario' ? `Hola ${userFirst}, ` : '¡Hola! ';
  return {
    reply: cleanBotReplyText(`${greeting}soy Mara, tu Asistente Biomédica y Copiloto de SYD Colombia. Estoy a tu disposición para ayudarte con cotizaciones, cálculo de costos y TRM, seguimiento de OCs, licitaciones o cualquier requerimiento operativo.\n\n¿En qué te puedo colaborar en este momento?`),
    actions: [
      { label: 'Ir al Cotizador', type: 'navigate', tab: 'ventas', primary: true },
      { label: 'Gestor de Costos', type: 'navigate', tab: 'costos' },
      { label: 'Órdenes de Venta (OV)', type: 'navigate', tab: 'ordenes_venta' },
      { label: 'Seguimiento de OC', type: 'navigate', tab: 'seguimiento_oc' },
    ],
  };
}
