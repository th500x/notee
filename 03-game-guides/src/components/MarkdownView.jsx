import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { resolveContentImage } from '../services/contentService'

/**
 * @param {{ body: string, baseDir: string }} props
 */
export default function MarkdownView({ body, baseDir }) {
  return (
    <div className="guide-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
          img: ({ src, alt }) => {
            const resolved = resolveContentImage(baseDir, src || '')
            return (
              <figure className="guide-figure">
                <img src={resolved} alt={alt || ''} loading="lazy" />
                {alt ? <figcaption>{alt}</figcaption> : null}
              </figure>
            )
          },
          table: ({ children }) => (
            <div className="guide-table-wrap">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  )
}
