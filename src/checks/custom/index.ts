/**
 * The custom check providers, in the order the engine runs them (before axe).
 * Each family builder adds its own providers here, one line each.
 */
import type { CheckProvider } from "../types.ts";
import { presentationProvider } from "./family-b/index.ts";
import { familyCProvider } from "./family-c/provider.ts";

export const customProviders: readonly CheckProvider[] = [
  presentationProvider,
  familyCProvider,
];
