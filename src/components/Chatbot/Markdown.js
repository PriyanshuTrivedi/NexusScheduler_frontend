import React from "react";

// Tiny, safe markdown renderer (no dangerouslySetInnerHTML).
// Supports: **bold**, *italic*, `code`, [text](http link), headings, - / * / 1. lists, ``` code blocks.

const INLINE_RE = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*[^*\s][^*]*\*)/g;

function renderInline(text, keyPrefix = "i") {
  const parts = text.split(INLINE_RE);
  return parts.map((part, idx) => {
    if (!part) return null;
    const key = `${keyPrefix}-${idx}`;
    if (/^\*\*[^*]+\*\*$/.test(part) || /^__[^_]+__$/.test(part)) {
      return <strong key={key}>{renderInline(part.slice(2, -2), key)}</strong>;
    }
    if (/^`[^`]+`$/.test(part)) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link) {
      return (
        <a key={key} href={link[2]} target="_blank" rel="noopener noreferrer">
          {link[1]}
        </a>
      );
    }
    if (/^\*[^*\s][^*]*\*$/.test(part)) {
      return <em key={key}>{renderInline(part.slice(1, -1), key)}</em>;
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

const BULLET_RE = /^\s*[-*•]\s+(.*)$/;
const ORDERED_RE = /^\s*\d+[.)]\s+(.*)$/;
const HEADING_RE = /^\s{0,3}#{1,6}\s+(.*)$/;

export default function Markdown({ text }) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    // fenced code block
    if (/^\s*```/.test(line)) {
      const code = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence
      blocks.push(
        <pre key={blocks.length}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      blocks.push(
        <p key={blocks.length} className="md-heading">
          {renderInline(heading[1], `h${blocks.length}`)}
        </p>,
      );
      i += 1;
      continue;
    }

    const isBullet = BULLET_RE.test(line);
    const isOrdered = !isBullet && ORDERED_RE.test(line);
    if (isBullet || isOrdered) {
      const re = isBullet ? BULLET_RE : ORDERED_RE;
      const items = [];
      while (i < lines.length && re.test(lines[i])) {
        items.push(lines[i].match(re)[1]);
        i += 1;
      }
      const Tag = isBullet ? "ul" : "ol";
      blocks.push(
        <Tag key={blocks.length}>
          {items.map((it, n) => (
            <li key={n}>{renderInline(it, `l${blocks.length}-${n}`)}</li>
          ))}
        </Tag>,
      );
      continue;
    }

    // paragraph: consecutive plain lines, single newlines kept as <br/>
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^\s*```/.test(lines[i]) &&
      !HEADING_RE.test(lines[i]) &&
      !BULLET_RE.test(lines[i]) &&
      !ORDERED_RE.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={blocks.length}>
        {para.map((l, n) => (
          <React.Fragment key={n}>
            {n > 0 && <br />}
            {renderInline(l, `p${blocks.length}-${n}`)}
          </React.Fragment>
        ))}
      </p>,
    );
  }

  return <div className="md">{blocks}</div>;
}