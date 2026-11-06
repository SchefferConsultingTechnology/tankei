import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/** E-mails transacionais (ADR 0025), disponíveis em toda a API. */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
