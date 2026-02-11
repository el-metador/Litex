import type { CSSProperties, InputHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ style, ...props }: InputProps) {
  const baseStyle: CSSProperties = {
    width: '100%',
    borderRadius: 10,
    border: '1px solid #334155',
    background: '#0b1220',
    color: '#e2e8f0',
    padding: '10px 12px',
  };

  return <input {...props} style={{ ...baseStyle, ...style }} />;
}
