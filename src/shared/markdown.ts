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

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      continue;
    }

    if (isMarkdownTableStart(lines, index)) {
      const { html: tableHtml, nextIndex } = renderTable(lines, index);
      html.push(tableHtml);
      index = nextIndex - 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length + 2;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (parseListLine(line)) {
      const { html: listHtml, nextIndex } = renderListBlock(lines, index);
      html.push(listHtml);
      index = nextIndex - 1;
      continue;
    }

    const quote = /^>\s?(.+)$/.exec(line);
    if (quote) {
      html.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }

    html.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }

  if (inCodeBlock) {
    html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }

  return html.join("");
}

type ListTag = "ul" | "ol";

interface MarkdownList {
  tag: ListTag;
  indent: number;
  start?: number;
  items: MarkdownListItem[];
}

interface MarkdownListItem {
  content: string;
  children: MarkdownList[];
}

interface ParsedListLine {
  tag: ListTag;
  indent: number;
  start?: number;
  content: string;
}

function renderListBlock(
  lines: string[],
  startIndex: number,
): { html: string; nextIndex: number } {
  const roots: MarkdownList[] = [];
  const stack: MarkdownList[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const parsed = parseListLine(lines[index].trimEnd());
    if (!parsed) break;

    while (
      stack.length > 0 &&
      parsed.indent < stack[stack.length - 1].indent
    ) {
      stack.pop();
    }

    let current = stack[stack.length - 1];
    const startsNestedList = current && parsed.indent > current.indent;
    const switchesListType =
      current && parsed.indent === current.indent && parsed.tag !== current.tag;

    if (!current || startsNestedList || switchesListType) {
      if (switchesListType) {
        stack.pop();
        current = stack[stack.length - 1];
      }

      const list: MarkdownList = {
        tag: parsed.tag,
        indent: parsed.indent,
        start: parsed.start,
        items: [],
      };
      if (current) {
        const parentItem = current.items[current.items.length - 1];
        if (!parentItem) break;
        parentItem.children.push(list);
      } else {
        roots.push(list);
      }
      stack.push(list);
      current = list;
    }

    current.items.push({ content: parsed.content, children: [] });
    index += 1;
  }

  return {
    html: roots.map(renderList).join(""),
    nextIndex: index,
  };
}

function renderList(list: MarkdownList): string {
  const startAttribute =
    list.tag === "ol" && list.start && list.start !== 1
      ? ` start="${list.start}"`
      : "";
  const items = list.items
    .map(
      (item) =>
        `<li>${renderInlineMarkdown(item.content)}${item.children
          .map(renderList)
          .join("")}</li>`,
    )
    .join("");
  return `<${list.tag}${startAttribute}>${items}</${list.tag}>`;
}

function parseListLine(line: string): ParsedListLine | undefined {
  const match = /^([ \t]*)([-+*]|\d+[.)])[ \t]+(.+)$/.exec(line);
  if (!match) return undefined;
  const orderedStart = /^\d+/.exec(match[2]);
  return {
    tag: orderedStart ? "ol" : "ul",
    indent: match[1].replace(/\t/g, "    ").length,
    start: orderedStart ? Number.parseInt(orderedStart[0], 10) : undefined,
    content: match[3],
  };
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
