import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { Resend } from 'resend';
import { DRIZZLE, type Database } from '../database/database.module';
import { users } from '../database/schema';
import type { MailMessage } from './templates';

const DEFAULT_FROM = 'Tankei <nao-responda@scheffer.solutions>';

/**
 * E-mails transacionais pelo Resend (ADR 0025). Sem RESEND_API_KEY
 * (desenvolvimento e testes), nada sai: o envio só é registrado no log.
 * Falha no envio nunca desfaz a ação que o originou: só é registrada.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly client: Resend | null;
  private readonly from: string;
  private readonly replyTo: string | undefined;

  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    const key = process.env.RESEND_API_KEY;
    this.client = key ? new Resend(key) : null;
    this.from = process.env.MAIL_FROM || DEFAULT_FROM;
    this.replyTo = process.env.MAIL_REPLY_TO || undefined;
  }

  /** Endereço de resposta, se configurado (os textos mudam com ele). */
  get hasReplyTo(): boolean {
    return Boolean(this.replyTo);
  }

  /** Um e-mail por destinatário (ninguém vê o endereço do outro). */
  async send(to: string[], message: MailMessage): Promise<void> {
    const recipients = [
      ...new Set(to.map((e) => e.trim().toLowerCase())),
    ].filter(Boolean);
    for (const address of recipients) {
      if (!this.client) {
        this.logger.log(`[sem envio] ${address}: ${message.subject}`);
        continue;
      }
      try {
        const { error } = await this.client.emails.send({
          from: this.from,
          to: address,
          replyTo: this.replyTo,
          subject: message.subject,
          html: message.html,
          text: message.text,
        });
        if (error) throw new Error(error.message);
      } catch (error) {
        this.logger.error(
          `Falha ao enviar "${message.subject}" para ${address}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  /** Dispara sem esperar: a resposta da API não depende do e-mail. */
  notify(to: string[], message: MailMessage): void {
    this.background(() => this.send(to, message));
  }

  /**
   * Roda um aviso em segundo plano. Erro (ex.: consulta dos destinatários)
   * só é registrado: nunca derruba o processo nem a requisição.
   */
  background(task: () => Promise<void>): void {
    task().catch((error: unknown) =>
      this.logger.error(
        `Falha ao preparar e-mail: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }

  /** E-mails da equipe Tankei (perfil administrador). */
  async adminEmails(): Promise<string[]> {
    const rows = await this.db
      .select({ email: users.email })
      .from(users)
      .where(
        and(
          eq(users.role, 'admin'),
          isNull(users.deletedAt),
          isNotNull(users.email),
        ),
      );
    return rows.flatMap((r) => (r.email ? [r.email] : []));
  }

  /** E-mail de uma conta ativa, se houver. */
  async emailOf(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ email: users.email })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)));
    return row?.email ?? null;
  }
}
