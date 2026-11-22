import { expect, mock, test } from "bun:test";
import type {
  DiscordAnswerInteraction,
  DiscordChannelConfig,
  DiscordCommandInteraction,
  DiscordContext,
} from "eve/channels/discord";

const { defaultDiscordAuth } = await import("eve/channels/discord");
let channelConfig: DiscordChannelConfig | undefined;

mock.module("eve/channels/discord", () => ({
  defaultDiscordAuth,
  discordChannel(config?: DiscordChannelConfig) {
    channelConfig = config;
  },
}));

await import("../agent/channels/discord");

const guildId = "123456789012345678";
const interaction: DiscordCommandInteraction = {
  applicationId: "app",
  channelId: "channel",
  commandName: "ask",
  guildId,
  id: "interaction",
  attachments: [],
  type: 2,
  options: [],
  raw: {},
  token: "token",
  user: { id: "user", username: "user" },
};

test("commands and approval responses require the configured Discord server", async () => {
  const { onCommand, onAnswers } = channelConfig ?? {};
  if (!onCommand || !onAnswers) {
    throw new Error("Discord must authorize both commands and approval responses");
  }

  const savedGuildId = process.env.DISCORD_GUILD_ID;
  try {
    const answer: DiscordAnswerInteraction = {
      ...interaction,
      type: 3,
      componentType: 2,
      customId: "approval",
      messageId: "message",
      values: [],
    };
    const auth = defaultDiscordAuth(interaction);
    const commandContext = {} as DiscordContext;
    const answerContext = { ...commandContext, defaultAuth: auth };
    const command = (server: string | undefined) =>
      onCommand(commandContext, { ...interaction, guildId: server });
    const approve = (server: string | undefined) =>
      onAnswers(answerContext, { ...answer, guildId: server });

    process.env.DISCORD_GUILD_ID = guildId;
    expect(await command(guildId)).toEqual({ auth });
    expect(await approve(guildId)).toEqual({ auth });
    expect(await command("another-server")).toBeNull();
    expect(await approve("another-server")).toBeNull();
    expect(await command(undefined)).toBeNull();
    expect(await approve(undefined)).toBeNull();

    delete process.env.DISCORD_GUILD_ID;
    expect(await command(undefined)).toBeNull();
    expect(await approve(guildId)).toBeNull();
  } finally {
    if (savedGuildId === undefined) delete process.env.DISCORD_GUILD_ID;
    else process.env.DISCORD_GUILD_ID = savedGuildId;
  }
});
