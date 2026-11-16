/** Thrown by the stubbed bodies of the contract functions until they are implemented. */
export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`not implemented: ${what}`);
    this.name = "NotImplementedError";
  }
}
