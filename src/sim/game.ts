import type { Command, CommandType, Ctx, GameState, HandlerMap, HandlerResult } from './types';
import { DEPARTMENT_HANDLERS } from './department';
import { OPERATION_HANDLERS } from './operation';
import { RESUPPLY_HANDLERS } from './equipment-resupply';

const HANDLERS = { ...DEPARTMENT_HANDLERS, ...OPERATION_HANDLERS, ...RESUPPLY_HANDLERS } as HandlerMap<CommandType>;

/**
 * Apply one command as a transaction. Time is settled first (same code path for
 * online ticks and offline return), then the command runs on a draft. A refused
 * command returns the original state object untouched.
 */
export function dispatch(state: GameState, cmd: Command, ctx: Ctx): { state: GameState; result: HandlerResult } {
  const draft = structuredClone(state);
  const tick = DEPARTMENT_HANDLERS.tick(draft, { type: 'tick' }, ctx);
  if (!tick.ok) return { state, result: tick };
  if (cmd.type === 'tick') return { state: draft, result: tick };

  const handler = HANDLERS[cmd.type] as (d: GameState, c: Command, x: Ctx) => HandlerResult;
  const result = handler(draft, cmd, ctx);
  if (!result.ok) return { state, result };
  draft.department.lastInteractionAt = Math.max(draft.department.lastInteractionAt, draft.department.clockHighWater);
  return { state: draft, result };
}
