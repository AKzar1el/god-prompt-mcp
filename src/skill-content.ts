import { CONTENT } from "./content.js";

// Version 1.0.0 was generated before the source layout moved from core/* to
// SKILL.md + references/*. Normalize only those legacy links at the serving
// boundary; regenerated content from the repaired generator makes this a no-op.
export const CORE_SKILL = CONTENT.CORE_SKILL
  .replaceAll("core/01-PROTOCOLS.md", "references/01-PROTOCOLS.md")
  .replaceAll("core/02-GATES.md", "references/02-GATES.md")
  .replaceAll("core/03-ANTI-PATTERNS.md", "references/03-ANTI-PATTERNS.md");
