import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import * as XLSX from 'xlsx';
import { sendHourlyBackupEmail, type BackupDataPayload } from './src/services/backupEmailService.ts';

async function startServer() {
  const app = express();
  // In AI Studio / Cloud Run container environment, Nginx binds to external port 8080 and proxies traffic to localhost:3000.
  // DEFAULT_APP_PORT is 3000. If PORT is 8080, we must listen on 3000 to avoid EADDRINUSE conflict with Nginx.
  const PORT = parseInt(
    process.env.DEFAULT_APP_PORT ||
    (process.env.PORT && process.env.PORT !== '8080' ? process.env.PORT : '3000'),
    10
  );
  const SERVER_BOOT_TIME = Date.now();
  const APP_VERSION = '2.10.2';

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  const xlsxLib: any = (XLSX as any).default || XLSX;

  // Helper for intelligent header row detection
  const detectHeaderRow = (rawValues: any[][]): { headerIdx: number; headers: string[]; rows: string[][] } => {
    if (!rawValues || rawValues.length === 0) {
      return { headerIdx: 0, headers: [], rows: [] };
    }
    const headerKeywords = [
      'parte', 'codigo', 'código', 'cod', 'descripcion', 'descripción', 'nombre',
      'tipo', 'solicitud', 'grupo', 'clase', 'marca', 'fabricante', 'modelo',
      'referencia', 'costo', 'precio', 'iva', 'unidad', 'medida', 'ficha',
      'serie', 'lote', 'invima', 'registro', 'vigencia', 'riesgo', 'estado',
      'observac', 'proveedor', 'item', 'ítem', 'categoría', 'categoria'
    ];
    let bestHeaderIdx = -1;
    let maxScore = 0;
    for (let r = 0; r < Math.min(rawValues.length, 30); r++) {
      const row = rawValues[r] || [];
      const filledCells = row.filter((c: any) => c !== undefined && c !== null && String(c).trim() !== '').length;
      if (filledCells < 2) continue;

      const rowCellsLower = row.map((c: any) => String(c || '').toLowerCase().trim());
      let score = 0;
      for (const cell of rowCellsLower) {
        if (headerKeywords.some((kw) => cell === kw || cell.includes(kw))) {
          score += 1;
        }
      }
      if (score > maxScore && score >= 2 && r < rawValues.length - 1) {
        maxScore = score;
        bestHeaderIdx = r;
      }
    }

    if (bestHeaderIdx === -1) {
      for (let r = 0; r < Math.min(rawValues.length, 12); r++) {
        const row = rawValues[r] || [];
        const filled = row.filter((c: any) => c !== undefined && c !== null && String(c).trim() !== '').length;
        if (filled >= 2 && r < rawValues.length - 1) {
          bestHeaderIdx = r;
          break;
        }
      }
      if (bestHeaderIdx === -1) bestHeaderIdx = 0;
    }

    const rawHeaderRow = rawValues[bestHeaderIdx] || [];
    let maxCols = Math.max(rawHeaderRow.length, 1);
    for (let r = 0; r < rawValues.length; r++) {
      if (rawValues[r] && rawValues[r].length > maxCols) {
        maxCols = rawValues[r].length;
      }
    }

    const headers: string[] = [];
    for (let i = 0; i < maxCols; i++) {
      const val = rawHeaderRow[i];
      headers.push(val !== undefined && val !== null && String(val).trim() ? String(val).trim() : `Columna ${i + 1}`);
    }

    let rows = rawValues.slice(bestHeaderIdx + 1).filter((r: any[]) =>
      r && r.some((c: any) => c !== undefined && c !== null && String(c).trim() !== '')
    ).map((r: any[]) => {
      const cleanRow: string[] = [];
      for (let i = 0; i < maxCols; i++) {
        cleanRow.push(r[i] !== undefined && r[i] !== null ? String(r[i]).trim() : '');
      }
      return cleanRow;
    });

    if (rows.length === 0 && rawValues.length > 0) {
      rows = rawValues.filter((r: any[]) =>
        r && r.some((c: any) => c !== undefined && c !== null && String(c).trim() !== '')
      ).map((r: any[]) => {
        const cleanRow: string[] = [];
        for (let i = 0; i < maxCols; i++) {
          cleanRow.push(r[i] !== undefined && r[i] !== null ? String(r[i]).trim() : '');
        }
        return cleanRow;
      });
    }

    return { headerIdx: bestHeaderIdx, headers, rows };
  };

  // Robust Google Drive binary fetcher that preserves Authorization over cross-domain redirects
  const fetchGoogleDriveBinary = async (fileId: string, token: string, isNativeSheet: boolean = false): Promise<Buffer | null> => {
    try {
      const url = isNativeSheet
        ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet&supportsAllDrives=true`
        : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;

      const manualRes = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: 'manual',
      });

      if (manualRes.status >= 300 && manualRes.status < 400) {
        const redirectUrl = manualRes.headers.get('location');
        if (redirectUrl) {
          try {
            const authRes = await fetch(redirectUrl, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (authRes.ok) {
              const ab = await authRes.arrayBuffer();
              return Buffer.from(ab);
            }
          } catch (_) {}

          try {
            const noAuthRes = await fetch(redirectUrl);
            if (noAuthRes.ok) {
              const ab = await noAuthRes.arrayBuffer();
              return Buffer.from(ab);
            }
          } catch (_) {}
        }
      } else if (manualRes.ok) {
        const ab = await manualRes.arrayBuffer();
        return Buffer.from(ab);
      }

      const followRes = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: 'follow',
      });
      if (followRes.ok) {
        const ab = await followRes.arrayBuffer();
        return Buffer.from(ab);
      }
    } catch (e) {
      console.warn('fetchGoogleDriveBinary error:', e);
    }
    return null;
  };

  // Helper to get master catalog workbook from local disk
  const getMasterCatalogWorkbook = (): { workbook: any; filePath: string } | null => {
    const candidates = [
      path.join(process.cwd(), 'data/Catalogo_Maestro_Equipos_Medicos_SYD.xlsx'),
      path.join(process.cwd(), 'public/Catalogo_Maestro_Equipos_Medicos_SYD.xlsx'),
      path.join(process.cwd(), 'public/database/Catalogo_Maestro_Equipos_Medicos_SYD.xlsx'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        try {
          const workbook = xlsxLib.readFile(candidate, { cellDates: true });
          return { workbook, filePath: candidate };
        } catch (e) {
          console.warn('Error reading workbook candidate:', candidate, e);
        }
      }
    }
    return null;
  };

  // Persistent storage file for user-appended sheet rows
  const APPENDED_ROWS_FILE = path.join(process.cwd(), 'data/appended_sheet_rows.json');
  const getAppendedRows = (key: string): any[][] => {
    try {
      if (fs.existsSync(APPENDED_ROWS_FILE)) {
        const data = JSON.parse(fs.readFileSync(APPENDED_ROWS_FILE, 'utf-8'));
        return data[key] || [];
      }
    } catch (_) {}
    return [];
  };
  const saveAppendedRow = (key: string, row: any[]) => {
    try {
      let data: Record<string, any[][]> = {};
      if (fs.existsSync(APPENDED_ROWS_FILE)) {
        try { data = JSON.parse(fs.readFileSync(APPENDED_ROWS_FILE, 'utf-8')); } catch (_) {}
      }
      if (!data[key]) data[key] = [];
      data[key].push(row);
      fs.mkdirSync(path.dirname(APPENDED_ROWS_FILE), { recursive: true });
      fs.writeFileSync(APPENDED_ROWS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Could not persist appended row to file:', e);
    }
  };

  // API endpoint: Fetch and visualize any Google Sheet, public link, or Master Catalog Excel file
  app.post('/api/sheets/fetch-sheet', async (req, res) => {
    try {
      const { urlOrId, sheetTab, token } = req.body || {};
      const targetStr = (urlOrId || '').trim();

      // Check if user requested the Master Catalog or local file
      const isMasterCatalog = !targetStr ||
        targetStr === 'catalogo_maestro' ||
        targetStr === 'default' ||
        targetStr.toLowerCase().includes('catalogo_maestro') ||
        targetStr.toLowerCase().includes('syd');

      if (isMasterCatalog) {
        const master = getMasterCatalogWorkbook();
        if (master) {
          const { workbook } = master;
          const sheetNames = workbook.SheetNames || [];
          const effectiveSheet = sheetTab && sheetNames.includes(sheetTab) ? sheetTab : (sheetNames[0] || 'Hoja 1');
          const worksheet = workbook.Sheets[effectiveSheet];
          let rawData: any[][] = [];
          if (worksheet) {
            rawData = xlsxLib.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
          }

          // Merge with any custom user-appended rows
          const appendedKey = `catalogo_maestro_${effectiveSheet}`;
          const customAppended = getAppendedRows(appendedKey);
          if (customAppended.length > 0) {
            rawData = [...rawData, ...customAppended];
          }

          const { headers, rows } = detectHeaderRow(rawData);

          return res.json({
            success: true,
            id: 'catalogo_maestro',
            title: 'Catálogo Maestro Equipos Médicos SYD (Excel)',
            sheetNames,
            currentSheet: effectiveSheet,
            headers,
            rows,
            rawValues: rawData,
            totalRows: rows.length,
            isExcelFile: true,
            source: 'local_master_catalog',
          });
        }
      }

      // Extract Google Spreadsheet ID from URL or raw string
      let spreadsheetId = targetStr;
      const sheetUrlMatch = targetStr.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (sheetUrlMatch) {
        spreadsheetId = sheetUrlMatch[1];
      }

      // 1. Try Google Sheets API or Google Drive Media API with Bearer token if token is provided
      if (token && spreadsheetId) {
        // 1a. Check Google Drive metadata first to determine if it's native Sheet or .xlsx file
        try {
          const driveMetaRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?fields=id,name,mimeType,webViewLink&supportsAllDrives=true`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (driveMetaRes.ok) {
            const driveMeta: any = await driveMetaRes.json();
            const fileName = driveMeta.name || '';
            const mimeType = driveMeta.mimeType || '';
            const isNativeSheet = mimeType === 'application/vnd.google-apps.spreadsheet';
            const isExcel =
              !isNativeSheet ||
              mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
              mimeType === 'application/vnd.ms-excel' ||
              fileName.toLowerCase().endsWith('.xlsx') ||
              fileName.toLowerCase().endsWith('.xls');

            // Download binary media directly for Excel or export for native Sheets
            const downloaded = await fetchGoogleDriveBinary(spreadsheetId, token, isNativeSheet);

            if (downloaded) {
              const workbook = xlsxLib.read(downloaded, { type: 'buffer', cellDates: true });
              const sheetNames = workbook.SheetNames || [];
              const effectiveSheet = sheetTab && sheetNames.includes(sheetTab) ? sheetTab : (sheetNames[0] || 'Hoja 1');
              const worksheet = workbook.Sheets[effectiveSheet];
              let rawData: any[][] = [];
              if (worksheet) {
                rawData = xlsxLib.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
              }

              // Merge with any custom appended rows
              const appendedKey = `${spreadsheetId}_${effectiveSheet}`;
              const customAppended = getAppendedRows(appendedKey);
              if (customAppended.length > 0) {
                rawData = [...rawData, ...customAppended];
              }

              const { headers, rows } = detectHeaderRow(rawData);

              return res.json({
                success: true,
                id: spreadsheetId,
                title: fileName || (isNativeSheet ? 'Hoja de Google Sheets' : 'Archivo Excel Conectado'),
                sheetNames,
                currentSheet: effectiveSheet,
                headers,
                rows,
                rawValues: rawData,
                totalRows: rows.length,
                isExcelFile: !isNativeSheet,
                source: isNativeSheet ? 'google_drive_export_xlsx' : 'google_drive_media_xlsx',
                webViewLink: driveMeta.webViewLink || `https://drive.google.com/file/d/${spreadsheetId}/view`,
              });
            }
          }
        } catch (driveErr) {
          console.warn('Drive metadata / media check failed, trying Sheets API:', driveErr);
        }

        // 1b. Try Google Sheets API v4 for native Google Spreadsheets
        try {
          const metaRes = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId,properties.title,sheets.properties`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (metaRes.ok) {
            const metaData: any = await metaRes.json();
            const title = metaData.properties?.title || 'Hoja de Google Sheets';
            const sheetNames = (metaData.sheets || []).map((s: any) => s.properties?.title || '').filter(Boolean);
            const effectiveSheet = sheetTab && sheetNames.includes(sheetTab) ? sheetTab : (sheetNames[0] || '');

            const range = effectiveSheet ? `'${effectiveSheet.replace(/'/g, "''")}'!A1:ZZ500` : 'A1:ZZ500';
            const valRes = await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );

            if (valRes.ok) {
              const valData: any = await valRes.json();
              let rawValues: any[][] = (valData.values || []).map((row: any[]) =>
                (row || []).map((cell: any) => (cell !== undefined && cell !== null ? String(cell).trim() : ''))
              );

              // Merge with local appended rows
              const appendedKey = `${spreadsheetId}_${effectiveSheet}`;
              const customAppended = getAppendedRows(appendedKey);
              if (customAppended.length > 0) {
                rawValues = [...rawValues, ...customAppended];
              }

              const { headers, rows } = detectHeaderRow(rawValues);

              return res.json({
                success: true,
                id: spreadsheetId,
                title,
                sheetNames,
                currentSheet: effectiveSheet,
                headers,
                rows,
                rawValues,
                totalRows: rows.length,
                isExcelFile: false,
                source: 'google_sheets_api',
              });
            }
          }
        } catch (apiErr) {
          console.warn('Google Sheets API failed, falling back to public export or gviz:', apiErr);
        }
      }

      // 2. Fetch public / link-shared Google Sheet via export=xlsx
      if (spreadsheetId) {
        try {
          const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
          const exportRes = await fetch(exportUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            redirect: 'follow',
          });

          const contentType = exportRes.headers.get('content-type') || '';
          if (exportRes.ok && !contentType.includes('text/html')) {
            const arrayBuffer = await exportRes.arrayBuffer();
            const workbook = xlsxLib.read(Buffer.from(arrayBuffer), { type: 'buffer', cellDates: true });
            const sheetNames = workbook.SheetNames || [];
            const effectiveSheet = sheetTab && sheetNames.includes(sheetTab) ? sheetTab : (sheetNames[0] || 'Hoja 1');
            const worksheet = workbook.Sheets[effectiveSheet];
            let rawData: any[][] = [];
            if (worksheet) {
              rawData = xlsxLib.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
            }

            const appendedKey = `${spreadsheetId}_${effectiveSheet}`;
            const customAppended = getAppendedRows(appendedKey);
            if (customAppended.length > 0) {
              rawData = [...rawData, ...customAppended];
            }

            const { headers, rows } = detectHeaderRow(rawData);

            return res.json({
              success: true,
              id: spreadsheetId,
              title: `Hoja de Google Sheets (${spreadsheetId.substring(0, 8)}...)`,
              sheetNames,
              currentSheet: effectiveSheet,
              headers,
              rows,
              rawValues: rawData,
              totalRows: rows.length,
              isExcelFile: false,
              source: 'public_export_xlsx',
            });
          }
        } catch (exportErr) {
          console.warn('Export XLSX failed, trying gviz endpoint:', exportErr);
        }

        // 3. Fallback: Google Visualization API (gviz) CSV endpoint
        try {
          const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv${
            sheetTab ? `&sheet=${encodeURIComponent(sheetTab)}` : ''
          }`;
          const gvizRes = await fetch(gvizUrl, { redirect: 'follow' });
          if (gvizRes.ok) {
            const csvText = await gvizRes.text();
            if (csvText && !csvText.includes('<!DOCTYPE html>')) {
              const workbook = xlsxLib.read(csvText, { type: 'string' });
              const sheetNames = workbook.SheetNames || [sheetTab || 'Hoja 1'];
              const effectiveSheet = sheetNames[0];
              const worksheet = workbook.Sheets[effectiveSheet];
              let rawData: any[][] = [];
              if (worksheet) {
                rawData = xlsxLib.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
              }

              const appendedKey = `${spreadsheetId}_${effectiveSheet}`;
              const customAppended = getAppendedRows(appendedKey);
              if (customAppended.length > 0) {
                rawData = [...rawData, ...customAppended];
              }

              const { headers, rows } = detectHeaderRow(rawData);

              return res.json({
                success: true,
                id: spreadsheetId,
                title: `Hoja de Google Sheets (${spreadsheetId.substring(0, 8)}...)`,
                sheetNames: [sheetTab || 'Hoja 1'],
                currentSheet: sheetTab || 'Hoja 1',
                headers,
                rows,
                rawValues: rawData,
                totalRows: rows.length,
                isExcelFile: false,
                source: 'public_gviz_csv',
              });
            }
          }
        } catch (gvizErr) {
          console.warn('Gviz fallback failed:', gvizErr);
        }
      }

      // If all Google fetches failed, return clear error instead of silently returning dummy catalog
      return res.status(404).json({
        success: false,
        error: 'No se pudo leer el archivo o la hoja de Google Sheets solicitada desde Google Drive. Verifique que la cuenta de Google tenga permisos de lectura o que el enlace esté compartido.',
      });
    } catch (err: any) {
      console.error('Error in /api/sheets/fetch-sheet:', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Error al procesar la hoja de cálculo.',
      });
    }
  });

  // Dedicated API endpoint: Search in Google Drive specifically for N-FCO-03 institutional file
  app.post('/api/drive/search-nfco03', async (req, res) => {
    try {
      const { token } = req.body || {};
      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Debe conectar su cuenta de Google Workspace para buscar en Google Drive.',
        });
      }

      // If in direct connection mode, return empty matches gracefully
      if (token.startsWith('direct_')) {
        return res.json({
          success: true,
          bestMatch: null,
          matches: [],
          totalFound: 0,
          isDirectMode: true,
          message: 'Modo de acceso directo activo. Puede cargar el archivo Excel (.xlsx) directamente o conectar vía OAuth oficial.',
        });
      }

      // Run prioritized search queries in Google Drive
      const searchQueries = [
        "name contains 'N-FCO-03' and trashed=false",
        "name contains 'SOLICITUD DE CREACI' and trashed=false",
        "name contains 'PARTES VR00' and trashed=false",
        "(name contains 'INACTIVACION' or name contains 'INACTIVACIÓN') and trashed=false",
        "(mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/vnd.google-apps.spreadsheet') and trashed=false",
      ];

      const foundFilesMap = new Map<string, any>();

      for (const q of searchQueries) {
        try {
          const driveRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,webViewLink,modifiedTime,size)&pageSize=50&orderBy=modifiedTime desc`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (driveRes.ok) {
            const data: any = await driveRes.json();
            const files = data.files || [];
            for (const f of files) {
              foundFilesMap.set(f.id, f);
            }
          } else if (driveRes.status === 401 || driveRes.status === 403) {
            console.warn('Google Drive search returned status:', driveRes.status);
          }
        } catch (_) {}
      }

      const allFiles = Array.from(foundFilesMap.values());

      const cleanNormalize = (str: string) =>
        (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

      const targetExact = 'n-fco-03 solicitud de creacion, modificacion e inactivacion de partes vr00 en revision';

      const scored = allFiles.map((f) => {
        const normName = cleanNormalize(f.name);
        let score = 0;
        if (normName.includes('n-fco-03')) score += 50;
        if (normName.includes('n-fco')) score += 20;
        if (normName.includes('solicitud')) score += 15;
        if (normName.includes('partes')) score += 15;
        if (normName.includes('vr00')) score += 15;
        if (normName.includes('creacion')) score += 10;
        if (normName.includes('inactivacion')) score += 10;
        if (normName.includes('revision')) score += 10;
        if (normName.startsWith(targetExact) || normName === `${targetExact}.xlsx`) score += 100;
        return { ...f, score };
      });

      scored.sort((a, b) => b.score - a.score || (b.modifiedTime || '').localeCompare(a.modifiedTime || ''));

      const bestMatch = scored.length > 0 && scored[0].score >= 30 ? scored[0] : null;

      return res.json({
        success: true,
        bestMatch,
        matches: scored.filter((s) => s.score > 0),
        totalFound: allFiles.length,
      });
    } catch (err: any) {
      console.error('Error in /api/drive/search-nfco03:', err);
      return res.json({
        success: true,
        bestMatch: null,
        matches: [],
        totalFound: 0,
        warning: err?.message || 'No se pudieron consultar archivos en Google Drive.',
      });
    }
  });

  // API endpoint: Cache document file locally on disk for ultra-fast, offline-resilient PDF preview
  app.post('/api/documents/cache', express.json({ limit: '50mb' }), async (req, res) => {
    try {
      const { id, base64 } = req.body || {};
      if (!id || !base64) {
        return res.status(400).json({ success: false, error: 'id and base64 required' });
      }

      const docsDir = path.join(process.cwd(), 'data', 'documents');
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
      }

      const rawBase64 = base64.includes('base64,') ? base64.split('base64,')[1] : base64;
      const buffer = Buffer.from(rawBase64, 'base64');
      const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
      fs.writeFileSync(path.join(docsDir, `${safeId}.pdf`), buffer);

      return res.json({ success: true, path: `/api/documents/cached/${safeId}` });
    } catch (err: any) {
      console.warn('Could not cache document on server:', err);
      return res.status(500).json({ success: false, error: err?.message });
    }
  });

  // API endpoint: Retrieve locally cached PDF document
  app.get('/api/documents/cached/:id', (req, res) => {
    try {
      const safeId = (req.params.id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filePath = path.join(process.cwd(), 'data', 'documents', `${safeId}.pdf`);

      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return fs.createReadStream(filePath).pipe(res);
      }

      return res.status(404).send('Document not found in local cache');
    } catch (err: any) {
      return res.status(500).send(err?.message || 'Error reading cached document');
    }
  });

  // API endpoint: Proxy Google Drive file to bypass browser iframe & CORS restrictions for integrated PDF preview
  app.get('/api/drive/proxy-file/:fileId', async (req, res) => {
    try {
      const fileId = req.params.fileId;
      const token =
        (req.query.token as string) ||
        (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : '');

      if (!fileId) {
        return res.status(400).send('Se requiere el ID del archivo.');
      }

      const safeId = fileId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const cachedPath = path.join(process.cwd(), 'data', 'documents', `${safeId}.pdf`);
      if (fs.existsSync(cachedPath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return fs.createReadStream(cachedPath).pipe(res);
      }

      const headers: Record<string, string> = {};
      if (token && !token.startsWith('direct_')) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // 1. Try Google Drive v3 files.get with alt=media
      let driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
        { headers }
      );

      // 2. If unauthorized or failed, attempt public download link
      if (!driveRes.ok) {
        try {
          const publicRes = await fetch(`https://drive.google.com/uc?export=download&id=${fileId}`);
          if (publicRes.ok) {
            driveRes = publicRes;
          }
        } catch (_) {}
      }

      if (!driveRes.ok) {
        return res.status(driveRes.status).json({
          success: false,
          error: `Google Drive respondió con código ${driveRes.status}`,
        });
      }

      const contentType = driveRes.headers.get('content-type') || 'application/pdf';
      res.setHeader('Content-Type', contentType.includes('json') ? 'application/pdf' : contentType);
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      const arrayBuffer = await driveRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Cache on local disk for subsequent visits
      try {
        const docsDir = path.join(process.cwd(), 'data', 'documents');
        if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
        fs.writeFileSync(cachedPath, buffer);
      } catch (_) {}

      return res.send(buffer);
    } catch (err: any) {
      console.error('Error in /api/drive/proxy-file:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Error proxying Drive file' });
    }
  });

  // API endpoint: Append new row / part to Google Sheets or Master Catalog
  // API endpoint: append-row is permanently disabled to enforce READ-ONLY protection of Google Drive files
  app.post('/api/sheets/append-row', async (_req, res) => {
    return res.status(403).json({
      success: false,
      error: 'Modo de Solo Consulta activado: la modificación y escritura sobre archivos de Google Drive está deshabilitada para proteger la integridad de sus archivos.',
    });
  });

  // API endpoint: Live Server Version & Boot Timestamp (for automatic cross-device live update detection)
  app.get(['/api/version', '/api/app-version'], (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json({
      bootTime: SERVER_BOOT_TIME,
      version: APP_VERSION,
      timestamp: Date.now(),
      status: 'active',
    });
  });

  // Initialize Gemini SDK with User-Agent header for telemetry
  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  };

  // Helper to generate content with ultra-fast model selection and quota fallback
  const generateWithModelFallback = async (ai: GoogleGenAI, prompt: string, preferredModel = 'gemini-3.8-flash'): Promise<string> => {
    const modelsToTry = [preferredModel, 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
    // Deduplicate in case preferredModel is already in the list
    const uniqueModels = Array.from(new Set(modelsToTry));
    let lastError: any = null;

    for (let i = 0; i < uniqueModels.length; i++) {
      const modelName = uniqueModels[i];
      try {
        const config: any = {
          responseMimeType: 'application/json',
        };

        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config,
        });
        if (response.text) {
          return response.text;
        }
      } catch (err: any) {
        lastError = err;
        // If 503 (high demand) or 429 (rate limit), wait briefly before trying next model
        if (i < uniqueModels.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
    }

    throw lastError || new Error('All model attempts failed');
  };

  // API endpoint: Optimize & Suggest Technical Specification
  app.post('/api/gemini/optimize-spec', async (req, res) => {
    try {
      const { specText, equipmentName, brand, model } = req.body;
      if (!specText || typeof specText !== 'string') {
        return res.status(400).json({ error: 'specText is required' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(200).json({
          fallback: true,
          message: 'Server Gemini client not configured, using local rule-based optimizer',
        });
      }

      const prompt = `Eres un Ingeniero Biomédico experto en contratación pública hospitalaria (SECOP II) y estructuración de pliegos técnicos de equipos médicos en Colombia para SYD Colombia.
Tu tarea es analizar, corregir y profesionalizar la siguiente especificación técnica ingresada por el usuario.

Contexto del Equipo:
- Equipo: ${equipmentName || 'Equipo Biomédico Hospitalario'}
- Marca: ${brand || 'No especificada'}
- Modelo: ${model || 'No especificado'}

Texto original ingresado por el usuario:
"${specText}"

Instrucciones:
1. Corrige ortografía, sintaxis y unidades de medida (ej: mmHg, cmH2O, lpm/bpm, Hz, Joules, L/min, MHz, Watts, ml, °C, kg, cm, mm, pulgadas, etc.).
2. REGLA ESTRICTA DE DETECCIÓN DE PARÁMETROS NUMÉRICOS (isParametricSpec):
   - Solo se considera parámetro con rango si el texto CONTIENE PARÁMETROS FÍSICOS CONTINUOS MEDIBLES con unidades de ingeniería biomédica (ej: "pantalla 12.1 pulgadas", "frecuencia 50 a 100 lpm", "altura 60 cm", "presion 120/80 mmHg", "volumen 1500 ml", "batería 4 horas", "energía 360 Joules", "potencia 300 Watts", etc.).
   - PROHIBIDO GENERAR RANGO PARA ESTÁNDARES, PROTOCOLOS, ALGORITMOS O CONTEOS DISCRETOS:
     * Textos que mencionen HL7, DICOM, IEC 60601, ISO 13485, IPX1, USB, RS232, Wi-Fi, VGA, HDMI, etc. NO son rangos numéricos.
     * Textos como "más de 20 tipos de arritmias", "análisis del segmento ST", "hasta 8 curvas simultáneas", "cable de 3 a 5 derivadas", "12 derivaciones", "software en español", "registro INVIMA", etc. son ESPECIFICACIONES CUALITATIVAS / DE FUNCIONALIDAD, NO parámetros con rangos.
     * En todos estos casos debes responder obligatoriamente: "isParametricSpec": false, "paramName": null, "detectedWorkRange": null, "rangeVersion": null, "rangeVariants": null.
   - SI CONTIENE PARÁMETROS FÍSICOS MEDIBLES REALES:
     * "isParametricSpec": true
     * "paramName": Nombre del parámetro (ej: "Tamaño de Pantalla", "Frecuencia Cardíaca", "Cambio de Altura / Elevación", "Presión Arterial NIBP", "Medidas y Dimensiones", "Volumen Corriente", "Autonomía de Batería", etc.)
     * REGLA CRÍTICA DE RANGOS AMPLIOS: Los rangos de valores deben ser holgados, amplios y comercialmente realistas para pliegos de licitación, NUNCA rangos estrechos o milimétricos (como "12 a 12.2" o "12.0 a 12.2" que restringen indebidamente la licitación):
       - Pantallas: Si el valor original es ~12.1", el rango debe ser AMPLIO, ej: "10 a 12.1 pulgadas" o "10 a 13 pulgadas" (NUNCA 12 a 12.2). Si es 15", "12 a 15 pulgadas" o "12 a 17 pulgadas". Si es 8.4" o 7", "7 a 10.4 pulgadas".
       - Baterías: Para 4 horas -> "2 a 5 horas" o "mínimo 3 horas".
       - Frecuencia cardíaca: "15 a 300 lpm".
       - Presión NIBP: "10 a 270 mmHg".
       - Volumen Corriente (Vt): "10 a 1500 ml" o "20 a 1200 ml".
       - Flujo de gases: "0.1 a 15 L/min".
       - Energía desfibrilador: "1 a 360 Joules".
       - Potencia electrobisturí: "10 a 300 Watts".
       - Peso: Para equipo de 3.5 kg -> "2.5 a 4.5 kg".
     * "detectedWorkRange": Formular SIEMPRE como un INTERVALO/RANGO de valores amplio (ej: "10 a 12.1 pulgadas", "10 a 13 pulgadas", "15 a 300 lpm", "10 a 270 mmHg", "2 a 5 horas"). NO uses frases unilaterales como "no inferior a" en el campo de rango.
     * "rangeVersion": Redacción técnica formal que incorpore explícitamente el rango de valores de tipo "entre [Min] a [Max] [Unidad]" (ej: "Pantalla médica táctil a color con visualización diagonal entre 10 a 12.1 pulgadas de alta definición con curvas simultáneas...", "Rango de trabajo de frecuencia cardíaca continuo entre 15 a 300 lpm con resolución de 1 lpm...").
     * "rangeVariants": Objeto con 4 variantes: "between" (entre Min a Max amplio), "min" (mínimo Min hasta Max), "max" (máximo hasta Max), "fixed" (de [Valor] [Unidad] / valor nominal sin rangos).

3. Genera las 2 versiones de redacción:
   - "optimized": Versión técnica profesional mejorada y clara con rango "entre" amplio si es paramétrica.
   - "formal": Versión estrictamente formal para pliegos de contratación hospitalaria.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "optimized": "texto mejorado con rango entre amplio",
  "formal": "texto formal",
  "isParametricSpec": true,
  "paramName": "Tamaño de Pantalla",
  "detectedWorkRange": "10 a 12.1 pulgadas",
  "rangeVersion": "Pantalla médica táctil a color con tamaño diagonal entre 10 a 12.1 pulgadas con visualización de curvas simultáneas.",
  "rangeVariants": {
    "between": "Pantalla médica táctil a color con tamaño diagonal entre 10 a 12.1 pulgadas.",
    "min": "Pantalla médica táctil a color con tamaño diagonal mínimo 10 pulgadas.",
    "max": "Pantalla médica táctil a color con tamaño diagonal máximo hasta 13 pulgadas.",
    "fixed": "Pantalla médica táctil a color con tamaño diagonal de 12.1 pulgadas."
  }
}`;

      let responseText = '{}';
      try {
        responseText = await generateWithModelFallback(ai, prompt);
      } catch (geminiError) {
        console.warn('Gemini models temporarily unavailable, using graceful local fallback response:', geminiError);
        return res.status(200).json({
          fallback: true,
          message: 'Gemini service temporarily at capacity, switching to local biomedical engine',
        });
      }

      const parsedData = JSON.parse(responseText);

      return res.json({
        success: true,
        data: parsedData,
      });
    } catch (err: any) {
      console.warn('Handling optimization request with local fallback:', err?.message || err);
      return res.status(200).json({
        fallback: true,
        message: err.message || 'Error processing AI technical specification',
      });
    }
  });

  // API endpoint: Generate complete AI Recommended Specifications & Ranges for an Equipment
  app.post('/api/gemini/generate-equipment-specs', async (req, res) => {
    try {
      const { equipmentName, brand, model, categoryFocus, customPrompt, count } = req.body;
      if (!equipmentName) {
        return res.status(400).json({ error: 'equipmentName is required' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(200).json({
          fallback: true,
          message: 'Server Gemini client not configured, using local rule generator',
        });
      }

      let focusInstructions = '';
      if (customPrompt && customPrompt.trim()) {
        focusInstructions = `\nREQUERIMIENTO O ENFOQUE ESPECÍFICO DEL USUARIO:\n"${customPrompt.trim()}"\nGenera especificaciones técnicas altamente especializadas y precisas alineadas con esta instrucción.`;
      } else if (categoryFocus) {
        if (categoryFocus === 'ranges') {
          focusInstructions = '\nENFOQUE OBLIGATORIO: Genera especificaciones técnicas centradas en PARÁMETROS NUMÉRICOS, RANGOS DE TRABAJO HOLGADOS Y MEDICIONES BIOMÉDICAS (ej: pantalla, presiones, frecuencias, volumen, batería, potencias, etc.).';
        } else if (categoryFocus === 'shielding') {
          focusInstructions = '\nENFOQUE OBLIGATORIO: Genera especificaciones técnicas de BLINDAJE TECNOLÓGICO, funciones exclusivas, algoritmos avanzados, patentes y diferenciadores de alta tecnología para el equipo.';
        } else if (categoryFocus === 'connectivity') {
          focusInstructions = '\nENFOQUE OBLIGATORIO: Genera especificaciones técnicas de CONECTIVIDAD, SOFTWARE, PROTOCOLOS (HL7, DICOM, HIS/RIS), SEGURIDAD ELÉCTRICA (IEC 60601), INVIMA Y NORMATIVIDAD.';
        } else if (categoryFocus === 'accessories') {
          focusInstructions = '\nENFOQUE OBLIGATORIO: Genera especificaciones técnicas de ACCESORIOS ESTÁNDAR, SUMINISTROS, CONSUMIBLES Y MÓDULOS DE EXPANSIÓN.';
        }
      }

      const specQuantity = count && Number(count) > 0 ? Number(count) : 8;

      const prompt = `Eres un Ingeniero Biomédico senior especialista en licitaciones hospitalarias en Colombia (SECOP II) y fichas técnicas médicas para la empresa SYD Colombia.
Analiza la tecnología médica del siguiente equipo:
- Nombre de Equipo: ${equipmentName}
- Marca: ${brand || 'SYD Colombia / Mindray / General'}
- Modelo: ${model || 'Estándar Hospitalario'}
${focusInstructions}

Instrucciones de redacción técnica:
1. Genera entre ${Math.max(4, specQuantity - 2)} y ${specQuantity} especificaciones técnicas formales redactadas profesionalmente para pliego licitatorio.
2. REGLA ESTRICTA: NO INCLUYAS símbolos de estrellas (ni ⭐, ni ★, ni asteriscos) en ningún texto ni en los requerimientos.
3. REGLA DE RANGOS AMPLIOS PARA ESPECIFICACIONES CON VALORES NUMÉRICOS:
   - Solo para especificaciones que involucren parámetros medibles o valores numéricos (ej: frecuencia cardíaca, NIBP, SpO2, temperatura, volumen tidal, presiones PEEP, flujo de gases medicinales, tamaño de pantalla, autonomía de batería, potencia en Watts, energía en Joules, tasa de infusión, etc.), debes indicar "hasWorkRange": true, y un "workRange" AMPLIO y HOLGADO.
   - NUNCA generes rangos estrechos, cerrados o milimétricos (como "12 a 12.2", "12.0 a 12.2" o "3.9 a 4.1").
   - Ejemplos de rangos amplios aprobados:
     * Tamaño de pantalla para equipo de ~12.1": workRange "10 a 12.1 pulgadas" o "10 a 13 pulgadas" (between: "Pantalla médica táctil a color con tamaño diagonal entre 10 a 12.1 pulgadas de alta definición...", fixed: "Pantalla médica táctil a color con tamaño diagonal de 12.1 pulgadas").
     * Tamaño de pantalla para equipo de 15": "12 a 15 pulgadas" o "12 a 17 pulgadas".
     * Frecuencia cardíaca: "15 a 300 lpm".
     * Presión no invasiva NIBP: "10 a 270 mmHg".
     * Saturación SpO2: "0 a 100%".
     * Temperatura: "0.0 a 50.0 °C".
     * Batería: "2 a 5 horas" o "mínimo 3 horas".
     * Volumen corriente Vt: "10 a 1500 ml" o "20 a 1200 ml".
     * Suministro de gases: "0.1 a 15 L/min".
     * Energía de desfibrilación: "1 a 360 Joules".
     * Potencia electrobisturí: "10 a 300 Watts".
   - Variantes de redacción a generar en cada especificación numérica:
     * "between": redacción con rango amplio "entre [min] a [max] [unidad]"
     * "min": redacción con exigencia de mínimo "mínimo [min] [unidad] hasta [max] [unidad]"
     * "max": redacción con límite superior "máximo hasta [max] [unidad]"
     * "fixed": redacción con valor nominal definido "de [max] [unit]" (sin rangos)
4. PARA ESPECIFICACIONES CUALITATIVAS, DE SOFTWARE, ALGORITMOS O ESTÁNDARES:
   - Casos como compatibilidad HL7/DICOM, análisis de arritmias, análisis del segmento ST, visualización de curvas, derivaciones, software en español, alarmas según IEC 60601, grado de protección IPX, manuales de usuario y certificaciones:
   - Deben tener OBLIGATORIAMENTE "hasWorkRange": false, "workRange": null y sin variantes numéricas ni rangos artificiales.
5. Marca 1 o 2 especificaciones como "isUnique": true si corresponden a características diferenciales de alto nivel.
6. Sugiere una lista de 4 a 6 "optionalAccessories" adicionales.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta estructura exacta:
{
  "specs": [
    {
      "requirement": "Pantalla médica táctil LED a color de alta definición con tamaño diagonal entre 10 a 12.1 pulgadas con visualización de hasta 8 curvas simultáneas.",
      "isUnique": false,
      "hasWorkRange": true,
      "workRange": "10 a 12.1 pulgadas",
      "rangeVariants": {
        "between": "Pantalla médica táctil a color con visualización diagonal entre 10 a 12.1 pulgadas.",
        "min": "Pantalla médica táctil a color con visualización diagonal mínimo de 10 pulgadas.",
        "max": "Pantalla médica táctil a color con visualización diagonal hasta 13 pulgadas.",
        "fixed": "Pantalla médica táctil a color con visualización diagonal de 12.1 pulgadas."
      }
    },
    {
      "requirement": "Rango de trabajo de medición continua de frecuencia cardíaca de 15 a 300 lpm con resolución de 1 lpm y alarmas programables.",
      "isUnique": false,
      "hasWorkRange": true,
      "workRange": "15 a 300 lpm",
      "rangeVariants": {
        "between": "Rango de trabajo de frecuencia cardíaca continuo entre 15 a 300 lpm con resolución de 1 lpm.",
        "min": "Capacidad de frecuencia cardíaca de mínimo 15 lpm hasta 300 lpm con alarmas programables.",
        "max": "Frecuencia cardíaca con límite superior de máximo hasta 300 lpm.",
        "fixed": "Medición de frecuencia cardíaca continua con capacidad nominal de 300 lpm."
      }
    },
    {
      "requirement": "Interconectividad con sistema de información hospitalaria (HIS/RIS) y central de monitoreo mediante protocolo estándar HL7 y DICOM.",
      "isUnique": false,
      "hasWorkRange": false,
      "workRange": null
    }
  ],
  "optionalAccessories": [
    "Carrito de transporte rodable con frenos y bandeja porta-accesorios",
    "Brazo articulado de soporte a pared con giro de 180°",
    "Módulo adicional de Capnografía (EtCO2 microstream)",
    "Módulo de Presión Invasiva (IBP) de 2 canales",
    "Impresora / Registrador térmico incorporado de 3 canales",
    "Batería adicional de Iones de Litio de larga duración"
  ]
}`;

      let responseText = '{}';
      try {
        responseText = await generateWithModelFallback(ai, prompt);
      } catch (geminiError: any) {
        console.warn('Gemini specs capacity fallback triggered:', geminiError?.message || geminiError);
        return res.status(200).json({
          fallback: true,
          message: 'Gemini service temporarily at capacity, switching to local rules',
        });
      }

      const parsedData = JSON.parse(responseText);

      return res.json({
        success: true,
        data: parsedData,
      });
    } catch (err: any) {
      console.warn('Handling equipment specs request with fallback:', err?.message || err);
      return res.status(200).json({
        fallback: true,
        message: err.message || 'Error generating specs',
      });
    }
  });

  // API endpoint: Research equipment details from internet using AI & Google Search
  app.post('/api/gemini/research-equipment-sheet', async (req, res) => {
    try {
      const { equipmentName, brand, model } = req.body;
      if (!equipmentName || typeof equipmentName !== 'string') {
        return res.status(400).json({ error: 'equipmentName is required' });
      }

      const ai = getGeminiClient();
      const trimmedName = equipmentName.trim();
      const trimmedBrand = (brand || '').trim();
      const trimmedModel = (model || '').trim();

      // Local heuristic fallback generator
      const getBiomedicalFallback = () => {
        const lower = trimmedName.toLowerCase();
        const isScissors = /tijera|metzembaum|metzenbaum|mayo|iris|castroviejo|potts|stevens|liston|tijeras/i.test(lower);
        const isClamp = /pinza|kelly|kocher|mosquito|allis|babcock|hemostatica|portaagujas|crile|foerster|backhaus|duval|clamp|forceps|disiseccion|disección/i.test(lower);
        const isTray = /bandeja|recipiente|rinonera|caja quirurgica|canastilla|tambor|cubeta/i.test(lower);
        const isFurniture = /camilla|cama hospitalaria|mesa de mayo|mesa pasteur|mesa quirurgica|escalerilla|vitrina|carro de paro|carro de curaciones|atril|silla de ruedas|mueble/i.test(lower);
        const isMonitoring = /monitor|signos vitales|multiparámetro|beneview|umec|epm|ipm/i.test(lower);
        const isDefib = /desfibrilador|dea|beneheart/i.test(lower);
        const isElectro = /electrobistur|electrocirug|bovie/i.test(lower);
        const isVentilator = /ventilador|respirador|sv300|synovent/i.test(lower);
        const isInfusion = /bomba|infusion|infusor|jeringa|benefusion/i.test(lower);
        const isUltrasound = /ecograf|ultrasonid|transductor/i.test(lower);
        const isLight = /lampara|cielitica|quirurgica|frontoluz/i.test(lower);
        const isSuction = /suctor|aspirador|secreciones/i.test(lower);
        const isECG = /electrocardiog|ecg|ekg/i.test(lower);

        let desc = `Dispositivo biomédico hospitalario de alta calidad y precisión diseñado para soporte asistencial y clínico conforme a normativas ISO 13485 e INVIMA.`;
        let characteristics = [
          'Fabricación con materiales de grado médico de alta pureza y resistencia.',
          'Diseño ergonómico optimizado para procedimientos asistenciales y clínicos seguros.',
          'Superficies higiénicas no porosas de fácil limpieza y desinfección hospitalaria.',
          'Resistencia superior a la corrosión, agentes desinfectantes y uso intensivo.',
          'Bordes y acabados de seguridad para eliminar acumulación de agentes patógenos.'
        ];
        let func = `Brindar soporte clínico, asistencial o quirúrgico seguro y confiable en los servicios asistenciales de la institución.`;
        let mat = 'Acero Inoxidable ASIS 420/316 para uso en dispositivos quirúrgicos y hospitalarios de alta calidad.';
        let invima = `2024DM-${Math.floor(1000000 + Math.random() * 9000000).toString().substring(0, 7)}`;
        let area = 'SERVICIOS QUIRÚRGICOS Y ASISTENCIALES';
        let sterilization = 'El producto se suministra NO ESTÉRIL. Debe someterse a protocolo de lavado con detergente enzimático y posterior esterilización por vapor en autoclave a 134°C.';
        let storage = 'Almacenar en lugar limpio, fresco y seco (15°C a 25°C), humedad relativa menor al 65%, protegido del polvo y luz solar directa.';
        let warranty = '5 años contra defectos de fabricación en acero quirúrgico.';
        let variants = [
          { code: trimmedModel ? `${trimmedModel}-01` : 'REF-01', size: 'Estándar', dimensions: 'Configuración estándar', description: 'Uso clínico habitual' },
          { code: trimmedModel ? `${trimmedModel}-02` : 'REF-02', size: 'Especializada', dimensions: 'Configuración reforzada', description: 'Alta demanda' }
        ];

        if (isScissors) {
          const isMetz = /metzembaum|metzenbaum/i.test(lower);
          const isMayo = /mayo/i.test(lower);
          const scissorType = isMetz ? 'Metzenbaum' : isMayo ? 'Mayo' : 'Quirúrgica';

          desc = `Tijera ${scissorType} de alta precisión diseñada con ramas finas y hojas curvas o rectas con puntas romas de seguridad, ideal para la disección roma delicada y el corte atraumático de tejidos biológicos blandos en profundidad anatómica.`;
          characteristics = [
            'Hojas afiladas de alta precisión con filo biselado continuo para corte limpio y sin desgarros tisulares.',
            'Puntas romas atraumáticas para disección roma segura evitando la perforación accidental de vasos o vísceras.',
            'Fabricación en Acero Inoxidable Martensítico Alemán (AISI 420 / 440A) templado térmicamente para máxima dureza.',
            'Articulación con tornillo central rectificado de precisión que garantiza un deslizamiento suave y sin holguras.',
            'Anillas ergonómicas redondeadas con amplio diámetro para un agarre cómodo y control milimétrico del cirujano.',
            'Alta resistencia química a desinfectantes enzimáticos y esterilización en autoclave a 134°C, OE y plasma.'
          ];
          func = 'Disección roma y sección precisa y atraumática de tejidos blandos, planos profundos y estructuras delicadas en intervenciones quirúrgicas.';
          mat = 'Acero Inoxidable Martensítico Alemán de grado quirúrgico AISI 420 / DIN 1.4021 con tratamiento térmico de endurecimiento.';
          area = 'QUIRÓFANO, CIRUGÍA GENERAL Y CENTRAL DE ESTERILIZACIÓN';
          sterilization = 'Suministrado NO ESTÉRIL. Lavado ultrasónico o manual con detergente enzimático neutro y esterilización en autoclave a 134°C por 5 a 18 minutos.';
          warranty = '5 años contra defectos de fabricación y fatiga prematura del material.';
          variants = [
            { code: '14.5 cm (Curva)', size: '14.5 cm (5-3/4")', dimensions: 'Longitud: 14.5 cm, Curva', description: 'Disección fina superficial' },
            { code: '18.0 cm (Curva)', size: '18 cm (7")', dimensions: 'Longitud: 18 cm, Curva', description: 'Estándar de cirugía general' },
            { code: '20.0 cm (Curva)', size: '20 cm (8")', dimensions: 'Longitud: 20 cm, Curva', description: 'Disección profunda de tejidos' },
            { code: '23.0 cm (Curva)', size: '23 cm (9")', dimensions: 'Longitud: 23 cm, Curva', description: 'Cirugía pélvica / torácica profunda' },
            { code: '18.0 cm (Recta)', size: '18 cm (7")', dimensions: 'Longitud: 18 cm, Recta', description: 'Corte de suturas y tejidos superficiales' }
          ];
        } else if (isClamp) {
          desc = `Instrumental quirúrgico hemostático de prensión de alta confiabilidad con estrías transversales y sistema de cremallera de múltiples posiciones para hemostasia y sujeción firme.`;
          characteristics = [
            'Ramas estilizadas con mandíbulas dentadas transversales para sujeción atraumática pero firme de vasos.',
            'Sistema de trinquete / cremallera de 3 a 5 pasos para bloqueo y fijación gradual de presión.',
            'Acero inoxidable de grado quirúrgico AISI 410 / 420 con acabado satinado antirreflejo bajo luz cialítica.',
            'Resistencia superior a la fatiga elástica en ciclos continuos de apertura y cierre.',
            'Esterilizable por calor húmedo en autoclave a 134°C, calor seco y óxido de etileno.'
          ];
          func = 'Oclusión hemostática de vasos sanguíneos, sujeción firme de tejidos o fijación de campos quirúrgicos.';
          mat = 'Acero Inoxidable de grado quirúrgico AISI 420/410 templado.';
          area = 'QUIRÓFANO Y CENTRAL DE ESTERILIZACIÓN';
          sterilization = 'Suministrado NO ESTÉRIL. Desinfección enzimática y esterilización en autoclave a 134°C con cremallera abierta.';
          warranty = '5 años contra defectos de fabricación.';
          variants = [
            { code: '14.0 cm (Curva)', size: '14 cm (5-1/2")', dimensions: 'Longitud: 14 cm, Curva', description: 'Hemostasia delicada' },
            { code: '14.0 cm (Recta)', size: '14 cm (5-1/2")', dimensions: 'Longitud: 14 cm, Recta', description: 'Tracción y hemostasia superficial' },
            { code: '16.0 cm (Curva)', size: '16 cm (6-1/4")', dimensions: 'Longitud: 16 cm, Curva', description: 'Cirugía general y planos medios' },
            { code: '18.5 cm (Curva)', size: '18.5 cm (7-1/4")', dimensions: 'Longitud: 18.5 cm, Curva', description: 'Hemostasia profunda' }
          ];
        } else if (isTray) {
          desc = `Dispositivo e instrumental quirúrgico de alta durabilidad, diseñado para la contención, organización, transporte y esterilización segura de instrumental en sala de operaciones y central de esterilización.`;
          characteristics = [
            'Fabricado en Acero Inoxidable ASIS 420/316 de grado quirúrgico de alta pureza.',
            'Acabado superficial sanitario no poroso, resistente a picaduras y corrosión.',
            'Bordes romos perimetrales y esquinas redondeadas para evitar atrapamiento de residuos y proteger envolturas estériles.',
            'Excelente tolerancia térmica a ciclos repetitivos de esterilización en autoclave (hasta 134°C) y calor seco.',
            'Alta resistencia mecánica a la flexión, deformaciones y agentes químicos desinfectantes enzimáticos.'
          ];
          func = 'Soporte, disposición organizada, transporte y esterilización de instrumental y material quirúrgico durante actos operatorios y en central de esterilización.';
          mat = 'Acero Inoxidable ASIS 420/316 para uso en fabricación de implantes y dispositivos quirúrgicos, que cumple con los requisitos de seguridad, eficacia y calidad.';
          area = 'CENTRAL DE ESTERILIZACIÓN Y QUIRÓFANO';
          sterilization = 'El producto se suministra NO ESTÉRIL y debe ser sometido a protocolo de lavado con detergente enzimático neutro y posterior esterilización por vapor en autoclave a 134°C (o calor seco).';
          warranty = '5 años contra defectos de fabricación o fallas estructurales de material.';
          variants = [
            { code: '35 x 25 x 1 cm', size: '13-3/4" x 9-3/4" x 1/2"', dimensions: '35 x 25 x 1 cm', description: 'Bandeja plana para instrumental menor' },
            { code: '38 x 26.5 x 2 cm', size: '15" x 10-1/2" x 3/4"', dimensions: '38 x 26.5 x 2 cm', description: 'Bandeja plana para cirugía general' },
            { code: '43 x 29.5 x 1 cm', size: '17" x 11-5/8" x 1/2"', dimensions: '43 x 29.5 x 1 cm', description: 'Bandeja plana para instrumental mayor' }
          ];
        } else if (isFurniture) {
          desc = `Mobiliario hospitalario de alta resistencia y diseño ergonómico, concebido para brindar máxima seguridad, higiene, estabilidad y confort en áreas de hospitalización, consulta o quirófano.`;
          characteristics = [
            'Estructura tubular robusta en acero de alto calibre con recubrimiento en pintura electrostática epoxi-poliéster horneada.',
            'Superficies y planos de apoyo lisos, libres de aristas vivas, diseñados para limpieza y desinfección rápida.',
            'Ruedas de grado hospitalario de giro suave de 3" a 5" con freno individual y banda de poliuretano antihuella.',
            'Capacidad de carga estática y dinámica superior probada bajo estándares de seguridad hospitalaria.',
            'Resistente a soluciones antisépticas, alcoholes, hipoclorito diluido y detergentes institucionales.'
          ];
          func = 'Facilitar el traslado, soporte, descanso y posicionamiento seguro del paciente y del instrumental médico durante la atención clínica.';
          mat = 'Estructura metálica en acero laminado en frío / acero inoxidable AISI 304 con acabados de grado hospitalario.';
          area = 'HOSPITALIZACIÓN, URGENCIAS, QUIRÓFANO Y CONSULTA EXTERNA';
          sterilization = 'Limpieza y desinfección de superficies con paños humedecidos en solución de amonio cuaternario o hipoclorito de sodio al 0.5%. No sumergir.';
          warranty = '3 años de garantía estructural por defectos de fabricación.';
          variants = [
            { code: '190 x 60 x 80 cm', size: 'Configuración Estándar', dimensions: '190 x 60 x 80 cm', description: 'Dimensiones reglamentarias de uso hospitalario general' },
            { code: '200 x 75 x 85 cm', size: 'Configuración Reforzada', dimensions: '200 x 75 x 85 cm', description: 'Alta capacidad de carga y uso bariátrico' }
          ];
        } else if (isMonitoring) {
          desc = `Monitor multiparámetro de alta fidelidad para la monitorización continua y en tiempo real de los signos vitales del paciente, con pantalla táctil de alta definición y alarmas configurables.`;
          characteristics = [
            'Visualización simultánea multicanal de curvas fisiológicas (ECG, SpO2, Resp, NIBP, Temperatura, IBP).',
            'Algoritmo avanzado de detección de arritmias y análisis del segmento ST en tiempo real.',
            'Alarmas audiovisuales graduables por severidad conforme a la norma IEC 60601-1-8.',
            'Batería recargable integrada de iones de litio con autonomía superior a 4 horas.',
            'Puertos de conectividad estándar USB, Ethernet y compatibilidad con protocolo HL7/HIS.',
            'Carcasa con protección IPX1 contra goteo vertical y materiales resistentes a desinfectantes.'
          ];
          func = 'Monitorización continua y no invasiva de variables fisiológicas críticas del paciente en estado agudo o postoperatorio.';
          mat = 'Estructura externa en polímero ABS de grado médico ignífugo de alto impacto y blindaje electromagnético interno.';
          area = 'UNIDAD DE CUIDADOS INTENSIVOS (UCI), URGENCIAS Y RECUPERACIÓN';
          sterilization = 'Limpieza de superficies con paño suave humedecido con amonio cuaternario o alcohol isopropílico al 70%. Sensores esterilizables según especificación.';
          warranty = '2 años de garantía total del equipo con soporte técnico, repuestos y calibración metrológica.';
          variants = [
            { code: trimmedModel ? `${trimmedModel}-10` : 'uMEC-10', size: 'Pantalla 10.4"', dimensions: '27 x 17 x 24 cm', description: 'Monitor para hospitalización y transporte' },
            { code: trimmedModel ? `${trimmedModel}-12` : 'uMEC-12', size: 'Pantalla 12.1"', dimensions: '31 x 18 x 29 cm', description: 'Monitor para cuidados intermedios y UCI' }
          ];
        } else if (isDefib) {
          desc = `Desfibrilador / monitor bifásico portátil para reanimación cardiopulmonar, desfibrilación manual, DEA y monitorización de constantes vitales en situaciones de emergencia.`;
          characteristics = [
            'Tecnología de onda bifásica truncada exponencial (BTE) con compensación de impedancia transtorácica.',
            'Modos de operación: Manual, DEA y Marcapasos no invasivo transcutáneo.',
            'Tiempo de carga ultra-rápido menor a 5 segundos para 200 Joules.',
            'Pantalla a color de alta visibilidad para curvas de ECG y energía seleccionada.',
            'Autotest diario automático con indicador visual de operatividad del equipo.',
            'Palas externas multifunción adulto/pediátrico integradas con selector de carga.'
          ];
          func = 'Reanimación cardiopulmonar mediante descarga eléctrica controlada y monitorización electrocardiográfica en parada cardiorrespiratoria.';
          mat = 'Polímero de alta resistencia mecánica a impactos, sellado contra fluidos y polvo (IP44).';
          area = 'URGENCIAS, UCI, CIRUGÍA Y AMBULANCIAS DE SOPORTE VITAL';
          sterilization = 'Desinfección de carcasa y palas con toallas con alcohol al 70% o solución desinfectante hospitalaria neutra.';
          warranty = '3 años de garantía en unidad principal y 1 año en batería y accesorios reusables.';
        } else if (isElectro) {
          desc = `Unidad electroquirúrgica de alta frecuencia para corte puro, corte mixto y coagulación monopolar y bipolar en cirugía especializada.`;
          characteristics = [
            'Sistema digital de retroalimentación de impedancia tisular para potencia constante.',
            'Monitoreo continuo de electrodo de retorno del paciente (sistema REM / CQM).',
            'Modos de corte puro, blend, coagulación por contacto y coagulación fulguración (spray).',
            'Salidas monopolares y bipolares con activación independiente por lápiz o pedal.',
            'Compatibilidad con instrumentos laparoscópicos y pinzas bipolares estándar.'
          ];
          func = 'Sección y hemostasia de tejidos biológicos mediante corrientes eléctricas de alta frecuencia durante intervenciones quirúrgicas.';
          mat = 'Chasis metálico con pintura electrostática y panel frontal en policarbonato médico impermeable sellado.';
          area = 'QUIRÓFANOS Y SALAS DE CIRUGÍA AMBULATORIA';
          sterilization = 'Limpieza de consola con paño humedecido con desinfectante no corrosivo. Accesorios esterilizables en autoclave.';
          warranty = '2 años de garantía con soporte técnico y verificación metrológica anual.';
        } else if (isVentilator) {
          desc = `Ventilador pulmonar mecánico de cuidados intensivos diseñado para brindar soporte ventilatorio invasivo y no invasivo en pacientes adultos, pediátricos y neonatales.`;
          characteristics = [
            'Turbina de alto rendimiento integrada que elimina la necesidad de compresor de aire externo.',
            'Modos ventilatorios avanzados: VCV, PCV, PRVC, PSV, SIMV, CPAP/BiPAP y ventilación no invasiva (VNI).',
            'Compensación automática de fugas y resistencia de tubo endotraqueal.',
            'Pantalla táctil a color de 12.1" con despliegue de bucles dinámicos presión-volumen y flujo-volumen.',
            'Batería interna recargable de respaldo con autonomía hasta de 6 horas continuas.',
            'Válvula espiratoria autoclavable integrada para prevención efectiva de infecciones cruzadas.'
          ];
          func = 'Soporte vital y asistencia respiratoria mecánica continua en insuficiencia respiratoria aguda y postoperatorio.';
          mat = 'Chasis en aleación de aluminio y polímeros médicos antibacteriales con grado de protección IP21.';
          area = 'UNIDAD DE CUIDADOS INTENSIVOS (UCI) ADULTOS, PEDIÁTRICA Y URGENCIAS';
          sterilization = 'Válvula espiratoria esterilizable en autoclave a 134°C. Sensores y superficies limpiables con paños desinfectantes.';
          warranty = '2 años de garantía de fábrica con calibración metrológica y soporte técnico nacional.';
        } else if (isInfusion) {
          desc = `Bomba de infusión volumétrica digital inteligente para la administración precisa, continua y controlada de fluidos intravenosos, medicamentos y nutrición parenteral.`;
          characteristics = [
            'Mecanismo de bombeo peristáltico lineal de alta precisión con error volumétrico inferior a ±5%.',
            'Biblioteca de fármacos preinstalada con límites de dosificación de seguridad (Dose Error Reduction System).',
            'Detección ultrasónica de burbujas de aire en línea y sensor de oclusión aguas arriba y abajo regulable.',
            'Pantalla LCD retroiluminada a color con visualización de tasa (ml/h), volumen infundido y tiempo restante.',
            'Batería de litio integrada con autonomía superior a 8 horas a velocidad estándar.',
            'Diseño modular apilable que permite interconexión rápida en torre de infusión.'
          ];
          func = 'Administración exacta y segura de medicamentos críticos, anestésicos, fluidos y soporte nutricional intravascular.';
          mat = 'Carcasa plástica médica de alta resistencia con protección IP34 contra salpicaduras de líquidos.';
          area = 'HOSPITALIZACIÓN, UCI, CIRUGÍA, PEDIATRÍA Y ONCOLOGÍA';
          sterilization = 'Desinfección superficial con toallas con amonios cuaternarios de quinta generación o alcohol al 70%.';
          warranty = '2 años de garantía con servicio de calibración volumétrica anual certificado.';
        } else if (isUltrasound) {
          desc = `Sistema de ultrasonido diagnóstico digital portátil de alta definición para exploración ecográfica multidisciplinaria en tiempo real.`;
          characteristics = [
            'Procesamiento digital de haz multifrecuencia con reducción de ruido speckle y armónicas de tejido.',
            'Modos de imagen: B, 2B, 4B, M, Doppler Color, Doppler Pulsado (PW), Doppler Poder y Doppler Tisular.',
            'Pantalla LED médica de alta resolución antirreflejo de 15 pulgadas con inclinación ajustable.',
            'Compatibilidad con transductores convexos, lineales, endocavitarios y microconvexos.',
            'Disco duro de estado sólido interno con exportación DICOM 3.0 para PACS hospitalario.',
            'Encendido ultra-rápido menor a 25 segundos y batería integrada de respaldo.'
          ];
          func = 'Evaluación diagnóstica no invasiva de órganos internos, flujo vascular y estructuras anatómicas en tiempo real.';
          mat = 'Estructura ultraligera de magnesio-aluminio con recubrimiento de polímeros sellados.';
          area = 'IMÁGENES DIAGNÓSTICAS, GINECOLOGÍA, RADIOLOGÍA, URGENCIAS Y UCI';
          sterilization = 'Transductores desinfectables con toallitas de alto nivel no alcohólicas o glutaraldehído según protocolo.';
          warranty = '2 años en consola y 1 año en transductores diagnósticos.';
        }

        return {
          description: desc,
          characteristics,
          function: func,
          material: mat,
          invimaRecordNumber: invima,
          hospitalArea: area,
          sterilization,
          storage,
          warranty,
          variants
        };
      };

      if (!ai) {
        return res.json({
          success: true,
          source: 'local_biomedical_engine',
          data: getBiomedicalFallback()
        });
      }

      const prompt = `Eres un Ingeniero Biomédico senior especialista en equipos médicos hospitalarios, instrumental quirúrgico, mobiliario clínico, dispositivos médicos e INVIMA para estructuración de fichas técnicas oficiales.
Investiga en internet las especificaciones reales, manuales técnicos y fichas técnicas oficiales del fabricante para el siguiente equipo o dispositivo:
- Nombre del Producto / Equipo: "${trimmedName}"
- Marca: "${trimmedBrand || 'Fabricante Biomédico'}"
- Modelo o Referencia: "${trimmedModel || 'Estándar'}"

Objetivo: Obtener la información técnica verídica, concisa, profesional y completa para elaborar la Ficha Técnica Oficial del producto en Colombia.

INSTRUCCIÓN DE RETORNO OBLIGATORIA:
Devuelve EXCLUSIVAMENTE un JSON válido (sin explicaciones ni markdown envolvente fuera del JSON) con los siguientes campos:
{
  "description": "Descripción técnica clara, concisa y profesional del equipo/dispositivo (1 a 2 párrafos cortos). Explica qué es, su principio de operación y su propósito clínico/quirúrgico.",
  "characteristics": [
    "5 a 8 características técnicas clave del equipo (materiales, resistencia, normas internacionales IEC/ISO, interfaces, precisión, etc.)"
  ],
  "function": "Función principal directa en quirófano, áreas asistenciales o central de esterilización.",
  "material": "Material exacto de fabricación certificado (ej: Acero Inoxidable ASIS 420/316, Polímero ABS de grado médico ignífugo, Titanio quirúrgico, etc.).",
  "invimaRecordNumber": "Registro Sanitario INVIMA sugerido o formato oficial colombiano (ej: 2024DM-0012345 o INVIMA 2021DM-0023456).",
  "hospitalArea": "Área hospitalaria o central recomendada (ej: CENTRAL DE ESTERILIZACIÓN Y QUIRÓFANO, UCI ADULTOS Y PEDIÁTRICA, URGENCIAS, etc.).",
  "sterilization": "Protocolo de esterilización o desinfección recomendado detallado.",
  "storage": "Condiciones de almacenamiento recomendadas (temperatura, humedad, empaque).",
  "warranty": "Garantía estándar (ej: 5 años contra defectos de fabricación / 2 años con soporte técnico oficial).",
  "variants": [
    { "code": "Medida o dimensión física real de la pieza (ej: 30 cm (Recta), 30 cm (Curva), 28 cm, 32 cm, etc.). REGLA VITAL: Genera entre 4 y 8 variantes o medidas hospitalarias/quirúrgicas. Si el nombre, descripción o modelo contiene una medida (ej: 30 cm o 14.5 cm), INCLUYE esa medida exacta con variantes Recta y Curva, y AGREGA más medidas complementarias del rango clínico estándar (ej: 24 cm, 26 cm, 28 cm, 32 cm, 35 cm o variaciones con garra/sin garra)", "size": "Tamaño / Longitud en cm y pulgadas", "dimensions": "Longitud y forma (ej: Longitud: 30 cm, Curva)", "description": "Aplicación clínica específica de cada medida" }
  ]
}`;

      try {
        let rawText = '';
        let sourceUsed = 'gemini_web_search';

        const withTimeout = <T>(promise: Promise<T>, ms = 6000): Promise<T> => {
          return Promise.race([
            promise,
            new Promise<T>((_, reject) => setTimeout(() => reject(new Error('AI Request timeout')), ms))
          ]);
        };

        // 1. First attempt: Use Google Search grounding on gemini-3.8-flash with timeout
        try {
          const response = await withTimeout(ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              tools: [{ googleSearch: {} }],
            }
          }), 7000);
          rawText = response.text || '';
        } catch (_groundingErr: any) {
          // If Google Search grounding is rate-limited, quota exceeded (e.g. 429), or times out,
          // gracefully fallback to direct lightweight model generation without search tools
          try {
            const fallbackResponse = await withTimeout(ai.models.generateContent({
              model: 'gemini-3.1-flash-lite',
              contents: prompt,
            }), 5000);
            rawText = fallbackResponse.text || '';
            sourceUsed = 'gemini_ai_knowledge';
          } catch (_modelErr: any) {
            // If Gemini models are also rate-limited / quota exhausted, smoothly return domain catalog data
            return res.json({
              success: true,
              source: 'local_biomedical_engine',
              data: getBiomedicalFallback()
            });
          }
        }

        if (rawText) {
          const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned);
          return res.json({
            success: true,
            source: sourceUsed,
            data: parsed
          });
        }

        return res.json({
          success: true,
          source: 'local_biomedical_fallback',
          data: getBiomedicalFallback()
        });
      } catch (_overallErr: any) {
        return res.json({
          success: true,
          source: 'local_biomedical_fallback',
          data: getBiomedicalFallback()
        });
      }
    } catch (err: any) {
      console.error('Unexpected error in /api/gemini/research-equipment-sheet:', err?.message || err);
      res.status(500).json({ error: err.message || 'Error researching equipment' });
    }
  });

  // Internet Image Search Helper: queries web sources for actual product photographs
  interface ProductImageSearchResult {
    title: string;
    url: string;
    thumbnail: string;
    width?: number;
    height?: number;
    source?: string;
  }

  // Curated high-definition hospital & surgical equipment photograph catalog
  const CURATED_BIOMEDICAL_IMAGES: Array<{
    keywords: string[];
    title: string;
    url: string;
    thumbnail: string;
    source: string;
  }> = [
    // Pinzas Quirúrgicas Atraumáticas - BABCOCK
    {
      keywords: ['pinza', 'babcock'],
      title: 'Pinza Babcock Quirúrgica Atraumática (16 cm / 18 cm / 20 cm)',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/41/Babcock.JPG/500px-Babcock.JPG',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/41/Babcock.JPG/500px-Babcock.JPG',
      source: 'Instrumental Quirúrgico Certificado'
    },
    {
      keywords: ['pinza', 'babcock'],
      title: 'Pinza Babcock Intestinal y Ginecológica Mandíbula Fenestrada Atraumática',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ac/Babcock%282%29.jpg/500px-Babcock%282%29.jpg',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ac/Babcock%282%29.jpg/500px-Babcock%282%29.jpg',
      source: 'Instrumental Quirúrgico Certificado'
    },

    // Pinzas de Tracción Tisular - ALLIS
    {
      keywords: ['pinza', 'allis'],
      title: 'Pinza Allis de Tracción Tisular con Dientes de Agarre Fino',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/76/Allis-Coakley_Tonsil_Forceps_of_Dr._John_Hersel_Gladney_-_DPLA_-_a4261f0460f3b9818d9c53cdbf9b647d_%28page_1%29.jpg/500px-Allis-Coakley_Tonsil_Forceps_of_Dr._John_Hersel_Gladney_-_DPLA_-_a4261f0460f3b9818d9c53cdbf9b647d_%28page_1%29.jpg',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/76/Allis-Coakley_Tonsil_Forceps_of_Dr._John_Hersel_Gladney_-_DPLA_-_a4261f0460f3b9818d9c53cdbf9b647d_%28page_1%29.jpg/500px-Allis-Coakley_Tonsil_Forceps_of_Dr._John_Hersel_Gladney_-_DPLA_-_a4261f0460f3b9818d9c53cdbf9b647d_%28page_1%29.jpg',
      source: 'Instrumental Quirúrgico Certificado'
    },

    // Pinza Backhaus (de Campo)
    {
      keywords: ['pinza', 'backhaus', 'campo'],
      title: 'Pinza Backhaus de Primer Campo Quirúrgico',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/29/Backhaus_clamp.svg/500px-Backhaus_clamp.svg.png',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/29/Backhaus_clamp.svg/500px-Backhaus_clamp.svg.png',
      source: 'Instrumental Quirúrgico Certificado'
    },

    // Pinzas de Disección Quirúrgica
    {
      keywords: ['pinza', 'diseccion', 'sin garra'],
      title: 'Pinza de Disección Quirúrgica Estándar Sin Garra (Acero Quirúrgico)',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/18/Medical_instrument_Plain_dissecting_forceps.jpg/500px-Medical_instrument_Plain_dissecting_forceps.jpg',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/18/Medical_instrument_Plain_dissecting_forceps.jpg/500px-Medical_instrument_Plain_dissecting_forceps.jpg',
      source: 'Instrumental Quirúrgico Certificado'
    },
    {
      keywords: ['pinza', 'diseccion', 'sin garra'],
      title: 'Pinza DeBakey Vascular Atrauma Sin Garra (14.5 cm / 20 cm)',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Debakey_forceps.jpg/500px-Debakey_forceps.jpg',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Debakey_forceps.jpg/500px-Debakey_forceps.jpg',
      source: 'Instrumental Quirúrgico Certificado'
    },
    {
      keywords: ['pinza', 'diseccion', 'sin garra'],
      title: 'Pinza Adson Anatómica Tisular Sin Dientes',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/25/Adson_forceps.svg/500px-Adson_forceps.svg.png',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/25/Adson_forceps.svg/500px-Adson_forceps.svg.png',
      source: 'Instrumental Quirúrgico Certificado'
    },
    {
      keywords: ['pinza', 'diseccion', 'con garra'],
      title: 'Pinza de Disección Quirúrgica Con Garra 1x2 Dientes (Dientes de Ratón)',
      url: 'https://lanrdistribuciones.com/wp-content/uploads/2023/02/PINZA-DE-DISECCION-ESTANDAR-CON-GARRA.-LONGITUD-14.5.jpg',
      thumbnail: 'https://lanrdistribuciones.com/wp-content/uploads/2023/02/PINZA-DE-DISECCION-ESTANDAR-CON-GARRA.-LONGITUD-14.5.jpg',
      source: 'Instrumental Quirúrgico Certificado'
    },
    {
      keywords: ['pinza', 'diseccion', 'con garra'],
      title: 'Pinza Adson Quirúrgica Con Garra 1x2 Dientes para Sutura',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/25/Adson_forceps.svg/500px-Adson_forceps.svg.png',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/25/Adson_forceps.svg/500px-Adson_forceps.svg.png',
      source: 'Instrumental Quirúrgico Certificado'
    },
    {
      keywords: ['pinza', 'diseccion'],
      title: 'Pinza de Disección Quirúrgica Estándar en Acero Inoxidable',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a4/Forceps.jpg/500px-Forceps.jpg',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a4/Forceps.jpg/500px-Forceps.jpg',
      source: 'Instrumental Quirúrgico Certificado'
    },
    {
      keywords: ['pinza', 'adson'],
      title: 'Pinza Adson Quirúrgica (Micro-disección Tisular)',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/25/Adson_forceps.svg/500px-Adson_forceps.svg.png',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/25/Adson_forceps.svg/500px-Adson_forceps.svg.png',
      source: 'Instrumental Quirúrgico Certificado'
    },
    {
      keywords: ['pinza', 'debakey'],
      title: 'Pinza DeBakey Vascular Atrauma',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Debakey_forceps.jpg/500px-Debakey_forceps.jpg',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Debakey_forceps.jpg/500px-Debakey_forceps.jpg',
      source: 'Instrumental Quirúrgico Certificado'
    },

    // Pinzas Hemostáticas (Kelly, Crile, Mosquito, Kocher)
    {
      keywords: ['pinza', 'kelly'],
      title: 'Pinza Hemostática Kelly Curva y Recta (14 cm / 16 cm)',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/Hemostats.jpg/500px-Hemostats.jpg',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/Hemostats.jpg/500px-Hemostats.jpg',
      source: 'Instrumental Quirúrgico Certificado'
    },
    {
      keywords: ['pinza', 'crile'],
      title: 'Pinza Hemostática Crile Curva y Recta',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/Hemostats.jpg/500px-Hemostats.jpg',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/Hemostats.jpg/500px-Hemostats.jpg',
      source: 'Instrumental Quirúrgico Certificado'
    },
    {
      keywords: ['pinza', 'mosquito', 'halsted'],
      title: 'Pinza Halsted Mosquito Micro-hemostática (12.5 cm)',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/Hemostats.jpg/500px-Hemostats.jpg',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/Hemostats.jpg/500px-Hemostats.jpg',
      source: 'Instrumental Quirúrgico Certificado'
    },
    {
      keywords: ['pinza', 'kocher'],
      title: 'Pinza Kocher Hemostática con Dientes de Tracción',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/49/Pinza_kocher.jpg/500px-Pinza_kocher.jpg',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/49/Pinza_kocher.jpg/500px-Pinza_kocher.jpg',
      source: 'Instrumental Quirúrgico Certificado'
    },
    {
      keywords: ['pinza', 'magill'],
      title: 'Pinza Magill para Intubación Endotraqueal',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e9/Magill_forceps_open.jpg/500px-Magill_forceps_open.jpg',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e9/Magill_forceps_open.jpg/500px-Magill_forceps_open.jpg',
      source: 'Instrumental Quirúrgico Certificado'
    },
    {
      keywords: ['pinza', 'hemostatica'],
      title: 'Pinzas Hemostáticas Quirúrgicas Variadas (Set de Quirófano)',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/Hemostats.jpg/500px-Hemostats.jpg',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/Hemostats.jpg/500px-Hemostats.jpg',
      source: 'Instrumental Quirúrgico Certificado'
    },

    // Porta Agujas
    {
      keywords: ['porta', 'aguja', 'hegar'],
      title: 'Porta Agujas Mayo-Hegar Quirúrgico',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/EB1911_Surgical_Instruments_-_Needle-holders.jpg/500px-EB1911_Surgical_Instruments_-_Needle-holders.jpg',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/EB1911_Surgical_Instruments_-_Needle-holders.jpg/500px-EB1911_Surgical_Instruments_-_Needle-holders.jpg',
      source: 'Instrumental Quirúrgico Certificado'
    },

    // Tijeras Quirúrgicas
    {
      keywords: ['tijera', 'metzenbaum'],
      title: 'Tijera Quirúrgica Metzenbaum Curva (Disección Tisular Profunda)',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8b/Metzenbaum_scissors.jpg/500px-Metzenbaum_scissors.jpg',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8b/Metzenbaum_scissors.jpg/500px-Metzenbaum_scissors.jpg',
      source: 'Instrumental Quirúrgico Certificado'
    },
    {
      keywords: ['tijera', 'metzembaum'],
      title: 'Tijera Metzenbaum Curva en Acero Alemán',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8b/Metzenbaum_scissors.jpg/500px-Metzenbaum_scissors.jpg',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8b/Metzenbaum_scissors.jpg/500px-Metzenbaum_scissors.jpg',
      source: 'Instrumental Quirúrgico Certificado'
    },
    {
      keywords: ['tijera', 'mayo'],
      title: 'Tijera Quirúrgica Mayo Curva y Recta (Corte de Fascias y Material)',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/82/Mayo_surgical_scissors.jpg/500px-Mayo_surgical_scissors.jpg',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/82/Mayo_surgical_scissors.jpg/500px-Mayo_surgical_scissors.jpg',
      source: 'Instrumental Quirúrgico Certificado'
    },
    {
      keywords: ['tijera'],
      title: 'Tijera Quirúrgica de Disección en Acero Inoxidable',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8b/Metzenbaum_scissors.jpg/500px-Metzenbaum_scissors.jpg',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8b/Metzenbaum_scissors.jpg/500px-Metzenbaum_scissors.jpg',
      source: 'Instrumental Quirúrgico Certificado'
    },

    // Mangos de Bisturí y Cuchillas
    {
      keywords: ['mango', 'bisturi'],
      title: 'Mango de Bisturí No. 3 / No. 4 con Escala Milimétrica',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/Bisturi_Tacca_Millimetrata.jpg/500px-Bisturi_Tacca_Millimetrata.jpg',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/Bisturi_Tacca_Millimetrata.jpg/500px-Bisturi_Tacca_Millimetrata.jpg',
      source: 'Instrumental Quirúrgico Certificado'
    },
    {
      keywords: ['bisturi'],
      title: 'Bisturí Quirúrgico con Hoja de Precisión',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/Bisturi_Tacca_Millimetrata.jpg/500px-Bisturi_Tacca_Millimetrata.jpg',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/Bisturi_Tacca_Millimetrata.jpg/500px-Bisturi_Tacca_Millimetrata.jpg',
      source: 'Instrumental Quirúrgico Certificado'
    },

    // Separadores y Retractores
    {
      keywords: ['separador', 'farabeuf'],
      title: 'Juego de Separadores Farabeuf en Acero Inoxidable',
      url: 'https://solucionesmedicas.com.gt/wp-content/uploads/2023/03/71.-Separador-de-farabeuf-1-600x600.png',
      thumbnail: 'https://solucionesmedicas.com.gt/wp-content/uploads/2023/03/71.-Separador-de-farabeuf-1-600x600.png',
      source: 'Instrumental Quirúrgico Certificado'
    },

    // Equipos Biomédicos de Quirófano y UCI
    {
      keywords: ['electrobisturi'],
      title: 'Generador Electroquirúrgico / Electrobisturí Monopolar y Bipolar',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/14/Electrosurgery.jpg/500px-Electrosurgery.jpg',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/14/Electrosurgery.jpg/500px-Electrosurgery.jpg',
      source: 'Equipos Biomédicos Hospitalarios'
    },
    {
      keywords: ['unidad', 'electroquirurgica'],
      title: 'Unidad Electroquirúrgica para Quirófano',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/14/Electrosurgery.jpg/500px-Electrosurgery.jpg',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/14/Electrosurgery.jpg/500px-Electrosurgery.jpg',
      source: 'Equipos Biomédicos Hospitalarios'
    },
    {
      keywords: ['monitor', 'signos', 'vitales'],
      title: 'Monitor de Signos Vitales Hospitalario con Pantalla Digital',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/10/Hospital_Patient_Monitor_%2817239884329%29.jpg/500px-Hospital_Patient_Monitor_%2817239884329%29.jpg',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/10/Hospital_Patient_Monitor_%2817239884329%29.jpg/500px-Hospital_Patient_Monitor_%2817239884329%29.jpg',
      source: 'Equipos Biomédicos Hospitalarios'
    },
    {
      keywords: ['monitor', 'multiparametros'],
      title: 'Monitor Multiparámetros Hospitalario (ECG, SpO2, PNI, Temp)',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/10/Hospital_Patient_Monitor_%2817239884329%29.jpg/500px-Hospital_Patient_Monitor_%2817239884329%29.jpg',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/10/Hospital_Patient_Monitor_%2817239884329%29.jpg/500px-Hospital_Patient_Monitor_%2817239884329%29.jpg',
      source: 'Equipos Biomédicos Hospitalarios'
    },
    {
      keywords: ['desfibrilador'],
      title: 'Desfibrilador Bifásico Hospitalario con Monitor y Marcapasos',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b4/AED_machine_medisource.jpg/500px-AED_machine_medisource.jpg',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b4/AED_machine_medisource.jpg/500px-AED_machine_medisource.jpg',
      source: 'Equipos Biomédicos Hospitalarios'
    },
    {
      keywords: ['bomba', 'infusion'],
      title: 'Bomba de Infusión Volumétrica Digital Continua',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ed/Infusionspumpe.JPG/500px-Infusionspumpe.JPG',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ed/Infusionspumpe.JPG/500px-Infusionspumpe.JPG',
      source: 'Equipos Biomédicos Hospitalarios'
    },
    {
      keywords: ['laringoscopio'],
      title: 'Juego de Laringoscopio con Hojas Macintosh y Miller',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/36/Glidescope_02.JPG/500px-Glidescope_02.JPG',
      thumbnail: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/36/Glidescope_02.JPG/500px-Glidescope_02.JPG',
      source: 'Equipos Biomédicos Hospitalarios'
    }
  ];

  async function searchInternetProductImages(query: string): Promise<ProductImageSearchResult[]> {
    const rawClean = query.replace(/[^\w\s\-\.áéíóúÁÉÍÓÚñÑ]/gi, ' ').trim();
    if (!rawClean) return [];

    const cleanNorm = (str: string) => (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const lowerQuery = cleanNorm(rawClean);
    const results: ProductImageSearchResult[] = [];
    const seenUrls = new Set<string>();

    const addResult = (item: ProductImageSearchResult) => {
      const u = item.url || item.thumbnail;
      if (!u || seenUrls.has(u)) return;
      // Strictly ignore PDFs, DJVU, TIFF, video, audio
      const uLower = u.toLowerCase();
      if (
        uLower.endsWith('.pdf') ||
        uLower.endsWith('.djvu') ||
        uLower.endsWith('.tif') ||
        uLower.endsWith('.tiff') ||
        uLower.endsWith('.webm') ||
        uLower.endsWith('.mp4') ||
        uLower.endsWith('.ogg') ||
        uLower.endsWith('.ogv')
      ) {
        return;
      }
      seenUrls.add(u);
      results.push(item);
    };

    // 1. TIER 1: Match against Curated Biomedical & Surgical Photographic Catalog
    const hasConGarra = lowerQuery.includes('con garra') || lowerQuery.includes('con dientes');
    const hasSinGarra = lowerQuery.includes('sin garra') || lowerQuery.includes('sin dientes');
    const isSeparador = lowerQuery.includes('separador') || lowerQuery.includes('retractor') || lowerQuery.includes('farabeuf');

    // Specific surgical families to prevent cross-contamination (e.g. Babcock must never return dissection or Kelly forceps)
    const PINZA_SPECIFIC_FAMILIES = [
      'babcock', 'allis', 'kocher', 'adson', 'debakey', 'kelly', 'crile', 
      'mosquito', 'halsted', 'foerster', 'backhaus', 'pozzi', 'tenaculo', 
      'magill', 'duval', 'rusa', 'russian', 'rochester', 'pean', 'diseccion'
    ];

    const TIJERA_SPECIFIC_FAMILIES = [
      'metzenbaum', 'metzembaum', 'mayo', 'iris', 'potts', 'castroviejo', 'lister'
    ];

    const queryPinzaFamily = PINZA_SPECIFIC_FAMILIES.find((f) => lowerQuery.includes(f));
    const queryTijeraFamily = TIJERA_SPECIFIC_FAMILIES.find((f) => lowerQuery.includes(f));

    const scoredCurated = CURATED_BIOMEDICAL_IMAGES.map((entry) => {
      const entryText = cleanNorm(entry.keywords.join(' ') + ' ' + entry.title);

      // If query asked for separador/retractor, do not match clamps or electrocautery
      if (isSeparador) {
        const isEntrySeparador = entry.keywords.includes('separador') || entryText.includes('separador') || entryText.includes('farabeuf');
        if (!isEntrySeparador) {
          return { entry, score: -100 };
        }
      }

      // If query asked for a specific pinza family (like 'babcock'), reject anything that does not match it
      if (queryPinzaFamily) {
        const entryHasFamily = entry.keywords.includes(queryPinzaFamily) || entryText.includes(queryPinzaFamily);
        if (!entryHasFamily) {
          return { entry, score: -100 };
        }
      }

      // If query asked for a specific scissors family (like 'metzenbaum'), reject anything that does not match it
      if (queryTijeraFamily) {
        const normFamily = queryTijeraFamily === 'metzembaum' ? 'metzenbaum' : queryTijeraFamily;
        const entryHasFamily = entry.keywords.includes(normFamily) || entryText.includes(normFamily);
        if (!entryHasFamily) {
          return { entry, score: -100 };
        }
      }

      // Exclude if contradictory garra / sin garra
      const entryIsSinGarra = entry.keywords.includes('sin garra') || entryText.includes('sin garra') || entryText.includes('sin dientes');
      const entryIsConGarra = entry.keywords.includes('con garra') || entryText.includes('con garra') || entryText.includes('con dientes');

      if (hasConGarra && entryIsSinGarra) return { entry, score: -100 };
      if (hasSinGarra && entryIsConGarra) return { entry, score: -100 };

      let score = 0;
      for (const rawKw of entry.keywords) {
        const kw = cleanNorm(rawKw);
        if (lowerQuery.includes(kw)) {
          if (queryPinzaFamily && kw === queryPinzaFamily) score += 30;
          else if (queryTijeraFamily && (kw === queryTijeraFamily || kw.includes('metzen'))) score += 30;
          else if (kw === 'farabeuf') score += 40;
          else if (kw === 'pinza' || kw === 'tijera') score += 2;
          else score += 4;
        }
      }
      if (hasConGarra && entryIsConGarra) score += 15;
      if (hasSinGarra && entryIsSinGarra) score += 15;

      return { entry, score };
    })
      .filter((item) => item.score >= 4)
      .sort((a, b) => b.score - a.score);

    for (const item of scoredCurated) {
      addResult({
        title: item.entry.title,
        url: item.entry.url,
        thumbnail: item.entry.thumbnail,
        source: item.entry.source
      });
    }

    // 2. TIER 2: Query Wikipedia Medical PageImages API (Spanish and English)
    // Extract core product name (e.g. "pinza babcock", "pinza de diseccion con garra", "tijera metzenbaum")
    const simplifiedTerms = lowerQuery
      .replace(/\b(daddy d pro|daddy|cm|mm|pulgadas|ref|modelo|marca)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Blacklist of non-medical keywords that appear in generic searches
    const NON_MEDICAL_BLACKLIST = [
      'wisconsin', 'baseball', 'park', 'postoffice', 'sign', 'crater', 'university', 'ranch',
      'theatre', 'monument', 'portrait', 'church', 'iglesia', 'rio', 'lake', 'valle', 'valley',
      'building', 'edificio', 'calle', 'street', 'bridge', 'cranberries', 'spray', 'plant',
      'flower', 'station', 'train', 'aircraft', 'ship', 'cangrejo', 'igrexa', 'clothe',
      'spaghetti', 'vapor', 'engine', 'nephropidae', 'precios', 'irresponsable', 'tomo',
      'deboning', 'fish', 'dissertation', 'operating room', 'quirofano', 'cirujano', 'hijab',
      'piedra, papel', 'puertas de tijera', 'juana diaz', 'uprising', 'dos de mayo', 'murcielago',
      'lamborghini', 'egagropila', 'opabinia', 'tumba de kha', 'household'
    ];

    if (results.length < 3) {
      const bestTerm = simplifiedTerms || rawClean;
      try {
        // Search Spanish Wikipedia PageImages
        const esWikiUrl = `https://es.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
          bestTerm
        )}&prop=pageimages&pithumbsize=600&format=json&origin=*`;
        const esRes = await fetch(esWikiUrl, { signal: AbortSignal.timeout(2500) });
        if (esRes.ok) {
          const esData = await esRes.json();
          if (esData.query && esData.query.pages) {
            for (const pid of Object.keys(esData.query.pages)) {
              const p = esData.query.pages[pid];
              const thumb = p.thumbnail?.source;
              const titleNorm = cleanNorm(p.title || '');
              if (!thumb) continue;

              if (NON_MEDICAL_BLACKLIST.some((bl) => titleNorm.includes(bl))) continue;

              // Must be an actual medical / surgical instrument or hospital equipment
              const isSpanishMedical =
                titleNorm.includes('pinza') ||
                titleNorm.includes('tijera') ||
                titleNorm.includes('separador') ||
                titleNorm.includes('retractor') ||
                titleNorm.includes('bisturi') ||
                titleNorm.includes('portaagujas') ||
                titleNorm.includes('porta agujas') ||
                titleNorm.includes('monitor') ||
                titleNorm.includes('desfibrilador') ||
                titleNorm.includes('electrobisturi') ||
                titleNorm.includes('biomedic') ||
                titleNorm.includes('quirurgic');
              if (!isSpanishMedical) continue;

              // Must have semantic relevance to query
              if (queryPinzaFamily && !titleNorm.includes(queryPinzaFamily) && !titleNorm.includes('pinza')) {
                continue;
              }
              if (queryTijeraFamily) {
                const normTijera = queryTijeraFamily === 'metzembaum' ? 'metzenbaum' : queryTijeraFamily;
                if (!titleNorm.includes(normTijera)) continue;
              }
              if (isSeparador && !titleNorm.includes('separador') && !titleNorm.includes('farabeuf') && !titleNorm.includes('retractor')) {
                continue;
              }

              addResult({
                title: `${p.title} (Instrumental / Equipo Médico)`,
                url: thumb,
                thumbnail: thumb,
                source: 'Wikipedia Médica'
              });
              if (results.length >= 8) break;
            }
          }
        }
      } catch (_esErr) {
        // Non-blocking
      }
    }

    // 3. TIER 3: English Wikipedia Medical PageImages (e.g., Babcock forceps, Forceps, Metzenbaum scissors)
    if (results.length < 8) {
      // Map common Spanish surgical instrument terms to English
      let engTerm = simplifiedTerms;
      if (lowerQuery.includes('babcock')) engTerm = 'babcock forceps';
      else if (lowerQuery.includes('allis')) engTerm = 'allis clamp';
      else if (lowerQuery.includes('kocher')) engTerm = 'kocher forceps';
      else if (lowerQuery.includes('adson')) engTerm = 'adson forceps';
      else if (lowerQuery.includes('debakey')) engTerm = 'debakey forceps';
      else if (lowerQuery.includes('kelly')) engTerm = 'kelly forceps';
      else if (lowerQuery.includes('crile')) engTerm = 'crile forceps';
      else if (lowerQuery.includes('mosquito') || lowerQuery.includes('halsted')) engTerm = 'halsted mosquito forceps';
      else if (lowerQuery.includes('foerster') || lowerQuery.includes('esponja')) engTerm = 'sponge forceps';
      else if (lowerQuery.includes('backhaus') || lowerQuery.includes('campo')) engTerm = 'towel clamp';
      else if (lowerQuery.includes('porta') && lowerQuery.includes('aguja')) engTerm = 'needle holder';
      else if (lowerQuery.includes('pinza') && lowerQuery.includes('diseccion')) engTerm = 'dissecting forceps';
      else if (lowerQuery.includes('pinza') && lowerQuery.includes('hemostatica')) engTerm = 'hemostat';
      else if (lowerQuery.includes('pinza') && lowerQuery.includes('garra')) engTerm = 'tissue forceps';
      else if (lowerQuery.includes('pinza')) engTerm = 'surgical forceps';
      else if (lowerQuery.includes('tijera') && lowerQuery.includes('metzen')) engTerm = 'metzenbaum scissors';
      else if (lowerQuery.includes('tijera') && lowerQuery.includes('mayo')) engTerm = 'mayo scissors';
      else if (lowerQuery.includes('tijera')) engTerm = 'surgical scissors';
      else if (lowerQuery.includes('bisturi')) engTerm = 'scalpel surgical';
      else if (lowerQuery.includes('separador') || lowerQuery.includes('farabeuf')) engTerm = 'surgical retractor';
      else if (lowerQuery.includes('cama') && lowerQuery.includes('hospital')) engTerm = 'hospital bed';
      else if (lowerQuery.includes('monitor')) engTerm = 'hospital patient monitor';
      else if (lowerQuery.includes('desfibrilador')) engTerm = 'defibrillator';

      try {
        const enWikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
          engTerm
        )}&prop=pageimages&pithumbsize=500&format=json&origin=*`;
        const enRes = await fetch(enWikiUrl, { signal: AbortSignal.timeout(4000) });
        if (enRes.ok) {
          const enData = await enRes.json();
          if (enData.query && enData.query.pages) {
            for (const pid of Object.keys(enData.query.pages)) {
              const p = enData.query.pages[pid];
              const thumb = p.thumbnail?.source;
              const titleNorm = cleanNorm(p.title || '');
              if (!thumb) continue;

              if (NON_MEDICAL_BLACKLIST.some((bl) => titleNorm.includes(bl))) continue;

              // Must be an actual medical instrument / equipment
              const isEnglishMedical =
                titleNorm.includes('forceps') ||
                titleNorm.includes('clamp') ||
                titleNorm.includes('hemostat') ||
                titleNorm.includes('scissors') ||
                titleNorm.includes('retractor') ||
                titleNorm.includes('scalpel') ||
                titleNorm.includes('needle holder') ||
                titleNorm.includes('patient monitor') ||
                titleNorm.includes('defibrillator') ||
                titleNorm.includes('electrosurgery') ||
                titleNorm.includes('surgical instrument');
              if (!isEnglishMedical) continue;

              // Cross family checks
              if (queryPinzaFamily && !titleNorm.includes('forceps') && !titleNorm.includes('clamp') && !titleNorm.includes('hemostat') && !titleNorm.includes(queryPinzaFamily)) {
                continue;
              }
              if (queryTijeraFamily) {
                const normTijera = queryTijeraFamily === 'metzembaum' ? 'metzenbaum' : queryTijeraFamily;
                if (!titleNorm.includes(normTijera) && !titleNorm.includes('scissors')) continue;
                if (normTijera === 'mayo' && titleNorm.includes('metzenbaum')) continue;
                if (normTijera === 'metzenbaum' && titleNorm.includes('mayo')) continue;
              }
              if (isSeparador && !titleNorm.includes('retractor') && !titleNorm.includes('farabeuf')) {
                continue;
              }

              addResult({
                title: `${p.title} - Surgical Instrument / Medical Equipment`,
                url: thumb,
                thumbnail: thumb,
                source: 'Biblioteca Médica Internacional'
              });
              if (results.length >= 14) break;
            }
          }
        }
      } catch (_enErr) {
        // Non-blocking
      }
    }

    // 4. TIER 4: Wikimedia Commons Search WITH STRICT SURGICAL & MEDICAL BITMAP FILTERING
    if (results.length < 6) {
      try {
        // Suffix with surgical/medical keywords to avoid geographical/natural false matches
        let commonsQuery = (simplifiedTerms || rawClean).replace(/\s+/g, ' ');
        if (!commonsQuery.toLowerCase().includes('forceps') && !commonsQuery.toLowerCase().includes('surgical') && !commonsQuery.toLowerCase().includes('medical') && !commonsQuery.toLowerCase().includes('instrument')) {
          if (queryPinzaFamily) {
            commonsQuery = `${queryPinzaFamily} forceps`;
          } else if (queryTijeraFamily) {
            commonsQuery = `${queryTijeraFamily} scissors`;
          } else if (isSeparador) {
            commonsQuery = 'Farabeuf retractor';
          } else {
            commonsQuery = `${commonsQuery} surgical instrument`;
          }
        }

        const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
          commonsQuery + ' filetype:bitmap'
        )}&gsrnamespace=6&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=500&format=json&origin=*`;
        const wikiRes = await fetch(wikiUrl, { signal: AbortSignal.timeout(5000) });
        if (wikiRes.ok) {
          const wikiData = await wikiRes.json();
          if (wikiData.query && wikiData.query.pages) {
            for (const pageId of Object.keys(wikiData.query.pages)) {
              const page = wikiData.query.pages[pageId];
              const info = page.imageinfo && page.imageinfo[0];
              const rawTitle = page.title || '';
              const titleLower = rawTitle.toLowerCase();

              // Strictly exclude PDFs, non-images, and blacklisted non-medical keywords
              if (NON_MEDICAL_BLACKLIST.some((bl) => titleLower.includes(bl))) continue;
              if (titleLower.endsWith('.pdf') || titleLower.endsWith('.djvu') || titleLower.includes('manual') || titleLower.includes('revista')) continue;

              if (queryPinzaFamily && !titleLower.includes('forceps') && !titleLower.includes('clamp') && !titleLower.includes(queryPinzaFamily)) {
                continue;
              }

              if (info && info.thumburl && info.mime && info.mime.startsWith('image/') && !info.mime.includes('tiff')) {
                addResult({
                  title: rawTitle.replace(/^File:/i, '').replace(/\.[a-zA-Z0-9]+$/, ''),
                  url: info.url || info.thumburl,
                  thumbnail: info.thumburl,
                  width: info.width,
                  height: info.height,
                  source: 'Wikimedia Commons (Fotografía Médica)'
                });
                if (results.length >= 16) break;
              }
            }
          }
        }
      } catch (wikiErr: any) {
        console.warn('Wikimedia image search warning:', wikiErr?.message || wikiErr);
      }
    }

    return results;
  }

  // API endpoint: Search Internet for product images by name, brand, model
  app.post('/api/products/search-images', async (req, res) => {
    try {
      const { query, equipmentName, brand, model } = req.body;
      const finalQuery = (query || [equipmentName, brand, model].filter(Boolean).join(' ')).trim();
      if (!finalQuery) {
        return res.status(400).json({ error: 'Query or equipmentName is required' });
      }
      const images = await searchInternetProductImages(finalQuery);
      return res.json({ success: true, query: finalQuery, images });
    } catch (err: any) {
      console.error('Error in POST /api/products/search-images:', err?.message || err);
      return res.status(200).json({ success: false, images: [], error: err.message });
    }
  });

  app.get('/api/products/search-images', async (req, res) => {
    try {
      const q = (req.query.q as string || '').trim();
      if (!q) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }
      const images = await searchInternetProductImages(q);
      return res.json({ success: true, query: q, images });
    } catch (err: any) {
      return res.status(200).json({ success: false, images: [], error: err.message });
    }
  });

  // API endpoint: Convert any web image URL to clean Base64 to avoid CORS and PDF export issues
  app.post('/api/proxy-image', async (req, res) => {
    try {
      let { url } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Image URL is required' });
      }
      // If already a Data URL, return immediately
      if (url.startsWith('data:')) {
        return res.json({ success: true, dataUrl: url });
      }

      // Wikimedia compatibility: normalize /800px- to allowed /500px- size
      if (url.includes('wikimedia.org') && url.includes('/800px-')) {
        url = url.replace(/\/800px-/, '/500px-');
      }

      const fetchCandidate = async (target: string): Promise<Response> => {
        return await fetch(target, {
          headers: {
            'User-Agent': 'SydColombiaBiomedicalApp/1.0 (https://sydcolombia.com; contact@sydcolombia.com)',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
          },
          signal: AbortSignal.timeout(9000)
        });
      };

      let imgRes: Response | null = null;
      try {
        imgRes = await fetchCandidate(url);
      } catch (_e) {
        // Continue to fallbacks
      }

      // If status 400/404 or failed and URL is from Wikimedia, try fallback variations
      if ((!imgRes || !imgRes.ok) && url.includes('wikimedia.org')) {
        // 1. Try 500px thumb
        const alt500 = url.replace(/\/\d+px-/, '/500px-');
        if (alt500 !== url) {
          try {
            const retry500 = await fetchCandidate(alt500);
            if (retry500.ok) imgRes = retry500;
          } catch (_e) {
            // Ignore
          }
        }

        // 2. Try direct original file without /thumb/
        if (!imgRes || !imgRes.ok) {
          const match = url.match(/wikimedia\.org\/wikipedia\/commons\/thumb\/([a-z0-9]+\/[a-z0-9]+\/[^/]+)/i);
          if (match && match[1]) {
            try {
              const directUrl = `https://upload.wikimedia.org/wikipedia/commons/${match[1]}`;
              const retryDirect = await fetchCandidate(directUrl);
              if (retryDirect.ok) imgRes = retryDirect;
            } catch (_e) {
              // Ignore
            }
          }
        }
      }

      if (!imgRes || !imgRes.ok) {
        // Return soft failure without throwing a 500/400 exception
        return res.status(200).json({
          success: false,
          error: `Could not fetch image: status ${imgRes ? imgRes.status : 'network error'}`
        });
      }

      const rawContentType = imgRes.headers.get('content-type') || 'image/jpeg';
      const contentType = rawContentType.split(';')[0].trim();
      const arrayBuffer = await imgRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${contentType};base64,${base64}`;
      return res.json({ success: true, dataUrl, contentType, size: buffer.length });
    } catch (err: any) {
      return res.status(200).json({ success: false, error: err?.message || 'Error processing image' });
    }
  });

  app.get('/api/proxy-image', async (req, res) => {
    try {
      let targetUrl = req.query.url as string;
      if (!targetUrl) {
        return res.status(400).send('Target URL is required');
      }
      if (targetUrl.includes('wikimedia.org') && targetUrl.includes('/800px-')) {
        targetUrl = targetUrl.replace(/\/800px-/, '/500px-');
      }
      const imgRes = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'SydColombiaBiomedicalApp/1.0 (https://sydcolombia.com; contact@sydcolombia.com)',
          'Accept': 'image/*,*/*'
        },
        signal: AbortSignal.timeout(10000)
      });
      if (!imgRes.ok) {
        return res.status(imgRes.status).send('Could not fetch target image');
      }
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const arrayBuffer = await imgRes.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    } catch (_err: any) {
      return res.status(500).send('Error streaming proxied image');
    }
  });

  function getBiomedicalHeuristicDescription(trimmed: string): string {
    const lower = trimmed.toLowerCase();
    if (lower.includes('monitor') || lower.includes('signos vitales') || lower.includes('multiparámetro') || lower.includes('epm') || lower.includes('ipm') || lower.includes('beneview')) {
      return 'Monitor multiparámetro de alta precisión para visualización continua de signos vitales en áreas hospitalarias y cuidados críticos.';
    } else if (lower.includes('electrobisturi') || lower.includes('electrocirug') || lower.includes('bovie') || lower.includes('aaron')) {
      return 'Unidad electroquirúrgica de alta frecuencia para corte y coagulación en procedimientos quirúrgicos especializados.';
    } else if (lower.includes('desfibrilador') || lower.includes('dea') || lower.includes('beneheart')) {
      return 'Desfibrilador / monitor bifásico para reanimación cardiopulmonar y cardioversión en urgencias y UCI.';
    } else if (lower.includes('electrocardiog') || lower.includes('ecg') || lower.includes('ekg') || lower.includes('beneheart r3')) {
      return 'Electrocardiógrafo digital de alta resolución para adquisición, análisis y registro de 12 derivaciones estándar.';
    } else if (lower.includes('ecografo') || lower.includes('ultrasonido') || lower.includes('m6') || lower.includes('dc-40') || lower.includes('consola')) {
      return 'Sistema de ultrasonido diagnóstico de alto rendimiento con procesamiento avanzado de imagen y transductores multifrecuencia.';
    } else if (lower.includes('ventilador') || lower.includes('respirador') || lower.includes('sv300') || lower.includes('synovent')) {
      return 'Ventilador mecánico para soporte respiratorio invasivo y no invasivo en pacientes neonatales, pediátricos y adultos.';
    } else if (lower.includes('bomba de infusion') || lower.includes('infusion') || lower.includes('sk-600') || lower.includes('benefusion')) {
      return 'Bomba de infusión volumétrica de alta precisión con sistema de seguridad para administración intravenosa de fluidos y medicamentos.';
    } else if (lower.includes('laringoscopio') || lower.includes('valva') || lower.includes('fibra optica')) {
      return 'Dispositivo de intubación endotraqueal e inspección de vía aérea con hojas intercambiables y tecnología de iluminación LED/fibra óptica.';
    } else if (lower.includes('tensiometro') || lower.includes('brazalete') || lower.includes('aneroide')) {
      return 'Instrumento de diagnóstico no invasivo para medición precisa de la presión arterial en pacientes pediátricos y adultos.';
    } else if (lower.includes('fonendoscopio') || lower.includes('estetoscopio') || lower.includes('littmann')) {
      return 'Instrumento acústico médico de alta sensibilidad para auscultación cardíaca, pulmonar y vascular en consulta clínica.';
    } else if (lower.includes('otoscopio') || lower.includes('oftalmoscopio') || lower.includes('diagnostico')) {
      return 'Equipo de diagnóstico para examen e inspección visual de alta definición de cavidades y estructuras anatómicas.';
    } else if (lower.includes('pinza') || lower.includes('tijera') || lower.includes('instrumental') || lower.includes('portaagujas') || lower.includes('cureta')) {
      return 'Instrumental quirúrgico de acero inoxidable de alta durabilidad para procedimientos médicos especializados y cirugía general.';
    } else if (lower.includes('incubadora') || lower.includes('servocuna') || lower.includes('calor radiante')) {
      return 'Sistema neonatal de microambiente térmico controlado con servocontrol de temperatura y humedad para recién nacidos críticos.';
    } else if (lower.includes('fetal') || lower.includes('tocografo') || lower.includes('cardiotocografo')) {
      return 'Monitor fetal para registro continuo de frecuencia cardíaca fetal y actividad uterina materna durante el embarazo y parto.';
    } else if (lower.includes('mesa') || lower.includes('camilla') || lower.includes('cama') || lower.includes('quirurgica')) {
      return 'Mobiliario clínico ergonómico con accionamiento de alta resistencia para procedimientos médicos y confort del paciente.';
    } else if (lower.includes('lampara') || lower.includes('cialitica')) {
      return 'Lámpara de examinación / quirúrgica de tecnología LED con campo de iluminación homogéneo y control de intensidad.';
    } else if (lower.includes('autoclave') || lower.includes('esterilizador')) {
      return 'Equipo de esterilización por vapor de agua con ciclos programados para instrumental médico y quirúrgico.';
    } else if (lower.includes('aspirador') || lower.includes('succion')) {
      return 'Unidad de aspiración quirúrgica continua de alto vacío y caudal para recolección de fluidos clínicos.';
    }
    return '';
  }

  // API endpoint: Fetch automatic brief commercial/technical description from Internet / Gemini
  app.post('/api/gemini/equipment-description', async (req, res) => {
    try {
      const { equipmentName, brand, model } = req.body;
      if (!equipmentName || typeof equipmentName !== 'string' || equipmentName.trim().length < 3) {
        return res.json({ found: false, description: '' });
      }

      // Check if the input looks like nonsense / gibberish (e.g. "ajjaja", "sadsdasad", "123", "asdasd")
      const trimmed = equipmentName.trim();
      const isRepeatedOrJunk = /^([a-zA-Z])\1{2,}$/i.test(trimmed) || /^(asdf|jaja|test|prueba|1234|qwerty)/i.test(trimmed);
      if (isRepeatedOrJunk) {
        return res.json({ found: false, description: '' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        const fallbackDesc = getBiomedicalHeuristicDescription(trimmed);
        if (fallbackDesc) {
          return res.json({ found: true, description: fallbackDesc });
        }
        return res.json({ found: false, description: '' });
      }

      const prompt = `Eres un Ingeniero Biomédico y especialista en catálogo de dispositivos médicos para SYD Colombia.
Analiza la siguiente información ingresada:
- Nombre: "${trimmed}"
- Marca: "${brand || ''}"
- Modelo: "${model || ''}"

Instrucciones:
1. Evalúa si el texto corresponde a un equipo médico, dispositivo clínico, instrumental o tecnología hospitalaria REAL (por ejemplo: monitores de signos vitales, electrocardiógrafos, electrobisturís, desfibriladores, ecógrafos, ventiladores mecánicos, bombas de infusión, lámparas cialíticas, mesas quirúrgicas, etc.).
2. Si ES un equipo médico reconocible:
   - "found": true
   - "description": Redacta una descripción comercial y técnica breve, profesional y precisa (1 o máximo 2 oraciones, no más de 170 caracteres), destacando su aplicación clínica principal y tecnología destacada.
3. Si NO es un equipo médico, o si el texto es texto de prueba, letras al azar (ej: "ajjaja", "sadsdasad", "zzz"), o no existe certeza clínica de qué es:
   - "found": false
   - "description": "" (cadena totalmente vacía).

Devuelve EXCLUSIVAMENTE un objeto JSON válido:
{
  "found": true,
  "description": "Monitor multiparámetro de alta precisión para visualización continua de signos vitales en áreas de hospitalización y cuidados críticos."
}`;

      let responseText = '{}';
      try {
        responseText = await generateWithModelFallback(ai, prompt);
      } catch (geminiError: any) {
        console.warn('Gemini description capacity fallback triggered:', geminiError?.message || geminiError);
        const fallbackDesc = getBiomedicalHeuristicDescription(trimmed);
        if (fallbackDesc) {
          return res.json({ found: true, description: fallbackDesc });
        }
        return res.json({ found: false, description: '' });
      }

      try {
        const parsedData = JSON.parse(responseText);
        const hasValidDesc = Boolean(parsedData.found && parsedData.description && parsedData.description.trim() !== '');
        if (hasValidDesc) {
          return res.json({
            found: true,
            description: parsedData.description.trim(),
          });
        }
      } catch (parseErr) {
        console.warn('Error parsing Gemini description response:', parseErr);
      }

      // Check heuristic as safety net
      const fallbackDesc = getBiomedicalHeuristicDescription(trimmed);
      if (fallbackDesc) {
        return res.json({ found: true, description: fallbackDesc });
      }

      return res.json({ found: false, description: '' });
    } catch (err: any) {
      console.warn('Error handling equipment description request:', err?.message || err);
      const fallbackDesc = getBiomedicalHeuristicDescription(req.body?.equipmentName || '');
      if (fallbackDesc) {
        return res.json({ found: true, description: fallbackDesc });
      }
      return res.json({ found: false, description: '' });
    }
  });

  // API endpoint: Extract Tender Contract Data from Image / Photo (OCR with Gemini Vision)
  app.post('/api/gemini/extract-contract-from-image', async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({ error: 'imageBase64 is required' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error: 'Gemini AI no está configurado en el servidor',
        });
      }

      let cleanBase64 = imageBase64.trim();
      let detectedMime = mimeType || 'image/jpeg';
      if (cleanBase64.includes(';base64,')) {
        const parts = cleanBase64.split(';base64,');
        const mimeMatch = parts[0].match(/data:(.*?);/);
        if (mimeMatch) {
          detectedMime = mimeMatch[1].trim();
        }
        cleanBase64 = parts[1].trim();
      }
      // Remove any extraneous newlines or whitespaces in base64 string
      cleanBase64 = cleanBase64.replace(/\s+/g, '');

      const prompt = `Eres un Asistente Experto en Contratación Pública en Colombia (SECOP I, SECOP II, pliegos de condiciones, contratos hospitalarios, resoluciones, órdenes de compra y licitaciones médicas) para SYD Colombia.
Analiza con máxima precisión la imagen, fotografía, escaneo o captura de pantalla del documento adjunto (pliego de condiciones, resumen de licitación, acta de inicio, carátula contractual, extracto de SECOP II, invitación o carta de solicitud).

Tu tarea es leer y extraer con máxima precisión todos los datos que correspondan al contrato o licitación:

Campos a extraer:
1. clientName: Nombre oficial y completo de la Entidad contratante / Hospital / IPS / Clínica / E.S.E. / Secretaría de Salud / Alcaldía / Gobernación (ej: "Hospital Universitario San Ignacio", "Subred Integrada de Servicios de Salud Centro Oriente E.S.E.", "Hospital Departamental de Nariño", etc.).
2. nit: NIT de la entidad con o sin dígito de verificación (ej: "860.012.345-1"). Si no es legible o no aparece, deja "".
3. processNumber: Número de proceso, radicado de convocatoria, número de contrato o código del pliego (ej: "LP-2026-045", "SAM-012-2026", "CD-089-2025", "CO-1234").
4. budgetCOP: Valor total del contrato, cuantía o presupuesto oficial expresado ÚNICAMENTE como número entero en pesos colombianos (COP). Por ejemplo, si en el documento dice "$ 280.000.000 COP", "$280.000.000,00", o "DOSCIENTOS OCHENTA MILLONES DE PESOS", devuelve 280000000. Si no aparece o no se especifica, devuelve 0.
5. city: Ciudad o municipio donde se ejecuta el contrato o sede de la entidad (ej: "Bogotá D.C.", "Medellín", "Cali", "Barranquilla", "Pasto", etc.). Si no aparece, usa "Bogotá D.C.".
6. processType: Modalidad de contratación exacta o deducida. Debe ser EXACTAMENTE uno de los siguientes valores:
   - "Licitación Pública"
   - "Selección Abreviada"
   - "Convocatoria Privada"
   - "Contratación Directa"
   - "Subasta Inversa Electrónica"
   (Si no está explícito, usa "Licitación Pública").
7. contractObject: Objeto del contrato o descripción detallada de lo que se va a contratar o suministrar (ej: "Adquisición, instalación, pruebas y puesta en funcionamiento de equipos biomédicos hospitalarios...").
8. executionTerm: Tiempo o plazo de ejecución contractual (ej: "30 días calendario", "60 días hábiles", "6 meses", "Hasta el 31 de diciembre de 2026", etc.). Si no aparece, deja "".
9. contactPerson: Nombre de la persona de contacto, ordenador del gasto, interventor o funcionario responsable si aparece (ej: "Dr. Roberto Méndez"). Si no aparece, deja "".
10. openingDate: Fecha de apertura o publicación si aparece (en formato YYYY-MM-DD). Si no aparece, deja "".
11. closingDate: Fecha de cierre, presentación de ofertas o entrega si aparece (en formato YYYY-MM-DD). Si no aparece, deja "".
12. status: Estado del proyecto ("En Preparación", "Presentada", "Adjudicada"). Si el documento indica que el contrato fue adjudicado, firmado, es un acta de adjudicación o contrato perfeccionado, usa "Adjudicada". Si es un borrador o aviso de convocatoria, usa "En Preparación".

Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta estructura:
{
  "clientName": "Nombre de la Entidad",
  "nit": "860.000.000-1",
  "processNumber": "LP-2026-001",
  "budgetCOP": 280000000,
  "city": "Bogotá D.C.",
  "processType": "Licitación Pública",
  "contractObject": "Objeto del contrato...",
  "executionTerm": "60 días calendario",
  "contactPerson": "Dr. Nombre Apellido",
  "openingDate": "",
  "closingDate": "",
  "status": "En Preparación"
}`;

      const modelsToTry = ['gemini-3.7-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
      let lastError: any = null;
      let responseText = '';

      for (const modelName of modelsToTry) {
        try {
          const config: any = {
            responseMimeType: 'application/json',
            temperature: 0.1,
          };
          if (modelName === 'gemini-3.7-flash' || modelName.includes('3.7')) {
            config.thinkingConfig = { thinkingBudget: 0 };
          }
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType: detectedMime,
                },
              },
              {
                text: prompt,
              },
            ],
            config,
          });

          if (response.text) {
            responseText = response.text;
            break;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`Model ${modelName} error on OCR contract image:`, err?.status || err?.message);
        }
      }

      if (!responseText) {
        throw lastError || new Error('No se pudo extraer texto de la imagen');
      }

      let cleanJson = responseText.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      const firstBrace = cleanJson.indexOf('{');
      const lastBrace = cleanJson.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
      }

      const parsedData = JSON.parse(cleanJson);
      if (parsedData.budgetCOP !== undefined) {
        parsedData.budgetCOP = Number(parsedData.budgetCOP) || 0;
      }

      return res.json({
        success: true,
        data: parsedData,
      });
    } catch (err: any) {
      console.error('Error extracting contract from image:', err);
      return res.status(500).json({
        error: err.message || 'Error al procesar la imagen del contrato',
      });
    }
  });

  // API endpoint: Interactive SYD Biomedical & App Assistant Chat
  app.post('/api/gemini/chat-assistant', async (req, res) => {
    try {
      const { message, history, context } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'message is required' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.json({
          reply:
            '¡Hola! Soy **Mara**, tu Asistente Biomédica y Copiloto de Inteligencia Artificial en SYD Colombia. Puedo aconsejarte y guiarte paso a paso sobre cómo cotizar, calcular costos y márgenes (L1 a L8), hacer seguimiento a Órdenes de Compra (OC), gestionar proveedores o estructurar pliegos para SECOP II.',
          actions: [
            { label: 'Ir al Cotizador', type: 'navigate', tab: 'ventas', primary: true },
            { label: 'Seguimiento de OC', type: 'navigate', tab: 'seguimiento_oc' },
            { label: 'Directorio de Proveedores', type: 'modal', modalAction: 'manage_suppliers' },
            { label: 'Gestor de Costos & TRM', type: 'navigate', tab: 'costos' },
            { label: 'Licitaciones SECOP II', type: 'navigate', tab: 'licitaciones' },
          ],
        });
      }

      // Format previous conversation context if available
      let historyText = '';
      if (Array.isArray(history) && history.length > 0) {
        historyText = history
          .slice(-6)
          .map((h: { sender: string; text: string }) => `${h.sender === 'user' ? 'Usuario' : 'Mara'}: ${h.text}`)
          .join('\n');
      }

      const prompt = `Eres "Mara", la Asistente Inteligente de Inteligencia Artificial oficial de SYD Colombia (empresa líder en comercialización, importación e ingeniería biomédica de tecnología hospitalaria en Colombia).

TU PERSONALIDAD Y FORMA DE RESPONDER:
- Eres sumamente inteligente, clara, amable, estructurada, ejecutiva y especialista en ingeniería biomédica y compras hospitalarias.
- Cuando el usuario te pregunte cómo hacer algo en la plataforma, sobre un equipo, sobre proveedores, cálculos o temas biomédicos:
  1. Aconséjale qué es lo más conveniente y seguro según la normatividad colombiana (INVIMA, TRM, cobertura de margen, pliegos SECOP II, logística de importación).
  2. Dale las opciones y los pasos claros y fáciles de seguir (ej: "Paso 1: ..., Paso 2: ...").
  3. Provee SIEMPRE botones de acción ('actions') pertinentes para que el usuario pueda hacer clic y abrir la ventana o el modal exacto sin tener que buscarlo manualmente.
  4. Utiliza los datos del contexto dinámico en tiempo real para dar cifras exactas cuando corresponda (ej: cuántos equipos hay registrados, TRM actual, cotizaciones u OCs activas).

ARQUITECTURA COMPLETA DE MÓDULOS Y CAPACIDADES EN LA APP SYD COLOMBIA:
1. Módulo 'inicio' (Dashboard General & TRM):
   - Visión global de métricas del negocio, cotizaciones del mes, OCs en tránsito, TRM en tiempo real y TRM recomendada (+5%).
   - Botón acción: { "label": "Ir a Inicio", "type": "navigate", "tab": "inicio" }

2. Módulo 'ventas' (Cotizador Comercial Oficial):
   - Selección de equipos médicos del catálogo, accesorios base incluidos y accesorios opcionales.
   - Manejo de IVA (19% o 0% exento para dispositivos médicos específicos según estatuto tributario).
   - Márgenes de ganancia (L1: 15% hasta L8: 80% o factor libre) con cálculo de venta: Precio = Costo / (1 - %Margen).
   - Generación, previsualización e impresión de PDF formal con membrete corporativo, logos y firma.
   - Botones acción:
     * { "label": "Abrir Cotizador", "type": "navigate", "tab": "ventas", "primary": true }
     * { "label": "Nueva Cotización", "type": "modal", "modalAction": "new_quote" }
     * { "label": "Vista Previa / Imprimir PDF", "type": "modal", "modalAction": "print_preview" }

3. Módulo 'historial' (Historial de Cotizaciones):
   - Control de propuestas guardadas, estados (Borrador, Enviada, Aprobada, Rechazada, Facturada).
   - Carga de cotizaciones pasadas al cotizador o duplicación rápida para nuevos clientes.
   - Botón acción: { "label": "Ver Historial de Cotizaciones", "type": "navigate", "tab": "historial" }

4. Módulo 'costos' (Gestor de Costos & TRM Automatizada):
   - TRM Oficial del Banco de la República / Superfinanciera que se actualiza AUTOMÁTICAMENTE en segundo plano cada 2 horas.
   - TRM Recomendada (+5% de margen de seguridad para amortiguar la volatilidad cambiaria del dólar).
   - Matriz de costos de equipos y accesorios en COP y USD, márgenes L1 (15%), L2 (20%), L2.5 (25%), L3 (30%), L3.5 (35%), L4 (40%), L5 (50%), L6 (60%), L7 (70%), L8 (80%), techo de precios hospitalarios, personalizador de columnas visibles y exportación a Excel.
   - Botón acción: { "label": "Abrir Gestor de Costos & TRM", "type": "navigate", "tab": "costos" }

5. Módulo 'catalogo' (Catálogo de Equipos Médicos):
   - Base multimarca de dispositivos biomédicos (Mindray, Edan, Bovie, Philips, Zoll, GE, etc.).
   - Generación asistida por IA de descripciones técnicas, registros INVIMA con semáforo de vigencia y accesorios.
   - Botones acción:
     * { "label": "Ver Catálogo de Equipos", "type": "navigate", "tab": "catalogo" }
     * { "label": "Registrar Nuevo Equipo", "type": "modal", "modalAction": "new_equipment", "primary": true }

6. Módulo 'licitaciones' (Licitaciones & SECOP II):
   - Estructuración de proyectos por hospital/cliente, matriz de cumplimiento técnico ("Cumple / No Cumple / Folio").
   - Optimizador Biomédico de Especificaciones Técnicas con IA: Detecta parámetros medibles y genera RANGOS AMPLIOS y holgados (ej: "entre 10 a 12.1 pulgadas", "15 a 300 lpm", "10 a 270 mmHg", "2 a 5 horas", 4 variantes: between/min/max/fixed, blindajes isUnique).
   - Importador masivo de pliegos desde Excel (modo anexar o reemplazar) y exportación a Excel.
   - Botón acción: { "label": "Ir a Licitaciones SECOP II", "type": "navigate", "tab": "licitaciones" }

7. Módulo 'seguimiento_oc' (Seguimiento de Órdenes de Compra & Logística Internacional):
   - Trazabilidad integral de compras vinculadas a licitaciones adjudicadas o cotizaciones aprobadas.
   - 11 Estados logísticos: Borrador -> Emitida -> Confirmada por Proveedor -> En Fabricación -> En Tránsito -> En Aduana / Nacionalización -> Equipos en Bodega SYD -> En Ingreso Técnico -> Listo para Despacho -> Despachado al Cliente -> Entregado e Instalado -> Cerrado.
   - Alertas automáticas de 48 horas cuando un equipo lleva más de 48h en un estado crítico (como aduana o listo en fábrica).
   - Seriales físicos de dispositivos, números de lote y declaraciones/manifiestos de importación aduanera DIAN.
   - Estados de pago: Anticipo 50%, Contado 100%, Crédito 30/60/90 días (Vigente / Pagado).
   - Botón acción: { "label": "Ir a Seguimiento de OC", "type": "navigate", "tab": "seguimiento_oc" }

8. Módulo 'sales_orders' (Órdenes de Venta & Facturación):
   - Generación de Órdenes de Venta (OV) comerciales a partir de cotizaciones ganadas o contratos adjudicados.
   - Remisiones de entrega formal con transportadora, número de guía, fecha y firmas digitales de recibido hospitalario.
   - Radicación de Facturas Electrónicas DIAN, fecha de expedición, fecha de radicación y control de cartera de cobranza (Pendiente, Parcial, Pagada).
   - Generación de Actas de Recibido a Satisfacción para soporte de cobro a IPS y EPS.
   - Botón acción: { "label": "Ir a Órdenes de Venta (OV)", "type": "navigate", "tab": "sales_orders" }

9. Directorio de Proveedores y Fabricantes (dentro de Seguimiento de OC):
   - Gestión de proveedores aliados, marcas autorizadas, contactos, correos y condiciones de pago.
   - Al abrir, muestra la lista de proveedores a la izquierda sin tapar la vista.
   - El botón superior "Nuevo Proveedor" despliega el formulario al lado derecho en paralelo.
   - Al seleccionar un proveedor se muestra su ficha, la cual se puede quitar en cualquier momento pulsando "Quitar Ficha" o haciendo clic de nuevo sobre él.
   - Botón acción: { "label": "Abrir Directorio de Proveedores", "type": "modal", "modalAction": "manage_suppliers" }

10. Módulo 'documentacion' (Repositorio Técnico & INVIMA):
    - Fichas técnicas, registros sanitarios INVIMA, manuales de usuario/servicio y certificados de calidad con control de vencimiento.
    - Botones acción:
      * { "label": "Abrir Repositorio de Documentos", "type": "navigate", "tab": "documentacion" }
      * { "label": "Subir Ficha / Registro INVIMA", "type": "modal", "modalAction": "new_document", "primary": true }

11. Base de Datos, Excel (.xlsx) & Consola Relacional SQL:
    - Descarga e importación en formato Excel Multi-Hoja (.xlsx) para respaldo y migración de datos.
    - Consola SQL Relacional interactiva con autenticación protegida para administradores.
    - Botón acción: { "label": "Abrir Base de Datos & Excel", "type": "modal", "modalAction": "backup_management" }

12. Herramientas Globales & Atajos:
    - Cierre universal con tecla Escape (ESC): Cierra al instante cualquier modal, drawer o panel flotante.
    - Widget Flotante de Alertas: Alerta sobre cotizaciones por vencer, retrasos en OCs, pagos y registros INVIMA.
    - Chat Dual: Mara IA + Chat de Equipo interno en tiempo real (General y directos).
    - Administración de Usuarios & Roles RBAC: Matriz de 14 permisos granulares editables de seguido sin reinicios a admin. { "label": "Administrar Usuarios", "type": "modal", "modalAction": "user_management" }
    - Centro de Actualizaciones: Notificaciones automáticas de nuevas versiones del sistema (Versión actual: v2.7.0). { "label": "Centro de Actualizaciones", "type": "modal", "modalAction": "app_updates" }
    - Personalización Visual: { "label": "Personalizar Logo & Colores", "type": "modal", "modalAction": "customization" }

13. Integración Google Workspace & Formato N-FCO-03:
    - Importación de partes y equipos médicos desde hojas oficiales Google Sheets.
    - Validación estricta: Detección de solicitudes de INACTIVACIÓN bloqueando la creación de partes descontinuadas y marcándolas como inactivas. Modificaciones y creaciones limpias desde el código de parte.
    - Botón acción: { "label": "Abrir Google Workspace", "type": "modal", "modalAction": "google_workspace" }

14. Gmail Compras & Caché Local de Cuota:
    - Monitoreo de correos de compras y confirmaciones de pedidos de proveedores con protección de cuota local.
    - Botón acción: { "label": "Abrir Gmail Compras", "type": "modal", "modalAction": "gmail_compras" }

15. Unificación Maestra de Proveedores & Directorio de Clientes:
    - Fusión automática de proveedores duplicados (como Técnica Electromédica y Técnica) unificando marcas (Welch Allyn, Seca, Ca-Mi, Comen, Mindray) y todos sus equipos vinculados.
    - Directorio de clientes con eliminación interactiva segura y persistente en la nube.
    - Botón acción: { "label": "Abrir Directorio de Clientes", "type": "modal", "modalAction": "client_directory" }
CONTEXTO DINÁMICO EN TIEMPO REAL DEL SISTEMA:
- Pestaña activa actual: ${context?.activeTab || 'inicio'}
- Usuario: ${context?.userName || 'Usuario'} (${context?.userRole || 'Miembro SYD'})
- Equipos en catálogo: ${context?.totalEquipments ?? 'Varios'}
- Cotizaciones guardadas: ${context?.totalQuotes ?? 'Varias'}
- Proyectos licitatorios: ${context?.totalTenderClients ?? 'Varios'}
- Órdenes de Compra (OC): ${context?.totalOCContracts ?? 'Varias'}
- Proveedores registrados: ${context?.totalSuppliers ?? 16}
- Documentos técnicos: ${context?.totalDocuments ?? 'Varios'}
- Alertas activas: ${context?.totalAlerts ?? 0}
- TRM Spot en vivo: $${context?.liveTRM ? Number(context.liveTRM).toLocaleString('es-CO') : '4.185'} COP
- TRM Recomendada (+5%): $${context?.recommendedTRM ? Number(context.recommendedTRM).toLocaleString('es-CO') : '4.400'} COP
- Módulos instalados: ${context?.installedModules ? JSON.stringify(context.installedModules) : 'Todos los módulos SYD'}

Historial reciente de la conversación:
${historyText || '(Inicio de conversación)'}

Mensaje del Usuario:
"${message}"

INSTRUCCIONES DE RESPUESTA:
- Preséntate o responde como "Mara".
- Responde de forma muy clara, agradable, profesional y ejecutiva.
- Explica los pasos de forma estructurada (Paso 1, Paso 2, etc.) y brinda siempre consejos biomédicos y comerciales acordes a la normativa colombiana.
- Proporciona entre 1 y 4 botones de acción ('actions') para que el usuario pueda ejecutarlas de inmediato.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con la siguiente estructura:
{
  "reply": "Hola, soy Mara. Para hacer esto te recomiendo lo siguiente:\\n\\n1. **Paso 1**: ...\\n2. **Paso 2**: ...\\n\\nPuedes pulsar los botones directos aquí abajo para comenzar.",
  "actions": [
    {
      "label": "Texto visible en el botón",
      "type": "navigate" | "modal" | "query",
      "tab": "ventas" | "costos" | "catalogo" | "licitaciones" | "seguimiento_oc" | "documentacion" | "historial" | "inicio",
      "modalAction": "new_equipment" | "new_document" | "new_quote" | "manage_suppliers" | "new_oc" | "alerts_widget" | "user_management" | "customization" | "print_preview",
      "queryPrompt": "¿Cómo calcular margen?",
      "primary": true
    }
  ]
}`;

      let responseText = '{}';
      try {
        responseText = await generateWithModelFallback(ai, prompt);
      } catch (geminiError) {
        console.warn('Gemini error for chat assistant:', geminiError);
        return res.json({
          reply:
            'Hola, soy Mara. Para gestionar tus procesos comerciales, compras y técnicos en SYD Colombia, tienes a tu disposición las siguientes opciones rápidas:',
          actions: [
            { label: 'Ir al Cotizador', type: 'navigate', tab: 'ventas', primary: true },
            { label: 'Seguimiento de OC', type: 'navigate', tab: 'seguimiento_oc' },
            { label: 'Directorio de Proveedores', type: 'modal', modalAction: 'manage_suppliers' },
            { label: 'Gestor de Costos & TRM', type: 'navigate', tab: 'costos' },
            { label: 'Registrar Equipo', type: 'modal', modalAction: 'new_equipment' },
          ],
        });
      }

      const parsedData = JSON.parse(responseText);
      const actionsList = Array.isArray(parsedData.actions)
        ? parsedData.actions
        : parsedData.suggestedTab
          ? [{ label: parsedData.suggestedTabLabel || 'Ir a Ventana', type: 'navigate', tab: parsedData.suggestedTab, primary: true }]
          : [];

      return res.json({
        reply: parsedData.reply || '¿En qué más te puedo asesorar el día de hoy?',
        actions: actionsList,
      });
    } catch (err: any) {
      console.warn('Error in chat assistant:', err?.message || err);
      return res.json({
        reply:
          'Hola, soy Mara. Estoy aquí para aconsejarte y ayudarte a realizar cualquier acción en la plataforma SYD Colombia. ¿Qué deseas hacer a continuación?',
        actions: [
          { label: 'Crear Cotización', type: 'navigate', tab: 'ventas', primary: true },
          { label: 'Seguimiento de OC', type: 'navigate', tab: 'seguimiento_oc' },
          { label: 'Directorio de Proveedores', type: 'modal', modalAction: 'manage_suppliers' },
          { label: 'Registrar Equipo', type: 'modal', modalAction: 'new_equipment' },
          { label: 'Gestor de Costos', type: 'navigate', tab: 'costos' },
        ],
      });
    }
  });

  // In-memory cache for TRM to avoid redundant remote requests and network throttling
  let cachedTrmPayload: {
    rate: number;
    date: string;
    vigenciaDesde?: string;
    vigenciaHasta?: string;
    source: string;
    isLive: boolean;
    lastUpdated: string;
  } | null = null;
  let cachedTrmExpiresAt = 0;

  // Live TRM (Tasa Representativa del Mercado) from official Superfinanciera / Datos Abiertos & exchange rates
  app.get('/api/trm', async (req, res) => {
    try {
      const now = Date.now();
      if (cachedTrmPayload && now < cachedTrmExpiresAt) {
        return res.json(cachedTrmPayload);
      }

      // 1. Primary: Official Colombian Open Data (Superintendencia Financiera de Colombia TRM)
      try {
        const socrataRes = await fetch('https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigenciadesde%20DESC', {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(4500),
        });
        if (socrataRes.ok) {
          const socrataData = await socrataRes.json();
          if (Array.isArray(socrataData) && socrataData.length > 0 && socrataData[0]?.valor) {
            const rawVal = parseFloat(socrataData[0].valor);
            if (!isNaN(rawVal) && rawVal > 1000 && rawVal < 10000) {
              const vigenciaDesde = socrataData[0].vigenciadesde;
              const vigenciaHasta = socrataData[0].vigenciahasta;
              const dateFormatted = vigenciaHasta
                ? new Date(vigenciaHasta).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
                : new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });

              cachedTrmPayload = {
                rate: Math.round(rawVal * 100) / 100,
                date: dateFormatted,
                vigenciaDesde,
                vigenciaHasta,
                source: 'Superintendencia Financiera de Colombia (Oficial)',
                isLive: true,
                lastUpdated: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
              };
              cachedTrmExpiresAt = now + 30 * 60 * 1000; // 30-minute memory cache
              return res.json(cachedTrmPayload);
            }
          }
        }
      } catch (err: any) {
        // Silently proceed to secondary live provider
      }

      // 2. Secondary: Live exchange rate API
      try {
        const erRes = await fetch('https://open.er-api.com/v6/latest/USD', {
          signal: AbortSignal.timeout(4500),
        });
        if (erRes.ok) {
          const erData = await erRes.json();
          const rate = erData?.rates?.COP;
          if (typeof rate === 'number' && rate > 1000 && rate < 10000) {
            cachedTrmPayload = {
              rate: Math.round(rate * 100) / 100,
              date: new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }),
              source: 'ExchangeRate Global en Vivo',
              isLive: true,
              lastUpdated: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
            };
            cachedTrmExpiresAt = now + 15 * 60 * 1000;
            return res.json(cachedTrmPayload);
          }
        }
      } catch (err: any) {
        // Silently proceed to fallback
      }

      // 3. Fallback
      return res.json({
        rate: cachedTrmPayload?.rate || 3126.08,
        date: new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }),
        source: 'TRM Referencial Colombia',
        isLive: false,
        lastUpdated: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      });
    } catch (error: any) {
      console.error('TRM general error:', error);
      res.status(500).json({ error: 'Failed to fetch TRM' });
    }
  });

  // Health checks for Cloud Run and monitoring
  app.get(['/healthz', '/health', '/api/health'], (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Version check for client synchronization and auto-reloading
  app.get('/api/version', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json({
      bootTime: SERVER_BOOT_TIME,
      version: APP_VERSION,
      timestamp: Date.now(),
      status: 'ok',
    });
  });

  // State cache for server-side hourly backup tasks
  const BACKUP_CACHE_FILE = path.join(process.cwd(), 'data_backup_snapshot.json');
  let inMemoryLatestState: BackupDataPayload | null = null;
  let lastHourlyBackupTime: string | null = null;
  let lastHourlyBackupSuccess = false;
  let nextScheduledRunTime = Date.now() + 60 * 60 * 1000;
  let currentServerStateVersion = Date.now();

  const broadcastRealtimeStateUpdate = (_senderClientId?: string) => {
    currentServerStateVersion = Date.now();
  };

  // Safe helper to read cached state from file without crashing on empty/corrupt files
  const readCachedStateSafely = (): BackupDataPayload | null => {
    try {
      if (fs.existsSync(BACKUP_CACHE_FILE)) {
        const raw = fs.readFileSync(BACKUP_CACHE_FILE, 'utf-8').trim();
        if (raw.length > 0 && (raw.startsWith('{') || raw.startsWith('['))) {
          return JSON.parse(raw);
        }
      }
    } catch (err) {
      // Ignore corrupt or malformed cache file
    }
    return null;
  };

  // Try to load cached state from file on server boot
  inMemoryLatestState = readCachedStateSafely();

  // API endpoint: Fast status check (replaces long-running SSE to avoid Cloud Run timeouts)
  app.get('/api/realtime/events', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache');
    res.json({
      status: 'ok',
      version: currentServerStateVersion,
      timestamp: new Date().toISOString()
    });
  });

  // API endpoint: Fast lightweight version check for clients
  app.get('/api/realtime/version', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json({
      version: currentServerStateVersion,
      timestamp: inMemoryLatestState?.timestamp || null,
      clientsConnected: 1,
    });
  });

  // API endpoint: Retrieve latest server disk snapshot state for automatic client recovery
  app.get('/api/backup/latest-state', (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      if (!inMemoryLatestState) {
        inMemoryLatestState = readCachedStateSafely();
      }

      if (inMemoryLatestState) {
        return res.json({
          success: true,
          exists: true,
          version: currentServerStateVersion,
          timestamp: inMemoryLatestState.timestamp || new Date().toISOString(),
          data: inMemoryLatestState.data || inMemoryLatestState,
          counts: {
            equipments: inMemoryLatestState.data?.equipments?.length || inMemoryLatestState.equipmentsCount || 0,
            quotes: inMemoryLatestState.data?.quotes?.length || inMemoryLatestState.quotesCount || 0,
            tenders: inMemoryLatestState.data?.tenderProjects?.length || inMemoryLatestState.tendersCount || 0,
            contracts: inMemoryLatestState.data?.ocContracts?.length || inMemoryLatestState.contractsCount || 0,
            salesOrders: inMemoryLatestState.data?.salesOrders?.length || inMemoryLatestState.salesOrdersCount || 0,
            salesInvoices: inMemoryLatestState.data?.salesInvoices?.length || inMemoryLatestState.salesInvoicesCount || 0,
            documents: inMemoryLatestState.data?.technicalDocuments?.length || inMemoryLatestState.documentsCount || 0,
          },
        });
      }

      return res.json({
        success: true,
        exists: false,
        version: currentServerStateVersion,
        data: null,
      });
    } catch (err: any) {
      console.warn('Error reading latest backup state:', err);
      res.status(500).json({ success: false, error: err?.message || 'Error loading latest state' });
    }
  });

  // API endpoint: Sync/save latest state to server cache and broadcast to all connected devices
  app.post('/api/backup/sync-state', (req, res) => {
    try {
      const payload = req.body as BackupDataPayload & { clientId?: string };
      if (payload && typeof payload === 'object') {
        inMemoryLatestState = payload;
        try {
          fs.writeFileSync(BACKUP_CACHE_FILE, JSON.stringify(payload, null, 2), 'utf-8');
          // Secondary redundancy file
          const backupRedundantFile = path.join(process.cwd(), 'data_backup_snapshot.backup.json');
          fs.writeFileSync(backupRedundantFile, JSON.stringify(payload, null, 2), 'utf-8');
        } catch (fsErr) {
          console.warn('Failed to write backup snapshot to disk:', fsErr);
        }

        // Broadcast update to all connected PCs and browser tabs
        broadcastRealtimeStateUpdate(payload.clientId);
      }
      res.json({ success: true, version: currentServerStateVersion, cachedAt: new Date().toISOString() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Error caching state' });
    }
  });

  // API endpoint: Permanently remove a deleted entity from server backup snapshot and disk cache
  app.post('/api/backup/delete-entity', (req, res) => {
    try {
      const { type, id, code, quoteNumber } = req.body || {};
      if (!type || (!id && !code && !quoteNumber)) {
        return res.status(400).json({ success: false, error: 'Missing type or id' });
      }

      if (!inMemoryLatestState) {
        inMemoryLatestState = readCachedStateSafely();
      }

      if (inMemoryLatestState) {
        const root = inMemoryLatestState as any;
        const d = inMemoryLatestState.data || root;
        if (type === 'quote') {
          if (Array.isArray(d.quotes)) d.quotes = d.quotes.filter((q: any) => q.id !== id && (!quoteNumber || q.quoteNumber !== quoteNumber));
          if (Array.isArray(root.quotes)) root.quotes = root.quotes.filter((q: any) => q.id !== id && (!quoteNumber || q.quoteNumber !== quoteNumber));
        } else if (type === 'equipment') {
          if (Array.isArray(d.equipments)) d.equipments = d.equipments.filter((e: any) => e.id !== id && (!code || (e.code || '').trim().toUpperCase() !== String(code).trim().toUpperCase()));
          if (Array.isArray(root.equipments)) root.equipments = root.equipments.filter((e: any) => e.id !== id && (!code || (e.code || '').trim().toUpperCase() !== String(code).trim().toUpperCase()));
        } else if (type === 'tender') {
          if (Array.isArray(d.tenderProjects)) d.tenderProjects = d.tenderProjects.filter((t: any) => t.id !== id);
          if (Array.isArray(root.tenderProjects)) root.tenderProjects = root.tenderProjects.filter((t: any) => t.id !== id);
        } else if (type === 'contract') {
          if (Array.isArray(d.ocContracts)) d.ocContracts = d.ocContracts.filter((c: any) => c.id !== id);
          if (Array.isArray(root.ocContracts)) root.ocContracts = root.ocContracts.filter((c: any) => c.id !== id);
        } else if (type === 'salesOrder') {
          const { salesOrderNumber, tenderClientId, contractId } = req.body || {};
          const isTargetOrder = (o: any) =>
            (id && o.id === id) ||
            (salesOrderNumber && (o.salesOrderNumber || '').trim().toLowerCase() === String(salesOrderNumber).trim().toLowerCase()) ||
            (tenderClientId && (o.tenderClientId === tenderClientId || o.contractId === tenderClientId)) ||
            (contractId && (o.contractId === contractId || o.tenderClientId === contractId));
          if (Array.isArray(d.salesOrders)) d.salesOrders = d.salesOrders.filter((o: any) => !isTargetOrder(o));
          if (Array.isArray(root.salesOrders)) root.salesOrders = root.salesOrders.filter((o: any) => !isTargetOrder(o));
        } else if (type === 'salesInvoice') {
          if (Array.isArray(d.salesInvoices)) d.salesInvoices = d.salesInvoices.filter((i: any) => i.id !== id);
          if (Array.isArray(root.salesInvoices)) root.salesInvoices = root.salesInvoices.filter((i: any) => i.id !== id);
        } else if (type === 'document') {
          if (Array.isArray(d.technicalDocuments)) d.technicalDocuments = d.technicalDocuments.filter((doc: any) => doc.id !== id);
          if (Array.isArray(root.technicalDocuments)) root.technicalDocuments = root.technicalDocuments.filter((doc: any) => doc.id !== id);
        }

        try {
          fs.writeFileSync(BACKUP_CACHE_FILE, JSON.stringify(inMemoryLatestState, null, 2), 'utf-8');
          const backupRedundantFile = path.join(process.cwd(), 'data_backup_snapshot.backup.json');
          fs.writeFileSync(backupRedundantFile, JSON.stringify(inMemoryLatestState, null, 2), 'utf-8');
        } catch (fsErr) {
          console.warn('Failed to write updated backup snapshot after deletion:', fsErr);
        }
      }

      // Notify and bump version so all polling clients and tabs receive the deletion immediately
      broadcastRealtimeStateUpdate();
      res.json({ success: true, message: 'Entity deleted from server snapshot', version: currentServerStateVersion });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Error deleting entity from server snapshot' });
    }
  });

  // API endpoint: Status of hourly backup scheduler
  app.get('/api/backup/status', (req, res) => {
    const minutesUntilNext = Math.max(0, Math.round((nextScheduledRunTime - Date.now()) / (60 * 1000)));
    res.json({
      active: true,
      interval: '1 hora (cada 60 minutos)',
      lastBackupTime: lastHourlyBackupTime,
      lastBackupSuccess: lastHourlyBackupSuccess,
      nextScheduledInMinutes: minutesUntilNext,
      defaultRecipients: ['auxlineadiagnostica@syd.com.co', 'eljemb22@gmail.com'],
      hasCachedData: Boolean(inMemoryLatestState),
    });
  });

  // API endpoint: Trigger Hourly/Manual Automated Backup Email Dispatch
  app.post('/api/backup/email', async (req, res) => {
    try {
      const backupData = req.body;
      const recipients = req.body.recipients || ['auxlineadiagnostica@syd.com.co', 'eljemb22@gmail.com'];
      
      // Update cache
      if (backupData && backupData.data) {
        inMemoryLatestState = backupData;
        try {
          fs.writeFileSync(BACKUP_CACHE_FILE, JSON.stringify(backupData, null, 2), 'utf-8');
        } catch (e) {}
      }

      const result = await sendHourlyBackupEmail(backupData, recipients);
      if (result.success) {
        lastHourlyBackupTime = new Date().toISOString();
        lastHourlyBackupSuccess = true;
        nextScheduledRunTime = Date.now() + 60 * 60 * 1000;
      }
      res.json(result);
    } catch (err: any) {
      console.error('Backup API error:', err);
      res.status(500).json({ success: false, error: err?.message || 'Error processing backup' });
    }
  });

  // Background server-side task: Hourly automated backup runner
  const runServerHourlyBackup = async () => {
    try {
      console.log('[Hourly Backup Service] Initiating scheduled hourly backup...');
      if (!inMemoryLatestState) {
        inMemoryLatestState = readCachedStateSafely();
      }

      if (inMemoryLatestState) {
        const recipients = ['auxlineadiagnostica@syd.com.co', 'eljemb22@gmail.com'];
        const result = await sendHourlyBackupEmail(inMemoryLatestState, recipients);
        if (result.success) {
          lastHourlyBackupTime = new Date().toISOString();
          lastHourlyBackupSuccess = true;
          nextScheduledRunTime = Date.now() + 60 * 60 * 1000;
          console.log(`[Hourly Backup Service] Successfully executed automated backup to ${recipients.join(', ')}`);
        } else {
          lastHourlyBackupSuccess = false;
          console.warn('[Hourly Backup Service] Email dispatch reported error:', result.error);
        }
      } else {
        console.log('[Hourly Backup Service] No cached database snapshot found yet. Waiting for client sync.');
      }
    } catch (err) {
      console.error('[Hourly Backup Service Error]:', err);
    }
  };

  // Schedule interval every 60 minutes
  setInterval(runServerHourlyBackup, 60 * 60 * 1000);

  // Serve downloads statically and provide direct download endpoints
  const getDownloadFilePath = (filename: string): string | null => {
    const publicPath = path.join(process.cwd(), 'public', 'downloads', filename);
    if (fs.existsSync(publicPath)) return publicPath;
    const distPath = path.join(process.cwd(), 'dist', 'downloads', filename);
    if (fs.existsSync(distPath)) return distPath;
    return null;
  };

  const downloadsDir = fs.existsSync(path.join(process.cwd(), 'public', 'downloads'))
    ? path.join(process.cwd(), 'public', 'downloads')
    : path.join(process.cwd(), 'dist', 'downloads');
  app.use('/downloads', express.static(downloadsDir));

  app.get('/api/download/windows-exe', (req, res) => {
    const filePath = getDownloadFilePath('SYD_Colombia.exe');
    if (filePath) {
      res.download(filePath, 'SYD_Colombia.exe');
    } else {
      res.status(404).send('Archivo ejecutable no encontrado');
    }
  });

  app.get('/api/download/windows-installer', (req, res) => {
    const filePath = getDownloadFilePath('Instalar_Acceso_Directo.exe');
    if (filePath) {
      res.download(filePath, 'Instalar_Acceso_Directo.exe');
    } else {
      res.status(404).send('Instalador no encontrado');
    }
  });

  app.get('/api/download/windows-portable', (req, res) => {
    const filePath = getDownloadFilePath('SYD-Colombia-Portable-Windows.zip');
    if (filePath) {
      res.download(filePath, 'SYD-Colombia-Portable-Windows.zip');
    } else {
      res.status(404).send('Paquete portable no encontrado');
    }
  });

  app.get('/api/download/windows-zip', (req, res) => {
    const filePath = getDownloadFilePath('SYD-Colombia-Windows-v1.0.zip');
    if (filePath) {
      res.download(filePath, 'SYD-Colombia-Windows-v1.0.zip');
    } else {
      res.status(404).send('Paquete ZIP no encontrado');
    }
  });

  // Vite middleware for development vs static build in production
  const dirName = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  const candidateDirs = [
    path.join(process.cwd(), 'dist'),
    path.join(process.cwd(), 'build'),
    dirName,
    path.join(dirName, 'dist'),
    path.join(dirName, 'build'),
    path.join(dirName, '..', 'dist'),
    path.join(dirName, '..', 'build'),
  ];
  const staticDir = candidateDirs.find((dir) =>
    fs.existsSync(path.join(dir, 'index.html'))
  );

  const isProduction = process.env.NODE_ENV === 'production';
  const shouldServeStatic = isProduction && Boolean(staticDir);

  if (shouldServeStatic && staticDir) {
    console.log(`[Production/Static] Serving static files from: ${staticDir}`);
    app.use(express.static(staticDir));
    app.get('*', (req, res) => {
      const indexPath = path.join(staticDir, 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err && !res.headersSent) {
          res.status(500).send('Error loading application');
        }
      });
    });
  } else {
    // If running in development without pre-built assets, mount Vite SPA middleware with proper HTML transformation
    try {
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: false,
          ws: false,
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      app.use('*', async (req, res, next) => {
        const url = req.originalUrl;
        try {
          const indexPath = path.resolve(process.cwd(), 'index.html');
          if (fs.existsSync(indexPath)) {
            let template = fs.readFileSync(indexPath, 'utf-8');
            template = await vite.transformIndexHtml(url, template);
            res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
            return;
          }
          next();
        } catch (e: any) {
          if (vite) {
            vite.ssrFixStacktrace(e);
          }
          next(e);
        }
      });
    } catch (viteErr) {
      console.error('Failed to initialize Vite dev server, falling back to static handler:', viteErr);
      if (staticDir) {
        app.use(express.static(staticDir));
        app.get('*', (req, res) => {
          res.sendFile(path.join(staticDir, 'index.html'));
        });
      }
    }
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`SYD Colombia server running on http://localhost:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n================================================================`);
      console.error(`[AVISO DE PUERTO OCUPADO] El puerto ${PORT} ya está en uso.`);
      console.error(`Existe otra sesión de Node.js ejecutándose en tu computador.`);
      console.error(`Para entrar, abre tu navegador en: http://localhost:${PORT}`);
      console.error(`O cierra el proceso anterior en el Administrador de Tareas.`);
      console.error(`================================================================\n`);
      process.exit(1);
    } else {
      console.error('Error al iniciar el servidor:', err);
      process.exit(1);
    }
  });

  const gracefulShutdown = (signal: string) => {
    console.log(`[${signal}] Cerrando conexiones para apagado o reinicio limpio...`);
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => {
      process.exit(0);
    }, 3000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer();
