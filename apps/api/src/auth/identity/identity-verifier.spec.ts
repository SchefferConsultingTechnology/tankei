import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import {
  createFakeIdentityProvider,
  FAKE_AUDIENCE,
  FAKE_ISSUER,
} from '../../../test/support/fake-identity-provider';

describe('OidcIdentityVerifier', () => {
  const { verifier, sign } = createFakeIdentityProvider();

  it('aceita token válido e devolve a identidade', async () => {
    const token = sign('google-123', {
      email: 'maria@example.com',
      email_verified: true,
      name: 'Maria',
      picture: 'https://lh3.googleusercontent.com/a/foto',
    });

    await expect(verifier.verify(token)).resolves.toEqual({
      provider: 'google',
      subject: 'google-123',
      email: 'maria@example.com',
      name: 'Maria',
      picture: 'https://lh3.googleusercontent.com/a/foto',
    });
  });

  it('ignora foto fora de https', async () => {
    const token = sign('google-123', { picture: 'javascript:alert(1)' });

    await expect(verifier.verify(token)).resolves.toMatchObject({
      picture: null,
    });
  });

  it('aceita email_verified como texto, como a Apple envia', async () => {
    const token = sign('apple-1', { email: 'a@b.com', email_verified: 'true' });

    await expect(verifier.verify(token)).resolves.toMatchObject({
      email: 'a@b.com',
    });
  });

  it('ignora e-mail não verificado', async () => {
    const token = sign('google-123', {
      email: 'maria@example.com',
      email_verified: false,
    });

    await expect(verifier.verify(token)).resolves.toMatchObject({
      email: null,
    });
  });

  it.each([
    ['de outro app', { audience: 'outro-app' }],
    ['de outro emissor', { issuer: 'https://malicioso.example.com' }],
    ['expirado', { expiresIn: -10 }],
  ])('rejeita token %s', async (_, options) => {
    const token = sign('google-123', {}, options);

    await expect(verifier.verify(token)).rejects.toThrow(
      'Token de identidade inválido.',
    );
  });

  it('rejeita token assinado com outra chave', async () => {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const forged = jwt.sign({}, privateKey, {
      algorithm: 'RS256',
      keyid: 'chave-de-teste',
      issuer: FAKE_ISSUER,
      audience: FAKE_AUDIENCE,
      subject: 'google-123',
    });

    await expect(verifier.verify(forged)).rejects.toThrow(
      'Token de identidade inválido.',
    );
  });

  it('rejeita token sem assinatura (alg none)', async () => {
    const unsigned = jwt.sign({}, '', {
      algorithm: 'none',
      keyid: 'chave-de-teste',
      issuer: FAKE_ISSUER,
      audience: FAKE_AUDIENCE,
      subject: 'google-123',
    });

    await expect(verifier.verify(unsigned)).rejects.toThrow(
      'Token de identidade inválido.',
    );
  });

  it('rejeita texto que não é token', async () => {
    await expect(verifier.verify('nao-e-um-token')).rejects.toThrow(
      'Token de identidade inválido.',
    );
  });
});
