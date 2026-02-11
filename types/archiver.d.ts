declare module 'archiver' {
  type EntryData = {
    name: string;
  };

  type ArchiverWarning = Error & {
    code?: string;
  };

  interface Archiver {
    append(source: string | Buffer, data: EntryData): this;
    finalize(): Promise<void>;
    pipe<T extends NodeJS.WritableStream>(stream: T): T;
    on(event: 'warning', listener: (warning: ArchiverWarning) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
  }

  function createArchiver(
    format: 'zip' | string,
    options?: {
      zlib?: {
        level?: number;
      };
    },
  ): Archiver;

  export default createArchiver;
}
