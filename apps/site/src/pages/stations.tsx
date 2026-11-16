import { whatsappLink } from '@tankei/shared';
import { siWhatsapp } from 'simple-icons';
import type { SiteConfig } from '../config';
import { Page } from '../layout';

const BENEFITS = [
  {
    icon: '⚡',
    title: 'Preço em segundos',
    text: 'Atualize os preços pelo celular. O seu preço aparece com o selo "Atualizado pelo posto", o mais confiável do app.',
  },
  {
    icon: '🏷️',
    title: 'Promoções e fotos',
    text: 'Divulgue promoções com arte e prazo, e mostre o posto com fotos. Promoções ganham destaque no mapa e na lista.',
  },
  {
    icon: '🕒',
    title: 'Horário, serviços e convênios',
    text: 'Mostre quando o posto está aberto, os serviços (calibragem, borracharia) e os convênios que aceita.',
  },
  {
    icon: '🔌',
    title: 'Pontos de recarga',
    text: 'Cadastre os carregadores (AC ou DC, conector, potência, acesso e pagamento) e informe o preço por kWh.',
  },
  {
    icon: '📊',
    title: 'Concorrência e histórico',
    text: 'Os preços dos postos próximos, a média da ANP e o histórico de preços do seu posto e dos informes dos clientes.',
  },
  {
    icon: '⭐',
    title: 'Opinião dos clientes',
    text: 'O IQP por dimensão (atendimento, limpeza, transparência, serviços e segurança), para saber onde melhorar.',
  },
  {
    icon: '👥',
    title: 'Equipe e redes',
    text: 'Várias unidades numa conta, com papéis para proprietário, gestor, operador e somente leitura.',
  },
] as const;

const STEPS = [
  {
    title: 'Entre no portal',
    text: 'Com a sua conta Google, no portal do posto.',
  },
  {
    title: 'Encontre o seu posto',
    text: 'Pelo CNPJ ou pelo nome. Todos os postos do cadastro da ANP já estão no Tankei.',
  },
  {
    title: 'Envie os dados',
    text: 'Nome, telefone com DDD e o seu cargo no posto (dono, sócio, gerente).',
  },
  {
    title: 'Verificação',
    text: 'A equipe Tankei entra em contato, confirma o vínculo e libera o acesso. Depois, você convida a sua equipe.',
  },
] as const;

export function StationsPage({ config }: { config: SiteConfig }) {
  const claimUrl = `${config.portalUrl}/acesso?origem=site`;
  const whatsapp = config.supportWhatsapp
    ? whatsappLink(
        config.supportWhatsapp,
        'Olá! Sou responsável por um posto e quero saber mais sobre o portal do Tankei.',
      )
    : null;
  return (
    <Page
      config={config}
      path="/para-postos/"
      title="Para postos"
      description="O seu posto já está no Tankei. Pelo portal, mantenha preços, horário, promoções e fotos em dia e acompanhe a concorrência e a opinião dos clientes."
    >
      <div className="hero">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow">Portal do posto</p>
            <h1>O seu posto já está no Tankei</h1>
            <p className="lead">
              Todo posto do cadastro da ANP aparece no app. Pelo portal, você
              garante que os motoristas vejam o preço certo, o horário, as
              promoções e o que o posto oferece.
            </p>
            <div className="actions">
              <a className="button" href={claimUrl}>
                Pedir acesso ao portal
              </a>
              {whatsapp && <WhatsAppButton href={whatsapp} />}
            </div>
          </div>
          <img
            className="photo wide"
            src="/img/portal-posto-1000.webp"
            srcSet="/img/portal-posto-640.webp 640w, /img/portal-posto-1000.webp 1000w"
            sizes="(min-width: 860px) 520px, calc(100vw - 32px)"
            width={1000}
            height={750}
            fetchPriority="high"
            alt="Gestor no balcão da loja de conveniência acompanhando as visitas ao posto no portal do Tankei, no notebook, e o app no celular"
          />
        </div>
      </div>

      <section>
        <div className="wrap">
          <h2>O que o portal oferece</h2>
          <p className="intro">
            Funciona no celular e no computador, sem instalar nada.
          </p>
          <div className="cards">
            {BENEFITS.map((b) => (
              <article className="card" key={b.title}>
                <div className="icon" aria-hidden="true">
                  {b.icon}
                </div>
                <h3>{b.title}</h3>
                <p>{b.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <h2>Como assumir o seu posto</h2>
          <p className="intro">
            A verificação protege o posto: só quem responde por ele altera as
            informações.
          </p>
          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s.title}>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section>
        <div className="wrap split reverse">
          <div>
            <h2>Regras iguais para todos</h2>
            <p className="intro">
              É isso que faz o motorista confiar no Tankei, e no seu posto.
            </p>
            <ul className="rules">
              <li>
                Nada que é pago altera a nota do posto (IQP) nem a ordem por
                menor preço.
              </li>
              <li>
                O posto não apaga preços informados por motoristas. Se um valor
                estiver errado, o posto contesta pelo portal e a equipe Tankei
                analisa.
              </li>
              <li>
                Quando motoristas confirmam outro valor, o posto é avisado e tem
                um prazo para reconfirmar o próprio preço.
              </li>
              <li>
                O portal mostra apenas informações que o app já mostra
                publicamente. O Tankei não sugere preços.
              </li>
            </ul>
          </div>
          <img
            className="photo landscape"
            src="/img/regras-iguais-1000.webp"
            srcSet="/img/regras-iguais-660.webp 660w, /img/regras-iguais-1000.webp 1000w"
            sizes="(min-width: 860px) 520px, calc(100vw - 32px)"
            width={1000}
            height={667}
            loading="lazy"
            alt="Frentista do posto e motorista, lado a lado junto à bomba, vendo o mesmo mapa de preços do Tankei nos celulares"
          />
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="band">
            <div>
              <h2>Pronto para começar?</h2>
              <p>O pedido leva poucos minutos.</p>
            </div>
            <div className="actions">
              <a className="button" href={claimUrl}>
                Pedir acesso ao portal
              </a>
              {whatsapp && <WhatsAppButton href={whatsapp} />}
            </div>
          </div>
        </div>
      </section>
    </Page>
  );
}

/**
 * Botão do WhatsApp da equipe: verde do WhatsApp (um tom mais escuro, para o
 * texto branco ter contraste) e o ícone oficial (Simple Icons, CC0).
 */
function WhatsAppButton({ href }: { href: string }) {
  return (
    <a className="button whatsapp" href={href} rel="noopener">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d={siWhatsapp.path} />
      </svg>
      Falar no WhatsApp
    </a>
  );
}
