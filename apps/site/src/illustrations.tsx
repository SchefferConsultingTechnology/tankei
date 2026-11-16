/**
 * Ilustrações do site (ADR 0043): desenhos originais em SVG, sem fotos nem
 * marcas de terceiros. Os valores, nomes e notas são fictícios. As cores vêm
 * de variáveis CSS (--ill-*), para funcionar nos temas claro e escuro.
 */

import type { ReactNode } from 'react';

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Cores fixas da marca e dos selos de preço (ADR 0003, 0017). */
const C = {
  navy: '#012049',
  orange: '#E8590C',
  orangeLight: '#FF7A1A',
  green: '#15803D',
  blue: '#1D4ED8',
  amber: '#B45309',
  map: '#E9EFF6',
  road: '#FFFFFF',
  park: '#CDE8D3',
  water: '#B9D7F2',
  text: '#0F1B33',
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

/** Etiqueta de preço sobre o mapa, apontando para o posto. */
function PriceTag({
  x,
  y,
  price,
  color,
}: {
  x: number;
  y: number;
  price: string;
  color: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-34} y={-30} width={68} height={24} rx={12} fill={color} />
      <path d="M-6 -6 L0 2 L6 -6 Z" fill={color} />
      <text
        x={0}
        y={-13.5}
        textAnchor="middle"
        fontSize={12}
        fontWeight={800}
        fill="#fff"
      >
        {price}
      </text>
      <circle cx={0} cy={6} r={4} fill={color} stroke="#fff" strokeWidth={2} />
    </g>
  );
}

/** Topo da página inicial: o app com o mapa de preços e o cartão do posto. */
export function PhoneMapIllustration() {
  return (
    <Svg
      title="Celular com o mapa do Tankei: preços nos postos e o cartão de um posto com a nota de qualidade"
      viewBox="0 0 340 420"
      className="illustration hero-art"
    >
      {/* Brilho atrás do aparelho */}
      <circle cx={190} cy={210} r={150} fill="#1B3A73" opacity={0.55} />
      <circle cx={52} cy={330} r={40} fill={C.orangeLight} opacity={0.3} />
      {/* Aparelho */}
      <rect x={80} y={12} width={190} height={396} rx={32} fill="#0A1430" />
      <rect x={90} y={26} width={170} height={368} rx={22} fill={C.map} />
      <clipPath id="phone-screen">
        <rect x={90} y={26} width={170} height={368} rx={22} />
      </clipPath>
      <g clipPath="url(#phone-screen)">
        {/* Mapa */}
        <rect x={150} y={70} width={70} height={60} rx={8} fill={C.park} />
        <path
          d="M90 300 C 140 280, 170 320, 260 290"
          stroke={C.water}
          strokeWidth={14}
          fill="none"
        />
        <path
          d="M90 120 L260 180 M130 26 L170 394 M90 240 L260 230 M220 26 L240 394"
          stroke={C.road}
          strokeWidth={10}
          fill="none"
        />
        <path
          d="M90 120 L260 180"
          stroke="#F6D88E"
          strokeWidth={6}
          fill="none"
        />
        {/* Barra de busca */}
        <rect x={102} y={40} width={146} height={28} rx={14} fill="#fff" />
        <circle
          cx={118}
          cy={54}
          r={5}
          fill="none"
          stroke={C.muted}
          strokeWidth={2}
        />
        <rect x={130} y={51} width={70} height={6} rx={3} fill="#C9D3E1" />
        <PriceTag x={140} y={128} price="R$ 5,99" color={C.green} />
        <PriceTag x={214} y={168} price="R$ 6,19" color={C.blue} />
        <PriceTag x={128} y={232} price="R$ 6,29" color={C.amber} />
        {/* Posição da pessoa */}
        <circle cx={196} cy={252} r={14} fill={C.blue} opacity={0.2} />
        <circle
          cx={196}
          cy={252}
          r={6}
          fill={C.blue}
          stroke="#fff"
          strokeWidth={2}
        />
        {/* Cartão do posto */}
        <rect x={98} y={300} width={154} height={84} rx={14} fill="#fff" />
        <text x={110} y={322} fontSize={12} fontWeight={800} fill={C.text}>
          Posto Exemplo
        </text>
        <text x={110} y={338} fontSize={9.5} fill={C.muted}>
          Aberto · fecha às 22:00
        </text>
        <rect x={110} y={348} width={52} height={20} rx={10} fill={C.map} />
        <text
          x={136}
          y={362}
          fontSize={10}
          fontWeight={800}
          textAnchor="middle"
          fill={C.text}
        >
          IQP 86
        </text>
        <text
          x={240}
          y={364}
          fontSize={16}
          fontWeight={800}
          textAnchor="end"
          fill={C.text}
        >
          R$ 5,99
        </text>
        <text
          x={240}
          y={376}
          fontSize={8}
          textAnchor="end"
          fill={C.green}
          fontWeight={700}
        >
          Atualizado pelo posto
        </text>
      </g>
      {/* Câmera */}
      <rect x={152} y={32} width={46} height={8} rx={4} fill="#0A1430" />
      {/* Bomba de combustível ao lado */}
      <g transform="translate(10 286)">
        <rect x={14} y={14} width={40} height={60} rx={8} fill={C.orange} />
        <rect x={22} y={24} width={24} height={16} rx={3} fill="#fff" />
        <path
          d="M54 30 h10 v34 a6 6 0 0 1 -12 0 v-8"
          stroke="#fff"
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </Svg>
  );
}

/** Seção de recarga: carregador DC ligado a um carro elétrico. */
export function EvChargerIllustration() {
  return (
    <Svg
      title="Carro elétrico ligado a um carregador rápido DC no posto, com o preço por kWh"
      viewBox="0 0 400 280"
    >
      <rect
        x={0}
        y={0}
        width={400}
        height={280}
        rx={24}
        fill="var(--ill-panel)"
      />
      {/* Chão */}
      <rect
        x={24}
        y={226}
        width={352}
        height={6}
        rx={3}
        fill="var(--ill-muted)"
      />
      {/* Carregador */}
      <rect
        x={42}
        y={70}
        width={70}
        height={156}
        rx={12}
        fill="var(--ill-ink)"
      />
      <rect x={52} y={84} width={50} height={40} rx={6} fill="#0A1430" />
      <text
        x={77}
        y={101}
        textAnchor="middle"
        fontSize={11}
        fontWeight={800}
        fill="#4ADE80"
      >
        DC
      </text>
      <text x={77} y={116} textAnchor="middle" fontSize={10} fill="#C9D4E6">
        60 kW
      </text>
      <path
        d="M72 140 l-8 16 h10 l-6 16 l16 -22 h-10 l6 -10 z"
        fill={C.orangeLight}
      />
      {/* Cabo até o carro */}
      <path
        d="M112 150 C 150 150, 140 206, 180 198 S 212 178, 222 178"
        stroke="var(--ill-ink)"
        strokeWidth={7}
        fill="none"
        strokeLinecap="round"
      />
      {/* Carro */}
      <g transform="translate(146 120)">
        <path
          d="M10 86 C 8 66, 20 56, 46 52 L 84 24 C 92 18, 104 16, 116 16 L 160 16 C 176 16, 186 22, 194 32 L 214 54 C 230 58, 238 66, 238 86 Z"
          fill={C.orange}
        />
        <path d="M92 30 L 122 26 L 122 52 L 70 52 Z" fill="#DCEBFA" />
        <path
          d="M132 26 L 160 26 C 170 26, 176 30, 182 38 L 192 52 L 132 52 Z"
          fill="#DCEBFA"
        />
        <rect x={210} y={62} width={22} height={8} rx={4} fill="#FFE3B3" />
        <circle cx={62} cy={88} r={22} fill="#0A1430" />
        <circle cx={62} cy={88} r={9} fill="#C9D4E6" />
        <circle cx={190} cy={88} r={22} fill="#0A1430" />
        <circle cx={190} cy={88} r={9} fill="#C9D4E6" />
      </g>
      {/* Cartão de preço */}
      <g transform="translate(232 28)">
        <rect width={146} height={64} rx={14} fill="var(--ill-paper)" />
        <text x={14} y={24} fontSize={11} fontWeight={700} fill={C.muted}>
          Recarga DC
        </text>
        <text
          x={14}
          y={48}
          fontSize={20}
          fontWeight={800}
          fill="var(--ill-ink)"
        >
          R$ 2,19
          <tspan fontSize={11} fontWeight={600} fill={C.muted}>
            /kWh
          </tspan>
        </text>
      </g>
      {/* Selo "serve no seu carro" */}
      <g transform="translate(150 28)">
        <rect width={74} height={28} rx={14} fill={C.green} />
        <text
          x={37}
          y={18.5}
          textAnchor="middle"
          fontSize={10.5}
          fontWeight={800}
          fill="#fff"
        >
          ✓ CCS2
        </text>
      </g>
    </Svg>
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

/** Página para postos: o portal no notebook e no celular. */
export function PortalIllustration() {
  const bars = [46, 70, 58, 88, 64, 96, 80];
  return (
    <Svg
      title="Portal do posto no notebook e no celular: preços, gráfico de visitas e promoções"
      viewBox="0 0 400 320"
      className="illustration hero-art"
    >
      <circle cx={210} cy={160} r={140} fill="#1B3A73" opacity={0.55} />
      {/* Notebook */}
      <rect x={30} y={50} width={290} height={190} rx={14} fill="#0A1430" />
      <rect x={40} y={60} width={270} height={170} rx={6} fill="#F5F7FB" />
      <rect x={40} y={60} width={64} height={170} fill={C.navy} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect
          key={i}
          x={50}
          y={80 + i * 22}
          width={44}
          height={8}
          rx={4}
          fill="#fff"
          opacity={i === 1 ? 1 : 0.45}
        />
      ))}
      <text x={116} y={82} fontSize={11} fontWeight={800} fill={C.text}>
        Visitas ao posto
      </text>
      {bars.map((h, i) => (
        <rect
          key={i}
          x={120 + i * 24}
          y={190 - h}
          width={16}
          height={h}
          rx={3}
          fill={i === 5 ? C.orange : C.navy}
          opacity={i === 5 ? 1 : 0.8}
        />
      ))}
      <rect x={116} y={196} width={184} height={2} fill="#D9E0EA" />
      <rect x={116} y={206} width={86} height={16} rx={8} fill={C.green} />
      <text
        x={159}
        y={217.5}
        textAnchor="middle"
        fontSize={9}
        fontWeight={800}
        fill="#fff"
      >
        Preços em dia
      </text>
      <path d="M10 240 H340 L322 256 H28 Z" fill="#26324F" />
      {/* Celular */}
      <rect x={290} y={110} width={92} height={180} rx={16} fill="#0A1430" />
      <rect x={297} y={122} width={78} height={158} rx={10} fill="#fff" />
      <text x={305} y={142} fontSize={9} fontWeight={800} fill={C.text}>
        Preços atuais
      </text>
      {['5,99', '6,39', '4,29'].map((p, i) => (
        <g key={p} transform={`translate(305 ${152 + i * 30})`}>
          <rect width={62} height={24} rx={6} fill="#EEF2F7" />
          <text
            x={56}
            y={16}
            textAnchor="end"
            fontSize={11}
            fontWeight={800}
            fill={C.text}
          >
            {p}
          </text>
          <rect x={6} y={9} width={20} height={6} rx={3} fill="#C9D3E1" />
        </g>
      ))}
      <rect x={305} y={246} width={62} height={22} rx={11} fill={C.orange} />
      <text
        x={336}
        y={260.5}
        textAnchor="middle"
        fontSize={9}
        fontWeight={800}
        fill="#fff"
      >
        Salvar
      </text>
    </Svg>
  );
}
