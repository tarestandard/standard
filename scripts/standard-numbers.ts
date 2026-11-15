/**
 * The counts the standard prints about its own instrument.
 *
 * These are stated here, in the standard's source, and not read from the
 * scanner: a standard that takes its numbers from the private implementation
 * it governs is not independent, and a reader cannot check it. The
 * implementation asserts against these numbers in its own tests instead — the
 * dependency runs from the implementation to the published standard, never
 * back.
 *
 * Each is recomputed from the suite by the implementation's coverage code; if
 * the two ever disagree, the implementation's test fails before a wrong number
 * can be published.
 */
export const CHECKS = { settled: 43, total: 72 } as const;
export const STEPS = { settled: 39, total: 128 } as const;
