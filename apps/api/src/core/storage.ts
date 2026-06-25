import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Almacenamiento de assets (logos, favicons) con adaptador intercambiable.
 *  - Dev:  disco local servido en /uploads.
 *  - Prod: S3 / CDN (aislado por tenant con prefijo tenants/{id}/...).
 * La factory elige según env: si hay S3_BUCKET usa S3, si no, disco.
 */
export interface StorageAdapter {
  /** Guarda el objeto y devuelve su URL pública. */
  put(key: string, body: Buffer, contentType: string): Promise<string>;
  remove(key: string): Promise<void>;
}

/** Imagen recibida como data URL (base64). Valida tipo y tamaño. */
export interface DecodedImage {
  buffer: Buffer;
  contentType: string;
  ext: string;
}

const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export function decodeDataUrl(dataUrl: string): DecodedImage {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl ?? '');
  if (!m) throw Object.assign(new Error('Formato de imagen inválido'), { status: 400 });
  const contentType = m[1];
  const ext = ALLOWED[contentType];
  if (!ext) throw Object.assign(new Error('Tipo no permitido (PNG/JPG/WEBP/SVG)'), { status: 400 });
  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.byteLength > MAX_BYTES) throw Object.assign(new Error('La imagen supera 2 MB'), { status: 413 });
  return { buffer, contentType, ext };
}

// ── Disco local (desarrollo) ──
class LocalDiskStorage implements StorageAdapter {
  private root = path.resolve(process.cwd(), 'uploads');
  private publicBase = process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;

  async put(key: string, body: Buffer): Promise<string> {
    const dest = path.join(this.root, key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, body);
    return `${this.publicBase}/uploads/${key}`;
  }
  async remove(key: string): Promise<void> {
    await fs.rm(path.join(this.root, key), { force: true });
  }
}

// ── S3 / CDN (producción) ──
class S3Storage implements StorageAdapter {
  private bucket = process.env.S3_BUCKET!;
  private cdnBase = process.env.CDN_BASE_URL ?? `https://${process.env.S3_BUCKET}.s3.amazonaws.com`;

  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    // @ts-expect-error dependencia opcional: instalar @aws-sdk/client-s3 en prod
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({ region: process.env.AWS_REGION });
    await client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: 'public, max-age=31536000' }),
    );
    return `${this.cdnBase}/${key}`;
  }
  async remove(key: string): Promise<void> {
    // @ts-expect-error dependencia opcional
    const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({ region: process.env.AWS_REGION });
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

export const storage: StorageAdapter = process.env.S3_BUCKET ? new S3Storage() : new LocalDiskStorage();
