import { useEffect } from 'react';
import { resetPageMeta, upsertMeta } from '@/utils/pageMeta';

/**
 * @param {{ title?: string, description?: string|null, robots?: string, resetOnUnmount?: boolean }} options
 */
export default function usePageMeta({
  title,
  description = null,
  robots = 'noindex, nofollow',
  resetOnUnmount = true,
} = {}) {
  useEffect(() => {
    if (title) document.title = title;
    upsertMeta('name', 'robots', robots);
    upsertMeta('name', 'description', description);

    return () => {
      if (resetOnUnmount) resetPageMeta();
    };
  }, [title, description, robots, resetOnUnmount]);
}
