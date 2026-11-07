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
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  adminAgreementSchema,
  agreementSchema,
  agreementSearchSchema,
  createAgreementSchema,
  setStationAgreementSchema,
  stationAgreementSchema,
  updateAgreementSchema,
  type AdminAgreement,
  type Agreement,
  type StationAgreement,
} from '@tankei/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { AgreementsService } from './agreements.service';

class AgreementDto extends createZodDto(agreementSchema) {}
class AgreementSearchDto extends createZodDto(agreementSearchSchema) {}
class CreateAgreementDto extends createZodDto(createAgreementSchema) {}
class SetStationAgreementDto extends createZodDto(setStationAgreementSchema) {}
class StationAgreementDto extends createZodDto(stationAgreementSchema) {}
class AdminAgreementDto extends createZodDto(adminAgreementSchema) {}
class UpdateAgreementDto extends createZodDto(updateAgreementSchema) {}

const uuid = (message: string) =>
  new ParseUUIDPipe({
    exceptionFactory: () => new BadRequestException(message),
  });

/** Cadastro de convênios, visto pelo portal (ADR 0034). */
@ApiTags('Portal do posto')
@ApiBearerAuth()
@Controller('portal/agreements')
export class PortalAgreementsController {
  constructor(private readonly agreements: AgreementsService) {}

  @Get()
  @ZodResponse({
    status: 200,
    type: [AgreementDto],
    description: 'Convênios ativos pelo nome (até 20).',
  })
  search(@Query() query: AgreementSearchDto): Promise<Agreement[]> {
    return this.agreements.search(query.q);
  }

  @Post()
  @ZodResponse({
    status: 201,
    type: AgreementDto,
    description: 'Cria; com o mesmo nome (sem acento), devolve o existente.',
  })
  create(
    @Body() body: CreateAgreementDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Agreement> {
    return this.agreements.createFromPortal(user.id, body);
  }
}

/** Descontos do posto nos convênios (ADR 0034). */
@ApiTags('Portal do posto')
@ApiBearerAuth()
@Controller('portal/stations/:stationId/agreements')
export class StationAgreementsController {
  constructor(private readonly agreements: AgreementsService) {}

  @Get()
  @ZodResponse({ status: 200, type: [StationAgreementDto] })
  list(
    @Param('stationId', uuid('Posto inválido.')) stationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StationAgreement[]> {
    return this.agreements.forPortal(user, stationId);
  }

  @Put(':agreementId')
  @ZodResponse({
    status: 200,
    type: [StationAgreementDto],
    description: 'Proprietário e gestor. Cria uma versão nova dos descontos.',
  })
  set(
    @Param('stationId', uuid('Posto inválido.')) stationId: string,
    @Param('agreementId', uuid('Convênio inválido.')) agreementId: string,
    @Body() body: SetStationAgreementDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StationAgreement[]> {
    return this.agreements.setDiscounts(user, stationId, agreementId, body);
  }

  @Post(':agreementId/end')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: [StationAgreementDto] })
  end(
    @Param('stationId', uuid('Posto inválido.')) stationId: string,
    @Param('agreementId', uuid('Convênio inválido.')) agreementId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StationAgreement[]> {
    return this.agreements.end(user, stationId, agreementId);
  }
}

/** Cadastro de convênios pela equipe Tankei (ADR 0034). */
@ApiTags('Administração')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/agreements')
export class AdminAgreementsController {
  constructor(private readonly agreements: AgreementsService) {}

  @Get()
  @ZodResponse({ status: 200, type: [AdminAgreementDto] })
  list(): Promise<AdminAgreement[]> {
    return this.agreements.adminList();
  }

  @Post()
  @ZodResponse({ status: 201, type: AdminAgreementDto })
  create(
    @Body() body: CreateAgreementDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminAgreement> {
    return this.agreements.adminCreate(user.id, body);
  }

  @Patch(':agreementId')
  @ZodResponse({ status: 200, type: AdminAgreementDto })
  update(
    @Param('agreementId', uuid('Convênio inválido.')) agreementId: string,
    @Body() body: UpdateAgreementDto,
  ): Promise<AdminAgreement> {
    return this.agreements.adminUpdate(agreementId, body);
  }

  @Delete(':agreementId')
  @HttpCode(204)
  async remove(
    @Param('agreementId', uuid('Convênio inválido.')) agreementId: string,
  ): Promise<void> {
    await this.agreements.adminRemove(agreementId);
  }
}
