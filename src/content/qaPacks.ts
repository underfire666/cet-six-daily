/**
 * V13: QA / dev-only content registration.
 *
 * Staging papers (e.g. Paper 001) must NOT enter the production
 * global content registry. This module provides explicit QA/dev
 * registration for tests, content scripts, and the QA route.
 *
 * Production client code must never import this module.
 * The QA route guards registration with process.env.NODE_ENV === 'development'
 * so Next.js tree-shakes Paper 001 out of production bundles.
 */

import { registerMockPaper001 } from "./papers/cet6-mock-paper-001";

/** Register QA-only staging content. Safe to call multiple times (idempotent). */
export function registerQaPapers(): void {
  try {
    registerMockPaper001();
  } catch {
    /* already registered — ignore */
  }
}
