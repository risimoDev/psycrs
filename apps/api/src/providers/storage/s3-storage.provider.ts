import { createHmac, createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import type { IStorageProvider, StorageWriteResult } from './storage-provider.js';

interface S3StorageConfig {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  cdnUrl?: string;
}

/**
 * S3-compatible storage provider.
 * Uses raw HTTP with AWS Signature V4 — no SDK dependency.
 * Supports MinIO, Yandex Object Storage, Selectel, S3, etc.
 */
export class S3StorageProvider implements IStorageProvider {
  private readonly bucket: string;
  private readonly region: string;
  private readonly endpoint: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly cdnUrl?: string;

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.region = config.region;
    this.endpoint = config.endpoint ?? `https://s3.${config.region}.amazonaws.com`;
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.cdnUrl = config.cdnUrl;
  }

  async write(key: string, stream: Readable): Promise<StorageWriteResult> {
    // Collect stream into buffer (video segments are small — typically < 10 MB)
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
    }
    const body = Buffer.concat(chunks);

    const url = this.buildUrl(key);
    const date = new Date();
    const headers = this.signRequest('PUT', key, date, body);

    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...headers, 'Content-Length': String(body.length) },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`S3 PUT failed (${res.status}): ${text}`);
    }

    return { key, size: body.length };
  }

  async read(key: string): Promise<Readable> {
    const url = this.buildUrl(key);
    const date = new Date();
    const headers = this.signRequest('GET', key, date);

    const res = await fetch(url, { headers });

    if (!res.ok) {
      throw new Error(`S3 GET failed (${res.status})`);
    }

    // Convert web ReadableStream to Node stream
    return Readable.fromWeb(res.body as import('node:stream/web').ReadableStream);
  }

  async exists(key: string): Promise<boolean> {
    const url = this.buildUrl(key);
    const date = new Date();
    const headers = this.signRequest('HEAD', key, date);

    const res = await fetch(url, { method: 'HEAD', headers });
    return res.ok;
  }

  async delete(key: string): Promise<void> {
    const url = this.buildUrl(key);
    const date = new Date();
    const headers = this.signRequest('DELETE', key, date);

    const res = await fetch(url, { method: 'DELETE', headers });
    if (!res.ok && res.status !== 404) {
      throw new Error(`S3 DELETE failed (${res.status})`);
    }
  }

  async list(prefix: string): Promise<string[]> {
    const safePrefix = prefix.replace(/^\//, '');
    const url = `${this.endpoint}/${this.bucket}?list-type=2&prefix=${encodeURIComponent(safePrefix)}&delimiter=/`;
    const date = new Date();
    const headers = this.signListRequest(date, safePrefix);

    const res = await fetch(url, { headers });
    if (!res.ok) return [];

    const text = await res.text();
    // Parse XML response for <Key> and <Prefix> elements
    const keys: string[] = [];
    const keyMatches = text.matchAll(/<Key>(.*?)<\/Key>/g);
    for (const m of keyMatches) {
      if (m[1]) keys.push(m[1].replace(safePrefix, ''));
    }
    const prefixMatches = text.matchAll(/<Prefix>(.*?)<\/Prefix>/g);
    for (const m of prefixMatches) {
      if (m[1] && m[1] !== safePrefix) keys.push(m[1].replace(safePrefix, ''));
    }
    return keys;
  }

  getPublicUrl(key: string): string | null {
    if (!this.cdnUrl) return null;
    return `${this.cdnUrl}/${key}`;
  }

  // ─── AWS Signature V4 (simplified) ─────────────────────

  private buildUrl(key: string): string {
    const safeKey = key.replace(/^\//, '');
    return `${this.endpoint}/${this.bucket}/${safeKey}`;
  }

  private signRequest(
    method: string,
    key: string,
    date: Date,
    body?: Buffer,
  ): Record<string, string> {
    const safeKey = key.replace(/^\//, '');
    const host = new URL(this.endpoint).host;
    const amzDate = date.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const dateStamp = amzDate.slice(0, 8);
    const scope = `${dateStamp}/${this.region}/s3/aws4_request`;

    const payloadHash = createHash('sha256')
      .update(body ?? '')
      .digest('hex');

    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = [
      method,
      `/${this.bucket}/${safeKey}`,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const signingKey = this.getSignatureKey(dateStamp);
    const signature = createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex');

    return {
      Host: host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      Authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
  }

  private signListRequest(date: Date, prefix: string): Record<string, string> {
    const host = new URL(this.endpoint).host;
    const amzDate = date.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const dateStamp = amzDate.slice(0, 8);
    const scope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const payloadHash = createHash('sha256').update('').digest('hex');

    const queryString = `delimiter=%2F&list-type=2&prefix=${encodeURIComponent(prefix)}`;
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = [
      'GET',
      `/${this.bucket}`,
      queryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const signingKey = this.getSignatureKey(dateStamp);
    const signature = createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex');

    return {
      Host: host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      Authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
  }

  private getSignatureKey(dateStamp: string): Buffer {
    let key: Buffer | string = `AWS4${this.secretAccessKey}`;
    for (const part of [dateStamp, this.region, 's3', 'aws4_request']) {
      key = createHmac('sha256', key).update(part).digest();
    }
    return key as Buffer;
  }
}
