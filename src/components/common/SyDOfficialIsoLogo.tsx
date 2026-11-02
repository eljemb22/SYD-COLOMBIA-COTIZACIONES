import React from 'react';

interface SyDOfficialIsoLogoProps {
  className?: string;
  isDarkTheme?: boolean;
}

export const SyDOfficialIsoLogo: React.FC<SyDOfficialIsoLogoProps> = ({
  className = 'w-full h-auto',
  isDarkTheme = true,
}) => {
  const navyColor = isDarkTheme ? '#ffffff' : '#1E2B6D';
  const subtextColor = isDarkTheme ? 'var(--syd-accent)' : '#1E2B6D';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 360 88"
      className={className}
      fill="none"
    >
      {/* 1. SyD Colombia S.A. Official Vector Identity */}
      <g transform="translate(6, 6)">
        {/* Main S */}
        <path
          d="M 32 18 C 32 12 26 10 18 10 C 10 10 4 13 2 18 C 0 23 3 30 14 33 C 26 36 29 42 28 48 C 26 56 17 60 8 58 C 2 56 0 52 0 52 L 4 43 C 4 43 8 47 13 48 C 18 49 22 47 23 42 C 24 37 21 32 11 29 C 1 25 -2 18 1 10 C 4 2 13 0 24 0 C 31 0 37 3 39 7 Z"
          fill="#00A3E0"
        />

        {/* y (Body + Head Dot) */}
        <circle cx="48" cy="16" r="4.5" fill={isDarkTheme ? 'var(--syd-accent)' : '#1E2B6D'} />
        <path
          d="M 36 26 C 40 26 44 30 46 34 L 50 43 L 56 26 L 65 26 L 54 50 C 50 58 44 64 36 65 C 32 65 29 63 29 63 L 31 55 C 31 55 34 56 37 55 C 41 53 43 49 44 45 L 34 26 Z"
          fill={isDarkTheme ? 'var(--syd-accent)' : '#1E2B6D'}
        />

        {/* Dynamic Cyan Swoosh crossing y and D */}
        <path d="M 42 20 C 52 12 68 6 82 0 C 70 6 58 14 50 22 Z" fill="#00A3E0" />

        {/* D */}
        <path
          d="M 58 10 L 72 10 C 86 10 96 18 94 34 C 92 50 79 58 66 58 L 52 58 Z M 64 20 L 61 48 L 68 48 C 76 48 82 43 83 34 C 84 25 79 20 71 20 Z"
          fill="#00A3E0"
          fillRule="evenodd"
        />

        {/* Registered Symbol ® */}
        <circle cx="98" cy="12" r="5" stroke={navyColor} strokeWidth="1.1" fill="none" />
        <text
          x="98"
          y="15"
          fontFamily="'Segoe UI', Arial, sans-serif"
          fontSize="6.5"
          fontWeight="bold"
          fill={navyColor}
          textAnchor="middle"
        >
          R
        </text>

        {/* Colombia S.A. Text */}
        <text
          x="2"
          y="74"
          fontFamily="'Segoe UI', Arial, sans-serif"
          fontSize="15"
          fontWeight="bold"
          fontStyle="italic"
          fill={navyColor}
          letterSpacing="1.2"
        >
          Colombia{' '}
          <tspan fontSize="10" fontStyle="normal" fontWeight="600">
            S.A.
          </tspan>
        </text>
      </g>

      {/* 2. Icontec ISO 9001 Certification Badge */}
      <g transform="translate(166, 6)">
        {/* Outer Blue Pill / Rounded Card */}
        <rect x="0" y="0" width="56" height="74" rx="8" fill="#0084C9" />

        {/* icontec Circular Nested Logo */}
        <g transform="translate(28, 18)" stroke="#FFFFFF" fill="none" strokeWidth="1.8">
          <circle cx="0" cy="0" r="9.5" strokeDasharray="50 7" />
          <circle cx="0" cy="0" r="5.5" strokeDasharray="28 5" />
          <circle cx="0" cy="0" r="2.2" fill="#FFFFFF" />
        </g>

        {/* icontec Text */}
        <text
          x="28"
          y="36"
          fontFamily="'Segoe UI', Arial, sans-serif"
          fontSize="8.5"
          fontWeight="bold"
          fill="#FFFFFF"
          textAnchor="middle"
          letterSpacing="0.2"
        >
          icontec
        </text>

        {/* Dark Shield Bottom Section matching app background */}
        <path
          d="M 4 42 C 12 39 44 39 52 42 L 52 64 C 52 68 48 70 44 70 L 12 70 C 8 70 4 68 4 64 Z"
          fill="#15253d"
        />

        {/* ISO 9001 text inside section */}
        <text
          x="28"
          y="54"
          fontFamily="'Segoe UI', Arial, sans-serif"
          fontSize="8.5"
          fontWeight="bold"
          fill="var(--syd-accent)"
          textAnchor="middle"
        >
          ISO 9001
        </text>

        {/* Certificate Code SC7290-1 */}
        <text
          x="28"
          y="65"
          fontFamily="'Segoe UI', Arial, sans-serif"
          fontSize="6.5"
          fontWeight="bold"
          fill={subtextColor}
          textAnchor="middle"
        >
          SC7290-1
        </text>
      </g>

      {/* 3. IQNET International Certification Seal */}
      <g transform="translate(244, 4)">
        {/* Navy Circle */}
        <circle cx="38" cy="38" r="36" fill="#152f5e" stroke="var(--syd-accent)" strokeWidth="1.2" />

        {/* Dotted Arc Pattern */}
        <g fill="#9ABAEB">
          <circle cx="26" cy="15" r="1.2" />
          <circle cx="30" cy="13" r="1.4" />
          <circle cx="34" cy="12" r="1.5" />
          <circle cx="38" cy="11.5" r="1.6" />
          <circle cx="42" cy="12" r="1.5" />
          <circle cx="46" cy="13" r="1.4" />
          <circle cx="50" cy="15" r="1.2" />

          <circle cx="23" cy="19" r="1.1" />
          <circle cx="27" cy="17" r="1.2" />
          <circle cx="32" cy="15.5" r="1.3" />
          <circle cx="38" cy="15" r="1.4" />
          <circle cx="44" cy="15.5" r="1.3" />
          <circle cx="49" cy="17" r="1.2" />
          <circle cx="53" cy="19" r="1.1" />
        </g>

        {/* IQNET Text */}
        <text
          x="38"
          y="34"
          fontFamily="'Segoe UI', Arial, sans-serif"
          fontSize="14"
          fontWeight="900"
          fill="#FFFFFF"
          textAnchor="middle"
          letterSpacing="0.8"
        >
          IQNET
        </text>

        {/* Certified Management System Subtitle */}
        <text
          x="38"
          y="44"
          fontFamily="'Segoe UI', Arial, sans-serif"
          fontSize="5.2"
          fontWeight="bold"
          fill="#FFFFFF"
          textAnchor="middle"
          letterSpacing="0.4"
        >
          CERTIFIED
        </text>
        <text
          x="38"
          y="52"
          fontFamily="'Segoe UI', Arial, sans-serif"
          fontSize="4.4"
          fontWeight="600"
          fill="#CBD5E1"
          textAnchor="middle"
          letterSpacing="0.3"
        >
          MANAGEMENT
        </text>
        <text
          x="38"
          y="59"
          fontFamily="'Segoe UI', Arial, sans-serif"
          fontSize="4.4"
          fontWeight="600"
          fill="#CBD5E1"
          textAnchor="middle"
          letterSpacing="0.3"
        >
          SYSTEM
        </text>
      </g>
    </svg>
  );
};
