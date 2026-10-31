import fs from 'fs';
import path from 'path';

const outDir = path.join(process.cwd(), 'public', 'assets', 'products', 'neopuff');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. Chassis front closeup
const chassisFrontSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450">
  <defs>
    <linearGradient id="cfBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="unitGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="15%" stop-color="#0ea5e9"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
    <filter id="shadowCf" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="8" stdDeviation="8" flood-opacity="0.4"/>
    </filter>
  </defs>
  <rect width="600" height="450" rx="16" fill="url(#cfBg)"/>
  
  <!-- Neopuff Main Console Frontal -->
  <g filter="url(#shadowCf)" transform="translate(130, 40)">
    <!-- Chassis Outer Shell -->
    <rect width="340" height="340" rx="28" fill="url(#unitGrad)" stroke="#38bdf8" stroke-width="2"/>
    <!-- Medical White Front Face -->
    <rect x="16" y="16" width="308" height="308" rx="20" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>

    <!-- Header Logo -->
    <text x="170" y="48" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="900" fill="#0369a1" text-anchor="middle" letter-spacing="1.5">Fisher &amp; Paykel</text>
    <text x="170" y="66" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="700" fill="#64748b" text-anchor="middle" letter-spacing="3">HEALTHCARE</text>
    <rect x="50" y="74" width="240" height="1.5" fill="#e2e8f0"/>

    <!-- Precision Manometer Large Center (0 to 60 cmH2O) -->
    <circle cx="170" cy="165" r="72" fill="#cbd5e1" stroke="#94a3b8" stroke-width="3"/>
    <circle cx="170" cy="165" r="66" fill="#ffffff" stroke="#1e293b" stroke-width="2"/>

    <!-- Colored Dial Arcs -->
    <!-- Green Safe Zone 0-25 -->
    <path d="M 115 190 A 56 56 0 0 1 170 109" fill="none" stroke="#16a34a" stroke-width="6"/>
    <!-- Yellow Caution 25-40 -->
    <path d="M 170 109 A 56 56 0 0 1 217 146" fill="none" stroke="#eab308" stroke-width="6"/>
    <!-- Red Danger 40-60 -->
    <path d="M 217 146 A 56 56 0 0 1 225 190" fill="none" stroke="#dc2626" stroke-width="6"/>

    <!-- Gauge Calibration Numbers -->
    <text x="116" y="196" font-family="monospace" font-size="10" font-weight="bold" fill="#1e293b">0</text>
    <text x="122" y="148" font-family="monospace" font-size="10" font-weight="bold" fill="#1e293b">10</text>
    <text x="162" y="126" font-family="monospace" font-size="11" font-weight="bold" fill="#1e293b">20</text>
    <text x="202" y="148" font-family="monospace" font-size="10" font-weight="bold" fill="#1e293b">40</text>
    <text x="216" y="196" font-family="monospace" font-size="10" font-weight="bold" fill="#1e293b">60</text>
    <text x="170" y="192" font-family="system-ui, sans-serif" font-size="8.5" font-weight="bold" fill="#64748b" text-anchor="middle">mbar / cmH₂O</text>

    <!-- Red Pointer Needle -->
    <line x1="170" y1="165" x2="168" y2="120" stroke="#dc2626" stroke-width="3" stroke-linecap="round"/>
    <circle cx="170" cy="165" r="6" fill="#0f172a"/>
    <circle cx="170" cy="165" r="2.5" fill="#ffffff"/>

    <!-- Knobs and Ports -->
    <!-- Left: Max Pressure Relief Knob -->
    <g transform="translate(68, 268)">
      <circle cx="0" cy="0" r="26" fill="#0284c7" stroke="#0369a1" stroke-width="2.5"/>
      <circle cx="0" cy="0" r="20" fill="#38bdf8"/>
      <rect x="-3" y="-18" width="6" height="36" rx="2" fill="#ffffff"/>
      <text x="0" y="38" font-family="system-ui, sans-serif" font-size="8.5" font-weight="bold" fill="#0369a1" text-anchor="middle">MAX RELIEF</text>
    </g>

    <!-- Right: Peak Inspiratory Pressure (PIP) Knob -->
    <g transform="translate(272, 268)">
      <circle cx="0" cy="0" r="26" fill="#0284c7" stroke="#0369a1" stroke-width="2.5"/>
      <circle cx="0" cy="0" r="20" fill="#38bdf8"/>
      <rect x="-18" y="-3" width="36" height="6" rx="2" fill="#ffffff"/>
      <text x="0" y="38" font-family="system-ui, sans-serif" font-size="8.5" font-weight="bold" fill="#0369a1" text-anchor="middle">PIP CONTROL</text>
    </g>

    <!-- Center Connectors -->
    <g transform="translate(170, 275)">
      <rect x="-32" y="0" width="26" height="24" rx="4" fill="#64748b"/>
      <circle cx="-19" cy="12" r="6" fill="#334155"/>
      <text x="-19" y="34" font-family="system-ui, sans-serif" font-size="7" font-weight="bold" fill="#475569" text-anchor="middle">GAS IN</text>

      <rect x="6" y="0" width="26" height="24" rx="4" fill="#0284c7"/>
      <circle cx="19" cy="12" r="6" fill="#0369a1"/>
      <text x="19" y="34" font-family="system-ui, sans-serif" font-size="7" font-weight="bold" fill="#0284c7" text-anchor="middle">OUTLET</text>
    </g>
  </g>

  <!-- Bottom Spec Label -->
  <rect x="50" y="400" width="500" height="32" rx="6" fill="#1e293b" stroke="#334155"/>
  <text x="300" y="421" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#38bdf8" text-anchor="middle">CONSOLA FRONTAL CON MANÓMETRO ANÁLOGO Y PERILLAS PIP / PEEP</text>
</svg>`;

// 2. Neonatal Resuscitation Table / Procedure
const neonatalTableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450">
  <defs>
    <linearGradient id="ntBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f0f9ff"/>
      <stop offset="100%" stop-color="#e0f2fe"/>
    </linearGradient>
    <filter id="ntShadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="6" stdDeviation="6" flood-opacity="0.2"/>
    </filter>
  </defs>
  <rect width="600" height="450" rx="16" fill="url(#ntBg)"/>

  <!-- Radiant Warmer / Resuscitaire Structure -->
  <g transform="translate(150, 40)" filter="url(#ntShadow)">
    <!-- Overhead Heating Element Bar -->
    <rect x="40" y="10" width="220" height="28" rx="6" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
    <rect x="60" y="34" width="180" height="8" rx="3" fill="#f97316"/>
    <!-- Radiant Heat Glow Lines -->
    <path d="M 80 46 L 80 140 M 120 46 L 120 140 M 150 46 L 150 140 M 180 46 L 180 140 M 220 46 L 220 140" stroke="#fdba74" stroke-width="1.5" stroke-dasharray="4,4"/>

    <!-- Support Vertical Columns -->
    <rect x="250" y="38" width="16" height="300" rx="4" fill="#cbd5e1" stroke="#94a3b8"/>
    <rect x="34" y="38" width="16" height="300" rx="4" fill="#cbd5e1" stroke="#94a3b8"/>

    <!-- Bassinet / Mattress Area -->
    <rect x="40" y="150" width="220" height="40" rx="8" fill="#ffffff" stroke="#38bdf8" stroke-width="2"/>
    <!-- Acrylic Transparent Side Guards -->
    <rect x="40" y="125" width="220" height="25" fill="#e0f2fe" fill-opacity="0.6" stroke="#7dd3fc" stroke-width="1.5"/>

    <!-- Infant Simulation / Baby Patient Silhouette -->
    <ellipse cx="150" cy="142" rx="42" ry="14" fill="#fed7aa"/>
    <circle cx="180" cy="138" r="12" fill="#fed7aa"/>
    <!-- Blue Baby Swaddle Wrap -->
    <path d="M 115 138 C 115 130, 165 130, 165 146 C 165 155, 115 155, 115 138 Z" fill="#93c5fd"/>

    <!-- Neopuff RD900 Unit Mounted on Side Column -->
    <g transform="translate(254, 110)">
      <rect x="14" y="0" width="85" height="95" rx="8" fill="#0284c7" stroke="#0369a1" stroke-width="1.5"/>
      <rect x="18" y="4" width="77" height="87" rx="6" fill="#ffffff"/>
      <text x="56" y="18" font-family="system-ui, sans-serif" font-size="6" font-weight="bold" fill="#0369a1" text-anchor="middle">NEOPUFF RD900</text>
      <circle cx="56" cy="46" r="22" fill="#e2e8f0" stroke="#0f172a" stroke-width="1"/>
      <line x1="56" y1="46" x2="56" y2="30" stroke="#dc2626" stroke-width="1.5"/>
      <!-- T-Piece Hose extending to baby mask -->
      <path d="M 40 85 C 20 120, -40 130, -75 138" fill="none" stroke="#38bdf8" stroke-width="4" stroke-dasharray="2,2"/>
      <circle cx="-75" cy="138" r="7" fill="#ffffff" stroke="#0284c7" stroke-width="1.5"/>
    </g>

    <!-- Trolley Base & Wheels -->
    <rect x="20" y="338" width="260" height="20" rx="4" fill="#64748b"/>
    <circle cx="45" cy="368" r="14" fill="#334155"/>
    <circle cx="255" cy="368" r="14" fill="#334155"/>
  </g>

  <!-- Title Badge -->
  <rect x="40" y="395" width="520" height="35" rx="8" fill="#0369a1"/>
  <text x="300" y="417" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">REANIMADOR INFANTIL NEOPUFF RD900 EN MESA DE PARTO / RESUSCITAIRE</text>
</svg>`;

// 3. Mobile Stand
const mobileStandSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450">
  <defs>
    <linearGradient id="msBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f1f5f9"/>
    </linearGradient>
    <filter id="msShadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="2" dy="5" stdDeviation="5" flood-opacity="0.2"/>
    </filter>
  </defs>
  <rect width="600" height="450" rx="16" fill="url(#msBg)"/>

  <!-- Stand Assembly -->
  <g transform="translate(230, 25)" filter="url(#msShadow)">
    <!-- Heavy Chrome Pole -->
    <rect x="65" y="40" width="18" height="320" rx="4" fill="#94a3b8" stroke="#64748b"/>
    <rect x="70" y="40" width="5" height="320" fill="#ffffff" fill-opacity="0.7"/>

    <!-- Mounted Blender Unit (Above Neopuff) -->
    <rect x="45" y="45" width="58" height="42" rx="6" fill="#e2e8f0" stroke="#0284c7" stroke-width="1.5"/>
    <text x="74" y="62" font-family="system-ui, sans-serif" font-size="7" font-weight="bold" fill="#0284c7" text-anchor="middle">O₂/AIR BLENDER</text>
    <circle cx="74" cy="74" r="8" fill="#38bdf8"/>

    <!-- Neopuff RD900 Mounted Unit -->
    <g transform="translate(10, 95)">
      <rect width="128" height="130" rx="14" fill="#0284c7" stroke="#0369a1" stroke-width="2"/>
      <rect x="8" y="8" width="112" height="114" rx="10" fill="#ffffff"/>
      <text x="64" y="24" font-family="system-ui, sans-serif" font-size="8" font-weight="bold" fill="#0369a1" text-anchor="middle">Fisher &amp; Paykel RD900</text>
      <!-- Manometer -->
      <circle cx="64" cy="62" r="30" fill="#cbd5e1" stroke="#334155" stroke-width="1.5"/>
      <circle cx="64" cy="62" r="26" fill="#ffffff"/>
      <path d="M 46 72 A 20 20 0 0 1 64 42" fill="none" stroke="#16a34a" stroke-width="3"/>
      <path d="M 64 42 A 20 20 0 0 1 82 72" fill="none" stroke="#dc2626" stroke-width="3"/>
      <line x1="64" y1="62" x2="63" y2="44" stroke="#dc2626" stroke-width="2"/>
      <!-- Knobs -->
      <circle cx="32" cy="104" r="10" fill="#0284c7"/>
      <circle cx="96" cy="104" r="10" fill="#0284c7"/>
    </g>

    <!-- Medical Gas Cylinders on Rear Bracket -->
    <!-- Green O2 Cylinder -->
    <rect x="-35" y="160" width="35" height="170" rx="12" fill="#16a34a" stroke="#15803d" stroke-width="2"/>
    <rect x="-28" y="145" width="20" height="18" rx="4" fill="#cbd5e1"/>
    <text x="-18" y="240" font-family="system-ui, sans-serif" font-size="10" font-weight="bold" fill="#ffffff" transform="rotate(-90 -18 240)">OXYGEN O₂</text>

    <!-- Yellow / Black Air Cylinder -->
    <rect x="148" y="160" width="35" height="170" rx="12" fill="#eab308" stroke="#ca8a04" stroke-width="2"/>
    <rect x="155" y="145" width="20" height="18" rx="4" fill="#cbd5e1"/>
    <text x="165" y="240" font-family="system-ui, sans-serif" font-size="10" font-weight="bold" fill="#0f172a" transform="rotate(-90 165 240)">MEDICAL AIR</text>

    <!-- Wire Storage Basket for Circuits -->
    <rect x="25" y="245" width="98" height="45" rx="4" fill="none" stroke="#64748b" stroke-width="2"/>
    <line x1="25" y1="260" x2="123" y2="260" stroke="#94a3b8" stroke-width="1"/>
    <line x1="25" y1="275" x2="123" y2="275" stroke="#94a3b8" stroke-width="1"/>

    <!-- 5-Star Rolling Base & Casters -->
    <g transform="translate(74, 360)">
      <polygon points="0,-8 75,18 45,26 0,10 -45,26 -75,18" fill="#475569"/>
      <circle cx="-65" cy="24" r="10" fill="#1e293b"/>
      <circle cx="0" cy="18" r="10" fill="#1e293b"/>
      <circle cx="65" cy="24" r="10" fill="#1e293b"/>
    </g>
  </g>

  <!-- Legend -->
  <rect x="40" y="400" width="520" height="32" rx="6" fill="#0f172a"/>
  <text x="300" y="421" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#38bdf8" text-anchor="middle">UNIDAD NEOPUFF RD900 MONTADA EN SOPORTE RODABLE CON MEZCLADOR</text>
</svg>`;

// 4. Clinical Use
const clinicalUseSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450">
  <defs>
    <linearGradient id="cuBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#090d16"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="600" height="450" rx="16" fill="url(#cuBg)"/>

  <!-- Clinical Delivery Room Scene -->
  <!-- Sterile Field Background -->
  <rect x="40" y="60" width="520" height="320" rx="14" fill="#0b1329" stroke="#1e3a8a" stroke-width="2"/>

  <!-- Neopuff RD900 Active Operating Panel -->
  <g transform="translate(65, 90)">
    <rect width="180" height="240" rx="16" fill="#0284c7" stroke="#38bdf8" stroke-width="2"/>
    <rect x="10" y="10" width="160" height="220" rx="12" fill="#f8fafc"/>
    <text x="90" y="32" font-family="system-ui, sans-serif" font-size="11" font-weight="900" fill="#0369a1" text-anchor="middle">Fisher &amp; Paykel</text>
    <text x="90" y="45" font-family="system-ui, sans-serif" font-size="8" font-weight="bold" fill="#64748b" text-anchor="middle">NEOPUFF RD900</text>

    <!-- Active Manometer showing PIP ventilation cycle -->
    <circle cx="90" cy="115" r="48" fill="#e2e8f0" stroke="#0f172a" stroke-width="2"/>
    <circle cx="90" cy="115" r="42" fill="#ffffff"/>
    <path d="M 60 130 A 34 34 0 0 1 90 81" fill="none" stroke="#16a34a" stroke-width="4"/>
    <path d="M 90 81 A 34 34 0 0 1 120 130" fill="none" stroke="#dc2626" stroke-width="4"/>
    <!-- Needle animated to 20 cmH2O -->
    <line x1="90" y1="115" x2="88" y2="84" stroke="#dc2626" stroke-width="3"/>
    <circle cx="90" cy="115" r="5" fill="#1e293b"/>
    <text x="90" y="132" font-family="system-ui, sans-serif" font-size="8" font-weight="bold" fill="#0284c7" text-anchor="middle">20 cmH₂O PIP</text>

    <!-- Gas Out connection -->
    <circle cx="130" cy="190" r="12" fill="#0284c7"/>
  </g>

  <!-- Connected T-Piece and Pediatric Manikin Model -->
  <g transform="translate(260, 120)">
    <!-- Patient Breathing Hose -->
    <path d="M -50 160 C 20 200, 70 120, 120 150" fill="none" stroke="#38bdf8" stroke-width="12" stroke-linecap="round" stroke-dasharray="3,3"/>
    <path d="M -50 160 C 20 200, 70 120, 120 150" fill="none" stroke="#bae6fd" stroke-width="7" stroke-linecap="round"/>

    <!-- Ergonomic T-Piece Resuscitator Head -->
    <g transform="translate(120, 150)">
      <rect x="-10" y="-18" width="20" height="36" rx="5" fill="#0284c7" stroke="#ffffff" stroke-width="1.5"/>
      <!-- Blue PEEP Cap Valve -->
      <rect x="-14" y="-28" width="28" height="12" rx="3" fill="#0369a1"/>
      <circle cx="0" cy="-22" r="4" fill="#38bdf8"/>
      <text x="0" y="-32" font-family="system-ui, sans-serif" font-size="8" font-weight="bold" fill="#38bdf8" text-anchor="middle">PEEP +5</text>

      <!-- Clear Cushion Neonatal Face Mask -->
      <ellipse cx="28" cy="18" rx="24" ry="18" fill="#ffffff" fill-opacity="0.85" stroke="#38bdf8" stroke-width="2"/>
      <ellipse cx="28" cy="18" rx="16" ry="11" fill="#7dd3fc" fill-opacity="0.4"/>

      <!-- Simulated Baby Head & Face Seal -->
      <ellipse cx="50" cy="22" rx="30" ry="24" fill="#fed7aa" fill-opacity="0.8"/>
    </g>

    <!-- Clinical Protocol Indicators -->
    <g transform="translate(40, -10)">
      <rect width="210" height="60" rx="8" fill="#1e293b" stroke="#38bdf8" stroke-width="1"/>
      <text x="12" y="20" font-family="system-ui, sans-serif" font-size="10" font-weight="bold" fill="#38bdf8">PROTOCOLO DE REANIMACIÓN NRP</text>
      <text x="12" y="36" font-family="system-ui, sans-serif" font-size="9" fill="#e2e8f0">· Frecuencia: 40 a 60 ventilaciones/min</text>
      <text x="12" y="50" font-family="system-ui, sans-serif" font-size="9" fill="#4ade80">· PIP Controlado: 20-25 | PEEP: 5 cmH₂O</text>
    </g>
  </g>

  <!-- Bottom Label -->
  <rect x="40" y="395" width="520" height="35" rx="8" fill="#0284c7"/>
  <text x="300" y="417" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">APLICACIÓN CLÍNICA EN REANIMACIÓN NEONATAL Y SALA DE PARTOS</text>
</svg>`;

// 5. Unit 3D Render
const unitRenderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450">
  <defs>
    <linearGradient id="urBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#cbd5e1"/>
    </linearGradient>
    <linearGradient id="body3d" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="60%" stop-color="#0ea5e9"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
    <filter id="shadow3d" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="8" dy="12" stdDeviation="10" flood-opacity="0.3"/>
    </filter>
  </defs>
  <rect width="600" height="450" rx="16" fill="url(#urBg)"/>

  <!-- 3D Isometric View Unit -->
  <g transform="translate(140, 50)" filter="url(#shadow3d)">
    <!-- Side Extrusion (Depth) -->
    <path d="M 280 20 L 325 -5 L 325 245 L 280 270 Z" fill="#0369a1"/>
    <path d="M 20 20 L 65 -5 L 325 -5 L 280 20 Z" fill="#38bdf8"/>

    <!-- Front Face -->
    <rect x="20" y="20" width="260" height="250" rx="14" fill="#ffffff" stroke="#0284c7" stroke-width="3"/>

    <!-- Branding -->
    <text x="150" y="52" font-family="system-ui, sans-serif" font-size="16" font-weight="900" fill="#0369a1" text-anchor="middle">Fisher &amp; Paykel</text>
    <text x="150" y="68" font-family="system-ui, sans-serif" font-size="9" font-weight="bold" fill="#64748b" text-anchor="middle">NEOPUFF RD900</text>

    <!-- Chrome Bezel Manometer -->
    <circle cx="150" cy="140" r="54" fill="#e2e8f0" stroke="#64748b" stroke-width="3"/>
    <circle cx="150" cy="140" r="48" fill="#ffffff" stroke="#1e293b" stroke-width="1.5"/>
    <path d="M 112 160 A 40 40 0 0 1 150 100" fill="none" stroke="#16a34a" stroke-width="4.5"/>
    <path d="M 150 100 A 40 40 0 0 1 188 160" fill="none" stroke="#dc2626" stroke-width="4.5"/>
    <line x1="150" y1="140" x2="148" y2="108" stroke="#dc2626" stroke-width="2.5"/>
    <circle cx="150" cy="140" r="4" fill="#1e293b"/>

    <!-- Knobs -->
    <circle cx="70" cy="220" r="22" fill="#0284c7" stroke="#0369a1" stroke-width="2"/>
    <circle cx="70" cy="220" r="16" fill="#38bdf8"/>
    <circle cx="230" cy="220" r="22" fill="#0284c7" stroke="#0369a1" stroke-width="2"/>
    <circle cx="230" cy="220" r="16" fill="#38bdf8"/>

    <!-- Bottom Ports -->
    <rect x="135" y="240" width="30" height="22" rx="4" fill="#64748b"/>
  </g>

  <rect x="40" y="395" width="520" height="35" rx="8" fill="#0369a1"/>
  <text x="300" y="417" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">MODELO TÉCNICO HOSPITALARIO 3D · FISHER &amp; PAYKEL HEALTHCARE</text>
</svg>`;

// 6. Accessories Circuit
const accessoriesCircuitSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450">
  <defs>
    <linearGradient id="acBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
  </defs>
  <rect width="600" height="450" rx="16" fill="url(#acBg)"/>

  <!-- T-Piece Circuit Layout -->
  <g transform="translate(60, 40)">
    <!-- Circuit Tubing Loop -->
    <path d="M 60 120 C 60 50, 240 50, 240 120 C 240 190, 400 190, 400 120" fill="none" stroke="#38bdf8" stroke-width="18" stroke-linecap="round" stroke-dasharray="3,3"/>
    <path d="M 60 120 C 60 50, 240 50, 240 120 C 240 190, 400 190, 400 120" fill="none" stroke="#e0f2fe" stroke-width="12" stroke-linecap="round"/>

    <!-- T-Piece Body with PEEP Dial -->
    <g transform="translate(400, 120)">
      <rect x="-14" y="-24" width="28" height="48" rx="6" fill="#0284c7" stroke="#0369a1" stroke-width="2"/>
      <!-- Blue PEEP Adjustment Cap -->
      <rect x="-18" y="-38" width="36" height="16" rx="4" fill="#0369a1" stroke="#ffffff" stroke-width="1.5"/>
      <circle cx="0" cy="-30" r="5" fill="#38bdf8"/>
      <text x="0" y="-44" font-family="system-ui, sans-serif" font-size="9" font-weight="bold" fill="#0284c7" text-anchor="middle">Válvula PEEP Variable</text>
    </g>

    <!-- Neonatal Test Lung (Pulmón de Prueba) -->
    <g transform="translate(100, 240)">
      <rect x="-12" y="-15" width="24" height="20" rx="4" fill="#64748b"/>
      <!-- Test Lung Balloon / Bellows -->
      <path d="M -25 5 C -35 25, -25 75, 0 85 C 25 75, 35 25, 25 5 Z" fill="#38bdf8" fill-opacity="0.8" stroke="#0284c7" stroke-width="2"/>
      <text x="0" y="105" font-family="system-ui, sans-serif" font-size="10" font-weight="bold" fill="#0369a1" text-anchor="middle">Pulmón de Prueba Calibrado</text>
    </g>

    <!-- Neonatal Mask Sizes (00, 0, 1) -->
    <g transform="translate(350, 240)">
      <!-- Mask 1 (Small) -->
      <ellipse cx="-70" cy="30" rx="18" ry="14" fill="#ffffff" stroke="#0284c7" stroke-width="2"/>
      <circle cx="-70" cy="30" r="7" fill="#7dd3fc"/>
      <text x="-70" y="60" font-family="system-ui, sans-serif" font-size="8" font-weight="bold" fill="#64748b" text-anchor="middle">Sz 00</text>

      <!-- Mask 2 (Medium) -->
      <ellipse cx="0" cy="30" rx="24" ry="18" fill="#ffffff" stroke="#0284c7" stroke-width="2"/>
      <circle cx="0" cy="30" r="9" fill="#7dd3fc"/>
      <text x="0" y="65" font-family="system-ui, sans-serif" font-size="8" font-weight="bold" fill="#64748b" text-anchor="middle">Sz 0</text>

      <!-- Mask 3 (Large) -->
      <ellipse cx="80" cy="30" rx="28" ry="22" fill="#ffffff" stroke="#0284c7" stroke-width="2"/>
      <circle cx="80" cy="30" r="11" fill="#7dd3fc"/>
      <text x="80" y="70" font-family="system-ui, sans-serif" font-size="8" font-weight="bold" fill="#64748b" text-anchor="middle">Sz 1</text>

      <text x="5" y="98" font-family="system-ui, sans-serif" font-size="10" font-weight="bold" fill="#0284c7" text-anchor="middle">Mascarillas Anatómicas de Silicona</text>
    </g>
  </g>

  <rect x="40" y="395" width="520" height="35" rx="8" fill="#0f172a"/>
  <text x="300" y="417" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#38bdf8" text-anchor="middle">CIRCUITO RESPIRATORIO CON PIEZA EN T, PULMÓN DE PRUEBA Y MASCARILLAS</text>
</svg>`;

// 7. Black Bg Kit
const blackBgKitSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450">
  <defs>
    <radialGradient id="kitGlow" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#020617"/>
    </radialGradient>
    <filter id="kitShadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#38bdf8" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="600" height="450" rx="16" fill="url(#kitGlow)"/>

  <!-- High Contrast Presentation of Full Neopuff Kit -->
  <g transform="translate(180, 50)" filter="url(#kitShadow)">
    <rect width="240" height="240" rx="20" fill="#0284c7" stroke="#38bdf8" stroke-width="2"/>
    <rect x="10" y="10" width="220" height="220" rx="14" fill="#ffffff"/>
    <text x="120" y="38" font-family="system-ui, sans-serif" font-size="14" font-weight="900" fill="#0369a1" text-anchor="middle">Fisher &amp; Paykel</text>
    <text x="120" y="52" font-family="system-ui, sans-serif" font-size="8" font-weight="bold" fill="#64748b" text-anchor="middle">NEOPUFF RD900</text>

    <!-- Manometer -->
    <circle cx="120" cy="115" r="46" fill="#cbd5e1" stroke="#0f172a" stroke-width="2"/>
    <circle cx="120" cy="115" r="40" fill="#ffffff"/>
    <path d="M 90 130 A 32 32 0 0 1 120 83" fill="none" stroke="#16a34a" stroke-width="4"/>
    <path d="M 120 83 A 32 32 0 0 1 150 130" fill="none" stroke="#dc2626" stroke-width="4"/>
    <line x1="120" y1="115" x2="118" y2="86" stroke="#dc2626" stroke-width="2.5"/>
    <circle cx="120" cy="115" r="4" fill="#1e293b"/>

    <!-- Knobs -->
    <circle cx="55" cy="185" r="18" fill="#0284c7"/>
    <circle cx="185" cy="185" r="18" fill="#0284c7"/>
  </g>

  <!-- High-Pressure Supply Hoses on Sides -->
  <path d="M 50 200 C 120 230, 150 280, 200 280" fill="none" stroke="#16a34a" stroke-width="8" stroke-linecap="round"/>
  <path d="M 550 200 C 480 230, 450 280, 400 280" fill="none" stroke="#38bdf8" stroke-width="8" stroke-linecap="round"/>

  <rect x="40" y="395" width="520" height="35" rx="8" fill="#0f172a" stroke="#38bdf8" stroke-width="1"/>
  <text x="300" y="417" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#38bdf8" text-anchor="middle">KIT COMPLETO REANIMADOR NEOPUFF RD900 CON CONEXIONES DE GAS</text>
</svg>`;

// 8. Console Closeup
const consoleCloseupSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450">
  <defs>
    <linearGradient id="ccBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f1f5f9"/>
    </linearGradient>
  </defs>
  <rect width="600" height="450" rx="16" fill="url(#ccBg)"/>

  <!-- Macro Close-up of Manometer & Controls -->
  <g transform="translate(150, 30)">
    <!-- Stainless Bezel Ring -->
    <circle cx="150" cy="160" r="130" fill="#94a3b8" stroke="#475569" stroke-width="4"/>
    <circle cx="150" cy="160" r="120" fill="#cbd5e1"/>
    <circle cx="150" cy="160" r="114" fill="#ffffff" stroke="#0f172a" stroke-width="3"/>

    <!-- Calibrated Dial Arcs -->
    <path d="M 55 210 A 100 100 0 0 1 150 60" fill="none" stroke="#16a34a" stroke-width="8"/>
    <path d="M 150 60 A 100 100 0 0 1 230 135" fill="none" stroke="#eab308" stroke-width="8"/>
    <path d="M 230 135 A 100 100 0 0 1 245 210" fill="none" stroke="#dc2626" stroke-width="8"/>

    <!-- Dial Numbers -->
    <text x="55" y="222" font-family="monospace" font-size="15" font-weight="bold" fill="#0f172a">0</text>
    <text x="68" y="145" font-family="monospace" font-size="15" font-weight="bold" fill="#0f172a">10</text>
    <text x="138" y="90" font-family="monospace" font-size="16" font-weight="bold" fill="#0f172a">20</text>
    <text x="210" y="145" font-family="monospace" font-size="15" font-weight="bold" fill="#0f172a">40</text>
    <text x="232" y="222" font-family="monospace" font-size="15" font-weight="bold" fill="#0f172a">60</text>
    <text x="150" y="210" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#64748b" text-anchor="middle">mbar / cmH₂O</text>

    <!-- Logo on Dial Face -->
    <text x="150" y="130" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#0369a1" text-anchor="middle">Fisher &amp; Paykel</text>

    <!-- Center Hub & Needle -->
    <line x1="150" y1="160" x2="147" y2="78" stroke="#dc2626" stroke-width="4.5" stroke-linecap="round"/>
    <circle cx="150" cy="160" r="10" fill="#0f172a"/>
    <circle cx="150" cy="160" r="4" fill="#ffffff"/>
  </g>

  <rect x="40" y="395" width="520" height="35" rx="8" fill="#0369a1"/>
  <text x="300" y="417" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">PANEL DE CONTROL Y MANÓMETRO ANÁLOGO 0 A 60 MBAR RD900</text>
</svg>`;

const files = [
  { name: 'neopuff_rd900_chassis_front', svg: chassisFrontSvg },
  { name: 'neopuff_rd900_neonatal_table', svg: neonatalTableSvg },
  { name: 'neopuff_rd900_mobile_stand', svg: mobileStandSvg },
  { name: 'neopuff_rd900_clinical_use', svg: clinicalUseSvg },
  { name: 'neopuff_rd900_unit_render', svg: unitRenderSvg },
  { name: 'neopuff_rd900_accessories_circuit', svg: accessoriesCircuitSvg },
  { name: 'neopuff_rd900_black_bg_kit', svg: blackBgKitSvg },
  { name: 'neopuff_rd900_console_closeup', svg: consoleCloseupSvg },
];

for (const f of files) {
  const svgPath = path.join(outDir, `${f.name}.svg`);
  const jpgPath = path.join(outDir, `${f.name}.jpg`);
  fs.writeFileSync(svgPath, f.svg, 'utf8');
  // Write same content or copy to .jpg so if a request asks for .jpg it finds the file!
  fs.writeFileSync(jpgPath, f.svg, 'utf8');
  console.log(`Generated ${f.name}.svg and ${f.name}.jpg`);
}

// Also duplicate kit_white to .jpg
const kitWhiteSvgPath = path.join(outDir, 'neopuff_rd900_kit_white.svg');
const kitWhiteJpgPath = path.join(outDir, 'neopuff_rd900_kit_white.jpg');
if (fs.existsSync(kitWhiteSvgPath)) {
  fs.copyFileSync(kitWhiteSvgPath, kitWhiteJpgPath);
  console.log('Copied neopuff_rd900_kit_white.jpg');
}
