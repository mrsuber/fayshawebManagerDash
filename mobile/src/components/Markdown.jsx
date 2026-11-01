import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { COLORS, FONTS } from '../constants/theme';

/**
 * Markdown for managed text (terms, privacy, stories) — the same subset as the website: # headings, paragraphs,
 * - and 1. lists, **bold**, *italic*, [links](url). Rendered as native text; nothing is executed.
 */
const SAFE_URL = /^(https?:\/\/|mailto:|tel:)/i;

function inline(text, key) {
  const out = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*\n]+)\*|\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[2]) out.push(<Text key={k} style={s.bold}>{m[2]}</Text>);
    else if (m[3]) out.push(<Text key={k} style={s.italic}>{m[3]}</Text>);
    else if (SAFE_URL.test(m[5])) out.push(<Text key={k} style={s.link} onPress={() => Linking.openURL(m[5])}>{m[4]}</Text>);
    else out.push(m[4]);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.map((p) => (typeof p === 'string' ? p.replace(/ {2,}\n|\\\n/g, '\n') : p));
}

function blocks(source) {
  const out = [];
  let para = [];
  let list = null;
  const flush = () => {
    if (para.length) out.push({ type: 'p', text: para.join(' ') });
    para = [];
    if (list) out.push(list);
    list = null;
  };
  String(source || '').replace(/\r\n?/g, '\n').split('\n').forEach((line) => {
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (!line.trim()) flush();
    else if (h) {
      flush();
      out.push({ type: 'h', level: h[1].length, text: h[2] });
    } else if (ul || ol) {
      if (para.length) {
        out.push({ type: 'p', text: para.join(' ') });
        para = [];
      }
      const type = ul ? 'ul' : 'ol';
      if (!list || list.type !== type) {
        if (list) out.push(list);
        list = { type, items: [] };
      }
      list.items.push(ul ? ul[1] : ol[2]);
    } else {
      if (list) {
        out.push(list);
        list = null;
      }
      para.push(line.trim());
    }
  });
  flush();
  return out;
}

export default function Markdown({ source }) {
  return (
    <View>
      {blocks(source).map((b, i) => {
        if (b.type === 'h') return <Text key={i} style={b.level <= 2 ? s.h2 : s.h3}>{inline(b.text, i)}</Text>;
        if (b.type === 'p') return <Text key={i} style={s.p}>{inline(b.text, i)}</Text>;
        return (
          <View key={i} style={s.list}>
            {b.items.map((item, j) => (
              <View key={j} style={s.li}>
                <Text style={s.bullet}>{b.type === 'ol' ? `${j + 1}.` : '•'}</Text>
                <Text style={[s.p, s.liText]}>{inline(item, `${i}-${j}`)}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  h2: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 21, marginTop: 22, marginBottom: 8 },
  h3: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 18, marginTop: 16, marginBottom: 6 },
  p: { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 14.5, lineHeight: 22, marginBottom: 10 },
  bold: { fontFamily: FONTS.bodyMedium || FONTS.body, color: COLORS.text, fontWeight: '600' },
  italic: { fontStyle: 'italic' },
  link: { color: COLORS.primary, textDecorationLine: 'underline' },
  list: { marginBottom: 8 },
  li: { flexDirection: 'row', gap: 10, paddingRight: 8 },
  bullet: { fontFamily: FONTS.body, color: COLORS.primary, fontSize: 14.5, lineHeight: 22, minWidth: 16 },
  liText: { flex: 1, marginBottom: 4 },
});
