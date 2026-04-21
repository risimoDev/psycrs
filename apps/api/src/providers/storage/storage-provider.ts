import type { Readable } from 'node:stream';

/** Result of a storage write operation */
export interface StorageWriteResult {
  /** Provider-specific key/path to retrieve the file */
  key: string;
  /** Byte size if known */
  size?: number;
}

/** Abstraction over file storage backends (local disk, S3, etc.) */
export interface IStorageProvider {
  /** Write a file from a stream. Returns the key to retrieve it later. */
  write(key: string, stream: Readable): Promise<StorageWriteResult>;

  /** Read a file as a stream */
  read(key: string): Promise<Readable>;

  /** Check if a file exists */
  exists(key: string): Promise<boolean>;

  /** Delete a file */
  delete(key: string): Promise<void>;

  /** List files under a prefix (directory-like) */
  list(prefix: string): Promise<string[]>;

  /**
   * Get a public/CDN URL for the file (for direct CDN delivery).
   * Returns null if the provider doesn't support direct URLs.
   */
  getPublicUrl(key: string): string | null;
}
