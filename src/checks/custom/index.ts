/**
 * The custom check providers, in the order the engine runs them (before axe).
 * Each family builder adds its own providers here, one line each.
 * `custom/8-2-id-duplicate` comes first: it reads the DOM before any other
 * check has touched it.
 */
import type { CheckProvider } from "../types.ts";
import { idDuplicateProvider } from "./8-2-id-duplicate/index.ts";
import { defaultLangPresentProvider } from "./8-3-default-lang-present/index.ts";
import { langCodeValidProvider } from "./8-4-default-lang-code-valid/index.ts";
import { pageTitleProvider } from "./8-5-page-title-present/index.ts";
import { presentationProvider } from "./family-b/index.ts";
import { familyCProvider } from "./family-c/provider.ts";

export const customProviders: readonly CheckProvider[] = [
  idDuplicateProvider,
  pageTitleProvider,
  defaultLangPresentProvider,
  langCodeValidProvider,
  presentationProvider,
  familyCProvider,
];
