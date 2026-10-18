import { useEffect, useMemo, useState } from 'react';
import EditableText from '../components/EditableText';
import PageEditorContext, { usePageEditor } from '../contexts/PageEditorContext';
import { getPageContent } from './api';
import { useLang } from './i18n';

/**
 * Editable page copy. On the live site, PageContent loads the page's saved copy for the current language
 * (GET /api/pages/:pageId/:lang) and Txt shows it, falling back to the default text. Inside the admin's
 * visual editor (Page Management) the editor's own context is used instead, so the same Txt elements
 * become inline-editable.
 */
export function PageContent({ pageId, children }) {
  const editor = usePageEditor();
  const { lang } = useLang();
  const [content, setContent] = useState({});

  useEffect(() => {
    if (editor) return undefined;
    let live = true;
    getPageContent(pageId, lang).then((c) => live && setContent(c || {}));
    return () => {
      live = false;
    };
  }, [editor, pageId, lang]);

  const value = useMemo(
    () => ({
      isEditMode: false,
      getContentValue: (section, key, fallback = '') => content?.[section]?.[key] || fallback,
      updateContentField: () => {},
    }),
    [content],
  );

  if (editor) return children;
  return <PageEditorContext.Provider value={value}>{children}</PageEditorContext.Provider>;
}

/** <Txt s="hero" k="title" as="h1" className="fs-display">One destination…</Txt> */
export function Txt({ s, k, as = 'span', className, multiline, children }) {
  return (
    <EditableText section={s} contentKey={k} defaultValue={children} as={as} className={className} multiline={multiline} />
  );
}
