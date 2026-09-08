import { describe, expect, it } from 'vitest';
import {
  APPOINTMENT_TABS,
  appointmentsInTab,
  countForTab,
  outcomeLabel,
  tabFor,
} from '@/features/therapist/appointmentTabs';
import type { Appointment, AppointmentStatus } from '@/types/care';

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'appt-1',
    clientId: 'user-1',
    clientName: 'Sandra Adams',
    therapistId: 'therapist-1',
    therapistName: 'Dr. Lamba',
    slot: '2026-09-01T10:00:00Z',
    type: 'video',
    status: 'requested',
    reason: null,
    cancellationCutoff: null,
    ...overrides,
  };
}

describe('tabFor', () => {
  it('routes each status to exactly one tab', () => {
    const cases: [AppointmentStatus, string][] = [
      ['requested', 'requests'],
      ['confirmed', 'confirmed'],
      ['completed', 'past'],
      ['cancelled', 'past'],
      ['no-show', 'past'],
    ];

    for (const [status, tab] of cases) {
      expect(tabFor({ status })).toBe(tab);
    }
  });

  it('covers every tab the screen renders', () => {
    // Guards against a tab existing with nothing that can ever land in it.
    const reachable = new Set(
      (['requested', 'confirmed', 'completed'] as AppointmentStatus[]).map((status) =>
        tabFor({ status }),
      ),
    );

    expect(APPOINTMENT_TABS.every((t) => reachable.has(t.value))).toBe(true);
  });
});

describe('counts', () => {
  const all = [
    appointment({ id: 'a', status: 'requested' }),
    appointment({ id: 'b', status: 'requested' }),
    appointment({ id: 'c', status: 'confirmed' }),
    appointment({ id: 'd', status: 'cancelled' }),
    appointment({ id: 'e', status: 'no-show' }),
  ];

  it('counts each tab', () => {
    expect(countForTab(all, 'requests')).toBe(2);
    expect(countForTab(all, 'confirmed')).toBe(1);
    expect(countForTab(all, 'past')).toBe(2);
  });

  it('partitions — the three counts account for every appointment', () => {
    const total =
      countForTab(all, 'requests') + countForTab(all, 'confirmed') + countForTab(all, 'past');

    expect(total).toBe(all.length);
  });

  it('counts nothing before the list has loaded', () => {
    expect(countForTab(undefined, 'requests')).toBe(0);
  });
});

describe('ordering', () => {
  it('puts the soonest request first — that is the one being decided', () => {
    const rows = appointmentsInTab(
      [
        appointment({ id: 'later', slot: '2026-09-10T10:00:00Z' }),
        appointment({ id: 'sooner', slot: '2026-09-02T10:00:00Z' }),
      ],
      'requests',
    );

    expect(rows.map((r) => r.id)).toEqual(['sooner', 'later']);
  });

  it('puts the most recent past appointment first', () => {
    const rows = appointmentsInTab(
      [
        appointment({ id: 'old', status: 'completed', slot: '2026-07-01T10:00:00Z' }),
        appointment({ id: 'recent', status: 'completed', slot: '2026-08-20T10:00:00Z' }),
      ],
      'past',
    );

    expect(rows.map((r) => r.id)).toEqual(['recent', 'old']);
  });
});

describe('outcomeLabel', () => {
  it('names a finished outcome so a no-show does not read as a session', () => {
    expect(outcomeLabel({ status: 'completed' })).toBe('Completed');
    expect(outcomeLabel({ status: 'no-show' })).toBe('No-show');
    expect(outcomeLabel({ status: 'cancelled' })).toBe('Cancelled');
  });

  it('says nothing about an appointment still in play', () => {
    expect(outcomeLabel({ status: 'requested' })).toBeNull();
    expect(outcomeLabel({ status: 'confirmed' })).toBeNull();
  });
});
