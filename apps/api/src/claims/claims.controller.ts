import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  adminClaimSchema,
  adminClaimsQuerySchema,
  approveClaimSchema,
  claimableStationSchema,
  claimSchema,
  claimStationSearchSchema,
  createClaimSchema,
  disputeClaimSchema,
  rejectClaimSchema,
  stationClaimNoticeSchema,
  type StationClaimNotice,
  type AdminClaim,
  type Claim,
  type ClaimableStation,
} from '@tankei/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { ClaimsService } from './claims.service';

class ClaimStationSearchDto extends createZodDto(claimStationSearchSchema) {}
class ClaimableStationDto extends createZodDto(claimableStationSchema) {}
class CreateClaimDto extends createZodDto(createClaimSchema) {}
class ClaimDto extends createZodDto(claimSchema) {}
class AdminClaimDto extends createZodDto(adminClaimSchema) {}
class AdminClaimsQueryDto extends createZodDto(adminClaimsQuerySchema) {}
class ApproveClaimDto extends createZodDto(approveClaimSchema) {}
class RejectClaimDto extends createZodDto(rejectClaimSchema) {}
class StationClaimNoticeDto extends createZodDto(stationClaimNoticeSchema) {}
class DisputeClaimDto extends createZodDto(disputeClaimSchema) {}

const claimIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('Pedido inválido.'),
});

const stationIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('Posto inválido.'),
});

/** Pedido para gerenciar um posto no portal (ADR 0019). */
@ApiTags('Reivindicação de posto')
@ApiBearerAuth()
@Controller('claims')
export class ClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Get('stations')
  @ZodResponse({
    status: 200,
    type: [ClaimableStationDto],
    description: 'Postos ativos por CNPJ ou nome (até 20).',
  })
  search(@Query() query: ClaimStationSearchDto): Promise<ClaimableStation[]> {
    return this.claims.searchStations(query);
  }

  @Get('stations/:stationId')
  @ZodResponse({
    status: 200,
    type: ClaimableStationDto,
    description:
      'Um posto ativo, para o pedido que já chega com o posto (ADR 0031).',
  })
  station(
    @Param('stationId', stationIdPipe) stationId: string,
  ): Promise<ClaimableStation> {
    return this.claims.claimableStation(stationId);
  }

  @Post()
  @ZodResponse({ status: 201, type: ClaimDto })
  create(
    @Body() body: CreateClaimDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Claim> {
    return this.claims.create(user.id, body);
  }

  @Get('mine')
  @ZodResponse({
    status: 200,
    type: [ClaimDto],
    description: 'Pedidos da pessoa, os mais recentes primeiro.',
  })
  mine(@CurrentUser() user: AuthenticatedUser): Promise<Claim[]> {
    return this.claims.mine(user.id);
  }
}

/** Fila de pedidos do administrador (ADR 0019). */
@ApiTags('Administração')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/claims')
export class AdminClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Get()
  @ZodResponse({
    status: 200,
    type: [AdminClaimDto],
    description: 'Pedidos por situação; em análise, os mais antigos primeiro.',
  })
  list(@Query() query: AdminClaimsQueryDto): Promise<AdminClaim[]> {
    return this.claims.adminList(query.status);
  }

  @Post(':claimId/approve')
  @HttpCode(200)
  @ZodResponse({
    status: 200,
    type: AdminClaimDto,
    description:
      'Aprova e cria o vínculo de responsável com a forma de verificação.',
  })
  approve(
    @Param('claimId', claimIdPipe) claimId: string,
    @Body() body: ApproveClaimDto,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<AdminClaim> {
    return this.claims.approve(claimId, admin.id, body);
  }

  @Post(':claimId/reject')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: AdminClaimDto })
  reject(
    @Param('claimId', claimIdPipe) claimId: string,
    @Body() body: RejectClaimDto,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<AdminClaim> {
    return this.claims.reject(claimId, admin.id, body.reason);
  }
}

/**
 * Pedidos de acesso ao posto vistos pelo proprietário atual, que pode dizer
 * que não reconhece o pedido (ADR 0011 e 0027).
 */
@ApiTags('Portal do posto')
@ApiBearerAuth()
@Controller('portal/stations/:stationId/claims')
export class StationClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Get()
  @ZodResponse({
    status: 200,
    type: [StationClaimNoticeDto],
    description: 'Pedidos em análise de outras pessoas para o posto.',
  })
  list(
    @Param('stationId', stationIdPipe) stationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StationClaimNotice[]> {
    return this.claims.stationNotices(user, stationId);
  }

  @Post(':claimId/dispute')
  @HttpCode(204)
  async dispute(
    @Param('stationId', stationIdPipe) stationId: string,
    @Param('claimId', claimIdPipe) claimId: string,
    @Body() body: DisputeClaimDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.claims.dispute(user, stationId, claimId, body.reason);
  }
}
