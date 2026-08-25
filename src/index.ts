import type { Env } from "./types";
import { handleUpdate } from "./telegram";
import { runScheduledCheck } from "./cron";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // آدرس webhook تلگرام: https://<your-worker>.workers.dev/webhook
    if (url.pathname === "/webhook" && request.method === "POST") {
      const update = await request.json();
      await handleUpdate(env, update);
      return new Response("ok");
    }

    if (url.pathname === "/") {
      return new Response("Price Radar is running 🔍");
    }

    return new Response("not found", { status: 404 });
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runScheduledCheck(env));
  },
};
