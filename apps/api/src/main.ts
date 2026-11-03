import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './load-env';

async function bootstrap() {
  loadEnv();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  app.enableCors();
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3333);
}
void bootstrap();
