import React from 'react';

interface MaraAvatarProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showOnlineBadge?: boolean;
}

export const MaraAvatar: React.FC<MaraAvatarProps> = ({
  size = 'md',
  className = '',
  showOnlineBadge = true,
}) => {
  const sizeClasses = {
    xs: 'w-5 h-5',
    sm: 'w-6 h-6',
    md: 'w-7 h-7',
    lg: 'w-8 h-8',
    xl: 'w-10 h-10',
  };

  const badgeSizes = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2 h-2',
    xl: 'w-2.5 h-2.5',
  };

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${sizeClasses[size]} ${className}`}>
      {/* SVG Avatar of Mara - Female Biomedical AI Specialist */}
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full rounded-full overflow-hidden shadow-sm ring-1 ring-sky-400/40"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="maraBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0369a1" />
            <stop offset="45%" stopColor="#4338ca" />
            <stop offset="100%" stopColor="#6d28d9" />
          </linearGradient>
          <linearGradient id="maraSkinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fed7aa" />
            <stop offset="100%" stopColor="#fba988" />
          </linearGradient>
          <linearGradient id="maraHairGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="25%" stopColor="#fde047" />
            <stop offset="60%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <linearGradient id="maraHairHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fef9c3" />
            <stop offset="100%" stopColor="#fde047" />
          </linearGradient>
          <linearGradient id="maraCoatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--syd-text-primary)" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          <linearGradient id="maraScrubGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="var(--syd-accent-light)" />
          </linearGradient>
        </defs>

        {/* Background circle */}
        <circle cx="50" cy="50" r="50" fill="url(#maraBgGrad)" />

        {/* Halo Glow */}
        <circle cx="50" cy="50" r="48" fill="none" stroke="var(--syd-accent)" strokeWidth="1.5" strokeOpacity="0.4" />

        {/* Back Hair - Blonde volume */}
        <path d="M 26 44 C 24 25 35 15 50 15 C 65 15 76 25 74 44 C 75 58 72 70 70 76 C 65 72 63 60 63 50 C 37 50 35 72 30 76 C 28 70 25 58 26 44 Z" fill="url(#maraHairGrad)" />

        {/* Neck */}
        <rect x="44" y="52" width="12" height="15" rx="3" fill="url(#maraSkinGrad)" />

        {/* Medical Scrub Collar / Inner Shirt */}
        <polygon points="41,63 59,63 54,78 46,78" fill="url(#maraScrubGrad)" />

        {/* Medical Coat / Shoulders */}
        <path d="M 18 96 C 20 74 36 68 45 68 L 47 78 L 41 96 Z" fill="url(#maraCoatGrad)" />
        <path d="M 82 96 C 80 74 64 68 55 68 L 53 78 L 59 96 Z" fill="url(#maraCoatGrad)" />

        {/* Head / Face */}
        <ellipse cx="50" cy="42" rx="17" ry="20" fill="url(#maraSkinGrad)" />

        {/* Hair Front / Bangs - Blonde */}
        <path d="M 33 36 C 35 24 45 18 50 18 C 60 18 67 24 67 36 C 65 32 58 30 50 32 C 42 30 35 32 33 36 Z" fill="url(#maraHairGrad)" />
        <path d="M 33 36 C 32 46 32 54 36 58 C 34 50 35 40 37 36 Z" fill="url(#maraHairGrad)" />
        <path d="M 67 36 C 68 46 68 54 64 58 C 66 50 65 40 63 36 Z" fill="url(#maraHairGrad)" />
        {/* Blonde hair highlight strands */}
        <path d="M 38 28 C 42 22 47 21 50 21" fill="none" stroke="url(#maraHairHighlight)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M 52 22 C 57 23 62 26 64 30" fill="none" stroke="url(#maraHairHighlight)" strokeWidth="1.2" strokeLinecap="round" />

        {/* Eyebrows */}
        <path d="M 39 36 Q 44 34 47 36" fill="none" stroke="#92400e" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M 53 36 Q 56 34 61 36" fill="none" stroke="#92400e" strokeWidth="1.2" strokeLinecap="round" />

        {/* Eyes (warm & intelligent) */}
        <ellipse cx="43" cy="41" rx="2.5" ry="3" fill="var(--syd-body-bg)" />
        <ellipse cx="57" cy="41" rx="2.5" ry="3" fill="var(--syd-body-bg)" />
        <circle cx="44" cy="40" r="0.9" fill="var(--syd-text-primary)" />
        <circle cx="58" cy="40" r="0.9" fill="var(--syd-text-primary)" />
        <circle cx="42.2" cy="42" r="0.4" fill="var(--syd-text-primary)" />
        <circle cx="56.2" cy="42" r="0.4" fill="var(--syd-text-primary)" />

        {/* Glasses / Modern Tech Frame */}
        <rect x="37" y="37" width="11" height="8" rx="2.5" fill="none" stroke="var(--syd-accent)" strokeWidth="1" strokeOpacity="0.9" />
        <rect x="52" y="37" width="11" height="8" rx="2.5" fill="none" stroke="var(--syd-accent)" strokeWidth="1" strokeOpacity="0.9" />
        <path d="M 48 40 L 52 40" fill="none" stroke="var(--syd-accent)" strokeWidth="1" />

        {/* Nose */}
        <path d="M 50 43 L 49.5 47 L 51 47" fill="none" stroke="#e09277" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />

        {/* Friendly Smile */}
        <path d="M 46 51 Q 50 55 54 51" fill="none" stroke="#c2410c" strokeWidth="1.2" strokeLinecap="round" />

        {/* Headset / Sensor */}
        <path d="M 32 44 Q 31 38 34 35 Q 36 32 37 32" fill="none" stroke="var(--syd-accent)" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="32" cy="44" r="2" fill="var(--syd-accent)" />
        <circle cx="32" cy="44" r="0.8" fill="var(--syd-text-primary)" />
        <path d="M 32 46 Q 34 52 38 54" fill="none" stroke="var(--syd-accent)" strokeWidth="1" strokeLinecap="round" strokeDasharray="1 1" />

        {/* Stethoscope */}
        <path d="M 39 74 C 40 84 60 84 61 74" fill="none" stroke="var(--syd-accent-light)" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="50" cy="83" r="2.5" fill="#e2e8f0" stroke="var(--syd-accent-light)" strokeWidth="1" />

        {/* AI Sparkle */}
        <path d="M 72 22 L 73.5 26 L 77.5 27.5 L 73.5 29 L 72 33 L 70.5 29 L 66.5 27.5 L 70.5 26 Z" fill="var(--syd-accent)" />
        <circle cx="72" cy="27.5" r="1.2" fill="var(--syd-text-primary)" />
      </svg>

      {/* Online indicator */}
      {showOnlineBadge && (
        <span
          className={`absolute bottom-0 right-0 ${badgeSizes[size]} rounded-full bg-emerald-400 ring-1 ring-slate-950`}
        />
      )}
    </div>
  );
};
