import { PARAMETER_KEYS } from '@tankei/shared';
import type { Database } from '../database/database.module';
import { ParametersService } from './parameters.service';

/** Banco falso: devolve as linhas atuais na leitura e registra as inserções. */
function fakeDb(rows: { key: string; value: unknown }[]) {
  const reads = jest.fn(() => Promise.resolve(rows));
  const inserts = jest.fn((row: { key: string; value: unknown }) => {
    rows = [...rows.filter((r) => r.key !== row.key), row];
    return Promise.resolve();
  });
  const db = {
    selectDistinctOn: () => ({ from: () => ({ orderBy: reads }) }),
    insert: () => ({ values: inserts }),
  } as unknown as Database;
  return { db, reads, inserts };
}

const allParameters = () =>
  PARAMETER_KEYS.map((key) => ({
    key,
    value: 10,
  }));

describe('ParametersService', () => {
  it('devolve o valor vigente com o tipo definido', async () => {
    const { db } = fakeDb(allParameters());
    const service = new ParametersService(db);

    await expect(service.get('price.reference_max_pct')).resolves.toBe(10);
    await expect(service.get('review.min_interval_days')).resolves.toBe(10);
  });

  it('usa cache entre leituras', async () => {
    const { db, reads } = fakeDb(allParameters());
    const service = new ParametersService(db);

    await service.get('price.reference_max_pct');
    await service.get('price.stale_after_days');

    expect(reads).toHaveBeenCalledTimes(1);
  });

  it('registra um novo valor e descarta o cache', async () => {
    const { db, inserts } = fakeDb(allParameters());
    const service = new ParametersService(db);
    await service.get('price.reference_max_pct');

    await service.set('price.reference_max_pct', 50, 'Ajuste do piloto');

    expect(inserts).toHaveBeenCalledWith({
      key: 'price.reference_max_pct',
      value: 50,
      reason: 'Ajuste do piloto',
      changedByUserId: undefined,
    });
    await expect(service.get('price.reference_max_pct')).resolves.toBe(50);
  });

  it('rejeita valor fora do tipo definido', async () => {
    const { db, inserts } = fakeDb(allParameters());
    const service = new ParametersService(db);

    await expect(
      service.set('price.reference_max_pct', 150, 'Teste'),
    ).rejects.toThrow();
    expect(inserts).not.toHaveBeenCalled();
  });

  it('falha ao ler valor inválido gravado no banco', async () => {
    const { db } = fakeDb([{ key: 'price.reference_max_pct', value: 150 }]);
    const service = new ParametersService(db);

    await expect(service.get('price.reference_max_pct')).rejects.toThrow();
  });

  it('impede a subida da API quando falta parâmetro', async () => {
    const { db } = fakeDb(
      allParameters().filter((p) => p.key !== 'price.hide_after_days'),
    );
    const service = new ParametersService(db);

    await expect(service.onApplicationBootstrap()).rejects.toThrow(
      'Parâmetros sem valor no banco: price.hide_after_days',
    );
  });
});
