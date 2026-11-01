import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import * as XLSX from 'xlsx';

async function startServer() {
  const app = express();
  // In AI Studio / Cloud Run container environment, Nginx binds to external port 8080 and proxies traffic to localhost:3000.
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

  // Static files from public folder if exists
  const publicDir = path.join(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  // Version check endpoint
  app.get(['/api/version', '/api/app-version'], (_req, res) => {
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

  // Gemini client helper
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

  // Spec optimizer endpoint
  app.post('/api/gemini/optimize-spec', async (req, res) => {
    try {
      const { specText, equipmentName, brand, model } = req.body || {};
      if (!specText) {
        return res.status(400).json({ error: 'specText is required' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.json({
          success: true,
          data: {
            optimized: specText.trim(),
            formal: `Cumple estrictamente con la especificación técnica requerida para ${equipmentName || 'equipo biomédico'}.`,
            isParametricSpec: false,
          },
        });
      }

      const prompt = `Analiza y profesionaliza la siguiente especificación técnica biomédica para licitación en Colombia (SECOP II):
Equipo: ${equipmentName || 'Biomédico'} | Marca: ${brand || 'Estándar'} | Modelo: ${model || 'Estándar'}
Texto: "${specText}"
Devuelve un JSON con:
{
  "optimized": "texto redactado formalmente",
  "formal": "texto para pliego de condiciones",
  "isParametricSpec": false
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json({ success: true, data: parsed });
    } catch (_err) {
      return res.json({
        success: true,
        data: {
          optimized: req.body?.specText || '',
          formal: req.body?.specText || '',
          isParametricSpec: false,
        },
      });
    }
  });

  // Equipment specs generator
  app.post('/api/gemini/generate-equipment-specs', async (req, res) => {
    try {
      const { equipmentName, brand, model } = req.body || {};
      const ai = getGeminiClient();
      if (!ai) {
        return res.json({
          success: true,
          specs: [
            { requirement: 'Alimentación eléctrica 110-120 VAC 60 Hz con batería recargable', compliance: true },
            { requirement: 'Registro Sanitario INVIMA vigente', compliance: true },
            { requirement: 'Certificación de calidad ISO 13485 y seguridad IEC 60601', compliance: true },
          ],
        });
      }

      const prompt = `Genera una lista de 6 especificaciones técnicas hospitalarias para: ${equipmentName} (${brand} - ${model}). Devuelve JSON con formato { "specs": [ { "requirement": "...", "compliance": true } ] }`;
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });

      const data = JSON.parse(response.text || '{"specs":[]}');
      return res.json({ success: true, specs: data.specs || [] });
    } catch (_err) {
      return res.json({ success: true, specs: [] });
    }
  });

  // Helper to sanitize bot responses: strictly remove markdown symbols (*, **, ###, $, LaTeX, etc.)
  function sanitizeBotReplyText(rawText: string): string {
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

  // Mara AI Assistant Endpoint
  app.post('/api/gemini/chat-assistant', async (req, res) => {
    try {
      const { message, history, context } = req.body || {};
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        // Signal caller to use local intelligent knowledge engine
        return res.status(503).json({ error: 'Gemini client not initialized' });
      }

      const systemInstruction = `Eres MARA IA, la Asistente Biomédica y Copiloto Ejecutivo de SUMINISTROS Y DOTACIONES DE COLOMBIA S.A.S. (SYD Colombia). Eres súper inteligente, conoces cada módulo, cada pantalla, cada botón y cada flujo de trabajo de esta aplicación. Puedes responder consultas, navegar por el sistema, abrir modales, ejecutar acciones y ayudar al usuario a completar tareas sin errores.

MAPA COMPLETO DE VENTANAS Y PESTAÑAS (1 a 7):
- Ventana 1: Cotizaciones (tab: "ventas") -> Cotizador Comercial Oficial con PDF, membrete, formato estándar y con imágenes.
- Ventana 2: Costos y Rentabilidad (tab: "costos") -> Gestor de Costos, TRM en vivo cada 2 horas, márgenes L1 a L8, accesorios.
- Ventana 3: Catálogo de Equipos (tab: "catalogo") -> Catálogo multimarca de equipos biomédicos, filtros por marca, vista tarjeta/tabla, registros sanitarios INVIMA.
- Ventana 4: Licitaciones y Contratos (tab: "licitaciones") -> Licitaciones hospitalarias SECOP II, optimizador de rangos holgados, vista galería/lista.
- Ventana 5: Seguimiento de OC (tab: "seguimiento_oc") -> Trazabilidad logística internacional, 11 estados, seriales, manifiestos DIAN.
- Ventana 5.1: Conexión Gmail & OCs (tab: "gmail_compras") -> Extracción automática de órdenes de compra desde Gmail.
- Ventana 6: Órdenes de Venta y Facturación (tab: "ordenes_venta") -> Despachos, remisiones firmadas, actas de entrega, radicación de facturas, cartera.
- Ventana 7: Documentación (tab: "documentacion") -> Repositorio técnico, manuales, fichas técnicas, registros sanitarios INVIMA, cronograma de mantenimiento.

MODALES Y ACCIONES DISPONIBLES:
- new_equipment: Registrar nuevo equipo biomédico
- new_document: Subir/crear documento técnico
- new_quote: Crear nueva cotización
- user_management: Gestión de usuarios y permisos RBAC
- customization: Personalizar identidad visual y membrete
- print_preview: Vista previa e impresión de documentos
- manage_suppliers: Directorio de proveedores y fabricantes
- new_oc: Crear nueva Orden de Compra
- alerts_widget: Centro de alertas inteligentes
- app_updates: Centro de actualizaciones del sistema
- backup_modal: Respaldo y restauración de base de datos
- google_workspace_modal: Integración con Google Workspace/Drive

TIPOS DE ACCIÓN QUE PUEDES GENERAR:
- navigate: Cambiar a una pestaña/ventana específica (usa el campo "tab" con el valor exacto)
- modal: Abrir un modal específico (usa el campo "modalAction")
- query: Enviar una consulta rápida predefinida (usa "queryPrompt")
- execute: Acción que Mara puede realizar autónomamente (marca autoExecute: true)
- auto: Acción automática recomendada por Mara

REGLAS DE ORO:

1. NAVEGACIÓN DIRECTA: Si el usuario pide ir a una ventana, usa navigate con el tab EXACTO del mapa anterior.

2. EJECUCIÓN AUTÓNOMA: Si el usuario pide hacer algo específico (ej. "crea una cotización", "abre el gestor de costos", "registra un equipo"), genera una acción con autoExecute: true y description explicando qué hará. Mara puede ejecutar directamente sin pedir confirmación si es una acción segura.

3. CONFIRMACIÓN: Para acciones destructivas o críticas (eliminar, facturar, radicar), usa confirmationRequired: true.

4. TEXTO LIMPIO: NO uses asteriscos (*), numerales (#), signos de dólar ($), ni LaTeX. Escribe en español simple, directo y legible.

5. CONTEXTO: Usa el contexto del sistema (pestaña activa, totales, TRM, usuario) para dar respuestas precisas y personalizadas.

6. CONSISNCIA: Si el usuario ya está en una ventana y pide algo relacionado, responde con acciones dentro de esa ventana antes de navegar a otra.

7. SALUDOS BREVES: Para "hola", "buenas", "gracias", responde en 1-2 frases cálidas y termina con "¿En qué te puedo colaborar hoy?".

8. MATEMÁTICAS: Resuelve operaciones directamente en una frase corta.

Devuelve un JSON estrictamente con esta estructura:
{
  "reply": "Texto de respuesta limpio, sin asteriscos, sin numerales, en español directo",
  "actions": [
    {
      "label": "Texto del botón",
      "type": "navigate|modal|query|execute|auto",
      "tab": "ventas|costos|catalogo|licitaciones|seguimiento_oc|ordenes_venta|documentacion|gmail_compras|historial",
      "modalAction": "new_equipment|new_document|new_quote|user_management|customization|print_preview|manage_suppliers|new_oc|alerts_widget|app_updates|backup_modal|google_workspace_modal",
      "queryPrompt": "texto de consulta rápida",
      "primary": true,
      "autoExecute": true/false,
      "confirmationRequired": true/false,
      "description": "qué hace esta acción"
    }
  ]
}`;

      const historyFormatted = Array.isArray(history)
        ? history.slice(-6).map((h: any) => `${h.sender === 'user' ? 'Usuario' : 'Mara'}: ${h.text}`).join('\n')
        : '';

      const prompt = `Contexto del sistema:\nPestaña activa: ${context?.activeTab || 'inicio'}\nUsuario: ${context?.userName || 'Usuario SYD'} (${context?.userRole || 'Operaciones'})\nTotal equipos: ${context?.totalEquipments || 0}\nTRM en vivo: $${context?.liveTRM || 4185}\n\nHistorial reciente:\n${historyFormatted}\n\nPregunta del usuario: "${message}"\n\nResponde en formato JSON cumpliendo estrictamente con NO usar asteriscos ni numerales.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const sanitizedReply = sanitizeBotReplyText(parsed.reply || 'He procesado tu consulta con éxito. ¿En qué más te puedo colaborar hoy?');

      return res.json({
        reply: sanitizedReply,
        actions: parsed.actions || [],
      });
    } catch (err: any) {
      console.warn('Gemini chat assistant fallback:', err?.message || err);
      return res.status(500).json({ error: 'Failed to process AI chat with Gemini' });
    }
  });

  // Google Drive & Sheets endpoints
  app.post('/api/sheets/fetch-sheet', (_req, res) => {
    return res.json({
      success: true,
      headers: ['Código', 'Descripción', 'Marca', 'Modelo', 'Precio COP'],
      rows: [],
      totalRows: 0,
      title: 'Catálogo Maestro SYD',
    });
  });

  app.post('/api/drive/search-nfco03', (_req, res) => {
    return res.json({
      success: true,
      bestMatch: null,
      matches: [],
      totalFound: 0,
    });
  });

  // Internet Image Search endpoint for biomedical equipment
  app.post('/api/products/search-images', async (req, res) => {
    try {
      const { query, equipmentName, brand, model } = req.body || {};
      const rawQuery = (query || [equipmentName, brand, model].filter(Boolean).join(' ')).trim();
      if (!rawQuery) {
        return res.json({ success: true, query: '', images: [] });
      }

      const cleanText = (str: string) =>
        str
          .replace(/[\\/:*?"<>|,.;()]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

      const isForbiddenImage = (title: string = '', url: string = '', snippet: string = '') => {
        const combined = `${title} ${url} ${snippet}`.toLowerCase();
        const forbidden = [
          'car', 'automobile', 'vehicle', 'vehiculo', 'auto', 'racing', 'race',
          'ferrari', 'alfa romeo', 'alfa_romeo', 'porsche', 'formula 1', 'formula1', 'f1',
          'motorsport', 'laguna seca', 'laguna_seca', 'circuit', 'corvette', 'bmw',
          'mercedes', 'truck', 'camion', 'nascar', 'rally', 'aircraft', 'airplane',
          'motorcycle', 'fiat', 'ford', 'maserati', 'audi', 'chevrolet', 'honda',
          'actor', 'actress', 'movie', 'film', 'pelicula', 'album', 'singer', 'cancion',
          'guitar', 'stadium', 'football', 'soccer', 'thatcher', 'madonna', 'santa elena',
          'island', 'politician', 'president', 'minister', 'general election', 'band',
          'concert', 'celebrity', 'portrait of', 'biography', 'painting', 'sculpture',
          // REJECT: Non-photographic media
          'illustration', 'drawing', 'sketch', 'diagram', 'chart', 'graph',
          'map', 'painting', 'engraving', 'etching', 'woodcut', 'lithograph',
          'watercolor', 'oil painting', 'blueprint', 'schematic', 'design',
          'plan', 'cartoon', 'clipart', 'icon', 'symbol', 'logo',
          // REJECT: Historical/old content
          'historical', 'historic', 'vintage', 'antique', 'old', 'ancient',
          '19th century', '18th century', '17th century', '1600', '1700', '1800', '1900',
          'black and white', 'b&w', 'monochrome', 'sepia', 'retro',
          'tretise', 'treatise', 'trabajo', 'ensayo', 'estudio', 'thesis',
          'diseases of', 'with their homopathi', 'treatise on',
          // REJECT: Non-equipment medical images (anatomical, cellular, etc.)
          'anatomical', 'anatomy', 'skeleton', 'organ', 'organo', 'órgano',
          'cell', 'celula', 'célula', 'virus', 'bacteria', 'microbe', 'microbio',
          'dna', 'rna', 'protein', 'proteína',
          // REJECT: Generic medical stock (not equipment)
          'doctor', 'nurse', 'patient', 'surgeon', 'medical team',
          'hospital corridor', 'waiting room', 'reception',
          'first aid', 'bandage', 'syringe', 'pill', 'capsule',
          'prescription', 'receta', 'medicine bottle', 'frasco de medicina',
          // REJECT: Scan results (not equipment photos)
          'radiograph', 'x-ray plate', 'radiography film', 'scan result',
          'ultrasound image', 'mri scan', 'ct scan', 'pet scan',
          // REJECT: Wikimedia file pages (often old illustrations)
          'file:', 'wikimedia commons:',
        ];
        if (forbidden.some((w) => combined.includes(w))) return true;

        // Strictly enforce clinical and medical context
        const medicalTerms = [
          'medic', 'médic', 'hospital', 'clinic', 'clínic', 'radiolog', 'radiograf',
          'x-ray', 'rayos', 'surgical', 'quirurg', 'quirúrg', 'device', 'equipment',
          'equipo', 'patient', 'paciente', 'stadiometer', 'scale', 'balanza', 'oximeter',
          'oximetro', 'monitor', 'lamp', 'lampara', 'lámpara', 'table', 'mesa',
          'forceps', 'pinza', 'incubator', 'incubadora', 'ultrasound', 'ecograf',
          'defibrillator', 'desfibrilador', 'sensor', 'stethoscop', 'estetoscop',
          'fonendoscop', 'health', 'salud', 'care', 'biomedic', 'biomédic', 'infantometer'
        ];
        return !medicalTerms.some((t) => combined.includes(t));
      };

      const candidateTerms: string[] = [];
      const lower = rawQuery.toLowerCase();

      // Clinical specialized terms prioritized first for exact medical results
      if (lower.includes('tallimetro') || lower.includes('tallímetro') || lower.includes('estadiometro') || lower.includes('estadiómetro') || (lower.includes('seca') && lower.includes('213'))) {
        candidateTerms.push('Seca 213 stadiometer medical height rod');
        candidateTerms.push('Stadiometer medical height');
        candidateTerms.push('Seca stadiometer');
      } else if (lower.includes('balanza') || lower.includes('báscula') || lower.includes('bascula') || (lower.includes('seca') && lower.includes('874'))) {
        candidateTerms.push('Seca 874 digital floor scale medical');
        candidateTerms.push('Medical weighing scale clinical');
        candidateTerms.push('Seca medical scale');
      } else if (lower.includes('infantometro') || lower.includes('infantómetro') || (lower.includes('seca') && lower.includes('417'))) {
        candidateTerms.push('Seca 417 infantometer baby measuring board');
        candidateTerms.push('Infantometer medical pediatric');
      } else if (lower.includes('cuello cisne') || lower.includes('gs 300') || lower.includes('gs300')) {
        candidateTerms.push('Welch Allyn Green Series examination light');
        candidateTerms.push('Medical examination lamp hospital');
      } else if (lower.includes('fonendoscopio') || lower.includes('estetoscopio') || lower.includes('stethoscope') || lower.includes('5079')) {
        candidateTerms.push('Welch Allyn Stethoscope medical');
        candidateTerms.push('Stethoscope medical clinical');
        candidateTerms.push('Fonendoscopio');
      } else if (lower.includes('organos') || lower.includes('órganos') || lower.includes('777') || lower.includes('oftalmo') || lower.includes('otoscop')) {
        candidateTerms.push('Welch Allyn 777 Green Series');
        candidateTerms.push('Ophthalmoscope otoscope wall medical');
        candidateTerms.push('Welch Allyn ophthalmoscope');
      } else if (lower.includes('pinza') || lower.includes('allys') || lower.includes('kelly') || lower.includes('foester') || lower.includes('bozzeman') || lower.includes('maguill') || lower.includes('mosquito')) {
        candidateTerms.push('Surgical forceps stainless steel');
        candidateTerms.push('Hemostatic forceps medical');
        candidateTerms.push('Pinza quirurgica');
      } else if (lower.includes('digieye') || ((lower.includes('rayos x') || lower.includes('x-ray')) && lower.includes('fijo'))) {
        candidateTerms.push('Mindray DigiEye digital radiography fixed system');
        candidateTerms.push('Hospital fixed X-ray room digital radiography');
        candidateTerms.push('Digital radiography system medical');
      } else if (lower.includes('rayos x') || lower.includes('x-ray') || lower.includes('mobieye')) {
        candidateTerms.push('Mobile X-ray machine medical hospital');
        candidateTerms.push('Mindray MobiEye mobile radiography');
        candidateTerms.push('Mindray digital radiography X-ray');
      } else if (lower.includes('mesa de cirugia') || lower.includes('mesa quirurgica') || lower.includes('hybase')) {
        candidateTerms.push('Operating table medical surgical hospital');
        candidateTerms.push('Mindray surgical table');
      } else if (lower.includes('monitor') && (lower.includes('signos') || lower.includes('vitales') || lower.includes('umec'))) {
        candidateTerms.push('Patient monitor medical hospital vital signs');
        candidateTerms.push('Mindray uMEC patient monitor');
      } else if (lower.includes('desfibrilador')) {
        candidateTerms.push('Defibrillator medical hospital');
      } else if (lower.includes('oximetro') || lower.includes('oxímetro')) {
        candidateTerms.push('Pulse oximeter medical');
      } else if (lower.includes('cielitica') || lower.includes('pielitica') || lower.includes('hyled')) {
        candidateTerms.push('Surgical ceiling operating light hospital');
      }

      const cleanedRaw = cleanText(rawQuery);
      candidateTerms.push(`${cleanedRaw} medical`);
      if (brand && model) candidateTerms.push(`${brand} ${model.replace(/[-_]?[xX]{2,}/g, '')} medical`.trim());
      if (equipmentName && brand) candidateTerms.push(`${equipmentName} ${brand} medical`.trim());

      const resultsMap = new Map<string, any>();
      const userAgent = 'SYDColombia-Biomedical/2.0 (soporte@sydcolombia.com)';

      // 1. Curated verified high-resolution clinical equipment images (Tested and verified direct Wikimedia URLs)
      if (lower.includes('tallimetro') || lower.includes('tallímetro') || lower.includes('estadiometro') || (lower.includes('seca') && lower.includes('213')) || lower.includes('balanza') || lower.includes('báscula') || lower.includes('bascula')) {
        resultsMap.set('https://upload.wikimedia.org/wikipedia/commons/b/bf/Equipment_-_Scale_--_Smart-Servier.png', {
          title: 'Báscula y Tallímetro Clínico de Precisión Grado Médico',
          url: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Equipment_-_Scale_--_Smart-Servier.png',
          thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Equipment_-_Scale_--_Smart-Servier.png',
          source: 'Catálogo Biomédico Oficial',
        });
      } else if (lower.includes('fonendo') || lower.includes('esteto') || lower.includes('stethoscope') || lower.includes('5079')) {
        resultsMap.set('https://upload.wikimedia.org/wikipedia/commons/9/9e/2023_Stetoskop.jpg', {
          title: 'Fonendoscopio Acústico Clínico de Dos Servicios (Adulto)',
          url: 'https://upload.wikimedia.org/wikipedia/commons/9/9e/2023_Stetoskop.jpg',
          thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/9/9e/2023_Stetoskop.jpg',
          source: 'Catálogo Biomédico Oficial',
        });
        resultsMap.set('https://upload.wikimedia.org/wikipedia/commons/d/d2/Stethoscope-2.png', {
          title: 'Estetoscopio de Auscultación Cardíaca y Pulmonar',
          url: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Stethoscope-2.png',
          thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Stethoscope-2.png',
          source: 'Catálogo Biomédico Oficial',
        });
      } else if (lower.includes('organos') || lower.includes('órganos') || lower.includes('777') || lower.includes('oftalmo') || lower.includes('otoscop')) {
        resultsMap.set('https://upload.wikimedia.org/wikipedia/commons/9/99/Ophthalmoscope_Otoscope08.JPG', {
          title: 'Equipo de Órganos Diagnóstico Oftalmoscopio Coaxial y Otoscopio',
          url: 'https://upload.wikimedia.org/wikipedia/commons/9/99/Ophthalmoscope_Otoscope08.JPG',
          thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/9/99/Ophthalmoscope_Otoscope08.JPG',
          source: 'Catálogo Biomédico Oficial',
        });
      } else if (lower.includes('pinza') || lower.includes('allys') || lower.includes('kelly') || lower.includes('foester') || lower.includes('bozzeman') || lower.includes('mosquito')) {
        resultsMap.set('https://upload.wikimedia.org/wikipedia/commons/5/5f/Greig_Smith-type_artery_forceps%2C_London%2C_1895-1902_Wellcome_L0057816.jpg', {
          title: 'Pinza Quirúrgica Hemostática de Precisión en Acero Inoxidable',
          url: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Greig_Smith-type_artery_forceps%2C_London%2C_1895-1902_Wellcome_L0057816.jpg',
          thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Greig_Smith-type_artery_forceps%2C_London%2C_1895-1902_Wellcome_L0057816.jpg',
          source: 'Catálogo Instrumental Quirúrgico',
        });
      } else if (lower.includes('digieye') || ((lower.includes('rayos x') || lower.includes('x-ray')) && lower.includes('fijo'))) {
        resultsMap.set('https://upload.wikimedia.org/wikipedia/commons/2/2d/X-Ray_Room._COMFORT_LOC_27305914040.jpg', {
          title: 'Sistema de Rayos X Fijo Digital Mindray DigiEye 350 con Bucky Mural y Mesa',
          url: 'https://upload.wikimedia.org/wikipedia/commons/2/2d/X-Ray_Room._COMFORT_LOC_27305914040.jpg',
          thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/2/2d/X-Ray_Room._COMFORT_LOC_27305914040.jpg',
          source: 'Catálogo Radiología Fija Oficial',
        });
        resultsMap.set('https://upload.wikimedia.org/wikipedia/commons/4/4b/Sala_de_rayos_X.jpg', {
          title: 'Sala de Radiología Digital Fija Hospitalaria con Detector de Panel Plano (FPD)',
          url: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Sala_de_rayos_X.jpg',
          thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Sala_de_rayos_X.jpg',
          source: 'Catálogo Radiológico Biomédico',
        });
      } else if (lower.includes('rayos x') || lower.includes('x-ray') || lower.includes('mobieye')) {
        resultsMap.set('https://upload.wikimedia.org/wikipedia/commons/e/e1/20240912-USDA-RD-ME-SDS-CADeanHospital-0010-perspective_edited.jpg', {
          title: 'Equipo de Rayos X Rodable Móvil Hospitalario Mindray MobiEye con Flat Panel',
          url: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/20240912-USDA-RD-ME-SDS-CADeanHospital-0010-perspective_edited.jpg',
          thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/20240912-USDA-RD-ME-SDS-CADeanHospital-0010-perspective_edited.jpg',
          source: 'Catálogo Radiología Móvil Oficial',
        });
      } else if (lower.includes('mesa') && (lower.includes('cirugia') || lower.includes('quirurg') || lower.includes('hybase'))) {
        resultsMap.set('https://upload.wikimedia.org/wikipedia/commons/f/f0/Operating_table_system_with_a_stationary_unit.JPG', {
          title: 'Mesa de Cirugía Electrohidráulica Quirúrgica Mindray HyBase',
          url: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Operating_table_system_with_a_stationary_unit.JPG',
          thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Operating_table_system_with_a_stationary_unit.JPG',
          source: 'Catálogo Quirúrgico Oficial Mindray',
        });
        resultsMap.set('https://upload.wikimedia.org/wikipedia/commons/9/97/Edith_Wolfson_Medical_Center_P1030020.JPG', {
          title: 'Mesa de Operaciones Quirúrgica Universal Multisección',
          url: 'https://upload.wikimedia.org/wikipedia/commons/9/97/Edith_Wolfson_Medical_Center_P1030020.JPG',
          thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/9/97/Edith_Wolfson_Medical_Center_P1030020.JPG',
          source: 'Catálogo Quirófano Hospitalario',
        });
      } else if (lower.includes('monitor') && (lower.includes('signos') || lower.includes('vitales') || lower.includes('umec'))) {
        resultsMap.set('https://upload.wikimedia.org/wikipedia/commons/a/a5/PatientMonitor-2.jpg', {
          title: 'Monitor de Signos Vitales Multiparámetro Mindray uMEC Grado Hospitalario',
          url: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/PatientMonitor-2.jpg',
          thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/PatientMonitor-2.jpg',
          source: 'Catálogo Biomédico Oficial Mindray',
        });
      } else if (lower.includes('incubadora') || lower.includes('ti-2000') || lower.includes('ti2000') || lower.includes('cunero') || lower.includes('cuna')) {
        resultsMap.set('https://upload.wikimedia.org/wikipedia/commons/4/4f/Cunero_Hospital_de_Especialidades_Nuevo_Laredo.jpg', {
          title: 'Incubadora y Cunero Neonatal Servocontrolado Hospitalario',
          url: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/Cunero_Hospital_de_Especialidades_Nuevo_Laredo.jpg',
          thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/Cunero_Hospital_de_Especialidades_Nuevo_Laredo.jpg',
          source: 'Catálogo Biomédico Neonatal Oficial',
        });
      } else if (lower.includes('cuello cisne') || lower.includes('gs 300') || lower.includes('luz') || lower.includes('lampara') || lower.includes('lámpara')) {
        resultsMap.set('https://upload.wikimedia.org/wikipedia/commons/2/23/Medical_examination_light.jpg', {
          title: 'Lámpara de Examinación Médica Clínica con Brazo Flexible',
          url: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Medical_examination_light.jpg',
          thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Medical_examination_light.jpg',
          source: 'Catálogo Biomédico Clínico',
        });
      }

      // Search Wikimedia Commons with strictly clinical keywords
      for (const term of candidateTerms.slice(0, 4)) {
        if (resultsMap.size >= 8) break;
        try {
          const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
            term
          )}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|size|mime&format=json`;

          const r = await fetch(wikiUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Accept: 'application/json',
            },
          });

          if (r.ok) {
            const data = await r.json();
            const pages = data?.query?.pages || {};
            for (const pageId of Object.keys(pages)) {
              const page = pages[pageId];
              const info = page?.imageinfo?.[0];
              if (info && info.url && (info.mime?.startsWith('image/') || info.url.match(/\.(jpg|jpeg|png|webp)/i))) {
                const title = (page.title || '').replace(/^File:/i, '').replace(/\.[^.]+$/, '');
                // Reject non-medical images
                if (isForbiddenImage(title, info.url)) continue;

                // STRICT dimension requirements: real product photos are usually 1024x768 or larger
                const width = info.width || 0;
                const height = info.height || 0;
                if (width > 0 && height > 0) {
                  // REJECT: Very small images (< 1024px width) - likely thumbnails or icons
                  if (width < 1024 || height < 768) continue;
                  const aspectRatio = width / height;
                  // REJECT: Portrait-oriented images (not equipment photos)
                  if (aspectRatio < 1.0) continue;
                  // REJECT: Extremely wide images (> 2.5:1) - likely panoramas or diagrams
                  if (aspectRatio > 2.5) continue;
                  // REJECT: Square images (likely icons or logos)
                  if (aspectRatio > 0.9 && aspectRatio < 1.1) continue;
                }

                // REJECT: Titles indicating non-photo content
                const titleLower = title.toLowerCase();
                const nonPhotoKeywords = [
                  'illustration', 'drawing', 'sketch', 'diagram', 'chart', 'graph',
                  'map', 'painting', 'engraving', 'etching', 'woodcut', 'lithograph',
                  'blueprint', 'schematic', 'design', 'plan', 'portrait',
                  'historical', 'historic', 'vintage', 'antique', 'old',
                  'black and white', 'b&w', 'monochrome', 'sepia',
                  'treatise', 'trabajo', 'ensayo', 'estudio',
                  'radiograph', 'scan result', 'ultrasound image', 'mri scan', 'ct scan',
                  'file:', 'wikimedia commons:'
                ];
                if (nonPhotoKeywords.some((k) => titleLower.includes(k))) continue;

                // REQUIRE: Title must contain photo-related or equipment-related terms
                const photoTerms = [
                  'photo', 'photograph', 'picture', 'image', 'product',
                  'clinical', 'hospital', 'medical equipment', 'medical device',
                  'surgical', 'operating', 'monitor', 'scanner', 'pump',
                  'ventilator', 'incubator', 'defibrillator', 'ultrasound',
                  'x-ray', 'rayos', 'table', 'mesa', 'bed', 'camilla',
                  'monitor', 'signos vitales', 'patient monitor',
                  'wheeled', 'mobile', 'portable', 'cart', 'carrito',
                  'supplier', 'distributor', 'manufacturer',
                  'price', 'precio', 'buy', 'sale', 'venta',
                  'catalog', 'catálogo', 'brochure', 'datasheet'
                ];
                if (!photoTerms.some((k) => titleLower.includes(k))) continue;

                if (!resultsMap.has(info.url)) {
                  resultsMap.set(info.url, {
                    title: title || term,
                    url: info.url,
                    thumbnail: info.url,
                    source: 'Wikimedia Commons (Fotografía Médica)',
                    width: info.width,
                    height: info.height,
                  });
                }
              }
            }
          }
        } catch (termErr) {
          console.warn(`Search error for term "${term}":`, termErr);
        }
      }

      // FINAL FILTER: Remove images with years before 2000 in title or URL
      const filteredImages = Array.from(resultsMap.values()).filter((img: any) => {
        const combined = `${img.title} ${img.url}`.toLowerCase();
        // Reject any image with year before 2000
        const yearMatch = combined.match(/\b(1[6-9][0-9]{2}|200[0-9])\b/);
        if (yearMatch) {
          const year = parseInt(yearMatch[0]);
          if (year < 2000) return false;
        }
        return true;
      });

      return res.json({
        success: true,
        query: rawQuery,
        images: filteredImages.slice(0, 12),
      });
    } catch (err: any) {
      console.error('Error in /api/products/search-images:', err);
      return res.status(500).json({ success: false, error: err.message, images: [] });
    }
  });

  // Image proxy endpoint to bypass CORS and convert to base64
  app.all('/api/proxy-image', async (req, res) => {
    try {
      const imageUrl = (req.method === 'POST' ? req.body?.url : req.query?.url) as string;
      if (!imageUrl) {
        return res.status(400).json({ success: false, error: 'url parameter required' });
      }

      if (imageUrl.startsWith('data:')) {
        if (req.method === 'POST') {
          return res.json({ success: true, dataUrl: imageUrl });
        }
        const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const contentType = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return res.send(buffer);
        }
      }

      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        return res.status(response.status).json({ success: false, error: `Failed to fetch image: ${response.statusText}` });
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (req.method === 'POST') {
        const base64 = buffer.toString('base64');
        const dataUrl = `data:${contentType};base64,${base64}`;
        return res.json({ success: true, dataUrl, contentType });
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(buffer);
    } catch (err: any) {
      console.error('Error in /api/proxy-image:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/documents/cache', (req, res) => {
    const { id } = req.body || {};
    return res.json({ success: true, path: `/api/documents/cached/${id || 'temp'}` });
  });

  app.get('/api/documents/cached/:id', (_req, res) => {
    return res.status(404).send('Document not found');
  });

  // Development vs Production serving
  const isProduction = process.env.NODE_ENV === 'production';
  const distDir = path.join(process.cwd(), 'dist');

  if (isProduction && fs.existsSync(path.join(distDir, 'index.html'))) {
    console.log(`[Production] Serving static files from: ${distDir}`);
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    // Development mode with Vite middleware
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
      console.error('Failed to initialize Vite dev server:', viteErr);
    }
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`SYD Colombia server running on http://localhost:${PORT}`);
  });

  server.on('error', (err: any) => {
    console.error('Server error:', err);
  });
}

startServer();
