import {
  ThemeSettings,
  CanvasThemeKey,
  AccentColorKey,
  ButtonShapeKey,
  TextColorKey,
  FontFamilyKey,
  FontSizeKey,
} from '../types';

export const THEME_STORAGE_KEY = 'syd_theme_settings_v3';

export const ACCENT_COLOR_MAP: Record<
  AccentColorKey,
  {
    name: string;
    hex: string;
    lightHex: string;
    glow: string;
    textClass: string;
    bgClass: string;
    borderClass: string;
  }
> = {
  sky: {
    name: 'Cian Quirúrgico (Original / Default)',
    hex: '#38bdf8',
    lightHex: '#0284c7',
    glow: 'rgba(56, 189, 248, 0.35)',
    textClass: 'text-sky-400',
    bgClass: 'bg-sky-500',
    borderClass: 'border-sky-500',
  },
  emerald: {
    name: 'Verde Clínico',
    hex: '#10b981',
    lightHex: '#047857',
    glow: 'rgba(16, 185, 129, 0.35)',
    textClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500',
    borderClass: 'border-emerald-500',
  },
  indigo: {
    name: 'Índigo Ejecutivo',
    hex: '#6366f1',
    lightHex: '#4338ca',
    glow: 'rgba(99, 102, 241, 0.35)',
    textClass: 'text-indigo-400',
    bgClass: 'bg-indigo-500',
    borderClass: 'border-indigo-500',
  },
  violet: {
    name: 'Violeta Bio-Tech',
    hex: '#a855f7',
    lightHex: '#7e22ce',
    glow: 'rgba(168, 85, 247, 0.35)',
    textClass: 'text-purple-400',
    bgClass: 'bg-purple-500',
    borderClass: 'border-purple-500',
  },
  amber: {
    name: 'Ámbar Hospitalario',
    hex: '#f59e0b',
    lightHex: '#b45309',
    glow: 'rgba(245, 158, 11, 0.35)',
    textClass: 'text-amber-400',
    bgClass: 'bg-amber-500',
    borderClass: 'border-amber-500',
  },
  rose: {
    name: 'Rosa Neon Vital',
    hex: '#f43f5e',
    lightHex: '#be123c',
    glow: 'rgba(244, 63, 94, 0.35)',
    textClass: 'text-rose-400',
    bgClass: 'bg-rose-500',
    borderClass: 'border-rose-500',
  },
  cyan: {
    name: 'Turquesa Láser',
    hex: '#06b6d4',
    lightHex: '#0e7490',
    glow: 'rgba(6, 182, 212, 0.35)',
    textClass: 'text-cyan-400',
    bgClass: 'bg-cyan-500',
    borderClass: 'border-cyan-500',
  },
  crimson: {
    name: 'Carmesí Cardiológico',
    hex: '#e11d48',
    lightHex: '#9f1239',
    glow: 'rgba(225, 29, 72, 0.35)',
    textClass: 'text-rose-500',
    bgClass: 'bg-rose-600',
    borderClass: 'border-rose-600',
  },
  gold: {
    name: 'Oro Corporativo',
    hex: '#eab308',
    lightHex: '#a16207',
    glow: 'rgba(234, 179, 8, 0.35)',
    textClass: 'text-yellow-400',
    bgClass: 'bg-yellow-500',
    borderClass: 'border-yellow-500',
  },
  teal: {
    name: 'Aqua Marina',
    hex: '#14b8a6',
    lightHex: '#0f766e',
    glow: 'rgba(20, 184, 166, 0.35)',
    textClass: 'text-teal-400',
    bgClass: 'bg-teal-500',
    borderClass: 'border-teal-500',
  },
  custom: {
    name: 'Color Personalizado',
    hex: '#38bdf8',
    lightHex: '#0284c7',
    glow: 'rgba(56, 189, 248, 0.35)',
    textClass: 'text-[var(--syd-accent)]',
    bgClass: 'bg-[var(--syd-accent)]',
    borderClass: 'border-[var(--syd-accent)]',
  },
};

export const CANVAS_THEME_MAP: Record<
  CanvasThemeKey,
  {
    name: string;
    description: string;
    bodyBg: string;
    cardBg: string;
    cardHover: string;
    sidebarBg: string;
    headerBg: string;
    borderColor: string;
    textPrimary: string;
    textSecondary: string;
    isLight: boolean;
  }
> = {
  navy_dark: {
    name: 'Azul Marino SYD (Original / Default)',
    description: 'Paleta corporativa predeterminada original de alta fidelidad clínica',
    bodyBg: '#0f1a2e',
    cardBg: '#15253d',
    cardHover: '#192b45',
    sidebarBg: '#111c2e',
    headerBg: '#15253d',
    borderColor: '#334d6e',
    textPrimary: '#ffffff',
    textSecondary: '#94a3b8',
    isLight: false,
  },
  midnight_oled: {
    name: 'Midnight OLED',
    description: 'Negro absoluto para máximo contraste en pantallas modernas',
    bodyBg: '#060910',
    cardBg: '#0e1320',
    cardHover: '#151c2e',
    sidebarBg: '#090d16',
    headerBg: '#0e1320',
    borderColor: '#1e293b',
    textPrimary: '#ffffff',
    textSecondary: '#94a3b8',
    isLight: false,
  },
  slate_pro: {
    name: 'Slate Titanio',
    description: 'Gris pizarra neutro elegante, sobrio y descansado',
    bodyBg: '#0f172a',
    cardBg: '#1e293b',
    cardHover: '#28354b',
    sidebarBg: '#0b1120',
    headerBg: '#1e293b',
    borderColor: '#334155',
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    isLight: false,
  },
  emerald_dark: {
    name: 'Esmeralda Quirúrgico',
    description: 'Tonalidades verdes hospitalarias de alta tecnología',
    bodyBg: '#041c18',
    cardBg: '#092e28',
    cardHover: '#0f3d35',
    sidebarBg: '#031411',
    headerBg: '#092e28',
    borderColor: '#134e48',
    textPrimary: '#f0fdf4',
    textSecondary: '#a7f3d0',
    isLight: false,
  },
  purple_night: {
    name: 'Cyber Violeta',
    description: 'Paleta moderna de bio-ingeniería con tonos violeta profundos',
    bodyBg: '#140c24',
    cardBg: '#20133a',
    cardHover: '#2c1a4e',
    sidebarBg: '#0d0718',
    headerBg: '#20133a',
    borderColor: '#3b226b',
    textPrimary: '#faf5ff',
    textSecondary: '#d8b4fe',
    isLight: false,
  },
  sapphire_deep: {
    name: 'Zafiro Profundo',
    description: 'Azul cobalto intenso de alta gama para cotizaciones',
    bodyBg: '#08142c',
    cardBg: '#0f2347',
    cardHover: '#152f5e',
    sidebarBg: '#060f21',
    headerBg: '#0f2347',
    borderColor: '#1d3e75',
    textPrimary: '#f0f9ff',
    textSecondary: '#93c5fd',
    isLight: false,
  },
  crimson_dark: {
    name: 'Carmesí Cardiológico',
    description: 'Rojo vino profundo para medicina crítica y urgencias',
    bodyBg: '#1a080d',
    cardBg: '#2d0f17',
    cardHover: '#3d1620',
    sidebarBg: '#130509',
    headerBg: '#2d0f17',
    borderColor: '#541927',
    textPrimary: '#fff1f2',
    textSecondary: '#fda4af',
    isLight: false,
  },
  carbon_dark: {
    name: 'Carbón Mate',
    description: 'Estética minimalista ultra oscura estilo workstation',
    bodyBg: '#121212',
    cardBg: '#1e1e1e',
    cardHover: '#282828',
    sidebarBg: '#0a0a0a',
    headerBg: '#1e1e1e',
    borderColor: '#2d2d2d',
    textPrimary: '#f5f5f5',
    textSecondary: '#a3a3a3',
    isLight: false,
  },
  amber_dark: {
    name: 'Moca Ámbar',
    description: 'Tonalidades cálidas de café moca y madera refinada',
    bodyBg: '#1c130c',
    cardBg: '#2b1e13',
    cardHover: '#3a291b',
    sidebarBg: '#140d08',
    headerBg: '#2b1e13',
    borderColor: '#4d3623',
    textPrimary: '#fef3c7',
    textSecondary: '#fcd34d',
    isLight: false,
  },
  clean_light: {
    name: 'Blanco Clínico (Modo Claro)',
    description: 'Interfaz luminosa médica de alto contraste para oficinas iluminadas',
    bodyBg: '#f1f5f9',
    cardBg: '#ffffff',
    cardHover: '#f8fafc',
    sidebarBg: '#ffffff',
    headerBg: '#ffffff',
    borderColor: '#cbd5e1',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    isLight: true,
  },
  custom: {
    name: 'Canvas Personalizado',
    description: 'Configurado con tu color hexadecimal preferido',
    bodyBg: '#0f1a2e',
    cardBg: '#15253d',
    cardHover: '#192b45',
    sidebarBg: '#111c2e',
    headerBg: '#15253d',
    borderColor: '#334d6e',
    textPrimary: '#ffffff',
    textSecondary: '#94a3b8',
    isLight: false,
  },
  dark_original: {
    name: 'Azul Marino SYD (Original / Default)',
    description: 'Paleta corporativa predeterminada original de alta fidelidad clínica',
    bodyBg: '#0f1a2e',
    cardBg: '#15253d',
    cardHover: '#192b45',
    sidebarBg: '#111c2e',
    headerBg: '#15253d',
    borderColor: '#334d6e',
    textPrimary: '#ffffff',
    textSecondary: '#94a3b8',
    isLight: false,
  },
  light_modern: {
    name: 'Blanco Clínico Quirófano',
    description: 'Modo claro de alta legibilidad para oficinas iluminadas',
    bodyBg: '#f8fafc',
    cardBg: '#ffffff',
    cardHover: '#f1f5f9',
    sidebarBg: '#ffffff',
    headerBg: '#ffffff',
    borderColor: '#cbd5e1',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    isLight: true,
  },
};

export const FONT_FAMILY_MAP: Record<FontFamilyKey, { name: string; family: string; category: string }> = {
  plus_jakarta: {
    name: 'Plus Jakarta Sans',
    family: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
    category: 'Geométrica Médica (Recomendada)',
  },
  inter: {
    name: 'Inter Pro',
    family: '"Inter", system-ui, -apple-system, sans-serif',
    category: 'Estándar UI',
  },
  outfit: {
    name: 'Outfit Moderna',
    family: '"Outfit", system-ui, -apple-system, sans-serif',
    category: 'Vanguardista',
  },
  montserrat: {
    name: 'Montserrat',
    family: '"Montserrat", system-ui, sans-serif',
    category: 'Proyección & Titulares',
  },
  roboto: {
    name: 'Roboto Institucional',
    family: '"Roboto", Arial, sans-serif',
    category: 'Clásica Corporativa',
  },
  jetbrains_mono: {
    name: 'JetBrains Mono',
    family: '"JetBrains Mono", monospace',
    category: 'Ingeniería & Datos',
  },
  playfair: {
    name: 'Playfair Display',
    family: '"Playfair Display", Georgia, "Times New Roman", serif',
    category: 'Serif Ejecutivo',
  },
  sans: {
    name: 'Plus Jakarta Sans',
    family: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
    category: 'Geométrica Médica (Recomendada)',
  },
  mono: {
    name: 'JetBrains Mono',
    family: '"JetBrains Mono", monospace',
    category: 'Ingeniería & Datos',
  },
  serif: {
    name: 'Playfair Display',
    family: '"Playfair Display", Georgia, "Times New Roman", serif',
    category: 'Serif Ejecutivo',
  },
};

export const BUTTON_SHAPE_MAP: Record<ButtonShapeKey, { name: string; radius: string; label: string; previewClass: string }> = {
  square: {
    name: 'Recto / Sharp',
    radius: '4px',
    label: 'Casi Recto',
    previewClass: 'rounded-xs',
  },
  soft: {
    name: 'Suave / Moderado',
    radius: '8px',
    label: 'Esquinas Suaves',
    previewClass: 'rounded-md',
  },
  rounded: {
    name: 'Redondeado Curvo',
    radius: '14px',
    label: 'Estándar Curvo',
    previewClass: 'rounded-xl',
  },
  pill: {
    name: 'Cápsula / Píldora',
    radius: '9999px',
    label: 'Totalmente Ovalado',
    previewClass: 'rounded-full',
  },
};

export const TEXT_COLOR_MAP: Record<TextColorKey, { name: string; hex: string; desc: string }> = {
  pure_white: {
    name: 'Blanco Puro Ultra Nítido',
    hex: '#ffffff',
    desc: 'Máximo contraste',
  },
  platinum: {
    name: 'Platino Suave / Plata',
    hex: '#e2e8f0',
    desc: 'Descansado y elegante',
  },
  soft_cyan: {
    name: 'Cian Glaciar Suave',
    hex: '#bae6fd',
    desc: 'Tinte médico azulado',
  },
  warm_gold: {
    name: 'Dorado Crema Cálido',
    hex: '#fef08a',
    desc: 'Tinte ámbar suave',
  },
  custom: {
    name: 'Color de Texto Personalizado',
    hex: '#ffffff',
    desc: 'Personalizado',
  },
  white: {
    name: 'Blanco Puro Ultra Nítido',
    hex: '#ffffff',
    desc: 'Máximo contraste',
  },
  slate: {
    name: 'Platino Suave / Plata',
    hex: '#e2e8f0',
    desc: 'Descansado y elegante',
  },
  cyan: {
    name: 'Cian Glaciar Suave',
    hex: '#bae6fd',
    desc: 'Tinte médico azulado',
  },
};

// 100% self-contained High-Fidelity SVG Medical & Corporate Avatars (Zero external URL dependencies, 100% reliable)
const createDetailedSvgAvatar = (
  roleKey: 'doctor' | 'biomedical' | 'engineer' | 'executive' | 'tenders' | 'auditor' | 'surgeon' | 'director',
  bgGradient: [string, string],
  roleText: string
) => {
  const [bg1, bg2] = bgGradient;

  let illustration = '';

  if (roleKey === 'doctor') {
    // Dr. Médico Especialista: Doctor con bata blanca, cuello en V, estetoscopio metálico con diafragma y cruz médica
    illustration = `
      <!-- Medical Cross Badge Top Right -->
      <circle cx="86" cy="22" r="11" fill="#0f172a" opacity="0.6"/>
      <circle cx="86" cy="22" r="9" fill="#0284c7"/>
      <path d="M83.5 22 L88.5 22 M86 19.5 L86 24.5" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>

      <!-- Head & Hair -->
      <circle cx="50" cy="32" r="14" fill="#f8d7bb"/>
      <path d="M36 29 C36 18, 64 18, 64 29 C64 22, 58 19, 50 19 C42 19, 36 22, 36 29 Z" fill="#1e293b"/>
      <path d="M37 26 C41 21, 56 20, 63 26 C61 22, 54 20, 50 20 C44 20, 39 23, 37 26 Z" fill="#334155"/>

      <!-- Neck & Blue Scrub -->
      <path d="M44 43 L56 43 L56 52 L44 52 Z" fill="#f8d7bb"/>
      <polygon points="43,47 57,47 50,56" fill="#0284c7"/>

      <!-- White Lab Coat Body -->
      <path d="M22 84 C22 56, 36 50, 44 48 L50 56 L56 48 C64 50, 78 56, 78 84 Z" fill="#f8fafc"/>
      <path d="M43 48 L49 66 L50 84 L51 66 L57 48" stroke="#cbd5e1" stroke-width="1.2" fill="none"/>
      <polygon points="35,51 44,48 42,66" fill="#e2e8f0"/>
      <polygon points="65,51 56,48 58,66" fill="#e2e8f0"/>

      <!-- Stethoscope: Binaural tubes + Tubing + Chestpiece -->
      <path d="M42 45 C42 54, 40 68, 48 70 C52 70, 56 65, 56 58" fill="none" stroke="#334155" stroke-width="3" stroke-linecap="round"/>
      <path d="M43 44 C44 38, 48 38, 50 42 C52 38, 56 38, 57 44" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
      <circle cx="48" cy="70" r="5" fill="#0f172a"/>
      <circle cx="48" cy="70" r="3.5" fill="#e2e8f0"/>
      <circle cx="48" cy="70" r="1.5" fill="#38bdf8"/>
    `;
  } else if (roleKey === 'biomedical') {
    // Dra. Directora Biomédica: Especialista con bata, insignia ID, ADN y pulso cardíaco
    illustration = `
      <!-- DNA & Pulse Wave Top Right -->
      <circle cx="86" cy="22" r="11" fill="#0f172a" opacity="0.6"/>
      <circle cx="86" cy="22" r="9" fill="#059669"/>
      <path d="M80 22 L83 22 L85 18 L87 26 L89 21 L92 22" stroke="#ffffff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>

      <!-- Hair Style (Ponytail / Brunette) -->
      <path d="M34 32 C34 16, 66 16, 66 32 C68 40, 65 48, 64 52 L60 48 C62 38, 64 26, 50 20 C36 26, 38 38, 40 48 L36 52 C35 48, 32 40, 34 32 Z" fill="#3b2219"/>
      <circle cx="50" cy="33" r="13" fill="#fbd5be"/>
      <path d="M37 28 C41 22, 59 22, 63 28 C57 23, 43 23, 37 28 Z" fill="#2d170f"/>

      <!-- Neck & Emerald Scrub -->
      <path d="M45 43 L55 43 L55 52 L45 52 Z" fill="#fbd5be"/>
      <polygon points="44,48 56,48 50,56" fill="#047857"/>

      <!-- Lab Coat -->
      <path d="M22 84 C22 56, 36 50, 44 48 L50 56 L56 48 C64 50, 78 56, 78 84 Z" fill="#f0fdf4"/>
      <polygon points="34,52 44,48 41,66" fill="#a7f3d0"/>
      <polygon points="66,52 56,48 59,66" fill="#a7f3d0"/>

      <!-- ID Badge Lanyard -->
      <path d="M47 52 L49 63 M53 52 L51 63" stroke="#059669" stroke-width="1.5"/>
      <rect x="46" y="63" width="8" height="11" rx="1.5" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.8"/>
      <rect x="47.5" y="65" width="5" height="3" fill="#059669"/>
      <line x1="47.5" y1="70" x2="52.5" y2="70" stroke="#94a3b8" stroke-width="1"/>
    `;
  } else if (roleKey === 'engineer') {
    // Ingeniero de Soporte: Con Headset, Chaleco Técnico con bandas reflectoras y engranaje
    illustration = `
      <!-- Technical Gear Top Right -->
      <circle cx="86" cy="22" r="11" fill="#0f172a" opacity="0.6"/>
      <circle cx="86" cy="22" r="9" fill="#d97706"/>
      <path d="M86 16 L86 18 M86 26 L86 28 M80 22 L82 22 M90 22 L92 22 M82 18 L83.5 19.5 M88.5 24.5 L90 26 M82 26 L83.5 24.5 M88.5 19.5 L90 18" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="86" cy="22" r="3.5" fill="#ffffff"/>
      <circle cx="86" cy="22" r="1.8" fill="#d97706"/>

      <!-- Head & Short Hair -->
      <circle cx="50" cy="32" r="14" fill="#fcd9bd"/>
      <path d="M35 28 C35 18, 65 18, 65 28 C65 21, 58 19, 50 19 C42 19, 35 21, 35 28 Z" fill="#1c1917"/>

      <!-- Support Headset & Mic -->
      <path d="M34 32 C34 18, 66 18, 66 32" fill="none" stroke="#475569" stroke-width="2.5"/>
      <rect x="33" y="28" width="4" height="9" rx="2" fill="#0f172a"/>
      <rect x="63" y="28" width="4" height="9" rx="2" fill="#0f172a"/>
      <path d="M65 34 C65 42, 58 45, 54 44" fill="none" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="53" cy="44" r="2.2" fill="#d97706"/>

      <!-- Neck & Shirt -->
      <path d="M44 43 L56 43 L56 50 L44 50 Z" fill="#fcd9bd"/>

      <!-- Technical Vest (Amber & Slate with Reflective Stripe) -->
      <path d="M22 84 C22 56, 36 50, 50 50 C64 50, 78 56, 78 84 Z" fill="#d97706"/>
      <polygon points="45,50 55,50 50,60" fill="#1e293b"/>
      <!-- Reflective Safety Bands -->
      <path d="M26 68 L74 68 L73 74 L27 74 Z" fill="#fef08a" opacity="0.9"/>
      <path d="M29 69 L35 73 M45 69 L51 73 M61 69 L67 73" stroke="#ca8a04" stroke-width="1"/>
      <path d="M42 50 L42 84 M58 50 L58 84" stroke="#78350f" stroke-width="1.5"/>
    `;
  } else if (roleKey === 'executive') {
    // Consultor Comercial Senior: Traje Ejecutivo, Cuello de Camisa y Corbata de Seda con Pin Dorado
    illustration = `
      <!-- Executive Star Top Right -->
      <circle cx="86" cy="22" r="11" fill="#0f172a" opacity="0.6"/>
      <circle cx="86" cy="22" r="9" fill="#4f46e5"/>
      <polygon points="86,16 88,20 92,21 89,24 90,28 86,26 82,28 83,24 80,21 84,20" fill="#fbbf24"/>

      <!-- Head & Groomed Hair -->
      <circle cx="50" cy="32" r="14" fill="#f8d7bb"/>
      <path d="M34 28 C34 18, 66 18, 66 28 C66 20, 57 17, 50 17 C43 17, 34 20, 34 28 Z" fill="#0f172a"/>
      <path d="M35 25 C40 19, 58 19, 65 24 C60 21, 52 19, 48 19 C42 19, 37 22, 35 25 Z" fill="#334155"/>

      <!-- Shirt Collar -->
      <path d="M44 43 L56 43 L56 50 L44 50 Z" fill="#f8d7bb"/>
      <polygon points="41,47 50,56 46,47" fill="#ffffff"/>
      <polygon points="59,47 50,56 54,47" fill="#ffffff"/>

      <!-- Executive Suit Jacket (Navy Charcoal) -->
      <path d="M22 84 C22 56, 35 50, 44 48 L50 64 L56 48 C65 50, 78 56, 78 84 Z" fill="#1e1b4b"/>
      <polygon points="32,53 44,48 40,68 30,62" fill="#312e81"/>
      <polygon points="68,53 56,48 60,68 70,62" fill="#312e81"/>

      <!-- Silk Royal Necktie + Gold Tie Bar -->
      <polygon points="48,51 52,51 53,74 50,78 47,74" fill="#6366f1"/>
      <polygon points="48,51 52,51 51,56 49,56" fill="#818cf8"/>
      <line x1="47.5" y1="64" x2="52.5" y2="64" stroke="#fbbf24" stroke-width="1.8" stroke-linecap="round"/>

      <!-- Lapel Gold Pin -->
      <circle cx="37" cy="58" r="2.2" fill="#fbbf24"/>
    `;
  } else if (roleKey === 'tenders') {
    // Gerente de Licitaciones: Mazo de adjudicación, medalla de contrato y traje ejecutivo
    illustration = `
      <!-- Legal Gavel / Tender Award Top Right -->
      <circle cx="86" cy="22" r="11" fill="#0f172a" opacity="0.6"/>
      <circle cx="86" cy="22" r="9" fill="#e11d48"/>
      <path d="M81 19 L87 25 M83 17 L89 23" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="84" y1="21" x2="91" y2="28" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>

      <!-- Head & Hair (Executive Updo) -->
      <path d="M33 34 C33 16, 67 16, 67 34 C67 42, 64 48, 62 50 C60 38, 62 25, 50 20 C38 25, 40 38, 38 50 C36 48, 33 42, 33 34 Z" fill="#4c0519"/>
      <circle cx="50" cy="33" r="13" fill="#fbd5be"/>
      <circle cx="50" cy="18" r="7" fill="#4c0519"/>

      <!-- Neck & Pearl Necklace -->
      <path d="M45 43 L55 43 L55 51 L45 51 Z" fill="#fbd5be"/>
      <path d="M43 49 C46 54, 54 54, 57 49" fill="none" stroke="#fef08a" stroke-width="2" stroke-linecap="round" stroke-dasharray="1.5 2"/>

      <!-- Crimson Blazer -->
      <path d="M22 84 C22 56, 36 50, 44 48 L50 62 L56 48 C64 50, 78 56, 78 84 Z" fill="#be123c"/>
      <polygon points="33,52 44,48 40,68" fill="#e11d48"/>
      <polygon points="67,52 56,48 60,68" fill="#e11d48"/>

      <!-- Adjudication Rosette Pin -->
      <circle cx="36" cy="58" r="3.5" fill="#fbbf24"/>
      <polygon points="36,60 34,66 36,64 38,66" fill="#f59e0b"/>
    `;
  } else if (roleKey === 'auditor') {
    // Auditor Financiero: Gráfica ascendente, lupa/diamante de rentabilidad
    illustration = `
      <!-- Trend Growth Chart Top Right -->
      <circle cx="86" cy="22" r="11" fill="#0f172a" opacity="0.6"/>
      <circle cx="86" cy="22" r="9" fill="#0891b2"/>
      <rect x="80" y="24" width="2.5" height="5" fill="#ffffff" rx="0.5"/>
      <rect x="84" y="21" width="2.5" height="8" fill="#38bdf8" rx="0.5"/>
      <rect x="88" y="17" width="2.5" height="12" fill="#4ade80" rx="0.5"/>
      <polyline points="80,22 85,18 90,14" fill="none" stroke="#fbbf24" stroke-width="1.5" stroke-linecap="round"/>

      <!-- Head & Hair -->
      <circle cx="50" cy="32" r="14" fill="#f8d7bb"/>
      <path d="M35 28 C35 18, 65 18, 65 28 C65 21, 58 18, 50 18 C42 18, 35 21, 35 28 Z" fill="#1e293b"/>

      <!-- Glasses for Auditor Precision -->
      <rect x="40" y="30" width="8" height="6" rx="2" fill="none" stroke="#0891b2" stroke-width="1.5"/>
      <rect x="52" y="30" width="8" height="6" rx="2" fill="none" stroke="#0891b2" stroke-width="1.5"/>
      <line x1="48" y1="33" x2="52" y2="33" stroke="#0891b2" stroke-width="1.5"/>

      <!-- Shirt & Tie -->
      <path d="M44 43 L56 43 L56 50 L44 50 Z" fill="#f8d7bb"/>
      <polygon points="41,47 50,56 46,47" fill="#ffffff"/>
      <polygon points="59,47 50,56 54,47" fill="#ffffff"/>

      <!-- Vest (Slate & Cyan) -->
      <path d="M22 84 C22 56, 36 50, 44 48 L50 64 L56 48 C64 50, 78 56, 78 84 Z" fill="#155e75"/>
      <polygon points="48,51 52,51 53,74 50,78 47,74" fill="#0891b2"/>
      <line x1="47.5" y1="63" x2="52.5" y2="63" stroke="#fbbf24" stroke-width="1.5"/>
    `;
  } else if (roleKey === 'surgeon') {
    // Cirujano Especialista: Gorro Quirúrgico, Mascarilla Sanitaria y Lámpara Frontal
    illustration = `
      <!-- Headlamp Mirror Top Right -->
      <circle cx="86" cy="22" r="11" fill="#0f172a" opacity="0.6"/>
      <circle cx="86" cy="22" r="9" fill="#0d9488"/>
      <circle cx="86" cy="22" r="5" fill="#f8fafc" stroke="#5eead4" stroke-width="1.5"/>
      <circle cx="86" cy="22" r="2.5" fill="#0f172a"/>

      <!-- Head with Surgical Cap -->
      <circle cx="50" cy="34" r="14" fill="#f8d7bb"/>
      <!-- Scrub Cap -->
      <path d="M33 32 C33 16, 67 16, 67 32 C67 36, 64 38, 50 38 C36 38, 33 36, 33 32 Z" fill="#0d9488"/>
      <path d="M33 32 C37 30, 63 30, 67 32" stroke="#115e59" stroke-width="1.5" fill="none"/>

      <!-- Surgical Headlamp -->
      <circle cx="50" cy="26" r="4.5" fill="#cbd5e1" stroke="#334155" stroke-width="1"/>
      <circle cx="50" cy="26" r="2" fill="#38bdf8"/>
      <path d="M34 26 L66 26" stroke="#334155" stroke-width="1.5" fill="none"/>

      <!-- Eyes & Protective Surgical Mask with pleats -->
      <rect x="38" y="36" width="24" height="15" rx="3" fill="#e0f2fe" stroke="#38bdf8" stroke-width="1.2"/>
      <line x1="39" y1="41" x2="61" y2="41" stroke="#93c5fd" stroke-width="1"/>
      <line x1="39" y1="46" x2="61" y2="46" stroke="#93c5fd" stroke-width="1"/>
      <!-- Mask Straps -->
      <path d="M38 38 L34 35 M38 48 L34 47 M62 38 L66 35 M62 48 L66 47" stroke="#93c5fd" stroke-width="1"/>

      <!-- Teal Surgical Scrubs Body -->
      <path d="M22 84 C22 56, 36 50, 50 50 C64 50, 78 56, 78 84 Z" fill="#0f766e"/>
      <polygon points="43,50 57,50 50,58" fill="#115e59"/>
    `;
  } else {
    // Directora Clínica / Operaciones: Hospital, Caduceo y Cruz de Malta
    illustration = `
      <!-- Hospital & Caduceus Top Right -->
      <circle cx="86" cy="22" r="11" fill="#0f172a" opacity="0.6"/>
      <circle cx="86" cy="22" r="9" fill="#7c3aed"/>
      <path d="M86 16 L86 28 M82 20 C85 18, 87 18, 90 20 M82 24 C85 22, 87 22, 90 24" stroke="#ffffff" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <circle cx="86" cy="16" r="1.5" fill="#fbbf24"/>

      <!-- Head & Professional Hair -->
      <path d="M33 32 C33 16, 67 16, 67 32 C67 44, 63 50, 60 52 C58 38, 62 25, 50 20 C38 25, 42 38, 40 52 C37 50, 33 44, 33 32 Z" fill="#2e1065"/>
      <circle cx="50" cy="33" r="13" fill="#fbd5be"/>

      <!-- Neck & Purple V-Neck -->
      <path d="M45 43 L55 43 L55 51 L45 51 Z" fill="#fbd5be"/>
      <polygon points="44,48 56,48 50,56" fill="#6b21a8"/>

      <!-- Executive Clinical Blazer (Royal Violet) -->
      <path d="M22 84 C22 56, 36 50, 44 48 L50 64 L56 48 C64 50, 78 56, 78 84 Z" fill="#581c87"/>
      <polygon points="33,52 44,48 40,68" fill="#7e22ce"/>
      <polygon points="67,52 56,48 60,68" fill="#7e22ce"/>

      <!-- Gold Caduceus Pin -->
      <circle cx="36" cy="58" r="3" fill="#fbbf24"/>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <defs>
      <linearGradient id="bg_${roleKey}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bg1}"/>
        <stop offset="100%" stop-color="${bg2}"/>
      </linearGradient>
      <filter id="shadow_${roleKey}" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/>
      </filter>
    </defs>

    <!-- Outer Rounded Base with Glowing Gradient & Rim -->
    <rect width="100" height="100" rx="24" fill="url(#bg_${roleKey})"/>
    <rect x="1.5" y="1.5" width="97" height="97" rx="22.5" fill="none" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.25"/>

    <!-- Inner Illustration Group -->
    <g filter="url(#shadow_${roleKey})">
      ${illustration}
    </g>

    <!-- Professional Bottom Role Badge -->
    <rect x="12" y="83" width="76" height="13" rx="6.5" fill="#090d16" opacity="0.92" stroke="#ffffff" stroke-width="0.8" stroke-opacity="0.2"/>
    <text x="50" y="92.2" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="6.8" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="0.8">${roleText}</text>
  </svg>`;

  try {
    const encoded = typeof window !== 'undefined' && window.btoa
      ? window.btoa(unescape(encodeURIComponent(svg)))
      : Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${encoded}`;
  } catch {
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
};

export const PRESET_AVATARS = [
  {
    id: 'doc_male',
    label: 'Dr. Médico Especialista',
    description: 'Estetoscopio clínico y bata de especialista',
    url: createDetailedSvgAvatar('doctor', ['#0284c7', '#0369a1'], 'DR. MÉDICO'),
    color: 'from-blue-600 to-cyan-600',
  },
  {
    id: 'doc_female',
    label: 'Dra. Directora Biomédica',
    description: 'Bata científica, credencial e insignia bio-médica',
    url: createDetailedSvgAvatar('biomedical', ['#059669', '#0f766e'], 'DRA. BIOMÉDICA'),
    color: 'from-emerald-600 to-teal-600',
  },
  {
    id: 'engineer_tech',
    label: 'Ingeniero de Bio-Soporte',
    description: 'Headset de comunicaciones y chaleco técnico',
    url: createDetailedSvgAvatar('engineer', ['#d97706', '#92400e'], 'ING. SOPORTE'),
    color: 'from-amber-600 to-orange-600',
  },
  {
    id: 'executive_consultant',
    label: 'Consultor Comercial Senior',
    description: 'Traje ejecutivo, corbata de seda y pin corporativo',
    url: createDetailedSvgAvatar('executive', ['#4338ca', '#312e81'], 'CONSULTOR SR.'),
    color: 'from-indigo-600 to-purple-600',
  },
  {
    id: 'director_female',
    label: 'Gerente de Licitaciones',
    description: 'Blazer ejecutivo y medalla de adjudicación',
    url: createDetailedSvgAvatar('tenders', ['#e11d48', '#9f1239'], 'LICITACIONES'),
    color: 'from-rose-600 to-pink-600',
  },
  {
    id: 'auditor_male',
    label: 'Auditor Financiero & Costos',
    description: 'Analista de rentabilidad con gráfica ascendente',
    url: createDetailedSvgAvatar('auditor', ['#0891b2', '#155e75'], 'AUDITOR FIN.'),
    color: 'from-cyan-600 to-blue-600',
  },
  {
    id: 'surgeon_pro',
    label: 'Cirujano de Quirófano',
    description: 'Gorro quirúrgico, mascarilla y lámpara frontal',
    url: createDetailedSvgAvatar('surgeon', ['#0d9488', '#115e59'], 'CIRUJANO'),
    color: 'from-teal-600 to-emerald-600',
  },
  {
    id: 'hospital_admin',
    label: 'Directora de Operaciones',
    description: 'Insignia hospitalaria y caduceo de gestión clínica',
    url: createDetailedSvgAvatar('director', ['#7c3aed', '#581c87'], 'DIR. CLÍNICA'),
    color: 'from-purple-600 to-violet-600',
  },
];

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  id: 'syd-default-theme',
  companyName: 'SYD COLOMBIA',
  companySubtitle: 'Línea Diagnóstica & Dotaciones',
  companyLogoUrl: '',
  logoStyle: 'emblem_3d',
  canvasTheme: 'navy_dark',
  customCanvasHex: '#0f1a2e',
  accentColor: 'sky',
  customAccentHex: '#38bdf8',
  buttonShape: 'rounded',
  buttonColor: 'sky',
  customButtonHex: '#38bdf8',
  textColor: 'pure_white',
  customTextHex: '#ffffff',
  fontFamily: 'plus_jakarta',
  fontSize: 'normal',
  textContrast: 'high_contrast',
  sidebarBackground: '#111c2e',
  headerBackground: '#15253d',
  cardRadius: 'lg',
  enableAmbientGlow: true,
  enableGlassmorphism: true,
  updatedAt: new Date().toISOString(),
};

export const PRESET_THEME_BUNDLES: {
  id: string;
  name: string;
  badge: string;
  swatches: string[];
  theme: Partial<ThemeSettings>;
}[] = [
  {
    id: 'syd_default_original',
    name: 'Tema Original (Default)',
    badge: 'Predeterminado',
    swatches: ['#0f1a2e', '#15253d', '#38bdf8'],
    theme: {
      canvasTheme: 'navy_dark',
      customCanvasHex: '#0f1a2e',
      accentColor: 'sky',
      customAccentHex: '#38bdf8',
      buttonShape: 'rounded',
      buttonColor: 'sky',
      customButtonHex: '#38bdf8',
      textColor: 'pure_white',
      customTextHex: '#ffffff',
      fontFamily: 'plus_jakarta',
      fontSize: 'normal',
      cardRadius: 'lg',
      logoStyle: 'emblem_3d',
      sidebarBackground: '#111c2e',
      headerBackground: '#15253d',
      enableAmbientGlow: true,
      enableGlassmorphism: true,
    },
  },
  {
    id: 'midnight_matrix',
    name: 'Midnight OLED',
    badge: 'Ultra Oscuro',
    swatches: ['#060910', '#0e1320', '#06b6d4'],
    theme: {
      canvasTheme: 'midnight_oled',
      accentColor: 'cyan',
      customAccentHex: '#06b6d4',
      buttonShape: 'rounded',
      buttonColor: 'cyan',
      textColor: 'pure_white',
      fontFamily: 'outfit',
      fontSize: 'normal',
      cardRadius: 'lg',
      logoStyle: 'emblem_3d',
    },
  },
  {
    id: 'titanium_slate',
    name: 'Titanio Slate',
    badge: 'Sobrio Pro',
    swatches: ['#0f172a', '#1e293b', '#6366f1'],
    theme: {
      canvasTheme: 'slate_pro',
      accentColor: 'indigo',
      customAccentHex: '#6366f1',
      buttonShape: 'soft',
      buttonColor: 'indigo',
      textColor: 'platinum',
      fontFamily: 'inter',
      fontSize: 'normal',
      cardRadius: 'md',
      logoStyle: 'emblem_3d',
    },
  },
  {
    id: 'hospital_emerald',
    name: 'Esmeralda Vital',
    badge: 'Quirúrgico',
    swatches: ['#041c18', '#092e28', '#10b981'],
    theme: {
      canvasTheme: 'emerald_dark',
      accentColor: 'emerald',
      customAccentHex: '#10b981',
      buttonShape: 'rounded',
      buttonColor: 'emerald',
      textColor: 'pure_white',
      fontFamily: 'plus_jakarta',
      fontSize: 'normal',
      cardRadius: 'lg',
      logoStyle: 'emblem_3d',
    },
  },
  {
    id: 'sapphire_luxury',
    name: 'Zafiro Real',
    badge: 'Alta Gama',
    swatches: ['#08142c', '#0f2347', '#38bdf8'],
    theme: {
      canvasTheme: 'sapphire_deep',
      accentColor: 'sky',
      customAccentHex: '#38bdf8',
      buttonShape: 'pill',
      buttonColor: 'sky',
      textColor: 'pure_white',
      fontFamily: 'plus_jakarta',
      fontSize: 'normal',
      cardRadius: 'xl',
      logoStyle: 'emblem_3d',
    },
  },
  {
    id: 'cardiology_crimson',
    name: 'Carmesí Cardio',
    badge: 'Urgencias',
    swatches: ['#1a080d', '#2d0f17', '#f43f5e'],
    theme: {
      canvasTheme: 'crimson_dark',
      accentColor: 'rose',
      customAccentHex: '#f43f5e',
      buttonShape: 'soft',
      buttonColor: 'rose',
      textColor: 'pure_white',
      fontFamily: 'plus_jakarta',
      fontSize: 'normal',
      cardRadius: 'lg',
      logoStyle: 'emblem_3d',
    },
  },
  {
    id: 'cyber_biotech',
    name: 'Cyber Violeta',
    badge: 'Biotecnología',
    swatches: ['#140c24', '#20133a', '#a855f7'],
    theme: {
      canvasTheme: 'purple_night',
      accentColor: 'violet',
      customAccentHex: '#a855f7',
      buttonShape: 'rounded',
      buttonColor: 'violet',
      textColor: 'pure_white',
      fontFamily: 'outfit',
      fontSize: 'normal',
      cardRadius: 'lg',
      logoStyle: 'emblem_3d',
    },
  },
  {
    id: 'minimal_carbon',
    name: 'Carbón Puro',
    badge: 'Minimalista',
    swatches: ['#121212', '#1e1e1e', '#14b8a6'],
    theme: {
      canvasTheme: 'carbon_dark',
      accentColor: 'teal',
      customAccentHex: '#14b8a6',
      buttonShape: 'square',
      buttonColor: 'teal',
      textColor: 'pure_white',
      fontFamily: 'inter',
      fontSize: 'compact',
      cardRadius: 'sm',
      logoStyle: 'emblem_3d',
    },
  },
  {
    id: 'warm_moca',
    name: 'Moca Dorado',
    badge: 'Cálido',
    swatches: ['#1c130c', '#2b1e13', '#f59e0b'],
    theme: {
      canvasTheme: 'amber_dark',
      accentColor: 'amber',
      customAccentHex: '#f59e0b',
      buttonShape: 'rounded',
      buttonColor: 'amber',
      textColor: 'warm_gold',
      fontFamily: 'roboto',
      fontSize: 'normal',
      cardRadius: 'lg',
      logoStyle: 'emblem_3d',
    },
  },
  {
    id: 'clinical_light_mode',
    name: 'Blanco Clínico',
    badge: 'Modo Claro',
    swatches: ['#f8fafc', '#ffffff', '#0284c7'],
    theme: {
      canvasTheme: 'clean_light',
      accentColor: 'sky',
      customAccentHex: '#0284c7',
      buttonShape: 'rounded',
      buttonColor: 'sky',
      textColor: 'pure_white',
      fontFamily: 'plus_jakarta',
      fontSize: 'normal',
      cardRadius: 'lg',
      logoStyle: 'emblem_3d',
    },
  },
  {
    id: 'luxury_serif',
    name: 'Editorial Serif',
    badge: 'Distinción',
    swatches: ['#0f172a', '#1e293b', '#eab308'],
    theme: {
      canvasTheme: 'slate_pro',
      accentColor: 'gold',
      customAccentHex: '#eab308',
      buttonShape: 'pill',
      buttonColor: 'gold',
      textColor: 'platinum',
      fontFamily: 'playfair',
      fontSize: 'comfortable',
      cardRadius: 'xl',
      logoStyle: 'emblem_3d',
    },
  },
];

export const getStoredThemeSettings = (): ThemeSettings => {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_THEME_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_THEME_SETTINGS, ...parsed };
  } catch (e) {
    console.error('Error loading theme settings:', e);
    return DEFAULT_THEME_SETTINGS;
  }
};

export const saveStoredThemeSettings = (settings: ThemeSettings): void => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(settings));
    applyThemeToDOM(settings);
  } catch (e) {
    console.error('Error saving theme settings:', e);
  }
};

export const applyThemeToDOM = (settings: ThemeSettings): void => {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  
  // 1. Canvas Theme
  let canvas = CANVAS_THEME_MAP[settings.canvasTheme] || CANVAS_THEME_MAP.navy_dark;
  if (settings.canvasTheme === 'custom' && settings.customCanvasHex) {
    const isLight = isColorBright(settings.customCanvasHex);
    canvas = {
      name: 'Personalizado',
      description: 'Color personalizado',
      bodyBg: settings.customCanvasHex,
      cardBg: isLight ? '#ffffff' : adjustColorBrightness(settings.customCanvasHex, 14),
      cardHover: isLight ? '#f8fafc' : adjustColorBrightness(settings.customCanvasHex, 22),
      sidebarBg: isLight ? '#ffffff' : adjustColorBrightness(settings.customCanvasHex, -8),
      headerBg: isLight ? '#ffffff' : adjustColorBrightness(settings.customCanvasHex, 14),
      borderColor: isLight ? '#cbd5e1' : adjustColorBrightness(settings.customCanvasHex, 32),
      textPrimary: isLight ? '#0f172a' : '#ffffff',
      textSecondary: isLight ? '#475569' : '#94a3b8',
      isLight: isLight,
    };
  }

  // 2. Accent Color
  const accent = settings.accentColor === 'custom'
    ? {
        hex: settings.customAccentHex || '#38bdf8',
        lightHex: settings.customAccentHex || '#0284c7',
        glow: hexToRgba(settings.customAccentHex || '#38bdf8', 0.35),
      }
    : ACCENT_COLOR_MAP[settings.accentColor] || ACCENT_COLOR_MAP.sky;

  // 3. Button Color
  const btnColor = settings.buttonColor === 'custom'
    ? settings.customButtonHex || accent.hex
    : ((settings.buttonColor && ACCENT_COLOR_MAP[settings.buttonColor as AccentColorKey]) || accent).hex;

  // Button text contrast: calculate if button background is bright or dark
  const isBtnBright = isColorBright(btnColor);
  const btnTextColor = isBtnBright ? '#0f172a' : '#ffffff';

  // 4. Button Shape
  const btnShape = BUTTON_SHAPE_MAP[settings.buttonShape] || BUTTON_SHAPE_MAP.rounded;

  // 5. Typography
  const font = FONT_FAMILY_MAP[settings.fontFamily] || FONT_FAMILY_MAP.plus_jakarta;

  // 6. Text Color with Automatic Contrast Detection
  let rawTextColor = settings.textColor === 'custom'
    ? settings.customTextHex || '#ffffff'
    : (TEXT_COLOR_MAP[settings.textColor] || TEXT_COLOR_MAP.pure_white).hex;

  // If the background is Light (e.g. clean_light or custom light), ensure text is dark enough to be clearly legible
  if (canvas.isLight) {
    if (isColorBright(rawTextColor)) {
      rawTextColor = '#0f172a'; // Automatic high-contrast dark text
    }
  } else {
    // If the background is Dark, ensure text is bright enough to be clearly legible
    if (!isColorBright(rawTextColor)) {
      rawTextColor = '#ffffff'; // Automatic high-contrast light text
    }
  }

  // 7. Card Radius
  const cardRadiusMap: Record<string, string> = {
    none: '0px',
    sm: '6px',
    md: '10px',
    lg: '16px',
    xl: '22px',
  };
  const cardRadiusVal = (settings.cardRadius && cardRadiusMap[settings.cardRadius]) || '16px';

  // Apply CSS Variables directly on root
  root.style.setProperty('--syd-accent', accent.hex);
  root.style.setProperty('--syd-accent-light', accent.lightHex);
  root.style.setProperty('--syd-accent-glow', accent.glow);
  root.style.setProperty('--syd-btn-bg', btnColor);
  root.style.setProperty('--syd-btn-text', btnTextColor);
  root.style.setProperty('--syd-btn-radius', btnShape.radius);
  root.style.setProperty('--syd-card-radius', cardRadiusVal);
  root.style.setProperty('--syd-body-bg', canvas.bodyBg);
  root.style.setProperty('--syd-card-bg', canvas.cardBg);
  root.style.setProperty('--syd-card-hover', canvas.cardHover);
  root.style.setProperty('--syd-sidebar-bg', canvas.sidebarBg);
  root.style.setProperty('--syd-header-bg', canvas.headerBg);
  root.style.setProperty('--syd-border-color', canvas.borderColor);
  root.style.setProperty('--syd-text-primary', rawTextColor);
  root.style.setProperty('--syd-text-secondary', canvas.textSecondary);
  root.style.setProperty('--syd-font-family', font.family);

  // Set font family directly to body
  document.body.style.fontFamily = font.family;

  // Apply every size option consistently. Most Tailwind typography uses rem,
  // so changing the root size scales labels and controls across all views.
  const fontSizeMap: Record<ThemeSettings['fontSize'], string> = {
    compact: '14px',
    sm: '14px',
    normal: '15.5px',
    md: '16px',
    comfortable: '16.5px',
    lg: '17px',
  };
  const rootFontSize = fontSizeMap[settings.fontSize] || fontSizeMap.normal;
  root.style.setProperty('--syd-font-scale', String(parseFloat(rootFontSize) / 15.5));
  root.style.setProperty('--syd-font-size', rootFontSize);
  root.style.fontSize = rootFontSize;

  // Set dataset attributes for conditional Tailwind / CSS styling
  root.dataset.theme = settings.canvasTheme;
  root.dataset.accent = settings.accentColor;
  root.dataset.buttonShape = settings.buttonShape;
  root.dataset.buttonColor = settings.buttonColor;
  root.dataset.isLight = canvas.isLight ? 'true' : 'false';
  root.dataset.fontSize = settings.fontSize;
};

/** Helper to test luminance of a hex color */
export function isColorBright(hex: string): boolean {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) return false;

  const r = num >> 16;
  const g = (num >> 8) & 0x00ff;
  const b = num & 0x0000ff;

  // Standard HSP luminance formula
  const hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
  return hsp > 145;
}

/** Helper to darken/lighten hex colors for automatic card/border generation */
export function adjustColorBrightness(hex: string, percent: number): string {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) return hex;

  let r = (num >> 16) + Math.round((255 * percent) / 100);
  let g = ((num >> 8) & 0x00ff) + Math.round((255 * percent) / 100);
  let b = (num & 0x0000ff) + Math.round((255 * percent) / 100);

  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Helper to convert hex to rgba string */
export function hexToRgba(hex: string, alpha: number = 0.35): string {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) return `rgba(56, 189, 248, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
