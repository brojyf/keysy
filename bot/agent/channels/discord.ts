import {
  defaultDiscordAuth,
  discordChannel,
  type DiscordInteractionBase,
} from "eve/channels/discord";

function authorizeGuild(_context: unknown, interaction: DiscordInteractionBase) {
  const guildId = process.env.DISCORD_GUILD_ID;
  return guildId && interaction.guildId === guildId
    ? { auth: defaultDiscordAuth(interaction) }
    : null;
}

export default discordChannel({
  onCommand: authorizeGuild,
  onAnswers: authorizeGuild,
});
