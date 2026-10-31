/**
 * Service to generate equipment clinical description, functionality and
 * dynamic technical characteristics automatically via AI / domain knowledge.
 */

export interface EquipmentAiInfo {
  found: boolean;
  description: string;
  features: string[];
}

/**
 * Checks if a given text is generic placeholder / boilerplate filler
 * that needs to be replaced with real clinical equipment specifications.
 */
export function isGenericFiller(text?: string): boolean {
  if (!text) return true;
  const t = text.toLowerCase();
  return (
    t.includes('desarrollado para operar en entornos asistenciales') ||
    t.includes('brindando alta precisión, confiabilidad operativa') ||
    t.includes('procedimientos médicos especializados') ||
    t.includes('tecnología biomédica diseñada para aplicaciones clínicas') ||
    t.includes('pantalla de visualización intuitiva con monitorización de parámetros') ||
    t.includes('chasis compacto y ergonómico con grado de protección médica') ||
    t.includes('sistema de calibración automática y autodiagnóstico de seguridad') ||
    t.includes('alimentación eléctrica multivoltaje 100-240v') ||
    t.includes('operación electromédica') ||
    t.includes('operacion electromedica') ||
    t.includes('sensores electromédicos') ||
    t.includes('sensores electromedicos') ||
    (t.includes('dispositivo biomédico') && t.includes('diseñado para diagnóstico y control clínico')) ||
    (t.includes('dispositivo biomedico') && t.includes('diseñado para diagnóstico y control clínico')) ||
    (t.includes('dispositivo biomédico') && t.includes('calibrado para diagnóstico y control clínico')) ||
    (t.includes('dispositivo biomedico') && t.includes('calibrado para diagnóstico y control clínico')) ||
    t.includes('protección contra sobretensión') ||
    t.includes('proteccion contra sobretension') ||
    t.includes('aislamiento médico') ||
    t.includes('aislamiento medico') ||
    t.includes('equipo biomédico especializado') ||
    t.includes('equipo biomedico especializado') ||
    t.includes('calibrado para entornos de atención') ||
    t.includes('calibrado para entornos de atencion') ||
    t.includes('panel de control claro con visualización') ||
    t.includes('panel de control claro con visualizacion') ||
    t.includes('componentes de precisión para medición y soporte') ||
    t.includes('componentes de precision para medicion y soporte') ||
    t.includes('diseño compacto y ergonómico para fácil transporte') ||
    t.includes('diseno compacto y ergonomico para facil transporte') ||
    t.includes('equipo nuevo de fábrica con') ||
    t.includes('equipo nuevo de fabrica con') ||
    t.includes('tecnología de alta precisión calibrada en fábrica') ||
    t.includes('tecnologia de alta precision calibrada en fabrica') ||
    t.includes('dispone de estructura y chasis de grado hospitalario con protección de ingreso') ||
    t.includes('pantalla médica digital de alta resolución para visualización de parámetros') ||
    t.includes('pantalla medica digital de alta resolucion para visualizacion de parametros') ||
    t.includes('sistema de respaldo por batería recargable integrada') ||
    t.includes('sistema de respaldo por bateria recargable integrada') ||
    t.includes('alimentación eléctrica hospitalaria de 110-120 vac') ||
    t.includes('alimentacion electrica hospitalaria de 110-120 vac')
  );
}

/**
 * Sanitizes technical features by stripping stars (⭐), bullets, and whitespace.
 */
export function sanitizeBiomedicalFeature(feat: string): string {
  if (!feat) return '';
  return feat
    .replace(/^[⭐*•\-–—\s]+/u, '')
    .replace(/[⭐*]/g, '')
    .trim();
}

/**
 * Cleans descriptions by removing trailing boilerplate pipes and duplicate filler.
 */
export function sanitizeBiomedicalDescription(desc?: string): string {
  if (!desc) return '';
  let cleaned = desc
    .replace(/\|\s*Equipo nuevo de fábrica con(?:\s*\|\s*Equipo nuevo de fábrica con)*/gi, '')
    .replace(/\|\s*Equipo nuevo de fabrica con(?:\s*\|\s*Equipo nuevo de fabrica con)*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned;
}

/**
 * Extracts clean equipment name and accessories text from descriptions or item accessories array.
 */
export function extractEquipmentAndAccessories(
  rawNameOrDesc: string,
  accessoriesArray?: { name: string; quantity: number }[]
): {
  cleanName: string;
  accessoriesText: string;
  hasAccessories: boolean;
} {
  let cleanName = (rawNameOrDesc || '').trim();
  let extractedAcc = '';

  const match = cleanName.match(/(?:^|\n|\r|\s+)(?:ACCESORIOS|ACCESORIO)\s*:\s*([\s\S]+)$/i);
  if (match) {
    extractedAcc = match[1].trim();
    cleanName = cleanName.slice(0, match.index).trim();
  }

  const items: string[] = [];
  if (accessoriesArray && accessoriesArray.length > 0) {
    accessoriesArray.forEach((a) => {
      items.push(`${a.name.toUpperCase()}${a.quantity > 1 ? ` (X${a.quantity})` : ''}`);
    });
  }
  if (extractedAcc) {
    const upperExt = extractedAcc.toUpperCase();
    if (!items.some((it) => it.includes(upperExt))) {
      items.push(upperExt);
    }
  }

  const accessoriesText = items.join(', ');
  return {
    cleanName: cleanName || rawNameOrDesc,
    accessoriesText,
    hasAccessories: items.length > 0,
  };
}

/**
 * Generates tailored, minimal clinical description (fits in Word box) and 5 technical features
 * based on equipment name, brand and model.
 */
export function getBiomedicalHeuristicSpecs(
  equipmentName: string,
  brand: string = '',
  model: string = ''
): { description: string; features: string[] } {
  const trimmed = (equipmentName || '').trim();
  const brandClean = (brand || '').trim();
  const modelClean = (model || '').trim();
  const brandStr = brandClean ? ` ${brandClean.toUpperCase()}` : '';
  const modelStr = modelClean ? ` ${modelClean.toUpperCase()}` : '';

  // Extract clean name in case accessories were pasted inside the name
  const { cleanName } = extractEquipmentAndAccessories(trimmed);
  const lower = (cleanName || trimmed).toLowerCase();
  const fullSearch = `${cleanName || trimmed} ${brandClean} ${modelClean}`.toLowerCase();

  // 0A. Fonendoscopios / Estetoscopios (Welch Allyn 5079-135, Littmann, etc.)
  if (
    lower.includes('fonendo') ||
    lower.includes('esteto') ||
    lower.includes('stethoscope') ||
    fullSearch.includes('5079-135') ||
    fullSearch.includes('5079135')
  ) {
    return {
      description: `Instrumento diagnóstico acústico biaural${brandStr}${modelStr} diseñado para la auscultación clínica no invasiva de ruidos cardíacos, soplos vasculares y sonidos respiratorios pulmonares en adultos y niños mediante campana doble de alta sensibilidad acústica.`,
      features: [
        'Campana doble de acero inoxidable / latón con diafragma sintonizable y campana tradicional',
        'Diafragma de doble frecuencia para auscultar sonidos de alta y baja frecuencia con variación de presión',
        'Olivas anatómicas de sellado suave que proporcionan un aislamiento acústico hermético superior',
        'Tubo binaural de un solo lumen libre de látex ni ftalatos con alta resistencia a grasas cutáneas',
        'Aro y membrana quitafrios para máximo confort térmico del paciente durante la exploración física',
        'Arco binaural con ángulo anatómico que asegura un ajuste ergonómico preciso en el canal auditivo',
      ],
    };
  }

  // 0B. Equipo de Órganos de Pared / Transformador de Pared (Welch Allyn 777-SM2XXX, MacroView, Coaxial)
  if (
    lower.includes('organos de pared') ||
    lower.includes('órganos de pared') ||
    lower.includes('organo de pared') ||
    lower.includes('órgano de pared') ||
    fullSearch.includes('777-sm') ||
    fullSearch.includes('777sm') ||
    (lower.includes('organos') && lower.includes('pared')) ||
    (lower.includes('diagnostico') && lower.includes('pared'))
  ) {
    return {
      description: `Sistema integral de diagnóstico médico ambulatorio montado en pared${brandStr}${modelStr} que suministra energía eléctrica continua a cabezales de oftalmoscopio coaxial y otoscopio de fibra óptica para la exploración física completa de cavidades oculares, oído medio y tímpano.`,
      features: [
        'Transformador de pared con dos mangos ergonómicos y cable en espiral extensible de alta durabilidad',
        'Reostatos electrónicos independientes en cada mango para regulación suave y continua de intensidad lumínica',
        'Cabezal de oftalmoscopio coaxial con ópticas selladas y múltiples aperturas y filtros para fondo de ojo',
        'Cabezal de otoscopio de diagnóstico con puerto para otoscopía neumática y visor de aumento integrado',
        'Dispensador integrado de espéculos óticos desechables para recambio higiénico inmediato',
        'Sensores ópticos de encendido/apagado automático al retirar o colgar los mangos en la base',
      ],
    };
  }

  // 0C. Tensiómetros / Esfigmomanómetros Aneroides y Digitales
  if (
    lower.includes('tensiometro') ||
    lower.includes('tensiómetro') ||
    lower.includes('esfigmomanometro') ||
    lower.includes('esfigmomanómetro')
  ) {
    return {
      description: `Instrumento clínico de precisión${brandStr}${modelStr} para la determinación y monitorización no invasiva de la presión arterial sistólica y diastólica mediante el método auscultatorio con brazalete inflable libre de látex.`,
      features: [
        'Manómetro de alta precisión calibrado en fábrica con carátula de lectura clara y escala de 0 a 300 mmHg',
        'Brazalete de nylon resistente y lavable con marcas de guía de arteria braquial e índice de ajuste',
        'Pera de insuflación ergonómica con válvula de liberación de aire regulable de purga controlada',
        'Cámara de compresión interna vulcanizada de doble vía libre de látex hipoalergénica',
        'Mecanismo de diafragma y engranaje de precisión resistente a golpes e impactos leves',
      ],
    };
  }

  // 0D. Oxímetros de Pulso Portátiles y de Mesa (H100B, etc.)
  if (
    lower.includes('oximetro') ||
    lower.includes('oxímetro') ||
    lower.includes('pulse oximeter') ||
    fullSearch.includes('h100b')
  ) {
    return {
      description: `Dispositivo biomédico portátil${brandStr}${modelStr} para la monitorización no invasiva continua de la saturación de oxígeno en hemoglobina arterial (%SpO2) y pulso cardíaco en tiempo real mediante fotopletismografía óptica con alertas audibles por desaturación.`,
      features: [
        'Medición continua de saturación arterial de oxígeno (SpO2 de 0% a 100%) y pulso cardíaco (PR)',
        'Pantalla LCD con visualización de curva pletismográfica e indicador de barra de intensidad de señal',
        'Alarmas audibles y visuales programables para límites superiores e inferiores de SpO2 y frecuencia',
        'Sensor digital de SpO2 reutilizable para adultos con opción para sensores pediátricos y neonatales',
        'Alimentación por baterías recargables o alcalinas estándar con indicador de carga en pantalla',
      ],
    };
  }

  // 0E. Camilla de Examen Clínico / Dos Planos (MUBI 4131, etc.)
  if (
    lower.includes('camilla') ||
    fullSearch.includes('4131') ||
    (lower.includes('examen') && lower.includes('planos'))
  ) {
    return {
      description: `Mobiliario clínico ergonómico de dos planos${brandStr}${modelStr} diseñado para soportar y posicionar de manera segura al paciente durante exámenes médicos generales, valoraciones clínicas y curaciones, con espaldar reclinable y tapizado impermeable antibacteriano.`,
      features: [
        'Estructura robusta en acero cold rolled con acabado en pintura electrostática resistente a desinfectantes clínicos',
        'Tendido de dos planos acolchado en espuma de alta densidad de 5 cm tapizado en cordobán vinílico lavable e ignífugo',
        'Cabecero ajustable mediante mecanismo manual de cremallera con inclinación gradual de 0° a 70°',
        'Porta-rollo de papel para examen médico incorporado en la sección posterior del espaldar',
        'Patas con regatones plásticos de alta resistencia antideslizantes para máxima estabilidad antivuelco',
        'Capacidad de carga segura de hasta 180 kg para atención clínica diaria en consultorio o urgencias',
      ],
    };
  }

  // 0F. Cama Cuna Pediátrica Eléctrica (MUBI POLARIX 351309, etc.)
  if (
    (lower.includes('cama') && (lower.includes('cuna') || lower.includes('pediatrica') || lower.includes('pediátrica'))) ||
    fullSearch.includes('polarix') ||
    fullSearch.includes('351309')
  ) {
    return {
      description: `Unidad de hospitalización pediátrica motorizada${brandStr}${modelStr} diseñada para el descanso, recuperación y cuidado clínico continuo del paciente infantil, con barandas telescópicas de seguridad anticaídas y graduación electrónica de posiciones anatómicas.`,
      features: [
        'Barandas telescópicas de seguridad verticalmente deslizables con sistema de doble seguro infantil contra caídas',
        'Accionamiento eléctrico silencioso para graduación de respaldo (Fowler), elevación de piernas y altura variable',
        'Tendido ranurado de alta ventilación con colchón pediátrico impermeable termosellado y antibacteriano',
        'Cuatro ruedas de grado hospitalario de 5 pulgadas con freno individual/centralizado y parachoques en las 4 esquinas',
        'Atril porta-sueros telescópico en acero inoxidable ajustable en altura con ganchos multidireccionales',
        'Capacidad de carga de 150 kg diseñada bajo estándares internacionales de seguridad pediátrica hospitalaria',
      ],
    };
  }

  // 0G. Cama de Parto Obstétrica / Cama de Trabajo de Parto (MUBI IXYS 352202, etc.)
  if (
    (lower.includes('cama') && lower.includes('parto')) ||
    fullSearch.includes('ixys') ||
    fullSearch.includes('352202') ||
    lower.includes('obstetrica') ||
    lower.includes('obstétrica')
  ) {
    return {
      description: `Mobiliario obstétrico electrohidráulico multisección${brandStr}${modelStr} diseñado para brindar soporte ergonómico integral a la gestante durante el trabajo de parto, alumbramiento y recuperación inmediata, con sección pélvica retráctil, perneras ajustables y bandejas de recolección de fluidos.`,
      features: [
        'Sección de piecero retráctil que se oculta bajo el asiento facilitando la atención directa del expulsivo y parto',
        'Perneras obstétricas ergonómicas acolchadas con rótulas orientables en todas las direcciones y bloqueo rápido',
        'Movimientos eléctricos continuos de elevación, espaldar Fowler, Trendelenburg y Trendelenburg inverso',
        'Bandeja receptora de fluidos en acero inoxidable deslizable bajo la pelvis de fácil limpieza y desinfección',
        'Manijas de apoyo y tracción para esfuerzo de pujo materno en acero inoxidable con empuñaduras anatómicas',
        'Colchón segmentado de alta resiliencia sin costuras, impermeable a fluidos biológicos y desinfectable',
      ],
    };
  }

  // 0H. Incubadora de Transporte Neonatal (David TI-2000, etc.)
  if (
    (lower.includes('incubadora') && (lower.includes('transporte') || lower.includes('neonatal'))) ||
    fullSearch.includes('ti-2000') ||
    fullSearch.includes('ti2000') ||
    lower.includes('incubadora')
  ) {
    return {
      description: `Sistema móvil de soporte vital neonatal${brandStr}${modelStr} diseñado para crear y preservar un microambiente térmico estable, seguro y enriquecido con oxígeno durante el traslado intra y extrahospitalario de recién nacidos críticos o prematuros, regulando temperatura cutánea y del aire.`,
      features: [
        'Cúpula transparente de doble pared en acrílico con aislamiento térmico, puerta frontal abatible y portillos de acceso',
        'Servocontrol microprocesado con doble modo de operación: control por temperatura de aire y temperatura de piel',
        'Alimentación eléctrica triple: batería interna recargable de alta autonomía, toma vehicular 12V/24V DC y red 110-220 VAC',
        'Pantalla digital con visualización simultánea de temperatura programada, real del aire, de piel y carga de batería',
        'Sistema integral de alarmas audiovisuales para desvío térmico, falla de sensor, sobretemperatura y batería baja',
        'Carro de transporte plegable con ruedas amortiguadas, lámpara de examinación clínica LED y soporte para cilindros de O2',
      ],
    };
  }

  // 0I. Instrumental Quirúrgico / Pinzas (Pinza Foester, Kelly, Allis, Bozzeman, Maguill, Mosquito, Corta Anillos)
  if (
    lower.includes('pinza') ||
    lower.includes('instrumental') ||
    fullSearch.includes('foester') ||
    fullSearch.includes('bozzeman') ||
    fullSearch.includes('allys') ||
    fullSearch.includes('allis') ||
    fullSearch.includes('kelly') ||
    fullSearch.includes('mosquito') ||
    fullSearch.includes('maguill') ||
    fullSearch.includes('corta anillos')
  ) {
    return {
      description: `Instrumental quirúrgico de precisión${brandStr}${modelStr} fabricado en acero inoxidable quirúrgico alemán de alta resistencia para procedimientos clínicos.`,
      features: [
        'Fabricada en acero inoxidable de grado quirúrgico de alta densidad resistente a la corrosión y uso intensivo',
        'Mandíbulas maquinadas con precisión y estriado atraumático para sujeción firme sin deslizamiento',
        'Cierre de cremallera de múltiples pasos para graduación progresiva de la presión de agarre',
        'Anillas ergonómicas diseñadas para un control táctil cómodo y maniobrabilidad precisa del cirujano',
        'Superficie con acabado satinado antirreflejo que evita deslumbramientos bajo la luz quirúrgica',
        'Apta para múltiples ciclos de esterilización por autoclave a vapor, óxido de etileno o calor seco',
      ],
    };
  }
  if (
    fullSearch.includes('neopuff') ||
    fullSearch.includes('rd900') ||
    fullSearch.includes('rd-900') ||
    fullSearch.includes('pieza en t') ||
    fullSearch.includes('pieza t') ||
    fullSearch.includes('t-piece') ||
    ((fullSearch.includes('reanimador') || fullSearch.includes('resucitador')) &&
      (fullSearch.includes('neonatal') || fullSearch.includes('infantil') || fullSearch.includes('fisher')))
  ) {
    const isFisherNeopuff =
      fullSearch.includes('neopuff') || fullSearch.includes('rd900') || fullSearch.includes('fisher');
    return {
      description: isFisherNeopuff
        ? 'Reanimador neonatal neumático con pieza en T Fisher & Paykel Neopuff RD900 diseñado para administrar soporte ventilatorio manual seguro y controlado a recién nacidos con asfixia perinatal, garantizando entrega exacta y constante de Presión Inspiratoria Pico (PIP) y PEEP para proteger los alvéolos pulmonares inmaduros.'
        : `Reanimador neonatal neumático con pieza en T${brandStr}${modelStr} diseñado para administrar soporte ventilatorio manual seguro y controlado a recién nacidos con asfixia perinatal, garantizando entrega exacta y constante de Presión Inspiratoria Pico (PIP) y PEEP para proteger los alvéolos pulmonares inmaduros.`,
      features: [
        'Control neumático de Presión Inspiratoria Pico (PIP) regulable de 5 a 70 cmH2O',
        'Válvula de Presión Positiva al Final de la Espiración (PEEP) ajustable de 1 a 9 cmH2O',
        'Válvula de alivio de seguridad contra sobrepresión con tope predeterminado en 40 cmH2O',
        'Manómetro analógico de alta precisión con rango de lectura de -20 a 80 cmH2O',
        'Entrada estándar para mezcla de gases medicinales con flujo operativo de 5 a 15 L/min',
        'Diseño compacto de montaje para atril rodable, cuna de calor radiante o mesa quirúrgica',
      ],
    };
  }

  // 2. Mesas de Cirugía / Mesas Quirúrgicas / HyBase (Mindray HyBase V5/V3/V6/6100/8300)
  if (
    fullSearch.includes('mesa de cirugia') ||
    fullSearch.includes('mesa de cirugía') ||
    fullSearch.includes('mesa quirurgica') ||
    fullSearch.includes('mesa quirúrgica') ||
    fullSearch.includes('hybase') ||
    fullSearch.includes('mesa de operaciones') ||
    fullSearch.includes('mesa operatoria')
  ) {
    const isMindrayHyBase = fullSearch.includes('hybase') || (fullSearch.includes('mesa') && fullSearch.includes('mindray'));
    return {
      description: isMindrayHyBase
        ? 'Mesa de cirugía electrohidráulica universal multisección Mindray HyBase diseñada para el soporte y posicionamiento anatómico motorizado del paciente durante procedimientos quirúrgicos de todas las especialidades, permitiendo ajustes continuos de elevación, Trendelenburg, flexión de respaldo y acceso ergonómico al equipo médico quirúrgico.'
        : `Mesa de cirugía electrohidráulica universal multisección${brandStr}${modelStr} diseñada para el soporte y posicionamiento anatómico motorizado del paciente durante procedimientos quirúrgicos de todas las especialidades, permitiendo ajustes continuos de elevación, Trendelenburg, flexión de respaldo y acceso ergonómico al equipo médico quirúrgico.`,
      features: [
        'Sistema electrohidráulico motorizado para elevación, Trendelenburg e inclinación lateral',
        'Capacidad de carga de alta resistencia para pacientes de hasta 250 kg (550 lbs)',
        'Superficie radiotransparente longitudinal compatible con Arco en C y rayos X intraoperatorios',
        'Colchón de espuma viscoelástica de descompresión cutánea, antiestático e impermeable',
        'Control de mando por cable ergonómico con botón de bloqueo de seguridad y comando de respaldo',
        'Base compacta de perfil bajo con sistema de freno centralizado para máxima estabilidad',
      ],
    };
  }

  // 3A. Equipos de Rayos X Fijo / Salas de Radiografía Digital Fija (Mindray DigiEye 350, DigiEye 330, etc.)
  if (
    fullSearch.includes('digieye') ||
    fullSearch.includes('rayos x fijo') ||
    fullSearch.includes('rayos-x fijo') ||
    fullSearch.includes('sala de rayos') ||
    ((fullSearch.includes('rayos x') || fullSearch.includes('radiografia')) && fullSearch.includes('fijo'))
  ) {
    const brandName = (brand || '').trim() || 'Mindray';
    const modelName = (model || '').trim() || 'DigiEye 350';
    return {
      description: `Sistema de radiografía digital fija de alta definición ${brandName} ${modelName} diseñado para salas de radiología e imagenología diagnóstica hospitalaria. Permite la emisión de alta potencia de rayos X y adquisición de estudios radiográficos completos (tórax, columna, abdomen y extremidades) tanto en pacientes ambulatorios como encamados, integrando mesa radiográfica con bucky móvil de tablero flotante de 4 vías, estativo vertical de pared (bucky mural para tórax) y detector digital de panel plano (FPD) con previsualización en consola DICOM.`,
      features: [
        'Generador de rayos X de alta frecuencia (50 kW a 65 kW) con tubo de ánodo giratorio de alta disipación calórica',
        'Detector digital de panel plano (Flat Panel Detector - FPD) de cesio (CsI) para máxima nitidez y baja dosis',
        'Mesa de exploración radiográfica con tablero flotante de cuatro vías y frenos electromagnéticos de pedal',
        'Estativo vertical de pared (Bucky mural) contrabalanceado con rejilla antidifusora oscilante para tórax',
        'Consola médica de control y estación de trabajo de adquisición con software de procesamiento de imagen avanzado',
        'Colimador manual multileaf con localizador luminoso LED y conectividad nativa DICOM 3.0 PACS/HIS/RIS',
      ],
    };
  }

  // 3B. Equipos de Rayos X Móvil / Rodable / Portátil (Mindray Mobieye 700, etc.)
  if (
    fullSearch.includes('rayos x') ||
    fullSearch.includes('rayos-x') ||
    fullSearch.includes('radiografia') ||
    fullSearch.includes('radiografía') ||
    fullSearch.includes('mobieye') ||
    fullSearch.includes('flat panel') ||
    fullSearch.includes('detector digital') ||
    fullSearch.includes('arco en c') ||
    fullSearch.includes('fluoroscopia')
  ) {
    const brandName = (brand || '').trim() || 'Mindray';
    const modelName = (model || '').trim() || (fullSearch.includes('mobieye') ? 'MobiEye 700' : 'Móvil con Flat Panel');
    return {
      description: `Equipo médico radiológico móvil rodable digitalizado ${brandName} ${modelName} para la emisión controlada de rayos X y captura instantánea de radiografías diagnósticas directamente al pie de la cama del paciente en UCI, urgencias, quirófano y hospitalización, evaluando tórax, abdomen y estructuras óseas en tiempo real mediante detector inalámbrico plano Flat Panel de alta resolución sin traslados de pacientes críticos.`,
      features: [
        'Generador de alta frecuencia de alta potencia para tomas nítidas con mínima dosis de radiación',
        'Detector de panel plano inalámbrico (Flat Panel) de alta sensibilidad con tecnología de cesio (CsI)',
        'Previsualización de imágenes radiográficas en pantalla táctil médica en menos de 3 segundos',
        'Brazo biónico articulado con amplio alcance para posicionamiento en espacios reducidos de UCI',
        'Tracción motriz asistida con sensores de parachoques anticolisión para transporte ágil',
        'Batería interna de litio de alta autonomía con carga rápida y conectividad DICOM 3.0 PACS',
      ],
    };
  }

  // 4. Mezclador de Gases / Blender de Oxígeno (GMX30U, Sechrist, Bird, etc.)
  if (
    fullSearch.includes('blender') ||
    fullSearch.includes('mezclador') ||
    fullSearch.includes('gmx30') ||
    fullSearch.includes('sechrist') ||
    fullSearch.includes('bird')
  ) {
    return {
      description: `Mezclador de gases medicinales aire/oxígeno${brandStr}${modelStr} de alta precisión para dosificación continua de FiO2 entre 21% y 100% en pacientes neonatales y pediátricos.`,
      features: [
        'Control rotatorio de concentración de oxígeno (FiO2) con calibración continua del 21% al 100%',
        'Sistema neumático de equilibrio de presiones con alarma audible ante falla de suministro de gas',
        'Doble salida DISS estándar para conexión simultánea de equipos y flujómetros clínicos',
        'Cuerpo en aleación médica de alta resistencia con acople para atril o riel hospitalario',
        'Presión de entrada operativa estandarizada de 30 a 75 PSI para fuentes de aire y O2',
      ],
    };
  }

  // 3. Humidificadores Respiratorios (MR850, MR730, Airvo, Fisher & Paykel)
  if (
    fullSearch.includes('mr850') ||
    fullSearch.includes('mr730') ||
    fullSearch.includes('airvo') ||
    (fullSearch.includes('humidificador') && (fullSearch.includes('respiratorio') || fullSearch.includes('fisher')))
  ) {
    return {
      description: `Sistema de humidificación respiratoria activa${brandStr}${modelStr} para gases inspirados con servocontrol de temperatura en cámara y vía aérea del paciente.`,
      features: [
        'Servocontrol dual de temperatura en cámara de humidificación y circuito del paciente',
        'Modos clínicos dedicados para ventilación invasiva (37°C) y no invasiva (31°C)',
        'Compatibilidad con cámaras de autollenado y circuitos respiratorios calefactados',
        'Alarmas audibles y visuales de alta/baja temperatura y desconexión de sondas térmicas',
        'Display digital con lectura continua de temperatura en cámara y en vía aérea distal',
      ],
    };
  }

  // 4. CPAP Neonatal / Bubble CPAP / CPAP de Burbuja
  if (
    fullSearch.includes('bubble cpap') ||
    fullSearch.includes('cpap neonatal') ||
    fullSearch.includes('cpap burbuja') ||
    fullSearch.includes('generador de burbuja')
  ) {
    return {
      description: `Sistema de CPAP de burbuja neonatal${brandStr}${modelStr} que genera presión positiva continua en la vía aérea para prevenir el colapso alveolar en recién nacidos.`,
      features: [
        'Generador de burbujas con columna graduada de presión positiva regulable de 1 a 10 cmH2O',
        'Entrega continua de mezcla de gases calentada y humidificada para protección pulmonar',
        'Cánulas nasales (prongs) anatómicas de silicona médica ultrasuave para neonatos y prematuros',
        'Válvula de seguridad contra sobrepresión para máxima protección de la vía aérea infantil',
        'Flujo continuo oscilatorio que favorece el reclutamiento alveolar y reduce el trabajo respiratorio',
      ],
    };
  }

  // 5. Fototerapia Neonatal / Lámparas de Fototerapia
  if (
    fullSearch.includes('fototerapia') ||
    fullSearch.includes('biliblanket') ||
    fullSearch.includes('ictericia')
  ) {
    return {
      description: `Sistema de fototerapia intensiva neonatal${brandStr}${modelStr} con emisión LED de banda estrecha (450-475 nm) para tratamiento eficaz de hiperbilirrubinemia.`,
      features: [
        'Módulos LED de alta irradiancia (≥ 30-45 µW/cm²/nm) en el espectro óptimo de absorción de bilirrubina',
        'Haz de luz fría libre de radiación infrarroja (IR) y ultravioleta (UV) para evitar sobrecalentamiento',
        'Contador digital de horas integrado para control preventivo del tiempo de tratamiento',
        'Soporte con pedestal regulable en altura e inclinación adaptable a incubadoras y cunas',
        'Temporizador programable con corte automático y operación completamente silenciosa',
      ],
    };
  }

  // 6. Soportes y Atriles Rodables de Fijación
  if (
    fullSearch.includes('soporte para atril') ||
    fullSearch.includes('puntos de fijacion') ||
    (fullSearch.includes('atril') && fullSearch.includes('soporte'))
  ) {
    return {
      description: `Soporte rodable clínico${brandStr}${modelStr} con base pesada de puntos de apoyo y ruedas hospitalarias con freno para fijación segura de equipos biomédicos.`,
      features: [
        'Estructura de alta estabilidad en acero inoxidable con recubrimiento epóxico hospitalario',
        'Base con bajo centro de gravedad y ruedas giratorias grado médico con sistema de freno',
        'Placa superior con anclajes estandarizados para montaje seguro de consolas y mezcladores',
        'Ajuste ergonómico de altura con mecanismo de sujeción firme y resistente',
        'Canastilla portaaccesorios integrada para mangueras de gases y consumibles clínicos',
      ],
    };
  }

  // 7. Oscilometría / Oscilación Pulmonar / FOT / Espirometría
  if (
    fullSearch.includes('oscilacion') ||
    fullSearch.includes('pulmonar') ||
    fullSearch.includes('resmon') ||
    fullSearch.includes('espiromet') ||
    fullSearch.includes('fot') ||
    fullSearch.includes('impedanc')
  ) {
    return {
      description: `Equipo de oscilometría de impulso (FOT)${brandStr}${modelStr} que mide resistencia y reactancia respiratoria en respiración corriente sin esfuerzo voluntario del paciente.`,
      features: [
        'Medición de resistencia y reactancia respiratoria por oscilometría forzada (FOT)',
        'Evaluación pulmonar en respiración corriente espontánea sin maniobras forzadas',
        'Diferenciación de obstrucción en vía aérea central y periférica (R5, R20, X5)',
        'Pantalla médica digital con registro en tiempo real de impedancia respiratoria',
        'Neumotacógrafo con filtros antibacterianos/virales de baja resistencia',
      ],
    };
  }

  // 2. Monitores de Signos Vitales
  if (
    lower.includes('monitor') ||
    lower.includes('signos vitales') ||
    lower.includes('multiparámetro') ||
    lower.includes('multiparametro') ||
    lower.includes('epm') ||
    lower.includes('ipm') ||
    lower.includes('beneview')
  ) {
    return {
      description: `Monitor de signos vitales hospitalario${brandStr}${modelStr} que capta y grafica en tiempo real ECG, SpO2, PNI y temperatura con alarmas inmediatas.`,
      features: [
        'Monitoreo continuo de ECG, SpO2, Presión No Invasiva (PNI) y Temperatura',
        'Pantalla médica a color con visualización multicanal de ondas continuas',
        'Sistema de alarmas visuales y audibles clasificadas por prioridad clínica',
        'Batería recargable integrada para traslado intrahospitalario del paciente',
        'Conectividad para integración a centrales de monitoreo y expediente clínico',
      ],
    };
  }

  // 3. Desfibriladores
  if (
    lower.includes('desfibrilador') ||
    lower.includes('dea') ||
    lower.includes('cardioversor') ||
    lower.includes('beneheart')
  ) {
    return {
      description: `Desfibrilador bifásico hospitalario${brandStr}${modelStr} para reanimación cardiopulmonar con descarga rápida y monitorización de ritmo cardíaco.`,
      features: [
        'Tecnología de desfibrilación bifásica exponencial truncada de alta eficacia',
        'Modos de operación: Manual, DEA y Marcapasos transcutáneo no invasivo',
        'Pantalla a color de alta resolución para visualización de curva ECG',
        'Palas externas multifunción para pacientes adultos y pediátricos',
        'Capacidad de descarga sincronizada para cardioversión de emergencia',
      ],
    };
  }

  // 4. Ventiladores Mecánicos
  if (
    lower.includes('ventilador') ||
    lower.includes('respirador') ||
    lower.includes('sv300') ||
    lower.includes('synovent') ||
    lower.includes('mecanico')
  ) {
    return {
      description: `Ventilador pulmonar invasivo y no invasivo${brandStr}${modelStr} con turbina integrada para soporte respiratorio en cuidados intensivos.`,
      features: [
        'Modos ventilatorios avanzados por volumen, presión y respiración espontánea',
        'Turbina interna de alto flujo que opera sin suministro de aire comprimido de pared',
        'Monitoreo en tiempo real de curvas de presión, flujo, volumen y lazos pulmonares',
        'Pantalla táctil a color con configuración rápida de parámetros y alarmas',
        'Batería interna recargable de respaldo para transporte intrahospitalario',
      ],
    };
  }

  // 5. Bombas de Infusión
  if (
    lower.includes('bomba') &&
    (lower.includes('infusion') || lower.includes('infusión') || lower.includes('jeringa') || lower.includes('benefusion'))
  ) {
    return {
      description: `Bomba de infusión volumétrica${brandStr}${modelStr} para dosificación intravenosa continua de alta precisión con sensores de oclusión y aire.`,
      features: [
        'Infusión volumétrica continua y en bolos con precisión milimétrica',
        'Sensor ultrasónico de detección de burbujas de aire en la línea',
        'Sistema de detección de oclusión proximal y distal con niveles ajustables',
        'Biblioteca de medicamentos programable para prevención de errores de dosis',
        'Batería de larga duración y abrazadera de fijación para atril de suero',
      ],
    };
  }

  // 6. Electrobisturí / Unidades Electroquirúrgicas
  if (
    lower.includes('electrobisturi') ||
    lower.includes('electrobisturí') ||
    lower.includes('electroquirurg') ||
    lower.includes('bovie') ||
    lower.includes('electrocirug')
  ) {
    return {
      description: `Unidad electroquirúrgica digital${brandStr}${modelStr} para corte y coagulación monopolar y bipolar con control de dispersión térmica.`,
      features: [
        'Modos de corte puro y mixto con regulación digital de potencia de salida',
        'Coagulación por contacto y spray con mínima carbonización tisular',
        'Sistema de monitorización continua de placa neutra y contacto del paciente',
        'Salidas monopolares y bipolares con activación manual y por pedalera',
        'Protección contra sobrecargas y autodiagnóstico de encendido automático',
      ],
    };
  }

  // 7. Ecógrafos / Ultrasonido
  if (
    lower.includes('ecografo') ||
    lower.includes('ecógrafo') ||
    lower.includes('ultrasonid') ||
    lower.includes('transductor')
  ) {
    return {
      description: `Sistema de ultrasonido diagnóstico digital${brandStr}${modelStr} para visualización anatómica y hemodinámica Doppler en tiempo real.`,
      features: [
        'Procesamiento de imagen digital con armónicas tisulares y reducción de ruido speckle',
        'Modos de trabajo: Modo B, M, Doppler Color, Doppler Pulsado y Doppler Continuo',
        'Monitor médico de alta definición con brazo de inclinación ajustable',
        'Múltiples puertos activos para transductores convexos, lineales y endocavitarios',
        'Conectividad DICOM 3.0 para archivo y comunicación hospitalaria PACS',
      ],
    };
  }

  // 8. Electrocardiógrafos
  if (
    lower.includes('electrocardiog') ||
    lower.includes('ecg') ||
    lower.includes('ekg')
  ) {
    return {
      description: `Electrocardiógrafo digital de 12 derivadas${brandStr}${modelStr} con interpretación diagnóstica automática e impresión térmica simultánea.`,
      features: [
        'Adquisición simultánea de 12 derivaciones con filtros digitales de ruido',
        'Algoritmo clínico de interpretación automática de arritmias e intervalos',
        'Impresora térmica de alta resolución para formato estándar de 3 a 12 canales',
        'Pantalla LCD a color con previsualización del trazado antes de imprimir',
        'Memoria interna para archivo de estudios y exportación digital de datos',
      ],
    };
  }

  // 9. Laringoscopios y Videolaringoscopios
  if (
    lower.includes('laringoscopio') ||
    lower.includes('videolaringoscopio') ||
    lower.includes('glidescope')
  ) {
    return {
      description: `Videolaringoscopio médico digital${brandStr}${modelStr} con microcámara integrada y pantalla a color para intubación orotraqueal guiada.`,
      features: [
        'Cámara digital antivaho de alta definición con iluminación LED de haz frío',
        'Pantalla médica abatible a color para visión directa de la glotis',
        'Hojas reutilizables de acero inoxidable o desechables para adulto y pediatría',
        'Grabación de capturas y video en memoria interna para registro clínico',
        'Batería recargable integrada con carga rápida por estación o USB',
      ],
    };
  }

  // 10. Suctores / Aspiradores de Secreciones
  if (
    lower.includes('aspirador') ||
    lower.includes('suctor') ||
    lower.includes('succion') ||
    lower.includes('succión')
  ) {
    return {
      description: `Unidad de succión médica continua${brandStr}${modelStr} que genera presión negativa regulada para aspirar fluidos y secreciones respiratorias.`,
      features: [
        'Bomba de vacío de pistón libre de mantenimiento y operación silenciosa',
        'Regulador de vacío continuo con manómetro analógico de alta precisión',
        'Frascos de recolección en policarbonato autoclavable con válvula antirrebose',
        'Filtro hidrófobo antibacteriano para protección del circuito interno',
        'Chasis ergonómico con ruedas hospitalarias y frenos de seguridad',
      ],
    };
  }

  // 11. Instrumental Quirúrgico (pinzas, tijeras, portaagujas, etc.)
  if (
    lower.includes('pinza') ||
    lower.includes('tijera') ||
    lower.includes('instrumental') ||
    lower.includes('portaagujas') ||
    lower.includes('cureta') ||
    lower.includes('babcock') ||
    lower.includes('metzenbaum') ||
    lower.includes('farabeuf') ||
    lower.includes('kelly') ||
    lower.includes('kocher')
  ) {
    return {
      description: `Instrumental quirúrgico especializado${brandStr}${modelStr} en acero inoxidable de grado médico para prensión, hemostasia o disección atraumática.`,
      features: [
        'Fabricado en acero inoxidable quirúrgico alemán de alta durabilidad',
        'Acabado satinado mate antideslumbrante para confort bajo lámparas de quirófano',
        'Mecanismo de cremallera de sujeción progresiva con liberación suave',
        'Bordes y mandíbulas de precisión calibradas para no lesionar tejidos',
        'Resistencia a corrosión y ciclos repetidos de autoclave a vapor a 134°C',
      ],
    };
  }

  // 12. Incubadoras y Cunas de Calor Radiante
  if (
    lower.includes('incubadora') ||
    lower.includes('servocuna') ||
    lower.includes('calor radiante')
  ) {
    return {
      description: `Sistema de aislamiento neonatal${brandStr}${modelStr} que brinda un microambiente térmico controlado con temperatura y humedad óptimas para el recién nacido.`,
      features: [
        'Servocontrol digital con control por temperatura de aire y de piel neonatal',
        'Sistema activo de humidificación que minimiza pérdidas insensibles de agua',
        'Cúpula transparente de alta resistencia con ventanillas y mangas de acceso',
        'Colchón radiotransparente reclinable con inclinación Trendelenburg',
        'Panel de alarmas audibles y visuales para temperatura, flujo de aire y sensores',
      ],
    };
  }

  // 13. Lámparas Quirúrgicas / Cialíticas
  if (
    lower.includes('lampara') ||
    lower.includes('lámpara') ||
    lower.includes('cialitica') ||
    lower.includes('cialítica') ||
    lower.includes('quirurgica')
  ) {
    return {
      description: `Lámpara quirúrgica cialítica${brandStr}${modelStr} con iluminación LED blanca de haz frío, diseñada para iluminar la cavidad operatoria sin sombras.`,
      features: [
        'Módulos LED de alto rendimiento óptico con índice de reproducción superior a 95',
        'Campo lumínico homogéneo y focalizado libre de sombras con baja emisión térmica',
        'Brazo articulado compensado con movimiento suave y posicionamiento estable',
        'Regulación digital de intensidad lumínica desde panel táctil ergonómico',
        'Mango central desmontable y autoclavable para manipulación por el cirujano',
      ],
    };
  }

  // Fallback biomédico técnico y conciso (bajo 140 caracteres)
  return {
    description: `Equipo biomédico especializado${brandStr}${modelStr} diseñado para entornos clínicos hospitalarios con operación confiable y segura.`,
    features: [
      'Calibrado para entornos de atención y diagnóstico clínico continuo',
      'Panel de control claro con visualización directa de parámetros operativos',
      'Componentes de precisión para medición y soporte confiable en el paciente',
      'Estructura de grado médico resistente a desinfectantes y uso hospitalario',
      'Diseño compacto y ergonómico para fácil transporte e instalación en sala',
    ],
  };
}

export async function fetchEquipmentDescriptionAndFeatures(
  equipmentName: string,
  brand?: string,
  model?: string
): Promise<EquipmentAiInfo> {
  const trimmed = (equipmentName || '').trim();
  if (!trimmed) {
    return { found: false, description: '', features: [] };
  }

  const brandClean = (brand || '').trim();
  const modelClean = (model || '').trim();

  // Instant clinical heuristic match
  const heuristic = getBiomedicalHeuristicSpecs(trimmed, brandClean, modelClean);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch('/api/gemini/equipment-description', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        equipmentName: trimmed,
        brand: brandClean,
        model: modelClean,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.found && data.description && !isGenericFiller(data.description)) {
        return {
          found: true,
          description: data.description,
          features: Array.isArray(data.features) && data.features.length > 0 ? data.features : heuristic.features,
        };
      }
    }
  } catch (err) {
    console.warn('Error fetching equipment info from AI service, using clinical specs:', err);
  }

  return {
    found: true,
    description: heuristic.description,
    features: heuristic.features,
  };
}
