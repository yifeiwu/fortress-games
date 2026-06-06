// Tiny, dependency-free Markdown -> HTML renderer.
//
// It supports the subset used by the game rule docs: headings, paragraphs,
// horizontal rules, ordered/unordered lists (with wrapped continuation lines),
// GitHub-style tables, fenced code blocks, and inline bold/italic/code/links.
// It is intentionally minimal — not a general-purpose Markdown engine.

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, (_match, code: string) => `<code>${code}</code>`);
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, label: string, href: string) => `<a href="${href}">${label}</a>`
  );
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return out;
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
}

export function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    // Fenced code block
    if (/^\s*```/.test(line)) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing fence
      html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    // Headings
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^\s*---+\s*$/.test(line)) {
      html.push("<hr />");
      i += 1;
      continue;
    }

    // Table: a header row followed by a separator row
    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headerCells = splitTableRow(line);
      i += 2; // skip header + separator
      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        bodyRows.push(splitTableRow(lines[i]));
        i += 1;
      }
      const head = headerCells.map((cell) => `<th>${renderInline(cell)}</th>`).join("");
      const body = bodyRows
        .map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`)
        .join("");
      html.push(`<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`);
      continue;
    }

    // Ordered / unordered lists (with indented continuation lines)
    const orderedStart = /^\s*\d+\.\s+/;
    const unorderedStart = /^\s*[-*]\s+/;
    const isOrdered = orderedStart.test(line);
    if (isOrdered || unorderedStart.test(line)) {
      const marker = isOrdered ? orderedStart : unorderedStart;
      const items: string[] = [];
      let current = "";
      while (i < lines.length) {
        const cur = lines[i];
        if (cur.trim() === "") break;
        if (marker.test(cur)) {
          if (current) items.push(current);
          current = cur.replace(marker, "");
        } else if (/^\s+\S/.test(cur) && current) {
          current += ` ${cur.trim()}`;
        } else {
          break;
        }
        i += 1;
      }
      if (current) items.push(current);
      const tag = isOrdered ? "ol" : "ul";
      html.push(`<${tag}>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</${tag}>`);
      continue;
    }

    // Paragraph: gather consecutive lines until a blank line or a new block
    const para: string[] = [];
    while (i < lines.length) {
      const cur = lines[i];
      if (
        cur.trim() === "" ||
        /^\s*```/.test(cur) ||
        /^(#{1,6})\s+/.test(cur) ||
        /^\s*---+\s*$/.test(cur) ||
        /^\s*\d+\.\s+/.test(cur) ||
        /^\s*[-*]\s+/.test(cur) ||
        (cur.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
      ) {
        break;
      }
      para.push(cur.trim());
      i += 1;
    }
    html.push(`<p>${renderInline(para.join(" "))}</p>`);
  }

  return html.join("\n");
}
