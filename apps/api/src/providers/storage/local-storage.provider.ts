import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, access, unlink, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import type { IStorageProvider, StorageWriteResult } from './storage-provider.js';

interface LocalStorageConfig {
  basePath: string;
  cdnUrl?: string;
}

export class LocalStorageProvider implements IStorageProvider {
  private readonly basePath: string;
  private readonly cdnUrl?: string;

  constructor(config: LocalStorageConfig) {
    this.basePath = config.basePath;
    this.cdnUrl = config.cdnUrl;
  }

  async write(key: string, stream: Readable): Promise<StorageWriteResult> {
    const fullPath = this.resolve(key);
    await mkdir(dirname(fullPath), { recursive: true });

    const ws = createWriteStream(fullPath);
    await pipeline(stream, ws);

    const info = await stat(fullPath);
    return { key, size: info.size };
  }

  async read(key: string): Promise<Readable> {
    const fullPath = this.resolve(key);
    return createReadStream(fullPath);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const dir = this.resolve(prefix);
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      return entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
    } catch {
      return [];
    }
  }

  getPublicUrl(key: string): string | null {
    if (!this.cdnUrl) return null;
    return `${this.cdnUrl}/${key}`;
  }

  /** Resolve key to absolute path, preventing traversal */
  private resolve(key: string): string {
    const safe = key.replace(/\.\./g, '').replace(/^\//, '');
    return join(this.basePath, safe);
  }
}
