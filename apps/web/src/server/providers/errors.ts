export class NotFoundError extends Error {
  constructor(symbol: string) {
    super(`Unknown symbol: ${symbol}`);
    this.name = "NotFoundError";
  }
}
