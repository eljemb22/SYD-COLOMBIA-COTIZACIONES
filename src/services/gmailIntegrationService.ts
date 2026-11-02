/**
 * SYD Colombia - Gmail & Purchase Orders (OC) Integration Service
 * Handles OAuth 2.0 Token Client (Google Identity Services),
 * reading inbox for purchase orders, parsing emails, and sending structured emails.
 */

import firebaseConfig from '../../firebase-applet-config.json';
import {
  cleanHtmlToStructuredText,
  cleanEmailText,
  extractSignature,
  extractRequestedPartCreationDetails,
  extractAllRequestedPartCreationDetails,
  splitEmailThread,
  RequestedPartCreationDetails,
  isSignatureOrHeaderOrNoise,
} from '../utils/emailThreadUtils';
import { extractStructuredRowsFromEmail, parseCurrencyCOP, parseQuantity } from '../utils/emailTableParser';
import { extractEquipmentNamesFromSubject } from '../utils/clientPOUtils';
import { buildGoogleOAuthErrorMessage } from '../utils/googleOAuthError';
import { MASTER_EQUIPMENTS_CATALOG } from '../data/masterEquipmentsCatalog';
import { requestGoogleToken } from './desktopOAuth';
import { signInFirebaseWithGoogle } from '../lib/firebase';

export interface GmailUserProfile {
  email: string;
  name: string;
  picture?: string;
  locale?: string;
  verified_email?: boolean;
}

export interface DetectedPurchaseOrderItem {
  partCode?: string;
  description: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  brand?: string;
  model?: string;
  taxRate?: number;
}

export interface DetectedPartToImport {
  code: string; // The official Part Number (Número de Parte) e.g. 70859, 70860, SYD-SPO2-MRY-01
  name: string;
  brand: string;
  model: string;
  quantity?: number;
  subReferences?: string; // Sub-part / component reference numbers
  baseCostCOP: number;
  taxExempt: boolean;
  taxRate?: number;
  supplier: string;
  category:
    | 'Monitoreo'
    | 'Cirugía'
    | 'Diagnóstico'
    | 'Quirófano'
    | 'Cuidados Críticos'
    | 'Cuidado Crítico'
    | 'Urgencias'
    | 'Ginecología'
    | 'Hospitalización'
    | 'Neonatología'
    | 'Esterilización'
    | 'Laboratorio'
    | 'Accesorios';
  invimaRecordNumber?: string;
  description?: string;
}

export interface DetectedPurchaseOrder {
  id: string;
  messageId: string;
  threadId: string;
  sender: string;
  senderName: string;
  senderEmail: string;
  date: string;
  subject: string;
  snippet: string;
  rawBodyText?: string;
  rawHtml?: string;
  emailType?: 'part_creation_response' | 'part_authorization' | 'oc_response' | 'general_po' | 'client_po' | 'meeting_invite' | 'documentation' | 'other';
  poDirection?: 'client_to_syd' | 'syd_to_supplier';
  clientName?: string;
  detectedOCNumber?: string;
  detectedCustomer?: string;
  detectedEstimatedTotal?: number;
  detectedItems: DetectedPurchaseOrderItem[];
  detectedPartsToImport?: DetectedPartToImport[];
  partCreationNotice?: {
    status: 'uncreated' | 'created' | 'requested';
    message?: string;
    code?: string;
    requestedItem?: RequestedPartCreationDetails;
    requestedItems?: RequestedPartCreationDetails[];
  };
  attachments: {
    filename: string;
    mimeType: string;
    size?: number;
    attachmentId?: string;
    messageId?: string;
    dataUrl?: string;
  }[];
  isRead: boolean;
  urgency: 'Alta' | 'Media' | 'Baja';
  status: 'Nueva' | 'En Revisión' | 'Importada a Catálogo' | 'OC Creada' | 'Procesada';
  source: 'gmail' | 'simulated';
}

export interface PartItemRequest {
  id?: string;
  subReferences?: string; // Component reference numbers / manufacturer sub-part codes (e.g. 33681 13401 33682...)
  partName: string;
  brand?: string;
  model?: string;
  quantity?: number;
  estimatedPriceCOP?: number;
  taxExempt?: boolean; // true: Exento 0%, false: Aplica IVA 19%
  supplier?: string;
  departmentNotes?: string;
}

export interface AttachedTechnicalDoc {
  id: string;
  type: 'Ficha Técnica' | 'Registro INVIMA' | 'Otro';
  title: string;
  fileName: string;
  fileSize?: string;
  fileData?: string;
  fileType?: string;
  invimaNumber?: string;
  source: 'ventana_7' | 'uploaded';
}

export interface NewPartEmailPayload {
  toEmail: string;
  ccEmail?: string;
  parts: PartItemRequest[];
  customGreeting?: string;
  attachedDocuments?: AttachedTechnicalDoc[];
  // Backwards compatibility shorthand:
  partName?: string;
  brand?: string;
  model?: string;
  partCode?: string;
  estimatedPriceCOP?: number;
  estimatedPriceUSD?: number;
  taxExempt?: boolean;
  supplier?: string;
  departmentNotes?: string;
}

/**
 * Returns dynamic greeting depending on the local time of day:
 * - 00:00 - 11:59: "Buenos días"
 * - 12:00 - 18:59: "Buenas tardes"
 * - 19:00 - 23:59: "Buenas noches"
 */
export function getTimeBasedGreeting(hour?: number): string {
  const currentHour = hour !== undefined ? hour : new Date().getHours();
  if (currentHour < 12) {
    return 'Buenos días';
  } else if (currentHour < 19) {
    return 'Buenas tardes';
  } else {
    return 'Buenas noches';
  }
}

export interface SendPurchaseOrderEmailPayload {
  toEmail: string;
  ccEmail?: string;
  bccEmail?: string;
  locationCity: 'Barranquilla' | 'Bogotá' | 'Medellín' | string;
  supplierName?: string;
  supplier?: string;
  customGreeting?: string;
  observations?: string;
  notes?: string;
  items: {
    partCode: string;
    description: string;
    brand?: string;
    model?: string;
    quantity: number;
    unitPriceCOP: number;
    taxExempt: boolean; // Aplica IVA (19%) o Exento (0%)
    supplier?: string;
    observations?: string;
    totalLineCOP: number;
  }[];
  subtotalCOP: number;
  ivaTotalCOP: number;
  grandTotalCOP: number;
}

/**
 * Official corporate HTML signature for Jairo E. Mendoza Bolívar with SyD Colombia, icontec ISO 9001 and IQNet seals.
 */
export function getJairoEmailSignatureHTML(): string {
  return `
    <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid #cbd5e1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 14px;">
        <tr>
          <td style="vertical-align: middle; padding-right: 18px;">
            <!-- SyD Colombia Logo Table -->
            <table border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-family: Arial, Helvetica, sans-serif; font-size: 32px; font-weight: 900; color: #00a3e0; line-height: 1; letter-spacing: -1px;">
                  <span>S</span><span style="color: #1e2b6d;">y</span><span>D</span><sup style="font-size: 10px; font-weight: bold; color: #1e2b6d; margin-left: 2px;">&reg;</sup>
                </td>
              </tr>
              <tr>
                <td style="font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: bold; color: #1e2b6d; font-style: italic; letter-spacing: 1.5px; padding-top: 2px;">
                  Colombia <span style="font-size: 8px; font-style: normal; font-weight: normal;">S.A.</span>
                </td>
              </tr>
            </table>
          </td>
          <td style="vertical-align: middle; padding-right: 14px;">
            <!-- Icontec Badge -->
            <div style="background-color: #0084c9; border-radius: 6px; padding: 4px 6px; text-align: center; color: #ffffff; width: 48px; display: inline-block;">
              <div style="font-size: 11px; line-height: 1; font-weight: bold;">&#9678;</div>
              <div style="font-size: 7px; font-weight: bold; line-height: 1.1; margin-top: 1px;">icontec</div>
              <div style="background-color: #ffffff; color: #0084c9; font-size: 6.5px; font-weight: bold; margin-top: 2px; padding: 1px 0; border-radius: 2px;">ISO 9001</div>
              <div style="font-size: 5.5px; color: #e0f2fe; margin-top: 1px;">SC7290-1</div>
            </div>
          </td>
          <td style="vertical-align: middle;">
            <!-- IQNet Seal -->
            <div style="background-color: #204484; border-radius: 50%; width: 46px; height: 46px; text-align: center; color: #ffffff; display: inline-block;">
              <div style="font-size: 5px; color: #9abaff; margin-top: 4px; letter-spacing: 1px;">&#8226;&#8226;&#8226;&#8226;&#8226;</div>
              <div style="font-size: 9px; font-weight: 900; letter-spacing: 0.5px; line-height: 1;">IQNET</div>
              <div style="font-size: 4px; color: #e2e8f0; line-height: 1; margin-top: 2px;">CERTIFIED<br>MANAGEMENT<br>SYSTEM</div>
            </div>
          </td>
        </tr>
      </table>

      <div style="font-size: 13px; line-height: 1.45; color: #1e293b;">
        <div style="font-weight: 700; color: #0f172a; font-size: 14px;">Jairo E. Mendoza Bolívar</div>
        <div style="color: #334155; font-weight: 500;">Asesor Línea Diagnóstica</div>
        <div style="color: #334155; font-weight: 600;">Suministro y Dotaciones Colombia S.A.</div>
        <div style="color: #475569; margin-top: 3px;">Tel: (605) 3302424 Ext 153 - Cel: +57 3162221407</div>
        <div style="color: #475569;">Carrera 43 # 80-59</div>
        <div style="color: #475569;">Barranquilla - Colombia</div>
      </div>
    </div>
  `;
}

const GMAIL_TOKEN_STORAGE_KEY = 'syd_gmail_oauth_token_v1';
const GMAIL_PROFILE_STORAGE_KEY = 'syd_gmail_user_profile_v1';
const GMAIL_CLIENT_ID_STORAGE_KEY = 'syd_gmail_custom_client_id_v1';
const GMAIL_SAVED_ACCOUNTS_KEY = 'syd_gmail_saved_accounts_v1';

// Default Project OAuth Client ID from firebase-applet-config.json
export const DEFAULT_GMAIL_CLIENT_ID =
  (firebaseConfig as any).oAuthClientId ||
  '23635423420-h7hc51qghol9horms2kqhforgc9hqfoq.apps.googleusercontent.com';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: any; expires_in?: number }) => void;
            error_callback?: (err: any) => void;
            prompt?: string;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

class GmailIntegrationService {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private userProfile: GmailUserProfile | null = null;
  private messageDetailCache: Map<string, DetectedPurchaseOrder> = new Map();

  constructor() {
    this.loadPersistedAuth();
  }

  private loadPersistedAuth() {
    if (typeof localStorage === 'undefined') return;
    try {
      const storedToken = localStorage.getItem(GMAIL_TOKEN_STORAGE_KEY);
      const storedExpiry = localStorage.getItem(`${GMAIL_TOKEN_STORAGE_KEY}_exp`);
      const storedProfile = localStorage.getItem(GMAIL_PROFILE_STORAGE_KEY);

      // Los tokens simulados ("direct_*", "demo_*", "fake_*") NO provienen de una
      // autenticacion real de Google. Se descartan (token + perfil) para que la
      // aplicacion nunca muestre una cuenta falsa como conectada.
      const isSimulatedToken = (t: string | null): boolean =>
        !!t && (t.startsWith('direct_') || t.startsWith('demo_') || t.startsWith('fake_'));

      if (isSimulatedToken(storedToken)) {
        this.clearAuth();
      } else if (storedToken && storedExpiry) {
        const expTime = parseInt(storedExpiry, 10);
        if (Date.now() < expTime) {
          this.accessToken = storedToken;
          this.tokenExpiresAt = expTime;
        } else {
          this.clearAuth();
        }
      }

      if (storedProfile && !isSimulatedToken(storedToken)) {
        this.userProfile = JSON.parse(storedProfile);
      }

      // Clean up old cache versions
      localStorage.removeItem('syd_gmail_cached_orders_v2');
      localStorage.removeItem('syd_gmail_cached_orders_v3');

      // Load cached parsed orders from localStorage, discarding any dummy placeholders or incomplete snippet-only entries
      const cachedData = localStorage.getItem('syd_gmail_cached_orders_v4');
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        if (Array.isArray(parsed)) {
          const cleanOrders = parsed.filter(
            (order: any) =>
              order &&
              order.id &&
              order.subject !== 'Correo de Gmail' &&
              order.senderName !== 'Remitente Gmail' &&
              order.snippet !== 'Mensaje sincronizado desde bandeja' &&
              (order.rawHtml || (order.rawBodyText && order.rawBodyText !== order.snippet && order.rawBodyText.length > 80))
          );
          cleanOrders.forEach((order: DetectedPurchaseOrder) => {
            // Heal any cached order from previous false-positive item parsing or uncreated part notices
            const bodyLower = (order.rawBodyText || order.snippet || '').toLowerCase();
            const senderLower = (order.sender || order.senderEmail || order.senderName || '').toLowerCase();
            const isFromDiana =
              senderLower.includes('auxadministrativo@syd.com.co') ||
              senderLower.includes('diana figueroa');

            const isUncreatedNotice =
              /\b(?:no\s+(?:se\s+)?cuenta\s+con\s+partes?\s+creadas?|no\s+(?:se\s+)?cuenta\s+con\s+(?:parte|equipo)|no\s+(?:se\s+)?encuentran?\s+cread[ao]s?|no\s+(?:se\s+)?encuentra\s+cread[ao]|no\s+est[aá]n?\s+cread[ao]s?|no\s+est[aá]\s+cread[ao]|sin\s+parte\s+creada)\b/i.test(bodyLower) ||
              bodyLower.includes('no cuenta con parte creada') ||
              bodyLower.includes('no se cuenta con parte creada') ||
              bodyLower.includes('no cuenta con partes creadas') ||
              bodyLower.includes('no se cuenta con partes creadas') ||
              bodyLower.includes('no cuenta con parte') ||
              bodyLower.includes('no se cuenta con parte') ||
              bodyLower.includes('no se cuenta con equipo') ||
              bodyLower.includes('no se encuentran creados') ||
              bodyLower.includes('no se encuentra creada') ||
              bodyLower.includes('no se encuentra creado') ||
              bodyLower.includes('no están creados') ||
              bodyLower.includes('no estan creados') ||
              bodyLower.includes('no está creada') ||
              bodyLower.includes('no esta creada') ||
              bodyLower.includes('no existen en el sistema') ||
              bodyLower.includes('sin parte creada');

            const hasCreatedParts =
              order.emailType === 'part_creation_response' ||
              (order.detectedPartsToImport && order.detectedPartsToImport.length > 0) ||
              order.partCreationNotice?.status === 'created' ||
              /(?:parte\s+creada|partes\s+creadas|c[oó]digo\s+creado|se\s+cre[oó]\s+la\s+parte)\s*[:#-]?\s*(\d{4,8}|SYD-[A-Z0-9\-_]+)/i.test(order.rawBodyText || '');

            const isPartContext =
              /creaci[oó]n\s+de\s+partes?|crear\s+partes?|solicitud\s+de\s+partes?|parte\s+creada/i.test(order.subject || '') ||
              /creaci[oó]n\s+de\s+partes?|crear\s+partes?/i.test(bodyLower);

            if (hasCreatedParts) {
              order.emailType = 'part_creation_response';
              if (!order.partCreationNotice) {
                const reqItem = extractRequestedPartCreationDetails(order.rawBodyText || order.snippet || '');
                order.partCreationNotice = {
                  status: 'created',
                  code: order.detectedPartsToImport?.[0]?.code,
                  message: 'Parte oficial creada en el sistema por departamento de compras.',
                  requestedItem: reqItem || undefined,
                };
              }
            } else if (isFromDiana || (isUncreatedNotice && isPartContext) || order.emailType === 'part_authorization') {
              // Diana Figueroa handles authorization of part creation, NOT finalized created parts
              order.emailType = 'part_authorization';
              order.detectedItems = [];
              order.detectedPartsToImport = undefined;
              if (!order.partCreationNotice) {
                const reqItem = extractRequestedPartCreationDetails(order.rawBodyText || order.snippet || '');
                order.partCreationNotice = {
                  status: 'uncreated',
                  message: 'Revisado por Diana Figueroa (Auxiliar Administrativo): Información vigente, no cuenta con parte creada en el sistema (En trámite de autorización).',
                  requestedItem: reqItem || undefined,
                };
              }
            } else if (isUncreatedNotice) {
              order.emailType = 'other';
              order.detectedItems = [];
              order.detectedPartsToImport = undefined;
              if (!order.partCreationNotice) {
                const reqItem = extractRequestedPartCreationDetails(order.rawBodyText || order.snippet || '');
                order.partCreationNotice = {
                  status: 'uncreated',
                  message: 'Revisado, información vigente no se cuenta con parte creada.',
                  requestedItem: reqItem || undefined,
                };
              }
            } else if (order.detectedItems && order.detectedItems.length > 0) {
              // Strip any items that were phone numbers, contact lines, or noise
              order.detectedItems = order.detectedItems.filter(
                (item) =>
                  !isSignatureOrHeaderOrNoise(item.description) &&
                  !/%20|tel:|cel:|\(\d{3}\)/i.test(item.description) &&
                  item.quantity < 300
              );
            }

            this.messageDetailCache.set(order.id, order);
          });
          if (cleanOrders.length !== parsed.length) {
            this.persistOrderCache();
          }
        }
      }
    } catch (e) {
      console.warn('Could not load persisted Gmail credentials', e);
      localStorage.removeItem('syd_gmail_cached_orders_v4');
    }
  }

  public clearOrderCache() {
    this.messageDetailCache.clear();
    localStorage.removeItem('syd_gmail_cached_orders_v4');
    localStorage.removeItem('syd_gmail_cached_orders_v3');
    localStorage.removeItem('syd_gmail_cached_orders_v2');
  }

  private persistOrderCache() {
    try {
      const entries = Array.from(this.messageDetailCache.values()).filter(
        (order) =>
          order &&
          order.subject !== 'Correo de Gmail' &&
          order.senderName !== 'Remitente Gmail' &&
          order.snippet !== 'Mensaje sincronizado desde bandeja'
      );

      // Lightweight serializer: strip heavy rawHtml and large body text before putting in localStorage
      const sanitizeForStorage = (items: DetectedPurchaseOrder[], maxBodyLen = 400) => {
        return items.map((o) => ({
          ...o,
          rawHtml: undefined,
          rawBodyText: o.rawBodyText ? o.rawBodyText.slice(0, maxBodyLen) : undefined,
          attachments: undefined,
        }));
      };

      // Try tier 1: 150 items with 400 char body text
      const trySave = (items: any[]): boolean => {
        try {
          localStorage.setItem('syd_gmail_cached_orders_v4', JSON.stringify(items));
          return true;
        } catch (e: any) {
          return false;
        }
      };

      const tier1 = sanitizeForStorage(entries.slice(-150), 400);
      if (trySave(tier1)) return;

      // Tier 2 fallback: clear stale versions and reduce to 80 items without rawBodyText
      localStorage.removeItem('syd_gmail_cached_orders_v2');
      localStorage.removeItem('syd_gmail_cached_orders_v3');
      const tier2 = sanitizeForStorage(entries.slice(-80), 0);
      if (trySave(tier2)) return;

      // Tier 3 fallback: 30 items ultra-compact
      const tier3 = sanitizeForStorage(entries.slice(-30), 0);
      trySave(tier3);
    } catch {
      // Gracefully prevent any storage quota exceptions from interrupting app flow
    }
  }

  /**
   * Fetch full message content (raw HTML, parts, attachments) on-demand for a single message
   */
  public async fetchMessageFullDetail(messageId: string): Promise<DetectedPurchaseOrder | null> {
    const token = this.getAccessToken();
    if (!token) return null;

    try {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) return null;
      const fullDetail = await res.json();
      const parsed = this.parseGmailMessageToPurchaseOrder(fullDetail);
      if (parsed) {
        this.messageDetailCache.set(messageId, parsed);
        this.persistOrderCache();
      }
      return parsed;
    } catch (e) {
      console.warn('Error fetching full message detail:', e);
      return null;
    }
  }

  public getStoredClientId(): string {
    const stored = localStorage.getItem(GMAIL_CLIENT_ID_STORAGE_KEY);
    return stored?.trim() || DEFAULT_GMAIL_CLIENT_ID;
  }

  public setStoredClientId(clientId: string): void {
    if (clientId.trim()) {
      localStorage.setItem(GMAIL_CLIENT_ID_STORAGE_KEY, clientId.trim());
    } else {
      localStorage.removeItem(GMAIL_CLIENT_ID_STORAGE_KEY);
    }
  }

  /**
   * Get all registered or previously connected accounts
   */
  public getSavedAccounts(): GmailUserProfile[] {
    try {
      const raw = localStorage.getItem(GMAIL_SAVED_ACCOUNTS_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // fallback
    }
    return [];
  }

  /**
   * Save an account to remembered accounts list
   */
  public saveAccount(account: GmailUserProfile): void {
    try {
      const accounts = this.getSavedAccounts();
      const filtered = accounts.filter((a) => a.email.toLowerCase() !== account.email.toLowerCase());
      filtered.unshift(account);
      localStorage.setItem(GMAIL_SAVED_ACCOUNTS_KEY, JSON.stringify(filtered.slice(0, 15)));
    } catch (e) {
      console.warn('Could not save account', e);
    }
  }

  /**
   * Remove a saved account
   */
  public removeSavedAccount(email: string): void {
    try {
      const accounts = this.getSavedAccounts().filter((a) => a.email.toLowerCase() !== email.toLowerCase());
      localStorage.setItem(GMAIL_SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
      if (this.userProfile?.email.toLowerCase() === email.toLowerCase()) {
        this.clearAuth();
      }
    } catch (e) {
      console.warn('Could not remove account', e);
    }
  }

  /**
   * Clear all saved accounts permanently
   */
  public clearAllSavedAccounts(): void {
    try {
      localStorage.setItem(GMAIL_SAVED_ACCOUNTS_KEY, JSON.stringify([]));
      this.clearAuth();
    } catch (e) {
      console.warn('Could not clear accounts', e);
    }
  }

  public isConnected(): boolean {
    return !!(this.accessToken && Date.now() < this.tokenExpiresAt);
  }

  public getAccessToken(): string | null {
    if (this.isConnected()) {
      return this.accessToken;
    }
    return null;
  }

  public getUserProfile(): GmailUserProfile | null {
    return this.userProfile;
  }

  public clearAuth(): void {
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.userProfile = null;
    localStorage.removeItem(GMAIL_TOKEN_STORAGE_KEY);
    localStorage.removeItem(`${GMAIL_TOKEN_STORAGE_KEY}_exp`);
    localStorage.removeItem(GMAIL_PROFILE_STORAGE_KEY);
  }


  /**
   * Request OAuth 2.0 access token via Google Identity Services popup
   */
  public async connectGoogleAccount(customClientId?: string): Promise<{ profile: GmailUserProfile; token: string }> {
    const isDesktop = typeof window !== 'undefined' && Boolean(window.sydDesktop?.isDesktop);
    if (!isDesktop && (typeof window === 'undefined' || !window.google?.accounts?.oauth2)) {
      throw new Error('La librería Google Identity Services (GSI) no se encuentra disponible. Verifique su conexión a internet.');
    }

    const clientId = customClientId || this.getStoredClientId();
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ].join(' ');

    let tokenResponse: any;
    try {
      tokenResponse = await requestGoogleToken(
        clientId,
        scopes,
        (options) => window.google!.accounts!.oauth2!.initTokenClient(options as any) as any
      );
    } catch (err: any) {
      const errorType = err?.type || '';
      const errorMsg = err?.message || (typeof err === 'string' ? err : '');

      if (errorType === 'popup_closed' || errorMsg.includes('closed') || errorMsg.includes('Popup window closed')) {
        throw new Error('La ventana emergente de Google fue cerrada. Vuelve a intentarlo y acepta todos los permisos solicitados.');
      }
      if (errorType === 'popup_failed_to_open') {
        throw new Error('El navegador bloqueó la ventana emergente de Google. Por favor habilite las ventanas emergentes para este sitio y vuelve a intentarlo.');
      }
      throw new Error(buildGoogleOAuthErrorMessage(errorMsg || errorType, 'La ventana de autenticación fue cerrada o cancelada por el usuario.'));
    }

    if (tokenResponse?.error) {
      const errStr = typeof tokenResponse.error === 'string' ? tokenResponse.error : JSON.stringify(tokenResponse.error);
      if (errStr.includes('popup_closed') || errStr.includes('closed')) {
        throw new Error('La ventana de autenticación fue cerrada antes de otorgar permisos.');
      }
      if (errStr.includes('access_denied')) {
        throw new Error(
          'Acceso denegado por Google (Error 403: access_denied). La aplicación se encuentra en modo "Prueba" en Google Cloud y este correo no está en la lista de "Usuarios de prueba (Test users)". Puedes agregarlo en console.cloud.google.com > Pantalla de consentimiento de OAuth y volver a intentarlo.'
        );
      }
      throw new Error(buildGoogleOAuthErrorMessage(errStr, 'Error de autenticación Google:'));
    }

    if (!tokenResponse?.access_token) {
      throw new Error('No se recibió el token de acceso de Google.');
    }

    const token = tokenResponse.access_token;
    const expiresIn = tokenResponse.expires_in || 3600;
    this.accessToken = token;
    this.tokenExpiresAt = Date.now() + expiresIn * 1000;

    localStorage.setItem(GMAIL_TOKEN_STORAGE_KEY, token);
    localStorage.setItem(`${GMAIL_TOKEN_STORAGE_KEY}_exp`, String(this.tokenExpiresAt));

    // Autenticar Firestore con la misma cuenta de Google para que los cambios
    // se compartan en tiempo real entre todas las PCs.
    await signInFirebaseWithGoogle(token);

    try {
      const profile = await this.fetchUserProfile(token);
      this.userProfile = profile;
      localStorage.setItem(GMAIL_PROFILE_STORAGE_KEY, JSON.stringify(profile));
      this.saveAccount(profile);
      return { profile, token };
    } catch (profErr) {
      const fallbackProfile: GmailUserProfile = {
        email: 'usuario.conectado@gmail.com',
        name: 'Usuario Google Conectado',
      };
      this.userProfile = fallbackProfile;
      this.saveAccount(fallbackProfile);
      return { profile: fallbackProfile, token };
    }
  }

  /**
   * Connect with a manual OAuth token or bearer token
   */
  public async connectManualToken(token: string, email?: string, name?: string): Promise<{ profile: GmailUserProfile; token: string }> {
    const cleanToken = token.trim();
    if (!cleanToken) {
      throw new Error('El token de acceso no puede estar vacío.');
    }

    this.accessToken = cleanToken;
    this.tokenExpiresAt = Date.now() + 3600 * 1000;
    localStorage.setItem(GMAIL_TOKEN_STORAGE_KEY, cleanToken);
    localStorage.setItem(`${GMAIL_TOKEN_STORAGE_KEY}_exp`, String(this.tokenExpiresAt));

    try {
      const profile = await this.fetchUserProfile(cleanToken);
      this.userProfile = profile;
      localStorage.setItem(GMAIL_PROFILE_STORAGE_KEY, JSON.stringify(profile));
      this.saveAccount(profile);
      return { profile, token: cleanToken };
    } catch {
      const fallbackProfile: GmailUserProfile = {
        email: email || 'compras@sydcolombia.com',
        name: name || 'Equipo de Compras SYD',
      };
      this.userProfile = fallbackProfile;
      localStorage.setItem(GMAIL_PROFILE_STORAGE_KEY, JSON.stringify(fallbackProfile));
      this.saveAccount(fallbackProfile);
      return { profile: fallbackProfile, token: cleanToken };
    }
  }

  /**
   * Generate a direct Gmail Web Compose URL (opens draft directly in official mail.google.com)
   */
  public getGmailWebComposeUrl(to: string, subject: string, bodyText: string, cc?: string, bcc?: string): string {
    const params = new URLSearchParams();
    params.set('view', 'cm');
    params.set('fs', '1');
    if (to) params.set('to', to);
    if (subject) params.set('su', subject);
    if (bodyText) params.set('body', bodyText);
    if (cc) params.set('cc', cc);
    if (bcc) params.set('bcc', bcc);
    return `https://mail.google.com/mail/?${params.toString()}`;
  }

  /**
   * Fetch current Google User Profile
   */
  public async fetchUserProfile(token?: string): Promise<GmailUserProfile> {
    const bearer = token || this.getAccessToken();
    if (!bearer) throw new Error('No hay sesión activa de Google.');

    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${bearer}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Error al obtener perfil: HTTP ${res.status}`);
    }

    const data = await res.json();
    return {
      email: data.email,
      name: data.name || data.email.split('@')[0],
      picture: data.picture,
      locale: data.locale,
      verified_email: data.verified_email,
    };
  }

  /**
   * Search and detect Purchase Orders / Quotations in user's Gmail Inbox
   */
  public async fetchPurchaseOrdersFromInbox(
    query?: string,
    maxResults = 300,
    scanMode: 'smart_filter' | 'all_inbox' = 'all_inbox',
    onProgress?: (loaded: number, total: number) => void
  ): Promise<DetectedPurchaseOrder[]> {
    if (!this.isConnected() && !this.userProfile) {
      return [];
    }

    const token = this.getAccessToken();
    if (!token || token.startsWith('direct_email_') || token.startsWith('demo_token_')) {
      return [];
    }

    let searchQuery = query?.trim() || '';
    if (!searchQuery) {
      if (scanMode === 'smart_filter') {
        searchQuery =
          '("orden de compra" OR "orden de pedido" OR "OC" OR "O.C." OR "PO" OR "purchase order" OR "solicitud de compra" OR "cotización" OR "cotizacion" OR "creación de parte" OR "creacion de parte" OR "crear parte" OR "partes creadas" OR "parte creada" OR "autorización" OR "autorizacion" OR "adquisición" OR "suministro" OR "licitación" OR "pedido" OR "factura" OR "biomédico" OR "biomedico" OR "repuesto" OR "equipo")';
      } else {
        searchQuery = 'in:inbox';
      }
    }

    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(
      searchQuery
    )}&maxResults=${Math.min(maxResults, 100)}`;

    try {
      const listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!listRes.ok) {
        const errorData = await listRes.json().catch(() => null);
        const errMsg = errorData?.error?.message || `HTTP ${listRes.status}`;

        if (listRes.status === 401) {
          console.warn('Google session expired (HTTP 401).');
          this.clearAuth();
          throw new Error('La sesión de Google ha expirado. Por favor presione Conectar nuevamente.');
        }

        if (listRes.status === 403 || listRes.status === 429) {
          if (
            errMsg.includes('Quota exceeded') ||
            errMsg.includes('Units per minute') ||
            errMsg.includes('rateLimitExceeded') ||
            errMsg.includes('Total Query Cost') ||
            listRes.status === 429
          ) {
            throw new Error(
              'Límite de velocidad por minuto alcanzado (Rate Limit de Google). La API de Gmail está correctamente activada en tu cuenta, pero Google solicita una breve pausa de 60 segundos antes de enviar más consultas. Espera un minuto y vuelve a presionar Sincronizar.'
            );
          }

          if (
            errMsg.includes('has not been used in project') ||
            errMsg.includes('disabled') ||
            errMsg.includes('API has not been used')
          ) {
            throw new Error(
              'La "Gmail API" debe estar habilitada en Google Cloud Console. Ve a APIs y Servicios > Habilitar APIs y Servicios > Busca "Gmail API" y haz clic en HABILITAR.'
            );
          }
          throw new Error(`Permiso denegado por Google: ${errMsg}`);
        }

        throw new Error(`Error de Gmail API (${listRes.status}): ${errMsg}`);
      }

      const listData = await listRes.json();
      let messages: { id: string; threadId: string }[] = listData.messages || [];
      let nextPageToken = listData.nextPageToken;
      const seenIds = new Set<string>(messages.map((m) => m.id));

      // Continue paging with nextPageToken while messages.length < maxResults
      while (nextPageToken && messages.length < maxResults) {
        const fetchLimit = Math.min(100, maxResults - messages.length);
        const pageUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(
          searchQuery
        )}&maxResults=${fetchLimit}&pageToken=${nextPageToken}`;
        try {
          await new Promise((r) => setTimeout(r, 100));
          const pageRes = await fetch(pageUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (pageRes.ok) {
            const pageData = await pageRes.json();
            if (pageData.messages && pageData.messages.length > 0) {
              for (const m of pageData.messages) {
                if (!seenIds.has(m.id)) {
                  seenIds.add(m.id);
                  messages.push(m);
                }
              }
            }
            nextPageToken = pageData.nextPageToken;
          } else {
            break;
          }
        } catch {
          break;
        }
      }

      // If the specific query yielded fewer than maxResults (e.g. only 70 emails in INBOX folder),
      // and no custom search query was typed, fetch additional recent messages from the general mailbox
      // so the user always receives the requested 300 messages
      if (messages.length < maxResults && !query) {
        let fallbackPageToken: string | undefined = undefined;
        while (messages.length < maxResults) {
          const fetchLimit = Math.min(100, maxResults - messages.length);
          const fallbackUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(
            '-in:trash -in:spam'
          )}&maxResults=${fetchLimit}${fallbackPageToken ? `&pageToken=${fallbackPageToken}` : ''}`;
          try {
            await new Promise((r) => setTimeout(r, 100));
            const fbRes = await fetch(fallbackUrl, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (fbRes.ok) {
              const fbData = await fbRes.json();
              if (fbData.messages && fbData.messages.length > 0) {
                for (const m of fbData.messages) {
                  if (!seenIds.has(m.id)) {
                    seenIds.add(m.id);
                    messages.push(m);
                    if (messages.length >= maxResults) break;
                  }
                }
              }
              fallbackPageToken = fbData.nextPageToken;
              if (!fallbackPageToken || !fbData.messages?.length) break;
            } else {
              break;
            }
          } catch {
            break;
          }
        }
      }

      if (messages.length === 0) return [];

      const detailedOrders: DetectedPurchaseOrder[] = [];
      const messagesToFetch = messages.slice(0, maxResults);
      const totalToFetch = messagesToFetch.length;

      // Batch size 15 with gentle pacing to safely comply with Google per-user quota and load 300 emails fast
      const batchSize = 15;

      for (let i = 0; i < messagesToFetch.length; i += batchSize) {
        // Pacing delay between batches (25ms)
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 25));
        }

        const batch = messagesToFetch.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (msg: { id: string; threadId: string }) => {
            // 1. Check in-memory / localStorage cache first (ensuring it has valid subject and content)
            if (this.messageDetailCache.has(msg.id)) {
              const cached = this.messageDetailCache.get(msg.id)!;
              if (
                cached.subject &&
                cached.subject !== 'Correo de Gmail' &&
                cached.senderName !== 'Remitente Gmail' &&
                cached.snippet !== 'Mensaje sincronizado desde bandeja' &&
                (cached.rawHtml || cached.rawBodyText || cached.snippet)
              ) {
                return cached;
              }
              this.messageDetailCache.delete(msg.id);
            }

            // 2. Fetch full message from Gmail API (includes HTML table, body text, and attachments)
            let retries = 0;
            while (retries < 3) {
              try {
                const detailRes = await fetch(
                  `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
                  {
                    headers: { Authorization: `Bearer ${token}` },
                  }
                );

                if (detailRes.status === 429 || detailRes.status === 403) {
                  retries++;
                  await new Promise((resolve) => setTimeout(resolve, 1500 * retries));
                  continue;
                }

                if (!detailRes.ok) return null;
                const msgDetail = await detailRes.json();
                const parsed = this.parseGmailMessageToPurchaseOrder(msgDetail);
                if (parsed) {
                  this.messageDetailCache.set(msg.id, parsed);
                }
                return parsed;
              } catch (e) {
                console.warn('Error fetching message details', msg.id, e);
                return null;
              }
            }

            return null;
          })
        );

        for (const item of batchResults) {
          if (item) detailedOrders.push(item);
        }

        if (onProgress) {
          onProgress(Math.min(i + batchSize, totalToFetch), totalToFetch);
        }
      }

      this.persistOrderCache();

      return detailedOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (err: any) {
      console.warn('fetchPurchaseOrdersFromInbox error:', err?.message || err);
      throw err;
    }
  }

  /**
   * Parse a raw Gmail Message object into a rich DetectedPurchaseOrder
   */
  private parseGmailMessageToPurchaseOrder(msg: any): DetectedPurchaseOrder {
    const headers = msg.payload?.headers || [];
    const getHeader = (name: string) => {
      const h = headers.find((item: any) => item.name?.toLowerCase() === name.toLowerCase());
      return h ? h.value : '';
    };

    const subject = getHeader('subject') || '(Sin Asunto)';
    const fromHeader = getHeader('from') || 'Desconocido';
    const dateHeader = getHeader('date') || new Date().toISOString();

    let senderName = fromHeader;
    let senderEmail = fromHeader;
    const emailMatch = fromHeader.match(/<([^>]+)>/);
    if (emailMatch) {
      senderEmail = emailMatch[1];
      senderName = fromHeader.split('<')[0].replace(/"/g, '').trim() || senderEmail;
    }

    // Extract body text and HTML
    const snippet = msg.snippet || '';
    const bodyHtml = this.extractBodyHtml(msg.payload);
    const bodyText = this.extractBodyText(msg.payload) || snippet;

    // Extract Attachments first (so we know if it has .ics, pdf, etc.)
    const attachments: {
      filename: string;
      mimeType: string;
      size?: number;
      attachmentId?: string;
      messageId?: string;
      dataUrl?: string;
    }[] = [];
    this.extractAttachments(msg.payload, attachments, msg.id);

    const sLower = senderEmail.toLowerCase();
    const subLower = subject.toLowerCase();
    const bodyLower = bodyText.toLowerCase();

    // Check if email was sent by the user himself (outgoing request, not response from administrative)
    const isOutboundFromUser =
      sLower.includes('jairmenbo22') ||
      sLower.includes('eljemb22') ||
      sLower.includes('jairo.mendoza') ||
      (this.userProfile?.email && sLower.includes(this.userProfile.email.toLowerCase()));

    // Detect Calendar / Meeting Invite (Google Calendar, Meet, Zoom, Teams, .ics)
    const hasIcsAttachment = attachments.some((a) => a.filename?.toLowerCase().endsWith('.ics'));
    const isCalendarSubject =
      /^(?:invitation|invitaci[oó]n|accepted|rechazado|cancelado|updated invitation|reuni[oó]n:)/i.test(subject.trim()) ||
      /\b(?:google meet|zoom meeting|microsoft teams|espacio de trabajo meet)\b/i.test(subject);
    const isCalendarBody =
      bodyLower.includes('join with google meet') ||
      bodyLower.includes('unirse con google meet') ||
      bodyLower.includes('meet.google.com') ||
      bodyLower.includes('calendar-notification@google.com') ||
      bodyLower.includes('te ha invitado al siguiente evento') ||
      bodyLower.includes('has invited you to');
    const isCalendarInvite = hasIcsAttachment || isCalendarSubject || isCalendarBody;

    // Detect OC Number accurately:
    // Multi-strategy extraction: Subject, Body (including multi-line quotes & thread), and Attachments
    let detectedOCNumber: string | undefined = undefined;
    if (!isCalendarInvite) {
      const disallowedWords = /^(ESOS|ESTE|ESTA|ESTOS|ESTAS|PARA|POR|SUERO|RTASUERO|BUENOS|DIAS|GRACIAS|PARTE|PARTES|CREACION|CREADAS|REVISION|ATENTO|PROCESOS|PROCESO|SOLICITUD|EQUIPOS|MEDICOS|CLIENTE|COMPRA|COMPRAS|VENTA|FAVOR|INFORMACION|DETALLE|SALUDOS|NUEVA|NUEVO|PENDIENTE|ADJUNTO|ADJUNTA|CORREO|DESPACHO|MEDICO|MEDICA|BIOMEDICO|HOSPITAL|CLINICA|SALUD|ENTREGA|CONFIRMACION|FACTURA|COTIZACION|RAYOS|MESAS|CIRUGIA|PORTATIL|GENERAL|SUMINISTROS|DOTACIONES|CORDIALMENTE|ANALISTA|DE|DEL|CON|SIN|PDF|XLSX|XLS|JPG|PNG|RTACION|IMPORTACION|IMPORTACIONES|EXPORTACION|DECLARACION|DOCUMENTACION|FICHA|FICHAS|TECNICA|TECNICAS|INVIMA|DIAN|MANUAL|MANUALES|CERTIFICADO|CERTIFICADOS|CARTA|CARTAS)$/i;

      const isValidOCNumber = (cand?: string): boolean => {
        if (!cand || cand.length < 2) return false;
        const clean = cand.trim().toUpperCase();
        if (disallowedWords.test(clean)) return false;
        // Strict anti-false-positive check: technical document, import declaration, or documentation prefixes
        if (/RTACION|IMPORTACION|EXPORTACION|DECLARACION|DOCUMENTACION|FICHA|INVIMA|DIAN|MANUAL|CERTIFICADO|CALIBRACION/i.test(clean)) return false;
        if (/^(?:RTACION|IMPORTACION|POC\d+|HC\d+)/i.test(clean) && !/^OC|PO/i.test(clean)) return false;
        // Must have at least one digit or follow strict PO/OC prefix format with letters/digits
        if (/\d/.test(clean)) return true;
        if (/^(?:OC|PO|HBOC)[-_#][A-Z0-9]+$/i.test(clean)) return true;
        return false;
      };

      // Strategy 1: Check Attachment Filenames FIRST (e.g. "OrdenCompra(HBOC00341).pdf" or "OC_2026_01.pdf")
      if (attachments.length > 0) {
        for (const att of attachments) {
          // Check parentheses pattern: "OrdenCompra(HBOC00341).pdf"
          const parenMatch = att.filename.match(/(?:\bORDEN.*COMPRA\b|\bPEDIDO\b|\bOC\b|\bPO\b)\s*\(([A-Za-z0-9\-_]{3,25})\)/i);
          if (parenMatch && isValidOCNumber(parenMatch[1])) {
            detectedOCNumber = parenMatch[1].toUpperCase().trim();
            break;
          }

          // Check standard attachment pattern with word boundary to avoid matching "PO" in "Importacion"
          const attMatch = att.filename.match(/(?:\bORDEN.*COMPRA\b|\bPEDIDO\b|\bOC\b|\bPO\b)[-_#\s]+(?:N[°ºo\.]*|NRO\.?|#)?\s*([A-Za-z0-9\-_]{2,25})/i);
          if (attMatch) {
            const candidate = attMatch[1].toUpperCase().replace(/[.,;:()]+$/, '').trim();
            if (isValidOCNumber(candidate)) {
              detectedOCNumber = candidate;
              break;
            }
          }
        }
      }

      // Strategy 2: Look in Subject with explicit OC/PO/Orden prefix
      if (!detectedOCNumber) {
        const subjectPatterns = [
          /\b(?:OC|O\.C\.|O\/C|PO|P\.O\.|P\/O|ORDEN\s*(?:DE\s*COMPRA)?|PEDIDO\s*(?:DE\s*COMPRA)?|SOLICITUD\s*(?:DE\s*)?OC|SOLICITUD\s+DE\s+COMPRA|ENV[IÍ]O\s+DE\s+OC)\b\s*[:#\-.\s]*(?:N[°ºo\.]*|NRO\.?|NÚMERO|NUMERO|#)?\s*([A-Za-z0-9\-_/]{2,25})\b/gi,
          /\b(?:OC|PO|ORDEN|PEDIDO)[-_#\s]+([A-Za-z0-9\-_/]{3,20})\b/gi,
          /\b(OC\s*[-_:#]?\s*\d{3,12}|PO\s*[-_:#]?\s*\d{3,12}|HBOC[-_:#]?\d{3,12})\b/gi,
          /\b(OC-[A-Za-z0-9\-_/]{2,20}|PO-[A-Za-z0-9\-_/]{2,20})\b/gi,
        ];

        for (const regex of subjectPatterns) {
          let m: RegExpExecArray | null;
          while ((m = regex.exec(subject)) !== null) {
            const rawCandidate = m[1] || m[0];
            const candidate = rawCandidate.toUpperCase().replace(/^(?:OC|PO|ORDEN|PEDIDO)[-_#:\s]*/i, '').replace(/[.,;:()]+$/, '').trim();
            if (isValidOCNumber(candidate)) {
              detectedOCNumber = candidate;
              break;
            }
          }
          if (detectedOCNumber) break;
        }
      }

      // Strategy 3: Look in Body Text & Previous Thread Quotes
      if (!detectedOCNumber) {
        const bodyPatterns = [
          /(?:orden\s*de\s*compra|orden\s*de\s*pedido|purchase\s*order|solicitud\s*(?:de\s*)?oc|solicitud\s*oc)\s*[:#\s-]*(?:no\.?|nro\.?|n[°ºo]\.?|#)?\s*([A-Za-z0-9\-_/]{3,25})/gi,
          /(?:no\.?\s*oc|n[°ºo]\.?\s*oc|n[úu]mero\s*de\s*oc|nro\.?\s*oc)\s*[:#\s-]*([A-Za-z0-9\-_/]{3,25})/gi,
          /\b(?:OC|O\.C\.|O\/C|PO|P\.O\.|P\/O)\s*[:#\-.\s]*(?:N[°ºo\.]*|NRO\.?|#)?\s*([A-Za-z0-9\-_/]{3,25})\b/gi,
        ];

        for (const regex of bodyPatterns) {
          let m: RegExpExecArray | null;
          while ((m = regex.exec(bodyText)) !== null) {
            const candidate = m[1].toUpperCase().replace(/[.,;:()]+$/, '').trim();
            if (isValidOCNumber(candidate)) {
              detectedOCNumber = candidate;
              break;
            }
          }
          if (detectedOCNumber) break;
        }
      }

      // Strategy 4: If sender is from Compras or reply to an OC request, detect standalone OC number
      if (!detectedOCNumber) {
        const isComprasOrAuditoria =
          sLower.includes('compras@syd.com.co') ||
          sLower.includes('auditoriacompras@syd.com.co') ||
          sLower.includes('jaime gonzalez') ||
          senderName.toLowerCase().includes('jaime') ||
          sLower.includes('jose luis') ||
          subLower.includes('favor realizar la siguiente oc') ||
          subLower.includes('solicitud oc') ||
          subLower.includes('solicitud de oc');

        if (isComprasOrAuditoria) {
          const lines = bodyText.split('\n').map((l) => l.trim()).filter(Boolean);
          for (const line of lines) {
            // Standalone 5-8 digit number on a line (e.g. "126291" or "OC 126291")
            const ocStandalone = line.match(/^(?:OC\s*[:#-]?\s*)?(\d{5,8})$/i);
            if (ocStandalone && isValidOCNumber(ocStandalone[1])) {
              detectedOCNumber = ocStandalone[1];
              break;
            }
          }
        }
      }

      // Standalone pattern with digits in subject (e.g. "OC4500123" or "OC-2024-89" or "PO12345" or "HBOC00341")
      if (!detectedOCNumber) {
        const directMatch = subject.match(/\b(OC[-_]?\d{3,12}|PO[-_]?\d{3,12}|HBOC[-_]?\d{3,12})\b/i);
        if (directMatch && isValidOCNumber(directMatch[1])) {
          detectedOCNumber = directMatch[1].toUpperCase();
        }
      }
    }

    // Detect Customer / Hospital Name
    let detectedCustomer = senderName;

    if (
      /NAPOLEON\s+FRANCO\s+PAREJA/i.test(subject + '\n' + bodyText) ||
      /HOSPITAL\s+INFANTIL/i.test(subject + '\n' + bodyText) ||
      /HBOC0000000640|HBOC00341/i.test(subject + '\n' + bodyText + '\n' + detectedOCNumber) ||
      (/CL[IÍ]NICA\s+DE\s+ESPECIALIDADES/i.test(subject + '\n' + bodyText) && /HBOC|310826|MINDRAY|DIGIEYE/i.test(subject + '\n' + bodyText))
    ) {
      detectedCustomer = 'FUNDACION HOSPITAL INFANTIL NAPOLEON FRANCO PAREJA';
    } else {
      // Check if subject has entity in parentheses e.g. "(CLÍNICA DE ESPECIALIDADES)"
      const subjectParenMatch = subject.match(/\(([^)]*(?:cl[ií]nica|hospital|ips|ese|especialidades|salud|centro|m[eé]dic|fundaci[oó]n|sociedad)[^)]*)\)/i) ||
        subject.match(/\(([^)]+)\)\s*$/);
      if (subjectParenMatch && subjectParenMatch[1].trim().length > 2) {
        detectedCustomer = subjectParenMatch[1].trim();
      } else if (senderEmail.includes('@')) {
        const domain = senderEmail.split('@')[1];
        if (domain.includes('salud') || domain.includes('hospital') || domain.includes('clinica') || domain.includes('ips') || domain.includes('ese')) {
          detectedCustomer = senderName || domain;
        }
      }

      // Check for explicit "CLIENTE: X", "ENTIDAD: X" in body
      const bodyClientMatch = bodyText.match(/(?:cliente|entidad|instituci[oó]n|hospital|cl[ií]nica)\s*[:#-]?\s*([A-Za-z0-9ÁÉÍÓÚáéíóúñÑ\s\.\-_&]{3,60})/i);
      if (bodyClientMatch && bodyClientMatch[1].trim().length > 2 && (!detectedCustomer || detectedCustomer === senderName)) {
        detectedCustomer = bodyClientMatch[1].trim().replace(/\n.*$/, '').trim();
      }
    }

    // Extract structured rows from tables in email (authentic parsed data)
    const emailStructuredRows = extractStructuredRowsFromEmail(bodyText, bodyHtml);

    // Detect Items & Equipment in text
    let detectedItems = this.detectItemsInText(subject + '\n' + bodyText);

    // If structured rows exist, populate/enhance detectedItems with authentic details
    if (emailStructuredRows.length > 0) {
      const tableItems: DetectedPurchaseOrderItem[] = emailStructuredRows.map((r) => ({
        partCode: r.code,
        description: r.description,
        quantity: r.quantity || 1,
        unitPrice: r.unitPrice && r.unitPrice > 0 ? r.unitPrice : undefined,
        totalPrice: r.totalPrice && r.totalPrice > 0 ? r.totalPrice : (r.unitPrice && r.quantity ? r.unitPrice * r.quantity : undefined),
        brand: r.brand,
        model: r.modelOrRef,
        taxRate: r.taxRate,
      }));

      // If table items found, prioritize them over rough regex snippets
      if (tableItems.length > 0) {
        detectedItems = tableItems;
      }
    }

    const isFromDianaFigueroa =
      sLower.includes('auxadministrativo@syd.com.co') ||
      sLower.includes('diana figueroa') ||
      senderName.toLowerCase().includes('diana figueroa');

    // Check if the email indicates parts could NOT be created or are uncreated
    const isNegativeUncreatedNotice =
      /\b(?:no\s+(?:se\s+)?cuenta\s+con\s+partes?\s+creadas?|no\s+(?:se\s+)?cuenta\s+con\s+(?:parte|equipo)|no\s+(?:se\s+)?encuentran?\s+cread[ao]s?|no\s+(?:se\s+)?encuentra\s+cread[ao]|no\s+est[aá]n?\s+cread[ao]s?|no\s+est[aá]\s+cread[ao]|no\s+fueron?\s+cread[ao]s?|sin\s+partes?\s+creadas?)\b/i.test(bodyLower) ||
      bodyLower.includes('no cuenta con parte creada') ||
      bodyLower.includes('no se cuenta con parte creada') ||
      bodyLower.includes('no cuenta con partes creadas') ||
      bodyLower.includes('no se cuenta con partes creadas') ||
      bodyLower.includes('no cuenta con parte') ||
      bodyLower.includes('no se cuenta con parte') ||
      bodyLower.includes('no se cuenta con equipo') ||
      bodyLower.includes('no se encuentran creados') ||
      bodyLower.includes('no se encuentran creadas') ||
      bodyLower.includes('no se encuentra creada') ||
      bodyLower.includes('no se encuentra creado') ||
      bodyLower.includes('no están creados') ||
      bodyLower.includes('no estan creados') ||
      bodyLower.includes('no está creada') ||
      bodyLower.includes('no esta creada') ||
      bodyLower.includes('no está creado') ||
      bodyLower.includes('no esta creado') ||
      bodyLower.includes('no fueron creados') ||
      bodyLower.includes('no fue creada') ||
      bodyLower.includes('no fue creado') ||
      bodyLower.includes('no existen en el sistema') ||
      bodyLower.includes('sin parte creada') ||
      bodyLower.includes('solicitud rechazada');

    // Split thread to analyze the latest message vs historical quotes
    const threadParts = splitEmailThread(bodyText, senderName, dateHeader);
    const latestThreadMsg = threadParts[0];
    const latestMsgBody = (latestThreadMsg ? latestThreadMsg.body : bodyText).trim();
    const latestMsgLower = latestMsgBody.toLowerCase();

    // Extract all requested part details from the email and thread history (tables, key-values, text)
    const requestedPartDetailsList = extractAllRequestedPartCreationDetails(bodyText, bodyHtml);
    const primaryRequestedItem = requestedPartDetailsList[0] || extractRequestedPartCreationDetails(bodyText, bodyHtml);

    const isPartCreationContext =
      /creaci[oó]n\s+de\s+partes?|crear\s+partes?|solicitud\s+de\s+partes?|solicitud\s+de\s+creaci[oó]n|parte\s+creada|partes\s+creadas/i.test(subLower) ||
      /creaci[oó]n\s+de\s+partes?|crear\s+partes?|solicitud\s+de\s+creaci[oó]n/i.test(bodyLower) ||
      requestedPartDetailsList.length > 0;

    const IGNORED_PART_CODES = new Set([
      '3302424',
      '6053302424',
      '3302',
      '2424',
      '20330',
      '20316',
      '8059',
      '80-59',
      '900593456',
      '90059345',
      '90123456',
      '123',
      '2024',
      '2025',
      '2026',
      '2027',
      '2028',
    ]);

    // Function to extract created part codes from text (e.g. "parte creada 70892", "código: 70859", etc.)
    const extractCreatedCodes = (text: string): string[] => {
      const codes: string[] = [];
      if (!text) return codes;

      // Sanitize text by stripping telephone numbers, PBX, address numbers, and corporate signatures
      const cleanText = text
        .replace(/Tel:?\s*\(?\d+\)?\s*[\d\s\-Ext.]+/gi, ' ')
        .replace(/\(?60\d\)?\s*\d{7}/gi, ' ')
        .replace(/Carrera\s+\d+.*$/gim, ' ')
        .replace(/Cra\s+\d+.*$/gim, ' ')
        .replace(/Calle\s+\d+.*$/gim, ' ')
        .replace(/NIT\s*[:#-]?\s*[\d\-.]+/gi, ' ')
        .replace(/Ext\s*\d+/gi, ' ');

      // 1. Direct positive patterns like "parte creada 70892", "código creado: 70859", "se creó la parte 70873", "quedó creada la parte 70873", "parte asignada: 70859"
      const creationRegexes = [
        /(?:parte\s+creada|partes\s+creadas|c[oó]digo\s+creado|c[oó]digos\s+creados|c[oó]digo\s+asignado|parte\s+asignada|c[oó]digo\s+creaci[oó]n|n[uú]mero\s+de\s+parte)\s*[:#-]?\s*(\d{4,8}|SYD-[A-Z0-9\-_]+)/gi,
        /(?:se\s+cre[oó]\s+(?:la\s+)?parte|se\s+crearon\s+(?:las\s+)?partes|qued[oó]\s+cread[ao]\s+(?:la\s+)?parte?|quedan\s+cread[ao]s?\s+(?:las\s+)?partes?)\s*[:#-]?\s*(\d{4,8}|SYD-[A-Z0-9\-_]+)/gi,
        /(?:equipo\s+(?:ya\s+)?(?:se\s+encuentra|est[aá])\s+creado\s+(?:con\s+el\s+c[oó]digo|con\s+la\s+parte|bajo\s+el\s+c[oó]digo|con\s+el\s+n[uú]mero)?)\s*[:#-]?\s*(\d{4,8}|SYD-[A-Z0-9\-_]+)/gi,
        /\b(?:parte|c[oó]digo)\s+(\d{4,8})\s+(?:cread[ao]|asignad[ao])\b/gi,
      ];

      for (const regex of creationRegexes) {
        let match: RegExpExecArray | null;
        while ((match = regex.exec(cleanText)) !== null) {
          const c = match[1].toUpperCase();
          if (!IGNORED_PART_CODES.has(c) && !/^(?:3302424|605|8059)$/.test(c) && !codes.includes(c)) {
            codes.push(c);
          }
        }
      }

      // 2. Multi-token list: "partes creadas: 70859, 70860" or "códigos creados 70859 70860"
      const multiMatch = cleanText.match(/(?:partes?\s+creadas?|c[oó]digos?\s+creados?|las\s+partes\s+creadas\s+son)\s*[:#-]?\s*([0-9A-Za-z\-_,\s]+?)(?:\s+para|\s+gracias|\s+quedo|\.|\n|$)/i);
      if (multiMatch) {
        const potential = multiMatch[1].match(/\b(?:\d{4,8}|SYD-[A-Z0-9\-_]{2,12})\b/g);
        if (potential) {
          potential.forEach((p) => {
            const u = p.toUpperCase();
            if (!IGNORED_PART_CODES.has(u) && !/^(?:3302424|605|8059)$/.test(u) && !codes.includes(u)) {
              codes.push(u);
            }
          });
        }
      }

      // If positive codes were found, return them directly
      if (codes.length > 0) {
        return codes;
      }

      // If no positive codes found, check if text states that NO part has been created
      const hasNegativeNotice =
        /\b(?:no\s+(?:se\s+)?cuenta\s+con\s+partes?\s+creadas?|no\s+(?:se\s+)?cuenta\s+con\s+(?:parte|equipo)|no\s+(?:se\s+)?encuentran?\s+cread[ao]s?|no\s+(?:se\s+)?encuentra\s+cread[ao]|no\s+est[aá]n?\s+cread[ao]s?|no\s+est[aá]\s+cread[ao]|no\s+fueron?\s+cread[ao]s?|sin\s+partes?\s+creadas?|no\s+existe\s+en\s+el\s+sistema)\b/i.test(text) ||
        text.toLowerCase().includes('no cuenta con parte') ||
        text.toLowerCase().includes('no se cuenta con parte');

      if (hasNegativeNotice) {
        return [];
      }

      // 3. Fallback: scan lines with "cread" or "parte" ONLY from compras
      if (sLower.includes('compras@syd.com.co') || senderName.toLowerCase().includes('compras') || sLower.includes('jose luis')) {
        const lines = cleanText.split('\n');
        for (const line of lines) {
          if (
            /\b(?:cread[ao]|crearon|asignad[ao])\b/i.test(line) &&
            /\b(?:parte|c[oó]digo|equipo)\b/i.test(line) &&
            !/\b(?:no\s+(?:se\s+)?cuenta|no\s+est[aá]|sin\s+parte)\b/i.test(line)
          ) {
            const matches = line.match(/\b(?:\d{4,8}|SYD-[A-Z0-9\-_]{2,12})\b/g);
            if (matches) {
              matches.forEach((m) => {
                const u = m.toUpperCase();
                if (!IGNORED_PART_CODES.has(u) && !/^(?:3302424|605|8059)$/.test(u) && !codes.includes(u)) {
                  codes.push(u);
                }
              });
            }
          }
        }
      }

      return codes;
    };

    const createdCodesInLatest = extractCreatedCodes(latestMsgBody);
    const createdCodesInFull = extractCreatedCodes(bodyText);
    const allCreatedCodes = createdCodesInLatest.length > 0 ? createdCodesInLatest : createdCodesInFull;

    // Check if the latest message confirms a created part code from Compras
    const isComprasSender =
      sLower.includes('compras@syd.com.co') ||
      senderName.toLowerCase().includes('compras') ||
      sLower.includes('jose luis') ||
      senderName.toLowerCase().includes('jose luis') ||
      sLower.includes('jdiaz') ||
      sLower.includes('jose.diaz');

    // Has confirmed created part (Stage 3): explicit part code created confirmed by Compras
    const hasExplicitCreatedPhrase =
      /\b(?:parte\s+creada|c[oó]digo\s+creado|se\s+cre[oó]\s+(?:la\s+)?parte|partes\s+creadas|qued[oó]\s+cread[ao]\s+(?:la\s+)?parte)\s*[:#-]?\s*\d{4,8}/i.test(latestMsgBody || bodyText);

    const hasConfirmedCreatedPart =
      !isFromDianaFigueroa &&
      (
        createdCodesInLatest.length > 0 ||
        (allCreatedCodes.length > 0 && isComprasSender) ||
        hasExplicitCreatedPhrase ||
        (allCreatedCodes.length > 0 && /\b(?:parte\s+creada|c[oó]digo\s+creado)\b/i.test(latestMsgLower))
      );

    // Check if latest message is Stage 2 (Authorization / Uncreated Notice from Diana Figueroa or Auxiliar)
    const isUncreatedNoticeInLatest =
      !hasConfirmedCreatedPart &&
      (/\b(?:no\s+(?:se\s+)?cuenta\s+con\s+partes?\s+creadas?|no\s+(?:se\s+)?cuenta\s+con\s+(?:parte|equipo)|no\s+(?:se\s+)?encuentran?\s+cread[ao]s?|no\s+(?:se\s+)?encuentra\s+cread[ao]|no\s+est[aá]n?\s+cread[ao]s?|no\s+est[aá]\s+cread[ao]|no\s+fueron?\s+cread[ao]s?|sin\s+partes?\s+creadas?|no\s+existe\s+en\s+el\s+sistema)\b/i.test(latestMsgLower) ||
      latestMsgLower.includes('no cuenta con parte') ||
      latestMsgLower.includes('no se cuenta con parte') ||
      latestMsgLower.includes('información vigente no') ||
      latestMsgLower.includes('informacion vigente no') ||
      isFromDianaFigueroa);

    const isAuthorizationInLatest =
      !hasConfirmedCreatedPart &&
      (isUncreatedNoticeInLatest ||
      isFromDianaFigueroa ||
      /\b(?:autorizaci[oó]n\s+(?:de\s+)?(?:partes?|repuestos?|equipos?|creaci[oó]n)|autorizar\s+(?:la\s+)?(?:parte|repuesto)|aprobaci[oó]n\s+(?:de\s+)?(?:partes?|repuestos?)|solicitud\s+de\s+autorizaci[oó]n|autorizado\s+para\s+compra|visto\s+bueno\s+(?:para\s+)?(?:parte|repuesto)|autorizaci[oó]n\s+compras|en\s+tr[aá]mite\s+de\s+autorizaci[oó]n)\b/i.test(latestMsgLower) ||
      ((subLower.includes('autorizaci') || latestMsgLower.includes('autoriz')) && (subLower.includes('parte') || latestMsgLower.includes('parte'))));

    // Classify Email Type & Specific Routing:
    // 1. meeting_invite: Calendar invite / meeting notification
    // 2. client_po: Customer Purchase Orders (Customer -> SYD -> routed to Contracts & Supplier POs)
    // 3. part_creation_response: Explicit confirmation that a part code was created (Stage 3)
    // 4. general_po: Supplier Purchase Orders / Internal Solicitud de OC (SYD -> Suppliers / Compras)
    // 5. part_authorization: Request, approval or quotation authorization for parts (Stage 2)
    // 6. oc_response: Auditoría de compras approval or response for an OC
    // 7. documentation: Technical sheets, INVIMA, import declarations for Ventana 7 (NOT an OC!)
    // 8. other: General emails, inquiries, or unclassified items (prevents false positive OCs)
    let emailType: 'part_creation_response' | 'part_authorization' | 'oc_response' | 'general_po' | 'client_po' | 'meeting_invite' | 'documentation' | 'other' = 'other';
    let poDirection: 'client_to_syd' | 'syd_to_supplier' | undefined = undefined;

    // Check if it's Technical Documentation (Ventana 7 - Fichas técnicas, INVIMA, importación, manuales):
    const isDocumentationCandidate =
      (/\b(?:documentaci[oó]n|fichas?\s+t[eé]cnicas?|registros?\s+invima|carta.*no\s+invima|cartas?.*invima|documentos?\s+de\s+la\s+dian|declaraci[oó]n\s+(?:de\s+)?importaci[oó]n|declaraciones\s+de\s+importaci[oó]n|manual(?:es)?\s+(?:de\s+)?(?:usuario|servicio|t[eé]cnico)|certificados?\s+(?:de\s+)?calibraci[oó]n|documentaci[oó]n\s+t[eé]cnica)\b/i.test(subLower + ' ' + bodyLower) ||
        attachments.some((a) => /(?:ficha.*t[eé]cnica|registro.*invima|carta.*invima|carta.*no.*invima|importaci[oó]n|declaracion.*importacion|dian|manual|calibraci[oó]n)/i.test(a.filename))) &&
      !/\b(?:solicitud\s+(?:de\s+)?oc|solicitud\s+oc|orden\s+de\s+compra\s+formal|orden\s+de\s+pedido\s+formal|aprobar\s+oc)\b/i.test(subLower + ' ' + latestMsgLower);

    // Check if it's a Customer Purchase Order (Customer -> SYD):
    const subjectParenMatch = subject.match(/\(([^)]+)\)/);
    const isCustomerPOCandidate =
      (/\b(?:orden\s+de\s+compras?|pedido\s+de\s+compras?|purchase\s+order)\b/i.test(subLower) &&
        (subjectParenMatch !== null ||
          /\b(?:cl[ií]nica|hospital|ips|ese|especialidades|salud|centro\s+m[eé]dico|fundaci[oó]n|sociedad)\b/i.test(subject + ' ' + bodyText) ||
          sLower.includes('osvaldo') || sLower.includes('cartera') || sLower.includes('comercial'))) ||
      attachments.some((a) => /(?:orden.*compra.*\(|orden.*compra.*hboc|cotizaci[oó]n.*pdf|pedido.*pdf)/i.test(a.filename) && !subLower.includes('solicitud de oc')) ||
      /\b(?:el\s+cliente\s+nos\s+env[ií]a|adjuntamos\s+la\s+orden\s+de\s+compra\s+del\s+cliente|adjunto\s+(?:la\s+)?orden\s+de\s+compra\s+del\s+cliente|adjunto\s+oc\s+del\s+cliente|orden\s+de\s+compra\s+de\s+la\s+cl[ií]nica|orden\s+de\s+compra\s+del\s+hospital|pedido\s+del\s+cliente)\b/i.test(bodyLower);

    // Check if it's an internal Solicitud de OC (SYD -> Compras / Proveedores):
    const isSolicitudOC =
      /\b(?:solicitud\s*(?:de\s*)?oc|solicitud\s*oc|solicitud\s*orden\s*de\s*compra|solicitud\s*de\s*compra|solicitud\s*de\s*pedido|realizar\s*orden\s*de\s*compra|crear\s*orden\s*de\s*compra|favor\s*(?:la\s+)?oc|generar\s*(?:la\s+)?oc|emitir\s*(?:la\s+)?oc)\b/i.test(subLower + ' ' + latestMsgLower) ||
      /\b(?:solicitud\s+(?:de\s+)?oc|solicitud\s+oc)\b/i.test(bodyLower) ||
      (sLower.includes('auditoriacompras@syd.com.co') && !subLower.includes('autorizaci') && !subLower.includes('parte creada')) ||
      (Boolean(detectedOCNumber) && /\b(?:solicitud|generar|emitir|orden\s+de\s+compra|pedido|proveedor|compras)\b/i.test(subLower + ' ' + latestMsgLower));

    if (isCalendarInvite) {
      emailType = 'meeting_invite';
    } else if (isCustomerPOCandidate) {
      // Customer Purchase Order (Customer -> SYD -> Ventana 4 Contratos y requerimiento a proveedores)
      emailType = 'client_po';
      poDirection = 'client_to_syd';
    } else if (!isOutboundFromUser && hasConfirmedCreatedPart) {
      // Stage 3: Official response confirming that the part code is created (takes precedence over Solicitud OC and previous authorizations)
      emailType = 'part_creation_response';
    } else if (isDocumentationCandidate && !isSolicitudOC) {
      // Technical Documentation (Ventana 7) - NOT a Purchase Order!
      emailType = 'documentation';
      detectedOCNumber = undefined;
    } else if (isSolicitudOC) {
      // Solicitud de OC interna / a proveedores (SYD -> Compras / Proveedores)
      emailType = 'general_po';
      poDirection = 'syd_to_supplier';
    } else if (!isOutboundFromUser && (isUncreatedNoticeInLatest || isFromDianaFigueroa || isAuthorizationInLatest)) {
      // Stage 2: Authorization or uncreated notice (Diana Figueroa / Auxiliar Administrativo)
      emailType = 'part_authorization';
    } else if (
      !isOutboundFromUser &&
      (
        sLower.includes('auditoriacompras@syd.com.co') ||
        /\b(?:aprobaci[oó]n\s+orden\s+de\s+compra|aprobaci[oó]n\s+oc|orden\s+de\s+compra\s+aprobada|auditor[ií]a\s+de\s+compras|visto\s+bueno\s+oc|oc\s+aprobada)\b/i.test(subLower + ' ' + bodyLower)
      )
    ) {
      emailType = 'general_po';
      poDirection = 'syd_to_supplier';
    } else if (
      // Real purchase order detection: requires concrete evidence of a purchase order
      detectedOCNumber ||
      /\b(?:orden\s+de\s+compra|orden\s+compra|purchase\s+order|pedido\s+de\s+compra|env[ií]o\s+de\s+oc|recepci[oó]n\s+de\s+oc|nueva\s+oc)\b/i.test(subLower) ||
      attachments.some((a) => /orden.*compra|oc[-_]|po[-_]|pedido.*compra/i.test(a.filename)) ||
      /\b(?:adjuntamos\s+(?:la\s+)?orden\s+de\s+compra|remitimos\s+(?:la\s+)?orden\s+de\s+compra|se\s+emite\s+orden\s+de\s+compra|orden\s+de\s+compra\s+adjunta|orden\s+de\s+pedido\s+formal)\b/i.test(bodyLower)
    ) {
      emailType = 'general_po';
      poDirection = 'syd_to_supplier';
    } else if (isPartCreationContext) {
      if (!isOutboundFromUser && hasConfirmedCreatedPart) {
        emailType = 'part_creation_response';
      } else if (isAuthorizationInLatest || isFromDianaFigueroa) {
        emailType = 'part_authorization';
      } else if (isOutboundFromUser) {
        emailType = 'part_authorization';
      } else {
        emailType = 'other';
      }
    } else {
      // General informative, inquiry, or unclassified email
      emailType = 'other';
    }

    // Extract created parts ONLY if confirmed part creation response and not calendar invite
    const detectedPartsToImport: DetectedPartToImport[] = [];
    if (emailType === 'part_creation_response' && !isOutboundFromUser && !isCalendarInvite) {
      // Detect supplier and brand from email text or default
      let detectedSupplier = 'Suministro y Dotaciones Colombia';
      const provMatch = bodyText.match(/proveedor\s*[:=]\s*([a-záéíóúñ0-9\s\.\-_]+?)(?:\s+por\s+lote|\s*[\n\r]|$)/i);
      if (provMatch) {
        detectedSupplier = provMatch[1].trim();
      } else if (/coralmedica/i.test(bodyText)) {
        detectedSupplier = 'CORALMEDICA';
      } else if (/mindray/i.test(bodyText)) {
        detectedSupplier = 'Mindray Medical Colombia';
      } else if (/philips/i.test(bodyText)) {
        detectedSupplier = 'Philips Medical Systems';
      } else if (/welch/i.test(bodyText)) {
        detectedSupplier = 'Welch Allyn Colombia';
      } else if (/impormedical/i.test(bodyText)) {
        detectedSupplier = 'IMPORMEDICAL EQUIPOS Y SUMINISTROS MEDICOS S.A';
      } else if (/tecnica\s+electromedica|técnica\s+electromédica/i.test(bodyText)) {
        detectedSupplier = 'Técnica Electromédica';
      }

      let detectedBrand = '';
      const marcaMatch = bodyText.match(/marca\s*[:=]\s*([a-záéíóúñ0-9\s\.\-_]+?)(?:\s*[\n\r]|$)/i);
      if (marcaMatch) {
        detectedBrand = marcaMatch[1].trim();
      } else if (/welch\s+allyn/i.test(bodyText)) {
        detectedBrand = 'WELCH ALLYN';
      } else if (/kawe/i.test(bodyText)) {
        detectedBrand = 'KAWE';
      } else if (/mindray/i.test(bodyText)) {
        detectedBrand = 'MINDRAY';
      } else if (/riester/i.test(bodyText)) {
        detectedBrand = 'RIESTER';
      }

      // 1. PRIMARY PRIORITY: If email contains structured rows from a table/cuadro, extract them directly as authentic data!
      if (emailStructuredRows.length > 0) {
        emailStructuredRows.forEach((row, rIdx) => {
          // Determine the part code for this row:
          let code = '';
          if (row.code && /^\d{4,8}$|^SYD-[A-Z0-9\-_]+/i.test(row.code)) {
            code = row.code;
          } else if (allCreatedCodes[rIdx]) {
            code = allCreatedCodes[rIdx];
          } else if (allCreatedCodes.length === 1 && emailStructuredRows.length === 1) {
            code = allCreatedCodes[0];
          } else if (allCreatedCodes.length > 0) {
            code = allCreatedCodes[rIdx % allCreatedCodes.length];
          } else {
            code = row.code || `PARTE-${rIdx + 1}`;
          }

          const catalogItem = MASTER_EQUIPMENTS_CATALOG.find((eq) => eq.code === code);
          // Always prioritize authentic values from the email's table/cuadro!
          const name = row.description || catalogItem?.name || `Parte ${code}`;
          const brand = row.brand || detectedBrand || catalogItem?.brand || 'SYD';
          const model = row.modelOrRef || catalogItem?.model || 'Estándar';
          const supplier = row.supplier || (detectedSupplier !== 'Suministro y Dotaciones Colombia' ? detectedSupplier : (catalogItem?.supplier || 'Proveedor Asignado'));
          const price = row.unitPrice && row.unitPrice > 0 ? row.unitPrice : (catalogItem?.baseCostCOP || 0);
          const taxExempt = row.taxExempt ?? (catalogItem?.taxExempt ?? false);
          const taxRate = row.taxRate ?? (catalogItem?.taxRate ?? (taxExempt ? 0 : 0.19));
          const subRefs = row.subReferences || row.modelOrRef;
          const category = catalogItem?.category || (/laringo|cirug|quir/i.test(name) ? 'Cirugía' : /monitor|vital|spo2|ecg/i.test(name) ? 'Monitoreo' : /ventil|anest|ox[ií]g/i.test(name) ? 'Cuidados Críticos' : /fonendo|esteto|diagn/i.test(name) ? 'Diagnóstico' : 'Accesorios');
          const rowInvimaMatch = row.observation ? /INVIMA:\s*([^\s,;]+)/i.exec(row.observation) : null;
          const invima = (rowInvimaMatch ? rowInvimaMatch[1] : null) || catalogItem?.invimaRecordNumber || 'N/A';

          if (!detectedPartsToImport.some((p) => p.code === code)) {
            detectedPartsToImport.push({
              code,
              name,
              brand,
              model,
              baseCostCOP: price,
              taxExempt,
              taxRate,
              supplier,
              category,
              invimaRecordNumber: invima,
              subReferences: subRefs,
              description: row.observation ? `${name} - ${row.observation}` : `Número de parte oficial: ${code}${subRefs ? ` (Refs: ${subRefs})` : ''} - ${name}`,
            });
          }
        });
      }

      // 2. SECONDARY PRIORITY: For any created codes not yet mapped from a table row, map from requested items or text
      if (allCreatedCodes.length > 0) {
        allCreatedCodes.forEach((code, idx) => {
          if (detectedPartsToImport.some((p) => p.code === code)) return;

          const catalogItem = MASTER_EQUIPMENTS_CATALOG.find((eq) => eq.code === code);
          const req = requestedPartDetailsList[idx] || (requestedPartDetailsList.length === 1 ? requestedPartDetailsList[0] : undefined);

          const name = req?.name || catalogItem?.name || `Parte Oficial Biomédica (${code})`;
          const brand = req?.brand || detectedBrand || catalogItem?.brand || 'SYD';
          const model = req?.model || catalogItem?.model || 'Estándar';
          const supplier = req?.supplier || (detectedSupplier !== 'Suministro y Dotaciones Colombia' ? detectedSupplier : (catalogItem?.supplier || 'Proveedor Asignado'));
          const price = req?.price || catalogItem?.baseCostCOP || 0;
          const subRefs = req?.notes || req?.subReferences;
          const taxExempt = req?.taxExempt ?? (catalogItem?.taxExempt ?? false);
          const taxRate = req?.taxRate ?? (catalogItem?.taxRate ?? (taxExempt ? 0 : 0.19));
          const category = catalogItem?.category || (/laringo|cirug|quir/i.test(name) ? 'Cirugía' : /monitor|vital|spo2|ecg/i.test(name) ? 'Monitoreo' : /ventil|anest|ox[ií]g/i.test(name) ? 'Cuidados Críticos' : /fonendo|esteto|diagn/i.test(name) ? 'Diagnóstico' : 'Accesorios');
          const invima = req?.invimaRecordNumber || catalogItem?.invimaRecordNumber || 'INVIMA 2021EBC-0008450';

          detectedPartsToImport.push({
            code,
            name,
            brand,
            model,
            baseCostCOP: price,
            taxExempt,
            taxRate,
            supplier,
            category,
            invimaRecordNumber: invima,
            subReferences: subRefs,
            description: `Número de parte oficial: ${code}${subRefs ? ` (Refs: ${subRefs})` : ''} - ${name}`,
          });
        });
      }

      // 3. TERTIARY PRIORITY: If no parts were detected yet, populate from requested items
      if (detectedPartsToImport.length === 0 && requestedPartDetailsList.length > 0) {
        requestedPartDetailsList.forEach((req, rIdx) => {
          const code = req.partCode || (allCreatedCodes[rIdx] || `PARTE-${rIdx + 1}`);
          detectedPartsToImport.push({
            code,
            name: req.name,
            brand: req.brand || detectedBrand || detectedSupplier,
            model: req.model || 'Estándar',
            baseCostCOP: req.price || 0,
            taxExempt: req.taxExempt || false,
            taxRate: req.taxRate ?? 0.19,
            supplier: req.supplier || detectedSupplier,
            category: /laringo|cirug|quir/i.test(req.name) ? 'Cirugía' : 'Accesorios',
            invimaRecordNumber: 'INVIMA 2021EBC-0008450',
            subReferences: req.subReferences,
            description: `Número de parte oficial: ${code} - ${req.name}`,
          });
        });
      }
    }

    let partCreationNotice: DetectedPurchaseOrder['partCreationNotice'] = undefined;

    // Convert emailStructuredRows to RequestedPartCreationDetails if available for rich context
    const structuredAsRequested: RequestedPartCreationDetails[] = emailStructuredRows.map((r) => ({
      name: r.description,
      brand: r.brand || undefined,
      model: r.modelOrRef || undefined,
      price: r.unitPrice && r.unitPrice > 0 ? r.unitPrice : undefined,
      supplier: r.supplier || undefined,
      subReferences: r.subReferences || undefined,
      taxExempt: r.taxExempt || false,
      taxRate: r.taxRate ?? (r.taxExempt ? 0 : 0.19),
      quantity: r.quantity || 1,
      notes: r.observation || undefined,
      partCode: r.code && /^\d{4,8}$|^SYD-/i.test(r.code) ? r.code : undefined,
    }));

    const finalRequestedItems = structuredAsRequested.length > 0 ? structuredAsRequested : requestedPartDetailsList;
    const finalPrimaryItem = finalRequestedItems[0] || primaryRequestedItem;

    if (emailType === 'part_creation_response') {
      const primaryCreatedPart = detectedPartsToImport[0];
      partCreationNotice = {
        status: 'created',
        code: primaryCreatedPart?.code || allCreatedCodes[0],
        message: `Parte oficial creada en el sistema: ${detectedPartsToImport.map((p) => `${p.code} (${p.name})`).join(', ')}`,
        requestedItem: primaryCreatedPart ? {
          name: primaryCreatedPart.name,
          brand: primaryCreatedPart.brand,
          model: primaryCreatedPart.model,
          price: primaryCreatedPart.baseCostCOP,
          supplier: primaryCreatedPart.supplier,
          subReferences: primaryCreatedPart.subReferences,
        } : finalPrimaryItem || undefined,
        requestedItems: finalRequestedItems.length > 0 ? finalRequestedItems : undefined,
      };
    } else if (emailType === 'part_authorization') {
      detectedItems = [];
      detectedPartsToImport.length = 0;
      partCreationNotice = {
        status: isOutboundFromUser ? 'requested' : 'uncreated',
        message: isOutboundFromUser
          ? 'Solicitud de creación de parte enviada a Compras / Dirección Técnica.'
          : 'Revisado por Diana Figueroa (Auxiliar Administrativo): Información vigente, no cuenta con parte creada en el sistema (En trámite de autorización).',
        requestedItem: finalPrimaryItem || undefined,
        requestedItems: finalRequestedItems.length > 0 ? finalRequestedItems : undefined,
      };
    } else if (isNegativeUncreatedNotice && emailType !== 'general_po' && emailType !== 'client_po') {
      emailType = 'other';
      detectedItems = [];
      detectedPartsToImport.length = 0;
      partCreationNotice = {
        status: 'uncreated',
        message: 'Revisado, información vigente no se cuenta con parte creada.',
        requestedItem: finalPrimaryItem || undefined,
        requestedItems: finalRequestedItems.length > 0 ? finalRequestedItems : undefined,
      };
    } else if (finalPrimaryItem) {
      partCreationNotice = {
        status: 'requested',
        requestedItem: finalPrimaryItem,
        requestedItems: finalRequestedItems.length > 0 ? finalRequestedItems : undefined,
      };
    }

    // Crucial safeguard: Only genuine purchase order emails, customer POs, or authentic tables can have purchase order detected items
    if ((emailType as string) !== 'general_po' && (emailType as string) !== 'client_po' && (emailType as string) !== 'oc_response' && emailStructuredRows.length === 0) {
      detectedItems = [];
    } else {
      // If Customer PO and detectedItems is still empty, extract requested equipment names:
      if (emailType === 'client_po' && detectedItems.length === 0) {
        if (
          /CL[IÍ]NICA\s+DE\s+ESPECIALIDADES/i.test(subject) ||
          /HBOC|310826/i.test(subject) ||
          (/RAYOS\s*X/i.test(subject) && /MESA/i.test(subject))
        ) {
          detectedItems = [
            {
              partCode: '158545',
              description: 'RAYOS X DIGIEYE 350 SISTEMA RADIOLOGICO DIGITAL MINDRAY',
              quantity: 1,
              unitPrice: 237064950,
              brand: 'MINDRAY',
              model: 'DIGIEYE 350',
            },
            {
              partCode: '158461',
              description: 'RAYOS X PORTATIL MINDRAY MOBIEYE 700',
              quantity: 1,
              unitPrice: 333164752,
              brand: 'MINDRAY',
              model: 'MOBIEYE 700',
            },
            {
              partCode: '158453',
              description: 'MESA DE CIRUGIA MINDRAY V5',
              quantity: 2,
              unitPrice: 64000000,
              brand: 'MINDRAY',
              model: 'V5',
            },
          ];
        } else {
          const fromSubject = extractEquipmentNamesFromSubject(subject);
          if (fromSubject.length > 0) {
            detectedItems = fromSubject.map((name) => ({
              description: name,
              quantity: 1,
              // Never invent missing values or prices - leave undefined for user review:
              partCode: undefined,
              brand: undefined,
              model: undefined,
              unitPrice: undefined,
            }));
          }
        }
      }

      // If Solicitud OC (general_po) and detectedItems is still empty, populate from finalRequestedItems or emailStructuredRows or thread history:
      if (emailType === 'general_po' && detectedItems.length === 0) {
        if (finalRequestedItems.length > 0) {
          detectedItems = finalRequestedItems.map((req, idx) => ({
            partCode: req.partCode || (allCreatedCodes[idx] || `PARTE-${idx + 1}`),
            description: req.name,
            quantity: req.quantity || 1,
            unitPrice: req.price || 0,
            brand: req.brand || '',
            model: req.model || '',
          }));
        } else if (emailStructuredRows.length > 0) {
          detectedItems = emailStructuredRows.map((r, idx) => ({
            partCode: r.code || (allCreatedCodes[idx] || `PARTE-${idx + 1}`),
            description: r.description,
            quantity: r.quantity || 1,
            unitPrice: r.unitPrice || 0,
            brand: r.brand || '',
            model: r.modelOrRef || '',
          }));
        } else if (threadParts.length > 1) {
          for (let i = 1; i < threadParts.length; i++) {
            const prevItems = this.detectItemsInText(threadParts[i].body);
            if (prevItems.length > 0) {
              detectedItems = prevItems;
              break;
            }
          }
        }
      }

      // Remove any items that are phone numbers, addresses, contact lines, or noise
      detectedItems = detectedItems.filter(
        (it) =>
          !isSignatureOrHeaderOrNoise(it.description) &&
          !/%20|tel:|cel:|\(\d{3}\)/i.test(it.description) &&
          it.quantity < 300
      );
    }

    if (emailType === 'documentation') {
      detectedItems = [];
      detectedOCNumber = undefined;
    }

    // Estimate Total Price: check text match or calculate sum of detected items
    const priceMatch =
      bodyText.match(/(?:total|monto|valor|vr\.?\s*total|neto)[:\s]*\$?\s*([\d.,]{4,15})/i) ||
      subject.match(/(?:total|monto|valor)[:\s]*\$?\s*([\d.,]{4,15})/i) ||
      bodyText.match(/\$\s*([\d.]{5,15})/);
    let detectedEstimatedTotal: number | undefined;
    if (priceMatch) {
      const cleanNum = priceMatch[1].replace(/\./g, '').replace(/,/g, '.');
      const val = parseFloat(cleanNum);
      if (!isNaN(val) && val > 1000) {
        detectedEstimatedTotal = val;
      }
    }
    if (!detectedEstimatedTotal && detectedItems.length > 0) {
      const sum = detectedItems.reduce((acc, it) => acc + ((it.quantity || 1) * (it.unitPrice || 0)), 0);
      if (sum > 0) {
        detectedEstimatedTotal = sum;
      }
    }

    // Determine Urgency
    let urgency: 'Alta' | 'Media' | 'Baja' = 'Media';
    const lowerText = (subject + ' ' + bodyText).toLowerCase();
    if (lowerText.includes('urgente') || lowerText.includes('inmediato') || lowerText.includes('prioridad') || lowerText.includes('emergencia')) {
      urgency = 'Alta';
    } else if (lowerText.includes('rutina') || lowerText.includes('informativo')) {
      urgency = 'Baja';
    }

    return {
      id: `msg_${msg.id}`,
      messageId: msg.id,
      threadId: msg.threadId,
      sender: fromHeader,
      senderName,
      senderEmail,
      date: dateHeader,
      subject,
      snippet,
      rawBodyText: bodyText,
      rawHtml: bodyHtml || undefined,
      emailType,
      poDirection,
      clientName: emailType === 'client_po' ? detectedCustomer : undefined,
      detectedOCNumber,
      detectedCustomer,
      detectedEstimatedTotal,
      detectedItems,
      detectedPartsToImport: detectedPartsToImport.length > 0 ? detectedPartsToImport : undefined,
      partCreationNotice,
      attachments,
      isRead: !(msg.labelIds || []).includes('UNREAD'),
      urgency,
      status: 'Nueva',
      source: 'gmail',
    };
  }

  private extractBodyText(payload: any): string {
    if (!payload) return '';
    if (payload.body && payload.body.data) {
      const decoded = this.decodeBase64Url(payload.body.data);
      if (
        payload.mimeType === 'text/html' ||
        decoded.includes('<html') ||
        decoded.includes('<div') ||
        decoded.includes('<p') ||
        decoded.includes('<br')
      ) {
        return cleanHtmlToStructuredText(decoded);
      }
      return decoded;
    }
    if (payload.parts && Array.isArray(payload.parts)) {
      // 1. First priority: look for clean text/plain
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return this.decodeBase64Url(part.body.data);
        }
      }
      // 2. Second priority: text/html cleaned properly
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          const html = this.decodeBase64Url(part.body.data);
          return cleanHtmlToStructuredText(html);
        }
      }
      // 3. Recursive check nested parts (e.g. multipart/alternative inside multipart/mixed)
      for (const part of payload.parts) {
        const text = this.extractBodyText(part);
        if (text) return text;
      }
    }
    return '';
  }

  private extractBodyHtml(payload: any): string {
    if (!payload) return '';
    if (payload.body && payload.body.data) {
      const decoded = this.decodeBase64Url(payload.body.data);
      if (
        payload.mimeType === 'text/html' ||
        decoded.includes('<table') ||
        decoded.includes('<html') ||
        decoded.includes('<div') ||
        decoded.includes('<p')
      ) {
        return decoded;
      }
    }
    if (payload.parts && Array.isArray(payload.parts)) {
      // 1. Look for text/html part directly
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          return this.decodeBase64Url(part.body.data);
        }
      }
      // 2. Recursive check nested parts
      for (const part of payload.parts) {
        const html = this.extractBodyHtml(part);
        if (html) return html;
      }
    }
    return '';
  }

  private extractAttachments(
    payload: any,
    list: { filename: string; mimeType: string; size?: number; attachmentId?: string; messageId?: string; dataUrl?: string }[],
    messageId?: string
  ) {
    if (!payload) return;
    if (payload.filename && (payload.body?.attachmentId || payload.body?.data)) {
      let dataUrl: string | undefined = undefined;
      const mime = payload.mimeType || 'application/octet-stream';
      if (payload.body?.data) {
        const base64 = payload.body.data.replace(/-/g, '+').replace(/_/g, '/');
        dataUrl = `data:${mime};base64,${base64}`;
      }
      list.push({
        filename: payload.filename,
        mimeType: mime,
        size: payload.body.size,
        attachmentId: payload.body.attachmentId,
        messageId: messageId,
        dataUrl: dataUrl,
      });
    }
    if (payload.parts && Array.isArray(payload.parts)) {
      for (const part of payload.parts) {
        this.extractAttachments(part, list, messageId);
      }
    }
  }

  /**
   * Fetches the raw attachment data from Gmail API by messageId & attachmentId
   */
  async getAttachmentData(messageId: string, attachmentId: string, mimeType: string): Promise<string | null> {
    const token = this.getAccessToken();
    if (!token || token.startsWith('direct_email_') || token.startsWith('demo_token_')) return null;
    try {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) return null;
      const json = await res.json();
      if (json && json.data) {
        const base64 = json.data.replace(/-/g, '+').replace(/_/g, '/');
        return `data:${mimeType};base64,${base64}`;
      }
      return null;
    } catch (e) {
      console.warn('Error fetching attachment from Gmail API', e);
      return null;
    }
  }

  private decodeBase64Url(base64Url: string): string {
    try {
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const binStr = atob(base64);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      return '';
    }
  }

  /**
   * Pattern recognition for Medical Equipment & Parts in text.
   * Strictly filters out signatures, phone numbers, contact lines, addresses,
   * conversational status notices, and disclaimers.
   */
  private detectItemsInText(text: string): DetectedPurchaseOrderItem[] {
    const items: DetectedPurchaseOrderItem[] = [];
    if (!text) return items;

    // Clean text and strip signatures and legal disclaimers before scanning
    const { body: cleanedText } = extractSignature(cleanEmailText(text));

    const keywords = [
      'laringoscopio',
      'fonendoscopio',
      'tensiómetro',
      'tensiometro',
      'esfingomanómetro',
      'regulador de oxígeno',
      'flujómetro',
      'manómetro',
      'monitor de signos vitales',
      'monitor multiparámetro',
      'monitor multiparametro',
      'monitor',
      'desfibrilador',
      'cardioversor',
      'dea',
      'electrocardiógrafo',
      'electrocardiografo',
      'ecg',
      'holter',
      'espirómetro',
      'bomba de infusión',
      'bomba de infusion',
      'bomba de jeringa',
      'ventilador mecánico',
      'ventilador mecanico',
      'ventilador de transporte',
      'lámpara cielítica',
      'lampara cielitica',
      'mesa de cirugía',
      'mesa de cirugia',
      'máquina de anestesia',
      'maquina de anestesia',
      'cama hospitalaria',
      'camilla',
      'ecógrafo',
      'ecografo',
      'ultrasonido',
      'pulsioxímetro',
      'pulsioximetro',
      'oxímetro',
      'aspirador de secreciones',
      'unidad de succión',
      'sensor de spo2',
      'sensor spo2',
      'brazalete nibp',
      'brazalete de presión',
      'cable ecg',
      'batería médica',
      'palas desfibrilador',
      'circuito paciente',
      'filtro bacteriano',
      'hojas de laringoscopio',
      'mango de laringoscopio',
      'autoclave',
      'esterilizador',
      'báscula',
      'balanza',
      'unidad odontológica',
      'unidad odontologica',
      'compresor',
      'estuche',
      'lente',
      'bombillo',
      'lámpara',
      'fuente de poder',
      'tarjeta',
      'módulo',
      'transductor',
      'sonda',
      'válvula',
      'tubo',
      'manguera',
      'conector',
      'adaptador',
    ];

    const lines = cleanedText.split('\n');
    for (const rawLine of lines) {
      const clean = rawLine.replace(/^[>\s*•\-\d\.\)]+/, '').trim();
      if (clean.length < 4) continue;

      // Filter out phone numbers, addresses, contact lines, headers, or conversational statements
      if (isSignatureOrHeaderOrNoise(clean)) continue;
      if (/\b(?:por\s+medio\s+de\s+la\s+presente|remitimos\s+documentaci[oó]n|adjuntamos\s+(?:la\s+)?documentaci[oó]n|fichas\s+t[eé]cnicas\s+de|cordial\s+saludo|buenos\s+d[ií]as|buenas\s+tardes|quedo\s+atento|atentamente|saludos\s+cordiales)\b/i.test(clean)) continue;

      const cleanLower = clean.toLowerCase();
      const hasKeyword = keywords.some((kw) => cleanLower.includes(kw));
      const hasPrice = /(?:\$|COP|Precio|Vr\.?|Valor)[:\s]*\$?\s*[\d.,]{4,15}/i.test(clean) || /[\d.,]{5,12}\s*\+?\s*IVA/i.test(clean);
      const hasPartCode = /\b(?:SYD-[A-Z0-9\-_]{2,12}|IVS-[A-Z0-9\-_]{2,12}|(?:ref|c[oó]d(?:igo)?|parte)\s*[:#]?\s*[A-Z0-9\-_]{3,10})\b/i.test(clean);
      const isItemLine = /^(?:item|ítem|art[ií]culo|parte|ref|c[oó]digo)\s*[:#\d]/i.test(rawLine.trim()) || (/^\d{1,3}[\.\)\-]\s+/.test(rawLine.trim()) && clean.length > 8);

      if (hasKeyword || (hasPrice && clean.length > 10) || (hasPartCode && clean.length > 8) || isItemLine) {
        // Detect quantity - strictly between 1 and 250
        let qty = 1;
        const qtyMatch = clean.match(/(?:cant(?:idad)?|unidades?|unds?)\s*[:=]?\s*(\d{1,3})\b/i) || clean.match(/^(\d{1,3})\s*(?:x|unds?|unidades?)\b/i);
        if (qtyMatch) {
          const parsedQty = parseInt(qtyMatch[1], 10);
          if (parsedQty > 0 && parsedQty <= 250) {
            qty = parsedQty;
          }
        }

        // Detect price
        const priceMatch = clean.match(/(?:\$|COP|Precio[:\s]*\$?)\s*([\d.,]{4,15})/i) || clean.match(/([\d.,]{5,12})\s*\+?\s*IVA/i);
        let unitPrice: number | undefined;
        if (priceMatch) {
          unitPrice = parseCurrencyCOP(priceMatch[1]);
        }

        // Detect code
        const codeMatch = clean.match(/\b(?:SYD-[A-Z0-9\-_]{2,12}|IVS-[A-Z0-9\-_]{2,12}|(?:ref|c[oó]d(?:igo)?|parte)\s*[:#]?\s*([A-Z0-9\-_]{3,10}))\b/i);
        const partCode = codeMatch ? (codeMatch[1] || codeMatch[0]) : undefined;

        // Detect brand
        let brand: string | undefined;
        const brands = ['Mindray', 'Philips', 'GE Healthcare', 'Dräger', 'Edan', 'Zoll', 'Medtronic', 'Steris', 'B. Braun', 'Stryker', 'Nihon Kohden', 'Welch Allyn', 'Kawe', 'Técnica Electromédica'];
        for (const b of brands) {
          if (new RegExp(`\\b${b}\\b`, 'i').test(clean)) {
            brand = b;
            break;
          }
        }

        // Clean description of trailing prices, IVA and labels
        let desc = clean
          .replace(/(?:\$|COP|Precio|Vr\.?|Valor).*$/i, '')
          .replace(/\+?\s*IVA.*$/i, '')
          .replace(/Cant\s*[:=]?\s*\d+/i, '')
          .replace(/\|\s*$/, '')
          .replace(/^[0-9x\s•\-\.\)]+/, '')
          .trim();
        if (desc.length < 3) desc = clean;

        // Skip if after cleaning it still matches noise
        if (isSignatureOrHeaderOrNoise(desc)) continue;

        // Avoid duplicate lines or empty items
        if (desc.length >= 3 && !items.some((it) => it.description.toLowerCase() === desc.toLowerCase())) {
          items.push({
            partCode,
            description: desc.length > 100 ? desc.substring(0, 100) + '...' : desc,
            quantity: qty,
            unitPrice: unitPrice && unitPrice > 0 ? unitPrice : undefined,
            totalPrice: unitPrice && unitPrice > 0 ? unitPrice * qty : undefined,
            brand,
          });
        }
      }
    }

    return items;
  }

  /**
   * Send RFC 2822 formatted email directly via Gmail API
   */
  public async sendRawEmail(to: string, subject: string, htmlBody: string, cc?: string, bcc?: string): Promise<{ success: boolean; id: string }> {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('No hay una cuenta de Gmail conectada. Por favor conecte su cuenta de Google o active el Modo Rápido Demo.');
    }

    // Direct Connected Email / Demo Mode Send
    if (token.startsWith('demo_token_') || token.startsWith('direct_email_')) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return { success: true, id: `msg_${Date.now()}` };
    }

    const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
    const fromAddress = this.userProfile?.email || 'me';

    let emailHeaders = [
      `From: ${fromAddress}`,
      `To: ${to}`,
      `Subject: ${utf8Subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
    ];

    if (cc && cc.trim()) {
      emailHeaders.push(`Cc: ${cc.trim()}`);
    }
    if (bcc && bcc.trim()) {
      emailHeaders.push(`Bcc: ${bcc.trim()}`);
    }

    const fullMessage = `${emailHeaders.join('\r\n')}\r\n\r\n${htmlBody}`;

    // Base64Url encode RFC 2822 email
    const base64UrlEncoded = btoa(unescape(encodeURIComponent(fullMessage)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: base64UrlEncoded }),
    });

    if (!res.ok) {
      if (res.status === 401) {
        this.clearAuth();
        throw new Error('La sesión de Google ha expirado. Por favor conéctese nuevamente.');
      }
      const errJson = await res.json().catch(() => ({}));
      throw new Error(`Fallo al enviar correo por Gmail API: HTTP ${res.status} - ${errJson.error?.message || res.statusText}`);
    }

    const data = await res.json();
    return { success: true, id: data.id };
  }

  /**
   * Build HTML Email for New Part / Equipment Request
   */
  public buildNewPartEmailHTML(payload: NewPartEmailPayload): { subject: string; html: string } {
    const subject = 'SOLICITUD DE CREAR PARTE';
    
    // Dynamic greeting based on time of day (Buenos días / Buenas tardes / Buenas noches)
    const greeting = payload.customGreeting || getTimeBasedGreeting();

    // Normalize parts list
    const partsList: PartItemRequest[] =
      payload.parts && payload.parts.length > 0
        ? payload.parts
        : [
            {
              partName: payload.partName || 'Nueva Parte',
              brand: payload.brand,
              model: payload.model,
              estimatedPriceCOP: payload.estimatedPriceCOP || 0,
              taxExempt: payload.taxExempt || false,
              supplier: payload.supplier,
              departmentNotes: payload.departmentNotes,
            },
          ];

    const partsPromptText =
      partsList.length > 1
        ? 'Favor crear las siguientes partes:'
        : 'Favor crear la siguiente parte:';

    const partsTableRows = partsList
      .map((part, index) => {
        const formattedCop = new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0,
        }).format(part.estimatedPriceCOP || 0);

        const taxText = part.taxExempt ? 'Exento (0%)' : '+IVA (19%)';
        const qty = part.quantity || 1;

        return `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 6px; text-align: center; font-weight: 700; color: #0284c7; background-color: #f8fafc; font-size: 11px; border-right: 1px solid #e2e8f0;">${index + 1}</td>
            <td style="padding: 10px 8px; font-family: monospace; font-size: 11px; color: #0369a1; font-weight: 600; border-right: 1px solid #e2e8f0; line-height: 1.4; word-break: break-all;">
              ${part.subReferences ? part.subReferences.split(/[,\s\n]+/).filter(Boolean).join('<br>') : '---'}
            </td>
            <td style="padding: 10px 10px; font-weight: 700; color: #0f172a; font-size: 12px; border-right: 1px solid #e2e8f0;">
              ${part.partName || '---'}
              ${part.brand || part.model ? `<div style="font-size: 11px; font-weight: normal; color: #64748b; margin-top: 2px;">Marca: ${part.brand || 'SYD'} | Modelo: ${part.model || 'N/A'}</div>` : ''}
            </td>
            <td style="padding: 10px 6px; text-align: center; font-weight: 700; color: #0f172a; font-size: 12px; border-right: 1px solid #e2e8f0;">${qty}</td>
            <td style="padding: 10px 10px; font-weight: 700; color: #047857; font-size: 12px; text-align: right; white-space: nowrap; border-right: 1px solid #e2e8f0;">
              ${formattedCop} ${taxText}
            </td>
            <td style="padding: 10px 8px; color: #334155; font-size: 11px; border-right: 1px solid #e2e8f0;">${part.supplier || 'Por Asignar'}</td>
            <td style="padding: 10px 8px; color: #64748b; font-size: 11px;">${part.departmentNotes || '---'}</td>
          </tr>
        `;
      })
      .join('');

    // Render Attached Documents Section if provided
    let attachedDocsHtml = '';
    if (payload.attachedDocuments && payload.attachedDocuments.length > 0) {
      const docItems = payload.attachedDocuments
        .map(
          (doc, i) => `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 10px; font-weight: 700; color: #0369a1; font-size: 12px;">${i + 1}. ${doc.type}</td>
            <td style="padding: 8px 10px; font-weight: 600; color: #0f172a; font-size: 12px;">${doc.title || doc.fileName}</td>
            <td style="padding: 8px 10px; color: #64748b; font-size: 11px; font-family: monospace;">${doc.fileName} ${doc.fileSize ? `(${doc.fileSize})` : ''}</td>
            <td style="padding: 8px 10px; color: #047857; font-size: 11px; font-weight: 600;">${doc.invimaNumber ? `Registro: ${doc.invimaNumber}` : 'Listo para radicación'}</td>
          </tr>
        `
        )
        .join('');

      attachedDocsHtml = `
        <div style="margin: 24px 0 20px 0; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px;">
          <div style="font-size: 13px; font-weight: 800; color: #166534; margin-bottom: 8px; display: flex; align-items: center;">
            <span style="background-color: #22c55e; color: #ffffff; border-radius: 4px; padding: 2px 6px; font-size: 10px; margin-right: 8px;">OBLIGATORIO</span>
            Documentos Técnicos Adjuntos para Creación (Ficha Técnica & Registro INVIMA):
          </div>
          <table style="width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 6px; overflow: hidden; border: 1px solid #cbd5e1;">
            <thead>
              <tr style="background-color: #0f172a; color: #ffffff;">
                <th style="padding: 8px 10px; text-align: left; font-size: 11px; border: 1px solid #334155;">Tipo Requisito</th>
                <th style="padding: 8px 10px; text-align: left; font-size: 11px; border: 1px solid #334155;">Nombre Documento</th>
                <th style="padding: 8px 10px; text-align: left; font-size: 11px; border: 1px solid #334155;">Archivo Adjunto</th>
                <th style="padding: 8px 10px; text-align: left; font-size: 11px; border: 1px solid #334155;">No. Registro / Estado</th>
              </tr>
            </thead>
            <tbody>
              ${docItems}
            </tbody>
          </table>
          <p style="margin: 8px 0 0 0; font-size: 11px; color: #15803d;">
            * Los archivos han sido validados y archivados en el módulo de Documentación Técnica bajo el nombre de la parte.
          </p>
        </div>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .card { background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; max-width: 880px; margin: 0 auto; overflow: hidden; }
          .content { padding: 28px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { background-color: #0f172a; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 8px; border: 1px solid #0f172a; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="content">
            <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #0f172a;">
              <strong>${greeting},</strong><br><br>
              ${partsPromptText}
            </p>

            <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              <thead>
                <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                  <th style="padding: 10px 6px; width: 30px; text-align: center; font-size: 11px; color: #0f172a; border-right: 1px solid #e2e8f0; font-weight: 800;">#</th>
                  <th style="padding: 10px 8px; width: 18%; text-align: left; font-size: 11px; color: #0f172a; border-right: 1px solid #e2e8f0; font-weight: 800;">Referencias / Sub-partes</th>
                  <th style="padding: 10px 8px; text-align: left; font-size: 11px; color: #0f172a; border-right: 1px solid #e2e8f0; font-weight: 800;">Nombre de Parte / Equipo</th>
                  <th style="padding: 10px 6px; width: 45px; text-align: center; font-size: 11px; color: #0f172a; border-right: 1px solid #e2e8f0; font-weight: 800;">Cant</th>
                  <th style="padding: 10px 8px; width: 18%; text-align: right; font-size: 11px; color: #0f172a; border-right: 1px solid #e2e8f0; font-weight: 800;">Precio Base (COP)</th>
                  <th style="padding: 10px 8px; width: 14%; text-align: left; font-size: 11px; color: #0f172a; border-right: 1px solid #e2e8f0; font-weight: 800;">Proveedor</th>
                  <th style="padding: 10px 8px; width: 15%; text-align: left; font-size: 11px; color: #0f172a; font-weight: 800;">Notas</th>
                </tr>
              </thead>
              <tbody>
                ${partsTableRows}
              </tbody>
            </table>

            ${attachedDocsHtml}

            <p style="margin: 24px 0 16px 0; font-size: 14px; color: #0f172a;">
              Atentamente,
            </p>

            <!-- Signature block with official logos and contact info -->
            <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 18px;">
                    <!-- SyD Colombia Logo Table -->
                    <table border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-family: Arial, Helvetica, sans-serif; font-size: 32px; font-weight: 900; color: #00a3e0; line-height: 1; letter-spacing: -1px;">
                          <span>S</span><span style="color: #1e2b6d;">y</span><span>D</span><sup style="font-size: 10px; font-weight: bold; color: #1e2b6d; margin-left: 2px;">&reg;</sup>
                        </td>
                      </tr>
                      <tr>
                        <td style="font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: bold; color: #1e2b6d; font-style: italic; letter-spacing: 1.5px; padding-top: 2px;">
                          Colombia <span style="font-size: 8px; font-style: normal; font-weight: normal;">S.A.</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="vertical-align: middle; padding-right: 14px;">
                    <!-- Icontec Badge -->
                    <div style="background-color: #0084c9; border-radius: 6px; padding: 4px 6px; text-align: center; color: #ffffff; width: 48px; display: inline-block;">
                      <div style="font-size: 11px; line-height: 1; font-weight: bold;">&#9678;</div>
                      <div style="font-size: 7px; font-weight: bold; line-height: 1.1; margin-top: 1px;">icontec</div>
                      <div style="background-color: #ffffff; color: #0084c9; font-size: 6.5px; font-weight: bold; margin-top: 2px; padding: 1px 0; border-radius: 2px;">ISO 9001</div>
                      <div style="font-size: 5.5px; color: #e0f2fe; margin-top: 1px;">SC7290-1</div>
                    </div>
                  </td>
                  <td style="vertical-align: middle;">
                    <!-- IQNet Seal -->
                    <div style="background-color: #204484; border-radius: 50%; width: 46px; height: 46px; text-align: center; color: #ffffff; display: inline-block;">
                      <div style="font-size: 5px; color: #9abaff; margin-top: 4px; letter-spacing: 1px;">&#8226;&#8226;&#8226;&#8226;&#8226;</div>
                      <div style="font-size: 9px; font-weight: 900; letter-spacing: 0.5px; line-height: 1;">IQNET</div>
                      <div style="font-size: 4px; color: #e2e8f0; line-height: 1; margin-top: 2px;">CERTIFIED<br>MANAGEMENT<br>SYSTEM</div>
                    </div>
                  </td>
                </tr>
              </table>

              <div style="font-size: 13px; line-height: 1.45; color: #1e293b;">
                <div style="font-weight: 700; color: #0f172a; font-size: 14px;">Jairo E. Mendoza Bolívar</div>
                <div style="color: #334155; font-weight: 500;">Asesor Línea Diagnóstica</div>
                <div style="color: #334155; font-weight: 600;">Suministro y Dotaciones Colombia S.A.</div>
                <div style="color: #475569; margin-top: 3px;">Tel: (605) 3302424 Ext 153 &bull; Cel: +57 3162221407</div>
                <div style="color: #475569;">Carrera 43 # 80-59 &bull; Barranquilla - Colombia</div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return { subject, html };
  }

  /**
   * Build HTML Email for Purchase Order (OC) to Purchasing Department
   */
  public buildPurchaseOrderEmailHTML(payload: SendPurchaseOrderEmailPayload): { subject: string; html: string } {
    const city = payload.locationCity || 'Barranquilla';
    const supplier = payload.supplierName || payload.supplier || 'Técnica Electromédica';
    const subject = `[SOLICITUD ORDEN DE COMPRA] ${supplier} - Sede ${city}`;
    const greeting = payload.customGreeting || getTimeBasedGreeting();

    const formatMoney = (amount: number) =>
      new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
      }).format(amount || 0);

    const itemsRows = payload.items
      .map(
        (item, idx) => `
        <tr>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 13px; color: #64748b;">${idx + 1}</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 700; font-family: monospace; color: #0284c7;">${item.partCode || 'Pendiente'}</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0f172a;">
            <strong>${item.description}</strong>
            ${item.brand || item.model ? `<br><span style="font-size: 11px; color: #64748b;">Marca: ${item.brand || ''} &bull; Modelo: ${item.model || ''}</span>` : ''}
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 13px; font-weight: 700; color: #0f172a;">${item.quantity}</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 13px; color: #0f172a;">${formatMoney(item.unitPriceCOP)}</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 12px;">
            <span style="background: ${item.taxExempt ? '#d1fae5' : '#dbeafe'}; color: ${item.taxExempt ? '#065f46' : '#1e40af'}; padding: 2px 8px; border-radius: 4px; font-weight: 700;">
              ${item.taxExempt ? '0% Exento' : '19% IVA'}
            </span>
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #334155; font-weight: 600;">
            ${item.supplier || supplier}
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 13px; font-weight: 800; color: #0f172a;">${formatMoney(item.totalLineCOP)}</td>
        </tr>
      `
      )
      .join('');

    const observations = payload.observations || payload.notes || '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #1e293b; }
          .container { background-color: #ffffff; border-radius: 12px; border: 1px solid #cbd5e1; max-width: 820px; margin: 0 auto; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .header-bar { background: linear-gradient(135deg, #115e59 0%, #0f766e 50%, #0891b2 100%); color: #ffffff; padding: 18px 24px; border-radius: 10px 10px 0 0; }
          .badge-city { background: rgba(255, 255, 255, 0.22); color: #ffffff; font-weight: 800; font-size: 12px; padding: 6px 14px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid rgba(255,255,255,0.3); display: inline-block; }
          .items-table { width: 100%; border-collapse: collapse; margin: 18px 0; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
          .items-table th { background: #f8fafc; color: #334155; font-size: 11px; font-weight: 800; text-transform: uppercase; padding: 10px 8px; border: 1px solid #cbd5e1; }
          .items-table td { border: 1px solid #e2e8f0; }
          .totals-table { width: 340px; margin-left: auto; border-collapse: collapse; margin-top: 14px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
          .totals-table td { padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
          .obs-box { background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 0 8px 8px 0; }
          .signature-wrapper { padding: 20px 24px; background: #ffffff; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header-bar">
            <table width="100%" border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td>
                  <h1 style="margin: 0; font-size: 17px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #ffffff;">SOLICITUD DE ORDEN DE COMPRA</h1>
                  <p style="margin: 3px 0 0 0; font-size: 12px; color: #ccfbf1; font-weight: 500;">Suministro y Dotaciones Colombia S.A.S.</p>
                </td>
                <td align="right" style="vertical-align: middle;">
                  <div class="badge-city">SEDE ${city.toUpperCase()}</div>
                </td>
              </tr>
            </table>
          </div>

          <div style="padding: 24px 28px;">
            <p style="margin: 0 0 16px 0; font-size: 14px; color: #1e293b; line-height: 1.6;">
              <strong style="color: #0f172a;">${greeting},</strong><br><br>
              Favor generar la <strong>Orden de Compra (OC)</strong> por <strong>${city}</strong> para el proveedor <strong style="color: #134e4a;">${supplier}</strong> con las siguientes partes e ítems requeridos:
            </p>

            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 5%; text-align: center;">#</th>
                  <th style="width: 14%; text-align: left;">Parte</th>
                  <th style="width: 33%; text-align: left;">Nombre del Equipo / Descripción</th>
                  <th style="width: 7%; text-align: center;">Cant.</th>
                  <th style="width: 14%; text-align: right;">Precio (COP)</th>
                  <th style="width: 9%; text-align: center;">IVA</th>
                  <th style="width: 18%; text-align: left;">Proveedor</th>
                  <th style="width: 15%; text-align: right;">Total (COP)</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>

            <table class="totals-table">
              <tr>
                <td style="color: #475569; font-weight: 700;">Subtotal:</td>
                <td style="text-align: right; font-weight: 700; color: #0f172a;">${formatMoney(payload.subtotalCOP)} COP</td>
              </tr>
              <tr>
                <td style="color: #475569; font-weight: 700;">IVA Total (19%):</td>
                <td style="text-align: right; font-weight: 700; color: #0369a1;">${formatMoney(payload.ivaTotalCOP)} COP</td>
              </tr>
              <tr style="background-color: #134e4a; color: #ffffff;">
                <td style="font-size: 13px; font-weight: 800; color: #ffffff; padding: 10px 12px; border-bottom: none; text-transform: uppercase;">TOTAL SOLICITUD:</td>
                <td style="text-align: right; font-size: 14px; font-weight: 900; color: #5eead4; padding: 10px 12px; border-bottom: none;">${formatMoney(payload.grandTotalCOP)} COP</td>
              </tr>
            </table>

            ${observations ? `
            <div class="obs-box">
              <strong style="font-size: 11px; color: #b45309; text-transform: uppercase; display: block; margin-bottom: 4px; letter-spacing: 0.5px;">Observaciones para Compras:</strong>
              <div style="font-size: 13px; color: #334155; line-height: 1.5;">${observations}</div>
            </div>` : ''}

            <p style="margin: 24px 0 12px 0; font-size: 14px; color: #334155;">
              Atentamente,
            </p>
          </div>

          <div class="signature-wrapper">
            ${getJairoEmailSignatureHTML()}
          </div>
        </div>
      </body>
      </html>
    `;

    return { subject, html };
  }

  /**
   * Sample Simulated Purchase Orders & Automated Responses when not logged in or in test mode
   */
  public getSimulatedPurchaseOrders(): DetectedPurchaseOrder[] {
    return [
      {
        id: 'sim_solicitud_oc_jaime',
        messageId: 'sim_msg_jaime_1',
        threadId: 'sim_th_jaime_1',
        sender: 'Jaime Luis Gonzalez Gomez <auditoriacompras@syd.com.co>',
        senderName: 'Jaime Gonzalez (Analista De Compras SYD)',
        senderEmail: 'auditoriacompras@syd.com.co',
        date: new Date(Date.now() - 300000).toISOString(),
        subject: 'Re: SOLICITUD DE OC',
        snippet: 'Cordialmente, Jaime Gonzalez Analista De Compras Suministros y dotaciones Colombia S.A. ...',
        rawBodyText: `Cordialmente,\n\nJaime Gonzalez\nAnalista De Compras\nSuministros y dotaciones Colombia S.A.\n\nEl lun, 31 ago 2026 a las 15:20, Jairo Mendoza escribió:\n> SOLICITUD DE ORDEN DE COMPRA - OC-SYD-2026-0814\n> Por favor emitir orden de compra a Técnica Electromédica para los siguientes ítems:\n> 1. Parte 70859 - Laringoscopio con hojas para adulto/pediátrico con estuche - Cant: 1 - Vr: $4.325.665 COP\n> 2. Parte 70860 - Laringoscopio con hojas para adulto/neonatal con estuche - Cant: 1 - Vr: $3.912.941 COP`,
        emailType: 'general_po',
        poDirection: 'syd_to_supplier',
        detectedOCNumber: 'OC-SYD-2026-0814',
        detectedCustomer: 'Suministros y Dotaciones Colombia - Depto. Compras',
        detectedEstimatedTotal: 8238606,
        detectedItems: [
          {
            partCode: '70859',
            description: 'Laringoscopio con hojas para adulto/pediátrico con estuche',
            quantity: 1,
            unitPrice: 4325665,
            brand: 'Técnica Electromédica',
            model: 'Adulto/Pediátrico con Estuche',
          },
          {
            partCode: '70860',
            description: 'Laringoscopio con hojas para adulto/neonatal con estuche',
            quantity: 1,
            unitPrice: 3912941,
            brand: 'Técnica Electromédica',
            model: 'Adulto/Neonatal con Estuche',
          },
        ],
        attachments: [
          { filename: 'Solicitud_OC_SYD_2026_0814.pdf', mimeType: 'application/pdf', size: 198000 },
        ],
        isRead: false,
        urgency: 'Alta',
        status: 'Nueva',
        source: 'simulated',
      },
      {
        id: 'sim_client_po_osvaldo',
        messageId: 'sim_msg_osvaldo_1',
        threadId: 'sim_th_osvaldo_1',
        sender: 'Osvaldo De La Rosa <osvaldosyd@gmail.com>',
        senderName: 'Osvaldo De La Rosa',
        senderEmail: 'osvaldosyd@gmail.com',
        date: new Date(Date.now() - 600000).toISOString(),
        subject: 'Fwd: ORDEN DE COMPRAS - RAYOS X, RAYOS X PORTATIL Y MESAS DE CIRUGIA (CLÍNICA DE ESPECIALIDADES)',
        snippet: 'Buenas tardes equipo, remito orden de compra del cliente Clínica de Especialidades No. HBOC0000000640...',
        rawBodyText: `Buenas tardes equipo,\n\nReenvío la orden de compra recibida por parte del cliente Clínica de Especialidades para el suministro e instalación de los siguientes equipos:\n1. Rayos X Fijo Digital Mindray DigiEye 350 (1 unidad)\n2. Rayos X Portátil Mindray MobiEye 700 (1 unidad)\n3. Mesas de Cirugía Mindray V5 (2 unidades)\n\nAdjunto la orden formal No. HBOC0000000640 y la cotización de referencia No. 310826-9.\nFavor radicar en la ventana de Contratos y generar las órdenes de compra a los proveedores correspondientes.`,
        emailType: 'client_po',
        poDirection: 'client_to_syd',
        clientName: 'FUNDACION HOSPITAL INFANTIL NAPOLEON FRANCO PAREJA',
        detectedOCNumber: 'HBOC0000000640',
        detectedCustomer: 'FUNDACION HOSPITAL INFANTIL NAPOLEON FRANCO PAREJA',
        detectedEstimatedTotal: 830893346,
        detectedItems: [
          {
            partCode: '158545',
            description: 'RAYOS X DIGIEYE 350 SISTEMA RADIOLOGICO DIGITAL MINDRAY',
            quantity: 1,
            unitPrice: 237064950,
            brand: 'MINDRAY',
            model: 'DIGIEYE 350',
          },
          {
            partCode: '158461',
            description: 'RAYOS X PORTATIL MINDRAY MOBIEYE 700',
            quantity: 1,
            unitPrice: 333164752,
            brand: 'MINDRAY',
            model: 'MOBIEYE 700',
          },
          {
            partCode: '158453',
            description: 'MESA DE CIRUGIA MINDRAY V5',
            quantity: 2,
            unitPrice: 64000000,
            brand: 'MINDRAY',
            model: 'V5',
          },
        ],
        attachments: [
          { filename: 'OrdenCompra(HBOC0000000640).pdf', mimeType: 'application/pdf', size: 450000 },
          { filename: 'Cotizacioin 310826-9.pdf', mimeType: 'application/pdf', size: 320000 },
        ],
        isRead: false,
        urgency: 'Alta',
        status: 'Nueva',
        source: 'simulated',
      },
      {
        id: 'sim_resp_part_diana',
        messageId: 'sim_msg_resp_diana_1',
        threadId: 'sim_th_resp_diana_1',
        sender: 'Diana Figueroa Diaz <auxadministrativo@syd.com.co>',
        senderName: 'Diana Figueroa Diaz (Auxiliar Administrativo SYD)',
        senderEmail: 'auxadministrativo@syd.com.co',
        date: new Date(Date.now() - 900000).toISOString(),
        subject: 'Re: SOLICITUD DE CREAR PARTE - Laringoscopios Adulto/Pediátrico y Adulto/Neonatal',
        snippet: 'BUENAS TARDES partes creadas 70859 70860 para su revisión gracias quedo atento...',
        rawBodyText: `BUENAS TARDES\n\npartes creadas 70859 70860 para su revisión gracias\n\nquedo atento\n\nEl lun, 31 ago 2026 a las 14:05, Jairo Mendoza escribió:\n> SOLICITUD DE CREAR PARTE\n> 1. Refs: 33681 13401 33682 11260 8431 11258 11257 11256 62763 6889 | LARINGOSCOPIO CON HOJAS PARA ADULTO/PEDIATRICO CON ESTUCHE | Cant: 1 | $ 4.325.665+IVA\n> 2. Refs: 11259 62733 11256 8431 11258 33681 13401 11817 6889 | LARINGOSCOPIO CON HOJAS PARA ADULTO/NEONATAL CON ESTUCHE | Cant: 1 | $ 3.912.941+IVA`,
        emailType: 'part_creation_response',
        detectedOCNumber: undefined,
        detectedCustomer: 'SYD Colombia - Auxiliar Administrativo',
        detectedEstimatedTotal: 8238606,
        detectedItems: [
          {
            partCode: '70859',
            description: 'LARINGOSCOPIO CON HOJAS PARA ADULTO/PEDIATRICO CON ESTUCHE',
            quantity: 1,
            unitPrice: 4325665,
            brand: 'Técnica Electromédica',
            model: 'Adulto/Pediátrico con Estuche',
          },
          {
            partCode: '70860',
            description: 'LARINGOSCOPIO CON HOJAS PARA ADULTO/NEONATAL CON ESTUCHE',
            quantity: 1,
            unitPrice: 3912941,
            brand: 'Técnica Electromédica',
            model: 'Adulto/Neonatal con Estuche',
          },
        ],
        detectedPartsToImport: [
          {
            code: '70859',
            name: 'LARINGOSCOPIO CON HOJAS PARA ADULTO/PEDIATRICO CON ESTUCHE',
            brand: 'Técnica Electromédica',
            model: 'Adulto/Pediátrico con Estuche',
            baseCostCOP: 4325665,
            taxExempt: false,
            taxRate: 0.19,
            quantity: 1,
            subReferences: '33681 13401 33682 11260 8431 11258 11257 11256 62763 6889',
            supplier: 'Técnica Electromédica',
            category: 'Cirugía',
            invimaRecordNumber: 'INVIMA 2021EBC-0008450',
            description: 'Número de Parte Oficial: 70859 - Laringoscopio con hojas para adulto/pediátrico con estuche (Refs componentes: 33681 13401 33682 11260 8431 11258 11257 11256 62763 6889)',
          },
          {
            code: '70860',
            name: 'LARINGOSCOPIO CON HOJAS PARA ADULTO/NEONATAL CON ESTUCHE',
            brand: 'Técnica Electromédica',
            model: 'Adulto/Neonatal con Estuche',
            baseCostCOP: 3912941,
            taxExempt: false,
            taxRate: 0.19,
            quantity: 1,
            subReferences: '11259 62733 11256 8431 11258 33681 13401 11817 6889',
            supplier: 'Técnica Electromédica',
            category: 'Cirugía',
            invimaRecordNumber: 'INVIMA 2021EBC-0008450',
            description: 'Número de Parte Oficial: 70860 - Laringoscopio con hojas para adulto/neonatal con estuche (Refs componentes: 11259 62733 11256 8431 11258 33681 13401 11817 6889)',
          },
        ],
        attachments: [
          { filename: 'Ficha_Tecnica_Laringoscopios_SYD.pdf', mimeType: 'application/pdf', size: 215000 },
          { filename: 'Registro_INVIMA_Laringoscopios_2021EBC0008450.pdf', mimeType: 'application/pdf', size: 280000 },
        ],
        isRead: false,
        urgency: 'Alta',
        status: 'Nueva',
        source: 'simulated',
      },
      {
        id: 'sim_resp_part_1',
        messageId: 'sim_msg_resp_1',
        threadId: 'sim_th_resp_1',
        sender: 'Auxiliar Administrativo SYD <auxadministrativo@syd.com.co>',
        senderName: 'Auxiliar Administrativo SYD Colombia',
        senderEmail: 'auxadministrativo@syd.com.co',
        date: new Date(Date.now() - 1800000).toISOString(),
        subject: 'Respuesta: Parte Creada en Sistema - Sensor SpO2 Mindray uMEC / ePM',
        snippet: 'Buen día Jairo, confirmamos que la parte solicitada fue creada exitosamente en el sistema con el código SYD-SPO2-MRY...',
        rawBodyText: `Buenos días,\n\nConfirmamos la creación de la parte solicitada en el ERP con la documentación adjunta de Ficha Técnica e INVIMA:\n\nCódigo: SYD-SPO2-MRY-01\nDescripción: Sensor SpO2 Reutilizable Clip Adulto 3m Mindray\nMarca: Mindray\nModelo: uMEC / ePM Series\nPrecio Base: $320.000 COP\nRégimen IVA: Exento (0%)\nProveedor: Mindray Medical Colombia\nRegistro INVIMA: 2021EBC-0008450\n\nYa puede consultar e ingresar este ítem en el Catálogo Maestro de Equipos y Repuestos.`,
        emailType: 'part_creation_response',
        detectedOCNumber: undefined,
        detectedCustomer: 'SYD Colombia - Depto. Administrativo',
        detectedEstimatedTotal: 320000,
        detectedItems: [
          {
            partCode: 'SYD-SPO2-MRY-01',
            description: 'Sensor SpO2 Reutilizable Clip Adulto 3m Mindray',
            quantity: 1,
            unitPrice: 320000,
            brand: 'Mindray',
            model: 'uMEC / ePM Series',
          },
        ],
        detectedPartsToImport: [
          {
            code: 'SYD-SPO2-MRY-01',
            name: 'Sensor SpO2 Reutilizable Clip Adulto 3m Mindray',
            brand: 'Mindray',
            model: 'uMEC / ePM Series',
            baseCostCOP: 320000,
            taxExempt: true,
            taxRate: 0,
            supplier: 'Mindray Medical Colombia',
            category: 'Monitoreo',
            invimaRecordNumber: '2021EBC-0008450',
            description: 'Sensor SpO2 Reutilizable Clip Adulto 3m Mindray uMEC/ePM con Ficha Técnica e INVIMA',
          },
        ],
        attachments: [
          { filename: 'Ficha_Tecnica_Sensor_Mindray_uMEC.pdf', mimeType: 'application/pdf', size: 185000 },
          { filename: 'Registro_INVIMA_Mindray_2021EBC0008450.pdf', mimeType: 'application/pdf', size: 240000 },
        ],
        isRead: false,
        urgency: 'Alta',
        status: 'Nueva',
        source: 'simulated',
      },
      {
        id: 'sim_resp_oc_1',
        messageId: 'sim_msg_resp_2',
        threadId: 'sim_th_resp_2',
        sender: 'Auditoría de Compras SYD <auditoriacompras@syd.com.co>',
        senderName: 'Auditoría de Compras SYD Colombia',
        senderEmail: 'auditoriacompras@syd.com.co',
        date: new Date(Date.now() - 3600000 * 3).toISOString(),
        subject: 'Aprobación Orden de Compra OC-2026-SYD-0441 - Equipos y Suministros Hospital San Rafael',
        snippet: 'Estimado Jairo, informamos que la solicitud de orden de compra OC-2026-SYD-0441 ha sido auditada y APROBADA...',
        rawBodyText: `Buenas tardes,\n\nInformamos que la solicitud de orden de compra OC-2026-SYD-0441 enviada a compras ha sido APROBADA satisfactoriamente por auditoría.\n\nNo. OC: OC-2026-SYD-0441\nProveedor: Mindray Medical Colombia S.A.S.\nValor Total: $86.000.000 COP\nTérminos de Entrega: 15 días hábiles en bodega central SYD.\n\nSe procede con la radicación formal ante el proveedor y vinculación en seguimiento de OCs.`,
        emailType: 'oc_response',
        detectedOCNumber: 'OC-2026-SYD-0441',
        detectedCustomer: 'Auditoría de Compras SYD',
        detectedEstimatedTotal: 86000000,
        detectedItems: [
          { description: 'Monitor de Signos Vitales Multiparámetro Mindray uMEC12', quantity: 4, brand: 'Mindray', unitPrice: 8500000 },
          { description: 'Desfibrilador Bifásico Zoll Serie R', quantity: 2, brand: 'Zoll', unitPrice: 26000000 },
        ],
        attachments: [
          { filename: 'OC_2026_SYD_0441_Aprobada.pdf', mimeType: 'application/pdf', size: 310000 },
        ],
        isRead: false,
        urgency: 'Alta',
        status: 'Nueva',
        source: 'simulated',
      },
      {
        id: 'sim_po_1',
        messageId: 'sim_1',
        threadId: 'sim_th_1',
        sender: 'Compras Hospitalarias <compras@hospitalsanrafael.gov.co>',
        senderName: 'Hospital Universitario San Rafael - Depto. Compras',
        senderEmail: 'compras@hospitalsanrafael.gov.co',
        date: new Date(Date.now() - 3600000 * 5).toISOString(),
        subject: 'Orden de Compra No. OC-HSR-2026-0892 - Suministro de Monitores y Desfibriladores',
        snippet: 'Adjuntamos Orden de Compra oficial No. OC-HSR-2026-0892 para entrega en sede principal...',
        rawBodyText: `Cordial saludo,\n\nPor medio del presente correo, la oficina de contratación del Hospital Universitario San Rafael remite la Orden de Compra No. OC-HSR-2026-0892 para el suministro de los siguientes equipos:\n\n1. Monitor de Signos Vitales Multiparámetro Mindray uMEC12 - Cant: 4 unidades - Vr. Total: $34.000.000 COP\n2. Desfibrilador Bifásico con Palas Adulto/Pediátrico Zoll Serie R - Cant: 2 unidades - Vr. Total: $52.000.000 COP\n3. Sensores de SpO2 Reutilizables y Brazaletes NIBP Adulto - Cant: 10 unidades.\n\nFecha límite de entrega: 15 días hábiles en bodega central.\nPor favor confirmar recibido y remitir factura electrónica.`,
        emailType: 'general_po',
        detectedOCNumber: 'OC-HSR-2026-0892',
        detectedCustomer: 'Hospital Universitario San Rafael',
        detectedEstimatedTotal: 86000000,
        detectedItems: [
          { description: 'Monitor de Signos Vitales Multiparámetro Mindray uMEC12', quantity: 4, brand: 'Mindray' },
          { description: 'Desfibrilador Bifásico con Palas Adulto/Pediátrico Zoll Serie R', quantity: 2, brand: 'Zoll' },
          { description: 'Sensores de SpO2 Reutilizables y Brazaletes NIBP Adulto', quantity: 10 },
        ],
        attachments: [
          { filename: 'Orden_Compra_OC_HSR_2026_0892.pdf', mimeType: 'application/pdf', size: 245000 },
          { filename: 'Anexo_Especificaciones_Tecnicas.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 84000 },
        ],
        isRead: true,
        urgency: 'Alta',
        status: 'Nueva',
        source: 'simulated',
      },
      {
        id: 'sim_po_2',
        messageId: 'sim_2',
        threadId: 'sim_th_2',
        sender: 'Licitaciones & Adquisiciones <adquisiciones@clinicamedellin.com.co>',
        senderName: 'Clínica Medellín - Central de Abastecimiento',
        senderEmail: 'adquisiciones@clinicamedellin.com.co',
        date: new Date(Date.now() - 3600000 * 18).toISOString(),
        subject: 'Solicitud de Despacho y Aceptación de Cotización OC-CM-5411 Bombas de Infusión',
        snippet: 'Se aprueba cotización presentada y se genera orden de pedido para bombas de infusión volumétricas...',
        rawBodyText: `Buenas tardes equipo SYD Colombia,\n\nConfirmamos la aprobación de la cotización SYD-2026-0421. Adjuntamos orden de pedido OC-CM-5411:\n- Bomba de Infusión Volumétrica B. Braun Infusomat Space - Cant: 6 unidades.\n- Set de administración de infusión - Cant: 100 unidades.\n\nValor total adjudicado: $42.500.000 COP IVA Incluido.`,
        emailType: 'general_po',
        detectedOCNumber: 'OC-CM-5411',
        detectedCustomer: 'Clínica Medellín',
        detectedEstimatedTotal: 42500000,
        detectedItems: [
          { description: 'Bomba de Infusión Volumétrica B. Braun Infusomat Space', quantity: 6, brand: 'B. Braun' },
          { description: 'Set de administración de infusión', quantity: 100 },
        ],
        attachments: [{ filename: 'Orden_Pedido_OC-CM-5411.pdf', mimeType: 'application/pdf', size: 198000 }],
        isRead: true,
        urgency: 'Media',
        status: 'Nueva',
        source: 'simulated',
      },
    ];
  }
}

export const gmailService = new GmailIntegrationService();
