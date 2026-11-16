import {
  BADGE_DESCRIPTIONS,
  BADGE_LABELS,
  CONTRIBUTOR_LEVEL_DESCRIPTIONS,
  CONTRIBUTOR_LEVEL_LABELS,
  CONTRIBUTOR_LEVELS,
  HOW_IT_WORKS,
  IQP_CRITERION_LABELS,
  IQP_DIMENSION_CRITERIA,
  IQP_DIMENSION_LABELS,
  IQP_DIMENSIONS,
  type HelpSection,
  type PriceBadge,
} from '@tankei/shared';
import type { ReactNode } from 'react';
import type { SiteConfig } from '../config';
import { Page } from '../layout';
import { BADGE_ORDER } from './home';

/**
 * "Como funciona" (ADR 0030 e 0043): os mesmos textos do app (help.ts), com
 * um exemplo visual ao lado de cada tema. Os exemplos são ilustrativos:
 * posto, preços e notas fictícios, montados com os rótulos do app.
 */

const FLOW = [
  {
    title: 'Alguém informa',
    text: 'O posto atualiza o preço no portal, ou um motorista informa o que viu na bomba, pelo app.',
  },
  {
    title: 'O Tankei confere',
    text: 'O valor é comparado com a média da ANP. Muito fora dela, pede confirmação ou não é aceito.',
  },
  {
    title: 'Outros confirmam',
    text: 'Quando pessoas diferentes informam o mesmo valor, o preço ganha o selo de confirmado.',
  },
  {
    title: 'Aparece no app',
    text: 'Com a origem e há quanto tempo foi informado. Sem informe novo por alguns dias, fica como desatualizado.',
  },
] as const;

const FAQ: { q: string; a: string }[] = [
  {
    q: 'O Tankei é pago?',
    a: 'Não. O app é gratuito para motoristas.',
  },
  {
    q: 'Preciso criar uma conta?',
    a: 'Para consultar preços, não. A conta (com o Google) serve para informar preços, avaliar postos, guardar favoritos e criar alertas de preço.',
  },
  {
    q: 'O Tankei guarda a minha localização?',
    a: 'Não. A localização é usada só na busca de postos e nas contas feitas no celular. Ao informar um preço, o Tankei guarda apenas se você estava ou não no posto.',
  },
  {
    q: 'O posto que paga aparece primeiro?',
    a: 'Não. Nada que é pago altera a ordem por menor preço nem a nota do posto. Conteúdo pago, quando existir, será sempre identificado.',
  },
  {
    q: 'Vi um preço errado. O que eu faço?',
    a: 'Na ficha do posto, informe o preço que você viu na bomba. O seu informe entra no histórico e, quando outras pessoas confirmam o mesmo valor, o preço exibido muda.',
  },
  {
    q: 'O posto pode apagar o preço que eu informei?',
    a: 'Não. Se discordar, o posto contesta pelo portal, e a equipe Tankei analisa e decide se mantém ou anula o informe.',
  },
  {
    q: 'Funciona para carro elétrico?',
    a: 'Sim. O app mostra os pontos de recarga nos postos, com potência, conector e preço por kWh, e indica se o conector serve no seu carro.',
  },
  {
    q: 'Funciona na minha cidade?',
    a: 'Todos os postos do cadastro da ANP aparecem no mapa, em todo o Brasil. Os preços aparecem onde postos e motoristas informam: quanto mais gente usa, mais completo fica.',
  },
  {
    q: 'Quando o app estará disponível?',
    a: 'Em breve, no Google Play e na App Store.',
  },
];

/** Exemplo visual de cada tema do app. */
const EXAMPLES: Record<string, () => ReactNode> = {
  precos: PricesExample,
  divergencia: DivergenceExample,
  iqp: IqpExample,
  promocoes: PromotionExample,
  contribuicao: ContributorExample,
};

export function HowItWorksPage({ config }: { config: SiteConfig }) {
  return (
    <Page
      config={config}
      path="/como-funciona/"
      title="Como funciona"
      description="De onde vêm os preços no Tankei, o que significam os selos, o aviso de outro valor, como funciona o IQP, as promoções e as regras para quem informa preços."
    >
      <div className="hero">
        <div className="wrap">
          <p className="eyebrow">Como funciona</p>
          <h1>Preços com origem, notas que não se compram</h1>
          <p className="lead">
            Os mesmos textos que você encontra no app, em &quot;Como
            funciona&quot;, com exemplos de como cada coisa aparece na tela.
          </p>
          <ul className="toc on-hero">
            {HOW_IT_WORKS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
            <li>
              <a href="#perguntas">Perguntas frequentes</a>
            </li>
          </ul>
        </div>
      </div>

      <section>
        <div className="wrap">
          <h2>Do informe ao app</h2>
          <p className="intro">O caminho de um preço até aparecer para você.</p>
          <ol className="steps">
            {FLOW.map((s) => (
              <li key={s.title}>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {HOW_IT_WORKS.map((section, i) => (
        <Topic key={section.id} section={section} reverse={i % 2 === 1} />
      ))}

      <section id="selos">
        <div className="wrap">
          <h2>Os selos de preço</h2>
          <p className="intro">
            Cada preço no app vem com um destes selos, na cor da origem.
          </p>
          <ul className="badges">
            {BADGE_ORDER.map((badge) => (
              <li key={badge}>
                <span className={`badge badge-${badge}`}>
                  {BADGE_LABELS[badge]}
                </span>
                : {BADGE_DESCRIPTIONS[badge]}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="perguntas">
        <div className="wrap prose">
          <h2>Perguntas frequentes</h2>
          <div className="faq">
            {FAQ.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
          <p className="note">
            É responsável por um posto? Veja{' '}
            <a href="/para-postos/">o portal do posto</a>.
          </p>
        </div>
      </section>
    </Page>
  );
}

function Topic({
  section,
  reverse,
}: {
  section: HelpSection;
  reverse: boolean;
}) {
  const Example = EXAMPLES[section.id];
  return (
    <section id={section.id}>
      <div className={`wrap split${reverse ? ' reverse' : ''}`}>
        <div className="prose">
          <h2>{section.title}</h2>
          {section.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        {Example && (
          <figure className="mock">
            <Example />
            <figcaption>Exemplo ilustrativo</figcaption>
          </figure>
        )}
      </div>
    </section>
  );
}

// ---------- Exemplos (posto e valores fictícios) ----------

function MockHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mock-head">
      <strong>{title}</strong>
      <span>{sub}</span>
    </div>
  );
}

function PriceRow({
  fuel,
  price,
  badge,
  age,
  note,
}: {
  fuel: string;
  price: string;
  badge: PriceBadge;
  age: string;
  note?: string;
}) {
  return (
    <div className="mock-row">
      <div>
        <div>{fuel}</div>
        <div className={`badge small badge-${badge}`}>
          {BADGE_LABELS[badge]} · {age}
        </div>
        {note && <div className="mock-note">{note}</div>}
      </div>
      <div className="mock-price">
        R$ {price}
        <span>/L</span>
      </div>
    </div>
  );
}

function PricesExample() {
  return (
    <div className="mock-card">
      <MockHeader title="Posto Exemplo" sub="Aberto · fecha às 22:00" />
      <PriceRow
        fuel="Gasolina comum"
        price="5,99"
        badge="atualizado_posto"
        age="há 20 min"
      />
      <PriceRow
        fuel="Etanol"
        price="4,29"
        badge="confirmado_motoristas"
        age="há 2 h"
      />
      <PriceRow
        fuel="Diesel S10"
        price="6,19"
        badge="informado_motorista"
        age="há 1 dia"
      />
      <div className="mock-row">
        <div>
          <div>Gasolina aditivada</div>
          <div className="mock-note">
            {BADGE_LABELS.informado_motorista} · desatualizado, há 6 dias
          </div>
        </div>
        <div className="mock-price faded">
          R$ 6,39<span>/L</span>
        </div>
      </div>
    </div>
  );
}

function DivergenceExample() {
  return (
    <div className="mock-card">
      <MockHeader title="Posto Exemplo" sub="Gasolina comum" />
      <PriceRow
        fuel="Gasolina comum"
        price="5,99"
        badge="atualizado_posto"
        age="há 3 h"
        note="Consumidores informaram R$ 6,19"
      />
      <ol className="mock-timeline">
        <li>Motoristas confirmam outro valor</li>
        <li>O posto é avisado e tem um prazo para responder</li>
        <li>Sem resposta, passa a valer o valor dos consumidores</li>
      </ol>
    </div>
  );
}

function IqpExample() {
  const scores = [88, 79, 92, 74, 85];
  return (
    <div className="mock-card">
      <div className="mock-iqp">
        <div className="mock-score">
          82<span>/100</span>
        </div>
        <div className="mock-note">Confiança média · 37 pessoas avaliaram</div>
      </div>
      <ul className="mock-dims">
        {IQP_DIMENSIONS.map((d, i) => (
          <li key={d}>
            <div className="mock-dim-head">
              <span>{IQP_DIMENSION_LABELS[d]}</span>
              <strong>{scores[i]}</strong>
            </div>
            <div className="bar">
              <span style={{ width: `${scores[i]}%` }} />
            </div>
            {criteriaNote(d) && (
              <div className="mock-note">{criteriaNote(d)}</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Itens avaliados na dimensão, quando dizem algo além do nome dela. */
function criteriaNote(d: (typeof IQP_DIMENSIONS)[number]): string | null {
  const labels = IQP_DIMENSION_CRITERIA[d].map((c) => IQP_CRITERION_LABELS[c]);
  if (labels.length === 1 && IQP_DIMENSION_LABELS[d].startsWith(labels[0])) {
    return null;
  }
  return labels.join(' · ');
}

function PromotionExample() {
  return (
    <div className="mock-card">
      <div className="mock-promo">
        <span>Promoção</span>
        <span>até sábado, 22:00</span>
      </div>
      <MockHeader title="Posto Exemplo" sub="Semana do motorista" />
      <PriceRow
        fuel="Gasolina comum"
        price="5,79"
        badge="promocao"
        age="preço promocional"
      />
      <p className="mock-note pad">
        A promoção aparece em destaque no mapa e na lista, mas não muda a ordem
        por menor preço nem a nota do posto.
      </p>
    </div>
  );
}

function ContributorExample() {
  return (
    <div className="mock-card">
      <MockHeader title="Sua contribuição" sub="Visível só para você" />
      <div className="mock-stats">
        <div>
          <strong>24</strong>
          <span>preços aceitos</span>
        </div>
        <div>
          <strong>6</strong>
          <span>nos últimos 30 dias</span>
        </div>
        <div>
          <strong>9</strong>
          <span>postos ajudados</span>
        </div>
      </div>
      <ul className="mock-levels">
        {CONTRIBUTOR_LEVELS.map((level, i) => (
          <li key={level} className={i === 2 ? 'current' : undefined}>
            <strong>{CONTRIBUTOR_LEVEL_LABELS[level]}</strong>
            <span>{CONTRIBUTOR_LEVEL_DESCRIPTIONS[level]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
