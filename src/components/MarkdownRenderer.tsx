import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { CodeBlock } from './CodeBlock';

interface Props {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      className={`prose prose-invert prose-sm max-w-none leading-relaxed ${className || ''}`}
      components={{
        code(props) {
          const { children, className: cls, ...rest } = props;
          const isBlock = cls?.startsWith('language-');
          const lang = cls?.replace('language-', '');
          const codeStr = String(children).replace(/\n$/, '');

          if (isBlock) {
            return <CodeBlock code={codeStr} language={lang} />;
          }
          return (
            <code
              {...rest}
              className="px-1.5 py-0.5 rounded bg-white/10 text-indigo-300 font-mono text-[0.85em]"
            >
              {children}
            </code>
          );
        },
        pre({ children }) {
          return <>{children}</>;
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
            >
              {children}
            </a>
          );
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto my-3">
              <table className="w-full text-sm border-collapse">{children}</table>
            </div>
          );
        },
        th({ children }) {
          return (
            <th className="px-3 py-2 text-left bg-white/10 border border-white/10 font-semibold text-slate-200">
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td className="px-3 py-2 border border-white/10 text-slate-300">{children}</td>
          );
        },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-2 border-indigo-500 pl-4 italic text-slate-400 my-3">
              {children}
            </blockquote>
          );
        },
        hr() {
          return <hr className="border-white/10 my-4" />;
        },
        h1({ children }) {
          return <h1 className="text-xl font-bold text-white mt-5 mb-2">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="text-lg font-semibold text-white mt-4 mb-2">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="text-base font-semibold text-slate-200 mt-3 mb-1.5">{children}</h3>;
        },
        ul({ children }) {
          return <ul className="list-disc list-inside space-y-1 my-2 text-slate-300">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal list-inside space-y-1 my-2 text-slate-300">{children}</ol>;
        },
        li({ children }) {
          return <li className="leading-relaxed">{children}</li>;
        },
        p({ children }) {
          return <p className="my-2 leading-relaxed text-slate-200">{children}</p>;
        },
        strong({ children }) {
          return <strong className="font-semibold text-white">{children}</strong>;
        },
        em({ children }) {
          return <em className="italic text-slate-300">{children}</em>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
