import { z } from 'zod';

export const assistantMessageSchema = z.object({
  message: z.string().trim().min(1).max(1000),
}).strict();

export type AssistantMessageInput = z.infer<typeof assistantMessageSchema>;
