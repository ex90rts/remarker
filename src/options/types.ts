export type TabKey =
  | "footprints"
  | "highlights"
  | "vocabulary"
  | "translations"
  | "settings"
  | "about";

export type ToastSeverity = "success" | "error";

export interface SourceFilterNavigation {
  tab: "highlights" | "vocabulary" | "translations";
  keyword: string;
  token: number;
}

export interface ToastState {
  id: number;
  message: string;
  severity: ToastSeverity;
  durationMs?: number;
}

export type Notify = (
  message: string,
  severity?: ToastSeverity,
  durationMs?: number,
) => void;

export type RunAction = (
  action: () => Promise<void> | void,
  successMessage?: string,
) => Promise<void>;
