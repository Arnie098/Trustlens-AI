/**
 * UNESCO OCR — React Native TypeScript contract
 * Matches Flask POST /ocr response (D:\Hackaton\App\UNESCO\OCR\ocr-prototype).
 */

export type OcrAction = "accept" | "review" | "retake";

export type OcrErrorCode =
  | "blank_image"
  | "corrupt_image"
  | "empty_payload"
  | "image_too_large"
  | "image_too_small"
  | "unsupported_format"
  | "not_found"
  | "load_failed"
  | "ocr_failed"
  | "no_text"
  | "bad_request"
  | "unauthorized"
  | string;

/** Structured fields extracted by server regex. */
export interface OcrFields {
  date_iso?: string | null;
  date_slash?: string | null;
  id_alnum?: string | null;
  email?: string | null;
  amount?: string | null;
  [key: string]: string | null | undefined;
}

export interface OcrImageKind {
  document?: boolean;
  chat?: boolean;
  long_doc?: boolean;
  complex_layout?: boolean;
  low_contrast?: boolean;
  heavy_noise?: boolean;
}

export interface OcrMeta {
  preset?: string;
  preset_used?: string;
  psm?: number | null;
  psm_used?: number | null;
  lang?: string;
  lang_requested?: string;
  width?: number;
  height?: number;
  orientation_corrected_deg?: number;
  image_kind?: OcrImageKind;
  fast_path?: boolean;
  [key: string]: unknown;
}

/** Full JSON body from POST /ocr (success or business failure). */
export interface OcrResponse {
  ok: boolean;
  action: OcrAction;
  text: string;
  confidence: number;
  low_confidence: boolean;
  low_confidence_words: string[];
  fields: OcrFields;
  word_count: number;
  elapsed_ms: number;
  lang?: string | null;
  lang_requested?: string | null;
  error: string | null;
  error_code: OcrErrorCode | null;
  request_id: string;
  meta: OcrMeta;
}

export interface OcrRequestOptions {
  /** Defaults to server auto cascade. Prefer leaving as "auto". */
  preset?: string;
  /** Defaults to "auto" (eng/fil). Use "eng" for speed on English-only docs. */
  lang?: string;
  /** Page segmentation mode, or "auto". */
  psm?: number | "auto";
  /** Include server debug traces (dev only). */
  debug?: boolean;
  /** Correlation id; server generates one if omitted. */
  requestId?: string;
  /** Abort after this many ms (default 45000). */
  timeoutMs?: number;
}

export interface OcrClientConfig {
  /**
   * Base URL of the OCR service, no trailing slash.
   * Android emulator → http://10.0.2.2:5001
   * iOS simulator  → http://127.0.0.1:5001
   * Physical device → http://<your-lan-ip>:5001
   */
  baseUrl: string;
  /** Optional shared secret (header X-API-Key). */
  apiKey?: string;
  /** Default timeout for OCR (ms). */
  timeoutMs?: number;
}

export interface OcrHealth {
  status: string;
  service: string;
  version: string;
  ready?: boolean;
}

export interface OcrServiceMeta {
  service: string;
  version: string;
  input: {
    field: string;
    max_bytes: number;
    max_dimension_px: number;
    recommended_capture?: {
      quality: number;
      max_edge_px: number;
      format: string;
      tips: string[];
    };
  };
  defaults: {
    preset: string;
    lang: string;
    languages: string[];
  };
  actions: Record<OcrAction, string>;
  thresholds: { confidence: number; latency_warn_ms: number };
}
