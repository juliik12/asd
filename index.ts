import type { AIService } from './types';
import { corsResponse, htmlResponse } from './utils/response';
import { landingHTML } from './views/landing';
import { createChatHandler } from './routes/chat';

console.log('[startup] Checking environment variables...');

const requiredEnvVars: Record<string, string | undefined> = {
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
};

for (const [name, value] of Object.entries(requiredEnvVars)) {
  if (!value) console.warn(`[startup] ⚠ Missing env var: ${name}`);
  else console.log(`[startup] ✓ ${name} is set`);
}

const services: AIService[] = [];

try {
  const { groqService } = await import('./services/groq');
  services.push(groqService);
} catch {}

try {
  const { cerebrasService } = await import('./services/cerebras');
  services.push(cerebrasService);
} catch {}

try {
  const { openrouterService } = await import('./services/openrouter');
  services.push(openrouterService);
} catch {}

if (services.length === 0) {
  console.error('No AI services available');
  process.exit(1);
}

let i = 0;
function getNextService() {
  const s = services[i]!;
  i = (i + 1) % services.length;
  return s;
}

const handleChat = createChatHandler(getNextService);

Bun.serve({
  port: process.env.PORT ?? 3000,
  hostname: '0.0.0.0',

  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') return corsResponse();

    if (req.method === 'GET' && url.pathname === '/') {
      return htmlResponse(landingHTML(url.origin));
    }

    if (req.method === 'POST' && url.pathname === '/chat') {
      return handleChat(req);
    }

    return new Response('Not found', { status: 404 });
  }
});
