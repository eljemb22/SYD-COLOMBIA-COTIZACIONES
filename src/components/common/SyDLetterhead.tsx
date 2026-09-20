import React from 'react';

// Default signature matching the user's provided document image
export const DefaultDocumentSignature: React.FC<{ className?: string }> = ({ className = 'h-16' }) => {
  return (
    <svg
      viewBox="0 0 160 100"
      className={`overflow-visible ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Hand-drawn signature stroke resembling 'Htu' / flourish from image */}
      <path
        d="M 25,75 C 22,50 20,20 22,12 C 23,10 28,15 28,45 C 28,65 29,88 28,92 M 15,38 C 30,36 45,34 52,33 M 38,18 C 42,40 45,70 48,82 C 49,85 52,80 55,60 C 58,45 60,35 62,35 C 65,35 66,55 68,75 C 70,82 72,82 76,70 C 80,58 84,48 88,48 C 91,48 90,65 92,78 C 94,82 98,80 105,74"
        stroke="#1e293b"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
};
