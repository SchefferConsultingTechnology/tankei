/**
 * Configuração do build do site (ADR 0043), por variável de ambiente. Não são
 * regras de negócio: são endereços e chaves de infraestrutura.
 */
export interface SiteConfig {
  /** Endereço base do site, sem barra no fim. */
  url: string;
  /** Só homologação e produção aparecem no Google (ADR 0036). */
  indexing: boolean;
  /** Portal do posto, para o pedido de acesso. */
  portalUrl: string;
  /** WhatsApp Business da equipe (ADR 0031); vazio esconde o botão. */
  supportWhatsapp: string;
  /** E-mail de contato; vazio esconde. */
  contactEmail: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): SiteConfig {
  return {
    url: (env.SITE_URL || 'http://localhost:4173').replace(/\/+$/, ''),
    indexing: env.SITE_INDEXING === '1',
    portalUrl: (env.PORTAL_URL || 'http://localhost:5173').replace(/\/+$/, ''),
    supportWhatsapp: env.SUPPORT_WHATSAPP ?? '',
    contactEmail: env.CONTACT_EMAIL ?? '',
  };
}
