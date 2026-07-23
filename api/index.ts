// Vercel serverless entry point.
// Vercel routes any request matching /api/* here (see rewrites in vercel.json),
// and invokes this file's default export as (req, res) per request - it never
// calls app.listen() itself. We build the Express app once per warm function
// instance (cached in appPromise) and hand each request straight to it.
import { buildApp } from "../server.js";

let appPromise: ReturnType<typeof buildApp> | null = null;

export default async function handler(req: any, res: any) {
  if (!appPromise) {
    appPromise = buildApp();
  }
  const { app } = await appPromise;
  app(req, res);
}
