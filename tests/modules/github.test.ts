import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import {
  validateGitHubUsername,
  fetchGitHubUser,
  buildGitHubUserEmbed,
  GITHUB_USERNAME_REGEX,
  type GitHubUserResponse,
} from '../../src/modules/utility/github-service.js';
import { createExtendedUtilityCommands } from '../../src/modules/utility/commands-extended.js';
import { allCommandData } from '../../src/commands/index.js';

describe('GitHub User Profile Feature Suite', () => {
  const sampleFullUser: GitHubUserResponse = {
    login: 'octocat',
    id: 583231,
    node_id: 'MDQ6VXNlcjU4MzIzMQ==',
    avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
    html_url: 'https://github.com/octocat',
    name: 'The Octocat',
    company: '@github',
    blog: 'https://github.blog',
    location: 'San Francisco',
    email: 'octocat@github.com',
    hireable: false,
    bio: 'There once was a story...',
    twitter_username: 'monatheoctocat',
    public_repos: 8,
    public_gists: 8,
    followers: 9000,
    following: 9,
    created_at: '2011-01-25T18:44:36Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const sampleMinimalUser: GitHubUserResponse = {
    login: 'minimal-dev',
    id: 123456,
    node_id: 'MDQ6VXNlcjEyMzQ1Ng==',
    avatar_url: 'https://avatars.githubusercontent.com/u/123456?v=4',
    html_url: 'https://github.com/minimal-dev',
    name: null,
    company: null,
    blog: null,
    location: null,
    email: null,
    hireable: null,
    bio: null,
    twitter_username: null,
    public_repos: 0,
    public_gists: 0,
    followers: 0,
    following: 0,
    created_at: '2020-05-10T12:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  // =========================================================================
  // SUITE 1: Validation and Sanitization
  // =========================================================================
  describe('Suite 1: Username Validation & Sanitization', () => {
    it('accepts standard valid usernames', () => {
      const validNames = ['octocat', 'torvalds', 'elonmusk', 'john-doe', 'user-123', 'a', '1'];
      for (const name of validNames) {
        const result = validateGitHubUsername(name);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }
    });

    it('accepts maximum length valid username (39 characters)', () => {
      const maxLenName = 'a'.repeat(39);
      expect(validateGitHubUsername(maxLenName).valid).toBe(true);
    });

    it('rejects empty and whitespace-only usernames', () => {
      expect(validateGitHubUsername('').valid).toBe(false);
      expect(validateGitHubUsername('   ').valid).toBe(false);
      expect(validateGitHubUsername('').error).toBe('Username cannot be empty.');
    });

    it('rejects usernames exceeding 39 characters', () => {
      const tooLong = 'a'.repeat(40);
      const res = validateGitHubUsername(tooLong);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('cannot exceed 39 characters');
    });

    it('rejects usernames with leading or trailing hyphens', () => {
      expect(validateGitHubUsername('-octocat').valid).toBe(false);
      expect(validateGitHubUsername('octocat-').valid).toBe(false);
    });

    it('rejects usernames with consecutive hyphens', () => {
      expect(validateGitHubUsername('octo--cat').valid).toBe(false);
      expect(validateGitHubUsername('a--b--c').valid).toBe(false);
    });

    it('rejects usernames with whitespace and illegal characters', () => {
      const illegal = [
        'octo cat',
        'octo\tcat',
        'octo@cat',
        'octo#cat',
        'octo$cat',
        'octo.cat',
        'octo!cat',
      ];
      for (const name of illegal) {
        expect(validateGitHubUsername(name).valid).toBe(false);
      }
    });

    it('rejects path traversal attempts and slashes', () => {
      const traversal = ['../octocat', '../../etc/passwd', 'octocat/..', 'owner/repo'];
      for (const t of traversal) {
        expect(validateGitHubUsername(t).valid).toBe(false);
      }
    });

    it('regex directly enforces GitHub specification', () => {
      expect(GITHUB_USERNAME_REGEX.test('octocat')).toBe(true);
      expect(GITHUB_USERNAME_REGEX.test('-leading')).toBe(false);
      expect(GITHUB_USERNAME_REGEX.test('trailing-')).toBe(false);
      expect(GITHUB_USERNAME_REGEX.test('double--dash')).toBe(false);
    });
  });

  // =========================================================================
  // SUITE 2: API Fetching with Mocked Fetch
  // =========================================================================
  describe('Suite 2: API Fetching & Error Handling', () => {
    it('returns success and parsed data on HTTP 200 with full fields', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve(sampleFullUser),
      });

      const result = await fetchGitHubUser('octocat', { fetcher: mockFetch });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user.login).toBe('octocat');
        expect(result.user.name).toBe('The Octocat');
        expect(result.user.public_repos).toBe(8);
      }

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [callUrl, callOptions] = mockFetch.mock.calls[0] as [
        string,
        { method?: string; headers?: Record<string, string> },
      ];
      expect(callUrl).toBe('https://api.github.com/users/octocat');
      expect(callOptions.method).toBe('GET');
      expect(callOptions.headers?.Accept).toBe('application/vnd.github.v3+json');
      expect(callOptions.headers?.['User-Agent']).toBe('Riffly-Discord-Bot');
    });

    it('returns success on HTTP 200 with minimal/missing optional fields', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve(sampleMinimalUser),
      });

      const result = await fetchGitHubUser('minimal-dev', { fetcher: mockFetch });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user.name).toBeNull();
        expect(result.user.bio).toBeNull();
      }
    });

    it('returns not_found reason on HTTP 404', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 404,
        headers: new Headers(),
      });

      const result = await fetchGitHubUser('nonexistent-ghost-404', { fetcher: mockFetch });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('not_found');
        if (result.reason === 'not_found') {
          expect(result.username).toBe('nonexistent-ghost-404');
        }
      }
    });

    it('returns rate_limited with parsed reset timestamp on HTTP 403 with x-ratelimit-reset', async () => {
      const resetEpoch = 1735689600;
      const headers = new Headers();
      headers.set('x-ratelimit-reset', resetEpoch.toString());

      const mockFetch = vi.fn().mockResolvedValue({
        status: 403,
        headers,
      });

      const result = await fetchGitHubUser('octocat', { fetcher: mockFetch });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('rate_limited');
        if (result.reason === 'rate_limited') {
          expect(result.resetAt).toBe(resetEpoch);
        }
      }
    });

    it('returns rate_limited with undefined resetAt on HTTP 403 without reset header', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 403,
        headers: new Headers(),
      });

      const result = await fetchGitHubUser('octocat', { fetcher: mockFetch });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('rate_limited');
        if (result.reason === 'rate_limited') {
          expect(result.resetAt).toBeUndefined();
        }
      }
    });

    it('returns error reason on HTTP 500 server error', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 500,
        headers: new Headers(),
      });

      const result = await fetchGitHubUser('octocat', { fetcher: mockFetch });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('error');
        if (result.reason === 'error') {
          expect(result.status).toBe(500);
          expect(result.message).toContain('HTTP 500');
        }
      }
    });

    it('handles AbortError timeout gracefully', async () => {
      const mockFetch = vi.fn().mockImplementation(() => {
        const error = new Error('The operation was aborted due to timeout');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      const result = await fetchGitHubUser('octocat', { fetcher: mockFetch });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('timeout');
      }
    });

    it('injects optional Authorization header when token is supplied', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve(sampleFullUser),
      });

      await fetchGitHubUser('octocat', {
        fetcher: mockFetch,
        token: 'ghp_secret_token_123',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, callOptions] = mockFetch.mock.calls[0] as [
        string,
        { headers?: Record<string, string> },
      ];
      expect(callOptions.headers?.Authorization).toBe('Bearer ghp_secret_token_123');
    });

    it('reads process.env.GITHUB_TOKEN when options.token is omitted', async () => {
      const originalEnv = process.env.GITHUB_TOKEN;
      try {
        process.env.GITHUB_TOKEN = 'ghp_env_token_999';
        const mockFetch = vi.fn().mockResolvedValue({
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve(sampleFullUser),
        });

        await fetchGitHubUser('octocat', { fetcher: mockFetch });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [, callOptions] = mockFetch.mock.calls[0] as [
          string,
          { headers?: Record<string, string> },
        ];
        expect(callOptions.headers?.Authorization).toBe('Bearer ghp_env_token_999');
      } finally {
        process.env.GITHUB_TOKEN = originalEnv;
      }
    });

    it('never exposes token in error messages if network call fails', async () => {
      const secretToken = 'ghp_super_secret_never_leak';
      const mockFetch = vi.fn().mockRejectedValue(new Error(`Failed connection with ${secretToken}`));

      const result = await fetchGitHubUser('octocat', {
        fetcher: mockFetch,
        token: secretToken,
      });

      expect(result.success).toBe(false);
      if (!result.success && result.reason === 'error') {
        expect(result.message).not.toContain(secretToken);
        expect(result.message).toContain('[REDACTED]');
      }
    });

    it('short-circuits on invalid username without triggering HTTP fetch', async () => {
      const mockFetch = vi.fn();
      const result = await fetchGitHubUser('-invalid-name', { fetcher: mockFetch });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('invalid_username');
      }
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // SUITE 3: Embed Builder Structure & Formatting
  // =========================================================================
  describe('Suite 3: Discord Embed Builder', () => {
    it('builds rich embed with full user information and dark theme', () => {
      const embed = buildGitHubUserEmbed(sampleFullUser);
      const json = embed.toJSON();

      expect(json.color).toBe(0x24292e);
      expect(json.title).toBe('🐙 The Octocat (@octocat)');
      expect(json.url).toBe('https://github.com/octocat');
      expect(json.thumbnail?.url).toBe(sampleFullUser.avatar_url);
      expect(json.description).toContain('There once was a story...');
      expect(json.description).toContain(
        '[**View GitHub Profile (@octocat)**](https://github.com/octocat)',
      );

      const fields = json.fields ?? [];
      const getFieldValue = (name: string) => fields.find((f) => f.name === name)?.value;

      expect(getFieldValue('📦 Repositories')).toBe('8');
      expect(getFieldValue('👥 Followers')).toBe('9,000');
      expect(getFieldValue('👤 Following')).toBe('9');
      expect(getFieldValue('🏢 Company')).toBe('@github');
      expect(getFieldValue('📍 Location')).toBe('San Francisco');
      expect(getFieldValue('🌐 Website')).toBe('[https://github.blog](https://github.blog)');
      expect(getFieldValue('📅 Joined GitHub')).toMatch(/<t:\d+:D> \(<t:\d+:R>\)/);

      expect(json.footer?.text).toBe('GitHub Public API');
      expect(json.footer?.icon_url).toBe(
        'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
      );
      expect(json.timestamp).toBeDefined();
    });

    it('builds embed gracefully when optional fields are null or empty', () => {
      const embed = buildGitHubUserEmbed(sampleMinimalUser);
      const json = embed.toJSON();

      expect(json.title).toBe('🐙 @minimal-dev');
      expect(json.description).not.toContain('null');
      expect(json.description).toContain(
        '[**View GitHub Profile (@minimal-dev)**](https://github.com/minimal-dev)',
      );

      const fields = json.fields ?? [];
      const getFieldValue = (name: string) => fields.find((f) => f.name === name)?.value;

      expect(getFieldValue('📦 Repositories')).toBe('0');
      expect(getFieldValue('👥 Followers')).toBe('0');
      expect(getFieldValue('👤 Following')).toBe('0');
      expect(getFieldValue('🏢 Company')).toBe('None');
      expect(getFieldValue('📍 Location')).toBe('None');
      expect(getFieldValue('🌐 Website')).toBe('None');
      expect(getFieldValue('📅 Joined GitHub')).toMatch(/<t:\d+:D> \(<t:\d+:R>\)/);
    });

    it('formats website link with https prefix when omitted in user blog', () => {
      const userWithRawBlog: GitHubUserResponse = {
        ...sampleMinimalUser,
        blog: 'dev.example.com',
      };
      const embed = buildGitHubUserEmbed(userWithRawBlog);
      const json = embed.toJSON();
      const websiteField = json.fields?.find((f) => f.name === '🌐 Website');
      expect(websiteField?.value).toBe('[dev.example.com](https://dev.example.com)');
    });
  });

  // =========================================================================
  // SUITE 4: Slash Command Execution Flow
  // =========================================================================
  describe('Suite 4: Slash Command Execution Flow', () => {
    const ext = createExtendedUtilityCommands();
    const githubCmd = ext.find((c) => c.name === 'github');

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('exists and is defined in extended utility commands', () => {
      expect(githubCmd).toBeDefined();
    });

    it('executes /github username with success and edits reply with rich embed', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve(sampleFullUser),
      } as unknown as Response);

      const deferReply = vi.fn().mockResolvedValue(true);
      const editReply = vi.fn().mockResolvedValue(true);
      const reply = vi.fn().mockResolvedValue(true);

      const interaction = {
        options: {
          getString: (name: string) => (name === 'username' ? 'octocat' : null),
        },
        deferReply,
        editReply,
        reply,
      } as unknown as ChatInputCommandInteraction;

      await githubCmd!.execute(interaction);

      expect(deferReply).toHaveBeenCalledTimes(1);
      expect(editReply).toHaveBeenCalledTimes(1);
      const callArg = editReply.mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] } | undefined;
      expect(callArg?.embeds).toHaveLength(1);
      const embed = callArg?.embeds?.[0];
      expect(embed?.data.title).toBe('🐙 The Octocat (@octocat)');
      expect(reply).not.toHaveBeenCalled();
    });

    it('executes /github username with 404 not found and edits reply with friendly message', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        status: 404,
        headers: new Headers(),
      } as unknown as Response);

      const deferReply = vi.fn().mockResolvedValue(true);
      const editReply = vi.fn().mockResolvedValue(true);

      const interaction = {
        options: {
          getString: (name: string) => (name === 'username' ? 'nonexistent-user-123' : null),
        },
        deferReply,
        editReply,
      } as unknown as ChatInputCommandInteraction;

      await githubCmd!.execute(interaction);

      expect(deferReply).toHaveBeenCalledTimes(1);
      expect(editReply).toHaveBeenCalledTimes(1);
      const callArg = editReply.mock.calls[0]?.[0] as { content?: string } | undefined;
      expect(callArg?.content).toContain('was not found on GitHub');
    });

    it('executes /github username with 403 rate limit and displays reset timestamp', async () => {
      const resetEpoch = 1735689600;
      const headers = new Headers();
      headers.set('x-ratelimit-reset', resetEpoch.toString());

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        status: 403,
        headers,
      } as unknown as Response);

      const deferReply = vi.fn().mockResolvedValue(true);
      const editReply = vi.fn().mockResolvedValue(true);

      const interaction = {
        options: {
          getString: (name: string) => (name === 'username' ? 'octocat' : null),
        },
        deferReply,
        editReply,
      } as unknown as ChatInputCommandInteraction;

      await githubCmd!.execute(interaction);

      expect(deferReply).toHaveBeenCalledTimes(1);
      expect(editReply).toHaveBeenCalledTimes(1);
      const callArg = editReply.mock.calls[0]?.[0] as { content?: string } | undefined;
      expect(callArg?.content).toContain('rate limit exceeded');
    });

    it('executes /github username with timeout and informs user', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      const deferReply = vi.fn().mockResolvedValue(true);
      const editReply = vi.fn().mockResolvedValue(true);

      const interaction = {
        options: {
          getString: (name: string) => (name === 'username' ? 'octocat' : null),
        },
        deferReply,
        editReply,
      } as unknown as ChatInputCommandInteraction;

      await githubCmd!.execute(interaction);

      expect(deferReply).toHaveBeenCalledTimes(1);
      expect(editReply).toHaveBeenCalledTimes(1);
      const callArg = editReply.mock.calls[0]?.[0] as { content?: string } | undefined;
      expect(callArg?.content).toContain('timed out');
    });

    it('executes /github username with invalid input and edits reply with validation error', async () => {
      const deferReply = vi.fn().mockResolvedValue(true);
      const editReply = vi.fn().mockResolvedValue(true);

      const interaction = {
        options: {
          getString: (name: string) => (name === 'username' ? '-invalid-hyphen-' : null),
        },
        deferReply,
        editReply,
      } as unknown as ChatInputCommandInteraction;

      await githubCmd!.execute(interaction);

      expect(deferReply).toHaveBeenCalledTimes(1);
      expect(editReply).toHaveBeenCalledTimes(1);
      const callArg = editReply.mock.calls[0]?.[0] as { content?: string } | undefined;
      expect(callArg?.content).toContain('Invalid username');
    });

    it('maintains backwards compatibility when /github repo option is specified', async () => {
      const reply = vi.fn().mockResolvedValue(true);
      const interaction = {
        options: {
          getString: (name: string) => (name === 'repo' ? 'ElonCoding/Riffly' : null),
        },
        reply,
      } as unknown as ChatInputCommandInteraction;

      await githubCmd!.execute(interaction);

      expect(reply).toHaveBeenCalledTimes(1);
      const callArg = reply.mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] } | undefined;
      expect(callArg?.embeds).toHaveLength(1);
      const embed = callArg?.embeds?.[0];
      expect(embed?.data.title).toContain('ElonCoding/Riffly');
    });

    it('returns ephemeral guidance message when neither username nor repo is specified', async () => {
      const reply = vi.fn().mockResolvedValue(true);
      const interaction = {
        options: {
          getString: () => null,
        },
        reply,
      } as unknown as ChatInputCommandInteraction;

      await githubCmd!.execute(interaction);

      expect(reply).toHaveBeenCalledTimes(1);
      const callArg = reply.mock.calls[0]?.[0] as
        | { content?: string; ephemeral?: boolean }
        | undefined;
      expect(callArg?.content).toContain('Please specify a GitHub `username`');
      expect(callArg?.ephemeral).toBe(true);
    });
  });

  // =========================================================================
  // SUITE 5: Command Registry and Discord Limit Compliance
  // =========================================================================
  describe('Suite 5: Command Registry & Discord 100 Limit Compliance', () => {
    it('configures both username and repo options as optional strings', () => {
      const ext = createExtendedUtilityCommands();
      const githubCmd = ext.find((c) => c.name === 'github');
      expect(githubCmd?.data).toBeDefined();
      const json = githubCmd!.data!.toJSON();
      expect(json.name).toBe('github');
      expect(json.description).toContain('GitHub user profile information or repository');

      const options = json.options ?? [];
      expect(options).toHaveLength(2);

      const usernameOpt = options.find((o) => o.name === 'username');
      expect(usernameOpt).toBeDefined();
      expect(usernameOpt?.description).toContain('GitHub username');
      expect(usernameOpt?.required).toBeFalsy();

      const repoOpt = options.find((o) => o.name === 'repo');
      expect(repoOpt).toBeDefined();
      expect(repoOpt?.description).toContain('owner/repo');
      expect(repoOpt?.required).toBeFalsy();
    });

    it('ensures extended utility commands length remains exactly 25', () => {
      const ext = createExtendedUtilityCommands();
      expect(ext).toHaveLength(25);
    });

    it('ensures allCommandData contains github command', () => {
      const gh = allCommandData.find((c) => c.name === 'github');
      expect(gh).toBeDefined();
    });

    it('strictly satisfies Discord global slash command limit (<= 100) with zero duplicates', () => {
      expect(allCommandData.length).toBeGreaterThan(0);
      expect(allCommandData.length).toBeLessThanOrEqual(100);

      const seen = new Set<string>();
      for (const cmd of allCommandData) {
        expect(seen.has(cmd.name)).toBe(false);
        seen.add(cmd.name);
      }
      expect(seen.size).toBe(100);
      expect(seen.has('github')).toBe(true);
    });
  });
});
