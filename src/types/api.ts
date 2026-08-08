/** Shared envelope shapes for the /api/v1 contract (PRD §14). */

export interface ApiErrorBody {
  message: string;
  errors?: Record<string, string[]>;
  code?: string;
  /** Extra context some flows render (e.g. attemptsRemaining, lockoutSeconds on CA3-e/CA4-e). */
  meta?: Record<string, unknown>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fieldErrors?: Record<string, string[]>;
  readonly meta?: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.fieldErrors = body.errors;
    this.meta = body.meta;
  }
}

export interface CursorPage<T> {
  data: T[];
  meta: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}
