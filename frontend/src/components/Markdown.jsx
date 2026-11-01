import { Fragment } from 'react';

/**
 * A small, safe Markdown renderer for managed text (terms, privacy, stories): headings (#, ##, ###), paragraphs,
 * bulleted and numbered lists, **bold**, *italic*, [links](https://…) and line breaks. It builds React elements
 * and never injects HTML, so text edited in the dashboard cannot add scripts or markup.
 */
const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/(?!\/))/i;

function inline(text, keyBase) {
  const out = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*\n]+)\*|\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[2]) out.push(<strong key={key}>{m[2]}</strong>);
    else if (m[3]) out.push(<em key={key}>{m[3]}</em>);
    else if (SAFE_URL.test(m[5])) {
      const external = /^https?:/i.test(m[5]);
      out.push(<a key={key} href={m[5]} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{m[4]}</a>);
    } else out.push(m[4]);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  // Two trailing spaces or a backslash end a line inside a paragraph.
  return out.flatMap((part, j) =>
    typeof part === 'string'
      ? part.split(/ {2,}\n|\\\n/).flatMap((s, k, arr) => (k < arr.length - 1 ? [s, <br key={`${keyBase}-br-${j}-${k}`} />] : [s]))
      : [part],
  );
}

export function parseBlocks(source) {
  const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let para = [];
  let list = null;
  const flushPara = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join('\n') });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, (s) => (s.length >= 2 ? '  ' : ''));
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if (h) {
      flushPara();
      flushList();
      blocks.push({ type: `h${h[1].length + 1}`, text: h[2] });
    } else if (ul || ol) {
      flushPara();
      const type = ul ? 'ul' : 'ol';
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push((ul || ol)[1]);
    } else if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}

export default function Markdown({ source, className }) {
  const blocks = parseBlocks(source);
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        if (b.type === 'ul' || b.type === 'ol') {
          const List = b.type;
          return (
            <List key={i}>
              {b.items.map((item, j) => (
                <li key={j}>{inline(item, `${i}-${j}`)}</li>
              ))}
            </List>
          );
        }
        if (b.type === 'p') return <p key={i}>{inline(b.text, String(i))}</p>;
        const H = b.type;
        return <H key={i}>{inline(b.text, String(i))}</H>;
      })}
      {blocks.length === 0 ? <Fragment /> : null}
    </div>
  );
}
