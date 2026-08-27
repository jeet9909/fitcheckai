import type { CSSProperties, ReactNode } from 'react';

interface PlaceholderProps {
  ratio?: string;
  radius?: number;
  fontSize?: number;
  padding?: number;
  style?: CSSProperties;
  children?: ReactNode;
}

export default function Placeholder({ ratio = '3/4', radius = 12, fontSize = 11, padding = 12, style, children }: PlaceholderProps) {
  return (
    <div
      className="placeholder-swatch"
      style={{
        aspectRatio: ratio,
        borderRadius: radius,
        fontSize,
        padding,
        position: 'relative',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
