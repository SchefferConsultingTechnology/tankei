import { AnpRevendedoresClient } from './anp-revendedores.client';

function page(numero: number, total: number, cnpj: string) {
  return new Response(
    JSON.stringify({
      succeeded: true,
      title: 'Dados Encontrados',
      data: [{ cnpj }],
      searchPageFilter: { numeroPagina: numero, totalPagina: total },
    }),
  );
}

describe('AnpRevendedoresClient', () => {
  const fetchMock = jest.spyOn(global, 'fetch');
  let client: AnpRevendedoresClient;

  beforeEach(() => {
    fetchMock.mockReset();
    client = new AnpRevendedoresClient();
    client.timing = { pageIntervalMs: 0, retryBaseMs: 1, maxAttempts: 3 };
  });
  afterAll(() => fetchMock.mockRestore());

  it('percorre todas as páginas', async () => {
    fetchMock
      .mockResolvedValueOnce(page(1, 2, 'a'))
      .mockResolvedValueOnce(page(2, 2, 'b'));

    const postos = await client.listarPostos();

    expect(postos.map((p) => p.cnpj)).toEqual(['a', 'b']);
    expect(
      (fetchMock.mock.calls[1][0] as URL).searchParams.get('numeropagina'),
    ).toBe('2');
  });

  it('tenta de novo quando a ANP limita as chamadas (429)', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(page(1, 1, 'a'));

    await expect(client.listarPostos({ uf: 'SC' })).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('desiste depois do número máximo de tentativas', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response('', { status: 429 })),
    );

    await expect(client.listarPostos()).rejects.toThrow(
      'API da ANP respondeu 429',
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('não tenta de novo em erro definitivo (404)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 404 }));

    await expect(client.listarPostos()).rejects.toThrow('respondeu 404');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('exige a UF junto com o município', async () => {
    await expect(client.listarPostos({ municipio: 'LAGES' })).rejects.toThrow(
      'Informe a UF',
    );
  });
});
