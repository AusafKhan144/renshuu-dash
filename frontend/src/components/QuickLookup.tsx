import { useState } from "react";
import type { FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookmarkPlus, ExternalLink, Loader2, Search } from "lucide-react";
import {
  useLists,
  useLookup,
  useUsage,
  saveWord,
  type GrammarResult,
  type KanjiResult,
  type LookupResult,
  type WordResult,
} from "../api/client";
import { Card } from "./ui";

type LookupType = "word" | "kanji" | "grammar";
const TYPES: LookupType[] = ["word", "kanji", "grammar"];

export function QuickLookup() {
  const qc = useQueryClient();
  const [type, setType] = useState<LookupType>("word");
  const [text, setText] = useState("");
  const [query, setQuery] = useState<{ type: LookupType; q: string } | null>(null);
  const usage = useUsage(true);
  const lists = useLists(!!query);
  const result = useLookup(query?.type ?? "word", query?.q ?? "", !!query);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setQuery({ type, q: text.trim() });
  }

  async function save(wordId: string) {
    const list = lists.data?.find((l) => l.termtype === "vocab");
    if (!list) {
      toast.error("No vocab list found to save into.");
      return;
    }
    try {
      await saveWord(list.id, wordId);
      toast.success(`Saved to "${list.title}".`);
      qc.invalidateQueries({ queryKey: ["usage"] });
    } catch {
      toast.error("Renshuu rejected the save.");
    }
  }

  return (
    <Card delay={0.12}>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[13px] font-bold">Quick Lookup</div>
        {usage.data?.remaining != null && (
          <span className="text-[11px] text-fg-faint">{usage.data.remaining} calls left today</span>
        )}
      </div>

      <div className="mb-2.5 flex gap-1">
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={
              "rounded-lg px-2.5 py-1.5 text-[11px] font-bold capitalize " +
              (type === t ? "bg-gold text-on-accent" : "bg-inset text-fg-muted hover:text-fg")
            }
          >
            {t}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Search ${type}…`}
          className="min-w-0 flex-1 rounded-[10px] border border-card-border-strong bg-inset px-3 py-2 text-sm outline-none focus:border-gold"
        />
        <button
          type="submit"
          disabled={!text.trim() || result.isFetching}
          className="flex items-center gap-1.5 rounded-[10px] bg-gold px-3.5 py-2 text-[12.5px] font-bold text-on-accent disabled:opacity-50"
        >
          {result.isFetching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        </button>
      </form>
      <p className="mt-1.5 text-[11px] text-fg-faint">Uses 1 live API call per search.</p>

      {query && result.data && (
        <div className="mt-3 rounded-[14px] bg-inset p-3.5">
          <LookupResultView result={result.data} onSave={save} />
        </div>
      )}
    </Card>
  );
}

function LookupResultView({
  result,
  onSave,
}: {
  result: LookupResult;
  onSave: (wordId: string) => void;
}) {
  if (result.type === "word") return <WordView word={result.word} onSave={onSave} />;
  if (result.type === "kanji") {
    if (!result.available) return <Unavailable />;
    if (!result.found) return <NoMatch />;
    return <KanjiView kanjis={result.kanjis ?? []} />;
  }
  if (!result.available) return <Unavailable />;
  if (!result.found) return <NoMatch />;
  return <GrammarView grammar={result.grammar ?? []} />;
}

function WordView({ word, onSave }: { word: WordResult | null; onSave: (id: string) => void }) {
  if (!word) return <NoMatch />;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="font-display text-[18px] font-bold">
            {word.kanji_full || word.hiragana_full}
          </span>
          {word.kanji_full && word.hiragana_full && (
            <span className="ml-2 text-[12px] text-fg-faint">{word.hiragana_full}</span>
          )}
        </div>
        <button
          onClick={() => onSave(word.id)}
          className="rounded-lg p-1.5 text-fg-faint hover:text-gold"
          aria-label="Save word to a list"
        >
          <BookmarkPlus size={16} />
        </button>
      </div>
      <div className="mt-1 text-[12.5px] text-fg-muted">{(word.def ?? []).join("; ")}</div>
    </div>
  );
}

function KanjiView({ kanjis }: { kanjis: KanjiResult[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {kanjis.slice(0, 3).map((k) => (
        <div key={k.id}>
          <span className="font-display text-[20px] font-bold">{k.kanji}</span>
          <span className="ml-2 text-[12.5px] text-fg-muted">{k.definition}</span>
          {(k.onyomi || k.kunyomi) && (
            <div className="text-[11px] text-fg-faint">
              {[k.onyomi, k.kunyomi].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function GrammarView({ grammar }: { grammar: GrammarResult[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {grammar.slice(0, 3).map((g) => (
        <div key={g.grammar_id}>
          <span className="font-display text-[15px] font-bold">
            {g.title_japanese || g.title_english}
          </span>
          {g.url && (
            <a
              href={g.url}
              target="_blank"
              rel="noreferrer"
              className="ml-2 inline-flex items-center gap-1 text-[11px] text-gold"
            >
              <ExternalLink size={11} /> View
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function NoMatch() {
  return <p className="text-sm text-fg-faint">No match found.</p>;
}

function Unavailable() {
  return (
    <p className="text-sm text-fg-faint">This lookup type isn't available from Renshuu right now.</p>
  );
}
