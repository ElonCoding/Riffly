import { EmbedBuilder } from 'discord.js';

export interface GitHubUserResponse {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  html_url: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  hireable: boolean | null;
  bio: string | null;
  twitter_username: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

export type GitHubUserResult =
  | { success: true; user: GitHubUserResponse }
  | { success: false; reason: 'not_found'; username: string }
  | { success: false; reason: 'rate_limited'; resetAt?: number | undefined }
  | { success: false; reason: 'timeout' }
  | { success: false; reason: 'invalid_username'; message: string }
  | { success: false; reason: 'error'; status?: number | undefined; message: string };

export const GITHUB_USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

export function validateGitHubUsername(username: string): { valid: boolean; error?: string | undefined } {
  const trimmed = username.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Username cannot be empty.' };
  }
  if (trimmed.length > 39) {
    return { valid: false, error: 'GitHub usernames cannot exceed 39 characters.' };
  }
  if (!GITHUB_USERNAME_REGEX.test(trimmed)) {
    return {
      valid: false,
      error:
        'Invalid username. Usernames may only contain alphanumeric characters and single hyphens, and cannot start or end with a hyphen.',
    };
  }
  return { valid: true };
}

export interface FetchGitHubUserOptions {
  token?: string | undefined;
  fetcher?: typeof fetch | undefined;
  timeoutMs?: number | undefined;
}

export async function fetchGitHubUser(
  username: string,
  options: FetchGitHubUserOptions = {},
): Promise<GitHubUserResult> {
  const validation = validateGitHubUsername(username);
  if (!validation.valid) {
    return {
      success: false,
      reason: 'invalid_username',
      message: validation.error!,
    };
  }

  const sanitized = username.trim();
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const customFetch = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8000;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Riffly-Discord-Bot',
  };

  if (token && token.trim().length > 0) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  const url = `https://api.github.com/users/${encodeURIComponent(sanitized)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await customFetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    if (res.status === 200) {
      const data = (await res.json()) as GitHubUserResponse;
      return { success: true, user: data };
    }

    if (res.status === 404) {
      return { success: false, reason: 'not_found', username: sanitized };
    }

    if (res.status === 403) {
      const reset = res.headers.get('x-ratelimit-reset');
      const resetAt = reset ? parseInt(reset, 10) : undefined;
      return {
        success: false,
        reason: 'rate_limited',
        resetAt: resetAt && !isNaN(resetAt) ? resetAt : undefined,
      };
    }

    return {
      success: false,
      reason: 'error',
      status: res.status,
      message: `GitHub API returned HTTP ${res.status}`,
    };
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err.name === 'AbortError' ||
        err.message.includes('aborted') ||
        err.message.includes('timeout'))
    ) {
      return { success: false, reason: 'timeout' };
    }
    const rawMessage = err instanceof Error ? err.message : 'Unknown network error';
    const safeMessage = token && token.trim().length > 0 ? rawMessage.replaceAll(token.trim(), '[REDACTED]') : rawMessage;
    return {
      success: false,
      reason: 'error',
      message: safeMessage,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function buildGitHubUserEmbed(user: GitHubUserResponse): EmbedBuilder {
  const displayName =
    user.name && user.name.trim().length > 0
      ? `${user.name.trim()} (@${user.login})`
      : `@${user.login}`;
  const profileUrl = user.html_url || `https://github.com/${user.login}`;

  let formattedBlog = 'None';
  if (user.blog && user.blog.trim().length > 0) {
    const trimmedBlog = user.blog.trim();
    const blogUrl = /^https?:\/\//i.test(trimmedBlog)
      ? trimmedBlog
      : `https://${trimmedBlog}`;
    formattedBlog = `[${trimmedBlog}](${blogUrl})`;
  }

  let createdDateDisplay = 'Unknown';
  if (user.created_at) {
    const createdTimestamp = Math.floor(new Date(user.created_at).getTime() / 1000);
    if (!isNaN(createdTimestamp)) {
      createdDateDisplay = `<t:${createdTimestamp}:D> (<t:${createdTimestamp}:R>)`;
    }
  }

  const description =
    user.bio && user.bio.trim().length > 0
      ? `${user.bio.trim()}\n\n🔗 [**View GitHub Profile (@${user.login})**](${profileUrl})`
      : `🔗 [**View GitHub Profile (@${user.login})**](${profileUrl})`;

  return new EmbedBuilder()
    .setColor(0x24292e)
    .setTitle(`🐙 ${displayName}`)
    .setURL(profileUrl)
    .setThumbnail(user.avatar_url)
    .setDescription(description)
    .addFields(
      {
        name: '📦 Repositories',
        value: (user.public_repos ?? 0).toLocaleString(),
        inline: true,
      },
      {
        name: '👥 Followers',
        value: (user.followers ?? 0).toLocaleString(),
        inline: true,
      },
      {
        name: '👤 Following',
        value: (user.following ?? 0).toLocaleString(),
        inline: true,
      },
      {
        name: '🏢 Company',
        value: user.company && user.company.trim().length > 0 ? user.company.trim() : 'None',
        inline: true,
      },
      {
        name: '📍 Location',
        value: user.location && user.location.trim().length > 0 ? user.location.trim() : 'None',
        inline: true,
      },
      {
        name: '🌐 Website',
        value: formattedBlog,
        inline: true,
      },
      {
        name: '📅 Joined GitHub',
        value: createdDateDisplay,
        inline: false,
      },
    )
    .setFooter({
      text: 'GitHub Public API',
      iconURL: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
    })
    .setTimestamp();
}
