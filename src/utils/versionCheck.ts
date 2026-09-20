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

export const CURRENT_APP_VERSION = '2.6.0';
export const CURRENT_RELEASE_DATE = '2026-08-29';

export const APP_RELEASES_HISTORY: AppRelease[] = [
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

/**
 * Checks if there is a genuinely newer remote version available that the user has not yet installed or seen.
 */
export function hasUnseenAppUpdates(): boolean {
  try {
    if (!activeRemoteVersion) {
      return false;
    }

    // Only prompt if remote version is strictly newer than the currently running client code
    const isNewer = isVersionNewer(activeRemoteVersion, CURRENT_APP_VERSION);
    if (!isNewer) {
      return false;
    }

    const lastSeen = localStorage.getItem(LAST_SEEN_VERSION_KEY);
    // If the user already installed or dismissed this specific remote version, do not prompt
    if (lastSeen === activeRemoteVersion) {
      return false;
    }

    return true;
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
    localStorage.setItem(LAST_SEEN_VERSION_KEY, version);
    localStorage.setItem(LAST_INSTALLED_BUILD_KEY, `${version}_${Date.now()}`);
    localStorage.setItem('syd_app_version_installed', CURRENT_APP_VERSION);
    localStorage.setItem(CHANGES_COUNT_KEY, '0');
    window.dispatchEvent(new CustomEvent('syd-update-status-changed'));
  } catch (e) {
    console.error('Error marking update as seen', e);
  }
}

/**
 * Clears local caches, records update confirmation, and performs a clean reload of the application.
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

    // If Firestore has an older version than this client or is missing, broadcast current release
    if (!remoteVer || isVersionNewer(CURRENT_APP_VERSION, remoteVer)) {
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

      // Emit reload signal so other active tabs / devices refresh smoothly
      try {
        const reloadDoc = doc(db, 'system_settings', 'app_reload_signal');
        await setDoc(
          reloadDoc,
          {
            timestamp: Date.now(),
            version: CURRENT_APP_VERSION,
            reason: `Actualización automática a v${CURRENT_APP_VERSION}`,
          },
          { merge: true }
        );
      } catch (_) {}
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

    // 2. Check Firestore metadata
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

  const isStrictlyNewer = isVersionNewer(latest, current);
  const lastSeen = localStorage.getItem(LAST_SEEN_VERSION_KEY);
  const updateAvailable = isStrictlyNewer && lastSeen !== latest;

  return {
    updateAvailable,
    currentVersion: current,
    latestVersion: latest,
    releaseInfo: release,
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

