import React, { useState } from 'react';
import { Building2, Activity, Shield, Cross, Sparkles } from 'lucide-react';
import { ThemeSettings } from '../../types';

interface SyDLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  subtitle?: string;
  themeSettings?: Partial<ThemeSettings>;
  className?: string;
  onClick?: () => void;
}

export const SyDLogo: React.FC<SyDLogoProps> = ({
  size = 'md',
  showText = true,
  subtitle,
  themeSettings,
  className = '',
  onClick,
}) => {
  const [imageError, setImageError] = useState(false);

  const customLogoUrl = themeSettings?.companyLogoUrl;
  const companyName = themeSettings?.companyName || 'SYD COLOMBIA';
  const companySubtitle = subtitle !== undefined ? subtitle : (themeSettings?.companySubtitle || 'Línea Diagnóstica');
  const logoStyle = themeSettings?.logoStyle || 'emblem_3d';

  // Dimension mappings
  const dimensions = {
    xs: { iconSize: 'w-6 h-6', textSize: 'text-xs', subSize: 'text-[8.5px]', svgSize: 14 },
    sm: { iconSize: 'w-8 h-8', textSize: 'text-xs', subSize: 'text-[9.5px]', svgSize: 18 },
    md: { iconSize: 'w-10 h-10', textSize: 'text-sm', subSize: 'text-[10.5px]', svgSize: 22 },
    lg: { iconSize: 'w-13 h-13', textSize: 'text-base', subSize: 'text-xs', svgSize: 28 },
    xl: { iconSize: 'w-16 h-16', textSize: 'text-xl', subSize: 'text-xs', svgSize: 34 },
  }[size];

  // Render Custom Uploaded Image if valid
  if (customLogoUrl && !imageError) {
    return (
      <div
        onClick={onClick}
        className={`flex items-center gap-2.5 select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
      >
        <div
          className={`${dimensions.iconSize} rounded-xl overflow-hidden bg-white/10 p-1 border border-white/20 shadow-md flex items-center justify-center shrink-0 backdrop-blur-xs`}
        >
          <img
            src={customLogoUrl}
            alt={companyName}
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="w-full h-full object-contain"
          />
        </div>

        {showText && (
          <div className="flex flex-col min-w-0">
            <span className={`font-black text-white tracking-wide truncate ${dimensions.textSize}`}>
              {companyName}
            </span>
            {companySubtitle && (
              <span className={`text-[var(--syd-accent)] font-bold tracking-tight truncate ${dimensions.subSize}`}>
                {companySubtitle}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Built-in Vector Logos
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2.5 select-none ${onClick ? 'cursor-pointer group' : ''} ${className}`}
    >
      {/* Icon Graphic Container */}
      <div
        className={`${dimensions.iconSize} rounded-xl bg-gradient-to-br from-[var(--syd-accent)] via-[var(--syd-accent-light)] to-[#0369a1] p-0.5 shadow-lg shadow-[var(--syd-accent)]/20 flex items-center justify-center shrink-0 text-slate-950 relative overflow-hidden transition-transform duration-200 group-hover:scale-105`}
      >
        {/* Subtle decorative internal sheen */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/40 pointer-events-none" />

        {logoStyle === 'medical_cross' ? (
          <div className="relative z-10 flex items-center justify-center">
            <Cross className="text-slate-950 fill-slate-950" style={{ width: dimensions.svgSize, height: dimensions.svgSize }} />
          </div>
        ) : logoStyle === 'shield_tech' ? (
          <div className="relative z-10 flex items-center justify-center">
            <Shield className="text-slate-950 fill-slate-950" style={{ width: dimensions.svgSize, height: dimensions.svgSize }} />
          </div>
        ) : (
          /* Default 3D Medical Corporate Emblem: S & D Caduceus / Pulse Cross */
          <svg
            viewBox="0 0 40 40"
            className="w-full h-full p-1.5 overflow-visible relative z-10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Medical Shield Badge Outline */}
            <path
              d="M20 4L32 9V19C32 27 26.5 33.5 20 36C13.5 33.5 8 27 8 19V9L20 4Z"
              fill="var(--syd-body-bg)"
              fillOpacity="0.88"
              stroke="var(--syd-text-primary)"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            {/* Stylized 'S' & 'D' intertwining with Vital Pulse Wave */}
            <path
              d="M14 15C14 12.5 16.5 11 19.5 11C22.5 11 24.5 12.5 24.5 14.5C24.5 17 21.5 17.5 18.5 18.5C15.5 19.5 14 21 14 23.5C14 26 16.5 27.5 20 27.5C23.5 27.5 25.5 25.5 25.5 25.5"
              stroke="var(--syd-accent)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Pulse heartbeat peak */}
            <path
              d="M12 20H15L17.5 14L21.5 25L24 18.5L25.5 20H28"
              stroke="var(--syd-text-primary)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {/* Brand Text */}
      {showText && (
        <div className="flex flex-col min-w-0">
          <span className={`font-black text-white tracking-wide truncate ${dimensions.textSize}`}>
            {companyName}
          </span>
          {companySubtitle && (
            <span className={`text-[var(--syd-accent)] font-bold tracking-tight truncate ${dimensions.subSize}`}>
              {companySubtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
