import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  nearbyQuerySchema,
  nearbyStationSchema,
  stationSchema,
  type NearbyStation,
  type Station,
} from '@tankei/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { Public } from '../auth/decorators';
import { StationsService } from './stations.service';

class NearbyQueryDto extends createZodDto(nearbyQuerySchema) {}
class NearbyStationDto extends createZodDto(nearbyStationSchema) {}
class StationDto extends createZodDto(stationSchema) {}

@ApiTags('Postos')
@Public()
@Controller('stations')
export class StationsController {
  constructor(private readonly stations: StationsService) {}

  @Get('nearby')
  @ZodResponse({
    status: 200,
    type: [NearbyStationDto],
    description:
      'Postos ativos dentro do raio, do mais próximo ao mais distante. Postos sem coordenada não aparecem.',
  })
  findNearby(@Query() query: NearbyQueryDto): Promise<NearbyStation[]> {
    return this.stations.findNearby(query);
  }

  // Depois de "nearby": senão o NestJS trataria "nearby" como um id.
  @Get(':id')
  @ZodResponse({ status: 200, type: StationDto })
  findById(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () => new BadRequestException('Posto inválido.'),
      }),
    )
    id: string,
  ): Promise<Station> {
    return this.stations.findById(id);
  }
}
