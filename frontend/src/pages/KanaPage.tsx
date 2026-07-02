import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { KanaChar } from "../api/client";
import { useKana } from "../api/client";
import { KanaDetail } from "../components/KanaDetail";
import { KanaGrid } from "../components/KanaGrid";
import { KanaSummary } from "../components/KanaSummary";

type Section = "hiragana" | "katakana" | "kanji";
const SECTIONS: { id: Section; label: string }[] = [
  { id: "hiragana", label: "Hiragana" },
  { id: "katakana", label: "Katakana" },
  { id: "kanji", label: "Kanji" },
];

export function KanaPage() {
  const [section, setSection] = useState<Section>("hiragana");
  const [selected, setSelected] = useState<KanaChar | null>(null);
  const kana = useKana(true);

  // Switching sections (or the underlying data refreshing) can leave the
  // selected char pointing at data from a different section — clear it.
  useEffect(() => {
    setSelected(null);
  }, [section]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-[22px] font-bold">Kana Mastery</h1>
        <p className="mt-1 text-[13px] text-fg-muted">
          Read-only reflection of your Renshuu progress — mastery updates in Renshuu itself and
          appears here after the next snapshot.
        </p>
      </div>

      <div className="flex gap-1.5">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={
              "rounded-[10px] px-3.5 py-2 text-[12.5px] font-bold " +
              (section === s.id ? "bg-gold text-on-accent" : "bg-inset text-fg-muted hover:text-fg")
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {kana.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-fg-muted" />
        </div>
      ) : (
        <>
          <KanaSummary
            label={SECTIONS.find((s) => s.id === section)!.label}
            chars={kana.data?.[section] ?? []}
          />

          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="lg:flex-1">
              <KanaGrid
                section={section}
                chars={kana.data?.[section] ?? []}
                selected={selected?.char ?? null}
                onSelect={setSelected}
              />
            </div>
            <div className="lg:w-[300px] lg:shrink-0">
              <KanaDetail selected={selected} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
