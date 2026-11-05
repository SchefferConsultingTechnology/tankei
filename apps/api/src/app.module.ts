import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ZodSerializerInterceptor } from 'nestjs-zod';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ZodValidationPipe } from './app.setup';
import { AuthModule } from './auth/auth.module';
import { ClaimsModule } from './claims/claims.module';
import { DatabaseModule } from './database/database.module';
import { ParametersModule } from './parameters/parameters.module';
import { PortalModule } from './portal/portal.module';
import { PricesModule } from './prices/prices.module';
import { StationsModule } from './stations/stations.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // Limite por IP (ADR 0008). Configuração de infraestrutura, por variável de ambiente.
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL_MS ?? 60_000),
        limit: Number(process.env.THROTTLE_LIMIT ?? 120),
      },
    ]),
    ScheduleModule.forRoot(),
    DatabaseModule,
    ParametersModule,
    StationsModule,
    PricesModule,
    UsersModule,
    AuthModule,
    PortalModule,
    ClaimsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Valida e filtra as respostas pelos schemas declarados com @ZodResponse.
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
