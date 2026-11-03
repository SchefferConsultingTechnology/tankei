import { generateKeyPairSync } from 'node:crypto';
import { remoteJwks } from './remote-jwks';

function rsaJwk(kid: string) {
  const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig' };
}

describe('remoteJwks', () => {
  const fetchMock = jest.spyOn(global, 'fetch');
  // Uma Response nova a cada chamada: o corpo só pode ser lido uma vez.
  const respond = (keys: object[]) =>
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ keys }))),
    );

  beforeEach(() => fetchMock.mockReset());
  afterAll(() => fetchMock.mockRestore());

  it('devolve a chave pública em PEM e usa cache', async () => {
    respond([rsaJwk('k1'), rsaJwk('k2')]);
    const getKey = remoteJwks('https://provedor.example/jwks');

    await expect(getKey('k1')).resolves.toContain('BEGIN PUBLIC KEY');
    await expect(getKey('k2')).resolves.toContain('BEGIN PUBLIC KEY');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('recarrega quando aparece uma chave nova (rotação)', async () => {
    respond([rsaJwk('antiga')]);
    const getKey = remoteJwks('https://provedor.example/jwks');
    await getKey('antiga');

    respond([rsaJwk('antiga'), rsaJwk('nova')]);
    await expect(getKey('nova')).resolves.toContain('BEGIN PUBLIC KEY');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('não recarrega a cada chave desconhecida (tokens forjados)', async () => {
    respond([rsaJwk('k1')]);
    const getKey = remoteJwks('https://provedor.example/jwks');

    await expect(getKey('forjada-1')).rejects.toThrow('Chave desconhecida');
    await expect(getKey('forjada-2')).rejects.toThrow('Chave desconhecida');
    await expect(getKey('forjada-3')).rejects.toThrow('Chave desconhecida');
    // Uma carga inicial e uma recarga; as seguintes esperam o intervalo.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
