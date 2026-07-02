import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { removeWord, useListWords, useLists } from "../api/client";
import { Card } from "../components/ui";

export function ListsPage() {
  const qc = useQueryClient();
  const lists = useLists(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const activeId = selected ?? lists.data?.[0]?.id ?? null;
  const detail = useListWords(activeId, page, !!activeId);

  function select(id: string) {
    setSelected(id);
    setPage(1);
  }

  async function remove(wordId: string) {
    if (!activeId) return;
    try {
      await removeWord(activeId, wordId);
      toast.success("Removed.");
      qc.invalidateQueries({ queryKey: ["list", activeId] });
    } catch {
      toast.error("Renshuu couldn't remove that word — it may not support removal.");
    }
  }

  if (lists.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-fg-muted" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex shrink-0 flex-row gap-2 overflow-x-auto lg:w-[220px] lg:flex-col lg:overflow-visible">
        {(lists.data ?? []).map((l) => (
          <button
            key={l.id}
            onClick={() => select(l.id)}
            className={
              "whitespace-nowrap rounded-[10px] px-3.5 py-2.5 text-left text-[13px] font-semibold " +
              (activeId === l.id
                ? "bg-gold text-on-accent"
                : "bg-inset text-fg-muted hover:text-fg")
            }
          >
            {l.title}
            <span className="ml-1.5 text-[11px] font-normal capitalize opacity-70">{l.termtype}</span>
          </button>
        ))}
        {lists.data?.length === 0 && <p className="text-sm text-fg-faint">No lists found.</p>}
      </div>

      <div className="flex-1">
        {detail.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-fg-muted" />
          </div>
        ) : detail.data ? (
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[14px] font-bold">{detail.data.title}</div>
              <div className="text-[11px] text-fg-faint">
                Page {detail.data.page} / {detail.data.total_pages}
              </div>
            </div>
            {detail.data.words.length === 0 ? (
              <p className="text-sm text-fg-faint">This list is empty.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {detail.data.words.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between gap-3 rounded-[12px] bg-inset p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-display text-[15px] font-bold">
                          {w.kanji_full || w.hiragana_full}
                        </span>
                        {w.kanji_full && w.hiragana_full && (
                          <span className="text-[11.5px] text-fg-faint">{w.hiragana_full}</span>
                        )}
                      </div>
                      <div className="truncate text-[12px] text-fg-muted">
                        {(w.def ?? []).join("; ")}
                      </div>
                    </div>
                    <button
                      onClick={() => remove(w.id)}
                      aria-label="Remove word"
                      className="shrink-0 rounded-lg p-1.5 text-fg-faint hover:text-red"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {detail.data.total_pages > 1 && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg p-1.5 text-fg-muted hover:text-fg disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-[12px] text-fg-faint">
                  {page} / {detail.data.total_pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(detail.data!.total_pages, p + 1))}
                  disabled={page >= detail.data.total_pages}
                  className="rounded-lg p-1.5 text-fg-muted hover:text-fg disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </Card>
        ) : (
          <p className="text-sm text-fg-faint">Select a list to see its words.</p>
        )}
      </div>
    </div>
  );
}
