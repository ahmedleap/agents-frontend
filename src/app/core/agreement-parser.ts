// Turns the plain-text Customer Account Agreement (src/assets/agreement.txt) into structured
// content the agreement page can lay out. The text file stays the single source of truth:
// compliance can edit it without touching code, as long as it keeps the same conventions:
//
//   =====            banner lines around the document title and each section title
//   1.1 TITLE        sub-heading inside a section
//   - item           bullet;  "    * item", "    - item" or "    1. item" nest under the bullet above
//   ___ 1. text      certification checklist item
//   LABEL: value     in the intro (e.g. "VERSION: 2.0") becomes document metadata
//   other lines      paragraphs; a long line (~80-column wrap) without end punctuation continues on the next

export interface AgreementListItem {
  text: string;
  children: string[];
}

export type AgreementBlock =
  | { kind: 'heading'; id: string; text: string }
  | { kind: 'text'; lines: string[] }
  | { kind: 'list'; items: AgreementListItem[] }
  | { kind: 'checklist'; items: { n: string; text: string }[] };

export interface AgreementSection {
  id: string;
  /** "1" for "SECTION 1: ...", null for unnumbered sections like CONTACT INFORMATION */
  number: string | null;
  title: string;
  blocks: AgreementBlock[];
}

export interface AgreementDocument {
  titleLines: string[];
  meta: { label: string; value: string }[];
  intro: AgreementBlock[];
  sections: AgreementSection[];
}

const BANNER = /^={5,}\s*$/;
const SECTION_TITLE = /^SECTION\s+(\d+):\s*(.+)$/i;
const SUB_HEADING = /^(\d+\.\d+)\s+(.+)$/;
const BULLET = /^-\s+(.*)$/;
const NESTED = /^\s{2,}(?:[*-]|\d+\.)\s+(.*)$/;
const CHECK = /^_{2,}\s*(\d+)\.\s*(.+)$/;
const META = /^([A-Z][A-Z ]+):\s*(.+)$/;
const META_LABELS = new Set(['EFFECTIVE DATE', 'VERSION', 'LAST UPDATED']);
// The document's own closing banner isn't a section
const END_MARKER = /^END OF\b/i;

export function parseAgreement(raw: string): AgreementDocument {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');

  // Split into [banner title lines, content lines] chunks
  const chunks: { title: string[]; content: string[] }[] = [];
  let i = 0;
  while (i < lines.length) {
    if (BANNER.test(lines[i])) {
      const title: string[] = [];
      i++;
      while (i < lines.length && !BANNER.test(lines[i])) title.push(lines[i++].trim());
      i++; // closing banner
      const content: string[] = [];
      while (i < lines.length && !BANNER.test(lines[i])) content.push(lines[i++]);
      chunks.push({ title: title.filter(Boolean), content });
    } else {
      i++;
    }
  }

  const [head, ...rest] = chunks;
  const meta: AgreementDocument['meta'] = [];
  const introLines = (head?.content ?? []).filter(line => {
    const m = line.trim().match(META);
    if (m && META_LABELS.has(m[1].trim())) {
      meta.push({ label: m[1].trim(), value: m[2].trim() });
      return false;
    }
    return true;
  });

  const sections: AgreementSection[] = rest
    .filter(c => c.title.length && !END_MARKER.test(c.title[0]))
    .map(c => {
      const heading = c.title.join(' ');
      const numbered = heading.match(SECTION_TITLE);
      const id = numbered ? `section-${numbered[1]}` : slug(heading);
      return {
        id,
        number: numbered ? numbered[1] : null,
        title: numbered ? numbered[2].trim() : heading,
        blocks: parseBlocks(c.content, id)
      };
    });

  return { titleLines: head?.title ?? [], meta, intro: parseBlocks(introLines, 'intro'), sections };
}

function parseBlocks(lines: string[], sectionId: string): AgreementBlock[] {
  const blocks: AgreementBlock[] = [];
  let text: { kind: 'text'; lines: string[] } | null = null;
  let list: { kind: 'list'; items: AgreementListItem[] } | null = null;
  let checklist: { kind: 'checklist'; items: { n: string; text: string }[] } | null = null;
  let continues = false; // previous text line ended with a space

  const close = () => { text = null; list = null; checklist = null; continues = false; };

  for (const line of lines) {
    if (!line.trim()) { close(); continue; }

    const sub = line.match(SUB_HEADING);
    if (sub && !line.startsWith(' ')) {
      close();
      blocks.push({ kind: 'heading', id: `${sectionId}-${sub[1].replace('.', '-')}`, text: line.trim() });
      continue;
    }

    const check = line.match(CHECK);
    if (check) {
      if (!checklist) { close(); checklist = { kind: 'checklist', items: [] }; blocks.push(checklist); }
      checklist.items.push({ n: check[1], text: check[2].trim() });
      continue;
    }

    const nested = line.match(NESTED);
    if (nested && list && list.items.length) {
      list.items[list.items.length - 1].children.push(nested[1].trim());
      continue;
    }

    const bullet = line.match(BULLET) ?? nested;
    if (bullet) {
      if (!list) { close(); list = { kind: 'list', items: [] }; blocks.push(list); }
      list.items.push({ text: bullet[1].trim(), children: [] });
      continue;
    }

    // Plain text
    if (!text) { close(); text = { kind: 'text', lines: [] }; blocks.push(text); }
    if (continues && text.lines.length) {
      text.lines[text.lines.length - 1] += ' ' + line.trim();
    } else {
      text.lines.push(line.trim());
    }
    continues = isWrapped(line);
  }
  return blocks;
}

/**
 * A text line that was hard-wrapped mid-sentence: it ends with a space, or it is near the
 * ~80-column wrap width without ending in punctuation. Short lines (addresses, contact
 * details, "Example:" headers) always stay on their own line.
 */
function isWrapped(line: string): boolean {
  if (line.endsWith(' ')) return true;
  const trimmed = line.trim();
  return trimmed.length >= 70 && !/[.:;!?)\]"']$/.test(trimmed);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
