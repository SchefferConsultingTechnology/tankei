import { Global, Module } from '@nestjs/common';
import { ParametersService } from './parameters.service';

@Global()
@Module({
  providers: [ParametersService],
  exports: [ParametersService],
})
export class ParametersModule {}
