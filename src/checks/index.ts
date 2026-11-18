/**
 * Every check provider, in the order the engine runs them: the custom
 * providers first, the axe adapter last. The engine imports no provider; the
 * CLI and the evaluation harness give it this list.
 */
import type { CheckProvider } from "./types.ts";
import { axeProvider } from "./axe/index.ts";
import { customProviders } from "./custom/index.ts";

export function allProviders(): CheckProvider[] {
  return [...customProviders, axeProvider];
}
