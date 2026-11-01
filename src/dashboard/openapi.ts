/**
 * OpenAPI 3.0.3 specification for the Riffly REST API.
 */
export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Riffly Control API',
    description: 'REST API for Riffly modular Discord bot and high-performance audio engine.',
    version: '1.0.0',
    license: {
      name: 'Apache-2.0',
      url: 'https://www.apache.org/licenses/LICENSE-2.0.html',
    },
  },
  servers: [
    {
      url: '/',
      description: 'Local / Current Platform Host',
    },
  ],
  paths: {
    '/api/status': {
      get: {
        summary: 'Get system status and runtime metrics',
        responses: {
          '200': {
            description: 'Operational status, cluster metrics, and uptime.',
          },
        },
      },
    },
    '/api/guilds': {
      get: {
        summary: 'List connected Discord servers',
        responses: {
          '200': {
            description: 'Array of active guild objects.',
          },
        },
      },
    },
    '/api/guilds/{guildId}': {
      get: {
        summary: 'Get guild metadata',
        parameters: [{ name: 'guildId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Guild details.' },
          '404': { description: 'Guild not found.' },
        },
      },
    },
    '/api/guilds/{guildId}/settings': {
      get: {
        summary: 'Retrieve guild configuration settings',
        parameters: [{ name: 'guildId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Guild configuration settings.' } },
      },
      patch: {
        summary: 'Update guild configuration settings',
        parameters: [{ name: 'guildId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { prefix: { type: 'string' }, locale: { type: 'string' } },
              },
            },
          },
        },
        responses: { '200': { description: 'Settings successfully updated.' } },
      },
    },
    '/api/guilds/{guildId}/music': {
      get: {
        summary: 'Get live playback and queue state',
        parameters: [{ name: 'guildId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Player status and track queue.' } },
      },
    },
    '/api/guilds/{guildId}/music/control': {
      post: {
        summary: 'Execute playback action',
        parameters: [{ name: 'guildId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['action'],
                properties: {
                  action: {
                    type: 'string',
                    enum: ['pause', 'resume', 'skip', 'stop', 'seek', 'volume'],
                  },
                  positionMs: { type: 'number' },
                  volume: { type: 'number' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Action executed successfully.' } },
      },
    },
    '/api/guilds/{guildId}/moderation/cases': {
      get: {
        summary: 'List moderation sanction cases',
        parameters: [{ name: 'guildId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Case history.' } },
      },
    },
    '/api/guilds/{guildId}/leaderboard': {
      get: {
        summary: 'Get XP activity leaderboard',
        parameters: [{ name: 'guildId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Ranked user levels.' } },
      },
    },
    '/api/guilds/{guildId}/economy': {
      get: {
        summary: 'Get server wealth ranking',
        parameters: [{ name: 'guildId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Ranked economy accounts.' } },
      },
    },
    '/api/guilds/{guildId}/giveaways': {
      get: {
        summary: 'List active and ended giveaways',
        parameters: [{ name: 'guildId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Giveaway records.' } },
      },
    },
  },
};

/**
 * Returns HTML page for interactive Swagger/OpenAPI documentation.
 */
export function getApiDocsHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Riffly — REST API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    body { margin: 0; background: #0f172a; }
    .swagger-ui { filter: invert(88%) hue-rotate(180deg); }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
      });
    };
  </script>
</body>
</html>`;
}

