import type { EngineInput } from "../../../src/plan/engineTypes.ts";

/** One golden: a name, the engine's input, and (in the test) the pinned output at `<name>.expected.json`. */
export interface GoldenCase {
  name: string;
  input: EngineInput;
}
