# Phase 4: Execution Packets - Research

**Researched:** 2026-01-24
**Domain:** Markdown document generation, bounded-context execution packets, template rendering, git provenance tracking
**Confidence:** HIGH

## Summary

Phase 4 implements execution packet generation - bounded-context markdown documents that contain everything an AI assistant needs to implement one deliverable. The phase has two deliverables: a command (`Dev Workflow: Start Deliverable`) that generates a deterministic packet shell from registry + spec + TDD, and a skill (`/dwa:enrich-packet`) that adds non-deterministic implementation guidance through codebase analysis.

The standard approach uses Handlebars templates (already in stack from Phase 2) for shell generation, git SHA extraction via child_process.execSync for provenance tracking, structured markdown with size budgets (soft: 1,500 words, hard: 2,000 words), and appendix externalization for content that exceeds limits. The key technical challenge is balancing completeness (self-contained for execution) with conciseness (bounded context that doesn't overwhelm LLM context windows).

**Key architectural insight:** Execution packets are both implementation guides AND audit trails. The "self-contained for execution, reference-based for traceability" principle means packets inline critical contract (MUST/MUST NOT, ACs, constraints) but reference sources (spec, TDD, registry) for audit trail. This dual nature requires careful content decisions - what to inline vs. reference vs. externalize.

**Primary recommendation:** Use existing Handlebars infrastructure from Phase 2 for template rendering, extract git provenance via execSync('git rev-parse HEAD'), implement size-aware markdown generation with appendix overflow, structure content as constraints-first (fencing in) then goal-forward (pointing forward), and distinguish command (deterministic shell from known data) from skill (enrichment from LLM analysis).

## Standard Stack

### Core Dependencies (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| handlebars | ^4.7.8 | Template rendering | Already used in Phase 2, proven for markdown generation, 9M+ weekly downloads |
| gray-matter | ^4.0.3 | YAML frontmatter parsing | Parse TDD frontmatter for constraints extraction, industry standard |
| write-file-atomic | ^7.0.0 | Atomic file writes | Crash-safe packet generation via temp+rename, used by npm itself |
| fs-extra | ^11.0.0 | File system utilities | ensureDir for .dwa/packets/, pathExists for validation, robust API |

### New Dependencies Required

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| remark-stringify | ^11.0.0 | AST to markdown | Generate markdown programmatically for appendices, pairs with remark-parse from Phase 3 |

**Note:** remark-stringify enables programmatic markdown generation (needed for appendix splitting) and completes the unified ecosystem already in use for parsing (Phase 3).

### Supporting Utilities (Built In-House)

| Utility | Purpose | Why Build |
|---------|---------|-----------|
| Word counter | Track packet size vs. budget | Simple implementation, need custom logic for markdown (ignore code blocks, count prose) |
| AC categorizer | Group ACs by prefix (C#/F#/N#/E#) | Spec-specific logic, trivial string matching |
| Git provenance extractor | Get file SHA and repo state | Child_process wrapper, 5-10 lines |
| Drift data fetcher | Extract registry drift items | Internal registry format, straightforward filter |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Handlebars | Template literals | Handlebars already installed, provides helpers + partials for complex logic, templates externalized |
| remark-stringify | String concatenation | String concat is error-prone for complex markdown (tables, nested lists); AST approach guarantees valid markdown |
| Appendix files | Inline all content | Exceeds LLM context window limits; 2,000 word hard cap from phase context |
| Git SHA via library | simple-git, nodegit | Adds 3MB+ dependency for 1-line execSync call; overkill for read-only SHA extraction |

**Installation:**
```bash
npm install remark-stringify
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── packets/
│   ├── generate-shell.js      # Command: deterministic packet generation
│   ├── fetch-constraints.js   # Extract TDD guardrails
│   ├── fetch-drift.js         # Pull registry drift data
│   ├── compute-provenance.js  # Git SHA extraction
│   └── size-checker.js        # Word count + overflow detection
├── utils/
│   └── markdown-helpers.js    # Shared markdown utilities
templates/
├── packet-v1.hbs              # Main packet template
└── packet-appendix-v1.hbs     # Appendix template
skills/
└── dwa-enrich-packet/
    └── SKILL.md               # /dwa:enrich-packet skill
tests/
├── generate-shell.test.js
├── fetch-constraints.test.js
└── packets/
    └── fixtures/              # Test fixture packets
```

### Pattern 1: Deterministic Packet Shell Generation (Command)

**What:** Generate complete execution packet from registry + spec + TDD data without LLM involvement.

**When to use:** Initial packet creation - produces a usable packet ready for GSD consumption.

**Key principle:** Command produces a COMPLETE, USABLE packet. Never requires enrichment to be functional.

**Example:**
```javascript
// Source: Phase 4 context + Handlebars official docs
const Handlebars = require('handlebars');
const fs = require('fs-extra');
const path = require('path');
const { writeFileAtomic } = require('write-file-atomic');

async function generatePacketShell(deliverableId, projectRoot) {
  // 1. Load sources
  const registry = await fs.readJson(
    path.join(projectRoot, '.dwa/deliverables', `${deliverableId}.json`)
  );
  const featureJson = await fs.readJson(
    path.join(projectRoot, '.dwa/feature.json')
  );

  // 2. Load TDD constraints if linked
  let constraints = [];
  if (featureJson.tdd_path) {
    constraints = await fetchTDDConstraints(
      path.join(projectRoot, featureJson.tdd_path)
    );
  }

  // 3. Fetch drift data
  const driftItems = await fetchDriftData(registry);

  // 4. Compute provenance
  const provenance = await computeProvenance(
    projectRoot,
    featureJson.spec_path,
    featureJson.tdd_path
  );

  // 5. Categorize ACs by prefix
  const categorizedACs = categorizeAcceptanceCriteria(
    registry.acceptance_criteria
  );

  // 6. Render template
  const templatePath = path.join(__dirname, '..', '..', 'templates', 'packet-v1.hbs');
  const template = Handlebars.compile(await fs.readFile(templatePath, 'utf8'));

  const rendered = template({
    deliverable_id: deliverableId,
    goal: registry.description,
    user_story: registry.user_story,
    acceptance_criteria: categorizedACs,
    qa_notes: registry.qa_notes,
    constraints,
    drift: driftItems,
    provenance,
    created_at: new Date().toISOString()
  });

  // 7. Check size and split if needed
  const { finalContent, appendixContent } = await checkSizeAndSplit(
    rendered,
    deliverableId
  );

  // 8. Write atomically
  const packetPath = path.join(projectRoot, '.dwa/packets', `${deliverableId}.md`);
  await fs.ensureDir(path.dirname(packetPath));
  await writeFileAtomic(packetPath, finalContent, { encoding: 'utf8' });

  // 9. Write appendix if needed
  if (appendixContent) {
    const appendixPath = path.join(
      projectRoot,
      '.dwa/packets/appendices',
      `${deliverableId}-appendix.md`
    );
    await fs.ensureDir(path.dirname(appendixPath));
    await writeFileAtomic(appendixPath, appendixContent, { encoding: 'utf8' });
  }

  return { packetPath, appendixPath: appendixContent ? appendixPath : null };
}
```

### Pattern 2: Git Provenance Extraction

**What:** Capture git SHA for spec, TDD, and registry to establish packet provenance.

**When to use:** Every packet generation - establishes audit trail.

**Example:**
```javascript
// Source: GitHub blog on npm provenance + Node.js child_process docs
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

async function computeProvenance(projectRoot, specPath, tddPath) {
  const provenance = {
    packet_generator_version: require('../../package.json').version,
    generated_at: new Date().toISOString(),
    sources: {}
  };

  // Get current commit SHA (for registry versioning)
  try {
    const currentSHA = execSync('git rev-parse HEAD', {
      cwd: projectRoot,
      encoding: 'utf8'
    }).trim();
    provenance.registry_sha = currentSHA;
  } catch {
    provenance.registry_sha = null; // Not in git
  }

  // Get file-specific SHA for spec
  if (specPath && await fs.pathExists(path.join(projectRoot, specPath))) {
    try {
      const specSHA = execSync(`git log -1 --format=%H -- ${specPath}`, {
        cwd: projectRoot,
        encoding: 'utf8'
      }).trim();
      provenance.sources.spec = {
        path: specPath,
        sha: specSHA || null,
        last_modified: (await fs.stat(path.join(projectRoot, specPath))).mtime
      };
    } catch {
      provenance.sources.spec = { path: specPath, sha: null };
    }
  }

  // Get file-specific SHA for TDD
  if (tddPath && await fs.pathExists(path.join(projectRoot, tddPath))) {
    try {
      const tddSHA = execSync(`git log -1 --format=%H -- ${tddPath}`, {
        cwd: projectRoot,
        encoding: 'utf8'
      }).trim();
      provenance.sources.tdd = {
        path: tddPath,
        sha: tddSHA || null,
        last_modified: (await fs.stat(path.join(projectRoot, tddPath))).mtime
      };
    } catch {
      provenance.sources.tdd = { path: tddPath, sha: null };
    }
  }

  return provenance;
}
```

### Pattern 3: Size-Aware Content Splitting

**What:** Monitor packet word count and externalize overflow content to appendix.

**When to use:** Packet generation - enforce hard 2,000 word limit.

**Example:**
```javascript
// Source: Markdown best practices + appendix formatting guidelines
function countWords(markdown) {
  // Remove code blocks
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, '');

  // Remove inline code
  const withoutInlineCode = withoutCode.replace(/`[^`]+`/g, '');

  // Count words in remaining prose
  const words = withoutInlineCode
    .split(/\s+/)
    .filter(word => word.length > 0);

  return words.length;
}

async function checkSizeAndSplit(content, deliverableId) {
  const wordCount = countWords(content);
  const SOFT_LIMIT = 1500;
  const HARD_LIMIT = 2000;

  if (wordCount <= SOFT_LIMIT) {
    return { finalContent: content, appendixContent: null };
  }

  if (wordCount <= HARD_LIMIT) {
    // Warn but don't split
    console.warn(
      `Warning: Packet ${deliverableId} is ${wordCount} words (soft limit: ${SOFT_LIMIT})`
    );
    return { finalContent: content, appendixContent: null };
  }

  // Exceeds hard limit - externalize to appendix
  // Strategy: Keep execution contract inline, move verbose content to appendix
  const sections = parsePacketSections(content);

  const criticalSections = [
    'Control Block',
    'MUST/MUST NOT Guardrails',
    'Goal',
    'Critical ACs',
    'Drift Since Last Packet'
  ];

  const appendixSections = sections.filter(
    s => !criticalSections.includes(s.heading)
  );

  const inlineContent = sections
    .filter(s => criticalSections.includes(s.heading))
    .map(s => s.content)
    .join('\n\n');

  const appendixContent = generateAppendix(deliverableId, appendixSections);

  // Add appendix reference to inline content
  const finalContent = `${inlineContent}\n\n---\n\n**Additional Context:** See [${deliverableId}-appendix.md](./appendices/${deliverableId}-appendix.md) for full acceptance criteria, QA notes, and implementation targets.\n`;

  return { finalContent, appendixContent };
}
```

### Pattern 4: TDD Constraints Extraction

**What:** Parse TDD file and extract guardrails section for packet constraints.

**When to use:** Packet generation when TDD is linked.

**Example:**
```javascript
// Source: gray-matter docs + remark ecosystem
const matter = require('gray-matter');
const { unified } = require('unified');
const remarkParse = require('remark-parse');
const { visit } = require('unist-util-visit');

async function fetchTDDConstraints(tddPath) {
  const tddContent = await fs.readFile(tddPath, 'utf8');
  const { content } = matter(tddContent);

  // Parse to AST
  const tree = unified().use(remarkParse).parse(content);

  // Find "Guardrails" section (heading level 2)
  let inGuardrails = false;
  const guardrails = [];

  visit(tree, (node) => {
    if (node.type === 'heading' && node.depth === 2) {
      // Check if this is the Guardrails heading
      const headingText = extractTextFromNode(node);
      inGuardrails = headingText.includes('Guardrails');

      // If we hit another h2, stop collecting
      if (inGuardrails && !headingText.includes('Guardrails')) {
        inGuardrails = false;
      }
    }

    if (inGuardrails && node.type === 'list') {
      // Extract list items
      visit(node, 'listItem', (item) => {
        const text = extractTextFromNode(item);
        if (text) guardrails.push(text);
      });
    }
  });

  return guardrails;
}

function extractTextFromNode(node) {
  let text = '';
  visit(node, 'text', (textNode) => {
    text += textNode.value;
  });
  return text.trim();
}
```

### Anti-Patterns to Avoid

- **LLM in command path:** Commands must be deterministic. Never invoke LLM for packet shell generation.
- **Silent contract mutation:** Skills must NOT edit AC/QA/constraints inline. Changes go to "Patch Proposal" section.
- **Unbounded context:** Never inline 100+ ACs. Use AC Index + appendix for overflow.
- **Timestamp-based provenance:** Use git SHA, not file mtime. Timestamps change on git operations.
- **Regex parsing for markdown:** Use AST (remark) for all markdown parsing. Regex breaks on edge cases.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown generation | String templates with manual escaping | remark-stringify + AST | Handles escaping, nesting, tables; guarantees valid markdown |
| Template rendering | String interpolation | Handlebars (already installed) | Partials, helpers, iteration; externalized templates |
| Atomic writes | fs.writeFile + error handling | write-file-atomic | Crash-safe via temp+rename; battle-tested by npm |
| Deep equality | Manual comparison | fast-deep-equal | 10-100x faster; handles edge cases (NaN, Date, etc.) |
| Git operations | Parsing git log output | execSync with format strings | Git provides machine-readable output via --format |

**Key insight:** Markdown generation is deceptively complex. Nested lists, tables, escaped characters, and code blocks all require careful handling. AST-based generation (remark-stringify) eliminates edge cases.

## Common Pitfalls

### Pitfall 1: Command Generates Incomplete Packets

**What goes wrong:** Command produces skeleton that requires skill enrichment to be usable.

**Why it happens:** Temptation to "defer to LLM" for any non-trivial content.

**How to avoid:**
- Command MUST produce complete, GSD-ready packet from known sources
- Packet without enrichment should have: all ACs, QA steps, constraints, goal, stop points
- Skill adds VALUE (implementation hints, gotchas), not COMPLETENESS (missing contract)

**Warning signs:**
- Packet has "TODO: enrich" placeholders
- ACs are stubbed as "See spec"
- Constraints section is empty when TDD exists

### Pitfall 2: Size Budget Violations

**What goes wrong:** Packets exceed 2,000 word hard limit, overwhelming LLM context.

**Why it happens:** Inlining all ACs (50+ items), verbose QA notes, or duplicating spec content.

**How to avoid:**
- Implement word counter EARLY and fail loud
- Categorize ACs and externalize Nice-to-have/Edge to appendix
- Use references ("See section 3.2 of spec") not duplication for background
- Set CI check: packets must not exceed 2,000 words

**Warning signs:**
- Packet generation completes without size check
- No appendix logic implemented
- Test fixtures have 3,000+ word packets

### Pitfall 3: Provenance Without Timestamps

**What goes wrong:** Can't detect if source changed since packet generation.

**Why it happens:** Recording git SHA but not file mtime or generation timestamp.

**How to avoid:**
- Record BOTH git SHA (for commit) AND file mtime (for uncommitted changes)
- Record packet generation timestamp
- In "Drift" section, compare source mtime vs. packet created_at

**Warning signs:**
- Provenance block has SHA but no timestamps
- Can't detect "spec changed after packet created"
- No staleness warnings

### Pitfall 4: Skill Mutates Contract Silently

**What goes wrong:** `/dwa:enrich-packet` rewrites ACs or constraints inline.

**Why it happens:** LLM "improves" content rather than proposing changes.

**How to avoid:**
- Skill instructions MUST forbid inline edits to contract sections
- Changes go to "Patch Proposal" section at end
- User decides whether to accept and re-run command

**Warning signs:**
- Skill modifies AC text directly
- No "Patch Proposal" section in skill output
- Enrichment is destructive (can't revert)

## Code Examples

Verified patterns from official sources:

### Handlebars Template for Packet

```handlebars
{{!-- Source: Handlebars official docs + Phase 4 context --}}
---
deliverable_id: {{deliverable_id}}
packet_version: v1.0
generated_at: {{created_at}}
---

# Execution Packet — {{deliverable_id}} — {{goal}}

## Control Block

**Stop After:** Plan generation (GSD must produce plan and STOP)

**Required Outputs:**
- [ ] Implementation plan (approved before coding)
- [ ] Files to modify/create list
- [ ] Test plan (unit + integration)
- [ ] PR description draft

**Packet Size:** {{word_count}} words (limit: 2,000)

{{#if staleness_warning}}
**⚠️ STALENESS WARNING:** {{staleness_warning}}
{{/if}}

---

## MUST / MUST NOT Guardrails

### MUST
{{#each constraints.must}}
- {{this}}
{{/each}}

### MUST NOT
{{#each constraints.must_not}}
- {{this}}
{{/each}}

---

## Goal

{{goal}}

---

## User Story

{{user_story}}

---

## Acceptance Criteria

### Critical (C#)
{{#each acceptance_criteria.critical}}
- [ ] **C{{@index}}:** {{this}}
{{/each}}

### Functional (F#)
{{#each acceptance_criteria.functional}}
- [ ] **F{{@index}}:** {{this}}
{{/each}}

{{#if acceptance_criteria.overflow}}
**Note:** Additional acceptance criteria (Nice-to-have, Edge cases) in [appendix](./appendices/{{deliverable_id}}-appendix.md).
{{/if}}

---

## QA Verification

{{qa_notes}}

---

## Provenance

- **Spec:** `{{provenance.sources.spec.path}}` (SHA: {{provenance.sources.spec.sha}})
- **TDD:** `{{provenance.sources.tdd.path}}` (SHA: {{provenance.sources.tdd.sha}})
- **Registry Revision:** {{provenance.registry_sha}}
- **Packet Generator:** v{{provenance.packet_generator_version}}

---

## Drift Since Last Packet

{{#if drift.items.length}}
{{#each drift.items}}
- **{{this.kind}}:** {{this.description}} (decision: {{this.decision}})
{{/each}}
{{else}}
No drift items flagged for this deliverable.
{{/if}}

{{#if drift.source_freshness.spec_changed}}
⚠️ Spec modified since last packet generation.
{{/if}}

---

## Stop Points

- [ ] After plan generation (wait for approval)
- [ ] After core logic implementation (before tests)
- [ ] After tests pass (before PR)
```

### Registry Drift Data Fetching

```javascript
// Source: Phase 4 context + registry schema from Phase 3
async function fetchDriftData(deliverableRegistry) {
  const driftItems = [];

  // Pull drift from registry
  if (deliverableRegistry.drift && Array.isArray(deliverableRegistry.drift)) {
    for (const item of deliverableRegistry.drift) {
      // Include if: pending decision, applies to next work, or is spec/TDD mismatch
      const include =
        item.decision === 'pending' ||
        item.applies_to_next_work === true ||
        ['spec_mismatch', 'tdd_mismatch'].includes(item.kind);

      if (include) {
        driftItems.push(item);
      }
    }
  }

  return {
    items: driftItems,
    source_freshness: await computeSourceFreshness(deliverableRegistry)
  };
}

async function computeSourceFreshness(deliverableRegistry) {
  // Compare registry updated_at vs. spec/TDD last modified
  const registryUpdatedAt = new Date(deliverableRegistry.updated_at || 0);

  const freshness = {
    spec_changed: false,
    tdd_changed: false
  };

  // Check spec freshness
  const featureJson = await fs.readJson(
    path.join(process.cwd(), '.dwa/feature.json')
  );

  if (featureJson.spec_path) {
    const specStat = await fs.stat(
      path.join(process.cwd(), featureJson.spec_path)
    );
    freshness.spec_changed = specStat.mtime > registryUpdatedAt;
  }

  // Check TDD freshness
  if (featureJson.tdd_path) {
    const tddStat = await fs.stat(
      path.join(process.cwd(), featureJson.tdd_path)
    );
    freshness.tdd_changed = tddStat.mtime > registryUpdatedAt;
  }

  return freshness;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static templates with placeholders | Handlebars with helpers + partials | Stable (2015+) | Enables conditional logic, iteration in templates |
| String concatenation for markdown | remark-stringify AST generation | 2020-2021 | Guarantees valid markdown, handles edge cases |
| Single-file packets | Main + appendix overflow | Emerging (2024+) | Respects LLM context limits while preserving completeness |
| Regex for markdown parsing | unified/remark AST parsing | 2018+ (widespread 2022+) | Robust against edge cases (nested markdown, escaped chars) |

**Deprecated/outdated:**
- markdown-it for parsing: Still maintained but renderer-focused; remark ecosystem is AST-focused (better for extraction)
- lodash.isEqual: Works but 10-100x slower than fast-deep-equal for deep equality
- Manual git log parsing: Use --format flag for machine-readable output

## Open Questions

### Question 1: AC Index Format

**What we know:** When ACs exceed inline caps, need an index pointing to appendix.

**What's unclear:** Best format for AC Index - table (ID | Summary) vs. checklist ([ ] C1: Summary) vs. grouped list?

**Recommendation:** Use checklist format for consistency with full ACs. Users can check off in main packet, reference appendix for details. Keeps execution flow in main file.

### Question 2: History Folder Implementation

**What we know:** Phase context marks history as "Claude's discretion."

**What's unclear:** Whether to version packets on re-generation or only keep latest.

**Recommendation:** Defer to Phase 5 (Complete Deliverable). History valuable for drift detection ("what changed between packet v1 and v2?"). Recommend timestamp-based versioning: `.dwa/packets/history/DEL-001/2026-01-24T10-30-00.md`.

### Question 3: Skill Codebase Analysis Depth

**What we know:** `/dwa:enrich-packet` adds "likely files touched" via codebase analysis.

**What's unclear:** Scope of analysis - grep for patterns? Full semantic search? Dependency graph traversal?

**Recommendation:** Start simple: grep for deliverable description keywords + acceptance criteria terms. Phase context says "codebase analysis" not "semantic understanding." Can enhance in later iterations.

## Sources

### Primary (HIGH confidence)

- [Handlebars README](https://github.com/handlebars-lang/handlebars.js/blob/master/README.markdown) - Template compilation, helper registration
- [Introduction | Handlebars](https://handlebarsjs.com/guide/) - Official guide for template syntax
- [Node.js child_process documentation](https://github.com/nodejs/node/blob/main/doc/api/child_process.md) - execSync API for git commands
- [npm package provenance - GitHub Blog](https://github.blog/security/supply-chain-security/introducing-npm-package-provenance/) - SLSA provenance schema, commit SHA tracking
- [Markdown Best Practices - Markdown Documentation](https://www.markdownlang.com/advanced/best-practices/) - Document structure guidelines
- Phase 4 CONTEXT.md - Implementation decisions (authoritative)
- Phase 3 codebase - Established patterns (scaffold.js, registry.js, schema.js)

### Secondary (MEDIUM confidence)

- [5 Key Trends Shaping Agentic Development in 2026](https://thenewstack.io/5-key-trends-shaping-agentic-development-in-2026/) - Context management as architectural concern
- [2026 data predictions: Scaling AI agents via contextual intelligence](https://siliconangle.com/2026/01/18/2026-data-predictions-scaling-ai-agents-via-contextual-intelligence/) - Bounded context importance
- [Are AI Agents the Next Microservices? Rethinking Software Boundaries in 2026](https://dev.to/goodworklabs/are-ai-agents-the-next-microservices-rethinking-software-boundaries-in-2026-3j68) - Software boundaries and agent execution
- [Appendix Definition (Book): Writing and Formatting Tips for 2026](https://www.automateed.com/appendix-definition-book) - Appendix structuring guidelines
- [Markdown Best Practices for Documentation](https://www.markdowntoolbox.com/blog/markdown-best-practices-for-documentation/) - Multi-file document organization

### Tertiary (LOW confidence)

- [Write Templates Like A Node.js Pro: Handlebars Tutorial](https://webapplog.com/handlebars/) - Tutorial content (educational, not authoritative)
- WebSearch results on markdown generation - General advice, not specific to this stack

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Handlebars already proven in Phase 2, git provenance well-documented
- Architecture: HIGH - Patterns validated against Phase 3 implementation, aligned with phase context decisions
- Pitfalls: MEDIUM-HIGH - Based on phase context warnings + general software engineering principles; not empirically tested yet

**Research date:** 2026-01-24
**Valid until:** 60 days (stable domain - markdown generation, template rendering, git operations are mature technologies)

**Key dependencies:**
- Phase 2 templates (feature-spec-v2.hbs, tdd-v1.hbs) established Handlebars patterns
- Phase 3 registry structure (DEL-###.json schema) defines data sources
- Phase 4 CONTEXT.md decisions (command vs skill, size budgets, AC categorization) constrain implementation

**Research scope:**
- ✅ Template rendering approaches
- ✅ Git provenance extraction
- ✅ Markdown size management
- ✅ TDD constraint extraction
- ✅ Bounded context best practices (AI agents)
- ⚠️ Codebase analysis techniques (deferred to skill planning)
- ⚠️ History folder implementation (marked as discretion)
