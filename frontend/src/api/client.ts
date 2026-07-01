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
