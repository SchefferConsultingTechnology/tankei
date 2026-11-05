import { Module } from '@nestjs/common';
import { AccessService } from './access.service';
import { OrganizationsService } from './organizations.service';

/** Redes, equipe e permissões por posto (ADR 0021). */
@Module({
  providers: [AccessService, OrganizationsService],
  exports: [AccessService, OrganizationsService],
})
export class OrganizationsModule {}
