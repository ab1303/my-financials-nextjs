export function parseFrontMatter(rawText) {
  const text = String(rawText ?? '');
  const match = text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { frontMatter: {}, body: text };
  }

  const frontMatter = parseSimpleYaml(match[1]);
  const body = text.slice(match[0].length);
  return { frontMatter, body };
}

function stripQuotes(value) {
  const trimmed = String(value ?? '').trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function commonIndent(lines) {
  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => (line.match(/^\s*/)?.[0] ?? '').length);
  return indents.length ? Math.min(...indents) : 0;
}

function stripCommonIndent(lines) {
  const indent = commonIndent(lines);
  return lines.map((line) => {
    if (!line.trim()) return '';
    return line.slice(Math.min(indent, line.length));
  }).join('\n');
}

function foldBlock(text) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

function parseSimpleYaml(text) {
  const result = {};
  const lines = String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!match) continue;

    const [, key, restRaw] = match;
    const rest = restRaw.trim();

    if (key === 'purpose') {
      if (rest === '|' || rest === '>') {
        const block = [];
        const baseIndent = (line.match(/^\s*/)?.[0] ?? '').length;
        i += 1;
        while (i < lines.length) {
          const next = lines[i];
          if (!next.trim()) {
            block.push('');
            i += 1;
            continue;
          }
          const nextIndent = (next.match(/^\s*/)?.[0] ?? '').length;
          if (nextIndent <= baseIndent) {
            i -= 1;
            break;
          }
          block.push(next.slice(Math.min(nextIndent, next.length)));
          i += 1;
        }
        let value = stripCommonIndent(block).trimEnd();
        if (rest === '>') value = foldBlock(value);
        result.purpose = value.trim();
      } else {
        result.purpose = stripQuotes(rest);
      }
      continue;
    }

    if (key === 'gates' || key === 'references') {
      const items = [];
      const baseIndent = (line.match(/^\s*/)?.[0] ?? '').length;
      i += 1;
      while (i < lines.length) {
        const next = lines[i];
        if (!next.trim()) {
          i += 1;
          continue;
        }
        const nextIndent = (next.match(/^\s*/)?.[0] ?? '').length;
        if (nextIndent <= baseIndent) {
          i -= 1;
          break;
        }
        const itemMatch = next.match(/^\s*-\s+(.*)$/);
        if (itemMatch) items.push(stripQuotes(itemMatch[1]));
        i += 1;
      }
      result[key] = items;
      continue;
    }

    result[key] = stripQuotes(rest);
  }

  return result;
}
