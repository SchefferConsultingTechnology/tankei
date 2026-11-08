import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  adhesionDashboardQuerySchema,
  adhesionDashboardSchema,
  type AdhesionDashboard,
  engagementDashboardQuerySchema,
  engagementDashboardSchema,
  type EngagementDashboard,
  adminNetworkQuerySchema,
  adminNetworkSchema,
  adminNetworkSummarySchema,
  adminRemoveMemberSchema,
  adminStationNetworkSchema,
  officialDivergenceSchema,
  setStationModeSchema,
  type OfficialDivergence,
  adminStationSchema,
  adminStationSearchSchema,
  adminStationSummarySchema,
  adminUpdateMemberSchema,
  renameOrganizationSchema,
  type AdminNetwork,
  type AdminNetworkSummary,
  type AdminStation,
  type AdminStationSummary,
} from '@tankei/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { AdminService } from './admin.service';
import { DashboardService } from './dashboard.service';

class AdminStationSearchDto extends createZodDto(adminStationSearchSchema) {}
class AdminStationSummaryDto extends createZodDto(adminStationSummarySchema) {}
class AdminStationDto extends createZodDto(adminStationSchema) {}
class AdminNetworkQueryDto extends createZodDto(adminNetworkQuerySchema) {}
class AdminNetworkSummaryDto extends createZodDto(adminNetworkSummarySchema) {}
class AdminNetworkDto extends createZodDto(adminNetworkSchema) {}
class AdminUpdateMemberDto extends createZodDto(adminUpdateMemberSchema) {}
class AdminRemoveMemberDto extends createZodDto(adminRemoveMemberSchema) {}
class RenameNetworkDto extends createZodDto(renameOrganizationSchema) {}
class AdminStationNetworkDto extends createZodDto(adminStationNetworkSchema) {}
class SetStationModeDto extends createZodDto(setStationModeSchema) {}
class OfficialDivergenceDto extends createZodDto(officialDivergenceSchema) {}

const uuid = (message: string) =>
  new ParseUUIDPipe({
    exceptionFactory: () => new BadRequestException(message),
  });

/** Consulta de postos pela equipe Tankei (ADR 0023). */
@ApiTags('Administração')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/stations')
export class AdminStationsController {
  constructor(
    private readonly admin: AdminService,
    private readonly organizations: OrganizationsService,
  ) {}

  @Get()
  @ZodResponse({
    status: 200,
    type: [AdminStationSummaryDto],
    description: 'Postos por CNPJ, nome ou cidade (até 30), com a rede.',
  })
  search(
    @Query() query: AdminStationSearchDto,
  ): Promise<AdminStationSummary[]> {
    return this.admin.searchStations(query.q);
  }

  @Patch(':stationId/network')
  @HttpCode(204)
  async setNetwork(
    @Param('stationId', uuid('Posto inválido.')) stationId: string,
    @Body() body: AdminStationNetworkDto,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<void> {
    await this.organizations.adminSetStationNetwork(
      admin.id,
      stationId,
      body.networkId,
      body.reason,
    );
  }

  @Patch(':stationId/mode')
  @ZodResponse({
    status: 200,
    type: AdminStationDto,
    description:
      'Muda como o posto aparece no app, a pedido dele, com registro (ADR 0028).',
  })
  setMode(
    @Param('stationId', uuid('Posto inválido.')) stationId: string,
    @Body() body: SetStationModeDto,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<AdminStation> {
    return this.admin.setStationMode(admin.id, stationId, body);
  }

  @Get(':stationId')
  @ZodResponse({ status: 200, type: AdminStationDto })
  station(
    @Param('stationId', uuid('Posto inválido.')) stationId: string,
  ): Promise<AdminStation> {
    return this.admin.station(stationId);
  }
}

/** Suporte às redes: consulta e ajustes na equipe, com motivo (ADR 0023). */
@ApiTags('Administração')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/networks')
export class AdminNetworksController {
  constructor(
    private readonly admin: AdminService,
    private readonly organizations: OrganizationsService,
  ) {}

  @Get()
  @ZodResponse({
    status: 200,
    type: [AdminNetworkSummaryDto],
    description: 'Redes por nome ou e-mail de alguém da equipe (até 100).',
  })
  list(@Query() query: AdminNetworkQueryDto): Promise<AdminNetworkSummary[]> {
    return this.admin.networks(query.q);
  }

  @Get(':networkId')
  @ZodResponse({
    status: 200,
    type: AdminNetworkDto,
    description: 'Unidades, equipe, convites e registro da rede.',
  })
  network(
    @Param('networkId', uuid('Rede inválida.')) networkId: string,
  ): Promise<AdminNetwork> {
    return this.admin.network(networkId);
  }

  @Patch(':networkId')
  @HttpCode(204)
  async rename(
    @Param('networkId', uuid('Rede inválida.')) networkId: string,
    @Body() body: RenameNetworkDto,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<void> {
    await this.organizations.adminRename(admin.id, networkId, body.name);
  }

  @Patch(':networkId/members/:userId')
  @HttpCode(204)
  async updateMember(
    @Param('networkId', uuid('Rede inválida.')) networkId: string,
    @Param('userId', uuid('Usuário inválido.')) userId: string,
    @Body() body: AdminUpdateMemberDto,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<void> {
    await this.organizations.adminUpdateMember(
      admin.id,
      networkId,
      userId,
      body,
    );
  }

  @Post(':networkId/members/:userId/remove')
  @HttpCode(204)
  async removeMember(
    @Param('networkId', uuid('Rede inválida.')) networkId: string,
    @Param('userId', uuid('Usuário inválido.')) userId: string,
    @Body() body: AdminRemoveMemberDto,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<void> {
    await this.organizations.adminRemoveMember(
      admin.id,
      networkId,
      userId,
      body.reason,
    );
  }
}

/** Postos em "preço oficial" com divergência além do prazo (ADR 0028). */
@ApiTags('Administração')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/official-divergences')
export class AdminOfficialDivergencesController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  @ZodResponse({ status: 200, type: [OfficialDivergenceDto] })
  list(): Promise<OfficialDivergence[]> {
    return this.admin.officialDivergences();
  }
}

class AdhesionDashboardDto extends createZodDto(adhesionDashboardSchema) {}
class AdhesionDashboardQueryDto extends createZodDto(
  adhesionDashboardQuerySchema,
) {}
class EngagementDashboardDto extends createZodDto(engagementDashboardSchema) {}
class EngagementDashboardQueryDto extends createZodDto(
  engagementDashboardQuerySchema,
) {}

/** Dashboards do admin (ADR 0037 e 0038). */
@ApiTags('Administração')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('engagement')
  @ZodResponse({ status: 200, type: EngagementDashboardDto })
  engagement(
    @Query() query: EngagementDashboardQueryDto,
  ): Promise<EngagementDashboard> {
    return this.dashboard.engagement(query);
  }

  @Get('adhesion')
  @ZodResponse({ status: 200, type: AdhesionDashboardDto })
  adhesion(
    @Query() query: AdhesionDashboardQueryDto,
  ): Promise<AdhesionDashboard> {
    return this.dashboard.adhesion(query);
  }
}
