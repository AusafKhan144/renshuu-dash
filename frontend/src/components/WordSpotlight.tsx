import { Sparkles } from "lucide-react";
import type { SpotlightWord } from "../api/client";
import { Card } from "./ui";

export function WordSpotlight({ words }: { words: SpotlightWord[] }) {
  return (
    <Card delay={0.06}>
      <div className="mb-3 flex items-center gap-2 text-[13px] font-bold">
        <Sparkles size={15} className="text-gold" /> Word Spotlight
      </div>
      {words.length === 0 ? (
        <p className="text-sm text-fg-faint">
          No spotlight words yet — check back after tomorrow's snapshot.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {words.map((w) => (
            <div key={w.word_id} className="rounded-[14px] bg-inset p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-[17px] font-bold">
                  {w.kanji_full || w.hiragana_full}
                </span>
                {w.kanji_full && w.hiragana_full && (
                  <span className="text-[12px] text-fg-faint">{w.hiragana_full}</span>
                )}
              </div>
              <div className="mt-0.5 line-clamp-1 text-[12.5px] text-fg-muted">{w.def}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-card-border-strong">
                <div
                  className="h-full rounded-full bg-gold"
                  style={{ width: `${w.mastery}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
