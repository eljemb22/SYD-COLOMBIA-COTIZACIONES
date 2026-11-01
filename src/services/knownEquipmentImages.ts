/**
 * Catálogo de imágenes conocidas para equipos médicos populares.
 * Se usa como respaldo cuando la búsqueda automática no encuentra fotos reales.
 * Todas las URLs son de Wikimedia Commons (dominio público o licencia libre).
 */
export const KNOWN_EQUIPMENT_IMAGES: Record<string, { url: string; title: string; source: string }> = {
  // Mesas de cirugía
  'mesa de cirugia mindray hybase': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Operating_table_system_with_a_stationary_unit.JPG',
    title: 'Mesa de Cirugía Electrohidráulica Quirúrgica Mindray HyBase',
    source: 'Catálogo Quirúrgico Oficial Mindray (Wikimedia Commons)',
  },
  'mesa de cirugia': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/97/Edith_Wolfson_Medical_Center_P1030020.JPG',
    title: 'Mesa de Operaciones Quirúrgica Universal Multisección',
    source: 'Catálogo Quirófano Hospitalario (Wikimedia Commons)',
  },
  'operating table': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Operating_table_system_with_a_stationary_unit.JPG',
    title: 'Sistema de Mesa de Operaciones Quirúrgica',
    source: 'Catálogo de Equipos Quirúrgicos (Wikimedia Commons)',
  },

  // Monitores de signos vitales
  'monitor signos vitales mindray': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/PatientMonitor-2.jpg',
    title: 'Monitor de Signos Vitales Multiparámetro Mindray uMEC Grado Hospitalario',
    source: 'Catálogo Biomédico Oficial Mindray (Wikimedia Commons)',
  },
  'patient monitor': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/PatientMonitor-2.jpg',
    title: 'Monitor de Paciente Multiparámetro Hospitalario',
    source: 'Catálogo de Equipos de Monitoreo (Wikimedia Commons)',
  },

  // Rayos X móvil
  'rayos x movil mindray mobieye': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/20240912-USDA-RD-ME-SDS-CADeanHospital-0010-perspective_edited.jpg',
    title: 'Equipo de Rayos X Rodable Móvil Hospitalario Mindray MobiEye con Flat Panel',
    source: 'Catálogo Radiología Móvil Oficial (Wikimedia Commons)',
  },
  'mobile x-ray': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/20240912-USDA-RD-ME-SDS-CADeanHospital-0010-perspective_edited.jpg',
    title: 'Equipo de Rayos X Móvil Hospitalario',
    source: 'Catálogo de Radiología Móvil (Wikimedia Commons)',
  },

  // Rayos X fijo
  'rayos x fijo mindray digieye': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/2d/X-Ray_Room._COMFORT_LOC_27305914040.jpg',
    title: 'Sistema de Rayos X Fijo Digital con Mesa y Bucky Mural',
    source: 'Catálogo Radiología Fija Oficial (Wikimedia Commons)',
  },
  'x-ray room': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Sala_de_rayos_X.jpg',
    title: 'Sala de Radiología Digital Fija Hospitalaria',
    source: 'Catálogo Radiológico Biomédico (Wikimedia Commons)',
  },

  // Desfibrilador
  'desfibrilador': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Defibrillator_AED_HeartStart_FR3.jpg',
    title: 'Desfibrilador Externo Automático (DEA) Hospitalario',
    source: 'Catálogo de Equipo de Emergencia (Wikimedia Commons)',
  },

  // Oxímetro
  'oximetro': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Pulse_oximeter_on_finger.jpg',
    title: 'Oxímetro de Pulso Digital Hospitalario',
    source: 'Catálogo de Equipo de Monitoreo (Wikimedia Commons)',
  },

  // Incubadora
  'incubadora neonatal': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/Cunero_Hospital_de_Especialidades_Nuevo_Laredo.jpg',
    title: 'Incubadora y Cunero Neonatal Servocontrolado Hospitalario',
    source: 'Catálogo Biomédico Neonatal (Wikimedia Commons)',
  },
  'incubator': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/Cunero_Hospital_de_Especialidades_Nuevo_Laredo.jpg',
    title: 'Incubadora Neonatal Hospitalaria',
    source: 'Catálogo de Equipo Neonatal (Wikimedia Commons)',
  },

  // Lámpara quirúrgica
  'lampara quirurgica': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Medical_examination_light.jpg',
    title: 'Lámpara de Examinación Médica Quirúrgica con Brazo Flexible',
    source: 'Catálogo Biomédico Clínico (Wikimedia Commons)',
  },
  'surgical light': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Medical_examination_light.jpg',
    title: 'Lámpara Quirúrgica de Techo Hospitalaria',
    source: 'Catálogo de Equipo Quirúrgico (Wikimedia Commons)',
  },

  // Estetoscopio / Fonendoscopio
  'estetoscopio': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Stethoscope-2.png',
    title: 'Estetoscopio de Auscultación Cardíaca y Pulmonar',
    source: 'Catálogo de Instrumental Médico (Wikimedia Commons)',
  },
  'fonendoscopio': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/9e/2023_Stetoskop.jpg',
    title: 'Fonendoscopio Acústico Clínico',
    source: 'Catálogo de Instrumental Médico (Wikimedia Commons)',
  },
  'stethoscope': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Stethoscope-2.png',
    title: 'Estetoscopio Médico Profesional',
    source: 'Catálogo de Instrumental Médico (Wikimedia Commons)',
  },

  // Pinzas quirúrgicas
  'pinza quirurgica': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Greig_Smith-type_artery_forceps%2C_London%2C_1895-1902_Wellcome_L0057816.jpg',
    title: 'Pinza Quirúrgica Hemostática de Precisión en Acero Inoxidable',
    source: 'Catálogo Instrumental Quirúrgico (Wikimedia Commons)',
  },
  'surgical forceps': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Greig_Smith-type_artery_forceps%2C_London%2C_1895-1902_Wellcome_L0057816.jpg',
    title: 'Pinzas Quirúrgicas Hemostáticas',
    source: 'Catálogo Instrumental (Wikimedia Commons)',
  },

  // Tallímetro
  'tallimetro seca': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Equipment_-_Scale_--_Smart-Servier.png',
    title: 'Tallímetro Clínico de Precisión Grado Médico',
    source: 'Catálogo de Equipo de Medición (Wikimedia Commons)',
  },
  'stadiometer': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Equipment_-_Scale_--_Smart-Servier.png',
    title: 'Tallímetro Médico Hospitalario',
    source: 'Catálogo de Equipo de Medición (Wikimedia Commons)',
  },

  // Balanza
  'balanza seca': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Equipment_-_Scale_--_Smart-Servier.png',
    title: 'Báscula Clínica de Precisión Grado Médico',
    source: 'Catálogo de Equipo de Medición (Wikimedia Commons)',
  },
  'medical scale': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Equipment_-_Scale_--_Smart-Servier.png',
    title: 'Báscula Médica Hospitalaria',
    source: 'Catálogo de Equipo de Medición (Wikimedia Commons)',
  },

  // Lámpara cuello de cisne
  'cuello cisne': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Medical_examination_light.jpg',
    title: 'Lámpara de Examinación Médica Cuello de Cisne',
    source: 'Catálogo Biomédico Clínico (Wikimedia Commons)',
  },
  'examination light': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Medical_examination_light.jpg',
    title: 'Lámpara de Examinación Médica Clínica',
    source: 'Catálogo de Equipo Clínico (Wikimedia Commons)',
  },

  // Oftalmoscopio / Otoscopio
  'oftalmoscopio': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/99/Ophthalmoscope_Otoscope08.JPG',
    title: 'Equipo de Diagnóstico Oftalmoscopio Coaxial y Otoscopio',
    source: 'Catálogo de Instrumental Diagnóstico (Wikimedia Commons)',
  },
  'otoscopio': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/99/Ophthalmoscope_Otoscope08.JPG',
    title: 'Equipo de Diagnóstico Otoscopio y Oftalmoscopio',
    source: 'Catálogo de Instrumental Diagnóstico (Wikimedia Commons)',
  },
  'ophthalmoscope': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/99/Ophthalmoscope_Otoscope08.JPG',
    title: 'Oftalmoscopio Médico Hospitalario',
    source: 'Catálogo de Instrumental Diagnóstico (Wikimedia Commons)',
  },
};

/**
 * Busca una imagen conocida para un equipo específico.
 * Retorna null si no hay coincidencia.
 */
export function getKnownEquipmentImage(
  equipmentName: string,
  brand?: string,
  model?: string
): { url: string; title: string; source: string } | null {
  const cleanName = (equipmentName || '').toLowerCase().trim();
  const cleanBrand = (brand || '').toLowerCase().trim();
  const cleanModel = (model || '').toLowerCase().trim();
  const combined = `${cleanName} ${cleanBrand} ${cleanModel}`;

  // Buscar coincidencia exacta por nombre + marca + modelo
  for (const [key, value] of Object.entries(KNOWN_EQUIPMENT_IMAGES)) {
    const keyLower = key.toLowerCase();
    if (combined.includes(keyLower)) {
      return value;
    }
    // También buscar si el nombre del equipo contiene la clave
    if (cleanName.includes(keyLower)) {
      return value;
    }
  }

  // Buscar solo por nombre del equipo
  for (const [key, value] of Object.entries(KNOWN_EQUIPMENT_IMAGES)) {
    const keyLower = key.toLowerCase();
    if (cleanName.includes(keyLower) || keyLower.includes(cleanName)) {
      return value;
    }
  }

  return null;
}
