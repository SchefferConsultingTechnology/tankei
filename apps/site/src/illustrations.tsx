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
  orangeLight: '#FF7A1A',
  green: '#15803D',
  muted: '#5B6B85',
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

/** Seção das regras: o medidor do IQP de 0 a 100, com as dimensões. */
export function IqpGaugeIllustration() {
  // Arco de 180°: 0 à esquerda, 100 à direita; 86 de exemplo.
  const r = 92;
  const cx = 200;
  const cy = 150;
  const angle = Math.PI * (1 - 0.86);
  const end = { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
  const dims = [
    ['Atendimento', 90],
    ['Limpeza', 82],
    ['Transparência', 91],
    ['Segurança', 85],
  ] as const;
  return (
    <Svg
      title="Medidor do IQP marcando 86 de 100, com as notas por dimensão"
      viewBox="0 0 400 300"
    >
      <rect
        x={0}
        y={0}
        width={400}
        height={300}
        rx={24}
        fill="var(--ill-panel)"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        stroke="var(--ill-muted)"
        strokeWidth={18}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${end.x.toFixed(1)} ${end.y.toFixed(1)}`}
        stroke={C.orangeLight}
        strokeWidth={18}
        fill="none"
        strokeLinecap="round"
      />
      <text
        x={cx}
        y={cy - 12}
        textAnchor="middle"
        fontSize={46}
        fontWeight={800}
        fill="var(--ill-ink)"
      >
        86
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={13} fill={C.muted}>
        de 100
      </text>
      {dims.map(([label, score], i) => (
        <g
          key={label}
          transform={`translate(${40 + (i % 2) * 170} ${192 + Math.floor(i / 2) * 44})`}
        >
          <text
            x={0}
            y={0}
            fontSize={12}
            fontWeight={600}
            fill="var(--ill-ink)"
          >
            {label}
          </text>
          <rect
            x={0}
            y={8}
            width={150}
            height={8}
            rx={4}
            fill="var(--ill-muted)"
          />
          <rect
            x={0}
            y={8}
            width={1.5 * score}
            height={8}
            rx={4}
            fill="var(--ill-ink)"
          />
        </g>
      ))}
    </Svg>
  );
}

/** Chamada para postos: o posto com bombas, loja e carregador. */
export function StationIllustration({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <Svg
      title="Posto de combustível com cobertura, bombas, loja de conveniência e ponto de recarga"
      viewBox="0 0 400 260"
      className={compact ? 'illustration compact' : 'illustration'}
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
