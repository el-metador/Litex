export default class SwitchableStream extends TransformStream {
  private _controller: TransformStreamDefaultController | null = null;
  private _currentReader: ReadableStreamDefaultReader | null = null;
  private _closed = false;
  private _pumpToken = 0;
  private _switches = 0;

  constructor() {
    let controllerRef: TransformStreamDefaultController | undefined;

    super({
      start(controller) {
        controllerRef = controller;
      },
    });

    if (controllerRef === undefined) {
      throw new Error('Controller not properly initialized');
    }

    this._controller = controllerRef;
  }

  async switchSource(newStream: ReadableStream) {
    if (this._closed || !this._controller) {
      return;
    }

    const previousReader = this._currentReader;
    this._currentReader = newStream.getReader();
    this._pumpToken++;

    if (previousReader) {
      try {
        await previousReader.cancel();
      } catch {
        // noop
      }
    }

    this._pumpStream(this._currentReader, this._pumpToken);

    this._switches++;
  }

  private async _pumpStream(reader: ReadableStreamDefaultReader, token: number) {
    if (!this._controller || this._closed) {
      throw new Error('Stream is not properly initialized');
    }

    try {
      while (!this._closed && token === this._pumpToken) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        if (value) {
          this._controller.enqueue(value);
        }
      }
    } catch (error) {
      if (this._closed) {
        return;
      }

      const isAbortError = error instanceof DOMException && error.name === 'AbortError';

      if (isAbortError) {
        return;
      }

      try {
        this._controller.error(error);
      } catch {
        // noop
      }
    }
  }

  close() {
    if (this._closed) {
      return;
    }

    this._closed = true;

    if (this._currentReader) {
      this._currentReader.cancel().catch(() => {
        // noop
      });
      this._currentReader = null;
    }

    try {
      this._controller?.terminate();
    } catch {
      // noop
    }
  }

  get switches() {
    return this._switches;
  }
}
