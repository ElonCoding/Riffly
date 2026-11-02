import type { IAiProvider } from './types.js';

const RIFFLY_KNOWLEDGE: Record<string, string> = {
  music:
    'Riffly features a high-performance audio engine backed by Lavalink v4. You can play tracks using `/play`, manage queues with `/queue`, adjust playback with `/pause`, `/resume`, `/skip`, `/volume`, `/seek`, `/loop`, and `/shuffle`.',
  moderation:
    'Riffly provides full server moderation: `/ban`, `/kick`, `/timeout`, `/warn`, `/purge`, and `/cases` with atomic case numbering and permanent audit logging.',
  tickets:
    'Riffly support tickets can be created using `/ticket create` or through interactive buttons on panels deployed with `/ticket panel`. Staff can claim, close, and export streaming transcripts.',
  verification:
    'Riffly verification provides onboarding security using `/verification panel`, automatically granting verified roles and blocking bots.',
  leveling:
    'Riffly tracks chat activity with configurable XP gains, cooldowns, level-up announcements, `/rank` cards, and server `/leaderboard`.',
  economy:
    'Riffly includes a virtual economy: check balances with `/balance`, claim `/daily` coins, earn with `/work`, deposit with `/deposit`, and transfer coins with `/pay`.',
  giveaways:
    'Host server giveaways with `/giveaway start`, `/giveaway end`, and `/giveaway reroll` with interactive button entries and automated task scheduler resolution.',
  automod:
    'PatternGuard automatically defends against Discord invite links, external links, mention spam, excessive caps, and rapid message flooding.',
};

export class GeminiAiProvider implements IAiProvider {
  private readonly apiKey: string;
  private readonly fallback: DefaultRifflyAiProvider;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.fallback = new DefaultRifflyAiProvider();
  }

  public async generateResponse(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      const instructions =
        systemPrompt ??
        'You are the intelligent assistant for Riffly, a high-performance Discord music, moderation, and community bot. Be helpful, concise, friendly, and accurate. Do not mention other bot brands.';

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: instructions + '\n\nUser Question: ' + prompt },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 800,
            },
          }),
        },
      );

      if (res.ok) {
        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) {
          return text;
        }
      }
    } catch {
      // Gracefully fall back to local knowledge on any network or API issue
    }

    return this.fallback.generateResponse(prompt, systemPrompt);
  }
}

export class DefaultRifflyAiProvider implements IAiProvider {
  public generateResponse(prompt: string, _systemPrompt?: string): Promise<string> {
    const lower = prompt.toLowerCase();

    for (const [key, response] of Object.entries(RIFFLY_KNOWLEDGE)) {
      if (lower.includes(key)) {
        return Promise.resolve(response);
      }
    }

    if (lower.includes('help') || lower.includes('commands') || lower.includes('what can you do')) {
      return Promise.resolve(
        'I am Riffly AI Assistant! I can help you with music playback, moderation, tickets, verification, XP leveling, giveaways, economy, and server configuration. Ask me anything about Riffly features!',
      );
    }

    return Promise.resolve(
      `Thanks for asking! As Riffly Assistant, I can assist you with server features, music commands, and moderation controls. Type \`/help\` or ask specifically about music, economy, leveling, or moderation.`,
    );
  }
}

export class AiService {
  private readonly provider: IAiProvider;
  private readonly cooldowns = new Map<string, number>();

  constructor(provider?: IAiProvider) {
    if (provider) {
      this.provider = provider;
    } else if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
      this.provider = new GeminiAiProvider(process.env.GEMINI_API_KEY.trim());
    } else {
      this.provider = new DefaultRifflyAiProvider();
    }
  }

  public async ask(
    userId: string,
    prompt: string,
    cooldownSeconds = 5,
  ): Promise<{ response: string; onCooldown: boolean; remainingSeconds?: number }> {
    const now = Date.now();
    const last = this.cooldowns.get(userId) ?? 0;
    const cooldownMs = cooldownSeconds * 1000;

    if (now - last < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - (now - last)) / 1000);
      return {
        response: '',
        onCooldown: true,
        remainingSeconds,
      };
    }

    this.cooldowns.set(userId, now);
    const response = await this.provider.generateResponse(prompt);

    return {
      response,
      onCooldown: false,
    };
  }
}
