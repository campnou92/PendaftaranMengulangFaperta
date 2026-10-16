import React from 'react';

interface InstiperLogoProps {
  size?: number | string;
  className?: string;
  variant?: string;
}

export const InstiperLogo: React.FC<InstiperLogoProps> = ({
  size = 40,
  className = '',
}) => {
  return (
    <img
      src="/logo_instiper.png"
      alt="Logo INSTIPER Yogyakarta"
      width={size}
      height={size}
      className={`object-contain shrink-0 drop-shadow-xs ${className}`}
      loading="eager"
    />
  );
};
