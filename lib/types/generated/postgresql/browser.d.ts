import * as Prisma from './internal/prismaNamespaceBrowser.js';
export { Prisma };
export * as $Enums from './enums.js';
export * from './enums.js';
/**
 * Model AiMessage
 * User and assistant messages; tool results update the assistant row's tool_calls.
 */
export type AiMessage = Prisma.AiMessageModel;
/**
 * Model AiChatHistory
 * Per-session rollup, maintained incrementally by the projector.
 */
export type AiChatHistory = Prisma.AiChatHistoryModel;
