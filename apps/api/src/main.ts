import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { loadEnv } from './load-env';

async function bootstrap() {
  loadEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Atrás do proxy da hospedagem (ADR 0016), o IP da pessoa vem no
  // X-Forwarded-For: sem isso, o limite por IP trataria todos como um só.
  if (process.env.TRUST_PROXY) {
    app.set('trust proxy', Number(process.env.TRUST_PROXY));
  }
  configureApp(app);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3333);
}
void bootstrap();
