import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';

/**
 * Arquivos públicos (fotos e artes, ADR 0026) num armazenamento compatível
 * com S3: Supabase Storage em produção, SeaweedFS no docker compose local. Sem
 * configuração, o envio de imagens fica desligado (503).
 */
@Injectable()
export class StorageService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly publicBase: string;

  constructor() {
    const endpoint = process.env.STORAGE_ENDPOINT;
    const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
    this.bucket = process.env.STORAGE_BUCKET ?? 'tankei-imagens';
    this.publicBase = (process.env.STORAGE_PUBLIC_URL ?? '').replace(/\/$/, '');
    this.client =
      endpoint && accessKeyId && secretAccessKey && this.publicBase
        ? new S3Client({
            endpoint,
            region: process.env.STORAGE_REGION ?? 'us-east-1',
            credentials: { accessKeyId, secretAccessKey },
            forcePathStyle: true,
          })
        : null;
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  /** Local: cria o balde na subida, se pedido (leitura pública no SeaweedFS). */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.client || process.env.STORAGE_CREATE_BUCKET !== 'true') return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      // Nem todo armazenamento local aceita política de balde; no SeaweedFS a
      // leitura pública vem da identidade anônima (docker/seaweedfs/s3.json).
      await this.client
        .send(
          new PutBucketPolicyCommand({
            Bucket: this.bucket,
            Policy: JSON.stringify({
              Version: '2012-10-17',
              Statement: [
                {
                  Effect: 'Allow',
                  Principal: '*',
                  Action: ['s3:GetObject'],
                  Resource: [`arn:aws:s3:::${this.bucket}/*`],
                },
              ],
            }),
          }),
        )
        .catch(() => undefined);
      this.logger.log(`Balde ${this.bucket} criado (leitura pública).`);
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'O envio de imagens ainda não está disponível.',
      );
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  /** Apaga sem falhar a ação: o registro já guarda a remoção. */
  async remove(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      this.logger.error(
        `Falha ao apagar ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  publicUrl(key: string): string {
    return `${this.publicBase}/${key}`;
  }
}
