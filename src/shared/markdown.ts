export function stripOuterCodeFence(markdown: string): string {
  let current = markdown.trim();

  while (true) {
    const match = /^```[^\S\n]*([^\n`]*)?\n([\s\S]*?)\n```$/.exec(current);
    if (!match) return current;
    current = match[2].trim();
  }
}

export function markdownToSafeHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCodeBlock = false;
      } else {
        closeList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    if (isMarkdownTableStart(lines, index)) {
      closeList();
      const { html: tableHtml, nextIndex } = renderTable(lines, index);
      html.push(tableHtml);
      index = nextIndex - 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length + 2;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const listItem = /^[-*]\s+(.+)$/.exec(line);
    if (listItem) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${renderInlineMarkdown(listItem[1])}</li>`);
      continue;
    }

    const quote = /^>\s?(.+)$/.exec(line);
    if (quote) {
      closeList();
      html.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }

    closeList();
    html.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }

  closeList();
  if (inCodeBlock) {
    html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }

  return html.join("");
}

function renderTable(lines: string[], startIndex: number): { html: string; nextIndex: number } {
  const headerCells = splitTableRow(lines[startIndex]);
  const bodyRows: string[][] = [];
  let index = startIndex + 2;

  while (index < lines.length && isTableRow(lines[index])) {
    bodyRows.push(splitTableRow(lines[index]));
    index += 1;
  }

  const header = headerCells.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join("");
  const body = bodyRows
    .map((row) => `<tr>${row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join("")}</tr>`)
    .join("");

  return {
    html: `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`,
    nextIndex: index
  };
}

function isMarkdownTableStart(lines: string[], index: number): boolean {
  return isTableRow(lines[index]) && isTableDelimiterLine(lines[index + 1] ?? "");
}

function isTableRow(line: string): boolean {
  return line.trim().includes("|");
}

function isTableDelimiterLine(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function renderInlineMarkdown(value: string): string {
  let html = escapeHtml(value);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer">$1</a>'
  );
  return html;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
