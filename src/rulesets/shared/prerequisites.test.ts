import { describe, expect, it } from "vitest";
import { targetInitial, targetState } from "../../../tests/fixtures/schema-fixtures.ts";
import { TargetExecutionSchema } from "../../schema/index.ts";
import { prerequisiteMetForStatus, unmetPrerequisites } from "./prerequisites.ts";

const initial = (met: string[] = []) => TargetExecutionSchema.parse({ ...targetInitial(), prerequisitesMet: met });
const state = (met: string[] = ["state"]) => TargetExecutionSchema.parse({ ...targetState(), prerequisitesMet: met });

describe("prerequisites for deriving a status", () => {
  it("state: met only on an established declared state other than initial", () => {
    expect(prerequisiteMetForStatus("state", state())).toBe(true);
    expect(prerequisiteMetForStatus("state", state([]))).toBe(false);
    expect(prerequisiteMetForStatus("state", initial())).toBe(false);
  });

  it("keyboard and media: met only when the engine lists them", () => {
    expect(prerequisiteMetForStatus("keyboard", initial())).toBe(false);
    expect(prerequisiteMetForStatus("keyboard", initial(["keyboard"]))).toBe(true);
    expect(prerequisiteMetForStatus("media", initial(["media"]))).toBe(true);
  });

  it("nothing is met on a target that was not established", () => {
    const t = targetInitial();
    t.established = false;
    t.prerequisitesMet = ["keyboard"];
    expect(prerequisiteMetForStatus("keyboard", TargetExecutionSchema.parse(t))).toBe(false);
  });

  it("model and assistive_tech: never met for a status", () => {
    expect(prerequisiteMetForStatus("model", initial(["model"]))).toBe(false);
    expect(prerequisiteMetForStatus("assistive_tech", initial())).toBe(false);
  });

  it("lists the unmet ones in needs order", () => {
    expect(unmetPrerequisites(["model", "state", "keyboard"], state(["state", "keyboard", "model"]))).toEqual(["model"]);
  });
});
