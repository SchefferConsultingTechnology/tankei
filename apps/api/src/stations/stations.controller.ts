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
  citiesQuerySchema,
  cityStationsQuerySchema,
  cityStationsSchema,
  cityWithStationsSchema,
  nearbyQuerySchema,
  nearbyStationSchema,
  stationSchema,
  type CityStations,
  type CityWithStations,
  type NearbyStation,
  type Station,
} from '@tankei/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { Public } from '../auth/decorators';
import { StationsService } from './stations.service';

class NearbyQueryDto extends createZodDto(nearbyQuerySchema) {}
class NearbyStationDto extends createZodDto(nearbyStationSchema) {}
class StationDto extends createZodDto(stationSchema) {}
class CitiesQueryDto extends createZodDto(citiesQuerySchema) {}
class CityWithStationsDto extends createZodDto(cityWithStationsSchema) {}
class CityStationsQueryDto extends createZodDto(cityStationsQuerySchema) {}
class CityStationsDto extends createZodDto(cityStationsSchema) {}

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

  @Get('cities')
  @ZodResponse({
    status: 200,
    type: [CityWithStationsDto],
    description: 'Cidades da UF com postos ativos, em ordem alfabética.',
  })
  findCities(@Query() query: CitiesQueryDto): Promise<CityWithStations[]> {
    return this.stations.findCities(query.state);
  }

  @Get()
  @ZodResponse({
    status: 200,
    type: CityStationsDto,
    description:
      'Postos de uma cidade com preços e IQP, os mais baratos primeiro.',
  })
  findByMunicipality(
    @Query() query: CityStationsQueryDto,
  ): Promise<CityStations> {
    return this.stations.findByMunicipality(query);
  }

  // Depois das rotas fixas ("nearby", "cities"): senão o NestJS as trataria como id.
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
