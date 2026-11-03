import { BadRequestException, INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc, createZodValidationPipe } from 'nestjs-zod';
import { ZodError } from 'zod';

/** Configuração compartilhada entre main.ts e os testes e2e. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('v1');
  app.enableCors();

  // OpenAPI 3.1 representa campos nulos corretamente a partir do Zod.
  const config = new DocumentBuilder()
    .setOpenAPIVersion('3.1.0')
    .setTitle('Tankei API')
    .setDescription('Preços e qualidade de postos de combustível.')
    .setVersion('v1')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('v1/docs', app, cleanupOpenApiDoc(document));
}

/**
 * Valida com Zod e responde no formato de erro do NestJS (ADR 0008):
 * `message` com a primeira mensagem e `issues` com o erro de cada campo.
 */
export const ZodValidationPipe = createZodValidationPipe({
  createValidationException: (error: unknown) => {
    const issues = error instanceof ZodError ? error.issues : [];
    return new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: issues[0]?.message ?? 'Dados inválidos.',
      issues: issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  },
});
