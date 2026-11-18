export class SaveRequestError extends Error {
  requestId: string | null

  constructor(response: Response) {
    super('Save failed')
    this.requestId = response.headers.get('X-Request-ID') || null
  }
}
