import { Module } from '@nestjs/common';
import { MunicipalitiesService } from './municipalities.service';

@Module({
  providers: [MunicipalitiesService],
  exports: [MunicipalitiesService],
})
export class MunicipalitiesModule {}
