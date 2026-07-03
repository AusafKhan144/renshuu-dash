import { useState } from "react";
import {
  useJlptAnalytics,
  useKaoHistory,
  useLeeches,
  useRetention,
  useRisk,
  useVectorAccuracy,
  useWorkload,
  type Termtype,
} from "../api/client";
import { JlptBreakdown } from "../components/JlptBreakdown";
import { KaoTimeline } from "../components/KaoTimeline";
import { LeechList } from "../components/LeechList";
import { MasteryHistogram } from "../components/MasteryHistogram";
import { RiskCard } from "../components/RiskCard";
import { TermDrilldown } from "../components/TermDrilldown";
import { VectorAccuracyCard } from "../components/VectorAccuracyCard";
import { WorkloadCalendar } from "../components/WorkloadCalendar";

export function InsightsPage() {
  const retention = useRetention(true);
  const vectors = useVectorAccuracy(undefined, true);
  const leeches = useLeeches(undefined, 20, true);
  const risk = useRisk(7, true);
  const jlpt = useJlptAnalytics(true);
  const workload = useWorkload(14, true);
  const kaoHistory = useKaoHistory(true);
  const [selected, setSelected] = useState<{ termtype: Termtype; term_id: string } | null>(null);

  const noneSynced = retention.data && Object.values(retention.data).every((r) => r.total === 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-[22px] font-bold">Insights</h1>
        <p className="mt-1 text-[12.5px] text-fg-faint">
          Retention, weak spots, and forgetting risk — built from every term you've ever studied.
        </p>
      </div>

      {noneSynced && (
        <div className="rounded-[14px] border border-card-border-strong bg-inset p-4 text-sm text-fg-muted">
          No synced term data yet. Run "Full term sync" from Settings to populate these insights —
          it walks your entire study history once, then stays current nightly.
        </div>
      )}

      {retention.data && <MasteryHistogram data={retention.data} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {vectors.data && <VectorAccuracyCard vectors={vectors.data} />}
        {leeches.data && <LeechList leeches={leeches.data} onSelect={(termtype, term_id) => setSelected({ termtype, term_id })} />}
      </div>

      {risk.data && <RiskCard data={risk.data} onSelect={(termtype, term_id) => setSelected({ termtype, term_id })} />}

      {workload.data && <WorkloadCalendar points={workload.data} />}

      {jlpt.data && <JlptBreakdown data={jlpt.data} />}

      {kaoHistory.data && <KaoTimeline history={kaoHistory.data} />}

      <TermDrilldown selected={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
