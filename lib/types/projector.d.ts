/**
 * Projects dsh session events onto MessageRow / SessionRow.
 *
 * Event shapes verified against the dsh persistence catalog
 * (https://deepseek-harness.github.io/deepseek-harness/reference/persistence-catalog)
 * and the @deepseek-ai/dsh-llm message types:
 * - envelope: `{ type, seq, time, data }` — payload lives under `data`.
 * - `user/message` and `assistant/message` produce rows; `tool/result` updates
 *   the matching assistant row's toolCalls instead of producing a tool row.
 * - token usage (V3 log): `assistant/message.data.usage` is the settled
 *   step's accounting; a failed/cancelled attempt commits `assistant/attempt`
 *   instead, with the adapter's usage chunk preserved as a raw record in its
 *   embedded compact stream (recovered in usageSampleOf). `turn/end` carries
 *   none — it only serves as a rollup checkpoint.
 * - compaction summaries enter the surface as a `user/message` with
 *   `surfaceOp: replace`, so they flow through the user path unchanged.
 */
import type { MessageRow } from './types.js';
/**
 * Map one session event to zero or one message row. Returns null for events
 * that should not be persisted as standalone rows (log-only events: chunks,
 * turn/step lifecycle, approvals, ...).
 */
export declare function projectEvent(_session: any, event: any, sessionId: string): MessageRow | null;
/** Identify the assistant tool call answered by either supported result shape. */
export declare function toolResultCallId(event: any): string | undefined;
/** Update the persisted assistant call identified by a tool result. */
export declare function mergeToolResult(event: any, rows: MessageRow[]): MessageRow | null;
export interface UsageSample {
    input: number;
    output: number;
}
/**
 * Extract one model call's usage, keyed by its durable event sequence.
 *
 * V3 session log (dsh-session@0.1.6-alpha.2):
 * - `assistant/message.data.usage` — the settled call's accounting;
 * - `assistant/attempt` — a failed/retried/cancelled call commits no surface
 *   message; the adapter's usage chunk survives as a raw `chunk` record in the
 *   embedded compact `stream` (deltas are packed, but usage is a raw type).
 *
 * Calls on one `(turn, step)` are additive: a retry is another billed model
 * call, not a progressive snapshot. Only redelivery of the same event sequence
 * is a duplicate. Totals include the cache buckets: cacheRead/cacheWrite are
 * billed in their own buckets (observed cacheReadTokens ≫ inputTokens in dsh
 * session logs — they are not subsets of inputTokens).
 */
export declare function usageSampleOf(event: any): {
    key: string;
    sample: UsageSample;
} | null;
