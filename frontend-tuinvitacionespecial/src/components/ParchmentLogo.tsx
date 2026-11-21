import React from 'react';

interface ParchmentLogoProps {
  className?: string;
  size?: number;
  alt?: string;
}

/**
 * Logotipo oficial de Tu Invitación Especial:
 * Corazón editorial con anillos dorados entrelazados y ramas botánicas.
 */
export function ParchmentLogo({
  className = 'w-6 h-6',
  size,
  alt = 'Tu Invitación Especial',
}: ParchmentLogoProps) {
  return (
    <img
      src="/images/logo-anillos.png"
      alt={alt}
      width={size || 32}
      height={size || 32}
      className={`inline-block object-contain shrink-0 ${className}`}
      loading="eager"
      decoding="async"
    />
  );
}

export const BrandLogo = ParchmentLogo;
export default ParchmentLogo;
