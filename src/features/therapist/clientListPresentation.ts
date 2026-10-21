import type { CaseFile } from '@/types/care';

/**
 * How one row of the therapist's Clients list reads (TD4).
 *
 * An unwritten note replaces the summary rather than joining it: it is the one
 * thing on that row the therapist has to act on, and burying it behind a
 * session count is how it stays unwritten. Everything else is a summary of the
 * relationship, joined in the order the design draws it.
 */
export interface ClientRowPresentation {
  subtitle: string;
  /** `attention` when the row is asking the therapist to do something. */
  tone: 'default' | 'attention';
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/* en-GB, not en-US: the design writes "30 Jul" and "10:00", day before month
   and 24-hour. Times stay in the therapist's own zone — a session time is only
   useful as the time they will turn up. */
function time(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function dayAndMonth(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** "next today 10:00" when it is today, otherwise "next 19 Aug 09:00". */
export function formatNextSession(iso: string, now: Date): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return sameDay(at, now) ? `next today ${time(at)}` : `next ${dayAndMonth(at)} ${time(at)}`;
}

export function presentClientRow(caseFile: CaseFile, now: Date = new Date()): ClientRowPresentation {
  if (caseFile.unwrittenNoteFrom) {
    const from = new Date(caseFile.unwrittenNoteFrom);
    return {
      subtitle: Number.isNaN(from.getTime())
        ? 'Note unwritten'
        : `Note unwritten from ${dayAndMonth(from)}`,
      tone: 'attention',
    };
  }

  const parts: string[] = [];

  /**
   * "No sessions yet", not "0 sessions".
   *
   * A newly accepted client has nothing to count, and a caseload of them read
   * as a column of zeroes — a figure where a state belongs. The zero is also
   * the one session count that is never the therapist's record of anything; it
   * is the absence of one, and the copy says so.
   */
  const sessions = caseFile.sessionCount ?? 0;
  parts.push(sessions === 0 ? 'No sessions yet' : `${sessions} ${sessions === 1 ? 'session' : 'sessions'}`);

  if (caseFile.nextSessionAt) {
    const next = formatNextSession(caseFile.nextSessionAt, now);
    if (next) parts.push(next);
  }

  return { subtitle: parts.join(' · '), tone: 'default' };
}
