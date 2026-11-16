import {
  BADGE_DESCRIPTIONS,
  BADGE_LABELS,
  IQP_SUMMARY,
  type PriceBadge,
} from '@tankei/shared';
import type { SiteConfig } from '../config';
import { Page } from '../layout';

/** Ordem dos selos: do mais para o menos confiável, e a promoção no fim. */
export const BADGE_ORDER: PriceBadge[] = [
  'atualizado_posto',
  'confirmado_motoristas',
  'informado_motorista',
  'promocao',
];

const FEATURES = [
  {
    icon: '⛽',
    title: 'Menor preço perto de você',
    text: 'Mapa e lista dos postos da região, do mais barato ao mais caro, para o combustível que você usa. Também busca por cidade.',
  },
  {
    icon: '★',
    title: 'Qualidade do posto (IQP)',
    text: 'Uma nota de 0 a 100 dada por quem abastece: atendimento, limpeza, banheiro, calibrador, segurança e se o preço na bomba era o anunciado.',
  },
  {
    icon: '🏷️',
    title: 'Promoções e convênios',
    text: 'Promoções com prazo, cadastradas pelo posto, e os descontos de convênios que cada posto aceita.',
  },
  {
    icon: '🧮',
    title: 'Etanol ou gasolina?',
    text: 'A conta com o consumo do seu carro, e se vale a pena ir até um posto mais barato mais longe.',
  },
  {
    icon: '🔔',
    title: 'Favoritos e alerta de preço',
    text: 'Guarde os postos do dia a dia e receba um e-mail quando o preço cair até o valor que você escolher.',
  },
  {
    icon: '🛣️',
    title: 'Na estrada',
    text: 'No modo direção, o mapa gira no sentido do carro e mostra mais da estrada à frente, com o horário e os serviços de cada posto.',
  },
] as const;

export function HomePage({ config }: { config: SiteConfig }) {
  return (
    <Page
      config={config}
      path="/"
      title="Tankei: preço de combustível e qualidade do posto"
      description="Compare o preço da gasolina, do etanol e do diesel nos postos perto de você e veja a nota de qualidade dada por quem abastece."
    >
      <div className="hero">
        <div className="wrap">
          <p className="eyebrow">App gratuito para motoristas</p>
          <h1>Preço de combustível e qualidade do posto, por quem abastece</h1>
          <p className="lead">
            Veja onde está mais barato perto de você, de onde veio cada preço e
            como os motoristas avaliam o posto.
          </p>
          <div className="actions">
            <span className="store" aria-label="Google Play: em breve">
              <small>Em breve</small>
              <strong>Google Play</strong>
            </span>
            <span className="store" aria-label="App Store: em breve">
              <small>Em breve</small>
              <strong>App Store</strong>
            </span>
            <a className="button ghost" href="/como-funciona/">
              Como funciona
            </a>
          </div>
        </div>
      </div>

      <section>
        <div className="wrap">
          <h2>O que o app faz</h2>
          <p className="intro">
            Tudo pensado para decidir rápido onde abastecer, na cidade ou na
            estrada.
          </p>
          <div className="cards">
            {FEATURES.map((f) => (
              <article className="card" key={f.title}>
                <div className="icon" aria-hidden="true">
                  {f.icon}
                </div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <h2>Cada preço mostra de onde veio</h2>
          <p className="intro">
            Postos e motoristas informam os preços. Você sempre vê a origem e há
            quanto tempo o preço foi informado, para saber o quanto confiar.
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

      <section>
        <div className="wrap">
          <h2>Regras que não mudam</h2>
          <p className="intro">{IQP_SUMMARY}</p>
          <ul className="rules">
            <li>
              Preço não entra na nota do posto, e nada que é pago (planos,
              anúncios, parcerias) altera a nota ou a ordem por menor preço.
            </li>
            <li>
              Nenhum preço ou avaliação é apagado: correções viram um registro
              novo, e o histórico fica guardado.
            </li>
            <li>
              O posto não esconde preço informado por motoristas. Se discordar,
              ele contesta, e a equipe Tankei analisa.
            </li>
            <li>A sua localização é usada só na busca e nunca é guardada.</li>
          </ul>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="band">
            <div>
              <h2>É responsável por um posto?</h2>
              <p>
                O seu posto já está no Tankei. Pelo portal, você mantém preços,
                horário, promoções e fotos em dia.
              </p>
            </div>
            <a className="button" href="/para-postos/">
              Conheça o portal do posto
            </a>
          </div>
        </div>
      </section>
    </Page>
  );
}
