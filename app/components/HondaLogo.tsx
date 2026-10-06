'use client';

import React from 'react';

export function HondaLogo({ className = 'w-6 h-6', color = '#E60012' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path
        d="M50 5C38 18 20 28 8 32C18 36 34 33 46 25C36 34 22 41 12 44C24 47 38 43 48 36C38 44 26 50 16 53C28 55 42 50 50 44C58 50 72 55 84 53C74 50 62 44 52 36C62 43 76 47 88 44C78 41 64 34 54 25C66 33 82 36 92 32C80 28 62 18 50 5Z"
        fill={color}
      />
      <path
        d="M20 58C32 60 44 56 50 51C56 56 68 60 80 58C68 62 50 68 50 68C50 68 32 62 20 58Z"
        fill={color}
      />
      <text
        x="50"
        y="78"
        textAnchor="middle"
        fill={color}
        fontSize="12"
        fontWeight="900"
        letterSpacing="2"
        fontFamily="sans-serif"
      >
        HONDA
      </text>
    </svg>
  );
}

export function HondaWingIcon({ className = 'w-6 h-6', color = '#FFFFFF' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 40 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path
        d="M20 2C15 8 8 12 2 14C7 15.5 14 14.5 18 11C14 15 8 18 4 19.5C9 21 15 19 19 16C15 19.5 10 22 6 23.5C11 24.5 17 22.5 20 20C23 22.5 29 24.5 34 23.5C30 22 25 19.5 21 16C25 19 31 21 36 19.5C32 18 26 15 22 11C26 14.5 33 15.5 38 14C32 12 25 8 20 2Z"
        fill={color}
      />
    </svg>
  );
}
