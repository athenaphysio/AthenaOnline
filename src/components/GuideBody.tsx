import type { ReactNode } from "react";
import styles from "./GuideBody.module.css";

// Shows a brand pack's client guide. The guide is written in a small, plain
// form of Markdown, so David can edit it as ordinary text in the brand pack
// editor: "## " starts a heading, "1. " a numbered point, "- " a bullet,
// rows of "|" a table, **double stars** make words bold, and a blank line
// starts a new paragraph. Built as ordinary elements, never raw HTML.

type Block =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "ordered" | "bullet"; items: string[] }
  | { kind: "table"; header: string[]; rows: string[][] };

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

export function parseGuide(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      blocks.push({ kind: "heading", text: line.replace(/^#{1,6}\s+/, "") });
      i++;
      continue;
    }
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const row = cells(lines[i]);
        // The "| --- | --- |" line under the header is only a divider.
        if (!row.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(row);
        i++;
      }
      if (rows.length > 0) blocks.push({ kind: "table", header: rows[0], rows: rows.slice(1) });
      continue;
    }
    const ordered = /^\d+[.)]\s/;
    const bullet = /^[-*]\s/;
    if (ordered.test(line) || bullet.test(line)) {
      const kind = ordered.test(line) ? "ordered" : "bullet";
      const pattern = kind === "ordered" ? ordered : bullet;
      const items: string[] = [];
      while (i < lines.length && pattern.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(pattern, ""));
        i++;
      }
      blocks.push({ kind, items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\||\d+[.)]\s|[-*]\s)/.test(lines[i].trim())) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ kind: "paragraph", text: para.join(" ") });
  }
  return blocks;
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

export default function GuideBody({ source }: { source: string }) {
  const blocks = parseGuide(source);
  return (
    <div className={styles.guide}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "heading":
            return <h2 key={i}>{inline(b.text)}</h2>;
          case "paragraph":
            return <p key={i}>{inline(b.text)}</p>;
          case "ordered":
            return (
              <ol key={i}>
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it)}</li>
                ))}
              </ol>
            );
          case "bullet":
            return (
              <ul key={i}>
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it)}</li>
                ))}
              </ul>
            );
          case "table":
            return (
              <div key={i} className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      {b.header.map((h, j) => (
                        <th key={j}>{inline(h)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, k) => (
                          <td key={k} data-label={b.header[k] ?? ""}>
                            {inline(c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
