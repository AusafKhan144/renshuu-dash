import { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, X } from "lucide-react";
import { useSentences, useTermDetail, type Termtype } from "../api/client";
import { LineChart } from "./charts";
import { GrammarDetail } from "./GrammarDetail";

function scoreColor(score: number): string {
  if (score >= 80) return "var(--jade)";
  if (score >= 40) return "var(--gold)";
  return "var(--red)";
}

export function TermDrilldown({
  selected,
  onClose,
}: {
  selected: { termtype: Termtype; term_id: string } | null;
  onClose: () => void;
}) {
  const detail = useTermDetail(selected?.termtype ?? null, selected?.term_id ?? null, !!selected);
  const [showGrammar, setShowGrammar] = useState(false);
  const [showSentences, setShowSentences] = useState(false);
  const isVocab = selected?.termtype === "vocab";
  const isGrammar = selected?.termtype === "grammar";
  const sentences = useSentences(selected?.term_id ?? null, isVocab && showSentences);

  if (!selected) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-[18px] border border-card-border bg-card p-5 card-shadow"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-display text-[20px] font-bold">{detail.data?.display ?? "…"}</div>
            {detail.data?.reading && detail.data.reading !== detail.data.display && (
              <div className="text-[12.5px] text-fg-faint">{detail.data.reading}</div>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-fg-faint hover:text-fg" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {!detail.data ? (
          <p className="text-sm text-fg-faint">Loading…</p>
        ) : (
          <>
            {detail.data.definition && (
              <p className="mb-3 text-[13px] text-fg-muted">{detail.data.definition}</p>
            )}
            <div className="mb-4 flex items-center gap-3 text-[11.5px]">
              <span
                className="rounded-md px-2 py-1 font-bold"
                style={{ background: "var(--inset)", color: scoreColor(detail.data.mastery) }}
              >
                {detail.data.mastery}% mastery
              </span>
              <span className="text-fg-faint">{detail.data.correct} correct</span>
              <span className="text-fg-faint">{detail.data.missed} missed</span>
              {detail.data.jlpt && (
                <span className="rounded-md bg-inset px-2 py-1 font-bold uppercase text-fg-faint">
                  {detail.data.jlpt}
                </span>
              )}
            </div>

            {detail.data.history.length >= 2 && (
              <div className="mb-4">
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-muted">
                  Mastery history
                </div>
                <LineChart
                  series={[{ values: detail.data.history.map((h) => h.mastery), color: "var(--amber)" }]}
                  height={100}
                />
              </div>
            )}

            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-muted">
              Study modes
            </div>
            <div className="flex flex-col gap-3">
              {Object.entries(detail.data.vectors)
                .filter(([, v]) => v.correct_count > 0 || v.missed_count > 0)
                .sort(([, a], [, b]) => a.mastery_perc - b.mastery_perc)
                .map(([name, v]) => (
                  <div key={name}>
                    <div className="text-[11.5px] font-semibold">{name}</div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-card-border-strong">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${v.mastery_perc}%`, background: scoreColor(v.mastery_perc) }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10.5px] text-fg-faint">
                      <span>
                        {v.correct_count} correct · {v.missed_count} missed
                      </span>
                      {v.next_quiz && <span>next: {v.next_quiz}</span>}
                    </div>
                  </div>
                ))}
              {Object.values(detail.data.vectors).every((v) => v.correct_count === 0 && v.missed_count === 0) && (
                <p className="text-[12.5px] text-fg-faint">Not yet studied in any mode.</p>
              )}
            </div>

            {isGrammar && (
              <button
                onClick={() => setShowGrammar(true)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-[10px] border border-card-border-strong bg-inset py-2 text-[12.5px] font-bold text-fg hover:text-gold"
              >
                <BookOpen size={14} /> View full grammar point
              </button>
            )}

            {isVocab && !showSentences && (
              <button
                onClick={() => setShowSentences(true)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-[10px] border border-card-border-strong bg-inset py-2 text-[12.5px] font-bold text-fg hover:text-gold"
              >
                <BookOpen size={14} /> Show example sentences (1 live call)
              </button>
            )}

            {isVocab && showSentences && (
              <div className="mt-4">
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-muted">
                  Example sentences
                </div>
                {!sentences.data ? (
                  <p className="text-[12.5px] text-fg-faint">Loading…</p>
                ) : sentences.data.reibuns.length === 0 ? (
                  <p className="text-[12.5px] text-fg-faint">No example sentences found.</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {sentences.data.reibuns.slice(0, 5).map((r) => (
                      <div key={r.id} className="rounded-[12px] bg-inset p-3">
                        <div className="font-display text-[14px]">{r.japanese}</div>
                        <div className="mt-0.5 text-[11.5px] text-fg-faint">{r.hiragana}</div>
                        <div className="mt-1 text-[12px] text-fg-muted">
                          {r.meaning?.en || r.meaning?.eng}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </motion.div>

      {isGrammar && showGrammar && (
        <GrammarDetail grammarId={selected.term_id} onClose={() => setShowGrammar(false)} />
      )}
    </div>
  );
}
