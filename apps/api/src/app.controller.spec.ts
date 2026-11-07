import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DRIZZLE } from './database/database.module';
import { ParametersService } from './parameters/parameters.service';

describe('AppController', () => {
  const execute = jest.fn();
  let appController: AppController;

  beforeEach(async () => {
    execute.mockReset();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: DRIZZLE, useValue: { execute } },
        { provide: ParametersService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('reports the service as ok', async () => {
      execute.mockResolvedValue({ rows: [] });

      await expect(appController.getHealth()).resolves.toMatchObject({
        status: 'ok',
        service: 'tankei-api',
        database: 'ok',
      });
    });

    it('reports degraded when the database is unreachable', async () => {
      execute.mockRejectedValue(new Error('connection refused'));

      await expect(appController.getHealth()).resolves.toMatchObject({
        status: 'degradado',
        database: 'indisponivel',
      });
    });
  });
});
