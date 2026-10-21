export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    public readonly publicMessage: string,
    public readonly retryAfter?: number,
  ) {
    super(publicMessage);
    this.name = 'HttpError';
  }
}
