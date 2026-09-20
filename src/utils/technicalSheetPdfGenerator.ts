import jsPDF from 'jspdf';

// Helper to safely embed images without corrupting PDF streams or causing Acrobat Reader errors
function safeAddImage(
  doc: jsPDF,
  imageData: string | undefined,
  x: number,
  y: number,
  w: number,
  h: number
): boolean {
  if (!imageData || typeof imageData !== 'string') return false;
  const trimmed = imageData.trim();
  if (!trimmed) return false;

  try {
    const isJpeg =
      trimmed.startsWith('data:image/jpeg') ||
      trimmed.startsWith('data:image/jpg') ||
      trimmed.startsWith('/9j/');
    const format = isJpeg ? 'JPEG' : 'PNG';
    doc.addImage(trimmed, format, x, y, w, h, undefined, 'FAST');
    return true;
  } catch {
    try {
      const altFormat = (trimmed.startsWith('data:image/jpeg') || trimmed.startsWith('data:image/jpg') || trimmed.startsWith('/9j/')) ? 'PNG' : 'JPEG';
      doc.addImage(trimmed, altFormat, x, y, w, h, undefined, 'FAST');
      return true;
    } catch (err2) {
      console.warn('Could not embed image safely in PDF:', err2);
      return false;
    }
  }
}

export interface TechnicalSheetData {
  // Company / Institution / Vendor Branding (fully customizable, no hardcoded SYD)
  companyName?: string;
  headerSubtitle?: string;
  headerCertification?: string;
  companyLogoUrl?: string; // Uploaded company/vendor logo
  showLogoInHeader?: boolean;
  showWatermark?: boolean;
  watermarkOpacity?: number;
  productCategory?: 'instrumental' | 'biomedico' | 'mueble' | 'insumo' | 'reactivo' | 'otro';

  // Required core user inputs
  productName: string;
  brand: string;
  model: string;
  productImageBase64?: string; // Data URL or clean URL

  // Rich AI / Technical Description and Characteristics
  description?: string;
  characteristics?: string[];
  warranty?: string;

  // Improvised / customizable fields
  invimaRegistration?: string;
  areaDepartment?: string;
  fabricationMaterial?: string;
  mainFunction?: string;
  dimensionsDescription?: string;
  designDescription?: string;
  specsDetails?: Array<{ title: string; description: string }>;
  referenceTable?: Array<{ code: string; dimension: string }>;
  presentation?: string;
  warrantyPoints?: string[];
  sterilization?: string;
  handlingPoints?: string[];
  storageConditions?: string[];
  logoBase64?: string; // Optional custom brand logo
}

export type DeviceCategory = 'instrumental' | 'mueble' | 'equipo' | 'insumo';

export function detectDeviceCategory(data: Partial<TechnicalSheetData>): DeviceCategory {
  if (data.productCategory === 'mueble') return 'mueble';
  if (data.productCategory === 'biomedico') return 'equipo';
  if (data.productCategory === 'insumo') return 'insumo';
  if (data.productCategory === 'instrumental') return 'instrumental';

  const text = `${data.productName || ''} ${data.description || ''} ${data.model || ''} ${data.areaDepartment || ''}`.toUpperCase();
  if (/CAMA|CAMILLA|MESA MAYO|MESA QUIR|ATRIL|BIOMBO|VITRINA|MESA DE NOCHE|ESCALERILLA|MUEBLE|SILLA DE RUEDAS/i.test(text)) {
    return 'mueble';
  }
  if (/MONITOR|ELECTROCAR|DESFIB|PULSIOX|BOMBA|VENTILADOR|ECOGRAF|SUCCIONADOR|LARINGOSCOPIO|ELECTROBISTUR|TENSIOMETRO|GLUCOMETRO|TERMOMETRO|EQUIPO/i.test(text)) {
    return 'equipo';
  }
  if (/JERINGA|GUANTE|CATETER|SONDA|GASA|APOSITO|CANULA|MASCARILLA|AGUJA|TUBULADURA|DESCARTABLE|DESCART/i.test(text)) {
    return 'insumo';
  }
  return 'instrumental';
}

export function getDefaultReferencesForProduct(
  productName: string,
  modelName: string,
  cat: DeviceCategory
): Array<{ code: string; dimension: string }> {
  const pName = (productName || '').toUpperCase();

  if (/METZENBAUM|METZEMBAUM/i.test(pName)) {
    return [
      { code: '14.5 cm (Curva)', dimension: '14.5 cm (5-3/4") — Disección tisular fina en planos superficiales' },
      { code: '18.0 cm (Curva)', dimension: '18.0 cm (7.0") — Estándar para procedimientos de cirugía general' },
      { code: '20.0 cm (Curva)', dimension: '20.0 cm (8.0") — Disección profunda en cavidades corporales' },
      { code: '23.0 cm (Curva)', dimension: '23.0 cm (9.0") — Abordaje pélvico y torácico profundo' },
      { code: '18.0 cm (Recta)', dimension: '18.0 cm (7.0") — Sección precisa de suturas y tejidos resistentes' },
    ];
  }

  if (/MAYO/i.test(pName) && /TIJERA/i.test(pName)) {
    return [
      { code: '14.0 cm (Curva)', dimension: '14.0 cm — Disección de tejidos densos y aponeurosis' },
      { code: '17.0 cm (Curva)', dimension: '17.0 cm — Estándar para cirugía general' },
      { code: '19.0 cm (Curva)', dimension: '19.0 cm — Planos profundos de alta resistencia' },
      { code: '17.0 cm (Recta)', dimension: '17.0 cm — Corte de suturas y tejidos resistentes' },
    ];
  }

  if (/TIJERA/i.test(pName)) {
    return [
      { code: '11.5 cm (Delicada)', dimension: '11.5 cm — Microdisección y tejidos finos' },
      { code: '14.5 cm (Estándar)', dimension: '14.5 cm — Disección general y corte quirúrgico' },
      { code: '18.0 cm (Media)', dimension: '18.0 cm — Disección quirúrgica de plano medio' },
      { code: '20.0 cm (Larga)', dimension: '20.0 cm — Disección en planos anatómicos profundos' },
    ];
  }

  if (/KELLY|KOCHER|CRILE|PINZA/i.test(pName)) {
    return [
      { code: '14.0 cm (Curva)', dimension: '14.0 cm — Hemostasia en planos quirúrgicos superficiales' },
      { code: '14.0 cm (Recta)', dimension: '14.0 cm — Prensión firme de tejidos y hemostasia' },
      { code: '16.0 cm (Curva)', dimension: '16.0 cm — Cirugía general de plano intermedio' },
      { code: '18.5 cm (Curva)', dimension: '18.5 cm — Cirugía de cavidad profunda' },
    ];
  }

  if (/CAMA/i.test(pName)) {
    return [
      { code: modelName ? `${modelName}-STD` : 'Cama Estándar', dimension: '218 cm x 102 cm — Altura graduable 45 cm a 85 cm, 4 planos articulados' },
      { code: modelName ? `${modelName}-BAR` : 'Cama con Barandas', dimension: '220 cm x 105 cm — Con barandas de protección abatibles de polímero' },
      { code: modelName ? `${modelName}-BARI` : 'Cama Bariátrica', dimension: '225 cm x 115 cm — Configuración bariátrica reforzada, carga hasta 300 kg' },
    ];
  }

  if (/CAMILLA/i.test(pName)) {
    return [
      { code: modelName ? `${modelName}-TRA` : 'Camilla Traslado', dimension: '195 cm x 65 cm x 80 cm — Ruedas hospitalarias de 150 mm con freno' },
      { code: modelName ? `${modelName}-REC` : 'Camilla Recuperación', dimension: '195 cm x 70 cm x 85 cm — Con respaldo neumático, atril y barandas' },
    ];
  }

  if (/MONITOR/i.test(pName)) {
    return [
      { code: modelName ? `${modelName}-10` : 'Monitor 10.4"', dimension: 'Pantalla 10.4" TFT color — Monitoreo intrahospitalario compacto' },
      { code: modelName ? `${modelName}-12` : 'Monitor 12.1"', dimension: 'Pantalla 12.1" — Parámetros estándar: ECG, SpO2, PNI, Temp, Resp' },
      { code: modelName ? `${modelName}-15` : 'Monitor 15.0"', dimension: 'Pantalla 15.0" táctil — Alta resolución para UCI y Quirófano' },
    ];
  }

  if (/BANDEJA|CAJA|CONTENEDOR/i.test(pName)) {
    return [
      { code: '35 x 25 x 1 cm', dimension: 'Bandeja plana para instrumental menor y curaciones' },
      { code: '38 x 26.5 x 2 cm', dimension: 'Bandeja estándar para cirugía general y suturas' },
      { code: '43 x 29.5 x 1 cm', dimension: 'Bandeja amplia para instrumental de especialidad' },
      { code: '48 x 32.5 x 2 cm', dimension: 'Bandeja para sets de laparoscopia y traumatología' },
    ];
  }

  if (cat === 'mueble') {
    return [
      { code: modelName || 'Ref. Estándar', dimension: 'Dimensiones estándar hospitalarias optimizadas para movilidad asistencial' },
      { code: `${modelName || 'Ref'}-ESPEC`, dimension: 'Variante con aditamentos específicos para área clínica' },
    ];
  }

  if (cat === 'equipo') {
    return [
      { code: modelName || 'Modelo Estándar', dimension: 'Configuración estándar completa con accesorios de conexión clínica' },
      { code: `${modelName || 'Modelo'}-PLUS`, dimension: 'Variante extendida con módulo de conectividad avanzada' },
    ];
  }

  return [
    { code: modelName || 'Estándar', dimension: 'Configuración estándar según especificaciones del fabricante' },
    { code: `${modelName || 'Ref'}-02`, dimension: 'Variante dimensional para requerimientos asistenciales específicos' },
  ];
}

export function getDeviceProtocol(cat: DeviceCategory, data: Partial<TechnicalSheetData>) {
  if (cat === 'mueble') {
    return {
      title: 'PROTOCOLO DE LIMPIEZA Y DESINFECCIÓN DE SUPERFICIES:',
      description:
        data.sterilization ||
        'Limpieza y desinfección de superficies hospitalarias mediante paños impregnados en soluciones de amonio cuaternario de quinta generación o hipoclorito de sodio diluido. No sumergir en líquidos ni utilizar agentes corrosivos o abrasivos.',
      cards: [
        { title: 'Desinfección Superficial', line1: 'Amonio cuaternario 5ta gen', line2: 'Frotado con paño húmedo' },
        { title: 'Asepsia Hospitalaria', line1: 'Entre pacientes / diario', line2: 'Desinfección nivel intermedio' },
        { title: 'Precaución Técnica', line1: 'No mojar partes eléctricas', line2: 'Proteger actuadores y motores' },
      ],
      handlingTitle: 'MANIPULACIÓN Y CONDICIONES DE OPERACIÓN SEGURA:',
      handling: data.handlingPoints || [
        'Accionar los frenos de seguridad de las ruedas antes del ingreso o transferencia del paciente.',
        'Verificar el correcto anclaje y traba de las barandas laterales de seguridad durante el uso.',
        'No exceder la capacidad máxima de carga segura especificada por el fabricante.',
        'Realizar inspección periódica de tornillería, rodamientos, uniones soldadas y mecanismos.',
      ],
      storageTitle: 'ALMACENAMIENTO Y MANTENIMIENTO PREVENTIVO:',
      storage: data.storageConditions || [
        'Mantener en recinto cubierto sobre superficie nivelada, protegido del polvo y la humedad.',
        'Temperatura ambiental recomendada entre 15°C y 30°C, protegida de la intemperie.',
        'Evitar impactos mecánicos contra muros, marcos de puertas o ascensores durante el traslado.',
      ],
    };
  }

  if (cat === 'equipo') {
    return {
      title: 'PROTOCOLO DE LIMPIEZA Y DESINFECCIÓN DE EQUIPO BIOMÉDICO:',
      description:
        data.sterilization ||
        'Limpieza y desinfección de nivel intermedio mediante paños suaves no abrasivos humedecidos con alcohol isopropílico al 70% o solución desinfectante recomendada por el fabricante. No pulverizar líquidos directamente, no sumergir ni esterilizar en autoclave.',
      cards: [
        { title: 'Gabinete y Pantalla', line1: 'Alcohol isopropílico al 70%', line2: 'Paño suave no abrasivo' },
        { title: 'Sensores y Cables', line1: 'Limpieza superficial', line2: 'No autoclave / No sumergir' },
        { title: 'Seguridad Eléctrica', line1: 'Desconectar de la red', line2: 'Antes de labores de asepsia' },
      ],
      handlingTitle: 'MANIPULACIÓN Y OPERACIÓN CLÍNICA SEGURA:',
      handling: data.handlingPoints || [
        'Conectar únicamente a tomas eléctricas grado hospitalario con polo a tierra verificado.',
        'Evitar caídas, golpes o derrames accidentales de fluidos sobre el gabinete o panel táctil.',
        'Verificar el estado físico y conexión firme de los cables de paciente antes de cada uso.',
        'Cumplir con el cronograma de mantenimiento preventivo y calibración biomédica institucional.',
      ],
      storageTitle: 'ALMACENAMIENTO Y CONDICIONES AMBIENTALES:',
      storage: data.storageConditions || [
        'Almacenar en recinto con temperatura controlada (15°C a 30°C) y humedad sin condensación.',
        'Efectuar recarga periódica de la batería de respaldo durante periodos prolongados de inactividad.',
        'Proteger de fuentes directas de calor, campos magnéticos intensos o humedad excesiva.',
      ],
    };
  }

  if (cat === 'insumo') {
    return {
      title: 'CONDICIÓN DE SUMINISTRO Y NORMAS DE BIOSEGURIDAD:',
      description:
        data.sterilization ||
        'Dispositivo médico estéril de un solo uso (Single Use Only). Prohibida su reutilización o re-esterilización para prevenir riesgos de contaminación cruzada e infecciones asociadas a la atención en salud (IAAS).',
      cards: [
        { title: 'Condición Sanitaria', line1: 'Estéril de fábrica', line2: 'Listo para uso asistencial' },
        { title: 'Tipo de Uso', line1: 'Un solo paciente (Single Use)', line2: 'No reutilizable' },
        { title: 'Disposición Final', line1: 'Caneca roja biosanitaria', line2: 'Protocolo PGIRH' },
      ],
      handlingTitle: 'MANIPULACIÓN Y DISPOSICIÓN ASISTENCIAL:',
      handling: data.handlingPoints || [
        'Verificar la integridad del empaque estéril y fecha de vencimiento antes de su apertura.',
        'Manipular bajo estricta técnica aséptica por personal de salud debidamente calificado.',
        'Desechar inmediatamente después de su uso en el contenedor de residuos biosanitarios correspondiente.',
      ],
      storageTitle: 'ALMACENAMIENTO Y CONSERVACIÓN:',
      storage: data.storageConditions || [
        'Conservar en su empaque primario intacto en bodega de insumos estériles.',
        'Temperatura ambiental recomendada entre 15°C y 30°C, sobre estanterías elevadas libres de polvo.',
      ],
    };
  }

  // Default: Instrumental Quirúrgico
  return {
    title: 'PROTOCOLO DE ESTERILIZACIÓN Y DESINFECCIÓN:',
    description:
      data.sterilization ||
      'Lavar previamente con detergente enzimático de pH neutro y agua desmineralizada, secar minuciosamente y esterilizar en autoclave por vapor saturado a 134°C, plasma de H2O2 o gas OE según guías de la central de esterilización.',
    cards: [
      { title: 'Vapor / Autoclave', line1: '134°C (5 a 18 min)', line2: 'Calor húmedo saturado' },
      { title: 'Plasma de H2O2', line1: 'Ciclo estándar hospitalario', line2: 'Baja temperatura' },
      { title: 'Desinfección / OE', line1: 'Aprobada por INVIMA', line2: 'Alto nivel / Gas OE' },
    ],
    handlingTitle: 'MANIPULACIÓN Y CONDICIONES DE USO CLÍNICO:',
    handling: data.handlingPoints || [
      'Inspeccionar el filo de corte, articulación y cremalleras antes de cada procedimiento quirúrgico.',
      'Manipular exclusivamente con técnica aséptica y elementos de protección personal hospitalaria.',
      'Utilizar protectores de silicona para puntas y filos durante el lavado y transporte en canastilla.',
      'Evitar sobretensiones mecánicas, caídas o usos fuera de su indicación quirúrgica específica.',
    ],
    storageTitle: 'ALMACENAMIENTO Y CONSERVACIÓN:',
    storage: data.storageConditions || [
      'Almacenar en cajas o canastillas de instrumental quirúrgico en recinto limpio, seco y ventilado.',
      'Temperatura ambiental controlada recomendada entre 15°C y 25°C, con humedad relativa menor al 65%.',
      'Mantener en empaque con barrera estéril vigente hasta su ingreso al quirófano.',
    ],
  };
}

/**
 * Intelligent improviser: fills in realistic, concise, professional medical data
 * given just productName, brand, model, and optional image.
 */
export function getImprovisedTechnicalSheetData(
  productName: string,
  brand: string,
  model: string,
  productImageBase64?: string
): TechnicalSheetData {
  const nameClean = (productName || 'EQUIPO BIOMÉDICO').trim().toUpperCase();
  const brandClean = (brand || '').trim().toUpperCase();
  const modelClean = (model || '').trim().toUpperCase();

  // Detect specific product category
  const isScissors =
    /TIJERA|METZENBAUM|METZEMBAUM|MAYO|IRIS|STEVENS|POTTS|CASTROVIEJO|LITTAUER/i.test(nameClean);

  const isClamps =
    /PINZA|KELLY|KOCHER|CRILE|ALLIS|MOSQUITO|HALSTED|BABCOCK|FOERSTER|DISEC/i.test(nameClean);

  const isNeedleHolder =
    /PORTAAGUJAS|MAYO-HEGAR|MATHIEU|CRILE-WOOD/i.test(nameClean);

  const isRetractor =
    /SEPARADOR|FARABEUF|DEAVER|RICHARDSON|BALFOUR|WEITLANER|GELPI|SENN/i.test(nameClean);

  const isTrayOrContainer =
    /BANDEJA|CAJA|RI[ÑN]ONERA|POCILLO|TAMBOR|CONTENEDOR/i.test(nameClean);

  const isFurniture =
    /CAMILLA|CAMA|MESA MAYO|MESA QUIR[UÚ]RGICA|ATRIL|BIOMBO|VITRINA|MESA DE NOCHE|ESCALERILLA|MUEBLE/i.test(
      nameClean
    );

  const isMonitoringOrElectronic =
    /MONITOR|ELECTROCARDI[OÓ]GRAFO|DESFIBRILADOR|PULSIOX[IÍ]METRO|BOMBA|VENTILADOR|ECOGRAFO|SUCCIONADOR|LARINGOSCOPIO|ELECTROBISTUR[IÍ]/i.test(
      nameClean
    );

  // Default INVIMA registration
  const invimaRegistration = `2024DM-${Math.floor(1000000 + Math.random() * 9000000).toString().substring(0, 7)}`;

  // 1. TIJERAS QUIRÚRGICAS (Metzenbaum, Mayo, Iris, etc.)
  if (isScissors) {
    const isMetz = /METZENBAUM|METZEMBAUM/i.test(nameClean);
    return {
      productName: nameClean,
      brand: brandClean,
      model: modelClean,
      productImageBase64,
      invimaRegistration,
      productCategory: 'instrumental',
      description: isMetz
        ? `Tijera Metzenbaum quirúrgica de alta precisión y delicadeza, diseñada específicamente para la disección roma y el corte fino y controlado de tejidos blandos y planos anatómicos profundos sin desgarrar estructuras circundantes.`
        : `Tijera quirúrgica de grado médico de alta durabilidad y corte exacto, diseñada para la disección de tejidos o sección precisa de materiales y suturas en quirófano y salas de procedimientos.`,
      characteristics: [
        'Fabricada en Acero Inoxidable Quirúrgico AISI 420 / DIN 1.4021 con temple térmico controlado.',
        'Hojas de corte biseladas de altísima precisión (disponibles en curva para disección o recta).',
        'Ramas alargadas y estilizadas con anillas ergonómicas para maniobrabilidad en planos profundos.',
        'Articulación atornillada o remachada de precisión sin holguras ni desalineación de filos.',
        'Acabado satinado antirreflejo para evitar destellos molestos bajo la luz de la lámpara cielítica.',
        'Resistencia completa a esterilización en autoclave por vapor a 134°C y agentes enzimáticos.'
      ],
      warranty: '5 años de garantía contra defectos de fabricación y fatiga de acero quirúrgico.',
      areaDepartment: 'CENTRAL DE ESTERILIZACIÓN Y QUIRÓFANO',
      fabricationMaterial:
        'Acero Inoxidable Quirúrgico Martensítico AISI 420 / DIN 1.4021 con tratamiento térmico de temple y revenido (Rockwell C 50-54) para retención óptima de filo.',
      mainFunction:
        'Disección roma de planos anatómicos, separación atraumática y corte preciso de tejidos blandos durante intervenciones quirúrgicas especializadas.',
      dimensionsDescription:
        'Disponibles en longitudes estándar de 14 cm, 18 cm, 20 cm y 23 cm (curvas y rectas) adaptadas a la profundidad de abordaje operatorio.',
      designDescription:
        'Diseño ergonómico con relación balanceada entre mango y hojas, puntas romas atraumáticas para disección segura y anillas con pulido suave.',
      specsDetails: [
        {
          title: 'Aleación Martensítica Quirúrgica AISI 420:',
          description: 'Asegura retención prolongada del filo de corte y resistencia a la corrosión intergranular en autoclave.'
        },
        {
          title: 'Hojas Curvas / Rectas de Precisión:',
          description: 'Perfil biselado diseñado para deslizamiento suave entre planos tisulares sin resistencia.'
        },
        {
          title: 'Tratamiento Térmico Homogéneo:',
          description: 'Dureza controlada que evita melladuras prematuras o deformaciones bajo tensión.'
        },
        {
          title: 'Acabado Satinado Antirreflejo:',
          description: 'Elimina los reflejos ópticos molestos causados por las fuentes lumínicas del quirófano.'
        }
      ],
      referenceTable: [
        { code: '14.5 cm (Curva)', dimension: '14.5 cm (5-3/4") — Curva (Disección Delicada)' },
        { code: '18.0 cm (Curva)', dimension: '18 cm (7.0") — Curva (Disección Quirúrgica Estándar)' },
        { code: '20.0 cm (Curva)', dimension: '20 cm (8.0") — Curva (Disección Profunda de Tejidos)' },
        { code: '23.0 cm (Curva)', dimension: '23 cm (9.0") — Curva (Cavidad Abdominal y Pélvica)' },
        { code: '18.0 cm (Recta)', dimension: '18 cm (7.0") — Recta (Corte Tisular y Suturas)' },
      ],
      presentation:
        'Suministrado en funda plástica individual protectora de filos, no estéril, con etiquetado reglamentario INVIMA.',
      warrantyPoints: [
        '5 años de garantía contra defectos de fabricación o porosidad en el acero.',
        'Servicio de afilado y pasivado disponible en taller especializado.',
        'Cambio inmediato por fallas de origen o desajuste de articulación.'
      ],
      sterilization:
        'Lavar previamente con detergente enzimático de pH neutro, secar meticulosamente y esterilizar en autoclave a vapor a 134°C durante mínimo 5 minutos.',
      handlingPoints: [
        'Proteger siempre la punta y filos de corte con protectores de silicona durante el lavado y transporte.',
        'No utilizar tijeras de disección de tejidos para cortar alambres, gasas gruesas ni apósitos.'
      ],
      storageConditions: [
        'Almacenar en contenedores o cajas de instrumental con insertos de silicona en ambiente seco (15°C a 25°C).',
        'Humedad relativa menor al 65%, protegido del polvo y agentes químicos corrosivos.'
      ]
    };
  }

  // 2. PINZAS QUIRÚRGICAS (Kelly, Kocher, etc.)
  if (isClamps || isNeedleHolder || isRetractor) {
    return {
      productName: nameClean,
      brand: brandClean,
      model: modelClean,
      productImageBase64,
      invimaRegistration,
      productCategory: 'instrumental',
      description: `Instrumental quirúrgico de precisión fabricado en acero inoxidable de grado quirúrgico, diseñado para hemostasia, sujeción firme atraumática o retracción de tejidos en el campo operatorio.`,
      characteristics: [
        'Fabricado en Acero Inoxidable Quirúrgico AISI 410/420 de alta resistencia a la fatiga mecánica.',
        'Mandíbulas con estriado transversal o cruzado para un agarre seguro y atraumático.',
        'Cremallera de trinquete de múltiples posiciones para ajuste progresivo de la presión de cierre.',
        'Acabado superficial sanitario satinado libre de porosidades y reflejos luminosos.',
        'Excelente tolerancia a ciclos continuos de autoclave a 134°C y detergentes enzimáticos.'
      ],
      warranty: '5 años contra defectos de fabricación o rotura de trinquete.',
      areaDepartment: 'CENTRAL DE ESTERILIZACIÓN Y QUIRÓFANO',
      fabricationMaterial:
        'Acero Inoxidable Quirúrgico AISI 410 / AISI 420 certificado bajo normas ISO 7153-1 y ASTM F899.',
      mainFunction:
        'Hemostasia temporal de vasos sanguíneos, sujeción firme de tejidos o retracción segura en campo operatorio.',
      dimensionsDescription:
        'Disponible en diversas longitudes según el abordaje anatómico (12.5 cm a 22 cm).',
      designDescription:
        'Diseño ergonómico con anillas balanceadas y trinquete de bloqueo suave que no fatiga la mano del cirujano.',
      referenceTable: [
        { code: '14.0 cm (Curva)', dimension: '14 cm (5.5") — Curva (Hemostasia y Prensión)' },
        { code: '14.0 cm (Recta)', dimension: '14 cm (5.5") — Recta (Tracción y Sujeción)' },
        { code: '16.0 cm (Curva)', dimension: '16 cm (6.3") — Curva (Cirugía General)' },
        { code: '18.5 cm (Curva)', dimension: '18.5 cm (7.2") — Curva (Planos Profundos)' },
      ],
      presentation: 'Empaque unitario no estéril con identificación y lote trazable.',
      warrantyPoints: [
        '5 años de garantía en material y ensamble de cremallera.',
        'Reposición directa ante cualquier fallo estructural.'
      ],
      sterilization: 'Autoclave a vapor a 134°C tras lavado previo con detergente enzimático neutro.',
      storageConditions: [
        'Almacenar con cremallera en primer diente (abierta para evitar tensión) en lugar seco.'
      ]
    };
  }

  // 3. MUEBLE HOSPITALARIO (Camillas, camas, mesas mayo, etc.)
  if (isFurniture) {
    return {
      productName: nameClean,
      brand: brandClean,
      model: modelClean,
      productImageBase64,
      invimaRegistration,
      productCategory: 'mueble',
      description: `Mobiliario clínico hospitalario de alta resistencia y durabilidad, diseñado para el confort y seguridad del paciente y la ergonomía del personal de salud en áreas de internación, urgencias y quirófano.`,
      characteristics: [
        'Estructura robusta en tubería de acero Cold Rolled o acero inoxidable AISI 304.',
        'Acabado en pintura electrostática epoxi-poliéster horneable con aditivo antibacterial.',
        'Ruedas de grado hospitalario de giro libre y freno diagonal de seguridad silenciosas y antihuella.',
        'Superficies lisas de fácil lavado, desinfección y descontaminación hospitalaria.',
        'Capacidad de carga dinámica y estática superior certificada para uso intensivo.'
      ],
      warranty: '3 años de garantía en estructura metálica y 1 año en rodamientos y accesorios.',
      areaDepartment: 'HOSPITALIZACIÓN, URGENCIAS Y QUIRÓFANO',
      fabricationMaterial:
        'Tubería de acero Cold Rolled de calibre estructural y/o Acero Inoxidable AISI 304, con pintura epoxi-poliéster horneada a 200°C.',
      mainFunction:
        'Soporte, traslado, acomodación ergonómica y disposición de insumos en áreas de atención clínica.',
      dimensionsDescription:
        'Dimensiones optimizadas para paso por puertas hospitalarias y ascensores clínicos.',
      designDescription:
        'Líneas curvas sanitarias sin aristas filosas para prevenir lesiones a usuarios y personal.',
      referenceTable: [
        { code: '190 x 60 x 80 cm', dimension: 'Configuración Estándar hospitalaria (190 x 60 x 80 cm)' },
        { code: '195 x 65 x 85 cm', dimension: 'Con barandas de seguridad abatibles (195 x 65 x 85 cm)' },
        { code: '200 x 75 x 85 cm', dimension: 'Configuración Reforzada / Bariátrica (200 x 75 x 85 cm)' },
      ],
      presentation: 'Unidad embalada en plástico alveolar de alta densidad y esquineros de protección.',
      warrantyPoints: [
        '3 años en estructura metálica soldada.',
        'Disponibilidad de repuestos originales de ruedas, pedales y barandas.'
      ],
      sterilization: 'Desinfección de superficies con toallitas o soluciones de amonio cuaternario de quinta generación o hipoclorito diluido.',
      storageConditions: [
        'Almacenar en bodegas techadas, libres de humedad excesiva y agentes corrosivos.'
      ]
    };
  }

  // 4. BANDEJAS, CAJAS Y CONTENEDORES
  if (isTrayOrContainer) {
    return {
      productName: nameClean,
      brand: brandClean,
      model: modelClean,
      productImageBase64,
      invimaRegistration,
      productCategory: 'instrumental',
      description: `Dispositivo e instrumental quirúrgico de alta precisión y durabilidad, diseñado para la contención, organización, transporte y esterilización de instrumental médico en quirófano y áreas clínicas hospitalarias.`,
      characteristics: [
        'Fabricado en Acero Inoxidable ASIS 420/316 de grado quirúrgico de alta pureza.',
        'Acabado superficial sanitario no poroso, resistente a picaduras y corrosión química.',
        'Bordes romos perimetrales y esquinas redondeadas para evitar acumulación de residuos patógenos.',
        'Excelente tolerancia térmica a ciclos repetitivos de autoclave a 134°C y calor seco.',
        'Alta resistencia mecánica a impactos, deformaciones y agentes de lavado enzimático.',
        'Conformidad con normativas internacionales de bioseguridad y directivas INVIMA.'
      ],
      warranty: '5 años contra defectos de fabricación o fallas estructurales de material.',
      areaDepartment: 'CENTRAL DE ESTERILIZACIÓN Y QUIRÓFANO',
      fabricationMaterial:
        'Acero Inoxidable ASIS 420/316 para uso en fabricación de implantes y dispositivos quirúrgicos, que cumple con los requisitos de seguridad, eficacia y calidad determinadas por las normas aplicables a productos médicos quirúrgicos.',
      mainFunction: `Su función principal es el soporte, transporte, organización y esterilización del instrumental médico en quirófano y áreas clínicas.`,
      dimensionsDescription: `Dimensiones optimizadas para albergue de instrumental quirúrgico de diversas longitudes, apto para colocación en mesas mayo y de reserva sin comprometer el campo estéril.`,
      designDescription: `Diseño plano con bordes perimetrales sutilmente elevados (1.5 a 2 cm) que evita que los instrumentos rueden o caigan, facilitando la toma rápida durante el acto quirúrgico.`,
      referenceTable: [
        { code: '35 x 25 x 1 cm', dimension: '13-3/4" x 9-3/4" x 1/2" (Bandeja para instrumental menor)' },
        { code: '38 x 26.5 x 2 cm', dimension: '15" x 10-1/2" x 3/4" (Bandeja para cirugía general)' },
        { code: '43 x 29.5 x 1 cm', dimension: '17" x 11-5/8" x 1/2" (Bandeja para instrumental mayor)' },
        { code: '48 x 32.5 x 1.9 cm', dimension: '19" x 12-3/4" x 3/4" (Bandeja para laparoscopia y sets amplios)' },
      ],
      presentation: 'Empaque unitario de polietileno atóxico de baja densidad.',
      warrantyPoints: ['5 años de garantía contra defectos de fabricación del material.'],
      sterilization: 'Esterilización en autoclave a vapor a 134°C.',
      storageConditions: ['Almacenar en lugar limpio y seco a temperatura ambiente.']
    };
  }

  if (isMonitoringOrElectronic) {
    return {
      productName: nameClean,
      brand: brandClean,
      model: modelClean,
      productImageBase64,
      invimaRegistration,
      areaDepartment: 'CUIDADOS CRÍTICOS, URGENCIAS Y QUIRÓFANO',
      fabricationMaterial:
        'Gabinete termoformado en polímero ABS de grado médico de alta resistencia al impacto y agentes desinfectantes hospitalarios, con chasis interno de aleación de aluminio para disipación térmica pasiva.',
      mainFunction: `Monitoreo continuo y registro en tiempo real de parámetros fisiológicos vitales para soporte del paciente en entornos hospitalarios de alta exigencia.`,
      dimensionsDescription: `Estructura compacta con pantalla TFT antirreflejo de alta resolución, asa de transporte ergonómica integrada y compatibilidad para montaje en pared o pedestal rodable.`,
      designDescription: `Interfaz de usuario táctil con botones de acceso rápido y alarmas visuales en 360° para alerta inmediata del personal de enfermería y médico.`,
      specsDetails: [
        {
          title: 'Carcasa de Grado Médico Antimicrobiana:',
          description:
            'Material resistente a desinfectantes cuaternarios, alcohol al 70% y peróxido sin presentar decoloración ni fracturas por esfuerzo.',
        },
        {
          title: 'Protección contra Ingreso de Líquidos (IPX1):',
          description:
            'Gabinete sellado para evitar el ingreso accidental de soluciones de limpieza o fluidos corporales a los circuitos electrónicos.',
        },
        {
          title: 'Eficiencia Térmica sin Ventilador (Fanless):',
          description:
            'Disipación pasiva silenciosa que evita la recirculación de partículas y microorganismos en áreas limpias como UCI y quirófanos.',
        },
        {
          title: 'Batería de Ión-Litio Recargable:',
          description:
            'Autonomía de más de 4 horas de operación ininterrumpida para traslado intrahospitalario con indicador de carga en pantalla.',
        },
      ],
      referenceTable: [
        { code: modelClean, dimension: 'Configuración estándar completa con accesorios de conexión' },
        { code: `${modelClean}-W`, dimension: 'Opción con módulo inalámbrico Wi-Fi y enlace a Central' },
        { code: `${modelClean}-WALL`, dimension: 'Kit con soporte de pared pivotante de alta resistencia' },
      ],
      presentation:
        'Empaque de alta protección en caja corrugada sellada con molde de espuma termoformada antichoque, manual de usuario y accesorios estándar.',
      warrantyPoints: [
        '2 años de garantía total en unidad principal y 1 año en accesorios reusables.',
        'Disponibilidad inmediata de repuestos, sensores y soporte técnico certificado.',
        'Incluye calibración y protocolo de verificación metrológica inicial.',
        'Capacitación técnica y operativa certificada al personal de la institución.',
      ],
      sterilization:
        'Limpieza y desinfección de nivel intermedio mediante paños no abrasivos humedecidos con solución de amonio cuaternario o alcohol isopropílico al 70%. No sumergir.',
      handlingPoints: [
        'Evitar impactos mecánicos fuertes o caídas durante el traslado.',
        'Conectar únicamente a tomas eléctricas grado hospitalario con polo a tierra verificado.',
        'Verificar la integridad de los cables de paciente antes de cada uso clínico.',
      ],
      storageConditions: [
        'Almacenar en recinto ventilado, libre de polvo y humedad excesiva.',
        'Temperatura ambiental recomendada de 15°C a 30°C con humedad relativa menor al 80% sin condensación.',
      ],
    };
  }

  // General Hospital Equipment Default
  return {
    productName: nameClean,
    brand: brandClean,
    model: modelClean,
    productImageBase64,
    invimaRegistration,
    areaDepartment: 'SERVICIOS HOSPITALARIOS Y ATENCIÓN CLÍNICA',
    fabricationMaterial:
      'Estructura de alta resistencia con componentes de grado médico conformes a normativas internacionales ISO 13485 e INVIMA, biocompatible y libre de sustancias tóxicas.',
    mainFunction: `Dispositivo biomédico diseñado para facilitar los procedimientos asistenciales, diagnóstico o tratamiento hospitalario con alta confiabilidad y ergonomía.`,
    dimensionsDescription: `Dimensiones adaptadas para uso hospitalario seguro, de fácil movilidad y almacenamiento higiénico en bodegas o áreas de atención.`,
    designDescription: `Acabados lisos, sin cantos vivos ni aristas cortantes, facilitando protocolos rigurosos de asepsia y limpieza institucional.`,
    specsDetails: [
      {
        title: 'Calidad y Resistencia Estructural:',
        description: 'Construcción robusta para soportar uso continuo intensivo en entornos hospitalarios.',
      },
      {
        title: 'Biocompatibilidad Comprobada:',
        description: 'Materiales no alergénicos, libres de látex y seguros para contacto clínico.',
      },
      {
        title: 'Fácil Limpieza y Desinfección:',
        description: 'Superficies diseñadas para tolerar desinfectantes hospitalarios sin deteriorarse.',
      },
      {
        title: 'Cumplimiento Normativo:',
        description: 'Fabricado bajo estándares de calidad para dispositivos médicos vigentes en Colombia.',
      },
    ],
    referenceTable: [
      { code: modelClean, dimension: 'Modelo estándar según especificación técnica del fabricante' },
      { code: `${modelClean}-PRO`, dimension: 'Versión profesional de alta resistencia' },
    ],
    presentation:
      'Suministrado en empaque individual sellado con rotulado de lote, marca, modelo y registro sanitario según normativa INVIMA.',
    warrantyPoints: [
      'Garantía de 3 años por defectos de fabricación.',
      'Soporte técnico y repuestos garantizados a nivel nacional.',
      'Mantenimiento preventivo anual disponible.',
      'Sustitución inmediata por anomalías técnicas comprobables.',
    ],
    sterilization:
      'Suministrado no estéril. Apto para limpieza y desinfección con productos avalados por el comité de infecciones de la institución.',
    handlingPoints: [
      'Inspeccionar el producto antes de su puesta en funcionamiento.',
      'Utilizar según las indicaciones del manual de operación.',
      'Manipular con implementos de bioseguridad requeridos.',
    ],
    storageConditions: [
      'Almacenar en lugar seco, cubierto y protegido de la luz solar directa.',
      'Temperatura recomendada de 18°C a 26°C.',
    ],
  };
}

/**
 * Creates a circular logo canvas representation if no custom image is supplied
 */
function createCircularBrandLogoDataUrl(brandName: string): string {
  if (typeof document === 'undefined') return '';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const cx = 150;
    const cy = 150;

    // Clear
    ctx.clearRect(0, 0, 300, 300);

    // Outer soft glow ring
    ctx.beginPath();
    ctx.arc(cx, cy, 140, 0, Math.PI * 2);
    ctx.fillStyle = '#e0f2fe';
    ctx.fill();

    // Outer circle border
    ctx.beginPath();
    ctx.arc(cx, cy, 134, 0, Math.PI * 2);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 14;
    ctx.stroke();

    // Inner circle border
    ctx.beginPath();
    ctx.arc(cx, cy, 116, 0, Math.PI * 2);
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 6;
    ctx.stroke();

    // White fill inside
    ctx.beginPath();
    ctx.arc(cx, cy, 110, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Text in center
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0369a1';
    ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';

    const words = brandName.trim().split(/\s+/);
    if (words.length === 1) {
      ctx.fillText(words[0].substring(0, 10), cx, cy);
    } else if (words.length === 2) {
      ctx.fillText(words[0], cx, cy - 20);
      ctx.font = 'bold 32px "Segoe UI", Arial, sans-serif';
      ctx.fillText(words[1], cx, cy + 22);
    } else {
      ctx.fillText(`${words[0]} ${words[1]}`, cx, cy - 20);
      ctx.font = 'bold 30px "Segoe UI", Arial, sans-serif';
      ctx.fillText(words.slice(2).join(' '), cx, cy + 22);
    }

    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error('Error generating circular logo:', e);
    return '';
  }
}

/**
 * Generates the authentic 3-page Technical Sheet PDF matching the user's reference image
 */
export function generateTechnicalSheetPdf(data: TechnicalSheetData): jsPDF {
  // Letter size in mm: 215.9 x 279.4
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // ~215.9
  const pageHeight = doc.internal.pageSize.getHeight(); // ~279.4
  const marginX = 16;
  const contentWidth = pageWidth - marginX * 2;

  const companyName = (data.companyName || '').trim();
  const headerSubtitle = (data.headerSubtitle || 'Ficha Técnica Oficial de Especificaciones').trim();
  const headerCertification = (data.headerCertification || 'Conformidad Técnica & Sanitaria').trim();
  const brandName = (data.brand || '').trim().toUpperCase();
  const productName = (data.productName || 'PRODUCTO MÉDICO').trim().toUpperCase();
  const modelName = (data.model || '').trim().toUpperCase();
  const invima = data.invimaRegistration || '';

  // Company / brand logo
  const logoDataUrl = data.companyLogoUrl || data.logoBase64 || (brandName ? createCircularBrandLogoDataUrl(brandName) : '');

  // Pre-generate faded watermark safely via canvas if in browser, avoiding GState transparency errors
  let fadedWatermarkUrl = '';
  if (data.showWatermark && logoDataUrl && typeof document !== 'undefined') {
    try {
      const targetOpacity = Math.max(0.02, Math.min(0.20, data.watermarkOpacity ?? 0.07));
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.src = logoDataUrl;
        if (img.complete && img.naturalWidth > 0) {
          ctx.globalAlpha = targetOpacity;
          ctx.drawImage(img, 0, 0, 300, 300);
          fadedWatermarkUrl = canvas.toDataURL('image/png');
        }
      }
    } catch {
      // Ignore if canvas fails
    }
  }

  // Helper to draw watermark safely in background
  const drawWatermark = () => {
    if (data.showWatermark && fadedWatermarkUrl) {
      try {
        const wmSize = 110;
        const wmX = (pageWidth - wmSize) / 2;
        const wmY = (pageHeight - wmSize) / 2;
        safeAddImage(doc, fadedWatermarkUrl, wmX, wmY, wmSize, wmSize);
      } catch (err) {
        console.warn('Could not render watermark:', err);
      }
    }
  };

  // Helper to draw standard header on pages
  const drawPageHeader = (pageNumber: number) => {
    drawWatermark();

    let textStartX = marginX;
    // 1. Logo at top left (if enabled and available)
    if (data.showLogoInHeader !== false && logoDataUrl) {
      const added = safeAddImage(doc, logoDataUrl, marginX, 8, 20, 20);
      if (added) {
        textStartX = marginX + 24;
      }
    }

    // Company / Header texts (Clean: Company Name or Brand Name, no forced subtitle/cert)
    if (companyName) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(2, 132, 199);
      doc.text(companyName.toUpperCase(), textStartX, 19);
    } else if (brandName) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(2, 132, 199);
      doc.text(brandName.toUpperCase(), textStartX, 19);
    }

    // 2. Right text: "FICHA TÉCNICA"
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('FICHA TÉCNICA', pageWidth - marginX, 17, { align: 'right' });

    // Page indicator subtle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Página ${pageNumber} de 2`, pageWidth - marginX, 22, { align: 'right' });

    // Top subtle divider line
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(marginX, 30, pageWidth - marginX, 30);
  };

  // ===========================================================================
  // PAGE 1: Portada, Fotografía Centrada, Clasificación, Material y Función
  // ===========================================================================
  drawPageHeader(1);

  // Big bold Product Title Centered with automatic multi-line wrapping
  let currentY = 36;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  const titleLines = doc.splitTextToSize((productName || '').substring(0, 100), contentWidth);
  doc.text(titleLines, pageWidth / 2, currentY, { align: 'center' });

  currentY += titleLines.length > 1 ? titleLines.length * 5 : 5.5;

  // Centered Metadata Line: Marca • Modelo • Registro Sanitario INVIMA
  const metaParts: string[] = [];
  if (brandName) metaParts.push(`MARCA: ${brandName.substring(0, 45)}`);
  if (modelName) metaParts.push(`MODELO / REF: ${modelName.substring(0, 40)}`);
  if (invima) metaParts.push(`REGISTRO INVIMA: ${invima.substring(0, 60)}`);

  if (metaParts.length > 0) {
    const metaString = metaParts.join('   •   ');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const metaLines = doc.splitTextToSize(metaString, contentWidth);
    doc.text(metaLines, pageWidth / 2, currentY, { align: 'center' });
    currentY += metaLines.length > 1 ? metaLines.length * 4 : 5.5;
  }

  // Centered Product Image Box (Transparent background so watermark shows through)
  const photoW = 86;
  const photoH = 50;
  const photoX = (pageWidth - photoW) / 2;

  if (data.productImageBase64) {
    try {
      doc.setDrawColor(203, 213, 225);
      doc.rect(photoX, currentY, photoW, photoH, 'D');
      safeAddImage(doc, data.productImageBase64, photoX + 1.5, currentY + 1.5, photoW - 3, photoH - 3);
      if (modelName) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.2);
        doc.setTextColor(100, 116, 139);
        doc.text(`Ref. Modelo: ${modelName}`, pageWidth / 2, currentY + photoH + 3.8, { align: 'center' });
      }
    } catch {
      doc.setDrawColor(203, 213, 225);
      doc.rect(photoX, currentY, photoW, photoH, 'D');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(productName.substring(0, 22), pageWidth / 2, currentY + photoH / 2, { align: 'center' });
    }
  } else {
    doc.setDrawColor(203, 213, 225);
    doc.rect(photoX, currentY, photoW, photoH, 'D');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(brandName || 'FOTOGRAFÍA TÉCNICA DEL PRODUCTO', pageWidth / 2, currentY + 20, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(modelName || 'VISTA TÉCNICA BIOMÉDICA', pageWidth / 2, currentY + 26, { align: 'center' });
    doc.text('[Dispositivo Médico Oficial]', pageWidth / 2, currentY + 32, { align: 'center' });
  }

  currentY += photoH + (modelName ? 8.5 : 5);

  // Technical Classification Strip (3 Balanced Columns)
  const classW = contentWidth / 3;
  const classItems = [
    { label: 'Clasificación Riesgo', val: 'Clase I / IIa (INVIMA)' },
    { label: 'Condición Sanitaria', val: 'Grado Médico Hospitalario' },
    { label: 'Vida Útil Estimada', val: '5 Años (Uso Continuo)' }
  ];

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += 4;

  classItems.forEach((cItem, cIdx) => {
    const cX = marginX + cIdx * classW;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(cItem.label.toUpperCase(), cX + classW / 2, currentY, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text(cItem.val, cX + classW / 2, currentY + 4.2, { align: 'center' });
  });
  currentY += 8.5;

  // Ámbito de Aplicación / Servicios Clínicos (Full width row with safe wrapping)
  const appArea = data.areaDepartment || 'Servicios Quirúrgicos, Clínicos y Asistenciales';
  doc.setDrawColor(241, 245, 249);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += 3.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text('ÁMBITO DE APLICACIÓN CLÍNICA / SERVICIOS ASISTENCIALES:', marginX, currentY);
  currentY += 3.8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(2, 132, 199);
  const areaLines = doc.splitTextToSize(appArea.toUpperCase(), contentWidth);
  doc.text(areaLines, marginX, currentY);
  currentY += areaLines.length * 3.8 + 2;

  // Bottom boundary line for classification strip
  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += 6;

  // Description block (Direct text, no solid background)
  if (data.description) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('DESCRIPCIÓN TÉCNICA GENERAL:', marginX, currentY);
    currentY += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(30, 41, 59);
    const descLines = doc.splitTextToSize(data.description, contentWidth);
    doc.text(descLines, marginX, currentY);
    currentY += descLines.length * 3.8 + 4;
  }

  // Section: MATERIAL DE FABRICACIÓN DEL PRODUCTO
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('MATERIAL DE FABRICACIÓN DEL PRODUCTO:', marginX, currentY);
  currentY += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(30, 41, 59);
  const materialLines = doc.splitTextToSize(
    data.fabricationMaterial ||
      'Acero Inoxidable de grado quirúrgico o componentes biomédicos certificados conforme a directivas INVIMA y normas internacionales aplicables, garantizando alta biocompatibilidad y resistencia química ante procesos hospitalarios.',
    contentWidth
  );
  doc.text(materialLines, marginX, currentY);
  currentY += materialLines.length * 3.8 + 4;

  // Section: FUNCIÓN PRINCIPAL Y APLICACIÓN CLÍNICA
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('FUNCIÓN PRINCIPAL Y APLICACIÓN CLÍNICA:', marginX, currentY);
  currentY += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(30, 41, 59);
  const funcLines = doc.splitTextToSize(
    data.mainFunction ||
      'Soporte clínico, asistencial o quirúrgico seguro y confiable conforme a la técnica médica, facilitando intervenciones diagnósticas, terapéuticas o de soporte hospitalario continuo.',
    contentWidth
  );
  doc.text(funcLines, marginX, currentY);
  currentY += funcLines.length * 3.8 + 4.5;

  // Section: CARACTERÍSTICAS TÉCNICAS DESTACADAS (Full list to fill the space cleanly)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('CARACTERÍSTICAS TÉCNICAS DESTACADAS:', marginX, currentY);
  currentY += 4.2;

  const charsList = data.characteristics && data.characteristics.length > 0
    ? data.characteristics
    : [
        data.dimensionsDescription || 'Dimensiones adaptadas para uso hospitalario seguro, de fácil movilidad y almacenamiento higiénico en bodegas o áreas de atención.',
        data.designDescription || 'Acabados lisos, sin cantos vivos ni aristas cortantes, facilitando protocolos rigurosos de asepsia y limpieza institucional.',
        'Material certificado de grado médico resistente a procesos continuos de desinfección y esterilización hospitalaria.',
        'Diseño ergonómico que permite un accionamiento suave, seguro y confortable para el personal de salud.',
        'Compatibilidad con protocolos institucionales de control de infecciones y esterilización central.',
        'Cumple rigurosamente con requerimientos de calidad y bioseguridad según normatividad sanitaria vigente.'
      ];

  charsList.slice(0, 8).forEach((charItem) => {
    if (currentY > 232) return;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(2, 132, 199);
    doc.text('•', marginX + 1, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    doc.setTextColor(30, 41, 59);
    const cLines = doc.splitTextToSize(charItem.substring(0, 280), contentWidth - 8);
    doc.text(cLines, marginX + 5, currentY);
    currentY += cLines.length * 3.6 + 1.8;
  });

  // Ventajas Operativas y de Bioseguridad (Fills Page 1 smoothly without overflowing)
  if (currentY <= 236) {
    currentY += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('VENTAJAS TÉCNICAS Y OPERATIVAS INSTITUCIONALES:', marginX, currentY);
    currentY += 4;

    const opAdvantages = [
      'Resistencia superior a agentes desinfectantes hospitalarios, cloro, alcoholes y soluciones enzimáticas.',
      'Superficies higiénicas no porosas que inhiben la formación de biofilm y adhesión de detritos biológicos.',
      'Excelente estabilidad dimensional y tolerancia ante ciclos repetidos de uso y termodesinfección.'
    ];

    for (const adv of opAdvantages) {
      if (currentY > 256) break;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(2, 132, 199);
      doc.text('•', marginX + 1, currentY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.4);
      doc.setTextColor(30, 41, 59);
      const advLines = doc.splitTextToSize(adv, contentWidth - 8);
      doc.text(advLines, marginX + 5, currentY);
      currentY += advLines.length * 3.5 + 1.5;
    }
  }

  // Page 1 subtle transition line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(marginX, 266, pageWidth - marginX, 266);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Continúa en Página 2 — Especificaciones Técnicas, Tabla de Medidas y Garantía`, marginX, 270);

  // ===========================================================================
  // PAGE 2: Tabla de Medidas, Presentación Comercial y Garantía Oficial
  // Layout limpio y básico, sin redundancias ni repeticiones innecesarias.
  // ===========================================================================
  doc.addPage();
  drawPageHeader(2);

  currentY = 36;
  const cat = detectDeviceCategory(data);

  // Section 1: TABLA DE MEDIDAS Y REFERENCIAS TÉCNICAS (Destacada, clara y sin texto montado)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('TABLA DE MEDIDAS, CONFIGURACIONES Y REFERENCIAS TÉCNICAS:', marginX, currentY);
  currentY += 4.5;

  const colCodeW = 50;
  const colDimW = contentWidth - colCodeW;

  // Header table row
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);
  doc.rect(marginX, currentY, colCodeW, 6, 'D');
  doc.rect(marginX + colCodeW, currentY, colDimW, 6, 'D');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text('MEDIDA / REFERENCIA', marginX + 3, currentY + 4.2);
  doc.text('DESCRIPCIÓN / APLICACIÓN TÉCNICA', marginX + colCodeW + 3, currentY + 4.2);
  currentY += 6;

  const refs = (data.referenceTable && data.referenceTable.length > 0)
    ? data.referenceTable
    : getDefaultReferencesForProduct(data.productName, modelName, cat);

  refs.slice(0, 6).forEach((ref) => {
    const codeLines = doc.splitTextToSize(ref.code || '', colCodeW - 6);
    const dimLines = doc.splitTextToSize(ref.dimension || '', colDimW - 6);
    const maxLines = Math.max(codeLines.length, dimLines.length, 1);
    const rowH = Math.max(6, maxLines * 3.8 + 2.8);

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.rect(marginX, currentY, colCodeW, rowH, 'D');
    doc.rect(marginX + colCodeW, currentY, colDimW, rowH, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text(codeLines, marginX + 3, currentY + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(51, 65, 85);
    doc.text(dimLines, marginX + colCodeW + 3, currentY + 4);

    currentY += rowH;
  });

  currentY += 5;

  // Section 2: DESCRIPCIÓN DE DISEÑO Y CONDICIONES ERGONÓMICAS (Si fue provista)
  const designText = data.designDescription || data.dimensionsDescription;
  if (designText) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('DISEÑO Y ERGONOMÍA ASISTENCIAL:', marginX, currentY);
    currentY += 4.2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    const dLines = doc.splitTextToSize(designText, contentWidth);
    doc.text(dLines, marginX, currentY);
    currentY += dLines.length * 3.6 + 4;
  }

  // Section 2: PRESENTACIÓN COMERCIAL & GARANTÍA OFICIAL (En dos columnas limpias)
  const colW = (contentWidth - 6) / 2;
  const colLeftX = marginX;
  const colRightX = marginX + colW + 6;
  const section2StartY = currentY;

  // Columna Izquierda: Presentación
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('PRESENTACIÓN COMERCIAL Y ROTULADO:', colLeftX, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(51, 65, 85);
  const presText = data.presentation ||
    'Suministrado en empaque individual sellado con barrera sanitaria de protección. Rotulado reglamentario INVIMA: Marca, Modelo, Lote, Fecha de Fabricación y Registro Sanitario según normativa legal colombiana vigente.';
  const presLines = doc.splitTextToSize(presText, colW);
  doc.text(presLines, colLeftX, currentY + 4);
  const leftH = 4 + presLines.length * 3.4;

  // Columna Derecha: Garantía
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('GARANTÍA Y ASISTENCIA TÉCNICA:', colRightX, currentY);

  const warranty = data.warrantyPoints || (data.warranty ? [data.warranty] : [
    'Garantía oficial por defectos de fabricación y respaldo institucional.',
    'Disponibilidad asegurada de repuestos y mano de obra calificada en el país.',
    'Sustitución técnica inmediata ante anomalías comprobables de fábrica.',
    'Acompañamiento y asesoría biomédica permanente.',
  ]);

  let rightY = currentY + 4;
  warranty.slice(0, 4).forEach((point) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(2, 132, 199);
    doc.text('•', colRightX + 1, rightY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.1);
    doc.setTextColor(51, 65, 85);
    const wLines = doc.splitTextToSize(point, colW - 6);
    doc.text(wLines, colRightX + 5, rightY);
    rightY += wLines.length * 3.3 + 1.2;
  });
  const rightH = rightY - section2StartY;

  currentY = section2StartY + Math.max(leftH, rightH) + 5;

  // Section 3: PROTOCOLO DE ASEPSIA / ESTERILIZACIÓN Y BIOSEGURIDAD
  const proto = getDeviceProtocol(cat, data);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(proto.title, marginX, currentY);
  currentY += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(51, 65, 85);
  const sterLines = doc.splitTextToSize(proto.description, contentWidth);
  doc.text(sterLines, marginX, currentY);
  currentY += sterLines.length * 3.4 + 3.5;

  // 3 parameter sub-cards adaptadas al producto
  const sterCardY = currentY;
  const sterCardW = (contentWidth - 8) / 3;

  proto.cards.forEach((card, cIdx) => {
    const cardX = marginX + cIdx * (sterCardW + 4);
    doc.setDrawColor(203, 213, 225);
    doc.rect(cardX, sterCardY, sterCardW, 13, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(2, 132, 199);
    doc.text(card.title, cardX + sterCardW / 2, sterCardY + 4.2, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(51, 65, 85);
    doc.text(card.line1, cardX + sterCardW / 2, sterCardY + 8, { align: 'center' });

    doc.setFontSize(5.8);
    doc.setTextColor(100, 116, 139);
    doc.text(card.line2, cardX + sterCardW / 2, sterCardY + 11.2, { align: 'center' });
  });

  currentY += 16.5;

  // Section 4: Two-column Compact Grid (Manipulación + Almacenamiento adaptados)
  const section4StartY = currentY;

  // Manipulación y Operación Segura (Columna Izquierda)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(proto.handlingTitle, colLeftX, currentY);

  let hCurrentY = currentY + 4;
  proto.handling.slice(0, 4).forEach((point) => {
    if (hCurrentY > 258) return;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(2, 132, 199);
    doc.text('•', colLeftX + 1, hCurrentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    const pLines = doc.splitTextToSize(point, colW - 6);
    doc.text(pLines, colLeftX + 5, hCurrentY);
    hCurrentY += pLines.length * 3.3 + 1.2;
  });
  const hHeight = hCurrentY - section4StartY;

  // Almacenamiento y Conservación (Columna Derecha)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(proto.storageTitle, colRightX, currentY);

  let sCurrentY = currentY + 4;
  proto.storage.slice(0, 4).forEach((paragraph) => {
    if (sCurrentY > 258) return;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(2, 132, 199);
    doc.text('•', colRightX + 1, sCurrentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    const sLines = doc.splitTextToSize(paragraph, colW - 6);
    doc.text(sLines, colRightX + 5, sCurrentY);
    sCurrentY += sLines.length * 3.3 + 1.2;
  });

  // Bottom closing line (Fixed cleanly at page bottom y = 266)
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(marginX, 266, pageWidth - marginX, 266);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text(`DOCUMENTO TÉCNICO OFICIAL — FICHA TÉCNICA DE ESPECIFICACIONES`, marginX, 270);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Fin del Documento Técnico Oficial. Válido institucionalmente.`, pageWidth - marginX, 270, { align: 'right' });

  return doc;
}

/**
 * Official PDF exporter utilizing pure vector jsPDF generation.
 * Produces 100% standard-compliant PDFs that open flawlessly in Adobe Acrobat Reader.
 * Guaranteed 2-page structure with crisp typography, vectors, tables, and no corrupted streams.
 */
export async function exportTechnicalSheetPdf(
  data: TechnicalSheetData,
  fileName?: string,
  download: boolean = true,
  onProgress?: (msg: string) => void
): Promise<jsPDF> {
  onProgress?.('Generando documento oficial PDF...');
  const doc = generateTechnicalSheetPdf(data);
  const safeName = (data.productName || 'Producto').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
  const safeModel = (data.model || 'Ref').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 15);
  const outName = fileName || `Ficha_Tecnica_${safeName}_${safeModel}.pdf`;

  if (download) {
    doc.save(outName);
  }
  return doc;
}
