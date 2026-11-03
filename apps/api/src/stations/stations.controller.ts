import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  nearbyQuerySchema,
  nearbyStationSchema,
  type NearbyStation,
} from '@tankei/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { StationsService } from './stations.service';

class NearbyQueryDto extends createZodDto(nearbyQuerySchema) {}
class NearbyStationDto extends createZodDto(nearbyStationSchema) {}

@ApiTags('Postos')
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
}
