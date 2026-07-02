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
