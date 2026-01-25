/**
 * Size checker for execution packets.
 * Enforces word limits and handles content splitting.
 *
 * Limits:
 * - SOFT_LIMIT: 1500 words (warning threshold)
 * - HARD_LIMIT: 2000 words (must split to appendix)
 */

const SOFT_LIMIT = 1500;
const HARD_LIMIT = 2000;

/**
 * Count words in markdown content, excluding code blocks.
 *
 * @param {string} markdown - Markdown content to count
 * @returns {number} Word count
 */
function countWords(markdown) {
  if (!markdown || markdown.trim() === '') {
    return 0;
  }

  // Remove code blocks (fenced with ```)
  let content = markdown.replace(/```[\s\S]*?```/g, '');

  // Remove inline code
  content = content.replace(/`[^`]+`/g, '');

  // Split on whitespace and filter empty strings
  const words = content
    .split(/\s+/)
    .filter(word => word.length > 0 && /\w/.test(word));

  return words.length;
}

/**
 * Check content size and split to appendix if needed.
 *
 * @param {string} content - Full packet content
 * @param {string} deliverableId - Deliverable ID for appendix naming
 * @returns {Promise<{finalContent: string, appendixContent: string|null, wordCount: number, warning: string|null}>}
 */
async function checkSizeAndSplit(content, deliverableId) {
  const wordCount = countWords(content);

  // Under soft limit - no action needed
  if (wordCount <= SOFT_LIMIT) {
    return {
      finalContent: content,
      appendixContent: null,
      wordCount,
      warning: null
    };
  }

  // Between soft and hard limit - warn but continue
  if (wordCount <= HARD_LIMIT) {
    return {
      finalContent: content,
      appendixContent: null,
      wordCount,
      warning: `Packet size (${wordCount} words) exceeds soft limit (${SOFT_LIMIT}). Consider trimming.`
    };
  }

  // Over hard limit - split to appendix
  const { mainContent, appendixContent } = splitContent(content, deliverableId);

  return {
    finalContent: mainContent,
    appendixContent,
    wordCount: countWords(mainContent),
    warning: `Packet split to appendix. Original: ${wordCount} words.`
  };
}

/**
 * Split content by moving non-critical sections to appendix.
 *
 * Sections that stay inline (execution contract):
 * - Control Block
 * - MUST/MUST NOT Guardrails
 * - Goal
 * - Critical ACs
 * - Minimal QA
 * - Drift (short)
 *
 * Sections that can move to appendix:
 * - Non-critical ACs (Functional, Nice-to-have, Edge)
 * - Full QA details
 * - Dependencies details
 *
 * @param {string} content - Full packet content
 * @param {string} deliverableId - Deliverable ID for reference
 * @returns {{mainContent: string, appendixContent: string}}
 */
function splitContent(content, deliverableId) {
  // Parse sections from content
  const sections = parseSections(content);

  // Critical sections that must stay inline
  const criticalSections = [
    'frontmatter',
    'header',
    '## 0) Control Block',
    '## 1) MUST / MUST NOT Guardrails',
    '## 2) Goal',
    '## 3) User Story',
    '## 7) Provenance',
    '## 8) Drift Since Last Packet',
    '## 9) Stop Points'
  ];

  // Build main content with critical sections and abbreviated ACs
  let mainContent = '';
  let appendixContent = `# Appendix: ${deliverableId}\n\n`;
  appendixContent += 'Extended content moved from main packet due to size limits.\n\n';

  for (const [sectionName, sectionContent] of Object.entries(sections)) {
    if (criticalSections.includes(sectionName) || sectionName.startsWith('## 4) Acceptance')) {
      // For AC section, keep only critical ACs
      if (sectionName.startsWith('## 4) Acceptance')) {
        const { critical, rest } = splitAcceptanceCriteria(sectionContent);
        mainContent += critical;
        if (rest) {
          appendixContent += `## Additional Acceptance Criteria\n\n${rest}\n\n`;
        }
      } else {
        mainContent += sectionContent;
      }
    } else if (sectionName === '## 5) QA Verification') {
      // Keep abbreviated QA inline, full in appendix
      mainContent += '\n## 5) QA Verification\n\nSee appendix for full QA plan.\n\n---\n';
      appendixContent += `## Full QA Verification\n\n${extractSectionBody(sectionContent)}\n\n`;
    } else if (sectionName === '## 6) Dependencies') {
      // Keep dependencies summary inline
      mainContent += sectionContent;
    }
  }

  // Add appendix reference to main content before Stop Points
  const stopPointsIdx = mainContent.lastIndexOf('## 9) Stop Points');
  if (stopPointsIdx > 0) {
    mainContent = mainContent.slice(0, stopPointsIdx) +
      `**Note:** Extended content in appendix: \`.dwa/packets/appendices/${deliverableId}-appendix.md\`\n\n` +
      mainContent.slice(stopPointsIdx);
  }

  return { mainContent, appendixContent };
}

/**
 * Parse markdown content into sections by heading.
 *
 * @param {string} content - Markdown content
 * @returns {Object<string, string>} Map of section names to content
 */
function parseSections(content) {
  const sections = {};
  const lines = content.split('\n');

  // Extract frontmatter
  if (lines[0] === '---') {
    let endIdx = lines.indexOf('---', 1);
    if (endIdx > 0) {
      sections.frontmatter = lines.slice(0, endIdx + 1).join('\n') + '\n';
    }
  }

  // Find header (# Execution Packet...)
  const headerIdx = lines.findIndex(l => l.startsWith('# '));
  if (headerIdx >= 0) {
    sections.header = lines[headerIdx] + '\n\n';
  }

  // Find all ## sections
  let currentSection = null;
  let currentContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      // Save previous section
      if (currentSection) {
        sections[currentSection] = currentContent.join('\n');
      }
      currentSection = line;
      currentContent = [line];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    sections[currentSection] = currentContent.join('\n');
  }

  return sections;
}

/**
 * Split acceptance criteria section, keeping only Critical inline.
 *
 * @param {string} acSection - Full AC section content
 * @returns {{critical: string, rest: string|null}}
 */
function splitAcceptanceCriteria(acSection) {
  const lines = acSection.split('\n');
  const criticalLines = [];
  const restLines = [];
  let inCritical = false;
  let inOther = false;

  for (const line of lines) {
    if (line.startsWith('## 4) Acceptance') || line === '---') {
      criticalLines.push(line);
    } else if (line.startsWith('### Critical')) {
      inCritical = true;
      inOther = false;
      criticalLines.push(line);
    } else if (line.startsWith('### Functional') || line.startsWith('### Nice') || line.startsWith('### Edge')) {
      inCritical = false;
      inOther = true;
      restLines.push(line);
    } else if (inCritical) {
      criticalLines.push(line);
    } else if (inOther) {
      restLines.push(line);
    }
  }

  return {
    critical: criticalLines.join('\n') + '\n\n---\n',
    rest: restLines.length > 0 ? restLines.join('\n') : null
  };
}

/**
 * Extract body text from a section (remove heading).
 *
 * @param {string} section - Section with heading
 * @returns {string} Body without heading
 */
function extractSectionBody(section) {
  const lines = section.split('\n');
  // Skip heading and separator
  const bodyStart = lines.findIndex((l, i) => i > 0 && !l.startsWith('## ') && l.trim() !== '');
  if (bodyStart > 0) {
    return lines.slice(bodyStart).join('\n').replace(/---\s*$/, '').trim();
  }
  return section;
}

module.exports = {
  countWords,
  checkSizeAndSplit,
  SOFT_LIMIT,
  HARD_LIMIT
};
