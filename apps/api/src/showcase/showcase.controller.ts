import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  adminMediaQuerySchema,
  adminMediaSchema,
  createPromotionSchema,
  photoCaptionSchema,
  promotionSchema,
  removeMediaSchema,
  stationPhotoSchema,
  stationPhotosSchema,
  stationPromotionSchema,
  stationShowcaseSchema,
  type AdminMedia,
  type Promotion,
  type StationPhoto,
  type StationPhotos,
  type StationPromotion,
  type StationShowcase,
} from '@tankei/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { ShowcaseService, type UploadedImage } from './showcase.service';

class StationPhotoDto extends createZodDto(stationPhotoSchema) {}
class StationPhotosDto extends createZodDto(stationPhotosSchema) {}
class PhotoCaptionDto extends createZodDto(photoCaptionSchema) {}
class PromotionDto extends createZodDto(promotionSchema) {}
class StationPromotionDto extends createZodDto(stationPromotionSchema) {}
class CreatePromotionDto extends createZodDto(createPromotionSchema) {}
class StationShowcaseDto extends createZodDto(stationShowcaseSchema) {}
class AdminMediaDto extends createZodDto(adminMediaSchema) {}
class AdminMediaQueryDto extends createZodDto(adminMediaQuerySchema) {}
class RemoveMediaDto extends createZodDto(removeMediaSchema) {}

const uuid = (message: string) =>
  new ParseUUIDPipe({
    exceptionFactory: () => new BadRequestException(message),
  });

/**
 * Teto do multer, acima do parâmetro media.max_upload_mb (máx. 20): a
 * mensagem em português vem da checagem do parâmetro no serviço.
 */
const UPLOAD = FileInterceptor('file', {
  limits: { fileSize: 21 * 1024 * 1024, files: 1 },
});

const fileBody = (extra: Record<string, object> = {}) =>
  ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'JPG, PNG ou WebP.',
        },
        ...extra,
      },
    },
  });

/** Fotos e promoções do posto, pelo portal (ADR 0026). */
@ApiTags('Portal do posto')
@ApiBearerAuth()
@Controller('portal/stations/:stationId')
export class StationShowcaseController {
  constructor(private readonly showcase: ShowcaseService) {}

  @Get('photos')
  @ZodResponse({ status: 200, type: StationPhotosDto })
  photos(
    @Param('stationId', uuid('Posto inválido.')) stationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StationPhotos> {
    return this.showcase.photos(user, stationId);
  }

  @Post('photos')
  @UseInterceptors(UPLOAD)
  @ApiConsumes('multipart/form-data')
  @fileBody({ caption: { type: 'string', description: 'Legenda (opcional).' } })
  @ZodResponse({
    status: 201,
    type: StationPhotoDto,
    description: 'Publica na hora; a equipe Tankei pode remover.',
  })
  addPhoto(
    @Param('stationId', uuid('Posto inválido.')) stationId: string,
    @UploadedFile() file: UploadedImage | undefined,
    @Body() body: PhotoCaptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StationPhoto> {
    return this.showcase.addPhoto(user, stationId, file, body.caption);
  }

  @Delete('photos/:photoId')
  @HttpCode(204)
  async removePhoto(
    @Param('stationId', uuid('Posto inválido.')) stationId: string,
    @Param('photoId', uuid('Foto inválida.')) photoId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.showcase.removePhoto(user, stationId, photoId);
  }

  @Get('promotions')
  @ZodResponse({
    status: 200,
    type: [StationPromotionDto],
    description: 'Agendadas, vigentes e encerradas nos últimos 90 dias.',
  })
  promotions(
    @Param('stationId', uuid('Posto inválido.')) stationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StationPromotion[]> {
    return this.showcase.stationPromotions(user, stationId);
  }

  @Post('promotions')
  @ZodResponse({
    status: 201,
    type: PromotionDto,
    description:
      'Cria a promoção; preços por combustível são opcionais e seguem as regras do preço do posto.',
  })
  createPromotion(
    @Param('stationId', uuid('Posto inválido.')) stationId: string,
    @Body() body: CreatePromotionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Promotion> {
    return this.showcase.createPromotion(user, stationId, body);
  }

  @Put('promotions/:promotionId/image')
  @UseInterceptors(UPLOAD)
  @ApiConsumes('multipart/form-data')
  @fileBody()
  @ZodResponse({
    status: 200,
    type: PromotionDto,
    description: 'Envia ou troca a arte.',
  })
  setImage(
    @Param('stationId', uuid('Posto inválido.')) stationId: string,
    @Param('promotionId', uuid('Promoção inválida.')) promotionId: string,
    @UploadedFile() file: UploadedImage | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Promotion> {
    return this.showcase.setPromotionImage(user, stationId, promotionId, file);
  }

  @Post('promotions/:promotionId/end')
  @HttpCode(200)
  @ZodResponse({
    status: 200,
    type: PromotionDto,
    description: 'Encerra agora: os preços promocionais deixam de valer.',
  })
  end(
    @Param('stationId', uuid('Posto inválido.')) stationId: string,
    @Param('promotionId', uuid('Promoção inválida.')) promotionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Promotion> {
    return this.showcase.endPromotion(user, stationId, promotionId);
  }
}

/** Vitrine pública do posto, para a ficha no app (ADR 0026). */
@ApiTags('Postos')
@Public()
@Controller('stations/:stationId/showcase')
export class PublicShowcaseController {
  constructor(private readonly showcase: ShowcaseService) {}

  @Get()
  @ZodResponse({
    status: 200,
    type: StationShowcaseDto,
    description: 'Fotos e promoções vigentes do posto.',
  })
  showcaseOf(
    @Param('stationId', uuid('Posto inválido.')) stationId: string,
  ): Promise<StationShowcase> {
    return this.showcase.showcase(stationId);
  }
}

/** Imagens novas, com remoção pela equipe Tankei (ADR 0026). */
@ApiTags('Administração')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/media')
export class AdminMediaController {
  constructor(private readonly showcase: ShowcaseService) {}

  @Get()
  @ZodResponse({
    status: 200,
    type: [AdminMediaDto],
    description: 'Fotos e artes enviadas no período, as mais novas primeiro.',
  })
  list(@Query() query: AdminMediaQueryDto): Promise<AdminMedia[]> {
    return this.showcase.adminMedia(query.days);
  }

  @Post('photos/:photoId/remove')
  @HttpCode(204)
  async removePhoto(
    @Param('photoId', uuid('Foto inválida.')) photoId: string,
    @Body() body: RemoveMediaDto,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<void> {
    await this.showcase.adminRemovePhoto(admin.id, photoId, body.reason);
  }

  @Post('promotions/:promotionId/remove-image')
  @HttpCode(204)
  async removeImage(
    @Param('promotionId', uuid('Promoção inválida.')) promotionId: string,
    @Body() body: RemoveMediaDto,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<void> {
    await this.showcase.adminRemovePromotionImage(
      admin.id,
      promotionId,
      body.reason,
    );
  }
}
