import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  bulkPriceResultSchema,
  bulkPriceSchema,
  createInvitationSchema,
  invitationSchema,
  myInvitationSchema,
  organizationOverviewSchema,
  renameOrganizationSchema,
  teamSchema,
  updateMemberSchema,
  type BulkPriceResult,
  type Invitation,
  type MyInvitation,
  type OrganizationOverview,
  type Team,
} from '@tankei/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { CurrentUser } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { NetworkService } from './network.service';

class OrganizationOverviewDto extends createZodDto(
  organizationOverviewSchema,
) {}
class RenameOrganizationDto extends createZodDto(renameOrganizationSchema) {}
class BulkPriceDto extends createZodDto(bulkPriceSchema) {}
class BulkPriceResultDto extends createZodDto(bulkPriceResultSchema) {}
class TeamDto extends createZodDto(teamSchema) {}
class CreateInvitationDto extends createZodDto(createInvitationSchema) {}
class InvitationDto extends createZodDto(invitationSchema) {}
class UpdateMemberDto extends createZodDto(updateMemberSchema) {}
class MyInvitationDto extends createZodDto(myInvitationSchema) {}

const uuid = (message: string) =>
  new ParseUUIDPipe({
    exceptionFactory: () => new BadRequestException(message),
  });
const orgPipe = uuid('Rede inválida.');

/** Rede de postos no portal: visão geral, preço em lote e equipe (ADR 0021). */
@ApiTags('Portal do posto')
@ApiBearerAuth()
@Controller('portal/organizations/:organizationId')
export class NetworkController {
  constructor(
    private readonly network: NetworkService,
    private readonly organizations: OrganizationsService,
  ) {}

  @Get()
  @ZodResponse({
    status: 200,
    type: OrganizationOverviewDto,
    description:
      'Unidades do escopo da pessoa com o preço vigente de cada combustível.',
  })
  overview(
    @Param('organizationId', orgPipe) organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrganizationOverview> {
    return this.network.overview(user, organizationId);
  }

  @Patch()
  @HttpCode(204)
  rename(
    @Param('organizationId', orgPipe) organizationId: string,
    @Body() body: RenameOrganizationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.organizations.rename(user, organizationId, body.name);
  }

  @Post('prices')
  @HttpCode(200)
  @ZodResponse({
    status: 200,
    type: BulkPriceResultDto,
    description:
      'Mesmo preço em várias unidades; cada uma passa pelas regras de um informe individual.',
  })
  bulkPrice(
    @Param('organizationId', orgPipe) organizationId: string,
    @Body() body: BulkPriceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BulkPriceResult> {
    return this.network.bulkPrice(user, organizationId, body);
  }

  @Get('team')
  @ZodResponse({ status: 200, type: TeamDto, description: 'Só proprietários.' })
  team(
    @Param('organizationId', orgPipe) organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Team> {
    return this.organizations.team(user, organizationId);
  }

  @Post('invitations')
  @ZodResponse({ status: 201, type: InvitationDto })
  invite(
    @Param('organizationId', orgPipe) organizationId: string,
    @Body() body: CreateInvitationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Invitation> {
    return this.organizations.invite(user, organizationId, body);
  }

  @Delete('invitations/:invitationId')
  @HttpCode(204)
  revoke(
    @Param('organizationId', orgPipe) organizationId: string,
    @Param('invitationId', uuid('Convite inválido.')) invitationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.organizations.revokeInvitation(
      user,
      organizationId,
      invitationId,
    );
  }

  @Patch('members/:userId')
  @HttpCode(204)
  updateMember(
    @Param('organizationId', orgPipe) organizationId: string,
    @Param('userId', uuid('Pessoa inválida.')) userId: string,
    @Body() body: UpdateMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.organizations.updateMember(user, organizationId, userId, body);
  }

  @Delete('members/:userId')
  @HttpCode(204)
  removeMember(
    @Param('organizationId', orgPipe) organizationId: string,
    @Param('userId', uuid('Pessoa inválida.')) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.organizations.removeMember(user, organizationId, userId);
  }
}

/** Convites recebidos por quem entrou no portal (ADR 0021). */
@ApiTags('Portal do posto')
@ApiBearerAuth()
@Controller('portal/invitations')
export class MyInvitationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  @ZodResponse({
    status: 200,
    type: [MyInvitationDto],
    description: 'Convites pendentes para o e-mail da conta.',
  })
  mine(@CurrentUser() user: AuthenticatedUser): Promise<MyInvitation[]> {
    return this.organizations.myInvitations(user.id);
  }

  @Post(':invitationId/accept')
  @HttpCode(204)
  accept(
    @Param('invitationId', uuid('Convite inválido.')) invitationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.organizations.accept(user.id, invitationId);
  }

  @Post(':invitationId/decline')
  @HttpCode(204)
  decline(
    @Param('invitationId', uuid('Convite inválido.')) invitationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.organizations.decline(user.id, invitationId);
  }
}
