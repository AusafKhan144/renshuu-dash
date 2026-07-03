import axios from "axios";
import { useQuery } from "@tanstack/react-query";

// withCredentials so the HttpOnly session cookie rides along (also in dev,
// where the SPA and API are different origins).
export const api = axios.create({ baseURL: "/api", withCredentials: true });

// When any request comes back 401 (session missing/expired), notify listeners
// so the app can drop back to the login screen.
const unauthorizedListeners = new Set<() => void>();

export function onUnauthorized(cb: () => void) {
  unauthorizedListeners.add(cb);
  return () => {
    unauthorizedListeners.delete(cb);
  };
}

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) {
      unauthorizedListeners.forEach((cb) => cb());
    }
    return Promise.reject(error);
  }
);

// --- types ----------------------------------------------------------------

export interface AuthStatus {
  auth_required: boolean;
  authenticated: boolean;
}

export interface SetupStatus {
  configured: boolean;
  push_enabled: boolean;
  daily_goal: number;
  account: { name: string | null } | null;
  digest_enabled: boolean;
  streak_check_enabled: boolean;
}

export interface Overview {
  account_name: string | null;
  totals: {
    total: number | null;
    vocab: number | null;
    kanji: number | null;
    grammar: number | null;
    sentences: number | null;
  };
  weekly_delta: {
    total: number | null;
    vocab: number | null;
    kanji: number | null;
    grammar: number | null;
    sentences: number | null;
  };
  streaks: Record<string, unknown>;
  jlpt: Record<string, Record<string, number>>;
  level: number;
  level_title: string;
  adventure_level: number | null;
  kao_url: string | null;
  xp: { current: number; floor: number; next: number; pct: number };
  daily: { goal: number; progress: number; reviews_due: number };
  insights: string[];
  as_of: string | null;
}

export interface Achievement {
  id: string;
  name: string;
  hue: "amber" | "teal" | "violet" | "rose" | "success";
  earned: boolean;
  fresh: boolean;
  claimed: boolean;
  progress: number;
}

export interface UpcomingDay {
  days_in_future: string;
  terms_to_review: string;
}

export interface Schedule {
  id: string;
  name: string;
  booktype: string;
  review_due: number;
  new_available: number;
  terms: { total_count?: number; studied_count?: number };
  upcoming: UpcomingDay[];
}

export interface SchedulesResponse {
  schedules: Schedule[];
  total_review_due: number;
}

export interface HistoryResponse {
  metric: string;
  days: number;
  points: { day: string; value: number | null }[];
}

export interface ActivityResponse {
  days: number;
  points: { day: string; learned: number }[];
}

export interface WordResult {
  id: string;
  kanji_full?: string;
  hiragana_full?: string;
  def?: string[];
  [key: string]: unknown;
}

export interface KanjiResult {
  id: string;
  kanji: string;
  definition: string;
  onyomi?: string;
  kunyomi?: string;
  [key: string]: unknown;
}

export interface GrammarResult {
  grammar_id: string;
  title_english?: string;
  title_japanese?: string;
  url?: string;
  [key: string]: unknown;
}

export type LookupResult =
  | { type: "word"; found: boolean; word: WordResult | null; note: string | null }
  | { type: "kanji"; found: boolean; available: boolean; kanjis?: KanjiResult[]; error?: string }
  | { type: "grammar"; found: boolean; available: boolean; grammar?: GrammarResult[]; error?: string };

export interface ListSummary {
  id: string;
  title: string;
  termtype: string;
  description: string;
  privacy: string;
}

export interface ListWord {
  id: string;
  kanji_full: string;
  hiragana_full: string;
  def: string[];
  mastery: number;
}

export interface ListDetail {
  id: string;
  title: string;
  termtype: string;
  page: number;
  total_pages: number;
  words: ListWord[];
}

export interface SpotlightWord {
  word_id: string;
  kanji_full: string;
  hiragana_full: string;
  def: string;
  mastery: number;
}

export interface KanaStudyVector {
  correct_count: number;
  missed_count: number;
  mastery_perc: number;
  last_quizzed: string | null;
  next_quiz: string | null;
}

export interface KanaDetail {
  id: string;
  def: string;
  correct_count: number;
  missed_count: number;
  study_vectors: Record<string, KanaStudyVector>;
}

export interface KanaChar {
  char: string;
  score: number;
  delta: number | null;
  detail: KanaDetail | null;
}

export interface UsageResponse {
  calls_today: number | null;
  daily_allowance: number;
  remaining: number | null;
  ts: string | null;
}

// --- Phase 1/2/3: term-sync analytics types --------------------------------

export type Termtype = "vocab" | "kanji" | "grammar" | "sent";

export interface KaoHistoryEntry {
  kao_url: string;
  first_seen: string;
  adventure_level: number | null;
}

export interface RetentionTermtype {
  total: number;
  avg_mastery: number;
  histogram: Record<string, number> | null;
  trend: { day: string; avg_mastery: number }[];
}

export type RetentionResponse = Record<Termtype, RetentionTermtype>;

export interface VectorAccuracy {
  name: string;
  correct: number;
  missed: number;
  accuracy_pct: number;
}

export interface Leech {
  termtype: Termtype;
  term_id: string;
  display: string | null;
  reading: string | null;
  definition: string | null;
  jlpt: string | null;
  mastery: number;
  correct: number;
  missed: number;
  score: number;
}

export interface RiskEntry {
  termtype: Termtype;
  term_id: string;
  display: string | null;
  jlpt: string | null;
  mastery: number;
  next_quiz: string;
}

export interface RiskResponse {
  overdue: RiskEntry[];
  overdue_count: number;
  due_soon: RiskEntry[];
  due_soon_count: number;
}

export type JlptBreakdownResponse = Partial<
  Record<Termtype, Record<string, { studied: number; avg_mastery: number; mastered: number; weak: number }>>
>;

export interface TermRow {
  termtype: Termtype;
  term_id: string;
  display: string | null;
  reading: string | null;
  definition: string | null;
  jlpt: string | null;
  mastery: number;
  correct: number;
  missed: number;
}

export interface TermsResponse {
  page: number;
  total_pages: number;
  total: number;
  terms: TermRow[];
}

export interface TermDetail extends TermRow {
  vectors: Record<string, KanaStudyVector>;
  payload: Record<string, unknown>;
  history: { day: string; mastery: number; correct: number; missed: number }[];
}

export interface SyncTermsResult {
  complete: boolean;
  calls_used?: number;
  error?: string;
}

// --- Phase 3: pace forecasting, workload, grammar/sentence parity ---------

export interface PaceLevel {
  level: string;
  studied: number;
  target: number;
  pct: number;
  pace_per_day: number | null;
  pace_source: "synced" | "fallback" | null;
  eta_date: string | null;
  mastery_weighted_eta_date: string | null;
}

export type PaceResponse = { per_termtype: Record<Termtype, PaceLevel[]> };

export interface WorkloadPoint {
  date: string;
  days_out: number;
  terms_to_review: number;
}

export interface JlptHistoryPoint {
  day: string;
  value: number | null;
}

export interface Reibun {
  id: number;
  japanese: string;
  hiragana: string;
  meaning: { en?: string; eng?: string };
}

export interface SentencesResponse {
  result_count: number;
  reibuns: Reibun[];
}

export interface GrammarModel {
  japanese: string;
  hiragana: string;
  meanings: { en?: string; eng?: string };
}

export interface GrammarDetailResponse {
  grammar_id: string;
  title_japanese?: string;
  title_english?: string;
  url?: string;
  construct?: string;
  meaning?: { en?: string };
  meaning_long?: { en?: string };
  models?: GrammarModel[];
}

/** Highest streak value across categories (Renshuu tracks one per category). */
export function pickStreak(
  streaks: Record<string, unknown>,
  field: string = "days_studied_in_a_row"
): number | null {
  const vals = Object.values(streaks ?? {})
    .map((cat) =>
      typeof cat === "object" && cat
        ? Number((cat as Record<string, unknown>)[field])
        : NaN
    )
    .filter((n) => Number.isFinite(n));
  return vals.length ? Math.max(...vals) : null;
}

// --- queries --------------------------------------------------------------

export function useAuthStatus() {
  return useQuery({
    queryKey: ["auth-status"],
    queryFn: async () => (await api.get<AuthStatus>("/auth/status")).data,
    retry: false,
  });
}

export async function login(password: string) {
  await api.post("/auth/login", { password });
}

export async function logout() {
  await api.post("/auth/logout");
}

export function useSetupStatus(enabled: boolean) {
  return useQuery({
    queryKey: ["setup-status"],
    enabled,
    queryFn: async () => (await api.get<SetupStatus>("/setup/status")).data,
  });
}

export function useOverview(enabled: boolean) {
  return useQuery({
    queryKey: ["overview"],
    enabled,
    queryFn: async () => (await api.get<Overview>("/overview")).data,
  });
}

export function useSchedules(enabled: boolean) {
  return useQuery({
    queryKey: ["schedules"],
    enabled,
    refetchInterval: 5 * 60_000,
    queryFn: async () => (await api.get<SchedulesResponse>("/schedules")).data,
  });
}

export function useHistory(metric: string, days: number, enabled: boolean) {
  return useQuery({
    queryKey: ["history", metric, days],
    enabled,
    queryFn: async () =>
      (await api.get<HistoryResponse>("/history", { params: { metric, days } }))
        .data,
  });
}

export function useActivity(days: number, enabled: boolean) {
  return useQuery({
    queryKey: ["activity", days],
    enabled,
    queryFn: async () =>
      (await api.get<ActivityResponse>("/activity", { params: { days } })).data,
  });
}

export function useAchievements(enabled: boolean) {
  return useQuery({
    queryKey: ["achievements"],
    enabled,
    queryFn: async () =>
      (await api.get<{ achievements: Achievement[] }>("/achievements")).data
        .achievements,
  });
}

export async function claimAchievement(id: string) {
  await api.post(`/achievements/${id}/claim`);
}

export async function setDailyGoal(goal: number) {
  await api.post("/setup/daily-goal", { goal });
}

export async function setDigestEnabled(on: boolean) {
  await api.post("/setup/digest", { on });
}

export async function setStreakCheckEnabled(on: boolean) {
  await api.post("/setup/streak-check", { on });
}

/** On-demand dictionary search — fires a live Renshuu call and advances usage. */
export function useLookup(type: "word" | "kanji" | "grammar", q: string, enabled: boolean) {
  const query = q.trim();
  return useQuery({
    queryKey: ["lookup", type, query],
    enabled: enabled && query.length > 0,
    queryFn: async () =>
      (await api.get<LookupResult>("/lookup", { params: { type, q: query } })).data,
  });
}

export function useLists(enabled: boolean) {
  return useQuery({
    queryKey: ["lists"],
    enabled,
    queryFn: async () => (await api.get<{ lists: ListSummary[] }>("/lists")).data.lists,
  });
}

export function useListWords(listId: string | null, page: number, enabled: boolean) {
  return useQuery({
    queryKey: ["list", listId, page],
    enabled: enabled && !!listId,
    queryFn: async () =>
      (await api.get<ListDetail>(`/lists/${listId}`, { params: { page } })).data,
  });
}

/** Snapshot-backed — no live call, safe to fetch on every dashboard load. */
export function useSpotlight(enabled: boolean) {
  return useQuery({
    queryKey: ["spotlight"],
    enabled,
    queryFn: async () => (await api.get<{ words: SpotlightWord[] }>("/spotlight")).data.words,
  });
}

/** Snapshot-backed per-kana/kanji mastery, keyed by section (hiragana/katakana/kanji). */
export function useKana(enabled: boolean) {
  return useQuery({
    queryKey: ["kana"],
    enabled,
    queryFn: async () =>
      (await api.get<{ sections: Record<string, KanaChar[]> }>("/kana")).data.sections,
  });
}

/** Renshuu's own daily usage counter — for the sidebar footer and refresh gate. */
export function useUsage(enabled: boolean) {
  return useQuery({
    queryKey: ["usage"],
    enabled,
    queryFn: async () => (await api.get<UsageResponse>("/usage")).data,
  });
}

export async function saveWord(listId: string, wordId: string) {
  await api.post(`/lists/${listId}/words`, { word_id: wordId });
}

export async function removeWord(listId: string, wordId: string) {
  await api.delete(`/lists/${listId}/words/${wordId}`);
}

// --- Phase 1/2/3: term-sync analytics hooks --------------------------------

/** Kao's growth timeline — distinct mascot images captured over time. */
export function useKaoHistory(enabled: boolean) {
  return useQuery({
    queryKey: ["kao-history"],
    enabled,
    queryFn: async () => (await api.get<{ history: KaoHistoryEntry[] }>("/kao/history")).data.history,
  });
}

/** Kicks off a full per-term sync (Settings page button) — a live call that
 * can advance daily usage significantly; resumable if quota runs out. */
export async function syncTerms(): Promise<SyncTermsResult> {
  return (await api.post<SyncTermsResult>("/sync/terms")).data;
}

export function useRetention(enabled: boolean) {
  return useQuery({
    queryKey: ["analytics", "retention"],
    enabled,
    queryFn: async () => (await api.get<RetentionResponse>("/analytics/retention")).data,
  });
}

export function useVectorAccuracy(termtype: Termtype | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["analytics", "vectors", termtype],
    enabled,
    queryFn: async () =>
      (await api.get<{ vectors: VectorAccuracy[] }>("/analytics/vectors", { params: { termtype } })).data
        .vectors,
  });
}

export function useLeeches(termtype: Termtype | undefined, limit: number, enabled: boolean) {
  return useQuery({
    queryKey: ["analytics", "leeches", termtype, limit],
    enabled,
    queryFn: async () =>
      (await api.get<{ leeches: Leech[] }>("/analytics/leeches", { params: { termtype, limit } })).data
        .leeches,
  });
}

export function useRisk(days: number, enabled: boolean) {
  return useQuery({
    queryKey: ["analytics", "risk", days],
    enabled,
    queryFn: async () => (await api.get<RiskResponse>("/analytics/risk", { params: { days } })).data,
  });
}

export function useJlptAnalytics(enabled: boolean) {
  return useQuery({
    queryKey: ["analytics", "jlpt"],
    enabled,
    queryFn: async () => (await api.get<JlptBreakdownResponse>("/analytics/jlpt")).data,
  });
}

export function useTerms(
  params: { termtype?: Termtype; jlpt?: string; sort?: string; q?: string; page?: number },
  enabled: boolean
) {
  return useQuery({
    queryKey: ["terms", params],
    enabled,
    queryFn: async () => (await api.get<TermsResponse>("/terms", { params })).data,
  });
}

export function useTermDetail(termtype: Termtype | null, termId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["term", termtype, termId],
    enabled: enabled && !!termtype && !!termId,
    queryFn: async () => (await api.get<TermDetail>(`/terms/${termtype}/${termId}`)).data,
  });
}

export function usePace(enabled: boolean) {
  return useQuery({
    queryKey: ["analytics", "pace"],
    enabled,
    queryFn: async () => (await api.get<PaceResponse>("/analytics/pace")).data.per_termtype,
  });
}

export function useWorkload(days: number, enabled: boolean) {
  return useQuery({
    queryKey: ["analytics", "workload", days],
    enabled,
    queryFn: async () =>
      (await api.get<{ days: number; points: WorkloadPoint[] }>("/analytics/workload", { params: { days } }))
        .data.points,
  });
}

export function useJlptHistory(cat: string, level: string, days: number, enabled: boolean) {
  return useQuery({
    queryKey: ["history", "jlpt", cat, level, days],
    enabled,
    queryFn: async () =>
      (await api.get<{ points: JlptHistoryPoint[] }>("/history/jlpt", { params: { cat, level, days } })).data
        .points,
  });
}

/** Live grammar-point detail — cached server-side 30 days, so repeat opens
 * of the same grammar point don't advance daily usage. */
export function useGrammarDetail(grammarId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["grammar", grammarId],
    enabled: enabled && !!grammarId,
    queryFn: async () => (await api.get<GrammarDetailResponse>(`/grammar/${grammarId}`)).data,
  });
}

/** Live example sentences for a word — cached server-side 30 days. */
export function useSentences(wordId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["sentences", wordId],
    enabled: enabled && !!wordId,
    queryFn: async () =>
      (await api.get<SentencesResponse>("/sentences", { params: { word_id: wordId } })).data,
  });
}
