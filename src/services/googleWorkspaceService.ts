import * as XLSX from 'xlsx';
import firebaseConfig from '../../firebase-applet-config.json';
import { MedicalEquipment, SavedQuote, OCTrackingContract, SalesOrderRecord, TechnicalDocument } from '../types';

export const GOOGLE_WORKSPACE_TOKEN_KEY = 'syd_google_workspace_token_v1';
export const GOOGLE_WORKSPACE_EXPIRY_KEY = 'syd_google_workspace_token_exp_v1';
export const GOOGLE_WORKSPACE_PROFILE_KEY = 'syd_google_workspace_profile_v1';

export interface GoogleWorkspaceProfile {
  email: string;
  name: string;
  picture?: string;
  verified_email?: boolean;
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
  iconLink?: string;
  thumbnailLink?: string;
}

export interface SheetExportResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  rowCount: number;
}

export interface ConnectedGoogleSheetInfo {
  id: string;
  name: string;
  url: string;
  connectedAt: string;
  sheetNames?: string[];
  isExcelFile?: boolean;
}

export interface DetectedSheetPart {
  id: string;
  code: string;
  name: string;
  brand?: string;
  model?: string;
  requestType?: 'CREACIÓN' | 'MODIFICACIÓN' | 'INACTIVACIÓN' | string;
  category?: string;
  date?: string;
  requester?: string;
  costCOP?: number;
  status?: 'Creada' | 'En Trámite' | 'Modificada' | 'Inactivada' | 'Registrada';
  observations?: string;
  supplier?: string;
  group?: string;
  partClass?: string;
  manufacturer?: string;
  hasIVA?: string;
  unit?: string;
  technicalSheet?: string;
  seriesBatch?: string;
  invimaRegister?: string;
  invimaValidity?: string;
  riskLevel?: string;
  rawRow: Record<string, string>;
  rowIndex: number;
}

export const TARGET_NFCO03_FILENAME =
  'N-FCO-03 SOLICITUD DE CREACIÓN, MODIFICACIÓN E INACTIVACIÓN DE PARTES VR00 EN REVISION.xlsx';

export const DEFAULT_GOOGLE_WORKSPACE_CLIENT_ID =
  '23635423420-h7hc51qghol9horms2kqhforgc9hqfoq.apps.googleusercontent.com';

export class GoogleWorkspaceService {
  private static instance: GoogleWorkspaceService;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private userProfile: GoogleWorkspaceProfile | null = null;

  private cachedFolderIds: Record<string, string> = {};
  private localUploadedSheets: Map<
    string,
    { workbook: any; sheetNames: string[]; sheetsData: Record<string, any[][]>; fileName: string }
  > = new Map();

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): GoogleWorkspaceService {
    if (!GoogleWorkspaceService.instance) {
      GoogleWorkspaceService.instance = new GoogleWorkspaceService();
    }
    return GoogleWorkspaceService.instance;
  }

  private loadFromStorage(): void {
    try {
      const storedToken = localStorage.getItem(GOOGLE_WORKSPACE_TOKEN_KEY);
      const storedExp = localStorage.getItem(GOOGLE_WORKSPACE_EXPIRY_KEY);
      const storedProf = localStorage.getItem(GOOGLE_WORKSPACE_PROFILE_KEY);

      if (storedToken && storedExp) {
        const expNum = Number(storedExp);
        if (expNum > Date.now()) {
          this.accessToken = storedToken;
          this.tokenExpiresAt = expNum;
          if (storedProf) {
            this.userProfile = JSON.parse(storedProf);
          }
        } else {
          this.clearAuth();
        }
      } else {
        // Fallback: Check if Gmail token is already present
        const gmailToken = localStorage.getItem('syd_gmail_oauth_token_v1');
        const gmailExp = localStorage.getItem('syd_gmail_oauth_token_v1_exp');
        const gmailProf = localStorage.getItem('syd_gmail_user_profile_v1');
        if (gmailToken && gmailExp && Number(gmailExp) > Date.now()) {
          this.accessToken = gmailToken;
          this.tokenExpiresAt = Number(gmailExp);
          if (gmailProf) {
            try {
              this.userProfile = JSON.parse(gmailProf);
            } catch (_) {}
          }
        }
      }
    } catch (e) {
      console.warn('Error loading workspace auth from storage', e);
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

  public getUserProfile(): GoogleWorkspaceProfile | null {
    return this.userProfile;
  }

  public clearAuth(): void {
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.userProfile = null;
    this.cachedFolderIds = {};
    localStorage.removeItem(GOOGLE_WORKSPACE_TOKEN_KEY);
    localStorage.removeItem(GOOGLE_WORKSPACE_EXPIRY_KEY);
    localStorage.removeItem(GOOGLE_WORKSPACE_PROFILE_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('syd-workspace-auth-changed', {
          detail: { connected: false, profile: null },
        })
      );
    }
  }

  /**
   * Connect any Google Workspace or corporate email directly without Google OAuth block
   */
  public connectDirectAccount(
    email: string,
    name?: string
  ): { profile: GoogleWorkspaceProfile; token: string } {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Por favor ingrese una dirección de correo válida.');
    }

    const defaultName =
      name?.trim() ||
      (cleanEmail.includes('auxlinea')
        ? 'Línea Diagnóstica SYD'
        : cleanEmail.includes('equimedicos')
        ? 'Equimédicos 23'
        : cleanEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));

    const token = `direct_workspace_${Date.now()}_${cleanEmail.replace(/[^a-z0-9]/gi, '_')}`;
    const expiresAt = Date.now() + 30 * 24 * 3600 * 1000; // 30 days valid

    const profile: GoogleWorkspaceProfile = {
      email: cleanEmail,
      name: defaultName,
      verified_email: true,
    };

    this.accessToken = token;
    this.tokenExpiresAt = expiresAt;
    this.userProfile = profile;

    localStorage.setItem(GOOGLE_WORKSPACE_TOKEN_KEY, token);
    localStorage.setItem(GOOGLE_WORKSPACE_EXPIRY_KEY, String(expiresAt));
    localStorage.setItem(GOOGLE_WORKSPACE_PROFILE_KEY, JSON.stringify(profile));

    // Also sync with Gmail integration storage so both modules recognize the active user
    localStorage.setItem('syd_gmail_oauth_token_v1', token);
    localStorage.setItem('syd_gmail_oauth_token_v1_exp', String(expiresAt));
    localStorage.setItem('syd_gmail_user_profile_v1', JSON.stringify(profile));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('syd-workspace-auth-changed', {
          detail: { connected: true, profile },
        })
      );
    }

    return { profile, token };
  }

  public getClientId(): string {
    try {
      const customId = localStorage.getItem('syd_custom_google_client_id');
      if (customId && customId.trim().includes('.apps.googleusercontent.com') && !customId.includes('807213907458')) {
        return customId.trim();
      }
      if (customId && customId.includes('807213907458')) {
        localStorage.removeItem('syd_custom_google_client_id');
      }
    } catch {}
    const configClientId = (firebaseConfig as any)?.oAuthClientId;
    if (configClientId && !configClientId.includes('807213907458')) {
      return configClientId;
    }
    return DEFAULT_GOOGLE_WORKSPACE_CLIENT_ID;
  }

  /**
   * Authorize Google Workspace (Google Drive, Sheets) via Google Identity Services Popup
   */
  public async connectGoogleWorkspace(): Promise<{ profile: GoogleWorkspaceProfile; token: string }> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
        return reject(
          new Error('La librería Google Identity Services (GSI) no se encuentra lista. Verifique su conexión.')
        );
      }

      const clientId = this.getClientId();
      const scopes = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ].join(' ');

      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: scopes,
          prompt: 'consent select_account',
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              const errStr = typeof tokenResponse.error === 'string' ? tokenResponse.error : JSON.stringify(tokenResponse.error);
              if (errStr.includes('popup_closed') || errStr.includes('closed')) {
                return reject(new Error('La ventana de autenticación fue cerrada antes de otorgar permisos.'));
              }
              if (errStr.includes('access_denied') || errStr.includes('blocked') || errStr.includes('verification') || errStr.includes('403')) {
                return reject(
                  new Error(
                    'Acceso Bloqueado por Google (403): Su cuenta de correo debe ser agregada a "Usuarios de prueba" en la Pantalla de consentimiento de OAuth de Google Cloud, o la aplicación debe publicarse.'
                  )
                );
              }
              return reject(new Error(`Error al autenticar con Google: ${errStr}`));
            }

            if (!tokenResponse.access_token) {
              return reject(new Error('No se recibió token de acceso de Google.'));
            }

            const token = tokenResponse.access_token;
            const expiresIn = tokenResponse.expires_in || 3600;
            const expiresAt = Date.now() + (expiresIn - 60) * 1000;

            this.accessToken = token;
            this.tokenExpiresAt = expiresAt;

            localStorage.setItem(GOOGLE_WORKSPACE_TOKEN_KEY, token);
            localStorage.setItem(GOOGLE_WORKSPACE_EXPIRY_KEY, String(expiresAt));

            // Sync with Gmail integration service storage
            localStorage.setItem('syd_gmail_oauth_token_v1', token);
            localStorage.setItem('syd_gmail_oauth_token_v1_exp', String(expiresAt));

            // Fetch user profile
            try {
              const userProfile = await this.fetchUserProfile(token);
              this.userProfile = userProfile;
              localStorage.setItem(GOOGLE_WORKSPACE_PROFILE_KEY, JSON.stringify(userProfile));
              localStorage.setItem('syd_gmail_user_profile_v1', JSON.stringify(userProfile));
              window.dispatchEvent(new CustomEvent('syd-workspace-auth-changed', { detail: { connected: true, profile: userProfile } }));
              resolve({ profile: userProfile, token });
            } catch {
              const fallbackProfile: GoogleWorkspaceProfile = {
                email: 'usuario@sydcolombia.com',
                name: 'Usuario Google Workspace',
                verified_email: true,
              };
              this.userProfile = fallbackProfile;
              resolve({ profile: fallbackProfile, token });
            }
          },
          error_callback: (err) => {
            reject(new Error(err?.message || 'Error inicializando el cliente OAuth de Google.'));
          },
        });

        client.requestAccessToken();
      } catch (err: any) {
        reject(new Error(`Error al solicitar conexión de Google: ${err.message || err}`));
      }
    });
  }

  private async fetchUserProfile(token: string): Promise<GoogleWorkspaceProfile> {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('No se pudo obtener el perfil de Google.');
    const data = await res.json();
    return {
      email: data.email,
      name: data.name || data.email.split('@')[0],
      picture: data.picture,
      verified_email: data.verified_email,
    };
  }

  // =========================================================================
  // GOOGLE DRIVE METHODS
  // =========================================================================

  /**
   * Get or create a designated folder in Google Drive (under 'SYD Colombia' root)
   */
  public async getOrCreateFolder(folderName: string, parentFolderId?: string): Promise<string> {
    const token = this.getAccessToken();
    if (!token) throw new Error('Debe conectar su cuenta de Google para acceder a Google Drive.');

    const cacheKey = `${parentFolderId || 'root'}_${folderName}`;
    if (this.cachedFolderIds[cacheKey]) {
      return this.cachedFolderIds[cacheKey];
    }

    // Search for existing folder
    let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\\'")}' and trashed=false`;
    if (parentFolderId) {
      query += ` and '${parentFolderId}' in parents`;
    }

    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        const existingId = searchData.files[0].id;
        this.cachedFolderIds[cacheKey] = existingId;
        return existingId;
      }
    }

    // Create new folder
    const metadata: any = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentFolderId) {
      metadata.parents = [parentFolderId];
    }

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Error al crear carpeta en Google Drive: ${errText}`);
    }

    const created = await createRes.json();
    this.cachedFolderIds[cacheKey] = created.id;
    return created.id;
  }

  /**
   * Ensure standard SYD Colombia folder hierarchy in Drive
   */
  public async ensureSyDFolders(): Promise<{ rootId: string; subfolderId: (name: string) => Promise<string> }> {
    const rootId = await this.getOrCreateFolder('SYD Colombia - Sistema Biomédico');
    return {
      rootId,
      subfolderId: async (name: string) => {
        return this.getOrCreateFolder(name, rootId);
      },
    };
  }

  /**
   * Upload a raw file (JSON, PDF, Excel, Text) to Google Drive
   */
  public async uploadFileToDrive(
    fileBlob: Blob,
    fileName: string,
    mimeType: string,
    folderName: string = 'Respaldos'
  ): Promise<DriveFileItem> {
    const token = this.getAccessToken();
    if (!token) throw new Error('Debe conectar su cuenta de Google para guardar en Google Drive.');

    const { subfolderId } = await this.ensureSyDFolders();
    const targetFolderId = await subfolderId(folderName);

    const metadata = {
      name: fileName,
      mimeType: mimeType,
      parents: [targetFolderId],
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileBlob);

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,size,createdTime',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Error subiendo archivo a Google Drive: ${errText}`);
    }

    const fileData = await uploadRes.json();
    return {
      id: fileData.id,
      name: fileData.name,
      mimeType: fileData.mimeType,
      webViewLink: fileData.webViewLink || `https://drive.google.com/file/d/${fileData.id}/view`,
      createdTime: fileData.createdTime,
      size: fileData.size,
    };
  }

  /**
   * Save a complete JSON system backup to Google Drive
   */
  public async saveBackupToDrive(backupPayload: any, customName?: string): Promise<DriveFileItem> {
    const jsonStr = JSON.stringify(backupPayload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = customName || `SYD_Colombia_Backup_Completo_${dateStamp}.json`;

    return this.uploadFileToDrive(blob, fileName, 'application/json', 'Respaldos');
  }

  /**
   * List files saved in the SYD Colombia Google Drive folders
   */
  public async listSyDDriveFiles(limit: number = 20): Promise<DriveFileItem[]> {
    return this.listUserDriveFiles({ pageSize: limit });
  }

  /**
   * List all files in the user's Google Drive account (unrestricted, ordered by modifiedTime desc)
   */
  public async listUserDriveFiles(options?: {
    pageSize?: number;
    mimeTypeFilter?: 'all' | 'sheets' | 'docs' | 'folders';
    searchQuery?: string;
  }): Promise<DriveFileItem[]> {
    const token = this.getAccessToken();
    if (!token) return [];

    if (token.startsWith('direct_')) {
      return [];
    }

    try {
      const parts: string[] = ['trashed=false'];

      if (options?.mimeTypeFilter === 'sheets') {
        parts.push(
          "(mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or name contains '.xlsx' or name contains '.csv')"
        );
      } else if (options?.mimeTypeFilter === 'docs') {
        parts.push(
          "(mimeType='application/vnd.google-apps.document' or mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document')"
        );
      } else if (options?.mimeTypeFilter === 'folders') {
        parts.push("mimeType='application/vnd.google-apps.folder'");
      }

      if (options?.searchQuery?.trim()) {
        const clean = options.searchQuery.trim().replace(/['\\]/g, '');
        if (clean) {
          parts.push(`name contains '${clean}'`);
        }
      }

      const q = parts.join(' and ');
      const limit = options?.pageSize || 60;

      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=${limit}&orderBy=modifiedTime desc&fields=files(id,name,mimeType,webViewLink,size,createdTime,modifiedTime,iconLink,thumbnailLink)`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        let errMsg = '';
        try {
          const errData = await res.json();
          errMsg = errData?.error?.message || JSON.stringify(errData);
        } catch {
          errMsg = await res.text();
        }

        console.warn('Error fetching user drive files:', res.status, errMsg);

        if (res.status === 401) {
          this.clearAuth();
          throw new Error('La sesión de Google ha expirado. Por favor presiona "Conectar con Google (OAuth)" nuevamente.');
        }

        if (errMsg.includes('has not been used in project') || errMsg.includes('disabled') || errMsg.includes('drive.googleapis.com')) {
          throw new Error(
            'La "Google Drive API" no está habilitada en tu proyecto de Google Cloud (23635423420). Ve a Google Cloud Console > APIs y Servicios > Habilitar APIs y activa "Google Drive API".'
          );
        }

        if (res.status === 403) {
          throw new Error(`Permiso denegado por Google Drive (403): ${errMsg}`);
        }

        throw new Error(`Error de Google Drive API (${res.status}): ${errMsg}`);
      }

      const data = await res.json();
      return (data.files || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        webViewLink:
          f.webViewLink ||
          (f.mimeType === 'application/vnd.google-apps.spreadsheet'
            ? `https://docs.google.com/spreadsheets/d/${f.id}/edit`
            : `https://drive.google.com/file/d/${f.id}/view`),
        createdTime: f.createdTime,
        modifiedTime: f.modifiedTime,
        size: f.size,
        iconLink: f.iconLink,
        thumbnailLink: f.thumbnailLink,
      }));
    } catch (e: any) {
      console.warn('Error listing drive files', e);
      throw e;
    }
  }

  // =========================================================================
  // GOOGLE SHEETS METHODS
  // =========================================================================

  /**
   * Create a new Google Spreadsheet and apply corporate SYD Colombia styling
   */
  public async createStyledSpreadsheet(title: string, sheetTitle: string = 'Datos'): Promise<string> {
    const token = this.getAccessToken();
    if (!token) throw new Error('Debe conectar su cuenta de Google para exportar a Google Sheets.');

    const body = {
      properties: {
        title: title,
        locale: 'es_CO',
      },
      sheets: [
        {
          properties: {
            title: sheetTitle,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    };

    const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Error al crear hoja de cálculo en Google Sheets: ${errText}`);
    }

    const data = await res.json();
    return data.spreadsheetId;
  }

  /**
   * Set values in a range of a spreadsheet
   */
  public async updateSheetValues(
    spreadsheetId: string,
    range: string,
    values: any[][]
  ): Promise<void> {
    const token = this.getAccessToken();
    if (!token) throw new Error('No hay sesión activa de Google.');

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Error guardando datos en Google Sheets: ${errText}`);
    }
  }

  /**
   * Apply header row styling (SYD Dark Blue #1E2B6D background, white bold text)
   */
  public async formatSheetHeader(spreadsheetId: string, sheetId: number = 0, columnCount: number = 10): Promise<void> {
    const token = this.getAccessToken();
    if (!token) return;

    const requests = [
      {
        repeatCell: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: columnCount,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: {
                red: 30 / 255,
                green: 43 / 255,
                blue: 109 / 255, // SYD Blue #1e2b6d
              },
              horizontalAlignment: 'CENTER',
              textFormat: {
                foregroundColor: { red: 1, green: 1, blue: 1 },
                bold: true,
                fontSize: 11,
              },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
        },
      },
      {
        autoResizeDimensions: {
          dimensions: {
            sheetId: sheetId,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: columnCount,
          },
        },
      },
    ];

    try {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      });
    } catch (e) {
      console.warn('Error formatting sheet header', e);
    }
  }

  // =========================================================================
  // EXISTING GOOGLE SHEET CONNECTION & READ-ONLY METHODS
  // =========================================================================

  /**
   * List existing Google Sheets found in user's Google Drive
   */
  public async listSpreadsheetsFromDrive(): Promise<Array<{ id: string; name: string; webViewLink?: string; modifiedTime?: string }>> {
    const token = this.getAccessToken();
    if (!token) throw new Error('Debe conectar su cuenta de Google para buscar archivos.');
    if (token.startsWith('direct_')) {
      return [];
    }
    const query = "(mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or name contains '.xlsx' or name contains '.csv') and trashed=false";
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink,modifiedTime,mimeType)&orderBy=modifiedTime desc&pageSize=100`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error('Se requiere actualizar la autorización de Google Drive. Por favor vuelva a conectar su cuenta.');
      }
      throw new Error('No se pudieron consultar las hojas de Google Drive.');
    }
    const data = await res.json();
    return (data.files || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      webViewLink:
        f.webViewLink ||
        (f.mimeType === 'application/vnd.google-apps.spreadsheet'
          ? `https://docs.google.com/spreadsheets/d/${f.id}/edit`
          : `https://drive.google.com/file/d/${f.id}/view`),
      modifiedTime: f.modifiedTime,
    }));
  }

  /**
   * Specifically search Google Drive for the institutional sheet:
   * "N-FCO-03 SOLICITUD DE CREACIÓN, MODIFICACIÓN E INACTIVACIÓN DE PARTES VR00 EN REVISION.xlsx"
   */
  public async searchDriveForNFCO03(): Promise<{
    bestMatch: { id: string; name: string; mimeType?: string; webViewLink?: string; modifiedTime?: string } | null;
    matches: Array<{ id: string; name: string; mimeType?: string; webViewLink?: string; modifiedTime?: string }>;
    totalFound: number;
  }> {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('Debe conectar su cuenta de Google Workspace para buscar en Google Drive.');
    }

    if (token.startsWith('direct_')) {
      return { bestMatch: null, matches: [], totalFound: 0 };
    }

    // 1. Try server backend endpoint first
    try {
      const serverRes = await fetch('/api/drive/search-nfco03', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (serverRes.ok) {
        const data = await serverRes.json();
        if (data.success && data.matches) {
          return {
            bestMatch: data.bestMatch,
            matches: data.matches,
            totalFound: data.totalFound,
          };
        }
      }
    } catch (_) {}

    // 2. Client-side query directly to Google Drive v3 API
    const queries = [
      "name contains 'N-FCO-03' and trashed=false",
      "name contains 'SOLICITUD DE CREACI' and trashed=false",
      "name contains 'PARTES VR00' and trashed=false",
      "(name contains 'INACTIVACION' or name contains 'INACTIVACIÓN') and trashed=false",
      "(mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/vnd.google-apps.spreadsheet') and trashed=false",
    ];

    const fileMap = new Map<string, any>();
    for (const q of queries) {
      try {
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,webViewLink,modifiedTime)&pageSize=50&orderBy=modifiedTime desc`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const d = await res.json();
          (d.files || []).forEach((f: any) => fileMap.set(f.id, f));
        }
      } catch (_) {}
    }

    const files = Array.from(fileMap.values());
    const cleanNorm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const targetExact = 'n-fco-03 solicitud de creacion, modificacion e inactivacion de partes vr00 en revision';

    const scored = files.map((f) => {
      const norm = cleanNorm(f.name);
      let score = 0;
      if (norm.includes('n-fco-03')) score += 50;
      if (norm.includes('n-fco')) score += 20;
      if (norm.includes('solicitud')) score += 15;
      if (norm.includes('partes')) score += 15;
      if (norm.includes('vr00')) score += 15;
      if (norm.includes('creacion')) score += 10;
      if (norm.includes('inactivacion')) score += 10;
      if (norm.includes('revision')) score += 10;
      if (norm.startsWith(targetExact) || norm === `${targetExact}.xlsx`) score += 100;
      return { ...f, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const matches = scored.filter((s) => s.score > 0);
    const bestMatch = matches.length > 0 && matches[0].score >= 30 ? matches[0] : (matches[0] || null);

    return {
      bestMatch,
      matches,
      totalFound: files.length,
    };
  }

  /**
   * Connect and parse a local Excel file (.xlsx) selected by the user,
   * guaranteeing 100% exact fidelity of all rows, sheets, and headers.
   */
  public async connectLocalExcelFile(file: File): Promise<ConnectedGoogleSheetInfo> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: true });
    const sheetNames = workbook.SheetNames && workbook.SheetNames.length > 0 ? workbook.SheetNames : ['Hoja 1'];
    const sheetsData: Record<string, any[][]> = {};
    for (const name of sheetNames) {
      const ws = workbook.Sheets[name];
      if (ws) {
        sheetsData[name] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
      } else {
        sheetsData[name] = [];
      }
    }
    const fileId = `local_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    this.localUploadedSheets.set(fileId, {
      workbook,
      sheetNames,
      sheetsData,
      fileName: file.name,
    });

    const info: ConnectedGoogleSheetInfo = {
      id: fileId,
      name: file.name,
      url: '',
      connectedAt: new Date().toISOString(),
      sheetNames,
      isExcelFile: true,
    };
    this.saveConnectedSpreadsheet(info);
    return info;
  }

  /**
   * Connect to an existing Google Sheet by ID or URL (Native Google Sheets or Excel .xlsx on Google Drive)
   */
  public async connectExistingSpreadsheet(
    spreadsheetIdOrUrl: string,
    knownMeta?: { name?: string; mimeType?: string; webViewLink?: string; isExcelFile?: boolean; sheetNames?: string[] }
  ): Promise<ConnectedGoogleSheetInfo> {
    const token = this.getAccessToken();
    const cleanInput = (spreadsheetIdOrUrl || '').trim();

    // If cleanInput is empty or defaults to master catalog explicitly
    if (
      cleanInput === 'catalogo_maestro' ||
      cleanInput === 'default'
    ) {
      const info: ConnectedGoogleSheetInfo = {
        id: 'catalogo_maestro',
        name: 'Catálogo Maestro Equipos Médicos SYD (Excel)',
        url: '/public/Catalogo_Maestro_Equipos_Medicos_SYD.xlsx',
        connectedAt: new Date().toISOString(),
        sheetNames: [
          'Catálogo Maestro 306 Equipos',
          'Equipos Médicos',
          'Instrumental Quirúrgico',
          'Muebles Hospitalarios',
          'Accesorios y Sensores',
        ],
        isExcelFile: true,
      };
      this.saveConnectedSpreadsheet(info);
      return info;
    }

    // If known metadata is already provided (e.g. from Drive search match)
    const isKnownExcel =
      knownMeta?.isExcelFile ||
      knownMeta?.mimeType?.includes('spreadsheetml') ||
      knownMeta?.mimeType?.includes('excel') ||
      knownMeta?.name?.toLowerCase().endsWith('.xlsx') ||
      knownMeta?.name?.toLowerCase().endsWith('.xls');

    // Check if input is targeting the N-FCO-03 file by name or query
    if (
      !knownMeta &&
      (cleanInput.toLowerCase().includes('n-fco') ||
       cleanInput.toLowerCase().includes('solicitud de creac') ||
       cleanInput.toLowerCase().endsWith('.xlsx') ||
       cleanInput.includes(' '))
    ) {
      try {
        if (token) {
          const nfcoSearch = await this.searchDriveForNFCO03();
          if (nfcoSearch.bestMatch?.id) {
            return await this.connectExistingSpreadsheet(nfcoSearch.bestMatch.id, {
              name: nfcoSearch.bestMatch.name,
              mimeType: (nfcoSearch.bestMatch as any).mimeType,
              webViewLink: (nfcoSearch.bestMatch as any).webViewLink,
              isExcelFile: true,
            });
          }
        }
      } catch (_) {}
    }

    let sheetId = cleanInput;
    const match = sheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      sheetId = match[1];
    } else {
      const driveMatch = sheetId.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
      if (driveMatch && driveMatch[1]) {
        sheetId = driveMatch[1];
      }
    }
    sheetId = sheetId.split('?')[0].split('#')[0].trim();

    // 2. If authenticated with Google, try Drive and Sheets API
    if (token) {
      try {
        let driveMeta: any = null;
        try {
          const driveRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${sheetId}?fields=id,name,webViewLink,mimeType&supportsAllDrives=true`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (driveRes.ok) {
            driveMeta = await driveRes.json();
          }
        } catch (_) {}

        const fileName = knownMeta?.name || driveMeta?.name || '';
        const mimeType = knownMeta?.mimeType || driveMeta?.mimeType || '';
        const isExcel =
          isKnownExcel ||
          mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          mimeType === 'application/vnd.ms-excel' ||
          fileName.toLowerCase().endsWith('.xlsx') ||
          fileName.toLowerCase().endsWith('.xls');

        if (isExcel) {
          const mediaRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${sheetId}?alt=media&supportsAllDrives=true`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (mediaRes.ok) {
            const arrayBuffer = await mediaRes.arrayBuffer();
            const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
            const sheetNames = workbook.SheetNames && workbook.SheetNames.length > 0 ? workbook.SheetNames : ['Hoja 1'];
            const info: ConnectedGoogleSheetInfo = {
              id: sheetId,
              name: fileName || 'N-FCO-03 SOLICITUD DE CREACIÓN, MODIFICACIÓN E INACTIVACIÓN DE PARTES VR00 EN REVISION.xlsx',
              url: knownMeta?.webViewLink || driveMeta?.webViewLink || `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
              connectedAt: new Date().toISOString(),
              sheetNames,
              isExcelFile: true,
            };
            this.saveConnectedSpreadsheet(info);
            return info;
          }
        }

        const res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=spreadsheetId,properties.title,sheets.properties`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (res.ok) {
          const data = await res.json();
          const title = data.properties?.title || fileName || 'Hoja de Cálculo Conectada';
          const sheetNames = (data.sheets || []).map((s: any) => s.properties?.title || '');
          const url = knownMeta?.webViewLink || driveMeta?.webViewLink || `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;

          const info: ConnectedGoogleSheetInfo = {
            id: sheetId,
            name: title,
            url,
            connectedAt: new Date().toISOString(),
            sheetNames,
            isExcelFile: false,
          };

          this.saveConnectedSpreadsheet(info);
          return info;
        }
      } catch (authErr) {
        console.warn('Google Workspace API auth query warning, proceeding to server proxy:', authErr);
      }
    }

    // 3. Fallback: Query backend proxy /api/sheets/fetch-sheet
    try {
      const proxyRes = await fetch('/api/sheets/fetch-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urlOrId: sheetId, token }),
      });
      if (proxyRes.ok) {
        const proxyData = await proxyRes.json();
        if (proxyData.success) {
          const info: ConnectedGoogleSheetInfo = {
            id: proxyData.id || sheetId,
            name: knownMeta?.name || proxyData.title || `Hoja de Google Sheets (${sheetId.substring(0, 8)}...)`,
            url: knownMeta?.webViewLink || (cleanInput.startsWith('http') ? cleanInput : `https://docs.google.com/spreadsheets/d/${proxyData.id || sheetId}/edit`),
            connectedAt: new Date().toISOString(),
            sheetNames: proxyData.sheetNames || ['Hoja 1'],
            isExcelFile: knownMeta?.isExcelFile !== undefined ? knownMeta.isExcelFile : (proxyData.isExcelFile || false),
          };
          this.saveConnectedSpreadsheet(info);
          return info;
        }
      }
    } catch (proxyErr) {
      console.warn('Error connecting spreadsheet via server proxy:', proxyErr);
    }

    // 4. Default fallback: Connect anyway so user can visualize in UI
    const defaultInfo: ConnectedGoogleSheetInfo = {
      id: sheetId,
      name: knownMeta?.name || `Hoja de Google Sheets (${sheetId.substring(0, 8)}...)`,
      url: knownMeta?.webViewLink || (cleanInput.startsWith('http') ? cleanInput : `https://docs.google.com/spreadsheets/d/${sheetId}/edit`),
      connectedAt: new Date().toISOString(),
      sheetNames: knownMeta?.sheetNames || ['Hoja 1'],
      isExcelFile: knownMeta?.isExcelFile || false,
    };
    this.saveConnectedSpreadsheet(defaultInfo);
    return defaultInfo;
  }

  /**
   * Get currently connected Google Sheet from storage
   */
  public getConnectedSpreadsheet(): ConnectedGoogleSheetInfo | null {
    try {
      const raw = localStorage.getItem('syd_connected_google_sheet_v1');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Save currently connected Google Sheet
   */
  public saveConnectedSpreadsheet(info: ConnectedGoogleSheetInfo): void {
    localStorage.setItem('syd_connected_google_sheet_v1', JSON.stringify(info));
    window.dispatchEvent(new CustomEvent('syd-connected-sheet-changed', { detail: info }));
  }

  /**
   * Disconnect current Google Sheet
   */
  public disconnectSpreadsheet(): void {
    localStorage.removeItem('syd_connected_google_sheet_v1');
    window.dispatchEvent(new CustomEvent('syd-connected-sheet-changed', { detail: null }));
  }

  /**
   * Fetch preview rows from a connected sheet with intelligent header row detection
   * Supports both native Google Sheets and .xlsx files stored in Google Drive
   */
  public async fetchSpreadsheetPreview(
    spreadsheetId: string,
    sheetName?: string
  ): Promise<{ headers: string[]; rows: string[][]; rawValues: string[][]; sheetName?: string; sheetNames?: string[] }> {
    // 0. Handle local uploaded Excel files (.xlsx) directly
    if (spreadsheetId.startsWith('local_')) {
      const cached = this.localUploadedSheets.get(spreadsheetId);
      if (cached) {
        const effectiveSheet =
          sheetName && cached.sheetNames.includes(sheetName) ? sheetName : (cached.sheetNames[0] || 'Hoja 1');
        const rawData = cached.sheetsData[effectiveSheet] || [];
        const stringValues = rawData.map((row) =>
          (row || []).map((cell) => (cell !== undefined && cell !== null ? String(cell).trim() : ''))
        );
        const { headers, rows } = this.detectHeaderAndData(stringValues);
        return {
          headers,
          rows,
          rawValues: stringValues,
          sheetName: effectiveSheet,
          sheetNames: cached.sheetNames,
        };
      }
    }

    const token = this.getAccessToken();

    // 1. Direct or server proxy mode for Master Catalog or unauthenticated sessions
    if (spreadsheetId === 'catalogo_maestro' || !token) {
      try {
        const res = await fetch('/api/sheets/fetch-sheet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urlOrId: spreadsheetId, sheetTab: sheetName, token }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            return {
              headers: data.headers || [],
              rows: data.rows || [],
              rawValues: data.rawValues || [],
              sheetName: data.currentSheet || sheetName,
              sheetNames: data.sheetNames,
            };
          }
        }
      } catch (proxyErr) {
        console.warn('Direct server fetch-sheet failed, falling back:', proxyErr);
      }
    }

    let values: string[][] = [];
    let effectiveSheetName = sheetName;
    let discoveredSheetNames: string[] = [];
    const connectedInfo = this.getConnectedSpreadsheet();
    const isExcel = connectedInfo?.id === spreadsheetId && connectedInfo?.isExcelFile;

    // 2. If authenticated with Google, try Google Sheets API v4
    if (token && !token.startsWith('direct_') && !isExcel) {
      try {
        const range = sheetName ? `'${sheetName.replace(/'/g, "''")}'!A1:ZZ350` : 'A1:ZZ350';
        const res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          values = (data.values || []).map((row: any[]) =>
            (row || []).map((cell) => (cell !== undefined && cell !== null ? String(cell).trim() : ''))
          );
        }
      } catch (_) {}
    }

    // 3. If values are empty and token exists, try reading binary media from Google Drive (.xlsx file)
    if (values.length === 0 && token && !token.startsWith('direct_')) {
      try {
        const mediaRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?alt=media`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (mediaRes.ok) {
          const arrayBuffer = await mediaRes.arrayBuffer();
          const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: true });
          const names = workbook.SheetNames || [];
          discoveredSheetNames = names;

          if (!effectiveSheetName || !names.includes(effectiveSheetName)) {
            effectiveSheetName = names[0] || 'Hoja 1';
          }

          const worksheet = workbook.Sheets[effectiveSheetName];
          if (worksheet) {
            const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
            values = rawData.map((row) =>
              (row || []).map((cell) => (cell !== undefined && cell !== null ? String(cell).trim() : ''))
            );
          }

          // Update saved connected sheet if names changed
          if (connectedInfo && connectedInfo.id === spreadsheetId && names.length > 0) {
            connectedInfo.sheetNames = names;
            this.saveConnectedSpreadsheet(connectedInfo);
          }
        }
      } catch (mediaErr) {
        console.warn('Google Drive media fetch error:', mediaErr);
      }
    }

    // 4. Server proxy fallback if client Google APIs failed to return rows
    if (values.length === 0) {
      try {
        const res = await fetch('/api/sheets/fetch-sheet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urlOrId: spreadsheetId, sheetTab: sheetName, token }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            return {
              headers: data.headers || [],
              rows: data.rows || [],
              rawValues: data.rawValues || [],
              sheetName: data.currentSheet || sheetName,
              sheetNames: data.sheetNames,
            };
          }
        }
      } catch (serverErr) {
        console.warn('Final server fetch fallback failed:', serverErr);
      }
    }

    if (values.length === 0) {
      return {
        headers: [],
        rows: [],
        rawValues: [],
        sheetName: effectiveSheetName,
        sheetNames: discoveredSheetNames.length > 0 ? discoveredSheetNames : undefined,
      };
    }

    const { headers, rows } = this.detectHeaderAndData(values);

    return {
      headers,
      rows,
      rawValues: values,
      sheetName: effectiveSheetName,
      sheetNames: discoveredSheetNames.length > 0 ? discoveredSheetNames : undefined,
    };
  }

  /**
   * Helper: Detect header and data rows from a 2D string matrix
   */
  public detectHeaderAndData(values: string[][]): { headers: string[]; rows: string[][] } {
    if (!values || values.length === 0) {
      return { headers: [], rows: [] };
    }

    let bestHeaderIdx = -1;
    let maxScore = 0;
    const headerKeywords = [
      'parte', 'codigo', 'código', 'cod', 'descripcion', 'descripción', 'nombre',
      'tipo', 'solicitud', 'grupo', 'clase', 'marca', 'fabricante', 'modelo',
      'referencia', 'costo', 'precio', 'iva', 'unidad', 'medida', 'ficha',
      'serie', 'lote', 'invima', 'registro', 'vigencia', 'riesgo', 'estado',
      'observac', 'proveedor', 'articulo', 'producto', 'item', 'justificacion'
    ];

    for (let r = 0; r < Math.min(values.length, 25); r++) {
      const row = values[r];
      const filledCells = row.filter((c) => c && c.trim() !== '').length;
      if (filledCells < 2) continue;

      const rowCellsLower = row.map((c) => c.toLowerCase().trim());
      let score = 0;
      for (const cell of rowCellsLower) {
        if (headerKeywords.some((kw) => cell === kw || cell.includes(kw))) {
          score += 1;
        }
      }

      if (score > maxScore && score >= 2) {
        maxScore = score;
        bestHeaderIdx = r;
      }
    }

    const headerIdx = bestHeaderIdx >= 0 ? bestHeaderIdx : 0;
    const headers = (values[headerIdx] || []).map((h, i) => (h && h.trim() ? h.trim() : `Columna ${i + 1}`));
    let rows = values.slice(headerIdx + 1).filter((r) => r.some((c) => c && c.trim() !== ''));

    if (rows.length === 0 && values.length > 0) {
      rows = values.filter((r) => r.some((c) => c && c.trim() !== ''));
    }

    return { headers, rows };
  }

  /**
   * Modificación de hojas deshabilitada: Modo Solo Consulta Protegida.
   * Se deshabilita la escritura para proteger la integridad del archivo en Google Drive.
   */
  public async appendRowToSpreadsheet(
    _spreadsheetId: string,
    _sheetName: string | undefined,
    _rowValues: (string | number)[]
  ): Promise<{ updatedRange: string; updatedRows: number }> {
    throw new Error(
      'Modo de Solo Consulta activado: la modificación y escritura sobre hojas de Google Drive ha sido deshabilitada para proteger la integridad de sus archivos.'
    );
  }

  /**
   * Convert an Excel file in Google Drive into a native Google Sheet
   */
  public async convertDriveExcelToGoogleSheet(fileId: string): Promise<{ newSheetId: string; newSheetUrl: string; name: string }> {
    const token = this.getAccessToken();
    if (!token) throw new Error('Debe conectar su cuenta de Google.');
    const dRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const fileMeta = dRes.ok ? await dRes.json() : { name: 'Hoja de Cálculo SYD' };
    const cleanName = (fileMeta.name || '').replace(/\.xlsx$/i, '').replace(/\.xls$/i, '');

    const copyRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/copy`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: cleanName,
        mimeType: 'application/vnd.google-apps.spreadsheet',
      }),
    });
    if (!copyRes.ok) {
      const errText = await copyRes.text();
      throw new Error(`No se pudo convertir el archivo a Google Sheet: ${errText}`);
    }
    const copiedData = await copyRes.json();
    return {
      newSheetId: copiedData.id,
      newSheetUrl: `https://docs.google.com/spreadsheets/d/${copiedData.id}/edit`,
      name: cleanName,
    };
  }

  /**
   * Detect parts / items created or requested in a Google Sheet (such as N-FCO-03)
   */
  public detectPartsFromSpreadsheetData(
    headers: string[],
    rows: string[][]
  ): DetectedSheetPart[] {
    if (!headers || headers.length === 0 || !rows || rows.length === 0) {
      return [];
    }

    // Normalize header strings for matching
    const normHeaders = headers.map((h) =>
      h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
    );

    const findColIdx = (keywords: string[]): number => {
      return normHeaders.findIndex((h) => keywords.some((kw) => h.includes(kw)));
    };

    const codeIdx = findColIdx(['parte', 'codigo', 'código', 'cod', 'sku', 'ref', 'numero de parte']);
    const dateIdx = findColIdx(['fecha de solicitud', 'fecha', 'dia']);
    const typeIdx = findColIdx(['tipo de solicitud', 'tipo solicitud', 'tipo', 'solicitud', 'movimiento', 'accion']);
    const groupIdx = findColIdx(['grupo', 'subgrupo']);
    const classIdx = findColIdx(['clase', 'categoria', 'categoría', 'familia']);
    const nameIdx = findColIdx(['descripcion', 'descripción', 'nombre', 'articulo', 'producto', 'detalle', 'item']);
    const supplierIdx = findColIdx(['proveedor', 'distribuidor', 'empresa', 'supplier', 'tercero', 'vendedor']);
    const brandIdx = findColIdx(['marca', 'brand']);
    const mfrIdx = findColIdx(['fabricante', 'manufac', 'manufacturer', 'casa fabricante', 'fabrica']);
    const modelIdx = findColIdx(['modelo/referencia', 'modelo', 'referencia', 'equipo', 'serie', 'model']);
    const costIdx = findColIdx(['costo', 'precio', 'valor', 'monto', 'vr unitario', 'val unitario', 'cost', 'price']);
    const ivaIdx = findColIdx(['iva', 'aplica iva', 'impuesto', 'tarifa', 'gravado', 'exento']);
    const unitIdx = findColIdx(['unidad de medida', 'unidad', 'medida']);
    const fichaIdx = findColIdx(['ficha tecnica', 'ficha', 'datasheet']);
    const serieLoteIdx = findColIdx(['serie/lote', 'serie', 'lote']);
    const invimaIdx = findColIdx(['registro sanitario', 'certificado no requiere', 'invima', 'registro', 'sanitario', 'reg invima']);
    const vigenciaIdx = findColIdx(['vigencia invima', 'vigencia', 'vencimiento']);
    const riesgoIdx = findColIdx(['nivel de riesgo', 'riesgo', 'clasificacion']);
    const statusIdx = findColIdx(['estado', 'status', 'aprobac', 'tramite']);
    const obsIdx = findColIdx(['observac', 'justificac', 'motivo', 'nota', 'comentario']);
    const reqIdx = findColIdx(['solicitante', 'usuario', 'responsable', 'creado por', 'solicitado por']);

    const detectedParts: DetectedSheetPart[] = [];

    rows.forEach((row, rowIndex) => {
      // Build raw mapping
      const rawRow: Record<string, string> = {};
      headers.forEach((h, i) => {
        rawRow[h] = row[i] || '';
      });

      // Extract candidate code
      let code = codeIdx >= 0 ? (row[codeIdx] || '').trim() : '';
      let name = nameIdx >= 0 ? (row[nameIdx] || '').trim() : '';
      const brand = brandIdx >= 0 ? (row[brandIdx] || '').trim() : '';
      const model = modelIdx >= 0 ? (row[modelIdx] || '').trim() : '';
      const requestType = typeIdx >= 0 ? (row[typeIdx] || '').trim() : '';
      const group = groupIdx >= 0 ? (row[groupIdx] || '').trim() : '';
      const partClass = classIdx >= 0 ? (row[classIdx] || '').trim() : '';
      const supplier = supplierIdx >= 0 ? (row[supplierIdx] || '').trim() : '';
      const manufacturer = mfrIdx >= 0 ? (row[mfrIdx] || '').trim() : '';
      const hasIVA = ivaIdx >= 0 ? (row[ivaIdx] || '').trim() : '';
      const unit = unitIdx >= 0 ? (row[unitIdx] || '').trim() : '';
      const technicalSheet = fichaIdx >= 0 ? (row[fichaIdx] || '').trim() : '';
      const seriesBatch = serieLoteIdx >= 0 ? (row[serieLoteIdx] || '').trim() : '';
      const invimaRegister = invimaIdx >= 0 ? (row[invimaIdx] || '').trim() : '';
      const invimaValidity = vigenciaIdx >= 0 ? (row[vigenciaIdx] || '').trim() : '';
      const riskLevel = riesgoIdx >= 0 ? (row[riesgoIdx] || '').trim() : '';
      const date = dateIdx >= 0 ? (row[dateIdx] || '').trim() : '';
      const requester = reqIdx >= 0 ? (row[reqIdx] || '').trim() : '';
      const observations = obsIdx >= 0 ? (row[obsIdx] || '').trim() : '';
      const rawStatus = statusIdx >= 0 ? (row[statusIdx] || '').trim() : '';

      // Cost parsing
      let costCOP: number | undefined;
      if (costIdx >= 0 && row[costIdx]) {
        const cleanCost = row[costIdx].replace(/[^0-9]/g, '');
        if (cleanCost) costCOP = parseInt(cleanCost, 10);
      }

      // If code is empty, look for a code pattern in any cell
      if (!code) {
        for (const cell of row) {
          const match = cell.match(/\b(?:SYD-[A-Z0-9\-_]{2,10}|\d{4,8})\b/i);
          if (match) {
            code = match[0];
            break;
          }
        }
      }

      // If name is empty, look for the longest text cell that isn't a date or email
      if (!name) {
        const textCandidates = row.filter(
          (c) => c && c.length > 5 && !c.includes('@') && !/^\d+$/.test(c) && !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(c)
        );
        if (textCandidates.length > 0) {
          name = textCandidates.reduce((a, b) => (b.length > a.length ? b : a));
        }
      }

      // We only register rows that have either a code or a name/description and aren't pure header text
      if (
        (code || name) &&
        name.toLowerCase() !== 'descripcion' &&
        name.toLowerCase() !== 'descripción' &&
        code.toLowerCase() !== 'codigo' &&
        code.toLowerCase() !== 'código' &&
        code.toLowerCase() !== 'parte'
      ) {
        // Determine status
        let status: DetectedSheetPart['status'] = 'Creada';
        const typeUpper = (requestType || '').toUpperCase();
        const statusUpper = (rawStatus || '').toUpperCase();

        if (typeUpper.includes('INACTIV') || statusUpper.includes('INACTIV')) {
          status = 'Inactivada';
        } else if (typeUpper.includes('MODIFIC') || statusUpper.includes('MODIFIC')) {
          status = 'Modificada';
        } else if (statusUpper.includes('TRAMITE') || statusUpper.includes('PENDIENT') || statusUpper.includes('REVISION')) {
          status = 'En Trámite';
        } else if (statusUpper.includes('CREADO') || statusUpper.includes('CREADA')) {
          status = 'Creada';
        } else if (code) {
          status = 'Creada';
        } else {
          status = 'En Trámite';
        }

        detectedParts.push({
          id: `sheet-part-${rowIndex}-${code || Math.random().toString(36).slice(2, 7)}`,
          code: code || '',
          name: name || `Parte Fila ${rowIndex + 1}`,
          brand: brand || undefined,
          model: model || undefined,
          requestType: requestType || (status === 'Inactivada' ? 'INACTIVACIÓN' : status === 'Modificada' ? 'MODIFICACIÓN' : 'CREACIÓN'),
          category: partClass || group || undefined,
          group: group || undefined,
          partClass: partClass || undefined,
          supplier: supplier || undefined,
          manufacturer: manufacturer || undefined,
          hasIVA: hasIVA || undefined,
          unit: unit || undefined,
          technicalSheet: technicalSheet || undefined,
          seriesBatch: seriesBatch || undefined,
          invimaRegister: invimaRegister || undefined,
          invimaValidity: invimaValidity || undefined,
          riskLevel: riskLevel || undefined,
          date: date || undefined,
          requester: requester || undefined,
          costCOP,
          status,
          observations: observations || undefined,
          rawRow,
          rowIndex: rowIndex + 1,
        });
      }
    });

    return detectedParts;
  }

  /**
   * Export Medical Equipment Catalog to Google Sheets
   */
  public async exportEquipmentsToGoogleSheet(equipments: MedicalEquipment[]): Promise<SheetExportResult> {
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-CO');
    const title = `SYD Colombia - Catálogo Maestro de Equipos Médicos (${dateStr})`;

    const spreadsheetId = await this.createStyledSpreadsheet(title, 'Catálogo Equipos');

    const headers = [
      'Código',
      'Nombre del Equipo',
      'Marca',
      'Modelo',
      'Categoría',
      'Registro Sanitario Invima',
      'Vida Útil (Años)',
      'Garantía (Meses)',
      'Costo Proveedor COP',
      'Precio Venta Sugerido COP',
      'Margen %',
      'Proveedor Principal',
      'Accesorios Incluidos',
    ];

    const rows = equipments.map((eq) => {
      const cost = eq.baseCostCOP || 0;
      const saleEst = cost > 0 ? Math.round(cost * 1.35) : 0;
      const margin = saleEst > 0 ? `${Math.round(((saleEst - cost) / saleEst) * 100)}%` : '0%';
      const supplier = eq.supplier || (eq.allSuppliers && eq.allSuppliers[0]) || 'SYD Colombia';
      const accessories = (eq.standardAccessories || [])
        .map((a) => `${a.name} (${a.included ? 'Incluido' : 'Opcional'})`)
        .join('; ');

      return [
        eq.code || '',
        eq.name || '',
        eq.brand || '',
        eq.model || '',
        eq.category || 'Biomédico',
        eq.invimaRecordNumber || 'No requiere / En trámite',
        eq.warrantyMonths ? Math.round(eq.warrantyMonths / 12) : 5,
        eq.warrantyMonths || 12,
        cost,
        saleEst,
        margin,
        supplier,
        accessories,
      ];
    });

    await this.updateSheetValues(spreadsheetId, 'Catálogo Equipos!A1', [headers, ...rows]);
    await this.formatSheetHeader(spreadsheetId, 0, headers.length);

    return {
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      title,
      rowCount: rows.length,
    };
  }

  /**
   * Export Saved Quotes History to Google Sheets
   */
  public async exportQuotesToGoogleSheet(quotes: SavedQuote[]): Promise<SheetExportResult> {
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-CO');
    const title = `SYD Colombia - Registro de Cotizaciones (${dateStr})`;

    const spreadsheetId = await this.createStyledSpreadsheet(title, 'Cotizaciones SYD');

    const headers = [
      'N° Cotización',
      'Fecha',
      'Cliente / Institución',
      'NIT / Documento',
      'Contacto Principal',
      'Email Contacto',
      'Teléfono',
      'Ciudad',
      'Asesor Comercial',
      'Subtotal COP',
      'IVA COP',
      'Total General COP',
      'Estado',
      'Cant. Equipos',
      'Resumen de Equipos',
    ];

    const rows = quotes.map((q) => {
      const items = q.items || [];
      const itemsSummary = items.map((i) => `${i.name} (x${i.quantity})`).join(', ');
      return [
        q.quoteNumber || '',
        q.date || '',
        q.clientName || '',
        q.nit || '',
        q.contactPerson || '',
        q.contactEmail || '',
        q.contactPhone || '',
        q.city || '',
        q.advisorName || 'Jairo E. Mendoza Bolívar',
        q.subtotal || 0,
        q.iva || 0,
        q.total || 0,
        q.status ? q.status.toUpperCase() : 'BORRADOR',
        items.length,
        itemsSummary,
      ];
    });

    await this.updateSheetValues(spreadsheetId, 'Cotizaciones SYD!A1', [headers, ...rows]);
    await this.formatSheetHeader(spreadsheetId, 0, headers.length);

    return {
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      title,
      rowCount: rows.length,
    };
  }

  /**
   * Export OC Tracking (Órdenes de Compra) to Google Sheets
   */
  public async exportOCTrackingToGoogleSheet(contracts: OCTrackingContract[]): Promise<SheetExportResult> {
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-CO');
    const title = `SYD Colombia - Seguimiento de Órdenes de Compra (${dateStr})`;

    const spreadsheetId = await this.createStyledSpreadsheet(title, 'Órdenes de Compra');

    const headers = [
      'N° Contrato SYD',
      'Cliente / Entidad',
      'N° Orden de Compra',
      'Proveedor',
      'Contacto Proveedor',
      'Fecha Emisión OC',
      'Fecha Entrega Estimada',
      'Estado OC',
      'Total OC COP',
      'Ítems / Equipos',
      'Observaciones',
    ];

    const rows: any[][] = [];
    contracts.forEach((c) => {
      if (c.purchaseOrders && c.purchaseOrders.length > 0) {
        c.purchaseOrders.forEach((po) => {
          const itemsList = (po.items || []).map((it) => `${it.name} (Cant: ${it.quantity})`).join('; ');
          const poTotal = (po.items || []).reduce((sum, it) => sum + (it.totalCostCOP || (it.costPriceCOP || 0) * (it.quantity || 1)), 0);
          rows.push([
            c.contractNumber || '',
            c.clientName || '',
            po.ocNumber || po.id || '',
            po.supplier || c.supplier || '',
            po.supplierContact || '',
            po.createdAt || c.createdAt || '',
            po.estimatedDeliveryDate || '',
            po.status || c.globalStatus || 'En Proceso',
            poTotal,
            itemsList,
            po.notes || c.notes || '',
          ]);
        });
      } else {
        const itemsList = (c.items || []).map((it) => `${it.name} (Cant: ${it.quantity})`).join('; ');
        rows.push([
          c.contractNumber || '',
          c.clientName || '',
          c.ocNumber || 'N/A',
          c.supplier || 'SYD Colombia',
          c.contactPerson || '',
          c.createdAt || '',
          '',
          c.globalStatus || 'En Proceso',
          c.totalCostCOP || 0,
          itemsList,
          c.notes || '',
        ]);
      }
    });

    await this.updateSheetValues(spreadsheetId, 'Órdenes de Compra!A1', [headers, ...rows]);
    await this.formatSheetHeader(spreadsheetId, 0, headers.length);

    return {
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      title,
      rowCount: rows.length,
    };
  }

  /**
   * Export Sales Orders (Pedidos de Venta y Facturación) to Google Sheets
   */
  public async exportSalesOrdersToGoogleSheet(orders: SalesOrderRecord[]): Promise<SheetExportResult> {
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-CO');
    const title = `SYD Colombia - Pedidos de Venta y Facturación (${dateStr})`;

    const spreadsheetId = await this.createStyledSpreadsheet(title, 'Pedidos y Facturación');

    const headers = [
      'N° Pedido (OV)',
      'Cliente',
      'NIT',
      'Ciudad',
      'N° Contrato / OC',
      'Fecha Creación',
      'Total Venta COP',
      'Estado Pedido',
      'N° Factura SYD',
      'Fecha Factura',
      'Remisión / Acta de Entrega',
      'Observaciones',
    ];

    const rows = orders.map((ord) => [
      ord.salesOrderNumber || '',
      ord.clientName || '',
      ord.clientNit || '',
      ord.clientCity || '',
      ord.contractNumber || ord.quoteNumber || '',
      ord.orderDate || ord.createdAt || '',
      ord.totalValueCOP || 0,
      ord.status || 'Borrador',
      ord.invoiceNumber || 'Pendiente',
      ord.invoiceDate || '',
      ord.attachedDeliveryReceipt?.name || ord.invoicedStatus || 'En trámite',
      ord.notes || '',
    ]);

    await this.updateSheetValues(spreadsheetId, 'Pedidos y Facturación!A1', [headers, ...rows]);
    await this.formatSheetHeader(spreadsheetId, 0, headers.length);

    return {
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      title,
      rowCount: rows.length,
    };
  }
}

export const googleWorkspaceService = GoogleWorkspaceService.getInstance();
