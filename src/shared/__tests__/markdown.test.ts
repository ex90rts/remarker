import { describe, expect, it } from "vitest";
import { markdownToSafeHtml, stripOuterCodeFence } from "../markdown";

describe("stripOuterCodeFence", () => {
  it("removes a surrounding markdown code fence", () => {
    expect(stripOuterCodeFence("```markdown\n# Title\n\nBody\n```")).toBe(
      "# Title\n\nBody",
    );
  });

  it("removes a surrounding plain code fence", () => {
    expect(stripOuterCodeFence("```\nCurrent Meaning\n\n- sample\n```")).toBe(
      "Current Meaning\n\n- sample",
    );
  });

  it("keeps markdown without a surrounding code fence unchanged", () => {
    expect(stripOuterCodeFence("## Heading\n\nParagraph")).toBe(
      "## Heading\n\nParagraph",
    );
  });
});

describe("markdownToSafeHtml", () => {
  it("renders common markdown blocks", () => {
    const html = markdownToSafeHtml("### Word\n\n- **meaning**\n- `usage`");
    expect(html).toContain("<h5>Word</h5>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<strong>meaning</strong>");
    expect(html).toContain("<code>usage</code>");
  });

  it("escapes raw html", () => {
    const html = markdownToSafeHtml("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders pipe tables safely", () => {
    const html = markdownToSafeHtml("| Word | Meaning |\n| --- | --- |\n| API | **interface** |\n| XSS | <script>alert(1)</script> |");

    expect(html).toContain("<table>");
    expect(html).toContain("<th>Word</th>");
    expect(html).toContain("<td><strong>interface</strong></td>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
