import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  authTokensSchema,
  loginRequestSchema,
  loginResponseSchema,
  refreshRequestSchema,
  type AuthTokens,
  type LoginResponse,
} from '@tankei/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { AuthService } from './auth.service';
import { Public } from './decorators';
import { TokensService } from './tokens.service';

class LoginRequestDto extends createZodDto(loginRequestSchema) {}
class LoginResponseDto extends createZodDto(loginResponseSchema) {}
class RefreshRequestDto extends createZodDto(refreshRequestSchema) {}
class AuthTokensDto extends createZodDto(authTokensSchema) {}

@ApiTags('Autenticação')
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokensService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @ZodResponse({
    status: 200,
    type: LoginResponseDto,
    description: 'Sessão aberta. A conta é criada no primeiro login.',
  })
  login(@Body() body: LoginRequestDto): Promise<LoginResponse> {
    return this.auth.login(body);
  }

  @Post('refresh')
  @HttpCode(200)
  @ZodResponse({
    status: 200,
    type: AuthTokensDto,
    description:
      'Novo par de tokens. O token de renovação enviado deixa de valer.',
  })
  refresh(@Body() body: RefreshRequestDto): Promise<AuthTokens> {
    return this.tokens.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Body() body: RefreshRequestDto): Promise<void> {
    return this.tokens.revoke(body.refreshToken);
  }
}
