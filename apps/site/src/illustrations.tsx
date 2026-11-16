/**
 * Ilustrações do site (ADR 0043): desenhos originais em SVG, sem fotos nem
 * marcas de terceiros. Os valores, nomes e notas são fictícios. As cores vêm
 * de variáveis CSS (--ill-*), para funcionar nos temas claro e escuro.
 */

import type { ReactNode } from 'react';

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Cores fixas da marca e dos selos de preço (ADR 0003, 0017). */
const C = {
  orange: '#E8590C',
  green: '#15803D',
};

function Svg({
  title,
  viewBox,
  children,
  className = 'illustration',
}: {
  title: string;
  viewBox: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox={viewBox}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      fontFamily={FONT}
    >
      <title>{title}</title>
      {children}
    </svg>
  );
}

/** Chamada para postos: o posto com bombas, loja e carregador. */
export function StationIllustration() {
  return (
    <Svg
      title="Posto de combustível com cobertura, bombas, loja de conveniência e ponto de recarga"
      viewBox="0 0 400 260"
    >
      <rect
        x={0}
        y={0}
        width={400}
        height={260}
        rx={24}
        fill="var(--ill-panel)"
      />
      <rect
        x={20}
        y={214}
        width={360}
        height={6}
        rx={3}
        fill="var(--ill-muted)"
      />
      {/* Loja */}
      <rect
        x={250}
        y={120}
        width={124}
        height={94}
        rx={8}
        fill="var(--ill-paper)"
      />
      <rect x={250} y={112} width={124} height={18} rx={6} fill={C.orange} />
      <rect x={264} y={146} width={44} height={36} rx={4} fill="#DCEBFA" />
      <rect
        x={322}
        y={146}
        width={36}
        height={68}
        rx={4}
        fill="var(--ill-ink)"
        opacity={0.85}
      />
      {/* Cobertura */}
      <rect
        x={30}
        y={62}
        width={210}
        height={26}
        rx={8}
        fill="var(--ill-ink)"
      />
      <rect x={30} y={84} width={210} height={6} fill={C.orange} />
      <rect x={60} y={90} width={10} height={124} fill="var(--ill-muted)" />
      <rect x={200} y={90} width={10} height={124} fill="var(--ill-muted)" />
      {/* Bombas */}
      {[92, 150].map((x) => (
        <g key={x} transform={`translate(${x} 150)`}>
          <rect width={30} height={64} rx={6} fill="var(--ill-paper)" />
          <rect x={6} y={8} width={18} height={12} rx={2} fill="#0A1430" />
          <rect x={6} y={28} width={18} height={4} rx={2} fill={C.green} />
          <rect x={6} y={36} width={18} height={4} rx={2} fill={C.orange} />
        </g>
      ))}
      {/* Placa de preços */}
      <g transform="translate(46 112)">
        <rect width={8} height={102} fill="var(--ill-muted)" />
      </g>
      <g transform="translate(20 20)">
        <rect width={64} height={92} rx={8} fill="var(--ill-paper)" />
        <rect x={8} y={10} width={48} height={14} rx={3} fill={C.orange} />
        {['5,99', '4,29', '6,89'].map((p, i) => (
          <text
            key={p}
            x={32}
            y={44 + i * 18}
            textAnchor="middle"
            fontSize={13}
            fontWeight={800}
            fill="var(--ill-ink)"
          >
            {p}
          </text>
        ))}
      </g>
      {/* Carregador elétrico */}
      <g transform="translate(222 150)">
        <rect width={20} height={64} rx={5} fill={C.green} />
        <path d="M11 14 l-5 10 h6 l-4 10 l10 -14 h-6 l4 -6 z" fill="#fff" />
      </g>
    </Svg>
  );
}
