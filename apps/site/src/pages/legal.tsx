import type { ReactNode } from 'react';
import type { SiteConfig } from '../config';
import { Page } from '../layout';

/**
 * Minutas de privacidade e termos (ADR 0043). Descrevem só o que o sistema
 * faz hoje (ADR 0009, 0024, 0026, 0029, 0039). O texto final depende do
 * parecer jurídico (pauta, item 4); os campos entre colchetes ficam em aberto.
 */
export const DRAFT_DATE = '16/11/2026';

interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

function LegalPage({
  config,
  path,
  title,
  description,
  sections,
}: {
  config: SiteConfig;
  path: string;
  title: string;
  description: string;
  sections: LegalSection[];
}) {
  return (
    <Page config={config} path={path} title={title} description={description}>
      <section>
        <div className="wrap prose">
          <h1>{title}</h1>
          <p className="notice" role="note">
            <strong>Minuta em revisão jurídica.</strong> Este texto ainda não é
            a versão final e pode mudar. Os trechos entre colchetes estão em
            aberto. Rascunho de {DRAFT_DATE}.
          </p>
          <ul className="toc">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ul>
          {sections.map((s) => (
            <div key={s.id} id={s.id}>
              <h2>{s.title}</h2>
              {s.body}
            </div>
          ))}
        </div>
      </section>
    </Page>
  );
}

export function PrivacyPage({ config }: { config: SiteConfig }) {
  const contact = config.contactEmail ? (
    <a href={`mailto:${config.contactEmail}`}>{config.contactEmail}</a>
  ) : (
    '[e-mail de contato]'
  );
  return (
    <LegalPage
      config={config}
      path="/privacidade/"
      title="Política de privacidade"
      description="Quais dados o Tankei guarda, para quê, por quanto tempo e como exercer os seus direitos (LGPD)."
      sections={[
        {
          id: 'quem-somos',
          title: 'Quem trata os dados',
          body: (
            <>
              <p>
                O Tankei (app, portal do posto e site) é operado por [razão
                social, CNPJ e endereço], a controladora dos dados pessoais
                descritos aqui.
              </p>
              <p>
                Encarregado pelo tratamento de dados (DPO): [nome], pelo e-mail{' '}
                {contact}.
              </p>
            </>
          ),
        },
        {
          id: 'dados',
          title: 'Dados que guardamos',
          body: (
            <>
              <p>
                <strong>Conta:</strong> nome, e-mail, o identificador da conta
                no provedor de login (Google) e o endereço da foto da conta no
                provedor. A foto não é copiada: o app a carrega do próprio
                provedor.
              </p>
              <p>
                <strong>Contribuições:</strong> os preços que você informa e as
                avaliações que faz, com a data. Ao informar um preço, guardamos
                só se você estava ou não no posto (sim ou não), nunca a sua
                localização.
              </p>
              <p>
                <strong>Favoritos e alertas de preço:</strong> os postos que
                você marcou e os alertas que criou.
              </p>
              <p>
                <strong>Responsáveis por postos:</strong> no pedido de acesso ao
                portal, nome, telefone, cargo e uma observação opcional; no
                portal, as ações feitas na conta do posto (por exemplo, quem
                alterou um preço).
              </p>
              <p>
                <strong>Visitas aos postos:</strong> o app registra, sem conta e
                sem localização, quando um posto é tocado no mapa, quanto tempo
                a ficha fica aberta e se a rota foi traçada. O único
                identificador é um código aleatório criado no aparelho, que
                serve para contar visitantes únicos. Os postos veem só totais, e
                números abaixo de 5 aparecem como &quot;menos de 5&quot;. Você
                desliga esse registro no app, em Conta › &quot;Compartilhar
                estatísticas com os postos&quot;.
              </p>
            </>
          ),
        },
        {
          id: 'nao-guardamos',
          title: 'O que não guardamos',
          body: (
            <ul>
              <li>
                A sua localização: ela é usada só durante a busca de postos e
                nas contas feitas no aparelho, e não fica no servidor.
              </li>
              <li>
                &quot;Meu carro&quot; (tanque e consumo) e os seus convênios:
                ficam só no seu celular.
              </li>
              <li>
                Os registros técnicos (logs) não guardam e-mail, senhas, chaves
                de acesso nem coordenadas.
              </li>
              <li>
                Das fotos enviadas pelos postos, removemos a localização gravada
                no arquivo.
              </li>
            </ul>
          ),
        },
        {
          id: 'finalidades',
          title: 'Para que usamos e com que base legal',
          body: (
            <ul>
              <li>
                Manter a sua conta, os favoritos e os alertas, e enviar os
                e-mails que você pediu (alertas de preço) ou que fazem parte do
                serviço (convites, pedidos de acesso): execução do serviço que
                você usa.
              </li>
              <li>
                Mostrar preços e avaliações com a origem, calcular o IQP e
                proteger a plataforma contra informes falsos (peso por
                histórico, detecção de abusos, moderação): legítimo interesse [a
                confirmar no parecer jurídico].
              </li>
              <li>
                Estatísticas de visitas aos postos, sem identificação: legítimo
                interesse, com a opção de desligar [a confirmar no parecer
                jurídico].
              </li>
            </ul>
          ),
        },
        {
          id: 'compartilhamento',
          title: 'Com quem compartilhamos',
          body: (
            <>
              <p>
                Não vendemos dados pessoais. Os postos não veem quem informou um
                preço: no portal, o motorista aparece com um apelido diferente
                em cada posto.
              </p>
              <p>
                Usamos fornecedores que tratam dados em nosso nome: Google
                (login e mapas no app), Render (hospedagem), Supabase (banco de
                dados e arquivos) e Resend (envio de e-mails). Alguns ficam fora
                do Brasil, nos Estados Unidos. [Cláusulas de transferência
                internacional a definir no parecer jurídico.]
              </p>
            </>
          ),
        },
        {
          id: 'exclusao',
          title: 'Exclusão da conta e prazo de guarda',
          body: (
            <>
              <p>
                Você pode pedir a exclusão da sua conta pelo e-mail {contact}
                [e, em breve, no próprio app]. Apagamos nome, e-mail, foto,
                favoritos, alertas e os dados de contato dos pedidos de acesso.
              </p>
              <p>
                Os preços e avaliações que você enviou continuam no histórico,
                sem ligação com você, porque o histórico de preços e o cálculo
                do IQP não podem ser alterados depois.
              </p>
              <p>
                Visitas aos postos: [prazo de guarda a definir no parecer
                jurídico].
              </p>
            </>
          ),
        },
        {
          id: 'direitos',
          title: 'Seus direitos',
          body: (
            <p>
              Pela LGPD (art. 18), você pode pedir a confirmação e o acesso aos
              seus dados, a correção, a anonimização ou a exclusão, a
              portabilidade e informações sobre o compartilhamento. Escreva para{' '}
              {contact}. Você também pode reclamar à Autoridade Nacional de
              Proteção de Dados (ANPD).
            </p>
          ),
        },
        {
          id: 'mudancas',
          title: 'Mudanças nesta política',
          body: (
            <p>
              Avisaremos no app e no site quando esta política mudar, com a data
              da nova versão.
            </p>
          ),
        },
      ]}
    />
  );
}

export function TermsPage({ config }: { config: SiteConfig }) {
  return (
    <LegalPage
      config={config}
      path="/termos/"
      title="Termos de uso"
      description="As regras para usar o app Tankei e o portal do posto: contribuições, moderação, responsabilidades e neutralidade."
      sections={[
        {
          id: 'servico',
          title: 'O serviço',
          body: (
            <>
              <p>
                O Tankei mostra preços de combustível e a qualidade dos postos,
                informados pelos próprios postos e por motoristas. O app é
                gratuito para motoristas. Os postos usam o portal do posto para
                manter as suas informações.
              </p>
              <p>
                Os preços são informativos e podem mudar a qualquer momento.
                Confira o preço na bomba antes de abastecer. Cada preço mostra a
                origem e há quanto tempo foi informado.
              </p>
            </>
          ),
        },
        {
          id: 'conta',
          title: 'Conta',
          body: (
            <p>
              Para informar preços, avaliar postos, guardar favoritos e criar
              alertas, você entra com uma conta Google. Você responde pelo uso
              da sua conta. [Idade mínima a definir no parecer jurídico.]
            </p>
          ),
        },
        {
          id: 'contribuicoes',
          title: 'Preços e avaliações que você envia',
          body: (
            <ul>
              <li>
                Informe só preços que você viu e avalie só postos em que esteve.
              </li>
              <li>
                Você autoriza o Tankei a exibir as suas contribuições, sem o seu
                nome, por tempo indeterminado. Elas fazem parte de um histórico
                que não é apagado: correções viram um registro novo.
              </li>
              <li>
                Para evitar abusos, contas novas ou sem histórico têm menos
                peso, e informes suspeitos podem ser anulados pela equipe
                Tankei.
              </li>
              <li>
                Contas usadas para informar preços falsos de propósito podem ser
                suspensas.
              </li>
            </ul>
          ),
        },
        {
          id: 'postos',
          title: 'Postos e portal do posto',
          body: (
            <ul>
              <li>
                O acesso ao portal é liberado depois da verificação do vínculo
                com o posto. Quem tem acesso responde pelas informações que
                publica (preços, promoções, horário, convênios).
              </li>
              <li>
                Ao enviar fotos e artes, o posto declara ter o direito de
                usá-las e autoriza a exibição no Tankei. A equipe pode remover
                imagens, informando o motivo.
              </li>
              <li>
                O posto não apaga nem esconde preços informados por motoristas.
                Se discordar de um valor, ele contesta pelo portal, e a equipe
                Tankei decide, mantendo ou anulando os informes.
              </li>
              <li>
                [Casos em que o posto pode pedir para não aparecer ou ter os
                preços ocultos: a definir no parecer jurídico.]
              </li>
            </ul>
          ),
        },
        {
          id: 'neutralidade',
          title: 'Neutralidade',
          body: (
            <p>
              Preço não entra na nota do posto (IQP). Nada que é pago (planos,
              destaques, parcerias) altera a nota nem a ordem por menor preço.
              Conteúdo pago, quando existir, será sempre identificado.
            </p>
          ),
        },
        {
          id: 'responsabilidade',
          title: 'Limites de responsabilidade',
          body: (
            <p>
              [Texto a definir no parecer jurídico, considerando o Código de
              Defesa do Consumidor e o Marco Civil da Internet.]
            </p>
          ),
        },
        {
          id: 'privacidade',
          title: 'Privacidade',
          body: (
            <p>
              O uso de dados pessoais segue a{' '}
              <a href="/privacidade/">política de privacidade</a>.
            </p>
          ),
        },
        {
          id: 'geral',
          title: 'Mudanças e foro',
          body: (
            <p>
              Avisaremos no app e no site quando estes termos mudarem. Vale a
              lei brasileira, no foro de [comarca a definir].
            </p>
          ),
        },
      ]}
    />
  );
}
