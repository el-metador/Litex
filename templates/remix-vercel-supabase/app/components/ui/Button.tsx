import type { ButtonHTMLAttributes, CSSProperties } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export function Button({ variant = 'primary', style, ...props }: ButtonProps) {
  const baseStyle: CSSProperties = {
    borderRadius: 10,
    border: '1px solid transparent',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    padding: '10px 14px',
    transition: 'all 0.2s ease',
  };

  const variantStyle: CSSProperties =
    variant === 'secondary'
      ? {
          background: '#111827',
          borderColor: '#334155',
          color: '#cbd5e1',
        }
      : {
          background: '#22c55e',
          color: '#052e16',
        };

  return <button {...props} style={{ ...baseStyle, ...variantStyle, ...style }} />;
}
