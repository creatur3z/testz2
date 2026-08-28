import { useEffect, useMemo, useRef, useState } from "react";
import { X, Download, Copy, Check } from "lucide-react";
import type { AssetFile } from "@/types";
import { downloadAsset } from "@/lib/download";

interface Props {
  file: AssetFile | null;
  onClose: () => void;
  onSave?: (content: string) => void;
}

function highlightCss(code: string): string {
  const escaped = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  let html = escaped;
  html = html.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tok-comment">$1</span>');
  html = html.replace(/(@[a-zA-Z-]+)/g, '<span class="tok-atrule">$1</span>');
  html = html.replace(/([.#]?[a-zA-Z][\w-]*(?:\s*[>+~]\s*[a-zA-Z][\w-]*)*::?[a-zA-Z-]*)\s*(\{)/g, (_m, sel, brace) => `<span class="tok-selector">${sel}</span><span class="tok-brace">${brace}</span>`);
  html = html.replace(/([a-zA-Z-]+)(\s*:)/g, '<span class="tok-property">$1</span>$2');
  html = html.replace(/:\s*([^;{}]+);/g, (_m, val) => `: <span class="tok-value">${val}</span>;`);
  return html;
}

export function PreviewModal({ file, onClose, onSave }: Props) {
  const [editedContent, setEditedContent] = useState("");
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const isHtml = file ? file.name.toLowerCase().endsWith(".html") || file.name.toLowerCase().endsWith(".htm") : false;
  const isCss = file ? file.name.toLowerCase().endsWith(".css") : false;

  useEffect(() => {
    if (file) setEditedContent(file.content);
  }, [file]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (file) {
      window.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [file, onClose]);

  const highlightedCss = useMemo(() => (isCss ? highlightCss(editedContent) : ""), [isCss, editedContent]);

  if (!file) return null;

  function syncScroll() {
    if (taRef.current && document.getElementById("css-highlight")) {
      document.getElementById("css-highlight")!.scrollTop = taRef.current.scrollTop;
      document.getElementById("css-highlight")!.scrollLeft = taRef.current.scrollLeft;
    }
  }

  function handleTab(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newVal = editedContent.slice(0, start) + "  " + editedContent.slice(end);
      setEditedContent(newVal);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  }

  function copyContent() {
    navigator.clipboard.writeText(editedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-scale-in border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${isCss ? "bg-accent-500/10 text-accent-600" : "bg-brand-500/10 text-brand-600 dark:text-brand-300"}`}>
              {isCss ? "CSS" : "HTML"}
            </span>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{file.name}</h3>
            <span className="text-xs text-slate-400 hidden sm:inline">{(file.size / 1024).toFixed(1)} KB</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyContent}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition"
              title="Copy"
            >
              {copied ? <Check className="w-4 h-4 text-success-500" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={() => downloadAsset({ ...file, content: editedContent })}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden p-4">
          {isHtml ? (
            <iframe
              ref={iframeRef}
              title="preview"
              className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
              srcDoc={editedContent}
            />
          ) : (
            <div className="relative w-full h-full rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-950">
              <pre
                id="css-highlight"
                aria-hidden
                className="code-editor absolute inset-0 m-0 p-4 overflow-auto whitespace-pre pointer-events-none"
                dangerouslySetInnerHTML={{ __html: highlightedCss + "\n" }}
              />
              <textarea
                ref={taRef}
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                onScroll={syncScroll}
                onKeyDown={handleTab}
                spellCheck={false}
                className="code-editor absolute inset-0 m-0 p-4 w-full h-full bg-transparent text-transparent resize-none whitespace-pre overflow-auto"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        {onSave && (
          <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSave(editedContent);
                onClose();
              }}
              className="px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition shadow-sm"
            >
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
