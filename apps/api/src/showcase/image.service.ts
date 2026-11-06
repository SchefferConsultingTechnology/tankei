import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';

const ACCEPTED = new Set(['jpeg', 'png', 'webp']);
/** Lado maior depois de reduzir: nítido no celular, leve para baixar. */
const MAX_SIDE = 1600;

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
  contentType: 'image/webp';
}

/**
 * Prepara a imagem para publicar (ADR 0026): confere o formato pelo conteúdo
 * (não pela extensão), gira conforme o EXIF, reduz para no máximo 1600 px e
 * converte para WebP. Metadados (inclusive GPS) não são copiados.
 */
@Injectable()
export class ImageService {
  async prepare(input: Buffer): Promise<ProcessedImage> {
    let format: string | undefined;
    try {
      format = (await sharp(input).metadata()).format;
    } catch {
      format = undefined;
    }
    if (!format || !ACCEPTED.has(format)) {
      throw new BadRequestException('Imagem inválida. Use JPG, PNG ou WebP.');
    }
    const { data, info } = await sharp(input, { failOn: 'error' })
      .rotate()
      .resize({
        width: MAX_SIDE,
        height: MAX_SIDE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    return {
      data,
      width: info.width,
      height: info.height,
      contentType: 'image/webp',
    };
  }
}
