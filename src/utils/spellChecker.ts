/**
 * Spanish biomedical, commercial, and technical spell checker with accent and typo detection.
 * Provides real-time suggestions and one-click corrections via right-click or contextual menu.
 */

// Dictionary mapping normalized/unaccented or misspelled lowercase words to their correct Spanish form
const SPANISH_DICTIONARY: Record<string, string> = {
  // Medical & Biomedical Equipment & Parts
  medico: 'médico',
  medica: 'médica',
  medicos: 'médicos',
  medicas: 'médicas',
  biomedico: 'biomédico',
  biomedica: 'biomédica',
  biomedicos: 'biomédicos',
  biomedicas: 'biomédicas',
  clinico: 'clínico',
  clinica: 'clínica',
  clinicos: 'clínicos',
  clinicas: 'clínicas',
  quirurgico: 'quirúrgico',
  quirurgica: 'quirúrgica',
  quirurgicos: 'quirúrgicos',
  quirurgicas: 'quirúrgicas',
  diagnostico: 'diagnóstico',
  diagnostica: 'diagnóstica',
  diagnosticos: 'diagnósticos',
  terapeutico: 'terapéutico',
  terapeutica: 'terapéutica',
  oxigeno: 'oxígeno',
  succion: 'succión',
  aspiracion: 'aspiración',
  presion: 'presión',
  pulmonar: 'pulmonar',
  respiracion: 'respiración',
  ventilacion: 'ventilación',
  ventilador: 'ventilador',
  desfibrilacion: 'desfibrilación',
  desfibrilador: 'desfibrilador',
  monitorizacion: 'monitorización',
  electrodos: 'electrodos',
  bateria: 'batería',
  baterias: 'baterías',
  valvula: 'válvula',
  valvulas: 'válvulas',
  tubo: 'tubo',
  tubos: 'tubos',
  sensor: 'sensor',
  sensores: 'sensores',
  camara: 'cámara',
  camaras: 'cámaras',
  optico: 'óptico',
  optica: 'óptica',
  opticos: 'ópticos',
  laser: 'láser',
  rayos: 'rayos',
  ultrasonido: 'ultrasonido',
  ecografo: 'ecógrafo',
  endoscopio: 'endoscopio',
  laringoscopio: 'laringoscopio',
  esterilizador: 'esterilizador',
  autoclave: 'autoclave',

  // Technical & Industrial
  tecnico: 'técnico',
  tecnica: 'técnica',
  tecnicos: 'técnicos',
  tecnicas: 'técnicas',
  tecnologia: 'tecnología',
  tecnologias: 'tecnologías',
  electrico: 'eléctrico',
  electrica: 'eléctrica',
  electricos: 'eléctricos',
  electricas: 'eléctricas',
  electronico: 'electrónico',
  electronica: 'electrónica',
  electronicos: 'electrónicos',
  electronicas: 'electrónicas',
  mecanico: 'mecánico',
  mecanica: 'mecánica',
  automatico: 'automático',
  automatica: 'automática',
  automaticos: 'automáticos',
  automaticas: 'automáticas',
  estandar: 'estándar',
  estandares: 'estándares',
  codigo: 'código',
  codigos: 'códigos',
  modulo: 'módulo',
  modulos: 'módulos',
  calibracion: 'calibración',
  instalacion: 'instalación',
  configuracion: 'configuración',
  operacion: 'operación',
  supervision: 'supervisión',
  revision: 'revisión',
  capacitacion: 'capacitación',
  mantenimiento: 'mantenimiento',
  garantia: 'garantía',
  garantias: 'garantías',
  guia: 'guía',
  guias: 'guías',
  linea: 'línea',
  lineas: 'líneas',

  // Commercial, Financial & Administrative
  cotizacion: 'cotización',
  cotizaciones: 'cotizaciones',
  descripcion: 'descripción',
  descripciones: 'descripciones',
  adquisicion: 'adquisición',
  adquisiciones: 'adquisiciones',
  atencion: 'atención',
  informacion: 'información',
  condicion: 'condición',
  condiciones: 'condiciones',
  resolucion: 'resolución',
  resoluciones: 'resoluciones',
  autorizacion: 'autorización',
  autorizaciones: 'autorizaciones',
  certificacion: 'certificación',
  certificaciones: 'certificaciones',
  declaracion: 'declaración',
  declaraciones: 'declaraciones',
  facturacion: 'facturación',
  factura: 'factura',
  recepcion: 'recepción',
  devolucion: 'devolución',
  anulacion: 'anulación',
  version: 'versión',
  versiones: 'versiones',
  numero: 'número',
  numeros: 'números',
  articulo: 'artículo',
  articulos: 'artículos',
  termino: 'término',
  terminos: 'términos',
  politica: 'política',
  politicas: 'políticas',
  envio: 'envío',
  envios: 'envíos',
  dia: 'día',
  dias: 'días',
  ano: 'año',
  anos: 'años',
  compania: 'compañía',
  companias: 'compañías',
  institucion: 'institución',
  instituciones: 'instituciones',
  asociacion: 'asociación',
  corporacion: 'corporación',
  fundacion: 'fundación',
  administracion: 'administración',
  senor: 'señor',
  senores: 'señores',
  senora: 'señora',
  senoras: 'señoras',
  periodo: 'período',
  credito: 'crédito',
  debito: 'débito',
  deposito: 'depósito',
  maximo: 'máximo',
  maxima: 'máxima',
  minimo: 'mínimo',
  minima: 'mínima',
  unico: 'único',
  unica: 'única',
  basico: 'básico',
  basica: 'básica',
  optimo: 'óptimo',
  optima: 'óptima',
  validez: 'validez',
  area: 'área',
  areas: 'áreas',

  // Common Grammatical Words & Conjugations
  tambien: 'también',
  ademas: 'además',
  despues: 'después',
  mas: 'más',
  esta: 'está',
  estan: 'están',
  sera: 'será',
  seran: 'serán',
  estara: 'estará',
  estaran: 'estarán',
  tendra: 'tendrá',
  tendran: 'tendrán',
  podra: 'podrá',
  podran: 'podrán',
  habra: 'habrá',
  incluira: 'incluirá',
  incluiran: 'incluirán',
  segun: 'según',
  aqui: 'aquí',
  alla: 'allá',
  ahi: 'ahí',
  asi: 'así',
  facil: 'fácil',
  dificil: 'difícil',
  util: 'útil',
  inutil: 'inútil',
  rapido: 'rápido',
  rapida: 'rápida',

  // Colombian Geography & Cities
  bogota: 'Bogotá',
  medellin: 'Medellín',
  cali: 'Cali',
  barranquilla: 'Barranquilla',
  cartagena: 'Cartagena',
  bucaramanga: 'Bucaramanga',
  pereira: 'Pereira',
  manizales: 'Manizales',
  ibague: 'Ibagué',
  cucuta: 'Cúcuta',
  monteria: 'Montería',
  popayan: 'Popayán',
  quibdo: 'Quibdó',
  neiva: 'Neiva',
  valledupar: 'Valledupar',
  pasto: 'Pasto',
  armenia: 'Armenia',
  sincelejo: 'Sincelejo',
  riohacha: 'Riohacha',
  villavicencio: 'Villavicencio',
  arauca: 'Arauca',
  florencia: 'Florencia',
  mocoa: 'Mocoa',
  mitu: 'Mitú',
  yopal: 'Yopal',
  leticia: 'Leticia',
  sanandres: 'San Andrés',
  bolivar: 'Bolívar',
  boyaca: 'Boyacá',
  cordoba: 'Córdoba',
  quindio: 'Quindío',
  choco: 'Chocó',
  guainia: 'Guainía',
  vaupes: 'Vaupés',
  atlantico: 'Atlántico',

  // Common Names, Surnames and Historical Institution Names
  napoleon: 'Napoleón',
  simon: 'Simón',
  ramon: 'Ramón',
  martin: 'Martín',
  gonzalez: 'González',
  rodriguez: 'Rodríguez',
  hernandez: 'Hernández',
  martinez: 'Martínez',
  perez: 'Pérez',
  gomez: 'Gómez',
  sanchez: 'Sánchez',
  diaz: 'Díaz',
  alvarez: 'Álvarez',
  ramirez: 'Ramírez',
  suarez: 'Suárez',
  benitez: 'Benítez',
  guzman: 'Guzmán',
  jesus: 'Jesús',
  maria: 'María',
  jose: 'José',
  corazon: 'Corazón',

  // Common Typos & Phonetic Misspellings
  desctipcion: 'descripción',
  descriptcion: 'descripción',
  cotisacion: 'cotización',
  garantea: 'garantía',
  resibido: 'recibido',
  isntalacion: 'instalación',
  calibrasion: 'calibración',
  mantenimineto: 'mantenimiento',
  equpo: 'equipo',
  presio: 'precio',
  subtottal: 'subtotal',
  accesorios: 'accesorios',
  acesorios: 'accesorios',
  acesorio: 'accesorio',
  accesoriosx: 'accesorios',
};

// Common word endings rules that consistently need accents in Spanish
const SUFFIX_RULES: Array<{ regex: RegExp; replacement: string }> = [
  { regex: /([a-zñ]+)cion$/i, replacement: '$1ción' },
  { regex: /([a-zñ]+)ciones$/i, replacement: '$1ciones' },
  { regex: /([a-zñ]+)sion$/i, replacement: '$1sión' },
  { regex: /([a-zñ]+)siones$/i, replacement: '$1siones' },
  { regex: /([a-zñ]+)logia$/i, replacement: '$1logía' },
  { regex: /([a-zñ]+)logias$/i, replacement: '$1logías' },
  { regex: /([a-zñ]+)grafia$/i, replacement: '$1grafía' },
  { regex: /([a-zñ]+)grafias$/i, replacement: '$1grafías' },
  { regex: /([a-zñ]+)scopia$/i, replacement: '$1scopía' },
  { regex: /([a-zñ]+)scopias$/i, replacement: '$1scopías' },
  { regex: /([a-zñ]+)tria$/i, replacement: '$1tría' },
  { regex: /([a-zñ]{2,})on$/i, replacement: '$1ón' },
  { regex: /([a-zñ]{2,})ones$/i, replacement: '$1ones' },
];

/**
 * Strips diacritics / accents from text for normalization
 */
export function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Calculates Levenshtein distance between two strings
 */
function levenshtein(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = Array.from({ length: bn + 1 }, (_, i) => [i]);
  for (let i = 0; i <= an; i++) matrix[0][i] = i;
  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1) // insertion / deletion
        );
      }
    }
  }
  return matrix[bn][an];
}

/**
 * Preserves the casing of originalWord in targetWord (UPPERCASE, TitleCase, lowercase)
 */
export function matchCase(originalWord: string, targetWord: string): string {
  if (!originalWord || !targetWord) return targetWord;

  // ALL UPPERCASE
  if (originalWord === originalWord.toUpperCase() && originalWord !== originalWord.toLowerCase()) {
    return targetWord.toUpperCase();
  }

  // Title Case (e.g., Cotizacion -> Cotización)
  const isTitleCase =
    originalWord[0] === originalWord[0].toUpperCase() &&
    originalWord.slice(1) === originalWord.slice(1).toLowerCase();
  if (isTitleCase) {
    return targetWord.charAt(0).toUpperCase() + targetWord.slice(1).toLowerCase();
  }

  // Otherwise lowercase
  return targetWord.toLowerCase();
}

// Common valid Spanish words that do NOT have accents and should not trigger false suggestions
const COMMON_VALID_WORDS = new Set([
  'a', 'al', 'algo', 'alguno', 'ante', 'aquel', 'aquella', 'aquello',
  'bien', 'cada', 'casa', 'caso', 'cero', 'como', 'con', 'contra', 'cosa', 'cual',
  'cuando', 'de', 'del', 'desde', 'donde', 'dos', 'el', 'ella', 'ello', 'ellos',
  'en', 'entre', 'era', 'eran', 'es', 'esa', 'ese', 'eso', 'esos', 'este',
  'esto', 'estos', 'fin', 'fue', 'gran', 'ha', 'habia', 'hace', 'hacer', 'hasta',
  'la', 'las', 'le', 'les', 'lo', 'los', 'mayor', 'me', 'medio', 'menos',
  'mi', 'mis', 'mismo', 'muy', 'nada', 'ni', 'no', 'nos', 'nosotros', 'o', 'otra',
  'otro', 'otros', 'para', 'parte', 'pero', 'poco', 'por', 'porque', 'primero',
  'que', 'quien', 'quienes', 'se', 'sea', 'ser', 'si', 'sido', 'siempre',
  'sin', 'sobre', 'solo', 'somos', 'son', 'su', 'sus', 'tal', 'tanto',
  'te', 'tener', 'tiempo', 'tiene', 'tienen', 'toda', 'todas', 'todo', 'todos',
  'tras', 'tres', 'tu', 'tus', 'un', 'una', 'unas', 'uno', 'unos', 'va', 'vamos',
  'van', 'vez', 'veces', 'vida', 'ya', 'yo',
  // Common business & medical words that have no accent
  'equipo', 'equipos', 'marca', 'marcas', 'modelo', 'modelos', 'precio', 'precios',
  'costo', 'costos', 'venta', 'ventas', 'compra', 'compras', 'contrato', 'contratos',
  'orden', 'hospital', 'hospitales', 'salud', 'paciente', 'pacientes',
  'fecha', 'fechas', 'ciudad', 'ciudades', 'nombre', 'nombres', 'entrega', 'entregas',
  'pago', 'pagos', 'banco', 'bancos', 'cuenta', 'cuentas', 'firma', 'firmas',
  'documento', 'documentos', 'archivo', 'archivos', 'registro', 'registros', 'nuevo', 'nueva'
]);

// User-ignored words (session & persistent)
const ignoredWordsSet = new Set<string>();

export function ignoreWord(word: string): void {
  if (!word) return;
  const clean = word.toLowerCase().trim();
  ignoredWordsSet.add(clean);
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = JSON.parse(localStorage.getItem('syd_ignored_spelling_words') || '[]');
      if (!stored.includes(clean)) {
        stored.push(clean);
        localStorage.setItem('syd_ignored_spelling_words', JSON.stringify(stored));
      }
    }
  } catch (e) {
    // Ignore storage issues
  }
}

export function isWordIgnored(word: string): boolean {
  if (!word) return false;
  const clean = word.toLowerCase().trim();
  if (ignoredWordsSet.has(clean)) return true;
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = JSON.parse(localStorage.getItem('syd_ignored_spelling_words') || '[]');
      if (stored.includes(clean)) {
        ignoredWordsSet.add(clean);
        return true;
      }
    }
  } catch (e) {
    // Ignore storage issues
  }
  return false;
}

export function unignoreWord(word: string): void {
  if (!word) return;
  const clean = word.toLowerCase().trim();
  ignoredWordsSet.delete(clean);
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = JSON.parse(localStorage.getItem('syd_ignored_spelling_words') || '[]');
      const filtered = stored.filter((w: string) => w !== clean);
      localStorage.setItem('syd_ignored_spelling_words', JSON.stringify(filtered));
    }
  } catch (e) {
    // Ignore storage issues
  }
}

/**
 * Gets spelling suggestions for a word
 */
export function getSpellingSuggestions(rawWord: string): string[] {
  const cleanWord = rawWord.trim().replace(/^[^a-zA-ZáéíóúÁÉÍÓÚñÑ]+|[^a-zA-ZáéíóúÁÉÍÓÚñÑ]+$/g, '');
  if (!cleanWord || cleanWord.length < 2) return [];

  if (isWordIgnored(cleanWord)) {
    return [];
  }

  const lower = cleanWord.toLowerCase();
  const normalized = removeAccents(lower);
  const suggestions: string[] = [];

  // 1. Direct dictionary match (exact normalized / typo match)
  if (SPANISH_DICTIONARY[normalized]) {
    const formatted = matchCase(cleanWord, SPANISH_DICTIONARY[normalized]);
    if (formatted !== cleanWord && !suggestions.includes(formatted)) {
      suggestions.push(formatted);
    }
  }
  if (SPANISH_DICTIONARY[lower]) {
    const formatted = matchCase(cleanWord, SPANISH_DICTIONARY[lower]);
    if (formatted !== cleanWord && !suggestions.includes(formatted)) {
      suggestions.push(formatted);
    }
  }

  // 2. Suffix rules (words ending in -cion, -sion, -logia, etc.)
  for (const rule of SUFFIX_RULES) {
    if (rule.regex.test(lower)) {
      const fixed = lower.replace(rule.regex, rule.replacement);
      const formatted = matchCase(cleanWord, fixed);
      if (formatted !== cleanWord && !suggestions.includes(formatted)) {
        suggestions.push(formatted);
      }
    }
  }

  // 3. Approximate fuzzy match via Levenshtein distance (only for typos, dist === 1, not common valid words)
  if (suggestions.length === 0 && lower.length >= 5 && !COMMON_VALID_WORDS.has(lower)) {
    const candidates: Array<{ word: string; dist: number }> = [];
    for (const [key, correct] of Object.entries(SPANISH_DICTIONARY)) {
      if (Math.abs(key.length - lower.length) <= 1) {
        const dist = levenshtein(lower, key);
        if (dist === 1 && correct.toLowerCase() !== lower) {
          candidates.push({ word: correct, dist });
        }
      }
    }
    candidates.sort((a, b) => a.dist - b.dist);
    for (const cand of candidates.slice(0, 2)) {
      const formatted = matchCase(cleanWord, cand.word);
      if (formatted !== cleanWord && !suggestions.includes(formatted)) {
        suggestions.push(formatted);
      }
    }
  }

  return suggestions;
}

/**
 * Returns true if the word has an accent or spelling issue
 */
export function hasSpellingIssue(rawWord: string): boolean {
  return getSpellingSuggestions(rawWord).length > 0;
}

/**
 * Extracts the word and range boundaries under a given cursor index in text
 */
export function getWordAtCursor(
  text: string,
  cursorIndex: number
): { word: string; start: number; end: number } | null {
  if (!text || cursorIndex < 0 || cursorIndex > text.length) return null;

  const isWordChar = (char: string) => /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(char);

  let start = cursorIndex;
  let end = cursorIndex;

  // If clicked right after a word, look back
  if (start > 0 && !isWordChar(text[start]) && isWordChar(text[start - 1])) {
    start--;
    end--;
  }

  if (!isWordChar(text[start])) {
    return null;
  }

  while (start > 0 && isWordChar(text[start - 1])) {
    start--;
  }

  while (end < text.length && isWordChar(text[end])) {
    end++;
  }

  const word = text.slice(start, end);
  return { word, start, end };
}

/**
 * Scans an entire text block and automatically applies accents and corrections
 */
export function autoCorrectText(text: string): { correctedText: string; fixesCount: number } {
  if (!text) return { correctedText: '', fixesCount: 0 };

  let fixesCount = 0;
  const wordRegex = /[a-zA-ZáéíóúÁÉÍÓÚñÑ]+/g;

  const correctedText = text.replace(wordRegex, (match) => {
    const suggestions = getSpellingSuggestions(match);
    if (suggestions.length > 0) {
      fixesCount++;
      return suggestions[0];
    }
    return match;
  });

  return { correctedText, fixesCount };
}

/**
 * Finds all misspelled/unaccented words in a text string along with character positions and suggestions
 */
export function findSpellingErrorsInText(
  text: string
): Array<{ word: string; start: number; end: number; suggestions: string[] }> {
  if (!text) return [];
  const results: Array<{ word: string; start: number; end: number; suggestions: string[] }> = [];
  const wordRegex = /[a-zA-ZáéíóúÁÉÍÓÚñÑ]+/g;
  let match: RegExpExecArray | null;

  while ((match = wordRegex.exec(text)) !== null) {
    const rawWord = match[0];
    if (isWordIgnored(rawWord)) continue;
    const suggestions = getSpellingSuggestions(rawWord);
    if (suggestions.length > 0) {
      results.push({
        word: rawWord,
        start: match.index,
        end: match.index + rawWord.length,
        suggestions,
      });
    }
  }
  return results;
}
