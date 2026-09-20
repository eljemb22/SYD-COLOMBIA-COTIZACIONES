// Utility for AI, Real-Time Advice, and Range-Aware Technical Specification Optimization

export interface SpecOptimizationResult {
  optimized: string;
  formal: string;
  diferencial: string;
  isUniqueCandidate: boolean;
  uniqueReason?: string;
  detectedWorkRange?: string;
  isParametricSpec?: boolean;
  paramName?: string;
  rangeVersion?: string;
  rangeVariants?: RangeVariants;
}

export interface BiomedicalRangePreset {
  id: string;
  name: string;
  category: string;
  defaultMin: string;
  defaultMax: string;
  unit: string;
  defaultPrecision?: string;
  patientCoverage?: string;
  exampleSpec: string;
}

// Bank of Standard Biomedical Parameters with Work Ranges
export const STANDARD_BIOMEDICAL_WORK_RANGES: BiomedicalRangePreset[] = [
  {
    id: 'hr',
    name: 'Frecuencia Cardíaca (ECG / Pulso)',
    category: 'Monitoreo',
    defaultMin: '15',
    defaultMax: '300',
    unit: 'lpm',
    defaultPrecision: 'resolución de 1 lpm y precisión de ±1%',
    patientCoverage: 'Adulto, Pediátrico y Neonatal',
    exampleSpec:
      'Rango de medición y trabajo de frecuencia cardíaca continuo de 15 a 300 lpm con resolución de 1 lpm, alarmas programables de bradicardia y taquicardia.',
  },
  {
    id: 'nibp',
    name: 'Presión Arterial No Invasiva (NIBP)',
    category: 'Monitoreo',
    defaultMin: '10',
    defaultMax: '270',
    unit: 'mmHg',
    defaultPrecision: 'precisión de ±3 mmHg o ±2%',
    patientCoverage: 'Adulto (40-270 mmHg) y Pediátrico/Neonatal (10-200 mmHg)',
    exampleSpec:
      'Rango de medición de presión arterial no invasiva (NIBP) de 10 a 270 mmHg, con modos de operación manual, automático y continuo STAT con protección por sobrepresión.',
  },
  {
    id: 'spo2',
    name: 'Saturación de Oxígeno (SpO2)',
    category: 'Monitoreo',
    defaultMin: '0',
    defaultMax: '100',
    unit: '%',
    defaultPrecision: 'precisión de ±2% en rango de 70 a 100%',
    patientCoverage: 'Tecnología anti-movimiento y baja perfusión',
    exampleSpec:
      'Rango de medición de SpO2 de 0 a 100% con tecnología digital anti-movimiento, indicación de índice de perfusión (PI) y tono de pulso pitch variable.',
  },
  {
    id: 'resp',
    name: 'Frecuencia Respiratoria (Impedancia / Flujo)',
    category: 'Monitoreo / Ventilación',
    defaultMin: '0',
    defaultMax: '150',
    unit: 'rpm',
    defaultPrecision: 'resolución de 1 rpm con alarma de apnea ajustable',
    patientCoverage: 'Neonatal a Adulto',
    exampleSpec:
      'Rango de frecuencia respiratoria de 0 a 150 rpm/bpm por impedancia torácica, con retardo de alarma de apnea configurable entre 10 y 40 segundos.',
  },
  {
    id: 'temp',
    name: 'Temperatura Corporal (Dual YSI)',
    category: 'Monitoreo',
    defaultMin: '0.0',
    defaultMax: '50.0',
    unit: '°C',
    defaultPrecision: 'precisión de ±0.1 °C',
    patientCoverage: 'Canales duales T1, T2 y cálculo de Delta T',
    exampleSpec:
      'Rango de medición de temperatura corporal continua de 0.0 a 50.0 °C con dos canales simultáneos y cálculo automático de gradiente térmico (Delta T).',
  },
  {
    id: 'vt',
    name: 'Volumen Corriente (Ventilación Mecánica Vt)',
    category: 'Anestesia / UCI',
    defaultMin: '10',
    defaultMax: '1500',
    unit: 'ml',
    defaultPrecision: 'incrementos de 1 ml (neonatal) y 5 ml (adulto)',
    patientCoverage: 'Neonatal, Pediátrico y Adulto Bariátrico',
    exampleSpec:
      'Rango de entrega de volumen corriente (Vt) de 10 a 1500 ml con compensación activa de compliancia del circuito y fugas en tiempo real.',
  },
  {
    id: 'peep',
    name: 'Presión Positiva al Final de Espiración (PEEP)',
    category: 'Anestesia / UCI',
    defaultMin: '0',
    defaultMax: '35',
    unit: 'cmH2O',
    defaultPrecision: 'ajustable en pasos de 1 cmH2O',
    patientCoverage: 'Válvula PEEP electrónica integrada',
    exampleSpec:
      'Rango de ajuste de PEEP electrónica integrada de 0 a 35 cmH2O, con estabilidad continua ante fluctuaciones de flujo.',
  },
  {
    id: 'gas_flow',
    name: 'Flujo de Gases Medicinales (O2 / Aire / N2O)',
    category: 'Anestesia / Gases',
    defaultMin: '0.1',
    defaultMax: '15.0',
    unit: 'L/min',
    defaultPrecision: 'flujómetros digitales con microflujo desde 0.05 L/min',
    patientCoverage: 'Mezclador electrónico de alta precisión',
    exampleSpec:
      'Rango de suministro de flujo de gases medicinales de 0.1 a 15.0 L/min con mezclador digital y protección hipóxica mínima de O2 al 25%.',
  },
  {
    id: 'defib_energy',
    name: 'Energía de Desfibrilación Bifásica',
    category: 'Emergencias / Desfibrilación',
    defaultMin: '1',
    defaultMax: '360',
    unit: 'Joules',
    defaultPrecision: 'selección escalonada pediátrica de 1 a 10 J y adulto hasta 360 J',
    patientCoverage: 'Forma de onda exponencial truncada bifásica',
    exampleSpec:
      'Rango de energía de desfibrilación bifásica programable de 1 a 360 Joules, con tiempo de carga a máxima energía no superior a 5 segundos.',
  },
  {
    id: 'electrosurg_cut',
    name: 'Potencia de Corte Monopolar (Electrobisturí)',
    category: 'Quirófano / Cirugía',
    defaultMin: '10',
    defaultMax: '300',
    unit: 'Watts',
    defaultPrecision: 'ajuste digital en pasos de 1W',
    patientCoverage: 'Modos Pure Cut y Blend con autorregulación tisular',
    exampleSpec:
      'Rango de potencia de corte monopolar de 10 a 300 Watts a 300-500 kHz, con sistema de monitoreo dinámico de placa de retorno del paciente.',
  },
  {
    id: 'infusion_rate',
    name: 'Tasa de Flujo de Bomba de Infusión',
    category: 'Infusión',
    defaultMin: '0.1',
    defaultMax: '1200',
    unit: 'ml/h',
    defaultPrecision: 'pasos de 0.01 ml/h en microinfusión',
    patientCoverage: 'Programación por dosis y biblioteca de fármacos',
    exampleSpec:
      'Rango de tasa de infusión ajustable de 0.1 a 1200.0 ml/h con precisión no inferior a ±5% y función de bolo programable.',
  },
  {
    id: 'battery_autonomy',
    name: 'Autonomía de Batería de Respaldo',
    category: 'Eléctrico / Portabilidad',
    defaultMin: '2',
    defaultMax: '6',
    unit: 'horas',
    defaultPrecision: 'batería de Iones de Litio recargable',
    patientCoverage: 'Monitoreo y transporte continuo',
    exampleSpec:
      'Sistema de respaldo por batería de litio recargable con autonomía operativa continua no menor a 4 horas e indicador visual en pantalla.',
  },
];

// Helper to generate perfectly drafted specification from parameters & range
export function buildRangeSpecification(
  paramName: string,
  min: string | number,
  max: string | number,
  unit: string,
  options?: {
    precision?: string;
    patientOrContext?: string;
    isUnique?: boolean;
  }
): { text: string; workRange: string } {
  const cleanParam = paramName.trim();
  const cleanMin = String(min).trim();
  const cleanMax = String(max).trim();
  const cleanUnit = unit.trim();
  const workRange = `${cleanMin} a ${cleanMax} ${cleanUnit}`;

  let spec = `Rango de trabajo de ${cleanParam.toLowerCase()} de ${cleanMin} a ${cleanMax} ${cleanUnit}`;

  if (options?.precision?.trim()) {
    spec += `, con ${options.precision.trim()}`;
  }

  if (options?.patientOrContext?.trim()) {
    spec += `, aplicable para ${options.patientOrContext.trim()}`;
  }

  spec += '.';

  // Capitalize
  spec = spec.charAt(0).toUpperCase() + spec.slice(1);

  return {
    text: spec,
    workRange,
  };
}

// Live Drafting Advice Engine
export interface LiveDraftAdvice {
  adviceTitle: string;
  adviceMessage: string;
  suggestedImprovement?: string;
  extractedRange?: {
    min: string;
    max: string;
    unit: string;
    formatted: string;
  };
  isRangeDetected: boolean;
  quickAddKeywords: string[];
}

export function getLiveDraftingAdvice(
  text: string,
  equipmentName?: string
): LiveDraftAdvice | null {
  if (!text || text.trim().length < 3) return null;

  const raw = text.trim();
  const lower = raw.toLowerCase();

  // Check for range patterns like "50 a 100 lpm", "10 - 270 mmhg", "entre 10 y 1500 ml"
  const rangeRegex =
    /(?:entre\s+)?(\d+(?:\.\d+)?)\s*(?:a|hasta|-|–|y)\s*(\d+(?:\.\d+)?)\s*([a-zA-Z°\/%]+)?/i;
  const match = raw.match(rangeRegex);

  let extractedRange: LiveDraftAdvice['extractedRange'] | undefined;
  if (match) {
    const minVal = match[1];
    const maxVal = match[2];
    let unitVal = match[3] || '';

    // Normalize unit if found
    if (/lpm|bpm|latidos|pulsos/i.test(unitVal || lower)) unitVal = 'lpm';
    else if (/mmhg|presion/i.test(unitVal || lower)) unitVal = 'mmHg';
    else if (/cmh2o|cm h2o|peep/i.test(unitVal || lower)) unitVal = 'cmH2O';
    else if (/ml|cc/i.test(unitVal || lower)) unitVal = 'ml';
    else if (/l\/min|lpm|litros/i.test(unitVal || lower)) unitVal = 'L/min';
    else if (/joules|j/i.test(unitVal || lower)) unitVal = 'Joules';
    else if (/watts|w/i.test(unitVal || lower)) unitVal = 'Watts';
    else if (/hz/i.test(unitVal || lower)) unitVal = 'Hz';
    else if (/mhz/i.test(unitVal || lower)) unitVal = 'MHz';
    else if (/°c|grados|celsius/i.test(unitVal || lower)) unitVal = '°C';
    else if (/horas|hrs|h/i.test(unitVal || lower)) unitVal = 'horas';
    else if (/%|porciento/i.test(unitVal || lower)) unitVal = '%';

    extractedRange = {
      min: minVal,
      max: maxVal,
      unit: unitVal,
      formatted: `${minVal} a ${maxVal} ${unitVal}`.trim(),
    };
  }

  // 1. Frequency / Heart Rate
  if (lower.includes('frecuencia') || lower.includes('cardiaca') || lower.includes('cardíaca') || lower.includes('lpm') || lower.includes('pulso')) {
    const min = extractedRange?.min || '15';
    const max = extractedRange?.max || '300';
    return {
      adviceTitle: '💡 Parámetro de Rango: Frecuencia Cardíaca (lpm)',
      adviceMessage:
        'Para pliegos técnicos, estipule el rango de trabajo continuo en lpm (ej: 15 a 300 lpm), la resolución (1 lpm) y las alarmas audibles.',
      suggestedImprovement: `Rango de trabajo de frecuencia cardíaca continuo de ${min} a ${max} lpm con resolución de 1 lpm y alarmas programables de bradicardia/taquicardia.`,
      extractedRange,
      isRangeDetected: !!extractedRange,
      quickAddKeywords: ['15 a 300 lpm', 'Resolución 1 lpm', 'Alarmas bradi/taqui'],
    };
  }

  // 2. NIBP / Blood Pressure
  if (lower.includes('presion') || lower.includes('presión') || lower.includes('nibp') || lower.includes('sistolica') || lower.includes('diastolica') || lower.includes('mmhg')) {
    const min = extractedRange?.min || '10';
    const max = extractedRange?.max || '270';
    return {
      adviceTitle: '💡 Parámetro de Rango: Presión NIBP (mmHg)',
      adviceMessage:
        'Especifique el rango sistólico/diastólico (ej: 10 a 270 mmHg), modos manual/automático/STAT y válvula de seguridad por sobrepresión.',
      suggestedImprovement: `Rango de medición de presión no invasiva (NIBP) de ${min} a ${max} mmHg, con modos manual, automático y STAT con protección por sobrepresión.`,
      extractedRange,
      isRangeDetected: !!extractedRange,
      quickAddKeywords: ['10 a 270 mmHg', 'Modos Manual/Auto/STAT', 'Protección sobrepresión'],
    };
  }

  // 3. SpO2 / Pulse Oximetry
  if (lower.includes('spo2') || lower.includes('oximetria') || lower.includes('oxígeno') || lower.includes('saturacion') || lower.includes('saturación')) {
    return {
      adviceTitle: '💡 Parámetro de Rango: Oximetría SpO2 (%)',
      adviceMessage:
        'Indique rango de 0 a 100%, tecnología anti-movimiento / baja perfusión y cálculo de índice de perfusión (PI).',
      suggestedImprovement:
        'Rango de medición de SpO2 de 0 a 100% con tecnología digital anti-movimiento, indicación de índice de perfusión (PI) y curva pletismográfica.',
      extractedRange,
      isRangeDetected: !!extractedRange,
      quickAddKeywords: ['0 a 100%', 'Tecnología anti-movimiento', 'Índice de perfusión PI'],
    };
  }

  // 4. Tidal Volume (Vt)
  if (lower.includes('volumen') || lower.includes('vt') || lower.includes('tidal') || lower.includes('corriente') || lower.includes('ml')) {
    const min = extractedRange?.min || '10';
    const max = extractedRange?.max || '1500';
    return {
      adviceTitle: '💡 Parámetro de Rango: Volumen Corriente Vt (ml)',
      adviceMessage:
        'Especifique el rango en ml (ej: 10 a 1500 ml), cobertura de pacientes (neonatal a adulto) y compensación automática de compliancia.',
      suggestedImprovement: `Rango de volumen corriente (Vt) ajustable de ${min} a ${max} ml para pacientes neonatales, pediátricos y adultos con compensación de compliancia.`,
      extractedRange,
      isRangeDetected: !!extractedRange,
      quickAddKeywords: ['10 a 1500 ml', 'Neonatal a Adulto', 'Compensación de circuito'],
    };
  }

  // 5. Battery / Autonomy
  if (lower.includes('bateria') || lower.includes('batería') || lower.includes('autonomia') || lower.includes('autonomía') || lower.includes('litio')) {
    const hours = extractedRange?.max || extractedRange?.min || '4';
    return {
      adviceTitle: '💡 Especificación Eléctrica: Autonomía de Batería',
      adviceMessage:
        'Requisitos de pliego exigen definir tecnología (Iones de Litio), autonomía operativa mínima comprobable en horas e indicador visual en pantalla.',
      suggestedImprovement: `Sistema de respaldo por batería de litio recargable integrada con autonomía operativa continua no menor a ${hours} horas e indicador de carga en pantalla.`,
      extractedRange,
      isRangeDetected: !!extractedRange,
      quickAddKeywords: ['Autonomía ≥4 horas', 'Batería Litio recargable', 'Indicador de carga'],
    };
  }

  // 6. Display / Screen
  if (lower.includes('pantalla') || lower.includes('monitor') || lower.includes('display') || lower.includes('touch') || lower.includes('tactil') || lower.includes('táctil') || lower.includes('pulgad')) {
    const inches = raw.match(/(\d+(?:\.\d+)?)\s*(?:pulg|\"|pulgadas?)/i)?.[1] || '12.1';
    return {
      adviceTitle: '💡 Especificación Visual: Pantalla Médica',
      adviceMessage:
        'En pliegos, utilice "no inferior a X pulgadas", especifique si es táctil capacitiva/resistiva y el número de curvas visualizables.',
      suggestedImprovement: `Pantalla médica a color no inferior a ${inches} pulgadas táctil de alta resolución con visualización simultánea de parámetros y curvas en tiempo real.`,
      extractedRange,
      isRangeDetected: false,
      quickAddKeywords: ['No inferior a 15 pulgadas', 'Táctil de alta resolución', 'Multicurva simultánea'],
    };
  }

  // Generic Range Match
  if (extractedRange && extractedRange.min && extractedRange.max) {
    return {
      adviceTitle: `📊 Rango de Trabajo Detectado: ${extractedRange.formatted}`,
      adviceMessage: `Se detectó el rango de trabajo "${extractedRange.formatted}". Para pliegos se aconseja formularlo como "Rango de trabajo de [Parámetro] de ${extractedRange.formatted} con resolución..."`,
      suggestedImprovement: `Rango de trabajo operativo de ${extractedRange.formatted} con estabilidad continua y alta precisión clínica.`,
      extractedRange,
      isRangeDetected: true,
      quickAddKeywords: [`Rango ${extractedRange.formatted}`, 'Alta precisión clínica'],
    };
  }

  // Generic drafting advice if text is short or informal
  if (raw.length < 35 && !raw.startsWith('Dispone') && !raw.startsWith('Sistema') && !raw.startsWith('Rango') && !raw.startsWith('Capacidad') && !raw.startsWith('Módulo')) {
    return {
      adviceTitle: '💡 Consejo de Redacción para Pliegos Técnicos',
      adviceMessage:
        'Comience con verbos y conectores técnicos estandarizados: "Dispone de...", "Capacidad de...", "Rango de trabajo de...", "Incorpora módulo de...".',
      suggestedImprovement: `Dispone de ${raw.charAt(0).toLowerCase() + raw.slice(1)}, cumpliendo estándares hospitalarios vigentes.`,
      isRangeDetected: false,
      quickAddKeywords: ['Dispone de...', 'Rango de trabajo de...', 'Incorpora...'],
    };
  }

  return null;
}

// Rule-based instant biomedical phrasing enhancements
export function localOptimizeBiomedicalSpec(
  input: string,
  equipmentName?: string,
  brand?: string,
  model?: string
): SpecOptimizationResult {
  let cleaned = input.trim();
  if (!cleaned) {
    return {
      optimized: '',
      formal: '',
      diferencial: '',
      isUniqueCandidate: false,
    };
  }

  // Capitalize first letter
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  // Common typo and unit fixes
  cleaned = cleaned
    .replace(/\b(\d+)\s*(pulgadas?|pulg|\")/gi, '$1 pulgadas')
    .replace(/\b(\d+)\s*(hrs?|horas?)\b/gi, '$1 horas')
    .replace(/\b(\d+)\s*(mins?|minutos?)\b/gi, '$1 minutos')
    .replace(/\b(\d+)\s*(kg|kilos?)\b/gi, '$1 kg')
    .replace(/\b(\d+)\s*(hz)\b/gi, '$1 Hz')
    .replace(/\b(\d+)\s*(mhz)\b/gi, '$1 MHz')
    .replace(/\b(\d+)\s*(l\/min|lpm)\b/gi, '$1 L/min')
    .replace(/\b(\d+)\s*(mmhg)\b/gi, '$1 mmHg')
    .replace(/\b(\d+)\s*(cmh2o)\b/gi, '$1 cmH2O')
    .replace(/\b(\d+)\s*(joules?|j)\b/gi, '$1 Joules')
    .replace(/\btouch\b/gi, 'táctil')
    .replace(/\bbateria\b/gi, 'batería')
    .replace(/\belectrico\b/gi, 'eléctrico')
    .replace(/\boptico\b/gi, 'óptico')
    .replace(/\bautonomia\b/gi, 'autonomía')
    .replace(/\bcon pantalla\b/gi, 'Pantalla')
    .replace(/\bcon bateria\b/gi, 'Sistema de respaldo por batería')
    .replace(/\bcon alarma\b/gi, 'Sistema de alarmas audibles y visuales');

  // Detect if text contains unique/exclusive keywords
  const uniqueKeywords = [
    'exclusiv',
    'patentad',
    'únic',
    'unic',
    'diferencial',
    'algoritmo',
    'inteligencia artificial',
    'ia',
    'ibeam',
    'iclear',
    'dsp',
    'wireless',
    'inalámbric',
    'oled',
    '4k',
    '3d/4d',
    'elastograf',
    'selectatec',
    'recambio rápido',
    'sin fuga',
    'bifásic',
    '360 j',
    'ecg 12 derivaciones',
    'touchscreen 15',
    'touch 15',
    'touch 17',
    '15.1',
    'autonomía 5 horas',
    'autonomía 4 horas',
    'autonomía 6 horas',
    'titanio',
    'fibra de carbono',
  ];

  const lower = cleaned.toLowerCase();
  const isUniqueCandidate = uniqueKeywords.some((k) => lower.includes(k));

  // Detect range inside text (e.g. 50 a 100, 10 - 270)
  const rangeMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:a|hasta|-)\s*(\d+(?:\.\d+)?)\s*([a-zA-Z°\/%"\s]+)?/i);
  let detectedWorkRange: string | undefined = rangeMatch ? `${rangeMatch[1]} a ${rangeMatch[2]} ${(rangeMatch[3] || '').trim()}`.trim() : undefined;

  // STRICT RULE: Only classify as parametric if text actually contains numerical digits
  const hasNumericValue = /\d+/.test(cleaned);
  let isParametricSpec = false;
  let paramName: string | undefined;
  let rangeVersion: string | undefined;

  if (hasNumericValue) {
    if (lower.includes('pantalla') || lower.includes('monitor') || lower.includes('display') || lower.includes('pulgad') || lower.includes('touch') || lower.includes('"')) {
      isParametricSpec = true;
      paramName = 'Tamaño de Pantalla (Pulgadas)';
      const numericMatch = cleaned.match(/(\d+(?:\.\d+)?)/);
      const val = numericMatch ? parseFloat(numericMatch[1]) : 12.1;
      
      if (rangeMatch) {
        detectedWorkRange = `${rangeMatch[1]} a ${rangeMatch[2]} pulgadas`;
      } else if (val <= 10) {
        detectedWorkRange = '7 a 10 pulgadas';
      } else if (val <= 13.5) {
        detectedWorkRange = '10 a 13 pulgadas';
      } else if (val <= 16) {
        detectedWorkRange = '14 a 17 pulgadas';
      } else {
        detectedWorkRange = `${Math.floor(val - 2)} a ${Math.ceil(val + 2)} pulgadas`;
      }
      rangeVersion = `Tamaño de pantalla médica táctil a color con visualización diagonal entre ${detectedWorkRange} de alta resolución con curvas continuas en tiempo real.`;
    } else if (lower.includes('frecuencia') || lower.includes('cardiaca') || lower.includes('cardíaca') || lower.includes('lpm') || lower.includes('pulso') || lower.includes('bpm')) {
      isParametricSpec = true;
      paramName = 'Frecuencia Cardíaca (lpm)';
      const min = rangeMatch ? rangeMatch[1] : '15';
      const max = rangeMatch ? rangeMatch[2] : '300';
      detectedWorkRange = `${min} a ${max} lpm`;
      rangeVersion = `Rango de trabajo y medición de frecuencia cardíaca continuo entre ${detectedWorkRange} con resolución de 1 lpm y límites de alarma programables.`;
    } else if (lower.includes('altura') || lower.includes('elevacion') || lower.includes('elevación') || lower.includes('recorrido') || lower.includes('posicion') || lower.includes('posiciones') || lower.includes('trendelenburg')) {
      isParametricSpec = true;
      paramName = 'Cambio de Altura / Elevación';
      const min = rangeMatch ? rangeMatch[1] : '60';
      const max = rangeMatch ? rangeMatch[2] : '95';
      detectedWorkRange = `${min} a ${max} cm`;
      rangeVersion = `Sistema electromecánico de posicionamiento con rango de cambio de altura entre ${detectedWorkRange} con accionamiento suave y capacidad de carga continua.`;
    } else if (lower.includes('dimension') || lower.includes('medida') || lower.includes('ancho') || lower.includes('largo') || lower.includes('profundidad') || lower.includes('cm') || lower.includes('mm')) {
      isParametricSpec = true;
      paramName = 'Medidas y Dimensiones Físicas';
      const min = rangeMatch ? rangeMatch[1] : '50';
      const max = rangeMatch ? rangeMatch[2] : '75';
      detectedWorkRange = `${min} a ${max} cm`;
      rangeVersion = `Dimensiones y medidas de diseño estructural en rango entre ${detectedWorkRange} optimizado para áreas hospitalarias de alto tráfico.`;
    } else if (lower.includes('presion') || lower.includes('presión') || lower.includes('nibp') || lower.includes('mmhg')) {
      isParametricSpec = true;
      paramName = 'Presión Arterial NIBP (mmHg)';
      const min = rangeMatch ? rangeMatch[1] : '10';
      const max = rangeMatch ? rangeMatch[2] : '270';
      detectedWorkRange = `${min} a ${max} mmHg`;
      rangeVersion = `Rango de medición de presión arterial no invasiva (NIBP) entre ${detectedWorkRange}, con modos manual, automático y STAT con protección por sobrepresión.`;
    } else if (lower.includes('volumen') || lower.includes('vt') || lower.includes('tidal') || lower.includes('ml')) {
      isParametricSpec = true;
      paramName = 'Volumen Corriente Vt (ml)';
      const min = rangeMatch ? rangeMatch[1] : '10';
      const max = rangeMatch ? rangeMatch[2] : '1500';
      detectedWorkRange = `${min} a ${max} ml`;
      rangeVersion = `Rango de entrega y ajuste de volumen corriente (Vt) entre ${detectedWorkRange} con compensación automática de compliancia del circuito.`;
    } else if (lower.includes('bateria') || lower.includes('batería') || lower.includes('autonomia') || lower.includes('autonomía') || lower.includes('litio')) {
      isParametricSpec = true;
      paramName = 'Autonomía de Batería (Horas)';
      const min = rangeMatch ? rangeMatch[1] : '4';
      const max = rangeMatch ? rangeMatch[2] : '6';
      detectedWorkRange = `${min} a ${max} horas`;
      rangeVersion = `Sistema de respaldo por batería de litio recargable con autonomía operativa continua en rango de ${detectedWorkRange} e indicador de estado de carga.`;
    } else if (lower.includes('joules') || lower.includes('energia') || lower.includes('energía') || lower.includes('desfibrilacion') || lower.includes('desfibrilación')) {
      isParametricSpec = true;
      paramName = 'Energía de Desfibrilación (Joules)';
      const min = rangeMatch ? rangeMatch[1] : '1';
      const max = rangeMatch ? rangeMatch[2] : '360';
      detectedWorkRange = `${min} a ${max} Joules`;
      rangeVersion = `Rango de energía de desfibrilación bifásica exponencial programable entre ${detectedWorkRange} con tiempo de carga rápido a máxima energía.`;
    } else if (lower.includes('watts') || lower.includes('potencia') || lower.includes('corte') || lower.includes('coagulacion') || lower.includes('coagulación')) {
      isParametricSpec = true;
      paramName = 'Potencia de Salida (Watts)';
      const min = rangeMatch ? rangeMatch[1] : '10';
      const max = rangeMatch ? rangeMatch[2] : '300';
      detectedWorkRange = `${min} a ${max} Watts`;
      rangeVersion = `Rango de potencia de salida entre ${detectedWorkRange} con autorregulación de impedancia tisular en tiempo real.`;
    } else if (detectedWorkRange) {
      isParametricSpec = true;
      paramName = 'Rango Operativo de Trabajo';
      rangeVersion = `Rango de trabajo y medición continuo entre ${detectedWorkRange} con alta precisión clínica y estabilidad para pliegos de condiciones.`;
    }
  }

  // Build Formal Pliego variant
  let formal = cleaned;
  if (
    !formal.startsWith('Pantalla') &&
    !formal.startsWith('Sistema') &&
    !formal.startsWith('Módulo') &&
    !formal.startsWith('Capacidad') &&
    !formal.startsWith('Rango') &&
    !formal.startsWith('Modos') &&
    !formal.startsWith('Conectividad') &&
    !formal.startsWith('Sensor') &&
    !formal.startsWith('Dispone')
  ) {
    if (lower.includes('pantalla') || lower.includes('monitor')) {
      formal = `Pantalla médica de alta resolución ${cleaned.replace(/^pantalla\s*/i, '')}`;
    } else if (lower.includes('batería') || lower.includes('autonomía')) {
      formal = `Batería recargable integrada con ${cleaned.replace(/^batería\s*/i, '')}`;
    } else if (lower.includes('alarma')) {
      formal = `Sistema integral de alarmas audibles y visuales con ${cleaned.replace(/^alarmas?\s*/i, '')}`;
    } else if (lower.includes('frecuencia') || lower.includes('presion') || lower.includes('volumen')) {
      formal = `Rango de trabajo de ${cleaned.charAt(0).toLowerCase() + cleaned.slice(1)}`;
    } else {
      formal = `Dispone de ${cleaned.charAt(0).toLowerCase() + cleaned.slice(1)}`;
    }
  }

  // Build Diferencial variant
  let diferencial = cleaned;
  if (isUniqueCandidate) {
    diferencial = `${cleaned}, con tecnología avanzada de alto rendimiento certificada para uso clínico intensivo.`;
  } else {
    diferencial = `${cleaned}, con estándar tecnológico superior optimizado para el modelo ${model || 'ofertado'}.`;
  }

  const rangeAnalysis = detectNumericalValuesInSpec(rangeVersion || cleaned);

  return {
    optimized: rangeVersion || cleaned,
    formal: formal,
    diferencial: diferencial,
    isUniqueCandidate: isUniqueCandidate,
    uniqueReason: isUniqueCandidate
      ? 'Contiene tecnología de punta, algoritmo patentado o capacidad superior destacable frente a competidores.'
      : undefined,
    detectedWorkRange: detectedWorkRange || rangeAnalysis.workRange,
    isParametricSpec: isParametricSpec || rangeAnalysis.hasNumeric,
    paramName,
    rangeVersion: rangeVersion || rangeAnalysis.variants?.between,
    rangeVariants: rangeAnalysis.variants,
  };
}

// Full async optimization requesting server Gemini API with fallback
export async function optimizeTechnicalSpecification(
  specText: string,
  equipmentName?: string,
  brand?: string,
  model?: string
): Promise<SpecOptimizationResult> {
  const localFallback = localOptimizeBiomedicalSpec(specText, equipmentName, brand, model);

  try {
    const response = await fetch('/api/gemini/optimize-spec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specText,
        equipmentName,
        brand,
        model,
      }),
    });

    if (!response.ok) {
      return localFallback;
    }

    const data = await response.json();
    if (data && data.data && data.data.optimized) {
      const serverOptimized = data.data.optimized;
      const serverRangeVersion = data.data.rangeVersion;
      const detectedAnalysis = detectNumericalValuesInSpec(serverRangeVersion || serverOptimized || specText);
      const variants = data.data.rangeVariants || detectedAnalysis.variants || localFallback.rangeVariants;

      return {
        optimized: serverRangeVersion || serverOptimized,
        formal: data.data.formal || localFallback.formal,
        diferencial: data.data.diferencial || localFallback.diferencial,
        isUniqueCandidate: data.data.isUniqueCandidate ?? localFallback.isUniqueCandidate,
        uniqueReason: data.data.uniqueReason || localFallback.uniqueReason,
        detectedWorkRange: data.data.detectedWorkRange || detectedAnalysis.workRange || localFallback.detectedWorkRange,
        isParametricSpec: data.data.isParametricSpec ?? detectedAnalysis.hasNumeric ?? localFallback.isParametricSpec,
        paramName: data.data.paramName || localFallback.paramName,
        rangeVersion: serverRangeVersion || variants?.between || localFallback.rangeVersion,
        rangeVariants: variants,
      };
    }

    return localFallback;
  } catch (err) {
    console.warn('Using local fallback for spec optimization:', err);
    return localFallback;
  }
}

// Quick pre-built biomedical technical requirements bank by category
export const BIOMEDICAL_SPEC_SUGGESTIONS: Record<string, string[]> = {
  'Monitoreo y Rangos Fisiológicos': [
    'Rango de medición y trabajo de frecuencia cardíaca de 15 a 300 lpm con resolución de 1 lpm y alarmas programables.',
    'Rango de presión arterial no invasiva (NIBP) de 10 a 270 mmHg con modos manual, automático y continuo STAT.',
    'Rango de saturación de oxígeno (SpO2) de 0 a 100% con tecnología anti-movimiento e indicación de índice de perfusión (PI).',
    'Rango de temperatura corporal continua dual (T1, T2) de 0.0 a 50.0 °C con cálculo automático de gradiente térmico Delta T.',
    'Pantalla táctil TFT/LED a color no inferior a 12.1 pulgadas con visualización simultánea de hasta 8 curvas fisiológicas.',
    'Batería recargable de iones de litio integrada con autonomía continua comprobable no menor a 4 horas.',
    'Algoritmo patentado de análisis de arritmias multiderivación y detección automática de segmento ST y marcapasos.',
  ],
  'Quirófano, Anestesia y Rangos Ventilatorios': [
    'Rango de volumen corriente (Vt) ajustable de 10 a 1500 ml para pacientes neonatales, pediátricos y adultos.',
    'Rango de ajuste de PEEP electrónica de 0 a 35 cmH2O con compensación continua de fugas y compliancia del circuito.',
    'Rango de flujo de gases medicinales de 0.1 a 15.0 L/min con mezclador digital y flujómetros virtuales.',
    'Pantalla táctil a color de 15 pulgadas con visualización de bucles de mecánica pulmonar (Presión-Volumen y Flujo-Volumen).',
    'Modos de ventilación integrados: VCV, PCV, PCV-VG, PSV con apnea backup, SIMV-VC, SIMV-PC y soporte manual/espontáneo.',
    'Mezclador digital electrónico de gases con flujómetros virtuales y compensación automática de distensibilidad del circuito.',
    'Canister de cal sodada con sistema de bypass que permite el reemplazo en caliente durante la cirugía sin fuga de gas fresco.',
  ],
  'Cirugía y Rangos de Potencia': [
    'Rango de potencia de corte puro monopolar de 10 a 300 Watts y coagulación de 120 Watts a alta frecuencia.',
    'Rango de coagulación bipolar de precisión de 5 a 120 Watts con activación automática por pinza (Auto-Start / Auto-Stop).',
    'Sistema inteligente de monitoreo continuo de placa de retorno del paciente (CQM/REM) con corte automático ante desprendimiento.',
    'Tecnología de detección dinámica de impedancia tisular con autoajuste de potencia en tiempo real (10.000 mediciones por segundo).',
  ],
  'Desfibrilación y Rangos de Energía': [
    'Rango de energía de desfibrilación bifásica programable de 1 a 360 Joules con tiempo de carga a máxima energía inferior a 5 segundos.',
    'Marcapasos no invasivo transcutáneo con rango de frecuencia de 40 a 180 ppm y corriente de salida de 0 a 200 mA.',
    'Modo DEA semiautomático con indicaciones por voz y texto en idioma español conforme a guías AHA/ERC.',
  ],
  'Generales y Normativos': [
    'Alimentación eléctrica a 110-120 VAC / 60 Hz con protección de tierra grado hospitalario conforme a norma IEC 60601-1.',
    'Registro Sanitario INVIMA vigente para comercialización e importación en el territorio colombiano.',
    'Garantía total de fábrica no inferior a 24 meses con soporte técnico especializado y disponibilidad de repuestos por 7 años.',
    'Manuales originales de operación y servicio técnico en idioma español conforme a normatividad vigente.',
  ],
};

export interface RangeVariants {
  between?: string;
  min?: string;
  max?: string;
  fixed?: string;
}

export interface GeneratedEquipmentSpec {
  requirement: string;
  isUnique?: boolean;
  hasWorkRange?: boolean;
  workRange?: string;
  rangeVariants?: RangeVariants;
}

export interface CompleteEquipmentAIData {
  specs: GeneratedEquipmentSpec[];
  optionalAccessories: string[];
}

// Helper to detect if a specification string contains numerical/measurable parameters
export function detectNumericalValuesInSpec(text: string): {
  hasNumeric: boolean;
  minVal?: string;
  maxVal?: string;
  unit?: string;
  workRange?: string;
  variants?: RangeVariants;
} {
  if (!text || text.trim().length === 0) {
    return { hasNumeric: false };
  }

  const raw = text.trim();
  const lower = raw.toLowerCase();

  // Known non-range technical standards, protocols, safety classes, and discrete feature counts to ignore
  const isPureTechnicalProtocolOrCount =
    /\b(hl7|dicom|iec\s*60601|iso\s*13485|iso\s*9001|ipx[0-9]?|ip[0-9]{2}|usb|rs-?232|rj-?45|vga|hdmi|dvi|wi-?fi|bluetooth|invima|segmento\s*st|st\s*en\s*tiempo\s*real)\b/i.test(lower) &&
    !/\b(pulgadas?|pulg|\"|horas?|hrs?|watts?|joules?|ml|l\/min|mmhg|cmh2o|°c|%|lpm|bpm|rpm)\b/i.test(lower);

  if (isPureTechnicalProtocolOrCount) {
    return { hasNumeric: false };
  }

  // Check for false positive counts like "20 tipos de eventos", "24 tipos de arritmias", "8 curvas simultáneas", "12 derivaciones"
  const isDiscreteCountWithoutRange =
    /\b(\d+)\s*(tipos?\s*de\s*(?:eventos?|arritmias?)|curvas?\s*simult[aá]neas?|derivada[s]?|derivacion(?:es)?)\b/i.test(lower) &&
    !/\b(entre\s+\d+|rango|pulgadas?|pulg|\"|horas?|hrs?|watts?|joules?|ml|l\/min|mmhg|cmh2o|°c|lpm|bpm)\b/i.test(lower);

  if (isDiscreteCountWithoutRange) {
    return { hasNumeric: false };
  }

  // 1. Look for explicit range pattern: "entre X a Y [unit]" or "de X a Y [unit]" or "rango de X a Y [unit]"
  const rangePattern = /(?:rango(?:\s*de\s*(?:trabajo|medici[óo]n))?\s*(?:de|entre)?|entre)\s*(\d+(?:\.\d+)?)\s*(?:a|hasta|-|–)\s*(\d+(?:\.\d+)?)\s*([a-zA-Z°\/%]+)?/i;
  const rangeMatch = raw.match(rangePattern);

  if (rangeMatch) {
    const min = rangeMatch[1];
    const max = rangeMatch[2];
    let unit = (rangeMatch[3] || '').trim();

    if (!unit) {
      if (/lpm|bpm|latidos/i.test(lower)) unit = 'lpm';
      else if (/mmhg/i.test(lower)) unit = 'mmHg';
      else if (/cmh2o/i.test(lower)) unit = 'cmH2O';
      else if (/ml|cc/i.test(lower)) unit = 'ml';
      else if (/l\/min/i.test(lower)) unit = 'L/min';
      else if (/joules|j\b/i.test(lower)) unit = 'Joules';
      else if (/watts|w\b/i.test(lower)) unit = 'Watts';
      else if (/°c|grados/i.test(lower)) unit = '°C';
      else if (/horas|hrs/i.test(lower)) unit = 'horas';
      else if (/pulgadas?|pulg|\"/i.test(lower)) unit = 'pulgadas';
      else if (/%/i.test(lower)) unit = '%';
    }

    const minNum = parseFloat(min);
    const maxNum = parseFloat(max);
    let effectiveMin = min;
    let effectiveMax = max;

    // Detect and expand narrow/restrictive ranges into realistic wide ranges for tenders
    const isScreen = /pulg|pantalla|diagonal|display/i.test(lower) || /pulg/i.test(unit);
    if (isScreen) {
      if (maxNum <= 10.5) {
        effectiveMin = '7';
        effectiveMax = maxNum >= 10 ? '10.4' : '10';
      } else if (maxNum <= 13.5) {
        effectiveMin = '10';
        effectiveMax = '12.1';
      } else if (maxNum <= 16.5) {
        effectiveMin = '12';
        effectiveMax = '15';
      } else {
        effectiveMin = String(Math.max(10, Math.floor(minNum - 2)));
        effectiveMax = String(Math.ceil(maxNum + 2));
      }
      if (!unit) unit = 'pulgadas';
    } else if (minNum > 0 && maxNum > minNum && (maxNum - minNum) <= 1.5 && (maxNum - minNum) / maxNum < 0.2) {
      // General narrow micro-range expansion (e.g. 3.8 to 4 -> 2 to 5)
      effectiveMin = String(Math.max(0, Math.floor(minNum * 0.7)));
      effectiveMax = String(Math.ceil(maxNum * 1.25));
    }

    const workRange = `${effectiveMin} a ${effectiveMax} ${unit}`.trim();
    const between = raw
      .replace(rangePattern, `entre ${effectiveMin} a ${effectiveMax} ${unit}`.trim())
      .replace(/^([a-z])/i, (m) => m.toUpperCase());
    const minVariant = raw
      .replace(rangePattern, `mínimo ${effectiveMin} ${unit} hasta ${effectiveMax} ${unit}`.trim())
      .replace(/^([a-z])/i, (m) => m.toUpperCase());
    const maxVariant = raw
      .replace(rangePattern, `máximo hasta ${effectiveMax} ${unit}`.trim())
      .replace(/^([a-z])/i, (m) => m.toUpperCase());
    const fixedVariant = raw
      .replace(rangePattern, `de ${max} ${unit}`.trim())
      .replace(/rango de trabajo y medición continuo\s*/gi, '')
      .replace(/rango de trabajo continuo\s*/gi, '')
      .replace(/rango de trabajo\s*/gi, '')
      .replace(/rango de medición\s*/gi, '')
      .replace(/^([a-z])/i, (m) => m.toUpperCase());

    return {
      hasNumeric: true,
      minVal: effectiveMin,
      maxVal: effectiveMax,
      unit,
      workRange,
      variants: {
        between,
        min: minVariant,
        max: maxVariant,
        fixed: fixedVariant,
      },
    };
  }

  // 2. Look for single numeric WITH recognized physical unit e.g. "12.1 pulgadas", "4 horas", "300 Watts", "360 Joules"
  const singlePattern = /(\d+(?:\.\d+)?)\s*(pulgadas?|pulg|\"|horas?|hrs?|watts?|\bw\b|joules?|\bj\b|ml|cc|l\/min|mmhg|cmh2o|°c|%|kg|lpm|bpm|rpm)\b/i;
  const singleMatch = raw.match(singlePattern);

  if (singleMatch) {
    const val = singleMatch[1];
    const numVal = parseFloat(val);
    const unit = singleMatch[2];
    const workRange = `${val} ${unit}`;

    // Smart calculated wide between range for single values (e.g. 12.1" -> entre 10 a 12.1 pulgadas)
    let betweenRangeText = '';
    const uLower = unit.toLowerCase();
    if (uLower.includes('pulg') || uLower.includes('"')) {
      if (numVal <= 10.5) betweenRangeText = 'entre 7 a 10.4 pulgadas';
      else if (numVal <= 13.5) betweenRangeText = 'entre 10 a 12.1 pulgadas';
      else if (numVal <= 16.5) betweenRangeText = 'entre 12 a 15 pulgadas';
      else betweenRangeText = `entre ${Math.floor(numVal - 2)} a ${Math.ceil(numVal + 2)} pulgadas`;
    } else if (uLower.includes('hora') || uLower.includes('hr')) {
      betweenRangeText = `entre 2 a ${Math.max(4, Math.ceil(numVal + 1))} horas`;
    } else if (uLower.includes('watt') || uLower === 'w') {
      betweenRangeText = `entre 10 a ${numVal} Watts`;
    } else if (uLower.includes('joule') || uLower === 'j') {
      betweenRangeText = `entre 1 a ${numVal} Joules`;
    } else if (uLower.includes('lpm') || uLower.includes('bpm')) {
      betweenRangeText = `entre 15 a ${numVal} lpm`;
    } else if (uLower.includes('mmhg')) {
      betweenRangeText = `entre 10 a ${numVal} mmHg`;
    } else if (uLower.includes('%')) {
      betweenRangeText = 'entre 0 a 100%';
    } else {
      const lowerBound = Math.max(0, Math.floor(numVal * 0.75));
      const upperBound = Math.ceil(numVal * 1.25);
      betweenRangeText = `entre ${lowerBound} a ${upperBound} ${unit}`;
    }

    const betweenVariant = raw
      .replace(singlePattern, betweenRangeText)
      .replace(/^([a-z])/i, (m) => m.toUpperCase());

    const minVariant = raw
      .replace(singlePattern, `mínimo ${val} ${unit}`)
      .replace(/^([a-z])/i, (m) => m.toUpperCase());

    const maxVariant = raw
      .replace(singlePattern, `máximo hasta ${val} ${unit}`)
      .replace(/^([a-z])/i, (m) => m.toUpperCase());

    const fixedVariant = raw
      .replace(/rango de trabajo y medición continuo\s*/gi, '')
      .replace(/rango de trabajo continuo\s*/gi, '')
      .replace(/rango de trabajo\s*/gi, '')
      .replace(/rango de medición\s*/gi, '')
      .replace(/entre\s+\d+(?:\.\d+)?\s*(?:a|hasta|-)\s*\d+(?:\.\d+)?\s*/gi, `de ${val} `)
      .replace(/^([a-z])/i, (m) => m.toUpperCase());

    return {
      hasNumeric: true,
      minVal: val,
      unit,
      workRange,
      variants: {
        between: betweenVariant,
        min: minVariant,
        max: maxVariant,
        fixed: fixedVariant,
      },
    };
  }

  // If no physical unit or explicit range pattern is found, it is qualitative (no range)
  return { hasNumeric: false };
}

// Convert a specification string to a specific range style ('between' | 'min' | 'max' | 'fixed')
export function convertSpecToRangeVariant(
  specText: string,
  targetStyle: 'between' | 'min' | 'max' | 'fixed'
): string {
  const analysis = detectNumericalValuesInSpec(specText);
  if (!analysis.hasNumeric) {
    return specText; // Keep non-numeric specs untouched
  }

  if (analysis.variants && analysis.variants[targetStyle]) {
    return analysis.variants[targetStyle]!;
  }

  // Fallback programmatic transformation
  const raw = specText.trim();
  const rangePattern = /(?:rango de trabajo y medición continuo|rango de trabajo continuo|rango de trabajo|rango de medición|rango|capacidad)?\s*(?:entre|de|mínimo|máximo hasta)?\s*(\d+(?:\.\d+)?)\s*(?:a|hasta|-|–|y)\s*(\d+(?:\.\d+)?)\s*([a-zA-Z°\/%]+)?/i;
  const match = raw.match(rangePattern);

  if (match) {
    const min = match[1];
    const max = match[2];
    const unit = (match[3] || analysis.unit || '').trim();

    if (targetStyle === 'between') {
      return raw.replace(rangePattern, `entre ${min} a ${max} ${unit}`.trim()).replace(/^([a-z])/i, (m) => m.toUpperCase());
    } else if (targetStyle === 'min') {
      return raw.replace(rangePattern, `mínimo ${min} ${unit} hasta ${max} ${unit}`.trim()).replace(/^([a-z])/i, (m) => m.toUpperCase());
    } else if (targetStyle === 'max') {
      return raw.replace(rangePattern, `máximo hasta ${max} ${unit}`.trim()).replace(/^([a-z])/i, (m) => m.toUpperCase());
    } else if (targetStyle === 'fixed') {
      return raw
        .replace(rangePattern, `de ${max} ${unit}`.trim())
        .replace(/rango de trabajo y medición continuo\s*/gi, '')
        .replace(/rango de trabajo continuo\s*/gi, '')
        .replace(/rango de trabajo\s*/gi, '')
        .replace(/rango de medición\s*/gi, '')
        .replace(/^([a-z])/i, (m) => m.toUpperCase());
    }
  }

  return specText;
}

// Specific optional add-on accessories (not always included) by equipment category
export const DEFAULT_OPTIONAL_ACCESSORIES: string[] = [
  'Carrito de transporte rodable con frenos y bandeja porta-accesorios',
  'Brazo o soporte de pared con giro articulado de 180°',
  'Módulo adicional de Capnografía (EtCO2 microstream)',
  'Módulo adicional de Presión Invasiva (IBP) doble canal',
  'Módulo adicional de Gasto Cardíaco continuo',
  'Impresora / Registrador térmico incorporado de 3 canales',
  'Batería adicional de Iones de Litio de larga duración',
  'Transductor / Sonda adicional de repuesto',
  'Kit de calibración y verificación metrológica inicial',
  'Software de estación de trabajo / visualizador DICOM',
];

export function getOptionalAccessoriesSuggestions(equipmentName: string): string[] {
  const lower = (equipmentName || '').toLowerCase();

  if (lower.includes('monitor') || lower.includes('signos') || lower.includes('vitales')) {
    return [
      'Carrito de transporte rodable con frenos y canastilla',
      'Brazo o soporte de pared con giro articulado',
      'Módulo adicional de Capnografía (EtCO2 microstream / mainstream)',
      'Módulo adicional de Presión Invasiva (IBP) de 2 canales',
      'Módulo adicional de Gasto Cardíaco continuo',
      'Impresora térmica de 3 canales incorporada',
      'Batería adicional de Iones de Litio de respaldo',
    ];
  }

  if (lower.includes('electrocardio') || lower.includes('ecg') || lower.includes('ekg')) {
    return [
      'Carrito rodable hospitalario con brazo articulado guía de cable',
      'Bandeja porta-electrodos y gaveta para papel térmico',
      'Cable de paciente adicional de 10 puntas de repuesto',
      'Software de gestión de ECG y conectividad DICOM / HL7',
      'Kit de 20 rollos de papel térmico de alta densidad',
    ];
  }

  if (lower.includes('desfibrilador') || lower.includes('dea') || lower.includes('cardiovers')) {
    return [
      'Soporte o base de fijación para ambulancia / muro hospitalario',
      'Módulo de marcapasos no invasivo transcutáneo',
      'Módulo de oximetría de pulso SpO2 y NIBP integrado',
      'Juego de parches adhesivos para desfibrilación manos libres',
      'Batería adicional recargable de alta capacidad',
      'Bolso de transporte de alta resistencia a intemperie',
    ];
  }

  if (lower.includes('ventilador') || lower.includes('anestesia') || lower.includes('respirador')) {
    return [
      'Brazo articulado soporte de mangueras y circuito paciente',
      'Módulo de capnografía volumétrica y mecánica pulmonar avanzada',
      'Módulo de gases anestésicos multigas (EtCO2, N2O, Agentes, BIS)',
      'Compresor de aire medicinal de grado hospitalario de respaldo',
      'Pulmón de prueba de precisión para calibración',
      'Circuito paciente reusable de silicona autoclavable',
    ];
  }

  if (lower.includes('ecograf') || lower.includes('ultrasonido') || lower.includes('ultrasound')) {
    return [
      'Transductor / Sonda convexa de alta frecuencia adicional',
      'Transductor / Sonda lineal vascular adicional',
      'Transductor endocavitario / ginecológico',
      'Videoprinter térmica médica a color / blanco y negro',
      'Carrito rodable con puertos activos para 3 transductores',
      'Paquete de software para Doppler pulsado, continuo y elastografía',
    ];
  }

  if (lower.includes('electrobisturi') || lower.includes('cauterio') || lower.includes('quirurg')) {
    return [
      'Carrito de transporte rodable con soporte para pedal y cables',
      'Pedal inalámbrico o de doble función (corte/coagulación)',
      'Evacuador de humo quirúrgico con filtro ULPA',
      'Pinzas bipolares de titanio antiadherentes con cable reusable',
      'Electrodo neutro reusable de silicona para paciente',
    ];
  }

  if (lower.includes('bomba') || lower.includes('infusion') || lower.includes('perfusor')) {
    return [
      'Soporte o abrazadera para atril de suero hospitalario',
      'Estación de acople en cascada / rack modular de infusión',
      'Sensor de gotas de alta precisión externo',
      'Cable de comunicación y llamada a enfermería',
      'Batería adicional de respaldo',
    ];
  }

  return DEFAULT_OPTIONAL_ACCESSORIES;
}

// Generate tailored generic specifications with ranges based on equipment name
export function getGenericSpecificationsForEquipment(
  equipmentName: string,
  brand?: string,
  model?: string
): GeneratedEquipmentSpec[] {
  const lower = equipmentName.toLowerCase();

  // 1. Monitores de Signos Vitales
  if (lower.includes('monitor') || lower.includes('signos') || lower.includes('vitales') || lower.includes('multiparametrico') || lower.includes('multiparamétrico')) {
    return [
      {
        requirement: 'Pantalla médica táctil LED a color de alta definición con tamaño diagonal entre 10 a 12.1 pulgadas con visualización de hasta 8 curvas simultáneas.',
        hasWorkRange: true,
        workRange: '10 a 12.1 pulgadas',
        isUnique: false,
      },
      {
        requirement: 'Rango de medición y trabajo de frecuencia cardíaca continuo de 15 a 300 lpm con resolución de 1 lpm y alarmas programables de bradicardia/taquicardia.',
        hasWorkRange: true,
        workRange: '15 a 300 lpm',
        isUnique: false,
      },
      {
        requirement: 'Rango de presión arterial no invasiva (NIBP) de 10 a 270 mmHg con modos manual, automático y STAT con protección por sobrepresión.',
        hasWorkRange: true,
        workRange: '10 a 270 mmHg',
        isUnique: false,
      },
      {
        requirement: 'Rango de saturación de oxígeno (SpO2) de 0 a 100% con tecnología anti-movimiento e indicación de índice de perfusión (PI).',
        hasWorkRange: true,
        workRange: '0 a 100%',
        isUnique: false,
      },
      {
        requirement: 'Rango de temperatura corporal continua dual (T1, T2) de 0.0 a 50.0 °C con cálculo automático de gradiente térmico Delta T.',
        hasWorkRange: true,
        workRange: '0.0 a 50.0 °C',
        isUnique: false,
      },
      {
        requirement: 'Batería recargable de iones de litio integrada con autonomía continua entre 2 a 5 horas e indicador visual en pantalla.',
        hasWorkRange: true,
        workRange: '2 a 5 horas',
        isUnique: false,
      },
      {
        requirement: 'Algoritmo patentado multiderivación de análisis en tiempo real de 24 tipos de arritmias, análisis ST y detección de marcapasos.',
        isUnique: true,
      },
      {
        requirement: 'Conectividad de red Wi-Fi y cableada compatible con protocolo HL7 para integración a central de monitoreo e historia clínica electrónica.',
        isUnique: false,
      },
    ];
  }

  // 2. Máquinas de Anestesia y Ventiladores
  if (lower.includes('anestesia') || lower.includes('ventilador') || lower.includes('respirador') || lower.includes('ventilacion') || lower.includes('ventilación')) {
    return [
      {
        requirement: 'Pantalla táctil a color de 15 pulgadas con visualización de bucles de mecánica pulmonar en tiempo real (Presión-Volumen y Flujo-Volumen).',
        isUnique: false,
      },
      {
        requirement: 'Rango de volumen corriente (Vt) ajustable de 10 a 1500 ml para pacientes neonatales, pediátricos y adultos con compensación de distensibilidad.',
        hasWorkRange: true,
        workRange: '10 a 1500 ml',
        isUnique: false,
      },
      {
        requirement: 'Rango de ajuste de PEEP electrónica integrada de 0 a 35 cmH2O con estabilidad continua de presión alveolar.',
        hasWorkRange: true,
        workRange: '0 a 35 cmH2O',
        isUnique: false,
      },
      {
        requirement: 'Rango de suministro de flujo de gases medicinales de 0.1 a 15.0 L/min con mezclador digital y flujómetros virtuales.',
        hasWorkRange: true,
        workRange: '0.1 a 15.0 L/min',
        isUnique: false,
      },
      {
        requirement: 'Modos de ventilación integrados: VCV, PCV, PCV-VG, PSV con apnea backup, SIMV-VC, SIMV-PC y ventilación manual/espontánea.',
        isUnique: false,
      },
      {
        requirement: 'Mezclador digital electrónico de gases con flujómetros virtuales y compensación automática de distensibilidad del circuito sin fugas.',
        isUnique: true,
      },
      {
        requirement: 'Canister de cal sodada con sistema de bypass que permite el reemplazo en caliente durante la cirugía sin interrupción de gas fresco.',
        isUnique: false,
      },
    ];
  }

  // 3. Desfibriladores
  if (lower.includes('desfibrilador') || lower.includes('cardioversor') || lower.includes('dea') || lower.includes('bifasico') || lower.includes('bifásico')) {
    return [
      {
        requirement: 'Rango de energía de desfibrilación bifásica exponencial truncada programable de 1 a 360 Joules con tiempo de carga a máxima energía inferior a 5 segundos.',
        hasWorkRange: true,
        workRange: '1 a 360 Joules',
        isUnique: false,
      },
      {
        requirement: 'Rango de frecuencia cardíaca de 15 a 300 lpm con marcapasos transcutáneo no invasivo de 40 a 180 ppm y corriente de 0 a 200 mA.',
        hasWorkRange: true,
        workRange: '15 a 300 lpm',
        isUnique: false,
      },
      {
        requirement: 'Pantalla médica a color no inferior a 8.4 pulgadas con visualización de 3 a 4 curvas y guía visual de RCP en tiempo real.',
        isUnique: false,
      },
      {
        requirement: 'Algoritmo de retroalimentación de RCP en tiempo real con sensor de profundidad y frecuencia de compresiones.',
        isUnique: true,
      },
      {
        requirement: 'Batería recargable con capacidad para al menos 200 descargas a máxima energía (360J) o 5 horas continuas de monitoreo.',
        hasWorkRange: true,
        workRange: '200 descargas / 5h',
        isUnique: false,
      },
    ];
  }

  // 4. Unidades Electroquirúrgicas / Electrobisturí
  if (lower.includes('electrobisturi') || lower.includes('electrobisturí') || lower.includes('electroquirurg') || lower.includes('cauterio')) {
    return [
      {
        requirement: 'Rango de potencia de corte monopolar puro de 10 a 300 Watts a alta frecuencia con modulación Blend 1, 2 y 3.',
        hasWorkRange: true,
        workRange: '10 a 300 Watts',
        isUnique: false,
      },
      {
        requirement: 'Rango de potencia de coagulación bipolar de 5 a 120 Watts con activación automática Auto-Start y Auto-Stop por impedancia.',
        hasWorkRange: true,
        workRange: '5 a 120 Watts',
        isUnique: false,
      },
      {
        requirement: 'Sistema de monitoreo dinámico y continuo de placa neutra del paciente (CQM/REM) con bloqueo instantáneo por desprendimiento.',
        isUnique: false,
      },
      {
        requirement: 'Tecnología de detección dinámica de impedancia tisular con autoajuste de potencia a razón de 10.000 muestras por segundo para evitar carbonización.',
        isUnique: true,
      },
    ];
  }

  // 5. Bombas de Infusión y Perfusores
  if (lower.includes('bomba') || lower.includes('infusion') || lower.includes('infusión') || lower.includes('perfusor') || lower.includes('jeringa')) {
    return [
      {
        requirement: 'Rango de tasa de infusión ajustable de 0.1 a 1200.0 ml/h con incrementos de 0.01 ml/h en modo microinfusión y precisión superior a ±5%.',
        hasWorkRange: true,
        workRange: '0.1 a 1200 ml/h',
        isUnique: false,
      },
      {
        requirement: 'Rango de volumen límite a infundir (VTBI) de 0.1 a 9999.9 ml con función de purga y bolo manual/programado.',
        hasWorkRange: true,
        workRange: '0.1 a 9999.9 ml',
        isUnique: false,
      },
      {
        requirement: 'Sistema integral de detección de burbujas de aire por ultrasonido y sensor de oclusión dinámica aguas arriba y aguas abajo.',
        isUnique: false,
      },
      {
        requirement: 'Biblioteca de fármacos con límites de dosis estrictos (Dose Error Reduction System - DERS) y capacidad de almacenamiento para más de 1000 fármacos.',
        isUnique: true,
      },
    ];
  }

  // Default Generic for any other medical equipment
  return [
    {
      requirement: `Dispone de estructura y chasis de grado hospitalario con protección de ingreso IPX y materiales resistentes a desinfectantes clínicos hospitalarios.`,
      isUnique: false,
    },
    {
      requirement: `Pantalla médica digital de alta resolución para visualización de parámetros operativos y alarmas en tiempo real.`,
      isUnique: false,
    },
    {
      requirement: `Sistema de respaldo por batería recargable integrada con autonomía operativa continua no menor a 4 horas.`,
      hasWorkRange: true,
      workRange: '≥4 horas',
      isUnique: false,
    },
    {
      requirement: `Tecnología de alta precisión calibrada en fábrica con arquitectura modular y autodiagnóstico continuo al encendido.`,
      isUnique: true,
    },
    {
      requirement: `Alimentación eléctrica hospitalaria de 110-120 VAC / 60 Hz con polo a tierra conforme a norma IEC 60601-1.`,
      isUnique: false,
    },
    {
      requirement: `Registro Sanitario INVIMA vigente para comercialización e importación en el territorio colombiano con garantía total de fábrica de 24 meses.`,
      isUnique: false,
    },
  ];
}

// Full async generation using Gemini API with generic fallback
export async function generateCompleteEquipmentSpecificationsWithAI(
  equipmentName: string,
  brand?: string,
  model?: string,
  options?: {
    categoryFocus?: 'all' | 'ranges' | 'shielding' | 'connectivity' | 'accessories' | 'custom';
    customPrompt?: string;
    count?: number;
  }
): Promise<CompleteEquipmentAIData> {
  const genericFallback = getGenericSpecificationsForEquipment(equipmentName, brand, model);
  const accessoriesFallback = getOptionalAccessoriesSuggestions(equipmentName);

  try {
    const response = await fetch('/api/gemini/generate-equipment-specs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        equipmentName,
        brand,
        model,
        categoryFocus: options?.categoryFocus,
        customPrompt: options?.customPrompt,
        count: options?.count,
      }),
    });

    if (!response.ok) {
      return {
        specs: genericFallback.map((s) => ({
          ...s,
          requirement: s.requirement.replace(/^[⭐★*]\s*/, '').replace(/[⭐★]/g, ''),
        })),
        optionalAccessories: accessoriesFallback,
      };
    }

    const data = await response.json();
    if (data && data.data && Array.isArray(data.data.specs) && data.data.specs.length > 0) {
      const cleanSpecs = data.data.specs.map((s: GeneratedEquipmentSpec) => ({
        ...s,
        requirement: (s.requirement || '').replace(/^[⭐★*]\s*/, '').replace(/[⭐★]/g, ''),
      }));

      return {
        specs: cleanSpecs,
        optionalAccessories: Array.isArray(data.data.optionalAccessories) && data.data.optionalAccessories.length > 0
          ? data.data.optionalAccessories
          : accessoriesFallback,
      };
    }

    return {
      specs: genericFallback.map((s) => ({
        ...s,
        requirement: s.requirement.replace(/^[⭐★*]\s*/, '').replace(/[⭐★]/g, ''),
      })),
      optionalAccessories: accessoriesFallback,
    };
  } catch (err) {
    console.warn('Using local generic fallback for equipment specs:', err);
    return {
      specs: genericFallback.map((s) => ({
        ...s,
        requirement: s.requirement.replace(/^[⭐★*]\s*/, '').replace(/[⭐★]/g, ''),
      })),
      optionalAccessories: accessoriesFallback,
    };
  }
}

// Function to dynamically compute unique, non-repeated suggestions that are NOT already placed in the active specifications
export function getAvailableSuggestionsForSpec(
  currentSpecs: { requirement: string }[],
  equipmentName?: string,
  brand?: string,
  model?: string,
  customPool?: { requirement: string; workRange?: string; rangeVariants?: RangeVariants }[]
): { requirement: string; workRange?: string; hasWorkRange?: boolean; rangeVariants?: RangeVariants }[] {
  const candidateTexts: { requirement: string; workRange?: string; rangeVariants?: RangeVariants }[] = [];

  // 1. Add from customPool (generated AI specs or pool)
  if (customPool && customPool.length > 0) {
    customPool.forEach((item) => {
      if (item.requirement && item.requirement.trim()) {
        candidateTexts.push({
          requirement: item.requirement.trim(),
          workRange: item.workRange,
          rangeVariants: item.rangeVariants,
        });
      }
    });
  }

  // 2. Add from equipment generic generator
  if (equipmentName && equipmentName.trim()) {
    const genericList = getGenericSpecificationsForEquipment(equipmentName, brand, model);
    genericList.forEach((g) => {
      candidateTexts.push({
        requirement: g.requirement.trim(),
        workRange: g.workRange,
        rangeVariants: g.rangeVariants,
      });
    });
  }

  // 3. Add from standard biomedical presets
  STANDARD_BIOMEDICAL_WORK_RANGES.forEach((preset) => {
    candidateTexts.push({
      requirement: preset.exampleSpec,
      workRange: `${preset.defaultMin} a ${preset.defaultMax} ${preset.unit}`,
    });
  });

  // 4. Add from BIOMEDICAL_SPEC_SUGGESTIONS
  Object.values(BIOMEDICAL_SPEC_SUGGESTIONS).forEach((catSpecs) => {
    catSpecs.forEach((sText) => {
      candidateTexts.push({
        requirement: sText.replace(/^⭐\s*/, '').trim(),
      });
    });
  });

  // Function to normalize string for comparison
  const normalizeForComparison = (str: string) => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Get list of existing normalized texts
  const existingNormalized = (currentSpecs || [])
    .map((s) => normalizeForComparison(s.requirement || ''))
    .filter((s) => s.length > 0);

  // Filter out candidates that already exist or are too similar to existing specs
  const filteredCandidates: { requirement: string; workRange?: string; hasWorkRange?: boolean; rangeVariants?: RangeVariants }[] = [];
  const seenCandidateKeys = new Set<string>();

  for (const cand of candidateTexts) {
    const cleanCandText = cand.requirement.trim();
    const norm = normalizeForComparison(cleanCandText);
    if (!norm || norm.length < 8) continue;

    // Deduplicate internally within candidate list using the first 45 chars
    const shortKey = norm.substring(0, 45);
    if (seenCandidateKeys.has(shortKey)) continue;

    // Check if it is already present in current specs
    const isAlreadyInSpecs = existingNormalized.some((existing) => {
      if (existing === norm) return true;
      if (existing.includes(norm) || norm.includes(existing)) {
        const minLen = Math.min(existing.length, norm.length);
        if (minLen > 15) return true;
      }
      // Check biomedical key phrases overlap
      const keyPhrases = [
        'frecuencia cardiaca',
        'presion arterial',
        'saturacion de oxigeno',
        'spo2',
        'temperatura corporal',
        'tamano de pantalla',
        'pantalla tactil',
        'volumen corriente',
        'peep',
        'flujo de gases',
        'bateria recargable',
        'corte puro',
        'coagulacion bipolar',
        'energia de desfibrilacion',
        'marcapasos',
        'registro sanitario invima',
        'garantia',
        'alimentacion electrica',
        'compatibilidad hl7',
      ];
      for (const phrase of keyPhrases) {
        if (norm.includes(phrase) && existing.includes(phrase)) {
          return true;
        }
      }
      return false;
    });

    if (!isAlreadyInSpecs) {
      seenCandidateKeys.add(shortKey);
      const numAnalysis = detectNumericalValuesInSpec(cleanCandText);
      filteredCandidates.push({
        requirement: cleanCandText,
        hasWorkRange: Boolean(cand.workRange || numAnalysis.hasNumeric),
        workRange: cand.workRange || numAnalysis.workRange,
        rangeVariants: cand.rangeVariants || numAnalysis.variants,
      });
    }
  }

  return filteredCandidates.slice(0, 15);
}


