/** Shared envelope shapes for the /api/v1 contract (PRD §14). */
import { presentableMessage } from '@/utils/errorMessage';

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
  /** What the server actually said. For logs and bug reports — never rendered:
   *  `message` is the sanitised copy every screen shows. */
  readonly detail?: string;
  /** The server's id for this exact failure, present on 5xx. Shown to the user
   *  as something they can quote to support — it is the only part of a server
   *  error that is worth reading out. */
  readonly reference?: string;

  constructor(status: number, body: ApiErrorBody, reference?: string) {
    // Sanitised here rather than at each catch site: a screen that renders
    // `error.message` cannot leak a stack trace or a SQL statement by omission.
    super(presentableMessage(status, body.message));
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.fieldErrors = body.errors;
    this.meta = body.meta;
    this.detail = body.message?.trim() || undefined;
    this.reference =
      reference ?? (typeof body.meta?.errorId === 'string' ? body.meta.errorId : undefined);
  }
}

export interface CursorPage<T> {
  data: T[];
  meta: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}
