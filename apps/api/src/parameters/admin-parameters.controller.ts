import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  adminParameterSchema,
  parameterChangeSchema,
  updateParameterSchema,
  type AdminParameter,
  type ParameterChange,
} from '@tankei/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { ParametersService } from './parameters.service';

class AdminParameterDto extends createZodDto(adminParameterSchema) {}
class ParameterChangeDto extends createZodDto(parameterChangeSchema) {}
class UpdateParameterDto extends createZodDto(updateParameterSchema) {}

/** Parâmetros das regras de negócio, pelo administrador (ADR 0006). */
@ApiTags('Administração')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/parameters')
export class AdminParametersController {
  constructor(private readonly parameters: ParametersService) {}

  @Get()
  @ZodResponse({
    status: 200,
    type: [AdminParameterDto],
    description: 'Valor vigente de cada parâmetro e a última alteração.',
  })
  list(): Promise<AdminParameter[]> {
    return this.parameters.adminList();
  }

  @Get(':key/history')
  @ZodResponse({
    status: 200,
    type: [ParameterChangeDto],
    description: 'Alterações do parâmetro, as mais recentes primeiro.',
  })
  history(@Param('key') key: string): Promise<ParameterChange[]> {
    return this.parameters.history(key);
  }

  @Put(':key')
  @ZodResponse({
    status: 200,
    type: AdminParameterDto,
    description:
      'Registra um novo valor (o anterior fica no histórico). Vale em até um minuto.',
  })
  update(
    @Param('key') key: string,
    @Body() body: UpdateParameterDto,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<AdminParameter> {
    return this.parameters.adminSet(key, body, admin.id);
  }
}
