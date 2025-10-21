import { z } from "zod";

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(2000),
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum(["image/jpeg", "image/png"]),
  name: z.string().min(1).max(100),
  url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  // Keep required, but allow any shape (client sends UIMessage)
  message: z.any(),
  // Align with ChatModel ids in lib/ai/models.ts
  selectedChatModel: z.enum(["chat-model", "chat-model-reasoning"]),
  // Align with VisibilityType ("public" | "private")
  selectedVisibilityType: z.enum(["public", "private"]),
  // Optional persona name (no cookies/auth). Used to key logs and memory.
  personaName: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[\w .@+-]+$/)
    .optional(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
