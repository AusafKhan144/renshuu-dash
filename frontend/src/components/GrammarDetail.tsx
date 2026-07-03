import { motion } from "framer-motion";
import { ExternalLink, X } from "lucide-react";
import { useGrammarDetail } from "../api/client";

export function GrammarDetail({ grammarId, onClose }: { grammarId: string | null; onClose: () => void }) {
  const detail = useGrammarDetail(grammarId, !!grammarId);

  if (!grammarId) return null;

  const data = detail.data;
  const meaning = data?.meaning_long?.en || data?.meaning?.en;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[18px] border border-card-border bg-card p-5 card-shadow"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-display text-[20px] font-bold">
              {data?.title_japanese || data?.title_english || "…"}
            </div>
            {data?.url && (
              <a
                href={data.url}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-gold"
              >
                <ExternalLink size={11} /> View on Renshuu
              </a>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-fg-faint hover:text-fg" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {!data ? (
          <p className="text-sm text-fg-faint">Loading…</p>
        ) : (
          <>
            {meaning && <p className="mb-3 text-[13px] text-fg-muted">{meaning}</p>}

            {data.construct && (
              <img
                src={data.construct}
                alt="Grammar construction"
                className="mb-4 w-full rounded-[12px] border border-card-border"
              />
            )}

            {data.models && data.models.length > 0 && (
              <>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-muted">
                  Model sentences
                </div>
                <div className="flex flex-col gap-3">
                  {data.models.map((m, i) => (
                    <div key={i} className="rounded-[12px] bg-inset p-3">
                      <div className="font-display text-[14px]">{m.japanese}</div>
                      <div className="mt-0.5 text-[11.5px] text-fg-faint">{m.hiragana}</div>
                      <div className="mt-1 text-[12px] text-fg-muted">
                        {m.meanings?.en || m.meanings?.eng}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
