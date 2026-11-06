/**
 * Textos dos e-mails (ADR 0025): HTML simples, com a versão em texto. Dados
 * vindos de cadastro (nomes, motivos) sempre escapados.
 */

export interface MailMessage {
  subject: string;
  html: string;
  text: string;
}

const NAVY = '#012049';
const MUTED = '#5B6B85';

export const links = {
  portal: (path = '') =>
    `${(process.env.PORTAL_URL || 'http://localhost:5173').replace(/\/$/, '')}${path}`,
  admin: (path = '') =>
    `${(process.env.ADMIN_URL || 'http://localhost:5174').replace(/\/$/, '')}${path}`,
};

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
}

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

export const formatMoney = (value: number) => money.format(value);

/** Data e hora no fuso de Brasília: "07/11, 10h55". */
export function formatWhen(date: Date): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}/${get('month')}, ${get('hour')}h${get('minute')}`;
}

/** Parágrafo: texto já escapado pode conter <strong>. */
type Block = { html: string; text: string };

const p = (html: string, text: string): Block => ({ html, text });

function layout(
  subject: string,
  blocks: Block[],
  action?: { label: string; url: string },
): MailMessage {
  const body = blocks
    .map(
      (b) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#0F1B33">${b.html}</p>`,
    )
    .join('');
  const button = action
    ? `<p style="margin:20px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:${NAVY};color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(action.label)}</a></p>`
    : '';
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F5F7FB;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px">
<p style="margin:0 0 16px;font-size:20px;font-weight:800;color:${NAVY}">Tankei</p>
<div style="background:#fff;border:1px solid #D9E0EA;border-radius:12px;padding:24px">${body}${button}</div>
<p style="margin:16px 0 0;font-size:12px;color:${MUTED}">Você recebeu este e-mail porque tem uma conta no Tankei.</p>
</div></body></html>`;
  const text = [
    ...blocks.map((b) => b.text),
    ...(action ? [`${action.label}: ${action.url}`] : []),
  ].join('\n\n');
  return { subject, html, text };
}

const e = escapeHtml;

// ---------- Equipe ----------

export function invitationMail(input: {
  organizationName: string;
  inviterName: string | null;
  roleLabel: string;
  stations: string[];
  expiresAt: Date;
}): MailMessage {
  const who = input.inviterName ?? 'A equipe da rede';
  const units =
    input.stations.length > 0
      ? input.stations.join(', ')
      : 'todas as unidades da rede';
  return layout(
    `Convite para a equipe de ${input.organizationName}`,
    [
      p(
        `${e(who)} convidou você para a equipe de <strong>${e(input.organizationName)}</strong> no portal do posto do Tankei, como <strong>${e(input.roleLabel)}</strong>.`,
        `${who} convidou você para a equipe de ${input.organizationName} no portal do posto do Tankei, como ${input.roleLabel}.`,
      ),
      p(`Unidades: ${e(units)}.`, `Unidades: ${units}.`),
      p(
        `Entre no portal com uma conta Google deste e-mail e aceite o convite. Ele vale até ${e(formatWhen(input.expiresAt))}.`,
        `Entre no portal com uma conta Google deste e-mail e aceite o convite. Ele vale até ${formatWhen(input.expiresAt)}.`,
      ),
    ],
    { label: 'Abrir o portal', url: links.portal() },
  );
}

export function ownerlessNetworkMail(input: {
  id: string;
  name: string;
}): MailMessage {
  return layout(
    `Rede sem proprietário: ${input.name}`,
    [
      p(
        `A rede <strong>${e(input.name)}</strong> ficou sem proprietário: a última conta proprietária foi excluída. Ninguém gerencia a equipe dela.`,
        `A rede ${input.name} ficou sem proprietário: a última conta proprietária foi excluída. Ninguém gerencia a equipe dela.`,
      ),
      p(
        'Promova alguém da equipe a proprietário ou vincule um responsável pelo posto.',
        'Promova alguém da equipe a proprietário ou vincule um responsável pelo posto.',
      ),
    ],
    { label: 'Abrir a rede', url: links.admin(`/redes/${input.id}`) },
  );
}

// ---------- Pedido de acesso (ADR 0019 e 0011) ----------

export function claimToAdminsMail(input: {
  stationName: string;
  city: string;
  contactName: string;
  positionLabel: string;
}): MailMessage {
  return layout(
    `Novo pedido de acesso: ${input.stationName}`,
    [
      p(
        `<strong>${e(input.contactName)}</strong> (${e(input.positionLabel)}) pediu acesso a <strong>${e(input.stationName)}</strong>, ${e(input.city)}.`,
        `${input.contactName} (${input.positionLabel}) pediu acesso a ${input.stationName}, ${input.city}.`,
      ),
      p(
        'Ligue para o contato, confirme o vínculo com o posto e registre a decisão.',
        'Ligue para o contato, confirme o vínculo com o posto e registre a decisão.',
      ),
    ],
    { label: 'Ver pedidos de acesso', url: links.admin('/') },
  );
}

export function claimToOwnersMail(input: {
  stationId: string;
  stationName: string;
  contactName: string;
  positionLabel: string;
}): MailMessage {
  const what =
    'Se você não reconhece este pedido, abra o portal e toque em “Não reconheço” no aviso do pedido, antes de a equipe Tankei decidir.';
  return layout(
    `Pedido de acesso a ${input.stationName}`,
    [
      p(
        `<strong>${e(input.contactName)}</strong> (${e(input.positionLabel)}) pediu acesso a <strong>${e(input.stationName)}</strong> no portal do Tankei.`,
        `${input.contactName} (${input.positionLabel}) pediu acesso a ${input.stationName} no portal do Tankei.`,
      ),
      p(
        'A equipe Tankei confirma o vínculo com o posto antes de liberar o acesso.',
        'A equipe Tankei confirma o vínculo com o posto antes de liberar o acesso.',
      ),
      p(e(what), what),
    ],
    {
      label: 'Ver no portal',
      url: links.portal(`/postos/${input.stationId}/precos`),
    },
  );
}

export function claimDisputedMail(input: {
  stationName: string;
  ownerName: string;
  contactName: string;
  reason: string;
}): MailMessage {
  return layout(
    `Pedido contestado pelo proprietário: ${input.stationName}`,
    [
      p(
        `<strong>${e(input.ownerName)}</strong>, proprietário de <strong>${e(input.stationName)}</strong>, não reconhece o pedido de acesso de ${e(input.contactName)}.`,
        `${input.ownerName}, proprietário de ${input.stationName}, não reconhece o pedido de acesso de ${input.contactName}.`,
      ),
      p(`Motivo: ${e(input.reason)}`, `Motivo: ${input.reason}`),
    ],
    { label: 'Ver pedidos de acesso', url: links.admin('/') },
  );
}

export function claimDecidedMail(input: {
  stationName: string;
  approved: boolean;
  reason: string | null;
}): MailMessage {
  if (input.approved) {
    return layout(
      `Acesso liberado: ${input.stationName}`,
      [
        p(
          `Seu acesso a <strong>${e(input.stationName)}</strong> no portal do posto foi aprovado.`,
          `Seu acesso a ${input.stationName} no portal do posto foi aprovado.`,
        ),
        p(
          'Agora você atualiza preços, acompanha a concorrência e a reputação e pode convidar sua equipe.',
          'Agora você atualiza preços, acompanha a concorrência e a reputação e pode convidar sua equipe.',
        ),
      ],
      { label: 'Abrir o portal', url: links.portal() },
    );
  }
  return layout(
    `Pedido de acesso recusado: ${input.stationName}`,
    [
      p(
        `Seu pedido de acesso a <strong>${e(input.stationName)}</strong> foi recusado.`,
        `Seu pedido de acesso a ${input.stationName} foi recusado.`,
      ),
      ...(input.reason
        ? [p(`Motivo: ${e(input.reason)}`, `Motivo: ${input.reason}`)]
        : []),
    ],
    { label: 'Ver no portal', url: links.portal('/acesso') },
  );
}

// ---------- Preços (ADR 0020 e 0024) ----------

export function divergenceMail(input: {
  stationId: string;
  stationName: string;
  fuelLabel: string;
  stationPrice: number;
  consumerPrice: number;
  respondBy: Date;
}): MailMessage {
  return layout(
    `${input.fuelLabel}: consumidores informaram outro preço em ${input.stationName}`,
    [
      p(
        `Consumidores confirmaram <strong>${e(formatMoney(input.consumerPrice))}</strong> para ${e(input.fuelLabel.toLowerCase())} em <strong>${e(input.stationName)}</strong>. O seu preço é ${e(formatMoney(input.stationPrice))}.`,
        `Consumidores confirmaram ${formatMoney(input.consumerPrice)} para ${input.fuelLabel.toLowerCase()} em ${input.stationName}. O seu preço é ${formatMoney(input.stationPrice)}.`,
      ),
      p(
        `O app continua mostrando o seu preço, com o aviso. Reconfirme, corrija ou conteste até <strong>${e(formatWhen(input.respondBy))}</strong>; sem resposta, o valor dos consumidores passa a valer.`,
        `O app continua mostrando o seu preço, com o aviso. Reconfirme, corrija ou conteste até ${formatWhen(input.respondBy)}; sem resposta, o valor dos consumidores passa a valer.`,
      ),
    ],
    {
      label: 'Responder no portal',
      url: links.portal(`/postos/${input.stationId}/precos`),
    },
  );
}

export function moderationOpenedMail(input: {
  kindLabel: string;
  stationName: string;
  fuelLabel: string;
  reports: number;
  reason: string | null;
}): MailMessage {
  return layout(
    `Moderação: ${input.kindLabel.toLowerCase()} em ${input.stationName}`,
    [
      p(
        `${e(input.kindLabel)} em <strong>${e(input.stationName)}</strong>, ${e(input.fuelLabel.toLowerCase())}: ${input.reports} ${input.reports === 1 ? 'informe' : 'informes'} fora do preço até a decisão.`,
        `${input.kindLabel} em ${input.stationName}, ${input.fuelLabel.toLowerCase()}: ${input.reports} ${input.reports === 1 ? 'informe' : 'informes'} fora do preço até a decisão.`,
      ),
      ...(input.reason ? [p(e(input.reason), input.reason)] : []),
    ],
    { label: 'Abrir a moderação', url: links.admin('/moderacao') },
  );
}

export function moderationDecidedMail(input: {
  stationId: string;
  stationName: string;
  fuelLabel: string;
  annulled: boolean;
  isContest: boolean;
  reason: string;
}): MailMessage {
  const what = input.isContest
    ? 'Sua contestação'
    : 'A análise de informes suspeitos';
  const result = input.annulled
    ? 'Os informes foram anulados e não contam mais no preço.'
    : 'Os informes foram mantidos e voltam a contar no preço.';
  return layout(
    `${input.isContest ? 'Contestação' : 'Análise'} decidida: ${input.fuelLabel} em ${input.stationName}`,
    [
      p(
        `${e(what)} de ${e(input.fuelLabel.toLowerCase())} em <strong>${e(input.stationName)}</strong> foi decidida pela equipe Tankei. ${e(result)}`,
        `${what} de ${input.fuelLabel.toLowerCase()} em ${input.stationName} foi decidida pela equipe Tankei. ${result}`,
      ),
      p(`Explicação: ${e(input.reason)}`, `Explicação: ${input.reason}`),
    ],
    {
      label: 'Ver contestações',
      url: links.portal(`/postos/${input.stationId}/precos/contestacoes`),
    },
  );
}
