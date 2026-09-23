import { ActiveTab, BotActionOption } from '../types';
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

/**
 * Intelligent Fallback & Rule-Based Mara Assistant Engine
 */
export function getIntelligentMaraFallbackReply(
  query: string,
  context: DynamicSystemContext
): { reply: string; actions: BotActionOption[] } {
  const q = query.toLowerCase().trim();

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

  // Default Comprehensive Advice
  return {
    reply: `Hola ${context.userName.split(' ')[0] || ''}, soy **Mara**, tu Copiloto Biomédica y Asistente Oficial de SYD Colombia. Estoy sincronizada en tiempo real con todas las herramientas de la plataforma:\n\n• **Órdenes de Venta (OV) & Facturación**: Despachos, remisiones de entrega firmadas, radicación de facturas y cartera (${context.totalSalesOrders} OVs registradas).\n• **Cotizador Comercial & PDF**: Ofertas con IVA, márgenes y membretes (${context.totalQuotes} cotizaciones).\n• **Seguimiento de OC & Seriales**: Trazabilidad de 11 estados logísticos, alertas 48h y manifiestos DIAN.\n• **Consola Relacional & Analítica SQL**: Consultas protegidas para administradores.\n• **Base de Datos & Excel**: Exportación .xlsx y copias de seguridad continuas.\n• **Gestor de Costos & TRM**: TRM actualizada automáticamente cada 2 horas ($${context.liveTRM.toLocaleString('es-CO')} COP spot / $${context.recommendedTRM.toLocaleString('es-CO')} COP recomendada).\n• **Catálogo Biomédico & INVIMA**: ${context.totalEquipments} equipos registrados con IA.\n\n¿En qué te puedo colaborar en este momento?`,
    actions: [
      { label: 'Ir al Cotizador', type: 'navigate', tab: 'ventas', primary: true },
      { label: 'Órdenes de Venta (OV)', type: 'navigate', tab: 'ordenes_venta' },
      { label: 'Seguimiento de OC', type: 'navigate', tab: 'seguimiento_oc' },
      { label: 'Base de Datos & Excel', type: 'modal', modalAction: 'backup_modal' },
      { label: 'Licitaciones SECOP II', type: 'navigate', tab: 'licitaciones' },
    ],
  };
}
