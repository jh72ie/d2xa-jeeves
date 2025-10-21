/**
 * Inngest Client Configuration
 *
 * Centralized Inngest client for event-driven background jobs
 */

import { Inngest } from "inngest";

// Hardcoded to match Inngest dashboard app name
const appId = "nextjs-ai-chatbot";
const appName = "nextjs-ai-chatbot";

console.log('[Inngest Client] Initializing with:', {
  appId,
  appName,
  hasEventKey: !!process.env.INNGEST_EVENT_KEY,
});

export const inngest = new Inngest({
  id: appId,
  name: appName,
  eventKey: process.env.INNGEST_EVENT_KEY,
});
