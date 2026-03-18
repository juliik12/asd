import type { AIService, ChatMessage } from '../types';
import { jsonResponse } from '../utils/response';

export function createChatHandler(getNextService: () => AIService) {
  return async function handleChat(req: Request): Promise<Response> {
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
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  };
}
