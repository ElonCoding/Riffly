import { EmbedBuilder } from 'discord.js';
import type {
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  TextChannel,
  User,
} from 'discord.js';
import type { StarboardSettings } from './types.js';

/**
 * Service managing starboard reaction tracking, threshold triggers, and embed synchronization.
 */
export class StarboardService {
  /**
   * Tracks posted starboard messages to update rather than duplicate.
   * Key: `${originalChannelId}:${originalMessageId}` -> `starboardMessageId`
   */
  private readonly postedMessages = new Map<string, string>();

  /**
   * Handles reaction added to a message.
   */
  public async handleReaction(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
    settings: StarboardSettings = {},
  ): Promise<boolean> {
    if (user.bot) return false;
    if (settings.enabled === false || !settings.channelId) return false;

    const emojiTarget = settings.emoji ?? '⭐';
    if (reaction.emoji.name !== emojiTarget && reaction.emoji.id !== emojiTarget) {
      return false;
    }

    const fullReaction = reaction.partial ? await reaction.fetch().catch(() => null) : reaction;
    if (!fullReaction) return false;

    const message = fullReaction.message.partial
      ? await fullReaction.message.fetch().catch(() => null)
      : fullReaction.message;
    if (!message || !message.guild) return false;

    // Disallow author self-starring if configured
    if (!settings.selfStar && message.author.id === user.id) {
      return false;
    }

    const minStars = settings.minStars ?? 3;
    const count = fullReaction.count ?? 0;
    if (count < minStars) return false;

    const starboardChannel = (await message.guild.channels
      .fetch(settings.channelId)
      .catch(() => null)) as TextChannel | null;
    if (!starboardChannel || !('send' in starboardChannel)) return false;

    const mappingKey = `${message.channel.id}:${message.id}`;
    const existingStarboardMsgId = this.postedMessages.get(mappingKey);

    const contentHeader = `${emojiTarget} **${count}** <#${message.channel.id}> [Jump to Message](${message.url})`;

    const embed = new EmbedBuilder()
      .setAuthor({
        name: message.author.tag,
        iconURL: message.author.displayAvatarURL(),
      })
      .setColor(0xf59e0b)
      .setDescription(message.content || null)
      .setFooter({ text: `ID: ${message.id}` })
      .setTimestamp(message.createdAt);

    // If message has image attachment, embed the first image
    const firstAttachment = message.attachments.find((att) =>
      att.contentType?.startsWith('image/'),
    );
    if (firstAttachment) {
      embed.setImage(firstAttachment.url);
    }

    if (existingStarboardMsgId) {
      const existingMsg = await starboardChannel.messages
        .fetch(existingStarboardMsgId)
        .catch(() => null);
      if (existingMsg) {
        await existingMsg.edit({ content: contentHeader, embeds: [embed] }).catch(() => null);
        return true;
      }
    }

    const posted = await starboardChannel
      .send({ content: contentHeader, embeds: [embed] })
      .catch(() => null);
    if (posted) {
      this.postedMessages.set(mappingKey, posted.id);
      return true;
    }

    return false;
  }
}
