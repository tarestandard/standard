/**
 * The published scope counts, parsed once from the Family table the
 * `/agent/scope` page renders.
 *
 * The page states the split in its own prose ("44 of the 50 requirements have
 * no row. Four families are at zero") and draws it as a figure beside the
 * table. This module is the one parse behind the figure, the page's metadata
 * and the build gate: `assertScopePrinted` fails the build when the rendered
 * table, the prose printed beside it, or the figure drawn from it disagree
 * (critique 2026-11-13, priority issue 1).
 *
 * The denominator is AIUC-1's own count — 50 live requirements in six families
 * — as `docs/standard/agent/mappings.md` states. The table supplies what that count
 * cannot: which requirements have a row, in which family.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const AIUC1_LIVE_REQUIREMENTS = 50;
export const AIUC1_FAMILY_COUNT = 6;

/**
 * AIUC-1's own live requirement count per family. The Family table decides
 * which requirements have a row; these sizes place those rows in the full
 * fifty-cell field, so the four families at zero are visible as bands rather
 * than inferred from a caption.
 */
export const AIUC1_FAMILY_SIZES: readonly {
  letter: string;
  name: string;
  size: number;
}[] = [
  { letter: "A", name: "Data & Privacy", size: 9 },
  { letter: "B", name: "Security", size: 10 },
  { letter: "C", name: "Safety", size: 10 },
  { letter: "D", name: "Reliability", size: 3 },
  { letter: "E", name: "Accountability", size: 16 },
  { letter: "F", name: "Society", size: 2 },
];

const FAMILY_SIZE_TOTAL = AIUC1_FAMILY_SIZES.reduce((total, family) => total + family.size, 0);
if (FAMILY_SIZE_TOTAL !== AIUC1_LIVE_REQUIREMENTS) {
  throw new Error(
    `AIUC-1's family sizes sum to ${FAMILY_SIZE_TOTAL}; the scope denominator is ${AIUC1_LIVE_REQUIREMENTS}.`,
  );
}

export type ScopeFamilyCount = {
  letter: string;
  name: string;
  count: number;
};

export type ScopeCounts = {
  total: number;
  covered: number;
  noRow: number;
  zeroFamilies: number;
  families: ScopeFamilyCount[];
};

const SCOPE_SECTION = /^##\s+Scope\b/;
const FAMILY_HEADER = /^\|\s*Family\s*\|\s*AIUC-1 requirement\s*\|/;

const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
] as const;
const TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
] as const;

/** Spell a count the way the front-page sentence speaks it. */
export function spellCount(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 99) {
    throw new Error(`No published spelling for the scope count ${value}`);
  }
  if (value < 20) return ONES[value] ?? String(value);
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  if (ones === 0) return TENS[tens] ?? String(value);
  return `${TENS[tens]}-${ONES[ones]}`;
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

/**
 * Read the Scope Family table out of the mappings Markdown. Throws when the
 * section, the table or a row's family is not readable, so a restructured
 * document fails the build instead of silently changing the denominator.
 */
export function parseScopeCounts(markdown: string): ScopeCounts {
  const lines = markdown.split(/\r?\n/);
  const scopeStart = lines.findIndex((line) => SCOPE_SECTION.test(line));
  if (scopeStart === -1) {
    throw new Error(
      "docs/standard/agent/mappings.md has no Scope section, so the published split cannot be derived",
    );
  }

  let header = -1;
  for (let index = scopeStart + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (/^##\s/.test(line)) break;
    if (FAMILY_HEADER.test(line)) {
      header = index;
      break;
    }
  }
  if (header === -1) {
    throw new Error(
      "docs/standard/agent/mappings.md has no Family | AIUC-1 requirement table in its Scope section",
    );
  }

  const families = new Map<string, ScopeFamilyCount>();
  // The denominator counts distinct requirements, not rows: a requirement
  // printed twice would otherwise publish "7 of 50" consistently and pass.
  const requirements = new Set<string>();
  for (let index = header + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!line.trim().startsWith("|")) break;
    const cells = splitRow(line);
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;

    const family = cells[0] ?? "";
    const match = /^([A-Z])\s+(.+)$/.exec(family);
    const letter = match?.[1];
    const name = match?.[2]?.trim();
    if (!letter || !name) {
      throw new Error(`The scope Family table has a row without a family: ${line}`);
    }

    const requirement = cells[1] ?? "";
    const requirementId = /\b([A-F]\d{3})\b/.exec(requirement)?.[1];
    if (!requirementId) {
      throw new Error(`The scope Family table has a row without an AIUC-1 requirement id: ${line}`);
    }
    if (requirements.has(requirementId)) {
      throw new Error(
        `The AIUC-1 requirement ${requirementId} appears twice in the scope Family table; ` +
          "each requirement is covered once.",
      );
    }
    requirements.add(requirementId);

    const current = families.get(letter);
    families.set(letter, {
      letter,
      name: current?.name ?? name,
      count: (current?.count ?? 0) + 1,
    });
  }
  const covered = requirements.size;

  if (covered === 0) {
    throw new Error("The scope Family table in docs/standard/agent/mappings.md has no rows");
  }
  if (covered > AIUC1_LIVE_REQUIREMENTS) {
    throw new Error(
      `The scope Family table has ${covered} rows for ${AIUC1_LIVE_REQUIREMENTS} live AIUC-1 requirements`,
    );
  }
  if (families.size > AIUC1_FAMILY_COUNT) {
    throw new Error(
      `The scope Family table names ${families.size} families; AIUC-1 publishes ${AIUC1_FAMILY_COUNT}`,
    );
  }

  return {
    total: AIUC1_LIVE_REQUIREMENTS,
    covered,
    noRow: AIUC1_LIVE_REQUIREMENTS - covered,
    zeroFamilies: AIUC1_FAMILY_COUNT - families.size,
    families: [...families.values()].sort((a, b) => a.letter.localeCompare(b.letter)),
  };
}

/** Load the counts from the document the /scope page renders. */
export function loadScopeCounts(): ScopeCounts {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  return parseScopeCounts(
    readFileSync(resolve(repoRoot, "docs/standard/agent/mappings.md"), "utf8"),
  );
}

/** The sentence's zero clause, spelled for the count. */
function zeroClause(counts: ScopeCounts): string {
  if (counts.zeroFamilies === 0) return "No family is at zero.";
  if (counts.zeroFamilies === 1) return "One family is at zero.";
  return `${capitalise(spellCount(counts.zeroFamilies))} families are at zero.`;
}

/** The family split, spelled for the table it came from. */
export function familyPhrase(counts: ScopeCounts): string {
  const parts = counts.families.map((family) => `${spellCount(family.count)} in ${family.name}`);
  if (parts.length === 0) return "none";
  if (parts.length === 1) return parts[0] ?? "none";
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function plainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** The Family table as the rendered /scope page prints it, family → row count. */
export function renderedFamilyCounts(scopeHtml: string): Map<string, number> {
  const tables = [...scopeHtml.matchAll(/<table\b[\s\S]*?<\/table>/g)].map((match) => match[0]);
  const table = tables.find((candidate) => {
    const head = candidate.slice(
      candidate.indexOf("<thead>"),
      candidate.indexOf("</thead>") + "</thead>".length,
    );
    return plainText(head).includes("AIUC-1 requirement");
  });
  if (!table) {
    throw new Error("The /scope page has no Family | AIUC-1 requirement table to check");
  }

  const bodyStart = table.indexOf("<tbody>");
  const bodyEnd = table.indexOf("</tbody>");
  if (bodyStart === -1 || bodyEnd === -1) {
    throw new Error("The /scope Family table has no <tbody> to read rows from");
  }
  const body = table.slice(bodyStart, bodyEnd);
  const counts = new Map<string, number>();
  for (const row of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cell = /<td\b[^>]*>([\s\S]*?)<\/td>/.exec(row[1] ?? "");
    const family = plainText(cell?.[1] ?? "");
    if (!family) {
      throw new Error("The /scope Family table has a row without a readable family");
    }
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  return counts;
}

function describeFamilies(counts: ReadonlyMap<string, number>): string {
  return (
    [...counts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([family, count]) => `${family}: ${count}`)
      .join(", ") || "no rows"
  );
}

/**
 * The build gate: the `/agent/scope` page prints the counts its Family table
 * yields.
 *
 * The rendered table is compared with the parse, then the page's own prose — the
 * Markdown it was rendered from, so the generated figure cannot satisfy its own
 * gate — must state the same numerator, the same no-row count and the same
 * zero-family count. A table change that leaves the prose stale fails here
 * instead of publishing two counts for one scope.
 */
export function assertScopePrinted(input: {
  scopeHtml: string;
  markdown: string;
  counts: ScopeCounts;
}): void {
  const rendered = renderedFamilyCounts(input.scopeHtml);
  const expected = new Map(
    input.counts.families.map((family) => [`${family.letter} ${family.name}`, family.count]),
  );
  const agrees =
    rendered.size === expected.size &&
    [...expected].every(([family, count]) => rendered.get(family) === count);
  if (!agrees) {
    throw new Error(
      "The /agent/scope Family table does not match the mappings parse: the page prints " +
        `${describeFamilies(rendered)}; docs/standard/agent/mappings.md derives ${describeFamilies(expected)}. ` +
        "The build refuses to publish two counts for one scope.",
    );
  }

  const required = [
    `${input.counts.covered} of ${input.counts.total}`,
    `${input.counts.noRow} of the ${input.counts.total} requirements`,
    // The split is the numeral the first critique caught; the figure draws it
    // and the prose must state it, so a row moved between families fails here.
    familyPhrase(input.counts),
    // The prose may follow the clause with a colon and its list, so only the
    // clause itself is required.
    zeroClause(input.counts).replace(/\.$/, ""),
  ];
  for (const phrase of required) {
    if (!input.markdown.includes(phrase)) {
      throw new Error(
        `The /agent/scope page does not print the scope derived from its Family table ` +
          `(${describeFamilies(expected)}): expected "${phrase}". ` +
          "Derive the numerals from docs/standard/agent/mappings.md; do not type a second split.",
      );
    }
  }
}

/**
 * The family bands' one gate: every row the parse finds must belong to a family
 * with a place in the fifty-cell field, and no band may be overfilled. The
 * tally draws `covered` from the parse, so a letter the constant does not know
 * (or a count larger than the band) would otherwise publish a figure that
 * disagrees with its own count.
 */
export function assertFamilyBands(counts: ScopeCounts): void {
  if (counts.total !== FAMILY_SIZE_TOTAL) {
    throw new Error(
      `The scope denominator is ${counts.total}; the family bands hold ${FAMILY_SIZE_TOTAL} requirements.`,
    );
  }
  const sizes = new Map(AIUC1_FAMILY_SIZES.map((family) => [family.letter, family.size]));
  const seen = new Set<string>();
  let total = 0;
  for (const family of counts.families) {
    if (seen.has(family.letter)) {
      throw new Error(`The scope Family table names ${family.letter} twice; one family, one band.`);
    }
    seen.add(family.letter);
    const size = sizes.get(family.letter);
    if (size === undefined) {
      throw new Error(
        `The scope Family table names ${family.letter}, a family AIUC-1's sizes do not publish.`,
      );
    }
    if (family.count > size) {
      throw new Error(
        `The scope Family table gives ${family.letter} ${family.count} rows; the family has ${size} live requirements.`,
      );
    }
    total += family.count;
  }
  if (total !== counts.covered) {
    throw new Error(
      `The scope Family table's rows sum to ${total}; the parse counts ${counts.covered}.`,
    );
  }
}
