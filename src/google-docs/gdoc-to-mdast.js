/**
 * Google Docs JSON to mdast converter.
 *
 * Converts Google Docs API v1 Document structure to mdast AST for markdown output.
 * Handles paragraphs, headings, tables, lists, inline formatting, footnotes, and equations.
 */

const { createDiagnostic } = require('./diagnostics');

/**
 * Main converter: Google Docs Document -> mdast tree
 *
 * @param {object} gdocDocument - Google Docs API v1 Document structure
 * @param {object} [options={}] - Conversion options
 * @param {string} [options.tableMode='html-fallback'] - 'gfm' | 'html-fallback'
 * @returns {object} { mdast, diagnostics, footnoteDefinitions }
 */
function gdocToMdast(gdocDocument, options = {}) {
  const tableMode = options.tableMode || 'html-fallback';

  const context = {
    gdocDocument,
    diagnostics: [],
    footnoteDefinitions: [],
    footnotesSeen: new Set(),
    tableMode
  };

  const mdast = {
    type: 'root',
    children: []
  };

  // Traverse body.content array (StructuralElements)
  const body = gdocDocument.body;
  if (body && body.content) {
    for (const element of body.content) {
      const node = convertStructuralElement(element, context);
      if (node) {
        if (Array.isArray(node)) {
          mdast.children.push(...node);
        } else {
          mdast.children.push(node);
        }
      }
    }
  }

  // Append footnote definitions at end
  if (context.footnoteDefinitions.length > 0) {
    mdast.children.push(...context.footnoteDefinitions);
  }

  return {
    mdast,
    diagnostics: context.diagnostics,
    footnoteDefinitions: context.footnoteDefinitions
  };
}

/**
 * Convert a single StructuralElement to mdast node(s).
 *
 * @param {object} element - Google Docs StructuralElement
 * @param {object} context - Conversion context
 * @returns {object|object[]|null} mdast node(s) or null if skipped
 */
function convertStructuralElement(element, context) {
  if (element.paragraph) {
    return convertParagraph(element.paragraph, context);
  } else if (element.table) {
    return convertTable(element.table, context);
  } else if (element.sectionBreak) {
    return { type: 'thematicBreak' };
  } else if (element.tableOfContents) {
    // Drop TOC with diagnostic
    context.diagnostics.push(createDiagnostic('TOC_DROPPED'));
    return null;
  } else if (element.pageBreak) {
    // Convert page break to thematic break with diagnostic
    context.diagnostics.push(createDiagnostic('PAGE_BREAK_CONVERTED'));
    return { type: 'thematicBreak' };
  }

  return null;
}

/**
 * Convert a paragraph to mdast node.
 * Handles headings, list items, and regular paragraphs.
 *
 * @param {object} paragraph - Google Docs Paragraph
 * @param {object} context - Conversion context
 * @returns {object|object[]|null} mdast node(s) or null if empty
 */
function convertParagraph(paragraph, context) {
  // Process inline elements
  const children = [];
  if (paragraph.elements) {
    for (const element of paragraph.elements) {
      const node = convertInlineElement(element, context);
      if (node) {
        if (Array.isArray(node)) {
          children.push(...node);
        } else {
          children.push(node);
        }
      }
    }
  }

  // Skip empty paragraphs
  if (children.length === 0) {
    return null;
  }

  // Check if this is a list item
  if (paragraph.bullet) {
    return convertListItem(paragraph, children, context);
  }

  // Check if this is a heading
  const style = paragraph.paragraphStyle;
  if (style && style.namedStyleType) {
    const depth = parseHeadingDepth(style.namedStyleType);
    if (depth) {
      return { type: 'heading', depth, children };
    }
  }

  // Regular paragraph
  return { type: 'paragraph', children };
}

/**
 * Convert a list item paragraph to mdast listItem.
 * Groups consecutive list items into list nodes.
 *
 * @param {object} paragraph - Google Docs Paragraph with bullet
 * @param {object[]} children - Inline content nodes
 * @param {object} context - Conversion context
 * @returns {object} mdast listItem node
 */
function convertListItem(paragraph, children, context) {
  const bullet = paragraph.bullet;
  const listId = bullet.listId;
  const nestingLevel = bullet.nestingLevel || 0;

  // Look up list style
  const listProps = context.gdocDocument.lists?.[listId]?.listProperties;
  const levelProps = listProps?.nestingLevels?.[nestingLevel] || {};

  // Determine list type
  const isOrdered = isOrderedList(levelProps);
  const isChecklist = isChecklistItem(levelProps);

  const listItem = {
    type: 'listItem',
    spread: false,
    children: [{ type: 'paragraph', children }]
  };

  // Add checked property for task lists
  if (isChecklist) {
    listItem.checked = false; // Default unchecked; could parse from content if needed
  }

  return listItem;
}

/**
 * Determine if list level is ordered.
 *
 * @param {object} levelProps - nestingLevel properties
 * @returns {boolean}
 */
function isOrderedList(levelProps) {
  const glyphType = levelProps.glyphType;
  return glyphType === 'DECIMAL' || glyphType === 'ALPHA_UPPERCASE' ||
         glyphType === 'ALPHA_LOWERCASE' || glyphType === 'ROMAN_UPPERCASE' ||
         glyphType === 'ROMAN_LOWERCASE';
}

/**
 * Determine if list item is a checklist.
 *
 * @param {object} levelProps - nestingLevel properties
 * @returns {boolean}
 */
function isChecklistItem(levelProps) {
  const symbol = levelProps.glyphSymbol;
  return symbol === '☐' || symbol === '☑';
}

/**
 * Parse heading depth from namedStyleType.
 *
 * @param {string} namedStyleType - e.g., 'HEADING_1'
 * @returns {number|null} Depth 1-6, or null if not a heading
 */
function parseHeadingDepth(namedStyleType) {
  const match = namedStyleType.match(/^HEADING_(\d)$/);
  if (match) {
    const depth = parseInt(match[1], 10);
    return depth >= 1 && depth <= 6 ? depth : null;
  }
  return null;
}

/**
 * Convert inline element to mdast node(s).
 *
 * @param {object} element - Google Docs inline element
 * @param {object} context - Conversion context
 * @returns {object|object[]|null} mdast node(s) or null if skipped
 */
function convertInlineElement(element, context) {
  if (element.textRun) {
    return convertTextRun(element.textRun);
  } else if (element.footnoteReference) {
    return convertFootnoteReference(element.footnoteReference, context);
  } else if (element.inlineObjectElement) {
    return convertInlineObject(element.inlineObjectElement, context);
  } else if (element.equation) {
    return convertEquation(element.equation, context);
  }

  return null;
}

/**
 * Convert textRun to mdast text node with formatting.
 *
 * @param {object} textRun - Google Docs TextRun
 * @returns {object|null} mdast node (text with formatting wrappers) or null if empty
 */
function convertTextRun(textRun) {
  let content = textRun.content || '';

  // Trim trailing newline (Google Docs adds \n to most text runs)
  if (content.endsWith('\n')) {
    content = content.slice(0, -1);
  }

  // Skip if empty after trimming
  if (content.length === 0) {
    return null;
  }

  const style = textRun.textStyle || {};

  let node = { type: 'text', value: content };

  // Apply formatting innermost to outermost: strikethrough -> italic -> bold
  if (style.strikethrough) {
    node = { type: 'delete', children: [node] };
  }
  if (style.italic) {
    node = { type: 'emphasis', children: [node] };
  }
  if (style.bold) {
    node = { type: 'strong', children: [node] };
  }

  // Handle inline code (monospace font)
  if (style.weightedFontFamily?.fontFamily === 'Courier New' ||
      style.weightedFontFamily?.fontFamily === 'Consolas') {
    return { type: 'inlineCode', value: content };
  }

  // Handle links
  if (style.link?.url) {
    return {
      type: 'link',
      url: style.link.url,
      children: [node]
    };
  }

  return node;
}

/**
 * Convert footnoteReference to mdast node.
 *
 * @param {object} footnoteRef - Google Docs FootnoteReference
 * @param {object} context - Conversion context
 * @returns {object} mdast footnoteReference node
 */
function convertFootnoteReference(footnoteRef, context) {
  const footnoteId = footnoteRef.footnoteId;
  const footnoteNumber = footnoteRef.footnoteNumber || context.footnotesSeen.size + 1;

  const identifier = `fn${footnoteNumber}`;

  // Collect footnote definition if not already seen
  if (!context.footnotesSeen.has(footnoteId)) {
    context.footnotesSeen.add(footnoteId);

    const footnoteData = context.gdocDocument.footnotes?.[footnoteId];
    if (footnoteData) {
      const footnoteContent = extractFootnoteContent(footnoteData, context);

      context.footnoteDefinitions.push({
        type: 'footnoteDefinition',
        identifier,
        children: footnoteContent
      });
    }
  }

  return { type: 'footnoteReference', identifier };
}

/**
 * Extract content from footnote.
 *
 * @param {object} footnoteData - Google Docs Footnote
 * @param {object} context - Conversion context
 * @returns {object[]} Array of mdast paragraph nodes
 */
function extractFootnoteContent(footnoteData, context) {
  const children = [];

  if (footnoteData.content) {
    for (const element of footnoteData.content) {
      if (element.paragraph) {
        const paragraphChildren = [];
        if (element.paragraph.elements) {
          for (const inlineEl of element.paragraph.elements) {
            const node = convertInlineElement(inlineEl, context);
            if (node) {
              if (Array.isArray(node)) {
                paragraphChildren.push(...node);
              } else {
                paragraphChildren.push(node);
              }
            }
          }
        }

        if (paragraphChildren.length > 0) {
          children.push({ type: 'paragraph', children: paragraphChildren });
        }
      }
    }
  }

  return children.length > 0 ? children : [{ type: 'paragraph', children: [{ type: 'text', value: '[Footnote]' }] }];
}

/**
 * Convert inlineObjectElement (image, drawing, etc.).
 *
 * @param {object} inlineObject - Google Docs InlineObjectElement
 * @param {object} context - Conversion context
 * @returns {object} mdast image or placeholder node
 */
function convertInlineObject(inlineObject, context) {
  const objectId = inlineObject.inlineObjectId;
  const inlineObjectData = context.gdocDocument.inlineObjects?.[objectId];

  if (inlineObjectData?.inlineObjectProperties?.embeddedObject) {
    const embeddedObject = inlineObjectData.inlineObjectProperties.embeddedObject;

    // Check for image
    if (embeddedObject.imageProperties) {
      const contentUri = embeddedObject.imageProperties.contentUri || '';
      const title = embeddedObject.title || embeddedObject.description || 'Image';

      // If we have a URI, create image node; otherwise placeholder
      if (contentUri) {
        return {
          type: 'image',
          url: contentUri,
          alt: title,
          title: null
        };
      } else {
        context.diagnostics.push(createDiagnostic('IMAGE_PLACEHOLDER', { imageId: objectId }));
        return {
          type: 'text',
          value: `[Image: ${title}]`
        };
      }
    }
  }

  // Unknown inline object type - placeholder
  context.diagnostics.push(createDiagnostic('IMAGE_PLACEHOLDER', { imageId: objectId }));
  return {
    type: 'text',
    value: `[Inline object: ${objectId}]`
  };
}

/**
 * Convert equation element.
 *
 * @param {object} equation - Google Docs Equation
 * @param {object} context - Conversion context
 * @returns {object} mdast node (placeholder for now)
 */
function convertEquation(equation, context) {
  // Equations are complex - use placeholder with diagnostic
  context.diagnostics.push(createDiagnostic('EQUATION_PLACEHOLDER'));

  return {
    type: 'html',
    value: '<!-- DWA:EQUATION status="unconverted" -->'
  };
}

/**
 * Convert table to mdast node.
 *
 * @param {object} table - Google Docs Table
 * @param {object} context - Conversion context
 * @returns {object} mdast table or html node
 */
function convertTable(table, context) {
  const complexity = analyzeTableComplexity(table);

  if (context.tableMode === 'gfm' ||
      (context.tableMode === 'html-fallback' && complexity === 'simple')) {
    return convertToGfmTable(table, context);
  } else {
    // Complex table - use HTML fallback
    context.diagnostics.push(createDiagnostic('TABLE_TO_HTML'));
    return convertToHtmlTable(table, context);
  }
}

/**
 * Analyze table complexity.
 *
 * @param {object} table - Google Docs Table
 * @returns {string} 'simple' or 'complex'
 */
function analyzeTableComplexity(table) {
  if (!table.tableRows) {
    return 'simple';
  }

  for (const row of table.tableRows) {
    if (!row.tableCells) continue;

    for (const cell of row.tableCells) {
      // Check for merged cells
      const rowSpan = cell.tableCellStyle?.rowSpan || 1;
      const columnSpan = cell.tableCellStyle?.columnSpan || 1;

      if (rowSpan > 1 || columnSpan > 1) {
        return 'complex';
      }

      // Check for multi-paragraph cells
      if (cell.content && cell.content.length > 1) {
        return 'complex';
      }
    }
  }

  return 'simple';
}

/**
 * Convert simple table to GFM markdown table.
 *
 * @param {object} table - Google Docs Table
 * @param {object} context - Conversion context
 * @returns {object} mdast table node
 */
function convertToGfmTable(table, context) {
  const rows = table.tableRows || [];
  const mdastRows = [];
  const alignments = [];

  // Process all rows
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = row.tableCells || [];
    const mdastCells = [];

    for (let j = 0; j < cells.length; j++) {
      const cell = cells[j];
      const cellChildren = extractTableCellContent(cell, context);

      mdastCells.push({
        type: 'tableCell',
        children: cellChildren
      });

      // Extract alignment from first row
      if (i === 0 && alignments.length === j) {
        const alignment = cell.tableCellStyle?.contentAlignment || 'START';
        alignments.push(mapAlignment(alignment));
      }
    }

    mdastRows.push({
      type: 'tableRow',
      children: mdastCells
    });
  }

  return {
    type: 'table',
    align: alignments.length > 0 ? alignments : null,
    children: mdastRows
  };
}

/**
 * Convert complex table to HTML.
 *
 * @param {object} table - Google Docs Table
 * @param {object} context - Conversion context
 * @returns {object} mdast html node
 */
function convertToHtmlTable(table, context) {
  const rows = table.tableRows || [];
  let html = '<table>\n';

  for (const row of rows) {
    html += '  <tr>\n';
    const cells = row.tableCells || [];

    for (const cell of cells) {
      const rowSpan = cell.tableCellStyle?.rowSpan || 1;
      const columnSpan = cell.tableCellStyle?.columnSpan || 1;

      const attrs = [];
      if (rowSpan > 1) attrs.push(`rowspan="${rowSpan}"`);
      if (columnSpan > 1) attrs.push(`colspan="${columnSpan}"`);

      const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

      const cellContent = extractTableCellContentAsText(cell, context);
      html += `    <td${attrStr}>${cellContent}</td>\n`;
    }

    html += '  </tr>\n';
  }

  html += '</table>';

  return {
    type: 'html',
    value: html
  };
}

/**
 * Extract table cell content as mdast nodes.
 *
 * @param {object} cell - Google Docs TableCell
 * @param {object} context - Conversion context
 * @returns {object[]} Array of mdast inline nodes
 */
function extractTableCellContent(cell, context) {
  const children = [];

  if (cell.content) {
    for (const element of cell.content) {
      if (element.paragraph?.elements) {
        for (const inlineEl of element.paragraph.elements) {
          const node = convertInlineElement(inlineEl, context);
          if (node) {
            if (Array.isArray(node)) {
              children.push(...node);
            } else {
              children.push(node);
            }
          }
        }
      }
    }
  }

  return children.length > 0 ? children : [{ type: 'text', value: '' }];
}

/**
 * Extract table cell content as plain text (for HTML tables).
 *
 * @param {object} cell - Google Docs TableCell
 * @param {object} context - Conversion context
 * @returns {string} Plain text content
 */
function extractTableCellContentAsText(cell, context) {
  let text = '';

  if (cell.content) {
    for (const element of cell.content) {
      if (element.paragraph?.elements) {
        for (const inlineEl of element.paragraph.elements) {
          if (inlineEl.textRun) {
            let content = inlineEl.textRun.content || '';
            if (content.endsWith('\n')) {
              content = content.slice(0, -1);
            }
            text += content;
          }
        }
      }
    }
  }

  return text.trim();
}

/**
 * Map Google Docs alignment to mdast table alignment.
 *
 * @param {string} gdocAlignment - Google Docs alignment (START, CENTER, END, JUSTIFIED)
 * @returns {string|null} mdast alignment ('left', 'center', 'right', null)
 */
function mapAlignment(gdocAlignment) {
  const map = {
    'START': 'left',
    'CENTER': 'center',
    'END': 'right',
    'JUSTIFIED': null
  };
  return map[gdocAlignment] || null;
}

module.exports = {
  gdocToMdast,
  convertStructuralElement,
  analyzeTableComplexity
};
