/**
 * Specialized utility for detecting medical equipment, supplies, parts, and accessories,
 * and rigorously filtering out conversational email noise, staff signatures, greetings,
 * headers, and administrative notices.
 */

// Comprehensive dictionary of clinical, biomedical, surgical, orthopedic, physiotherapy, and diagnostic keywords
const MEDICAL_EQUIPMENT_KEYWORDS: string[] = [
  // Physiotherapy, Orthopedics & Rehabilitation
  'paquete frio',
  'paquete caliente',
  'paquete',
  'compresa fria',
  'compresa caliente',
  'compresa de gel',
  'compresa',
  'cold pack',
  'hot pack',
  'hydrocollator',
  'theraband',
  'thera-band',
  'banda elastica',
  'banda de resistencia',
  'banda theraband',
  'banda',
  'bolas para masajes',
  'bola para masajes',
  'pelota de masaje',
  'pelotas para masajes',
  'pelota terapeutica',
  'masajeador',
  'masajes',
  'masaje',
  'rodillo de masaje',
  'foam roller',
  'ortesis',
  'protesis',
  'prótesis',
  'ferula',
  'férula',
  'inmovilizador',
  'cabestrillo',
  'cuellera',
  'collarin cervical',
  'collarin',
  'collarín',
  'faja lumbar',
  'faja',
  'soporte de rodilla',
  'rodillera',
  'tobillera',
  'muñequera',
  'codera',
  'coderas',
  'electroterapia',
  'tens',
  'ems',
  'corrientes rusas',
  'ultrasonido terapeutico',
  'tanque de parafina',
  'parafina',
  'dinamometro',
  'dinamómetro',
  'goniometro',
  'goniómetro',
  'pesas',
  'mancuerna',
  'mancuernas',
  'balancin',
  'balancín',
  'bosu',
  'traccion cervical',
  'tracción cervical',
  'ortopedico',
  'ortopédico',
  'fisioterapia',
  'rehabilitacion',
  'rehabilitación',

  // Critical Care, Surgery, Anesthesia & Monitoring
  'laringoscopio',
  'hoja de laringoscopio',
  'hoja macintosh',
  'hoja miller',
  'hojas para adulto',
  'hojas para pediatrico',
  'mango de laringoscopio',
  'mango laringoscopio',
  'fibra optica',
  'fibra óptica',
  'bombillo laringoscopio',
  'estuche laringoscopio',
  'monitor de signos vitales',
  'monitor multiparametrico',
  'monitor',
  'desfibrilador',
  'dea',
  'electrocardiografo',
  'electrocardiógrafo',
  'ecg',
  'ekg',
  'bomba de infusion',
  'bomba de infusión',
  'bomba de jeringa',
  'infusion',
  'infusión',
  'nutricion enteral',
  'nutrición enteral',
  'ventilador mecanico',
  'ventilador mecánico',
  'ventilador',
  'respirador',
  'maquina de anestesia',
  'máquina de anestesia',
  'anestesia',
  'vaporizador',
  'ecografo',
  'ecógrafo',
  'ultrasonido',
  'transductor',
  'sonda ecografica',
  'sonda ecográfica',
  'aspirador de secreciones',
  'aspirador',
  'succion',
  'succión',
  'cavitron',
  'cavitrón',
  'lampara cialitica',
  'lámpara cialítica',
  'lampara de cirugia',
  'lámpara de cirugía',
  'lampara de fototerapia',
  'lámpara de fototerapia',
  'mesa de cirugia',
  'mesa de cirugía',
  'mesa quirurgica',
  'mesa quirúrgica',
  'cama hospitalaria',
  'camilla',
  'cuna termica',
  'cuna térmica',
  'incubadora',
  'autoclave',
  'esterilizador',
  'selladora',
  'destilador',

  // Diagnostic & Outpatient
  'fonendoscopio',
  'estetoscopio',
  'tensiometro',
  'tensiómetro',
  'esfigmomanometro',
  'esfigmomanómetro',
  'regulador de oxigeno',
  'regulador de oxígeno',
  'regulador',
  'flujometro',
  'flujómetro',
  'humificador',
  'humidificador',
  'concentrador de oxigeno',
  'concentrador de oxígeno',
  'concentrador',
  'espirometro',
  'espirómetro',
  'holter',
  'mapa',
  'glucometro',
  'glucómetro',
  'termometro',
  'termómetro',
  'oximetro',
  'oxímetro',
  'pulsioximetro',
  'pulsioxímetro',
  'otoscopio',
  'oftalmoscopio',
  'equipo de organos',
  'equipo de órganos',

  // Clinical Parts, Cables, Probes, Consumables & Spares
  'sensor spo2',
  'sensor de spo2',
  'sensor clip',
  'sensor',
  'cable ecg',
  'cable paciente',
  'cable troncal',
  'derivacion',
  'derivación',
  'leadwire',
  'latiguillo',
  'brazalete de presion',
  'brazalete de presión',
  'brazalete',
  'manguito de presion',
  'manguito',
  'cuff',
  'circuito respiratorio',
  'circuito de paciente',
  'mascara',
  'máscara',
  'mascarilla',
  'canula nasal',
  'cánula nasal',
  'canula',
  'cánula',
  'filtro hme',
  'filtro bacteriano',
  'trampa de agua',
  'celda de o2',
  'celda de oxigeno',
  'sensor de flujo',
  'linea de muestreo',
  'línea de muestreo',
  'electrodo',
  'electrodos',
  'gel conductor',
  'papel termico',
  'papel térmico',
  'papel ecg',
  'bateria medica',
  'batería médica',
  'fuente de poder',
  'cargador',
  'diafragma',
  'oliva',
  'olivas',
  'auricular',
  'campana',
  'pera',
  'valvula',
  'válvula',
  'manometro',
  'manómetro',
  'reutilizable',
  'desechable',
  'equipo biomedico',
  'equipo biomédico',
  'parte oficial',
  'repuesto',
  'accesorio',
  'kit de partes',
  'dispositivo medico',
  'dispositivo médico',
];

// Medical manufacturers and brands frequently appearing in hospital procurement
const KNOWN_MEDICAL_BRANDS: string[] = [
  'chattanooga',
  'theraband',
  'thera-band',
  'futuro ortopedicos',
  'futuro ortopédicos',
  'futuro',
  'mindray',
  'welch allyn',
  'kawe',
  'riester',
  'littmann',
  'philips',
  'ge healthcare',
  'draeger',
  'dräger',
  'tecnica electromedica',
  'técnica electromédica',
  'edan',
  'contec',
  'bionet',
  'zoll',
  'medtronic',
  'covidien',
  'masimo',
  'nellcor',
  'bowa',
  'erbe',
  'storz',
  'olympus',
  'fukuda',
  'schiller',
];

/**
 * Checks if a string contains any recognized medical equipment, supplies, parts, or orthopedic/physiotherapy keywords.
 */
export function isMedicalEquipmentOrSupply(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const clean = text.toLowerCase().trim();
  if (clean.length < 3) return false;

  // First check if it's pure noise or greetings or signatures
  if (isSignatureOrHeaderOrNoise(clean)) return false;

  // Check against keywords
  for (const keyword of MEDICAL_EQUIPMENT_KEYWORDS) {
    if (clean.includes(keyword)) {
      return true;
    }
  }

  // Check against brands
  for (const brand of KNOWN_MEDICAL_BRANDS) {
    if (clean.includes(brand)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a line is conversational noise, an email greeting, personal signature,
 * corporate role, contact information, disclaimers, or thread metadata.
 */
export function isSignatureOrHeaderOrNoise(rawLine: string): boolean {
  if (!rawLine || typeof rawLine !== 'string') return true;
  const line = rawLine.trim();
  if (line.length < 3) return true;
  const l = line.toLowerCase();

  // 1. Email Greetings (e.g. "Buen dia", "Buenos días", "Buenas tardes", "Hola", etc.)
  if (
    /^(?:buen\s+d[ií]a|buenos\s+d[ií]as|buenas\s+tardes|buenas\s+noches|hola|estimad[oa]s?|saludos?|un\s+saludo|feliz\s+d[ií]a|feliz\s+tarde|cordial\s+saludo|un\s+cordial\s+saludo)\b/i.test(l) ||
    /^(?:buen\s+d[ií]a|buenos\s+d[ií]as|buenas\s+tardes|buenas\s+noches)$/i.test(l) ||
    /\b(?:buen\s+d[ií]a|buenos\s+d[ií]as|buenas\s+tardes|buenas\s+noches)\b/i.test(l)
  ) {
    return true;
  }

  // 2. Personal Signatures & Known Staff Names (e.g. "Diana Figueroa Diaz", "Jose Luis Diaz", "Jairo Mendoza")
  if (
    /\b(?:diana\s+figueroa(?:\s+diaz)?|jose\s+luis(?:\s+diaz)?|jairo\s+mendoza|carlos\s+mendoza|mar[ií]a\s+gonz[aá]lez|auxiliar\s+administrativ[oa]|direcci[oó]n\s+t[eé]cnica|direccion\s+tecnica|compras\s+syd|suministro\s+y\s+dotaciones)\b/i.test(l)
  ) {
    return true;
  }

  // General 2-4 word personal name pattern without numbers or punctuation
  if (
    !line.includes(':') &&
    !line.includes('$') &&
    !/\d/.test(line) &&
    /^(?:diana|jose|josé|jairo|andr[ée]s|carlos|mar[ií]a|juan|pedro|luis|ana|gloria|claudia|jorge|fernando|ricardo|paola|sandra|patricia|m[oó]nica|diego|alberto|esperanza|martha)\s+(?:[A-Za-zñáéíóúÁÉÍÓÚ]+\s*){1,3}$/i.test(line)
  ) {
    return true;
  }

  // 3. Contact numbers, cell, fax, extension, PBX, WhatsApp
  if (
    /\b(?:tel(?:[ée]f)?|cel(?:ular)?|pbx|fax|ext|extensi[oó]n|movil|m[oó]vil|whatsapp)\b/i.test(l) ||
    /\b\+?\d{1,3}[\s-]?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}\b/.test(line) ||
    /<\(?\d{3}\)?%20\d+/.test(line) ||
    /%20\d{5,}/.test(line) ||
    /\(?\d{3}\)?\s*\d{6,8}/.test(line) ||
    /\bcel:\s*\+?\d+/i.test(line) ||
    /\(\d{3}\)\s*\d{3,4}[-\s]?\d{3,4}/.test(line)
  ) {
    return true;
  }

  // 4. Physical addresses and Colombian cities
  if (
    /\b(?:carrera|calle|diagonal|transversal|av(?:enida)?|cra\.?|cll?\.?|n[oó]\.?\s*\d+|barranquilla|bogot[aá]|medell[ií]n|cali|bucaramanga|cartagena|colombia|c\.?p\.?|c[oó]digo\s+postal)\b/i.test(l)
  ) {
    return true;
  }

  // 5. Email headers / client metadata / quote markers / URL encoded remnants
  if (
    /\b(?:escribi[oó]:|wrote:|de:|para:|enviado(?:\s+el)?:|fecha:|asunto:|subject:|sent:|cc:|bcc:)\b/i.test(l) ||
    /<[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}>/.test(line) ||
    /@syd\.com\.co|@gmail|@hotmail|@outlook|mailto:|https?:\/\/|<.*%20.*>|%20[0-9]{3,}/i.test(line) ||
    /^el\s+[a-z]{3,}\.?,\s+\d+\s+de\s+[a-z]+/i.test(l)
  ) {
    return true;
  }

  // 6. Corporate signoffs / closings
  if (
    /\b(?:cordialmente|atentamente|saludos|un\s+saludo|quedo\s+atento|quedamos\s+atentos|muchas\s+gracias|gracias|feliz\s+resto\s+de\s+d[ií]a)\b/i.test(l)
  ) {
    return true;
  }

  // 7. Corporate disclaimers and environmental notices
  if (
    /\b(?:aviso\s+de\s+confidencialidad|cl[aá]usula\s+de\s+confidencialidad|confidencial|imprima|medio\s+ambiente|proteja\s+el\s+medio)\b/i.test(l)
  ) {
    return true;
  }

  // 8. Administrative status statements and process phrases (not actual items)
  if (
    /\b(?:partes?\s+creadas?|c[oó]digos?\s+creados?|para\s+su\s+revisi[oó]n|informaci[oó]n\s+vigente|no\s+se\s+cuenta\s+con|no\s+cuenta\s+con\s+parte|no\s+est[aá]\s+cread[ao]|no\s+estan?\s+cread[ao]s?|favor\s+crear|solicitud\s+de\s+creaci[oó]n|tr[aá]mite\s+de\s+autorizaci[oó]n|visto\s+bueno|favor\s+autorizar|revisado|por\s+favor|solicito|solicitamos|agradezco|adjunto|adjuntamos)\b/i.test(l)
  ) {
    return true;
  }

  return false;
}
