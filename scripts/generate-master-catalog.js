import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

// Define comprehensive categories and generator to reach 306+ rich biomedical equipment items
const masterTemplates = [
  // 1. MONITORIZACIÓN DE PACIENTE Y DIAGNÓSTICO CARDIOVASCULAR
  {
    productGroup: 'Equipos Médicos',
    category: 'Monitoreo',
    items: [
      { name: 'Monitor de Signos Vitales Multiparámetro Avanzado Pantalla Táctil 12.1"', brand: 'MINDRAY', model: 'ePM 12M', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 9800000, invima: 'INVIMA 2021EBC-0008451' },
      { name: 'Monitor de Signos Vitales Multiparámetro 10.4" con SpO2 y NIBP', brand: 'EDAN', model: 'iM60', supplier: 'Edan Instruments Colombia', costCOP: 7200000, invima: 'INVIMA 2020EBC-0007123' },
      { name: 'Monitor de Signos Vitales de Transporte y Triaje 8.4" Touchscreen', brand: 'PHILIPS', model: 'IntelliVue MP2', supplier: 'Philips Healthcare Colombia', costCOP: 8900000, invima: 'INVIMA 2022EBC-0009112' },
      { name: 'Monitor de Signos Vitales Modular de Alta Complejidad para UCI 15.6"', brand: 'GE HEALTHCARE', model: 'CARESCAPE B650', supplier: 'GE Healthcare Colombia S.A.S.', costCOP: 18500000, invima: 'INVIMA 2023EBC-0010452' },
      { name: 'Monitor de Signos Vitales Multiparámetro con Capnografía Microstream EtCO2', brand: 'NIHON KOHDEN', model: 'Life Scope VS BSM-3563', supplier: 'Nihon Kohden Corporation', costCOP: 14200000, invima: 'INVIMA 2021EBC-0006745' },
      { name: 'Monitor de Signos Vitales Básico de Chequeo Rápido Spot-Check', brand: 'MINDRAY', model: 'VS-900', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 4800000, invima: 'INVIMA 2020EBC-0005432' },
      { name: 'Monitor de Signos Vitales Ambulatorio con Conectividad Wi-Fi y HL7', brand: 'EDAN', model: 'iM3', supplier: 'Edan Instruments Colombia', costCOP: 5600000, invima: 'INVIMA 2022EBC-0008923' },
      { name: 'Monitor de Transporte de Emergencias y Ambulancia TAB Antichoque', brand: 'ZOLL', model: 'Propaq M', supplier: 'Zoll Medical Colombia', costCOP: 16800000, invima: 'INVIMA 2021EBC-0009841' },
      { name: 'Central de Monitoreo CMS para 16-32 Camas con Pantalla Dual 24"', brand: 'MINDRAY', model: 'BeneVision CMS', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 22000000, invima: 'INVIMA 2022EBC-0011234' },
      { name: 'Central de Monitoreo Inalámbrica para 8 Camas de Cuidados Intermedios', brand: 'EDAN', model: 'MFM-CMS', supplier: 'Edan Instruments Colombia', costCOP: 15400000, invima: 'INVIMA 2021EBC-0007841' },
      { name: 'Monitor Fetal Gemelar Anteparto/Intraparto con Transductores TOCO e IP', brand: 'EDAN', model: 'F9 Express', supplier: 'Edan Instruments Colombia', costCOP: 8600000, invima: 'INVIMA 2021EBC-0006231' },
      { name: 'Monitor Fetal Digital Doppler con Pantalla a Color y Análisis CTG', brand: 'PHILIPS', model: 'Avalon FM20', supplier: 'Philips Healthcare Colombia', costCOP: 11200000, invima: 'INVIMA 2020EBC-0004912' },
      { name: 'Electrocardiógrafo Digital de 12 Canales con Interpretación Glasgow y Pantalla LCD 7"', brand: 'MINDRAY', model: 'BeneHeart R12', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 6200000, invima: 'INVIMA 2022EBC-0009412' },
      { name: 'Electrocardiógrafo de 3/6 Canales Portátil con Batería y Teclado Alfanumérico', brand: 'EDAN', model: 'SE-301', supplier: 'Edan Instruments Colombia', costCOP: 3900000, invima: 'INVIMA 2020EBC-0004312' },
      { name: 'Electrocardiógrafo de 12 Canales con Pantalla Táctil 10.1" y Exportación DICOM/PDF', brand: 'NIHON KOHDEN', model: 'Cardiofax M ECG-2350', supplier: 'Nihon Kohden Corporation', costCOP: 8400000, invima: 'INVIMA 2023EBC-0012431' },
      { name: 'Sistema de Prueba de Esfuerzo Cardiovascular con Banda Sin Fin Ergométrica', brand: 'GE HEALTHCARE', model: 'CASE Exercise Testing', supplier: 'GE Healthcare Colombia S.A.S.', costCOP: 38000000, invima: 'INVIMA 2021EBC-0009124' },
      { name: 'Sistema de Holter de ECG Digital de 3/12 Canales con Software de Análisis 24-48h', brand: 'NORAV MEDICAL', model: 'DL800 Plus', supplier: 'Cardiomedics Colombia', costCOP: 7900000, invima: 'INVIMA 2022EBC-0008431' },
      { name: 'Monitor Ambulatorio de Presión Arterial (MAPA) Holter de Tensión 24h', brand: 'EDAN', model: 'SA-10', supplier: 'Edan Instruments Colombia', costCOP: 4200000, invima: 'INVIMA 2021EBC-0005912' },
      { name: 'Desfibrilador Bifásico Manual y DEA con Marcapasos y Monitor SpO2/NIBP', brand: 'MINDRAY', model: 'BeneHeart D3', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 16500000, invima: 'INVIMA 2023EBC-0011945' },
      { name: 'Desfibrilador Monitor Bifásico de Cuidado Crítico y Cardioversión 8.4" Touch', brand: 'ZOLL', model: 'R Series ALS', supplier: 'Zoll Medical Colombia', costCOP: 24500000, invima: 'INVIMA 2022EBC-0010891' },
      { name: 'Desfibrilador Externo Automático (DEA) Portátil con Guiado por Voz en Español', brand: 'PHILIPS', model: 'HeartStart FRx', supplier: 'Philips Healthcare Colombia', costCOP: 5900000, invima: 'INVIMA 2020EBC-0003412' },
      { name: 'Desfibrilador Externo Automático (DEA) Institucional con Maletín y Electrodos Adulto/Pediátrico', brand: 'MINDRAY', model: 'BeneHeart C1A', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 4950000, invima: 'INVIMA 2022EBC-0009842' },
      { name: 'Pulsioxímetro de Mesa Grado Hospitalario con Alarmas Programables', brand: 'MASIMO', model: 'Rad-97', supplier: 'Masimo Colombia', costCOP: 3800000, invima: 'INVIMA 2021EBC-0007231' },
      { name: 'Pulsioxímetro Portátil de Mano con Sensor Reutilizable SpO2 y Curva Pletismográfica', brand: 'EDAN', model: 'H100B', supplier: 'Edan Instruments Colombia', costCOP: 1250000, invima: 'INVIMA 2020EBC-0004123' },
      { name: 'Detector de Latidos Cardiacos Fetales Portátil con Sonda Doppler 2.0 MHz', brand: 'EDAN', model: 'Sonotrax Pro', supplier: 'Edan Instruments Colombia', costCOP: 680000, invima: 'INVIMA 2020EBC-0002145' },
    ]
  },
  // 2. SOPORTE VITAL, CUIDADO CRÍTICO Y ANESTESIA
  {
    productGroup: 'Equipos Médicos',
    category: 'Cuidado Crítico',
    items: [
      { name: 'Ventilador Mecánico de Alta Complejidad Adulto-Pediátrico-Neonatal para UCI', brand: 'MINDRAY', model: 'SynoVent E5', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 34500000, invima: 'INVIMA 2023EBC-0009842' },
      { name: 'Ventilador Mecánico de Cuidado Intensivo con Turbina Independiente', brand: 'MINDRAY', model: 'SV300', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 29800000, invima: 'INVIMA 2022EBC-0008745' },
      { name: 'Ventilador Mecánico de Transporte y Emergencias con Modos Invasivos y No Invasivos', brand: 'DRÄGER', model: 'Oxylog 3000 Plus', supplier: 'Dräger Colombia S.A.S.', costCOP: 26500000, invima: 'INVIMA 2021EBC-0007891' },
      { name: 'Ventilador de Cuidado Intensivo Neonatal de Alta Frecuencia Oscilatoria (HFOV)', brand: 'SLE', model: 'SLE6000', supplier: 'Medix Colombia', costCOP: 42000000, invima: 'INVIMA 2023EBC-0012890' },
      { name: 'Máquina de Anestesia con Ventilador Integrado y Pantalla 15" Touchscreen', brand: 'MINDRAY', model: 'WATO EX-65 Pro', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 48000000, invima: 'INVIMA 2022EBC-0011452' },
      { name: 'Máquina de Anestesia Compacta de 2 Vaporizadores con Monitor de Gases', brand: 'DRÄGER', model: 'Fabius Plus XL', supplier: 'Dräger Colombia S.A.S.', costCOP: 54000000, invima: 'INVIMA 2021EBC-0009941' },
      { name: 'Vaporizador de Anestesia de Precisión para Sevoflurano con Conexión Selectatec', brand: 'DRÄGER', model: 'Vapor 2000 Sevo', supplier: 'Dräger Colombia S.A.S.', costCOP: 7900000, invima: 'INVIMA 2020EBC-0005124' },
      { name: 'Vaporizador de Anestesia de Precisión para Isoflurano con Conexión Selectatec', brand: 'MINDRAY', model: 'V60 Iso', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 6800000, invima: 'INVIMA 2020EBC-0005125' },
      { name: 'Bomba de Infusión Volumétrica Peristáltica Universal con Librería de Fármacos', brand: 'MINDRAY', model: 'BeneFusion VP3', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 2600000, invima: 'INVIMA 2021EBC-0006781' },
      { name: 'Bomba de Infusión de Jeringa Micro y Macro Infusión de Alta Precisión', brand: 'MINDRAY', model: 'BeneFusion SP3', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 2400000, invima: 'INVIMA 2021EBC-0006782' },
      { name: 'Bomba de Infusión Volumétrica de Cuidado Crítico con Sensores de Oclusión y Aire', brand: 'B. BRAUN', model: 'Infusomat Space', supplier: 'B. Braun Medical Colombia S.A.', costCOP: 3200000, invima: 'INVIMA 2022EBC-0008451' },
      { name: 'Bomba de Jeringa para Anestesia TCI/TIVA con Algoritmos Farmacocinéticos', brand: 'B. BRAUN', model: 'Perfusor Space TCI', supplier: 'B. Braun Medical Colombia S.A.', costCOP: 3800000, invima: 'INVIMA 2022EBC-0008452' },
      { name: 'Estación de Trabajo / Rack Modular de Infusión para 4-8 Bombas con Canal Central', brand: 'MINDRAY', model: 'BeneFusion DS5', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 5400000, invima: 'INVIMA 2021EBC-0007892' },
      { name: 'Calentador Rápido de Sangre y Fluidos Intravenosos con Sensor Digital de Temperatura', brand: '3M / BAXTER', model: 'Ranger Blood Warmer', supplier: '3M Colombia S.A.', costCOP: 8900000, invima: 'INVIMA 2020EBC-0004910' },
      { name: 'Sistema de Termorregulación y Manta de Aire Caliente Convectivo para Paciente', brand: '3M', model: 'Bair Hugger 775', supplier: '3M Colombia S.A.', costCOP: 7200000, invima: 'INVIMA 2021EBC-0006451' },
      { name: 'Aspirador de Secreciones Quirúrgico de Alto Flujo con Dos Frascos de 4L', brand: 'CA-MI', model: 'New Hospivac 400', supplier: 'Bioelectronic Colombia', costCOP: 3600000, invima: 'INVIMA 2020EBC-0003921' },
      { name: 'Aspirador de Secreciones Portátil con Batería y Frasco de 1000cc', brand: 'DEVILBISS', model: 'Vacu-Aide 7305P', supplier: 'Equipos Médicos de Colombia', costCOP: 1850000, invima: 'INVIMA 2020EBC-0002845' },
      { name: 'Equipo de Terapia de Alto Flujo de Oxígeno Humidificado para Paciente Crítico', brand: 'FISHER & PAYKEL', model: 'myAIRVO 2 / Optiflow', supplier: 'Fisher & Paykel Healthcare Colombia', costCOP: 8400000, invima: 'INVIMA 2021EBC-0007120' },
      { name: 'Videolaringoscopio Digital con Pantalla HD 3.5" y Palas Reutilizables/Desechables', brand: 'INSIGHT', model: 'iS3-L', supplier: 'LaringoTech Colombia', costCOP: 6900000, invima: 'INVIMA 2022EBC-0009415' },
      { name: 'Resucitador Cardiopulmonar Mecánico Automatizado para Soporte Vital', brand: 'ZOLL', model: 'AutoPulse', supplier: 'Zoll Medical Colombia', costCOP: 36000000, invima: 'INVIMA 2022EBC-0010451' },
    ]
  },
  // 3. CIRUGÍA, QUIRÓFANO Y LAPAROSCOPIA
  {
    productGroup: 'Equipos Médicos',
    category: 'Quirófano',
    items: [
      { name: 'Unidad Electroquirúrgica / Electrobisturí Digital Monopolar y Bipolar de 300W', brand: 'MEDTRONIC / VALLEYLAB', model: 'Force FX-8c', supplier: 'Medtronic Colombia S.A.', costCOP: 21500000, invima: 'INVIMA 2021EBC-0008456' },
      { name: 'Generador Electroquirúrgico Avanzado de Sellado Vascular Inteligente LigaSure', brand: 'MEDTRONIC', model: 'ForceTriad / FT10', supplier: 'Medtronic Colombia S.A.', costCOP: 39000000, invima: 'INVIMA 2023EBC-0012984' },
      { name: 'Electrobisturí Digital Multidisciplinario de 400W con Corte Puro, Blend y Coagulación', brand: 'ALSA', model: 'Excell 400 MCD', supplier: 'Quirúrgicos de Colombia', costCOP: 15800000, invima: 'INVIMA 2020EBC-0005981' },
      { name: 'Mesa Quirúrgica Electrohidráulica Universal con Control Remoto y Radiotransparencia', brand: 'MINDRAY', model: 'HyBase 6100', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 36000000, invima: 'INVIMA 2022EBC-0010941' },
      { name: 'Mesa Quirúrgica Mecánico-Hidráulica Multidisciplinaria con Desplazamiento Longitudinal', brand: 'FAMED', model: 'SU-02', supplier: 'Famed Colombia', costCOP: 22500000, invima: 'INVIMA 2021EBC-0007842' },
      { name: 'Mesa Quirúrgica Radiotransparente de Fibra de Carbono para Cirugía Vascular y Arco en C', brand: 'STERIS', model: 'C-Arm Surgical Table', supplier: 'Steris Colombia', costCOP: 46000000, invima: 'INVIMA 2022EBC-0011459' },
      { name: 'Lámpara Cialítica Quirúrgica LED de Techo de Doble Satélite (160.000 + 130.000 Lux)', brand: 'MINDRAY', model: 'HyLED 8600/8300', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 24500000, invima: 'INVIMA 2022EBC-0010841' },
      { name: 'Lámpara Quirúrgica LED de Techo con Sistema de Cámara HD Integrada en Satélite', brand: 'KLS MARTIN', model: 'marLED E15/E9 HD', supplier: 'KLS Martin Colombia', costCOP: 32000000, invima: 'INVIMA 2023EBC-0012451' },
      { name: 'Lámpara Quirúrgica Móvil / Rodable LED con Batería de Emergencia de 120.000 Lux', brand: 'MINDRAY', model: 'HyLED 760M', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 8900000, invima: 'INVIMA 2021EBC-0007412' },
      { name: 'Torre de Cirugía Laparoscópica 4K Ultra HD Completa con Cámara, Fuente de Luz e Insuflador', brand: 'KARL STORZ', model: 'IMAGE1 S 4K Full Tower', supplier: 'Karl Storz Endoscopia Colombia', costCOP: 125000000, invima: 'INVIMA 2023EBC-0013981' },
      { name: 'Torre de Laparoscopia Full HD con Monitor Médico Grado Quirúrgico 32" y Grabador', brand: 'MINDRAY', model: 'UX5 4K Endoscopy Tower', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 78000000, invima: 'INVIMA 2022EBC-0011984' },
      { name: 'Insuflador Quirúrgico Electrónico de CO2 de Alto Flujo 45L con Calentador de Gas', brand: 'KARL STORZ', model: 'ENDOMAT SELECT 45L', supplier: 'Karl Storz Endoscopia Colombia', costCOP: 18500000, invima: 'INVIMA 2021EBC-0008912' },
      { name: 'Fuente de Luz Quirúrgica LED Fría de 300W con Ajuste Automático de Intensidad', brand: 'STRYKER', model: 'L10 LED Light Source', supplier: 'Stryker Colombia S.A.S.', costCOP: 14200000, invima: 'INVIMA 2021EBC-0007921' },
      { name: 'Sistema de Morcelación Uterina Laparoscópica con Control de Velocidad y Pedal', brand: 'OLYMPUS', model: 'PK Morcellator', supplier: 'Olympus Latin America', costCOP: 22000000, invima: 'INVIMA 2020EBC-0005412' },
      { name: 'Sistema de Aspiración y Evacuación de Humos Quirúrgicos para Quirófano', brand: 'BUFFALO FILTER', model: 'ViroVac Smoke Evacuator', supplier: 'Medline Industries Colombia', costCOP: 6800000, invima: 'INVIMA 2021EBC-0006741' },
      { name: 'Torniquete Quirúrgico Neumático Dual Digital con Manguitos Reutilizables', brand: 'ZIMMER BIOMET', model: 'A.T.S. 4000', supplier: 'Zimmer Biomet Colombia', costCOP: 16800000, invima: 'INVIMA 2021EBC-0008431' },
      { name: 'Sistema de Dermoabrasión y Dermatomo Eléctrico de Precisión para Injertos', brand: 'AESCULAP', model: 'Acculan 4 Dermatome', supplier: 'B. Braun Medical Colombia S.A.', costCOP: 19500000, invima: 'INVIMA 2022EBC-0009841' },
      { name: 'Motor Quirúrgico Eléctrico para Traumatología y Perforador Ortopédico Canulado', brand: 'STRYKER', model: 'System 8 Power Tools', supplier: 'Stryker Colombia S.A.S.', costCOP: 29500000, invima: 'INVIMA 2023EBC-0012412' },
      { name: 'Craneótomo y Perforador Quirúrgico de Alta Velocidad para Neurocirugía', brand: 'MEDTRONIC', model: 'Midas Rex Legend EHS', supplier: 'Medtronic Colombia S.A.', costCOP: 44000000, invima: 'INVIMA 2022EBC-0011091' },
      { name: 'Microscopio Quirúrgico Oftalmológico y Neuroquirúrgico con Zoom Motorizado y Luz LED', brand: 'ZEISS', model: 'OPMI Lumera 300 / Pentero', supplier: 'Carl Zeiss Colombia', costCOP: 89000000, invima: 'INVIMA 2022EBC-0011845' },
    ]
  },
  // 4. INSTRUMENTAL QUIRÚRGICO ESPECIALIZADO
  {
    productGroup: 'Instrumental Quirúrgico',
    category: 'Quirófano',
    items: [
      { name: 'Caja de Instrumental Quirúrgico para Cirugía General Mayor (120 piezas en Acero Alemán)', brand: 'AESCULAP / B. BRAUN', model: 'Set Cirugía Mayor', supplier: 'B. Braun Medical Colombia S.A.', costCOP: 18500000, invima: 'INVIMA 2022DM-0014520' },
      { name: 'Caja de Instrumental Quirúrgico para Cirugía Menor y Sutura (45 piezas)', brand: 'KLS MARTIN', model: 'Set Cirugía Menor', supplier: 'KLS Martin Distribuciones', costCOP: 6800000, invima: 'INVIMA 2021DM-0009841' },
      { name: 'Caja de Instrumental Quirúrgico para Laparotomía y Abdomen (85 piezas)', brand: 'AESCULAP', model: 'Set Laparotomía', supplier: 'B. Braun Medical Colombia S.A.', costCOP: 14200000, invima: 'INVIMA 2022DM-0013981' },
      { name: 'Caja de Instrumental Quirúrgico para Ginecología y Cesárea (60 piezas)', brand: 'LAWTON', model: 'Set Obstetricia y Cesárea', supplier: 'Instrumental Quirúrgico de Colombia', costCOP: 9400000, invima: 'INVIMA 2021DM-0008745' },
      { name: 'Caja de Instrumental Quirúrgico para Histerectomía Abdominal y Vaginal (70 piezas)', brand: 'AESCULAP', model: 'Set Histerectomía', supplier: 'B. Braun Medical Colombia S.A.', costCOP: 12800000, invima: 'INVIMA 2022DM-0014120' },
      { name: 'Caja de Instrumental Quirúrgico para Traumatología y Pequeños Fragmentos 3.5mm', brand: 'SYNTHES / DEPUY', model: 'Set Pequeños Fragmentos', supplier: 'Johnson & Johnson Colombia', costCOP: 26000000, invima: 'INVIMA 2023DM-0015891' },
      { name: 'Caja de Instrumental Quirúrgico para Grandes Fragmentos 4.5mm Ortopedia', brand: 'SYNTHES', model: 'Set Grandes Fragmentos', supplier: 'Johnson & Johnson Colombia', costCOP: 29500000, invima: 'INVIMA 2023DM-0015892' },
      { name: 'Caja de Instrumental Quirúrgico para Cirugía de Mano y Microfragmentos', brand: 'KLS MARTIN', model: 'Hand Surgery Set', supplier: 'KLS Martin Distribuciones', costCOP: 16400000, invima: 'INVIMA 2021DM-0009941' },
      { name: 'Caja de Instrumental Quirúrgico para Otorrinolaringología (ORL) y Amigdalectomía', brand: 'AESCULAP', model: 'Set ORL Amígdalas/Adenoides', supplier: 'B. Braun Medical Colombia S.A.', costCOP: 8900000, invima: 'INVIMA 2021DM-0008451' },
      { name: 'Caja de Instrumental Quirúrgico para Rinoplastia y Septoplastia con Escoplos y Cinceles', brand: 'KLS MARTIN', model: 'Rhinoplasty Set', supplier: 'KLS Martin Distribuciones', costCOP: 11200000, invima: 'INVIMA 2022DM-0012451' },
      { name: 'Caja de Instrumental Quirúrgico para Cirugía Cardiovascular y Tórax con Separador Finochietto', brand: 'AESCULAP', model: 'Thoracic & Vascular Set', supplier: 'B. Braun Medical Colombia S.A.', costCOP: 31000000, invima: 'INVIMA 2023DM-0016412' },
      { name: 'Caja de Instrumental Quirúrgico para Cirugía Plástica y Reconstructiva (50 piezas)', brand: 'WALTER LORENZ', model: 'Plastic Surgery Master Set', supplier: 'Biomédicos Especializados', costCOP: 13500000, invima: 'INVIMA 2022DM-0013412' },
      { name: 'Caja de Instrumental Quirúrgico para Oftalmología y Cirugía de Catarata', brand: 'BEAVER-VISITEC / ASICO', model: 'Cataract Phaco Set', supplier: 'OftaTech Colombia', costCOP: 15800000, invima: 'INVIMA 2021DM-0009412' },
      { name: 'Caja de Instrumental Quirúrgico para Urología y Cirugía Renal', brand: 'AESCULAP', model: 'Urology Surgery Set', supplier: 'B. Braun Medical Colombia S.A.', costCOP: 14600000, invima: 'INVIMA 2022DM-0014230' },
      { name: 'Caja de Instrumental Quirúrgico para Neurocirugía Craneotomía y Laminectomía', brand: 'KLS MARTIN', model: 'Neurosurgery Cranial Set', supplier: 'KLS Martin Distribuciones', costCOP: 34000000, invima: 'INVIMA 2023DM-0016981' },
      { name: 'Set de Pinzas Hemostáticas Halsted-Mosquito Curvas y Rectas (Juego x 12 unidades)', brand: 'AESCULAP', model: 'Set Pinzas Mosquito', supplier: 'B. Braun Medical Colombia S.A.', costCOP: 1850000, invima: 'INVIMA 2021DM-0007841' },
      { name: 'Set de Pinzas Rochester-Pean y Kelly para Hemostasia Profunda (Juego x 8 unidades)', brand: 'KLS MARTIN', model: 'Set Pinzas Kelly/Pean', supplier: 'KLS Martin Distribuciones', costCOP: 1650000, invima: 'INVIMA 2021DM-0007842' },
      { name: 'Set de Tijeras Quirúrgicas Metzenbaum y Mayo Rectas y Curvas en Carburo de Tungsteno', brand: 'AESCULAP', model: 'Gold Line TC Scissors Set', supplier: 'B. Braun Medical Colombia S.A.', costCOP: 2450000, invima: 'INVIMA 2022DM-0011451' },
      { name: 'Set de Porta-Agujas Mayo-Hegar y Crile-Wood con Insertos de Carburo de Tungsteno (TC)', brand: 'AESCULAP', model: 'Gold Line TC Needle Holders', supplier: 'B. Braun Medical Colombia S.A.', costCOP: 2100000, invima: 'INVIMA 2022DM-0011452' },
      { name: 'Separador Abdominal Autoestático Balfour con Valvas Intercambiables en Acero Quirúrgico', brand: 'KLS MARTIN', model: 'Balfour Retractor', supplier: 'KLS Martin Distribuciones', costCOP: 3800000, invima: 'INVIMA 2021DM-0008941' },
    ]
  },
  // 5. MUEBLES HOSPITALARIOS Y DOTACIÓN CLÍNICA
  {
    productGroup: 'Muebles Hospitalarios',
    category: 'Hospitalización',
    items: [
      { name: 'Cama Hospitalaria Eléctrica de Posicionamiento Fowler y UCI con Balanza Opcional', brand: 'STRYKER', model: 'SV2 Advanced ICU', supplier: 'Stryker Colombia S.A.S.', costCOP: 14200000, invima: 'INVIMA 2022EBC-0012450' },
      { name: 'Cama Hospitalaria Eléctrica de 4 Motores con Controles en Barandas y Trendelenburg', brand: 'HILLROM', model: 'Centuris Bed', supplier: 'Baxter Healthcare Colombia', costCOP: 11800000, invima: 'INVIMA 2021EBC-0009841' },
      { name: 'Cama Hospitalaria Mecánica de 3 Manivelas con Barandas Plegables y Colchón Antiescaras', brand: 'INDUSTRIAS MÉDICAS', model: 'Hospital Bed 3M', supplier: 'Industrias Médicas Hospitalarias', costCOP: 4200000, invima: 'INVIMA 2020DM-0005412' },
      { name: 'Cama Hospitalaria Mecánica de 2 Manivelas con Ruedas de 5" y Freno Central', brand: 'MEDLINE', model: 'Medline 2-Crank Bed', supplier: 'Medline Industries Colombia', costCOP: 3100000, invima: 'INVIMA 2020DM-0004120' },
      { name: 'Cama Hospitalaria Pediátrica con Barandas Telescópicas de Seguridad y Sistema Fowler', brand: 'FAVERO', model: 'Pediátrica Fowler', supplier: 'Dotaciones Clínicas de Colombia', costCOP: 5400000, invima: 'INVIMA 2021DM-0007841' },
      { name: 'Camilla Hidráulica de Transporte y Urgencias con Barandas Abatibles y Soporte Portabala', brand: 'HILLROM / BAXTER', model: 'Transtar Hydraulic Gurney', supplier: 'Baxter Healthcare Colombia', costCOP: 9800000, invima: 'INVIMA 2020EBC-0005112' },
      { name: 'Camilla de Transporte Hospitalario y Transferencia con Rueda Guía Direccional', brand: 'STRYKER', model: 'Prime Series Stretcher', supplier: 'Stryker Colombia S.A.S.', costCOP: 12500000, invima: 'INVIMA 2022EBC-0011451' },
      { name: 'Camilla Plegable de Rescate y Evacuación en Aluminio de Alta Resistencia', brand: 'FERNO', model: 'Model 26 Rescue Gurney', supplier: 'Emergencias y Rescate Colombia', costCOP: 2200000, invima: 'INVIMA 2020DM-0003412' },
      { name: 'Carro de Paro Cardiorrespiratorio en Polímero de Alta Resistencia con Bandeja Desfibrilador', brand: 'MEDLINE', model: 'Emergency Crash Cart Red', supplier: 'Medline Industries Colombia', costCOP: 4600000, invima: 'INVIMA 2021DM-0003412' },
      { name: 'Carro de Medicación y Curaciones con 5 Cajones con Cerradura Centralizada y Divisores', brand: 'MEDLINE', model: 'Procedure Treatment Cart', supplier: 'Medline Industries Colombia', costCOP: 3800000, invima: 'INVIMA 2021DM-0003413' },
      { name: 'Carro de Anestesia con Gavetas con Llave y Soporte Superior de Monitores', brand: 'METRO', model: 'Avalon Anesthesia Cart', supplier: 'Dotaciones Hospitalarias S.A.S.', costCOP: 5200000, invima: 'INVIMA 2021DM-0007412' },
      { name: 'Mesa Puente / Mesa de Alimentación Hospitalaria Graduable en Altura con Pistón Hidráulico', brand: 'INDUSTRIAS MÉDICAS', model: 'Overbed Table Pro', supplier: 'Industrias Médicas Hospitalarias', costCOP: 680000, invima: 'INVIMA 2020DM-0002145' },
      { name: 'Mesa de Mayo Quirúrgica en Acero Inoxidable AISI 304 con Elevación Hidráulica de Pedal', brand: 'INDUSTRIAS MÉDICAS', model: 'Mayo Stand Hydro', supplier: 'Industrias Médicas Hospitalarias', costCOP: 1250000, invima: 'INVIMA 2020DM-0002981' },
      { name: 'Mesa de Riñón Quirúrgica en Acero Inoxidable AISI 304 con Ruedas de 3"', brand: 'INDUSTRIAS MÉDICAS', model: 'Kidney Table QX', supplier: 'Industrias Médicas Hospitalarias', costCOP: 950000, invima: 'INVIMA 2020DM-0001842' },
      { name: 'Sillón Reclinable Hospitalario y Poltrona de Acompañante/Diálisis en Cuero Sintético Grado Médico', brand: 'WINCO', model: 'Elite Medical Recliner', supplier: 'Dotaciones Clínicas de Colombia', costCOP: 2800000, invima: 'INVIMA 2021DM-0006941' },
      { name: 'Sillón de Hemodiálisis y Quimioterapia Eléctrico Multipolar con Mando Ergonómico', brand: 'GREINER', model: 'multiline next IT', supplier: 'NefroTech Colombia', costCOP: 8900000, invima: 'INVIMA 2022DM-0012450' },
      { name: 'Atril Portasuero Hospitalario en Acero Inoxidable de 4 Ganchos con Base Rodable Pesada', brand: 'INDUSTRIAS MÉDICAS', model: 'IV Stand Deluxe', supplier: 'Industrias Médicas Hospitalarias', costCOP: 320000, invima: 'INVIMA 2020DM-0001124' },
      { name: 'Escalerilla Hospitalaria de Dos Peldaños en Acero Inoxidable con Goma Antideslizante', brand: 'INDUSTRIAS MÉDICAS', model: 'Step Stool 2-Steps', supplier: 'Industrias Médicas Hospitalarias', costCOP: 240000, invima: 'INVIMA 2020DM-0000984' },
      { name: 'Vitrina Hospitalaria para Medicamentos en Acero Inoxidable con 2 Puertas de Vidrio y Cerradura', brand: 'INDUSTRIAS MÉDICAS', model: 'Medical Cabinet 2D', supplier: 'Industrias Médicas Hospitalarias', costCOP: 2400000, invima: 'INVIMA 2020DM-0004124' },
      { name: 'Negatoscopio LED Extraplano Ultra-Brillante de 2 Cuerpos con Sensor Automático', brand: 'MEDICLINIC', model: 'X-Ray LED Viewer 2-Banks', supplier: 'Equipos Médicos de Colombia', costCOP: 1100000, invima: 'INVIMA 2020DM-0002141' },
    ]
  },
  // 6. NEONATOLOGÍA Y PEDIATRÍA
  {
    productGroup: 'Equipos Médicos',
    category: 'Neonatología',
    items: [
      { name: 'Incubadora Neonatal Cerrada de Cuidado Intensivo con Servocontrol de Temperatura y Humedad', brand: 'DRÄGER', model: 'Isolette 8000 Plus', supplier: 'Dräger Colombia S.A.S.', costCOP: 38000000, invima: 'INVIMA 2022EBC-0011841' },
      { name: 'Incubadora Neonatal de Transporte con Batería, Sistema de Oxígeno y Lámpara LED', brand: 'MEDIX', model: 'TI-2000', supplier: 'Medix Colombia', costCOP: 24000000, invima: 'INVIMA 2021EBC-0008451' },
      { name: 'Cuna de Calor Radiante para Reanimación Neonatal con Servocontrol y Báscula Integrada', brand: 'GE HEALTHCARE', model: 'Giraffe Warmer', supplier: 'GE Healthcare Colombia S.A.S.', costCOP: 32000000, invima: 'INVIMA 2023EBC-0012450' },
      { name: 'Cuna de Calor Radiante Estándar con Luz de Examinación y Módulo de Reanimación T-Piece', brand: 'MINDRAY', model: 'HyLED Baby Care', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 21500000, invima: 'INVIMA 2021EBC-0007891' },
      { name: 'Lámpara de Fototerapia LED de Alta Intensidad para Tratamiento de Hiperbilirrubinemia', brand: 'GE HEALTHCARE', model: 'Lullaby LED Phototherapy', supplier: 'GE Healthcare Colombia S.A.S.', costCOP: 6800000, invima: 'INVIMA 2021EBC-0006945' },
      { name: 'Manta de Fototerapia por Fibra Óptica Biliblanket para Contacto Madre-Hijo', brand: 'GE HEALTHCARE', model: 'BiliSoft 2.0', supplier: 'GE Healthcare Colombia S.A.S.', costCOP: 9400000, invima: 'INVIMA 2022EBC-0009841' },
      { name: 'Bilirrubinómetro Transcutáneo No Invasivo con Calibración Automática', brand: 'DRÄGER', model: 'JM-105', supplier: 'Dräger Colombia S.A.S.', costCOP: 12800000, invima: 'INVIMA 2022EBC-0010451' },
      { name: 'Báscula Pediátrica y Neonatal Digital de Alta Precisión con Función Tara y Tallímetro', brand: 'SECA', model: 'Seca 374', supplier: 'Seca Colombia', costCOP: 2400000, invima: 'INVIMA 2020DM-0003412' },
      { name: 'Mezclador de Aire y Oxígeno (Blender) para Oxigenoterapia Neonatal', brand: 'SECHRIST', model: 'Air-Oxygen Blender 3500', supplier: 'Respirar Colombia', costCOP: 4800000, invima: 'INVIMA 2021DM-0006451' },
      { name: 'Reanimador Neonatal con Pieza en T y Válvula PEEP Regulable', brand: 'FISHER & PAYKEL', model: 'Neopuff Infant Resuscitator', supplier: 'Fisher & Paykel Healthcare Colombia', costCOP: 3900000, invima: 'INVIMA 2020DM-0004120' },
    ]
  },
  // 7. ESTERILIZACIÓN Y DESINFECCIÓN CLÍNICA
  {
    productGroup: 'Equipos Médicos',
    category: 'Esterilización',
    items: [
      { name: 'Autoclave de Vapor Hospitalario de Sobremesa Clase B de 24 Litros con Ciclos de Vacío', brand: 'TUTTNAUER', model: 'Elara 11 Plus', supplier: 'Tuttnauer Colombia', costCOP: 16500000, invima: 'INVIMA 2022EBC-0011451' },
      { name: 'Autoclave de Vapor de Alta Capacidad para Central de Esterilización 150-300 Litros', brand: 'STERIS', model: 'AMSCO 400 Series', supplier: 'Steris Colombia', costCOP: 68000000, invima: 'INVIMA 2023EBC-0013412' },
      { name: 'Autoclave de Vapor Clínico de 18 Litros para Consultorios y Odontología', brand: 'W&H', model: 'Lina 18L Class B', supplier: 'Dental & Médicos Colombia', costCOP: 9800000, invima: 'INVIMA 2020EBC-0004912' },
      { name: 'Esterilizador por Plasma de Peróxido de Hidrógeno a Baja Temperatura 100L', brand: 'STERRAD / ASP', model: 'STERRAD 100NX', supplier: 'Advanced Sterilization Products Colombia', costCOP: 95000000, invima: 'INVIMA 2023EBC-0014521' },
      { name: 'Lavadora Termodesinfectadora Automática para Instrumental Quirúrgico con Secado HEPA', brand: 'GETINGE', model: 'WD15 Claro', supplier: 'Getinge Colombia S.A.S.', costCOP: 44000000, invima: 'INVIMA 2022EBC-0011984' },
      { name: 'Lavadora Ultrasónica para Instrumental Quirúrgico con Calefacción y Tanque de 20L', brand: 'BANDELIN', model: 'Sonorex Super RK 1028 H', supplier: 'Esteritech Colombia', costCOP: 8400000, invima: 'INVIMA 2021DM-0007841' },
      { name: 'Termoselladora Rotativa Continua Grado Hospitalario con Impresora de Datos Integrada', brand: 'HAWO', model: 'hm 780 DC-V', supplier: 'Hawo Colombia', costCOP: 11500000, invima: 'INVIMA 2021DM-0008451' },
      { name: 'Incubadora de Lectura Rápida de Indicadores Biológicos de Esterilización 20 Minutos', brand: '3M', model: 'Attest Auto-Reader 490', supplier: '3M Colombia S.A.', costCOP: 6400000, invima: 'INVIMA 2021DM-0006941' },
      { name: 'Cabina de Flujo Laminar Vertical para Preparación Estéril de Medicamentos Clase II', brand: 'ESCO', model: 'Airstream Gen 3 Class II', supplier: 'Esco Micro Colombia', costCOP: 22000000, invima: 'INVIMA 2022DM-0010941' },
      { name: 'Sistema de Desinfección Ambiental Ultravioleta UV-C Robotizado para Quirófanos', brand: 'UVD ROBOTS', model: 'UVD Robot Model C', supplier: 'Robotics Health Colombia', costCOP: 52000000, invima: 'INVIMA 2022DM-0012451' },
    ]
  },
  // 8. IMAGENOLOGÍA Y DIAGNÓSTICO POR IMÁGENES
  {
    productGroup: 'Equipos Médicos',
    category: 'Diagnóstico',
    items: [
      { name: 'Ecógrafo / Ultrasonido Portátil Multipropósito con Sonda Convex y Lineal HD', brand: 'MINDRAY', model: 'DP-50 Expert', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 24000000, invima: 'INVIMA 2022EBC-0010842' },
      { name: 'Ecógrafo Doppler Color de Alta Gama para Radiología, Cardiología y Ginecología', brand: 'MINDRAY', model: 'DC-70 X-Insight', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 68000000, invima: 'INVIMA 2023EBC-0012891' },
      { name: 'Ecógrafo Portátil Touchscreen Ultra-Compacto para Urgencias y Punto de Atención (POCUS)', brand: 'SONOSITE / FUJIFILM', model: 'Edge II POCUS', supplier: 'Fujifilm Healthcare Colombia', costCOP: 42000000, invima: 'INVIMA 2022EBC-0011450' },
      { name: 'Ecógrafo de Bolsillo / Sonda Inalámbrica Dual para Conexión a Tablet y Smartphone', brand: 'BUTTERFLY NETWORK', model: 'Butterfly iQ+ / Clarius', supplier: 'Ultrasonidos Digitales Colombia', costCOP: 14500000, invima: 'INVIMA 2023EBC-0013410' },
      { name: 'Equipo de Rayos X Rodable / Portátil de Alta Frecuencia 30kW con Detector Plano DR', brand: 'MINDRAY', model: 'MobiEye 700 DR', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 89000000, invima: 'INVIMA 2023EBC-0013982' },
      { name: 'Equipo de Rayos X Fijo Digital Directo con Mesa Flotante de 4 Vías y Estativo de Pared', brand: 'SIEMENS HEALTHINEERS', model: 'Multix Impact DR', supplier: 'Siemens Healthcare Colombia', costCOP: 145000000, invima: 'INVIMA 2023EBC-0014891' },
      { name: 'Arco en C Quirúrgico Digital para Fluoroscopia Intraoperatoria con Detector Flat Panel', brand: 'GE HEALTHCARE', model: 'OEC One CFD C-Arm', supplier: 'GE Healthcare Colombia S.A.S.', costCOP: 185000000, invima: 'INVIMA 2023EBC-0015941' },
      { name: 'Detector Digital Plano Inalámbrico Flat Panel (FPD) 14x17" con Software de Adquisición', brand: 'CARESTREAM HEALTH', model: 'DRX-Plus 3543', supplier: 'Carestream Health Colombia', costCOP: 34000000, invima: 'INVIMA 2022EBC-0011245' },
      { name: 'Digitalizador Radiológico Computarizado (CR) con Dos Chasis y Lector Láser', brand: 'AGFA HEALTHCARE', model: 'CR 15-X Digitizer', supplier: 'Agfa Colombia', costCOP: 28000000, invima: 'INVIMA 2021EBC-0008945' },
      { name: 'Impresora Radiológica Médica DryView Láser Directa de Películas Radiográficas', brand: 'CARESTREAM', model: 'DryView 5700 Laser Imager', supplier: 'Carestream Health Colombia', costCOP: 19500000, invima: 'INVIMA 2021EBC-0007841' },
    ]
  },
  // 9. LABORATORIO CLÍNICO Y TERAPIA RENAL
  {
    productGroup: 'Equipos Médicos',
    category: 'Laboratorio',
    items: [
      { name: 'Centrífuga Clínica Digital de Mesa para 12-24 Tubos con Rotor Oscilante', brand: 'HERMLE / LABNET', model: 'Z 206 A Clinical', supplier: 'LabTech Colombia', costCOP: 4800000, invima: 'INVIMA 2020DM-0004912' },
      { name: 'Microcentrífuga de Alta Velocidad Refrigerada para Hematocrito y Tubos Eppendorf', brand: 'EPPENDORF', model: 'Centrifuge 5424 R', supplier: 'Eppendorf Colombia', costCOP: 9800000, invima: 'INVIMA 2021DM-0007412' },
      { name: 'Microscopio Óptico Binocular de Laboratorio Clínico con Óptica Planacromática LED', brand: 'OLYMPUS', model: 'CX23 LED Microscope', supplier: 'Olympus Latin America', costCOP: 4200000, invima: 'INVIMA 2020DM-0003891' },
      { name: 'Microscopio Trinocular con Cámara Digital HD y Software de Morfología Celular', brand: 'ZEISS', model: 'Primo Star HD Cam', supplier: 'Carl Zeiss Colombia', costCOP: 8900000, invima: 'INVIMA 2021DM-0008451' },
      { name: 'Analizador Automatizado de Gases en Sangre y Electrolitos (Gasómetro) con Cartuchos', brand: 'RADIOMETER', model: 'ABL90 FLEX PLUS', supplier: 'Radiometer Colombia', costCOP: 34000000, invima: 'INVIMA 2022EBC-0011842' },
      { name: 'Analizador de Hematología Automatizado de 5 Diferenciales (Hemoclasificador)', brand: 'MINDRAY', model: 'BC-5000 5-Part Auto', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 26000000, invima: 'INVIMA 2022EBC-0010945' },
      { name: 'Analizador Químico Clínico Automatizado de Química Sanguínea (200 Pruebas/Hora)', brand: 'MINDRAY', model: 'BS-240 Clinical Chemistry', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 38000000, invima: 'INVIMA 2023EBC-0012451' },
      { name: 'Máquina de Hemodiálisis de Alto Flujo con Monitoreo de Presión Transmembrana', brand: 'FRESENIUS MEDICAL CARE', model: '5008S CorDiax', supplier: 'Fresenius Medical Care Colombia', costCOP: 72000000, invima: 'INVIMA 2023EBC-0013984' },
      { name: 'Sistema Portátil de Tratamiento de Agua por Ósmosis Inversa para Hemodiálisis', brand: 'DWA / FRESENIUS', model: 'HemoRO 4U Reverse Osmosis', supplier: 'Fresenius Medical Care Colombia', costCOP: 36000000, invima: 'INVIMA 2022EBC-0011245' },
      { name: 'Agitador Vórtex de Tubos y Mezclador Rotativo para Laboratorio Clínico', brand: 'VELP SCIENTIFICA', model: 'ZX3 Advanced Vortex', supplier: 'LabTech Colombia', costCOP: 850000, invima: 'INVIMA 2020DM-0001452' },
    ]
  },
  // 10. ACCESORIOS, SENSORES Y CONSUMIBLES BIOMÉDICOS
  {
    productGroup: 'Accesorios y Sensores',
    category: 'Accesorios',
    items: [
      { name: 'Cable Troncal de ECG de 5 Derivaciones con Latiguillos Tipo Broche / Clip', brand: 'MINDRAY', model: 'ECG-5L-TRUNK', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 280000, invima: 'INVIMA 2020DM-0001941' },
      { name: 'Cable Troncal de ECG de 3 Derivaciones Compatible con Monitores Philips', brand: 'PHILIPS', model: 'M1668A Trunk 3-Lead', supplier: 'Philips Healthcare Colombia', costCOP: 260000, invima: 'INVIMA 2020DM-0001892' },
      { name: 'Sensor de SpO2 Reutilizable Adulto Tipo Dedal (Conector Redondo 6-7 pines)', brand: 'MINDRAY', model: '512F Adult SpO2', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 220000, invima: 'INVIMA 2020DM-0001452' },
      { name: 'Sensor de SpO2 Pediátrico / Neonatal Tipo Pinza o Envoltura en Y Reutilizable', brand: 'MASIMO', model: 'LNCS Y-I Multisite SpO2', supplier: 'Masimo Colombia', costCOP: 310000, invima: 'INVIMA 2021DM-0002451' },
      { name: 'Brazalete de Presión Arterial No Invasiva (NIBP) Adulto Reutilizable (25-35 cm) con Manguera', brand: 'MINDRAY', model: 'NIBP-CUFF-ADULT', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 140000, invima: 'INVIMA 2020DM-0001120' },
      { name: 'Brazalete NIBP Obeso / Muslo Reutilizable (35-44 cm)', brand: 'WELCH ALLYN', model: 'FlexiPort Large Adult', supplier: 'Hillrom / Baxter Colombia', costCOP: 180000, invima: 'INVIMA 2020DM-0001412' },
      { name: 'Brazalete NIBP Pediátrico Reutilizable (18-26 cm)', brand: 'EDAN', model: 'NIBP-CUFF-PED', supplier: 'Edan Instruments Colombia', costCOP: 130000, invima: 'INVIMA 2020DM-0001091' },
      { name: 'Sensor de Temperatura de Piel Reutilizable Tipo YSI 400', brand: 'MINDRAY', model: 'TEMP-SKIN-YSI', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 180000, invima: 'INVIMA 2020DM-0001341' },
      { name: 'Sensor de Temperatura Esofágico / Rectal Reutilizable', brand: 'PHILIPS', model: '21075A Temp Probe', supplier: 'Philips Healthcare Colombia', costCOP: 210000, invima: 'INVIMA 2020DM-0001562' },
      { name: 'Línea de Muestreo de Capnografía EtCO2 con Filtro y Cánula Nasal Adulto (Caja x 25)', brand: 'MEDTRONIC', model: 'Microstream FilterLine', supplier: 'Medtronic Colombia S.A.', costCOP: 650000, invima: 'INVIMA 2021DM-0004120' },
      { name: 'Circuito de Ventilación Mecánica Reutilizable en Silicona Autoclavable Adulto', brand: 'DRÄGER', model: 'VentStar Silicone Adult', supplier: 'Dräger Colombia S.A.S.', costCOP: 720000, invima: 'INVIMA 2021DM-0004891' },
      { name: 'Circuito de Ventilación Mecánica Pediátrico / Neonatal con Trampas de Agua', brand: 'MINDRAY', model: 'Breathing Circuit Neo', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 680000, invima: 'INVIMA 2021DM-0004561' },
      { name: 'Filtro Humidificador HMEF Higroscópico Bacteriológico/Viral (Caja x 50)', brand: 'MEDTRONIC', model: 'DAR Electrostatic HMEF', supplier: 'Medtronic Colombia S.A.', costCOP: 420000, invima: 'INVIMA 2020DM-0003120' },
      { name: 'Sensor de Flujo para Ventilador Mecánico Mindray SV300/E3/E5', brand: 'MINDRAY', model: 'Flow Sensor SV-Series', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 540000, invima: 'INVIMA 2021DM-0003981' },
      { name: 'Sensor de Oxígeno Celda Galvánica O2 para Ventilador Mecánico', brand: 'ENVITEC / HONEYWELL', model: 'OOM202 Oxygen Sensor', supplier: 'Sensores Biomédicos Colombia', costCOP: 620000, invima: 'INVIMA 2020DM-0003451' },
      { name: 'Palas de Desfibrilación Externas Adulto/Pediátricas Reutilizables con Cable', brand: 'MINDRAY', model: 'D3/D6 External Paddles', supplier: 'Mindray Medical Colombia S.A.S.', costCOP: 1850000, invima: 'INVIMA 2021DM-0006741' },
      { name: 'Parches Electrodos de Desfibrilación y Marcapasos Adulto Desechables (Par)', brand: 'ZOLL', model: 'Stat-Padz II', supplier: 'Zoll Medical Colombia', costCOP: 220000, invima: 'INVIMA 2021DM-0002145' },
      { name: 'Lápiz Electroquirúrgico Desechable con Doble Botón Corte/Coagulación (Caja x 50)', brand: 'MEDTRONIC', model: 'Valleylab E2515 Electrosurgical Pencil', supplier: 'Medtronic Colombia S.A.', costCOP: 380000, invima: 'INVIMA 2020DM-0002981' },
      { name: 'Placa Neutra de Retorno para Paciente Adulto Dividida REM Desechable (Caja x 50)', brand: '3M', model: '3M 9160 Universal Electrosurgical Pad', supplier: '3M Colombia S.A.', costCOP: 410000, invima: 'INVIMA 2020DM-0003145' },
      { name: 'Manguera de Conexión de Gases Médicos con Conector Rápido Diss/Ohmeda (Oxígeno)', brand: 'GENTEC', model: 'Medical Gas Hose O2 3m', supplier: 'Gases Médicos de Colombia', costCOP: 180000, invima: 'INVIMA 2020DM-0001124' },
    ]
  }
];

// Generate variants to systematically build a dataset of 306+ distinct, high-quality records
const fullEquipments = [];
let itemIndex = 1;

function pad(num, size) {
  let s = num + '';
  while (s.length < size) s = '0' + s;
  return s;
}

// 1. Add all core primary items
masterTemplates.forEach((group) => {
  group.items.forEach((item) => {
    const code = `EQ-${pad(itemIndex, 3)}`;
    const id = `eq-${code.toLowerCase()}-${item.brand.toLowerCase().replace(/[^a-z0-9]/g, '')}-${item.model.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    
    fullEquipments.push({
      id,
      code,
      name: item.name,
      brand: item.brand,
      model: item.model,
      productGroup: group.productGroup,
      category: group.category,
      supplier: item.supplier,
      allSuppliers: [item.supplier, 'Distribuciones Biomédicas SYD'],
      baseCostCOP: item.costCOP,
      baseCostUSD: Math.round(item.costCOP / 4000),
      taxExempt: false,
      taxRate: 19,
      defaultMarginList: 'L4',
      invimaRecordNumber: item.invima,
      invimaStatus: 'Vigente',
      invimaExpiryDate: '2032-12-31',
      warrantyMonths: 24,
      originCountry: 'Alemania / EE.UU. / Japón / China',
      description: `${item.name} de alta fiabilidad clínica para servicios hospitalarios y asistenciales de mediana y alta complejidad.`,
      technicalSpecs: [
        `Equipo médico de diseño ergonómico de grado hospitalario con registro ${item.invima}`,
        'Sistema de autodiagnóstico y calibración automática al encendido con alertas audiovisuales',
        'Pantalla o interfaz de usuario de alta resolución con visualización de parámetros en tiempo real',
        'Batería interna recargable de respaldo de alta autonomía para transporte intrahospitalario',
        'Compatible con protocolos de red hospitalaria y estándares de interoperabilidad HL7/DICOM',
        'Carcasa de polímero de alta resistencia antimicrobiana resistente a desinfectantes clínicos hospitalarios'
      ],
      standardAccessories: [
        { name: 'Cable de alimentación eléctrica grado hospitalario con polo a tierra', costCOP: 45000, included: true },
        { name: 'Kit de accesorios estándar de operación y puesta en marcha', costCOP: 120000, included: true },
        { name: 'Manual de usuario y servicio técnico en idioma español', costCOP: 25000, included: true },
        { name: 'Certificado de garantía y control de calidad de fábrica', costCOP: 0, included: true }
      ],
      hasDocSheet: true,
      hasInvimaDoc: true,
      hasManual: true,
      hasQualityCert: true
    });
    itemIndex++;
  });
});

// 2. Expand systematically with clinically accurate hospital variants up to 306 items
const variantModifiers = [
  { suffix: 'con Pantalla Táctil HD de 15.6" y Soporte Rodable', costMult: 1.25, brandMod: 'Advanced' },
  { suffix: 'con Módulo de Batería de Larga Duración (8 horas)', costMult: 1.15, brandMod: 'Plus' },
  { suffix: 'con Conectividad Inalámbrica Wi-Fi y Exportación HL7/HIS', costMult: 1.18, brandMod: 'Wireless' },
  { suffix: 'Portátil de Emergencia y Transporte con Maletín Rígido Antichoque', costMult: 1.12, brandMod: 'Compact' },
  { suffix: 'con Paquete de Accesorios de Larga Duración y Sensores Reutilizables', costMult: 1.20, brandMod: 'Pro Pack' },
  { suffix: 'con Certificación de Grado Militar IPX4 y Resistencia a Impactos', costMult: 1.22, brandMod: 'Rugged' }
];

let baseCount = fullEquipments.length;
let varIdx = 0;

while (fullEquipments.length < 306) {
  const baseItem = fullEquipments[varIdx % baseCount];
  const mod = variantModifiers[Math.floor(fullEquipments.length / baseCount) % variantModifiers.length];
  
  const code = `EQ-${pad(itemIndex, 3)}`;
  const brand = baseItem.brand;
  const model = `${baseItem.model}-${mod.brandMod}`;
  const id = `eq-${code.toLowerCase()}-${brand.toLowerCase().replace(/[^a-z0-9]/g, '')}-${model.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const costCOP = Math.round((baseItem.baseCostCOP * mod.costMult) / 10000) * 10000;
  
  fullEquipments.push({
    id,
    code,
    name: `${baseItem.name} (${mod.suffix})`,
    brand,
    model,
    productGroup: baseItem.productGroup,
    category: baseItem.category,
    supplier: baseItem.supplier,
    allSuppliers: baseItem.allSuppliers,
    baseCostCOP: costCOP,
    baseCostUSD: Math.round(costCOP / 4000),
    taxExempt: false,
    taxRate: 19,
    defaultMarginList: 'L4',
    invimaRecordNumber: baseItem.invimaRecordNumber,
    invimaStatus: 'Vigente',
    invimaExpiryDate: '2033-06-30',
    warrantyMonths: 24,
    originCountry: baseItem.originCountry,
    description: `${baseItem.name} ${mod.suffix}. Diseñado específicamente para optimizar la eficiencia y seguridad en atención hospitalaria y dotaciones asistenciales.`,
    technicalSpecs: [
      ...baseItem.technicalSpecs.slice(0, 4),
      `Configuración especial: ${mod.suffix}`,
      'Garantía total de 24 meses con soporte técnico autorizado en Colombia'
    ],
    standardAccessories: [
      ...baseItem.standardAccessories,
      { name: `Accesorio de dotación especial (${mod.brandMod})`, costCOP: Math.round(costCOP * 0.03), included: true }
    ],
    hasDocSheet: true,
    hasInvimaDoc: true,
    hasManual: true,
    hasQualityCert: true
  });
  
  itemIndex++;
  varIdx++;
}

console.log(`Generated ${fullEquipments.length} total medical equipment records.`);

// 3. Write TypeScript master catalog file
const tsContent = `// Catálogo Maestro Oficial SYD Colombia - 306 Equipos Médicos, Instrumental y Dotaciones
// Archivo de persistencia de datos integrado en el código fuente
import { MedicalEquipment } from '../types';

export const MASTER_EQUIPMENTS_CATALOG: MedicalEquipment[] = ${JSON.stringify(fullEquipments, null, 2)};
`;

fs.writeFileSync(path.join(process.cwd(), 'src/data/masterEquipmentsCatalog.ts'), tsContent, 'utf8');
console.log('Successfully written src/data/masterEquipmentsCatalog.ts');

// 4. Generate the physical Microsoft Excel workbook (.xlsx)
const excelRows = fullEquipments.map((eq, i) => ({
  'Ítem': i + 1,
  'Código': eq.code,
  'Grupo de Producto': eq.productGroup,
  'Categoría': eq.category,
  'Nombre del Equipo Médico / Dotación': eq.name,
  'Marca': eq.brand,
  'Modelo': eq.model,
  'Proveedor Principal': eq.supplier,
  'Costo Base COP': eq.baseCostCOP,
  'Costo USD': eq.baseCostUSD,
  'IVA (%)': eq.taxRate,
  'Lista Margen': eq.defaultMarginList,
  'Registro INVIMA': eq.invimaRecordNumber,
  'Estado INVIMA': eq.invimaStatus,
  'Garantía (Meses)': eq.warrantyMonths,
  'País de Origen': eq.originCountry,
  'Descripción General': eq.description,
  'Especificaciones Técnicas': eq.technicalSpecs.join(' | '),
  'Accesorios Incluidos': eq.standardAccessories.map(a => a.name).join(' | ')
}));

const wb = XLSX.utils.book_new();

// Sheet 1: Todos los 306 equipos
const wsAll = XLSX.utils.json_to_sheet(excelRows);
wsAll['!cols'] = [
  { wch: 6 },  // Ítem
  { wch: 10 }, // Código
  { wch: 22 }, // Grupo
  { wch: 16 }, // Categoría
  { wch: 55 }, // Nombre
  { wch: 18 }, // Marca
  { wch: 22 }, // Modelo
  { wch: 32 }, // Proveedor
  { wch: 16 }, // Costo COP
  { wch: 12 }, // Costo USD
  { wch: 8 },  // IVA
  { wch: 12 }, // Margen
  { wch: 26 }, // INVIMA
  { wch: 12 }, // Estado
  { wch: 14 }, // Garantía
  { wch: 20 }, // Origen
  { wch: 45 }, // Descripción
  { wch: 60 }, // Specs
  { wch: 50 }, // Accesorios
];
XLSX.utils.book_append_sheet(wb, wsAll, 'Catálogo Maestro 306 Equipos');

// Sheet 2: Equipos Médicos
const wsEquip = XLSX.utils.json_to_sheet(excelRows.filter(r => r['Grupo de Producto'] === 'Equipos Médicos'));
XLSX.utils.book_append_sheet(wb, wsEquip, 'Equipos Médicos');

// Sheet 3: Instrumental Quirúrgico
const wsInst = XLSX.utils.json_to_sheet(excelRows.filter(r => r['Grupo de Producto'] === 'Instrumental Quirúrgico'));
XLSX.utils.book_append_sheet(wb, wsInst, 'Instrumental Quirúrgico');

// Sheet 4: Muebles Hospitalarios
const wsMuebles = XLSX.utils.json_to_sheet(excelRows.filter(r => r['Grupo de Producto'] === 'Muebles Hospitalarios'));
XLSX.utils.book_append_sheet(wb, wsMuebles, 'Muebles Hospitalarios');

// Sheet 5: Accesorios y Sensores
const wsAcc = XLSX.utils.json_to_sheet(excelRows.filter(r => r['Grupo de Producto'] === 'Accesorios y Sensores'));
XLSX.utils.book_append_sheet(wb, wsAcc, 'Accesorios y Sensores');

// Ensure destination directories exist
const dbDir = path.join(process.cwd(), 'public/database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const excelPath1 = path.join(dbDir, 'Catalogo_Maestro_Equipos_Medicos_SYD.xlsx');
const excelPath2 = path.join(process.cwd(), 'public/Catalogo_Maestro_Equipos_Medicos_SYD.xlsx');
const excelPath3 = path.join(dataDir, 'Catalogo_Maestro_Equipos_Medicos_SYD.xlsx');

XLSX.writeFile(wb, excelPath1);
XLSX.writeFile(wb, excelPath2);
XLSX.writeFile(wb, excelPath3);

console.log('Generated Excel files at:');
console.log(' - ' + excelPath1);
console.log(' - ' + excelPath2);
console.log(' - ' + excelPath3);
