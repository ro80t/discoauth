export class DiscordOAuth2Error extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`Discord API responded ${status}: ${JSON.stringify(body)}`);
    this.name = "DiscordOAuth2Error";
  }
}
