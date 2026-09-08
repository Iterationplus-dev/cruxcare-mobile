import { describe, expect, it } from 'vitest';
import { presentableMessage } from '@/utils/errorMessage';
import { ApiError } from '@/types/api';

const SQL_LEAK =
  "SQLSTATE[42S02]: Base table or view not found: 1146 Table 'cruxcare_dev.therapist_ratings' doesn't exist " +
  '(Connection: mysql, Host: 127.0.0.1, Port: 3306, Database: cruxcare_dev, SQL: select `score` from ' +
  '`therapist_ratings` where `appointment_id` = 25 and `client_id` = 1281 limit 1)';

describe('presentableMessage', () => {
  it('never repeats the server’s own words for a 5xx', () => {
    // The real one from accepting an appointment: schema, host, port and the
    // query itself, rendered to a therapist in a sheet.
    const shown = presentableMessage(500, SQL_LEAK);
    expect(shown).not.toContain('SQLSTATE');
    expect(shown).not.toContain('therapist_ratings');
    expect(shown).toContain('Nothing has been changed');
  });

  it('keeps a message written for a person', () => {
    expect(presentableMessage(422, 'That slot was taken while you were deciding.')).toBe(
      'That slot was taken while you were deciding.',
    );
    expect(presentableMessage(403, 'Your therapist plan has expired.')).toBe(
      'Your therapist plan has expired.',
    );
  });

  it('drops technical text even on a status that usually carries prose', () => {
    const technical = [
      'SQLSTATE[23000]: Integrity constraint violation',
      'Call to a member function score() on null',
      'Undefined array key "score"',
      'Illuminate\\Database\\QueryException',
      'Uncaught exception in AppointmentController',
      '/var/www/app/Http/Controllers/AppointmentController.php on line 88',
      'select `score` from `therapist_ratings` where `id` = 1',
    ];
    for (const message of technical) {
      expect(presentableMessage(422, message)).toBe('Something went wrong. Please try again.');
    }
  });

  it('drops a dump that carries no keyword at all', () => {
    expect(presentableMessage(400, 'a'.repeat(300))).toBe('Something went wrong. Please try again.');
    expect(presentableMessage(400, 'Line one\nline two')).toBe(
      'Something went wrong. Please try again.',
    );
  });

  it('falls back when there is nothing to show', () => {
    expect(presentableMessage(400, undefined)).toBe('Something went wrong. Please try again.');
    expect(presentableMessage(400, '   ')).toBe('Something went wrong. Please try again.');
  });
});

describe('ApiError', () => {
  it('renders the sanitised message and keeps the original for logs', () => {
    const error = new ApiError(500, { message: SQL_LEAK });

    expect(error.message).not.toContain('SQLSTATE');
    expect(error.detail).toBe(SQL_LEAK);
  });

  it('carries the server error id so the user has something to quote', () => {
    const fromMeta = new ApiError(500, { message: SQL_LEAK, meta: { errorId: 'D250B5A6D5BA' } });
    const fromHeader = new ApiError(503, { message: 'Service Unavailable' }, 'A1B2C3D4E5F6');

    expect(fromMeta.reference).toBe('D250B5A6D5BA');
    expect(fromHeader.reference).toBe('A1B2C3D4E5F6');
    // A 4xx written for a person has nothing to correlate.
    expect(new ApiError(422, { message: 'Check the highlighted fields.' }).reference).toBeUndefined();
  });

  it('leaves a human message and its field errors alone', () => {
    const error = new ApiError(422, {
      message: 'Check the highlighted fields.',
      errors: { email: ['That email is already registered.'] },
    });

    expect(error.message).toBe('Check the highlighted fields.');
    expect(error.fieldErrors?.email).toEqual(['That email is already registered.']);
  });
});
