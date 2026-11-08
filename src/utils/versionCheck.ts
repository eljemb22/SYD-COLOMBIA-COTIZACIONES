import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface AppRelease {
  version: string;
  releaseDate: string;
  title: string;
  summary: string;
  highlights: string[];
  isImportant?: boolean;
}

export let CURRENT_APP_VERSION = '2.11.1';
export const CURRENT_RELEASE_DATE = '2026-11-08';

export const APP_RELEASES_HISTORY: AppRelease[] = [
  {
    version: '2.11.1',
    releaseDate: '2026-11-08',
    title: 'Corrección de actualización portable',
    summary: 'El portable reemplaza y vuelve a abrir el ejecutable actualizado de forma más segura, con recuperación automática y registro de diagnóstico.',
    highlights: ['🔄 Reinicio limpio de la versión portable nueva.', '🛟 Recuperación de la versión previa si el nuevo ejecutable no inicia.', '🧾 Registro de actualización guardado en los datos de la aplicación.'],
    isImportant: true,
  },
  {
    version: '2.11.0',
    releaseDate: '2026-11-08',
    title: 'Temas globales y animaciones renovadas',
    summary: 'Mejora la coherencia de los temas heredados y renueva las animaciones de la barra lateral.',
    highlights: ['🎨 Temas coherentes en vistas y modales.', '🔘 Botones legibles en tema claro.', '✨ Iconos laterales con animaciones contextuales.'],
    isImportant: true,
  },
  {
    version: '2.10.17',
    releaseDate: '2026-11-08',
    title: 'Nombres de archivos compatibles con GitLab',
    summary:
      'Se normalizan los nombres del instalador y portable para que GitLab acepte los paquetes y el canal de actualización NSIS mantenga rutas consistentes.',
    highlights: [
      '📦 El instalador y el portable se generan con nombres sin espacios.',
      '🔄 El feed latest.yml conserva el nombre exacto del instalador publicado.',
      '🌐 Se facilita la publicación de releases y actualizaciones desde GitLab.',
    ],
    isImportant: true,
  },
  {
    version: '2.10.15',
    releaseDate: '2026-11-07',
    title: 'OAuth estable y actualización del instalador desde GitLab',
    summary:
      'Se separan los puertos locales del instalador y el portable y se verifica que cada ventana OAuth regrese a la instancia que la inició. GitLab distribuye el instalador y sirve como respaldo de actualización NSIS.',
    highlights: [
      '🔐 La autorización de Google vuelve a la instancia correcta aunque se ejecuten portable e instalador al mismo tiempo.',
      '🔁 El retorno OAuth tolera reintentos HTTP y amplía el tiempo para completar el consentimiento.',
      '📦 GitLab publica portable, instalador NSIS y los archivos que requiere electron-updater.',
      '🌐 El instalador intenta GitHub y consulta GitLab como respaldo si la primera fuente falla.',
      '🛡️ El arranque valida la identidad del servidor local para detectar colisiones de puerto.',
    ],
    isImportant: true,
  },
  {
    version: '2.10.14',
    releaseDate: '2026-11-06',
    title: 'Actualización del portable desde la aplicación',
    summary:
      'La app portable descarga y verifica la nueva versión dentro de SYD Colombia. Al confirmar, se cierra, reemplaza el ejecutable portable y vuelve a abrirse sin pedir que busques y sustituyas el archivo manualmente.',
    highlights: [
      '⬇️ Descarga integrada con progreso visible dentro de la app.',
      '🔐 Verificación SHA-256 del ejecutable; valida también el tamaño cuando la fuente lo informa.',
      '🌐 Consulta GitHub y permite GitLab como respaldo al configurar un proyecto espejo.',
      '🔄 Botón para actualizar y reiniciar después de descargar.',
      '🧰 Reemplazo con rollback si Windows no puede aplicar el nuevo archivo.',
    ],
    isImportant: true,
  },
  {
    version: '2.10.13',
    releaseDate: '2026-11-06',
    title: 'Personalización de tema consistente en toda la app',
    summary:
      'Se amplía la aplicación de los temas a las vistas que conservaban fondos, bordes, botones y textos fijos. Los ajustes de forma, color y tipografía se aplican de forma más uniforme, conservando los colores de estados de éxito, error y advertencia.',
    highlights: [
      '🎨 Los colores de fondo y superficies siguen el tema elegido en más secciones.',
      '🔘 La forma de botones, tarjetas y campos se aplica globalmente.',
      '🔤 La fuente y escala seleccionadas se reflejan en toda la interfaz.',
      '✅ Se mantienen diferenciados los colores de éxito, error y advertencia.',
      '✨ Los iconos del menú lateral conservan sus animaciones breves.',
    ],
    isImportant: true,
  },
  {
    version: '2.10.12',
    releaseDate: '2026-11-06',
    title: 'Portable e instalador con actualización correcta',
    summary:
      'Se separa la actualización automática del instalador NSIS de la descarga manual para la app portable. El portable usa su propio perfil, permite abrirse sin colisionar con la instalación y explica cómo reemplazar su ejecutable. Se corrige la detección de versiones ya instaladas y se muestran errores de descarga.',
    highlights: [
      '📦 El portable inicia como app independiente y conserva sus datos junto al ejecutable.',
      '⬇️ El portable detecta nuevas versiones y descarga el EXE portable correcto.',
      '🔄 El instalador descarga y aplica actualizaciones NSIS desde la app.',
      '✅ La app limpia avisos cuando ya está al día y muestra errores reales.',
    ],
    isImportant: true,
  },
  {
    version: '2.10.11',
    releaseDate: '2026-11-06',
    title: 'Actualizaciones de escritorio bajo tu control',
    summary:
      'La app ahora avisa cuando hay una versión disponible, permite iniciar la descarga desde la misma ventana y muestra el progreso. Al terminar, puedes elegir cuándo reiniciar e instalar. También se corrige el inicio de sesión de Google Drive y Sheets en escritorio para completarlo en el navegador del sistema.',
    highlights: [
      '🔔 Aviso de versión nueva dentro de SYD Colombia.',
      '⬇️ Descarga manual con indicador de progreso.',
      '🔄 Reinicio e instalación solo cuando pulses el botón.',
      '🌐 Autenticación de Google Drive y Sheets en el navegador del sistema.',
    ],
    isImportant: true,
  },
  {
    version: '2.10.10',
    releaseDate: '2026-11-06',
    title: 'Compilación y publicación confiables para Windows',
    summary:
      'Se corrigió el empaquetado de Windows para generar el instalador y la aplicación portable sin depender de respaldos locales excluidos del repositorio. El flujo de publicación ahora adjunta los ejecutables a GitHub Releases al crear una etiqueta de versión.',
    highlights: [
      '📦 Generación del instalador NSIS y del ejecutable portable desde el mismo flujo de compilación.',
      '🔒 Los respaldos de datos locales permanecen fuera de los paquetes distribuidos.',
      '🚀 Publicación automatizada de los ejecutables en GitHub Releases para etiquetas de versión.',
    ],
    isImportant: true,
  },
  {
    version: '2.10.7',
    releaseDate: '2026-10-01',
    title: 'Corrección de Renderizado y Mapeo Seguro en Pestaña 7 (Documentación)',
    summary:
      'Resolución definitiva del renderizado en la subpestaña de Contratos & OCs Directas en Documentación: compatibilidad total con modo unificado (mode="all"), selector rápido de subfiltro (Todos / Licitaciones / OCs Directas), mapeo defensivo con validaciones opcionales para evitar pantallas en blanco y vinculación automática fluida desde el catálogo maestro.',
    highlights: [
      '🏛️ Visualización Inmediata en Documentación: Renderizado completo de las tarjetas de contratos de licitaciones y órdenes de compra directas con sus respectivos equipos biomédicos.',
      '🛡️ Mapeo Defensivo & Tolerancia a Nulos: Verificaciones opcionales en cada propiedad y lista de equipos para máxima resiliencia ante cualquier estructura de datos en la nube.',
      '🔍 Selector de Subfiltro & Búsqueda Limpia: Filtrado instantáneo entre todos los contratos o segmentado por licitaciones u OCs directas sin descartar registros por error.',
      '🏷️ SemVer Estricto: Incremento de parche a v2.10.2 preservando estabilidad en todos los demás módulos.',
    ],
    isImportant: true,
  },
  {
    version: '2.10.1',
    releaseDate: '2026-10-01',
    title: 'Estabilización del Sistema de Versiones & Ciclo Completo de Datos CRUD',
    summary:
      'Corrección definitiva del banner de actualización con almacenamiento persistente de versión instalada, regla estricta de visibilidad solo si la versión remota es mayor (remoteVersion > installedVersion), y equilibrio total en las operaciones de Crear, Cargar y Eliminar en Licitaciones y Órdenes de Compra.',
    highlights: [
      '🚀 Fin del Bucle de Actualización: Al hacer clic en "Instalar" o cerrar ("X"), se guarda inmediatamente installed_version impidiendo que el cartel reaparezca para la misma versión.',
      '🎯 Renderizado Condicional Estricto: El banner azul solo aparece si la versión de la nube es estrictamente superior a la instalada en el dispositivo.',
      '📦 Ciclo CRUD 100% Funcional: Creación, lectura y borrado simultáneos y permanentes en Licitaciones y Seguimiento de OCs.',
      '🏷️ SemVer Estricto: Incremento de parche para correcciones menores y ajustes de estabilidad.',
    ],
    isImportant: true,
  },
  {
    version: '2.10.0',
    releaseDate: '2026-10-01',
    title: 'Persistencia Blindada & Sincronización en Tiempo Real Multi-Dispositivo (Web & .EXE)',
    summary:
      'Corrección de raíz de la sincronización y persistencia multi-dispositivo entre la Web y la aplicación instalada en Windows (.EXE): Firestore como única fuente de verdad sin sobreescrituras por caché local, escuchadores en tiempo real (onSnapshot) activos, borrado físico definitivo con deleteDoc sin datos residuales y confirmación asíncrona blindada ante cierres o reinicios.',
    highlights: [
      '☁️ Fuente Única de Verdad en Firestore: La base de datos central en la nube gobierna todos los datos (cotizaciones, licitaciones, OCs, órdenes de venta, facturas y catálogo) sin interferencia de cachés locales.',
      '⚡ Sincronización Inmediata Web & .EXE: Escuchadores en tiempo real (onSnapshot) activos y sincronizados. Todo cambio o eliminación se refleja al instante en todos los dispositivos.',
      '🗑️ Borrado Físico y Definitivo: Eliminación inmediata con deleteDoc en Firestore y purga en servidor para cero datos residuales o apariciones fantasma.',
      '🛡️ Persistencia Garantizada ante Cierres o Reinicios: Las operaciones esperan confirmación en la nube antes de cerrar ventanas, garantizando que al reabrir el sistema todo esté tal como se dejó.',
      '🔔 Notificación Directa & Centro de Actualizaciones: Aviso integrado en la campana de notificaciones y panel con estado "Al día" permanente una vez aceptada la versión.',
    ],
    isImportant: true,
  },
  {
    version: '2.8.0',
    releaseDate: '2026-10-01',
    title: 'Documentación Unificada, Clasificación Manual Libre & Sincronización Automática del Centro de Actualizaciones',
    summary:
      'Actualización mayor del módulo de Documentación y Centro de Actualizaciones: unificación de pestañas de contratos, catálogo central con autogeneración de fichas, nuevos botones de Guía Rápida, Protocolo de Limpieza y botón permanente "+ Otro Documento" para clasificación manual libre, junto con la regla automática de control de versiones y actualizaciones en línea.',
    highlights: [
      '🏛️ Pestaña Unificada de Contratos & OCs Directas: Consolidación de expedientes técnicos, licitaciones y órdenes de compra con filtros segmentados en una sola vista.',
      '📚 Base Maestra y Catálogo General Automatizado: Cuadro automático inmediato con ranuras para fichas y documentos para todo equipo nuevo creado en el catálogo.',
      '🏷️ Seriales y Hojas de Vida Integrados: Gestión directa de placas, actas de entrega, remisiones y metrología dentro de cada equipo.',
      '⚡ Nuevos Documentos Biomédicos: Botones directos para Ficha Técnica, Registro INVIMA, Manual, Guía Rápida y Protocolo de Limpieza / Desinfección.',
      '📁 Botón Permanente "+ Otro Documento": Permite subir anexos adicionales ilimitados con clasificación manual abierta y chips de sugerencias rápidas.',
      '🔔 Depuración de Alertas Falsas: Eliminación de alerta de inactividad 72h y silenciado permanente de notificaciones de Google Drive ya creadas o descartadas.',
      '🔄 Conexión Automática del Centro de Actualizaciones: Detección estricta de nueva versión v2.8.0, banner de instalación en línea y confirmación en estado "Al día".',
    ],
    isImportant: true,
  },
  {
    version: '2.7.3',
    releaseDate: '2026-09-28',
    title: 'Sincronización Total Multi-Dispositivo, Persistencia en Nube & PWA Conectada',
    summary:
      'Actualización mayor de sincronización en tiempo real y persistencia: integración total entre la aplicación instalada (PWA), todas las URLs y navegadores, garantizando que órdenes de venta, licitaciones, contratos y catálogo aparezcan instantáneamente en todos los dispositivos.',
    highlights: [
      '🔄 Sincronización Inmediata PWA & Web: Conexión continua y carga automática de los datos más recientes al abrir la aplicación instalada.',
      '📦 Órdenes de Venta & Licitaciones Conectadas: Reflejo bidireccional en la nube de OVs manuales, equipos asociados y estados comerciales en tiempo real.',
      '🛡️ Respaldo Blindado del Servidor: Recuperación instantánea del estado global ante aperturas en dispositivos o ventanas nuevas.',
      '⚡ Actualización en Línea en 1 Clic: Notificación y auto-recarga limpia sin pérdida de información.',
    ],
    isImportant: true,
  },
  {
    version: '2.7.2',
    releaseDate: '2026-09-26',
    title: 'Centro de Actualizaciones Depurado, Diseño Cómodo de Botones & Limpieza de Interfaz',
    summary:
      'Actualización visual del Centro de Actualizaciones con eliminación del botón innecesario de reinstalación, reorganización espaciosa de botones sin cortes en pantalla y estado limpio de sincronización.',
    highlights: [
      '🧹 Interfaz Simplificada: Eliminación completa del botón redundante de reinstalación.',
      '🎯 Botones Reorganizados: Distribución amplia y proporcionada sin cortes de texto en pantallas o ventanas reducidas.',
      '✅ Estado Nítido: Insignia visual destacada "Ya está actualizado" cuando el sistema se encuentra en la versión más reciente.',
      '⚡ Actualizaciones Automáticas: Detección instantánea y barra de carga animada (0% - 100%) cuando se publique una nueva versión.',
    ],
    isImportant: true,
  },
  {
    version: '2.7.1',
    releaseDate: '2026-09-26',
    title: 'Actualización en Línea con 1 Clic, Persistencia Blindada & Sincronización en Tiempo Real',
    summary:
      'Nueva versión con sistema interactivo de actualización en línea con 1 solo clic en la aplicación, persistencia definitiva e inmutable de equipos médicos, eliminación segura de cotizaciones y estandarización visual de tablas comerciales.',
    highlights: [
      '⚡ Actualización en Línea en 1 Clic: Banner interactivo y botón directo para instalar actualizaciones al instante sin necesidad de descargar nuevos instaladores .exe.',
      '🛡️ Persistencia Inmutable de Equipos: Corrección total de guardado en el catálogo sin riesgo de sobreescritura accidental al crear o editar equipos biomédicos.',
      '🧹 Eliminación Definitiva de Cotizaciones Fantasma: Protocolo de descarte seguro que evita que cotizaciones borradas reaparezcan desde copias de respaldo.',
      '📊 Tablas Comerciales Centradas: Centrado uniforme y estandarización tipográfica de valores numéricos (COP) en propuestas y cotizaciones.',
      '🔄 Compatibilidad Mejorada con Windows (.exe) y PWA: Atajos rápidos de recarga en línea (F5 / Ctrl+Shift+R) y auto-detección de cambios en la nube.',
    ],
    isImportant: true,
  },
  {
    version: '2.7.0',
    releaseDate: '2026-09-22',
    title: 'Validación N-FCO-03, Unificación de Proveedores, Directorio Robusto & Optimización Gmail Compras',
    summary:
      'Actualización mayor con validación estricta de solicitudes de inactivación N-FCO-03, unificación automática de proveedores duplicados (Técnica Electromédica), eliminación interactiva segura en Directorio de Clientes y protección de cuota en Gmail Compras.',
    highlights: [
      '🚫 Bloqueo Estricto de Inactivación N-FCO-03: Detección inteligente de solicitudes de inactivación en Google Sheets, bloqueando la creación de partes descontinuadas y mostrando el estado "Inactivada (No Utilizable)" claramente en la interfaz.',
      '🏢 Unificación de Proveedores: Fusión automática de registros duplicados (como Técnica Electromédica y Técnica) consolidando marcas autorizadas (Welch Allyn, Seca, Ca-Mi, Comen, Mindray) y vinculando todos sus equipos médicos del catálogo.',
      '🗑️ Directorio de Clientes con Eliminación Interactiva: Diálogo de confirmación en modal nativo (sin bloqueos de navegador), borrado permanente multidispositivo y protección contra fragmentos no deseados.',
      '📧 Gmail Compras con Caché y Protección de Cuota: Consulta inteligente de correos de compras optimizando las llamadas a la API de Google Workspace para evitar cuotas agotadas.',
      '🤖 Mara IA v2.7.0: Asistente biomédico actualizado con conocimiento completo de todas las nuevas funcionalidades del sistema.',
    ],
    isImportant: true,
  },
  {
    version: '2.6.0',
    releaseDate: '2026-08-29',
    title: 'Sincronización Inteligente de Permisos, Centro de Actualizaciones Optimizado & Trazabilidad',
    summary:
      'Actualización mayor con sincronización instantánea de permisos en tiempo real, detección y aplicación limpia de actualizaciones sin bucles repetitivos y respaldos automáticos.',
    highlights: [
      '👑 Sincronización instantánea de permisos de usuarios sin reinicio de sesión ni pérdidas al refrescar (F5).',
      '⚡ Sistema de actualización inteligente: se detecta en tiempo real en todos los dispositivos y no se vuelve a pedir una vez instalado.',
      '🔄 Recarga automática y sincronización multidispositivo (PC, tablets y celulares).',
      '📊 Respaldo automático horario en Excel (.xlsx) y base de datos permanente en la nube Firestore.',
      '🎯 Centro de novedades y trazabilidad de cambios para todos los miembros del equipo SYD.',
    ],
    isImportant: true,
  },
  {
    version: '2.5.1',
    releaseDate: '2026-08-26',
    title: 'Optimización Compacta de Licitaciones, Resumen OV Minimizable & Notificaciones Informativas de OC',
    summary:
      'Actualización puntual con mejoras ergonómicas en Licitaciones Adjudicadas, desenlace de cotizaciones corregido, panel de métricas minimizable en Órdenes de Venta y notificaciones informativas sin alarmas invasivas.',
    highlights: [
      '📐 Vista ultra-compacta en Licitaciones Adjudicadas dando máxima prioridad y visibilidad a la tabla de equipos médicos.',
      '🔗 Corrección y reactivación del botón "Desenlazar Cotización" con reseteo limpio de vínculos y datos.',
      '🧹 Eliminación del botón duplicado "+ Nuevo" en la barra lateral de contratos.',
      '📊 Panel de resumen y métricas numéricas de Órdenes de Venta (OV) minimizable/expandible con memoria local.',
      '🔔 Notificación informativa fluida al generar y vincular Órdenes de Compra (OC) automáticas sin alertas críticas.',
      '📁 Catálogo maestro de equipos y exportación Excel (.xlsx) integrado en el núcleo del sistema.',
    ],
    isImportant: false,
  },
  {
    version: '2.5.0',
    releaseDate: '2026-08-26',
    title: 'Órdenes de Venta (OV), Seguimiento Automatizado de OC, Vista en Lista & Base de Datos Maestra Excel',
    summary:
      'Actualización mayor con módulo integral de Órdenes de Venta, vinculación automática de OCs por Contrato/OV en cajas visuales delimitadas, modo de lista unificado y exportación completa de base de datos a Excel.',
    highlights: [
      '📦 Módulo unificado de Órdenes de Venta (OV) y Facturación a Clientes conectadas con Licitaciones y Cotizaciones.',
      '📋 Modo de visualización en Lista/Tabla predeterminado en todos los módulos de datos para máxima claridad y densidad.',
      '🔄 Generación y sincronización automatizada de Órdenes de Compra (OC) por Contrato/OV en cajas delimitadas sin duplicados.',
      '📊 Exportación Maestra de Base de Datos en Excel (.xlsx) con todas las colecciones y persistencia en la Nube Firestore.',
      '🗑️ Sistema interactivo de confirmación y eliminación de registros optimizado para escritorio y navegador web.',
    ],
    isImportant: true,
  },
  {
    version: '2.4.0',
    releaseDate: '2026-08-23',
    title: 'Sincronización Maestra Multidispositivo & Sistema Automático de Actualizaciones en la Nube',
    summary:
      'Conexión definitiva a Firestore centralizado con detección inteligente de actualizaciones en tiempo real, alertas de nueva versión y confirmación de instalación.',
    highlights: [
      '⚡ Sincronización automática multidispositivo (PC con ejecutable Windows, navegadores y celulares).',
      '🔔 Notificación visual de actualización disponible cuando se publiquen cambios desde cualquier AI Studio.',
      '✨ Ocultación automática del aviso una vez que el usuario aplica o confirma la actualización.',
      '👑 Matriz de 11 permisos de edición configurables por el usuario Administrador.',
      '🛡️ Respaldo diario automático y base de datos permanente centralizada.',
    ],
    isImportant: true,
  },
  {
    version: '2.3.8',
    releaseDate: '2026-08-20',
    title: 'Trazabilidad de Seriales, Lotes & Manifiestos de Importación DIAN',
    summary:
      'Gestión biomédica avanzada de equipos en órdenes de compra con asignación de seriales físicos, placas de activo hospitalario y actas de entrega.',
    highlights: [
      '📦 Registro de seriales y números de lote en equipos de órdenes de compra.',
      '📑 Declaraciones aduaneras de importación DIAN y seguimiento hospitalario.',
      '🏢 Directorio centralizado de proveedores y fabricantes médicos.',
    ],
  },
  {
    version: '2.3.0',
    releaseDate: '2026-08-15',
    title: 'Personalización de Marca, Membretes Institucionales & Copias de Seguridad',
    summary:
      'Soporte para membrete institucional permanente en cotizaciones, temas cromáticos y respaldos automáticos.',
    highlights: [
      '🎨 Configuración de temas visuales, logos y colores corporativos.',
      '📄 Calibrador de membretes y márgenes para exportaciones comerciales limpias.',
      '💾 Respaldo y sincronización automática en la nube de Firestore.',
    ],
  },
];

const LAST_SEEN_VERSION_KEY = 'syd_last_seen_app_version';
const LAST_INSTALLED_BUILD_KEY = 'syd_last_installed_build_hash';
const CHANGES_COUNT_KEY = 'syd_changes_count_since_install';

let activeRemoteVersion: string | null = null;
let activeRemoteRelease: AppRelease | null = null;
let hasSyncedManifest = false;

export function isDesktopExeEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return (
    ua.includes('electron') ||
    Boolean((window as any).electron) ||
    Boolean((window as any).process?.versions?.electron) ||
    window.location.protocol === 'file:' ||
    (window as any).__TAURI__ !== undefined
  );
}

export function isWindowsPlatform(): boolean {
  if (typeof window === 'undefined') return false;
  return navigator.userAgent.toLowerCase().includes('windows');
}

export function getPlatformInfo(): {
  isDesktopExe: boolean;
  isWindows: boolean;
  platformLabel: string;
  installModeLabel: string;
  deviceType: 'desktop_exe' | 'windows_web' | 'web_browser';
} {
  const isExe = isDesktopExeEnvironment();
  const isWin = isWindowsPlatform();
  let platformLabel = 'Versión Web (Navegador en Línea)';
  let installModeLabel = 'Recargar y Aplicar en 1 Clic';
  let deviceType: 'desktop_exe' | 'windows_web' | 'web_browser' = 'web_browser';

  if (isExe) {
    platformLabel = 'Aplicación de Escritorio Windows (.EXE)';
    installModeLabel = 'Actualizar Sistema en Línea / Descargar .EXE';
    deviceType = 'desktop_exe';
  } else if (isWin) {
    platformLabel = 'Versión Web en Windows (Navegador / PWA)';
    installModeLabel = 'Actualizar y Recargar en 1 Clic';
    deviceType = 'windows_web';
  }

  return {
    isDesktopExe: isExe,
    isWindows: isWin,
    platformLabel,
    installModeLabel,
    deviceType,
  };
}

/**
 * Checks if there is a genuinely newer remote version available that the user has not yet installed or seen.
 * STRICT RULE: Only return true if remoteVersion > installedVersion AND remoteVersion > CURRENT_APP_VERSION.
 */
export function hasUnseenAppUpdates(): boolean {
  try {
    const installed =
      localStorage.getItem('installed_version') ||
      localStorage.getItem('syd_app_version_installed') ||
      CURRENT_APP_VERSION;

    if (activeRemoteVersion) {
      if (
        isVersionNewer(activeRemoteVersion, installed) &&
        isVersionNewer(activeRemoteVersion, CURRENT_APP_VERSION)
      ) {
        const lastSeen = localStorage.getItem(LAST_SEEN_VERSION_KEY);
        if (lastSeen !== activeRemoteVersion) {
          return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Gets the active release info (either remote broadcast or local default).
 */
export function getActiveReleaseInfo(): AppRelease {
  if (activeRemoteRelease) return activeRemoteRelease;
  return APP_RELEASES_HISTORY[0];
}

/**
 * Marks the version update as acknowledged / installed by the user so the alert immediately stops appearing.
 */
export function markAppUpdateAsSeen(versionToMark?: string): void {
  try {
    const version = versionToMark || activeRemoteVersion || CURRENT_APP_VERSION;
    localStorage.setItem('installed_version', version);
    localStorage.setItem('syd_app_version_installed', version);
    localStorage.setItem(LAST_SEEN_VERSION_KEY, version);
    localStorage.setItem(LAST_INSTALLED_BUILD_KEY, `${version}_${Date.now()}`);
    localStorage.setItem(CHANGES_COUNT_KEY, '0');

    // Permanently dismiss the alert item for this version so it leaves the alert engine immediately
    try {
      const rawDismissed = localStorage.getItem('syd_dismissed_alert_ids_v2');
      const list: string[] = rawDismissed ? JSON.parse(rawDismissed) : [];
      const alertId = `alert-app-update-${version}`;
      if (!list.includes(alertId)) {
        list.push(alertId);
        localStorage.setItem('syd_dismissed_alert_ids_v2', JSON.stringify(list));
      }
    } catch (_) {}

    window.dispatchEvent(new CustomEvent('syd-update-status-changed', { detail: { version } }));
    window.dispatchEvent(new CustomEvent('syd-alerts-updated'));
  } catch (e) {
    console.error('Error marking update as seen', e);
  }
}

/**
 * Clears local caches, unregisters service workers, records update confirmation, and performs a clean reload of the application.
 */
export async function applyAppUpdateAndReload(targetVersion?: string): Promise<void> {
  const version = targetVersion || activeRemoteVersion || CURRENT_APP_VERSION;
  markAppUpdateAsSeen(version);

  try {
    // Clear cache storage if supported
    if ('caches' in window) {
      const cacheKeys = await window.caches.keys();
      await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
    }
  } catch (e) {
    console.warn('Cache clear not fully supported:', e);
  }

  try {
    // Unregister any active Service Workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
    }
  } catch (e) {
    console.warn('Service worker unregister error:', e);
  }

  // Force clean reload without asking again
  window.location.reload();
}

/**
 * Automatically ensures Firestore app_metadata/version_manifest reflects current release
 */
async function syncCurrentVersionToFirestore(): Promise<void> {
  if (hasSyncedManifest || !db) return;
  hasSyncedManifest = true;

  try {
    const versionDocRef = doc(db, 'app_metadata', 'version_manifest');
    const snap = await getDoc(versionDocRef);
    const data = snap.exists() ? snap.data() : null;
    const remoteVer = data?.latestVersion || '';

    // If Firestore does not match current release or is older, broadcast current release
    if (!remoteVer || remoteVer !== CURRENT_APP_VERSION) {
      const currentRel = APP_RELEASES_HISTORY[0];
      await setDoc(
        versionDocRef,
        {
          latestVersion: CURRENT_APP_VERSION,
          releaseDate: CURRENT_RELEASE_DATE,
          title: currentRel.title,
          summary: currentRel.summary,
          highlights: currentRel.highlights,
          isImportant: true,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }
  } catch (e) {
    // Non-blocking
  }
}

/**
 * Subscribes to realtime version updates from Firestore.
 */
export function subscribeToAppVersionUpdates(
  onUpdateAvailable?: (release: AppRelease, isNewer: boolean) => void
): Unsubscribe | null {
  try {
    // Ensure current code version is marked installed locally
    markAppUpdateAsSeen(CURRENT_APP_VERSION);
    syncCurrentVersionToFirestore();

    if (!db) return null;
    const versionDocRef = doc(db, 'app_metadata', 'version_manifest');
    return onSnapshot(
      versionDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.latestVersion) {
            activeRemoteVersion = data.latestVersion;
            activeRemoteRelease = {
              version: data.latestVersion,
              releaseDate: data.releaseDate || new Date().toISOString().split('T')[0],
              title: data.title || 'Actualización de Sistema SYD Colombia',
              summary: data.summary || 'Nuevas mejoras y optimizaciones disponibles.',
              highlights: data.highlights || ['Mejoras de rendimiento y sincronización.'],
              isImportant: !!data.isImportant,
            };

            const isStrictlyNewer = isVersionNewer(data.latestVersion, CURRENT_APP_VERSION);
            const lastSeen = localStorage.getItem(LAST_SEEN_VERSION_KEY);
            const isUnseen = isStrictlyNewer && lastSeen !== data.latestVersion;

            window.dispatchEvent(new CustomEvent('syd-update-status-changed'));
            onUpdateAvailable?.(activeRemoteRelease, isUnseen);
          }
        }
      },
      (err) => {
        if (process.env.NODE_ENV === 'development') {
          console.debug('Version subscription offline fallback:', err?.message || err);
        }
      }
    );
  } catch (e) {
    return null;
  }
}

/**
 * Consults GitHub Releases API to get the latest published release version.
 * This ensures that even if Firestore is not updated, the app still detects
 * the real latest version from GitHub.
 */
async function fetchLatestGitHubRelease(): Promise<{ version: string; title?: string; summary?: string; highlights?: string[] } | null> {
  try {
    const res = await fetch('https://api.github.com/repos/eljemb22/SYD-COLOMBIA-COTIZACIONES/releases/latest', {
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.tag_name) {
        const version = data.tag_name.replace(/^v/, '');
        return {
          version,
          title: data.name || undefined,
          summary: data.body || undefined,
          highlights: undefined,
        };
      }
    }
  } catch (_) {}
  return null;
}

/**
 * Checks online if there is a newer version published in Firestore metadata or server API.
 */
export async function checkForAppUpdatesOnline(): Promise<{
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseInfo: AppRelease;
  lastChecked: string;
}> {
  const current = CURRENT_APP_VERSION;
  let latest = current;
  let release = activeRemoteRelease || APP_RELEASES_HISTORY[0];

  try {
    // 1. Check server API /api/version
    try {
      const srvRes = await fetch('/api/version?t=' + Date.now(), {
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });
      if (srvRes.ok) {
        const srvData = await srvRes.json();
        if (srvData?.version && isVersionNewer(srvData.version, latest)) {
          latest = srvData.version;
          activeRemoteVersion = latest;
        }
      }
    } catch (_) {}

    // 2. Check GitHub releases (most reliable source for published versions)
    try {
      const ghRelease = await fetchLatestGitHubRelease();
      if (ghRelease && ghRelease.version && isVersionNewer(ghRelease.version, latest)) {
        latest = ghRelease.version;
        activeRemoteVersion = latest;
        release = {
          version: latest,
          releaseDate: new Date().toISOString().split('T')[0],
          title: ghRelease.title || 'Actualización SYD Colombia v' + latest,
          summary: ghRelease.summary || 'Nuevas mejoras y optimizaciones disponibles.',
          highlights: ghRelease.highlights || [],
          isImportant: true,
        };
        activeRemoteRelease = release;
      }
    } catch (_) {}

    // 3. Check Firestore metadata
    if (db) {
      const versionDocRef = doc(db, 'app_metadata', 'version_manifest');
      const snap = await getDoc(versionDocRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.latestVersion && isVersionNewer(data.latestVersion, latest)) {
          latest = data.latestVersion;
          activeRemoteVersion = latest;
          if (data.releaseInfo || data.title) {
            release = {
              version: latest,
              releaseDate: data.releaseDate || new Date().toISOString().split('T')[0],
              title: data.title || 'Actualización SYD Colombia',
              summary: data.summary || '',
              highlights: data.highlights || [],
              isImportant: !!data.isImportant,
            };
            activeRemoteRelease = release;
          }
        }
      }
    }
  } catch (e) {
    console.warn('Cloud version check error, using local manifest:', e);
  }

  const installed =
    localStorage.getItem('installed_version') ||
    localStorage.getItem('syd_app_version_installed') ||
    current;
  const isRemoteNewer = isVersionNewer(latest, installed) && isVersionNewer(latest, current);
  const lastSeen = localStorage.getItem(LAST_SEEN_VERSION_KEY);
  const updateAvailable = isRemoteNewer && lastSeen !== latest;

  return {
    updateAvailable,
    currentVersion: current,
    latestVersion: latest,
    releaseInfo: isRemoteNewer ? release : APP_RELEASES_HISTORY[0],
    lastChecked: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
  };
}

/**
 * Compares two semantic version strings (e.g., '2.6.0' vs '2.5.1').
 */
export function isVersionNewer(remoteVer: string, localVer: string): boolean {
  if (!remoteVer || !localVer) return false;
  const rParts = remoteVer.split('.').map((p) => parseInt(p, 10) || 0);
  const lParts = localVer.split('.').map((p) => parseInt(p, 10) || 0);

  for (let i = 0; i < Math.max(rParts.length, lParts.length); i++) {
    const r = rParts[i] || 0;
    const l = lParts[i] || 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}

/**
 * Allows Admin or AI Studio build trigger to broadcast a new update version notification to all users and devices.
 */
export async function broadcastAppUpdateRelease(release: Partial<AppRelease>): Promise<boolean> {
  try {
    if (!db) return false;
    const versionDocRef = doc(db, 'app_metadata', 'version_manifest');
    const versionNum = release.version || CURRENT_APP_VERSION;
    await setDoc(
      versionDocRef,
      {
        latestVersion: versionNum,
        releaseDate: release.releaseDate || new Date().toISOString().split('T')[0],
        title: release.title || `Nueva Actualización SYD Colombia v${versionNum}`,
        summary: release.summary || 'Nuevas mejoras de rendimiento, módulos y sincronización en tiempo real.',
        highlights: release.highlights || [
          'Sincronización automática de cotizaciones y catálogo.',
          'Optimización de interfaz y respuesta del sistema.',
        ],
        isImportant: release.isImportant ?? true,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Emit live reload signal for all open tabs / clients
    try {
      const reloadDoc = doc(db, 'system_settings', 'app_reload_signal');
      await setDoc(
        reloadDoc,
        {
          timestamp: Date.now(),
          version: versionNum,
          reason: `Nueva versión v${versionNum} publicada en vivo`,
        },
        { merge: true }
      );
    } catch (_) {}

    return true;
  } catch (e) {
    console.error('Error broadcasting update release:', e);
    return false;
  }
}

