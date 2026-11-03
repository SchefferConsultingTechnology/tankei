import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  ParseEnumPipe,
  ParseFloatPipe,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import {
  FUEL_TYPES,
  NEARBY_DEFAULT_RADIUS_M,
  NEARBY_MAX_RADIUS_M,
  type FuelType,
  type NearbyStation,
} from '@tankei/shared';
import { StationsService } from './stations.service';

const FUEL_TYPE_ENUM = Object.fromEntries(FUEL_TYPES.map((f) => [f, f]));

// Os pipes do NestJS respondem em inglês; as mensagens da API são em português.
const invalid = (message: string) => () => new BadRequestException(message);

@Controller('stations')
export class StationsController {
  constructor(private readonly stations: StationsService) {}

  /** GET /v1/stations/nearby?lat=-27.29&lng=-50.58&radius=5000&fuel=etanol */
  @Get('nearby')
  findNearby(
    @Query(
      'lat',
      new ParseFloatPipe({ exceptionFactory: invalid('Latitude inválida.') }),
    )
    lat: number,
    @Query(
      'lng',
      new ParseFloatPipe({ exceptionFactory: invalid('Longitude inválida.') }),
    )
    lng: number,
    @Query(
      'radius',
      new DefaultValuePipe(NEARBY_DEFAULT_RADIUS_M),
      new ParseIntPipe({ exceptionFactory: invalid('Raio inválido.') }),
    )
    radius: number,
    @Query(
      'fuel',
      new ParseEnumPipe(FUEL_TYPE_ENUM, {
        optional: true,
        exceptionFactory: invalid(
          `Combustível inválido. Use: ${FUEL_TYPES.join(', ')}.`,
        ),
      }),
    )
    fuel?: FuelType,
  ): Promise<NearbyStation[]> {
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new BadRequestException('Coordenadas inválidas.');
    }
    if (radius < 1 || radius > NEARBY_MAX_RADIUS_M) {
      throw new BadRequestException(
        `O raio deve estar entre 1 e ${NEARBY_MAX_RADIUS_M} metros.`,
      );
    }
    return this.stations.findNearby({ lat, lng, radiusMeters: radius, fuel });
  }
}
