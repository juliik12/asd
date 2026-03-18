import type { AIService, ChatMessage } from './types';
import { initDB, getUsers, getUserById, insertUser, deleteUser } from './db';

console.log('[startup] Checking environment variables...');

const requiredEnvVars: Record<string, string | undefined> = {
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY,
};

for (const [name, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    console.warn(`[startup] ⚠ Missing env var: ${name}`);
  } else {
    console.log(`[startup] ✓ ${name} is set`);
  }
}

console.log(`[startup] PORT=${process.env.PORT ?? '3000 (default)'}`);

const services: AIService[] = [];

try {
  const { groqService } = await import('./services/groq');
  services.push(groqService);
  console.log('[startup] ✓ Groq service loaded');
} catch (err) {
  console.error('[startup] ✗ Failed to load Groq service:', (err as Error).message);
}

try {
  const { cerebrasService } = await import('./services/cerebras');
  services.push(cerebrasService);
  console.log('[startup] ✓ Cerebras service loaded');
} catch (err) {
  console.error('[startup] ✗ Failed to load Cerebras service:', (err as Error).message);
}

if (services.length === 0) {
  console.error('[startup] ✗ No AI services available. Exiting.');
  process.exit(1);
}

console.log(`[startup] ${services.length} service(s) ready: ${services.map(s => s.name).join(', ')}`);
let currentServiceIndex = 0;

function getNextService() {
  const service = services[currentServiceIndex];
  currentServiceIndex = (currentServiceIndex + 1) % services.length;
  return service;
}

const server = Bun.serve({
  port: process.env.PORT ?? 3000,
  hostname: '0.0.0.0',
  async fetch(req) {
    const { pathname } = new URL(req.url)

    if (req.method === 'POST' && pathname === '/chat') {
      try {
        const { messages } = await req.json() as { messages: ChatMessage[] };
        const service = getNextService();

        console.log(`[request] Using ${service.name} service`);
        const stream = await service.chat(messages);

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } catch (err) {
        console.error('[request] Error processing /chat:', (err as Error).message);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response("Not found", { status: 404 });
  }
})

console.log(`Server is running on ${server.url}`);