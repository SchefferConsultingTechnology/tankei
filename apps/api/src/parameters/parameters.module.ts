import { Global, Module } from '@nestjs/common';
import { AdminParametersController } from './admin-parameters.controller';
import { ParametersService } from './parameters.service';

@Global()
@Module({
  controllers: [AdminParametersController],
  providers: [ParametersService],
  exports: [ParametersService],
})
export class ParametersModule {}
