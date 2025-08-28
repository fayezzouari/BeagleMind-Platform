import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import 'highlight.js/styles/github-dark.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  disableHighlight?: boolean;
}

export function MarkdownRenderer({ content, className = '', disableHighlight }: MarkdownRendererProps) {
  const rehypePlugins = disableHighlight ? [rehypeRaw] : [rehypeHighlight, rehypeRaw];
  return (
    <div className={`prose prose-invert prose-xs md:prose-sm max-w-none markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypePlugins}
        components={{
          // Custom styling for code blocks
          pre: ({ children, ...props }) => (
            <pre 
              {...props} 
              className="bg-slate-900 border border-slate-700 rounded-md p-2 md:p-3 overflow-x-auto text-xs md:text-sm"
            >
              {children}
            </pre>
          ),
          // Custom styling for inline code
          code: ({ children, className, ...props }) => {
            const isInlineCode = !className;
            return isInlineCode ? (
              <code 
                {...props} 
                className="bg-slate-800 px-1.5 py-0.5 md:px-2 md:py-1 rounded text-xs md:text-sm font-mono text-cyan-300"
              >
                {children}
              </code>
            ) : (
              <code {...props} className={className}>
                {children}
              </code>
            );
          },
          // Custom styling for blockquotes
          blockquote: ({ children, ...props }) => (
            <blockquote 
              {...props} 
              className="border-l-2 md:border-l-4 border-slate-500 pl-2 md:pl-4 my-2 md:my-4 italic text-slate-300 text-xs md:text-sm"
            >
              {children}
            </blockquote>
          ),
          // Custom styling for tables
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto">
              <table {...props} className="min-w-full border-collapse border border-slate-600 text-xs md:text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children, ...props }) => (
            <th {...props} className="border border-slate-600 bg-slate-800 px-2 md:px-4 py-1 md:py-2 text-left font-semibold text-xs md:text-sm">
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td {...props} className="border border-slate-600 px-2 md:px-4 py-1 md:py-2 text-xs md:text-sm">
              {children}
            </td>
          ),
          // Custom styling for lists
          ul: ({ children, ...props }) => (
            <ul {...props} className="list-disc pl-4 md:pl-6 my-2 md:my-4 space-y-1 md:space-y-2 text-xs md:text-sm">
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol {...props} className="list-decimal pl-4 md:pl-6 my-2 md:my-4 space-y-1 md:space-y-2 text-xs md:text-sm">
              {children}
            </ol>
          ),
          // Custom styling for headings
          h1: ({ children, ...props }) => (
            <h1 {...props} className="text-lg md:text-xl font-bold mt-4 md:mt-6 mb-2 md:mb-4 text-slate-100">
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 {...props} className="text-base md:text-lg font-bold mt-3 md:mt-5 mb-2 md:mb-3 text-slate-100">
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 {...props} className="text-sm md:text-base font-bold mt-2 md:mt-4 mb-1 md:mb-2 text-slate-100">
              {children}
            </h3>
          ),
          h4: ({ children, ...props }) => (
            <h4 {...props} className="text-sm font-bold mt-2 md:mt-3 mb-1 md:mb-2 text-slate-100">
              {children}
            </h4>
          ),
          // Custom styling for links
          a: ({ children, ...props }) => (
            <a 
              {...props} 
              className="text-cyan-400 hover:text-cyan-300 underline transition-colors text-xs md:text-sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          // Custom styling for paragraphs
          p: ({ children, ...props }) => (
            <p {...props} className="mb-2 md:mb-4 leading-relaxed text-slate-200 text-xs md:text-sm">
              {children}
            </p>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
