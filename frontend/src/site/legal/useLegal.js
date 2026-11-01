import { useEffect, useState } from 'react';
import { getLegal } from '../api';

/** The published document from FAY OS → Content, or null while loading / when the API cannot be reached. */
export default function useLegal(slug) {
  const [doc, setDoc] = useState(undefined);
  useEffect(() => {
    let live = true;
    getLegal(slug)
      .then((d) => live && setDoc(d))
      .catch(() => live && setDoc(null));
    return () => {
      live = false;
    };
  }, [slug]);
  return doc;
}
