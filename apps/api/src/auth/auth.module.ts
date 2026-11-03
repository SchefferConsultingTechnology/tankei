import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users/users.module';
import { authConfigProvider } from './auth.config';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { identityVerifiersProvider } from './identity/identity-verifiers.provider';
import { TokensService } from './tokens.service';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    authConfigProvider,
    identityVerifiersProvider,
    TokensService,
    AuthService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [TokensService],
})
export class AuthModule {}
