import { INITIAL_STATE_ID, splitTargetId } from "../../schema/index.ts";
import type { Prerequisite, TargetExecution } from "../../schema/index.ts";

/**
 * Whether prerequisite `p` counts as met on `target` for deriving a status
 * (see `PREREQUISITE_MEANING` in `../contract.ts`):
 * - `state`: the target is established, its state id is not `initial`, and
 *   `prerequisitesMet` lists `state`;
 * - `keyboard`, `media`: the target is established and `prerequisitesMet`
 *   lists it (the engine lists them only after the passes that define them);
 * - `model`, `assistive_tech`: never.
 */
export function prerequisiteMetForStatus(p: Prerequisite, target: TargetExecution): boolean {
  if (!target.established || !target.prerequisitesMet.includes(p)) return false;
  switch (p) {
    case "state":
      return splitTargetId(target.targetId).stateId !== INITIAL_STATE_ID;
    case "keyboard":
    case "media":
      return true;
    case "model":
    case "assistive_tech":
      return false;
  }
}

/** The prerequisites in `needs` that are not met on `target` for deriving a status, in `needs` order. */
export function unmetPrerequisites(needs: readonly Prerequisite[], target: TargetExecution): Prerequisite[] {
  return needs.filter((p) => !prerequisiteMetForStatus(p, target));
}
