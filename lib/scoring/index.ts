// Barrel file: every other part of the app imports from "@/lib/scoring"
// without needing to know it's split into one file per game format.
// When adding a new format, create lib/scoring/<format>.ts and re-export
// it here.

export * from "./types";
export * from "./four-two-zero";
export * from "./matchplay";
export * from "./wolf";
export * from "./stableford";