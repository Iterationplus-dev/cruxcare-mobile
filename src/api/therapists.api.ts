import { apiClient } from './client';
import type { CursorPage } from '@/types/api';
import type { TherapistPlanOption } from '@/features/therapist/plans';
import type {
  CareEngagement,
  CareRequest,
  TherapistAvailabilityDay,
  SupportContact,
  TherapistGender,
  TherapistRota,
  TherapistSummary,
  WorkingDay,
} from '@/types/care';

export const therapistsApi = {
  /**
   * `gender` narrows the directory server-side. There is no "no preference"
   * value — omitting it returns everyone — and an off-list value is a 422
   * rather than a silently ignored filter.
   */
  async list(params: { cursor?: string; gender?: TherapistGender } = {}): Promise<
    CursorPage<TherapistSummary>
  > {
    const { data } = await apiClient.get<CursorPage<TherapistSummary>>('/therapists', {
      params: { cursor: params.cursor, gender: params.gender },
    });
    return data;
  },

  async get(id: string): Promise<TherapistSummary> {
    const { data } = await apiClient.get<TherapistSummary>(`/therapists/${id}`);
    return data;
  },

  /**
   * The signed-in therapist's own public profile — the same record clients
   * read. Resolved from the session, never from a therapist id supplied by the
   * client, so one therapist cannot read or edit another's profile.
   */
  async myProfile(): Promise<TherapistSummary> {
    const { data } = await apiClient.get<TherapistSummary>('/me/therapist/profile');
    return data;
  },

  /**
   * `specialties` is required, not optional: the server treats an omitted key
   * as a `422` rather than a clear, on the grounds that forgetting it is far
   * more likely a bug than an intention to wipe a therapist's profile. Sending
   * `[]` is how the list is cleared.
   */
  async updateMyProfile(patch: { specialties: string[] }): Promise<TherapistSummary> {
    const { data } = await apiClient.patch<TherapistSummary>('/me/therapist/profile', patch);
    return data;
  },

  /**
   * The plan catalogue, priced from `subscription_plans`.
   *
   * `amountMinor` is the same integer the activation charges, so the screen and
   * the charge cannot disagree — the prices used to be a hardcoded copy in the
   * app that would drift the day somebody edited the table.
   */
  async plans(): Promise<TherapistPlanOption[]> {
    const { data } = await apiClient.get<CursorPage<TherapistPlanOption>>('/therapist/plans');
    return data.data;
  },

  /**
   * The signed-in therapist's own working days.
   *
   * An empty list is the state every therapist starts in and means no rota has
   * been set — not a week of closed days. Nothing is bookable until it has one,
   * which is the point: before this existed the server assumed everybody kept
   * the same office hours and offered clients slots on days nobody worked.
   */
  async myAvailability(): Promise<TherapistRota> {
    const { data } = await apiClient.get<TherapistRota>('/me/therapist/availability');
    return data;
  },

  /** A PUT because it replaces the week: the days sent are the days stored, and
   *  `[]` genuinely clears the rota rather than being ignored as a no-op. */
  async updateMyAvailability(days: WorkingDay[]): Promise<TherapistRota> {
    const { data } = await apiClient.put<TherapistRota>('/me/therapist/availability', { days });
    return data;
  },

  /**
   * A therapist's open days across a range, for the booking calendar.
   *
   * Comes back empty when they have no rota, are fully booked, or have marked
   * themselves unavailable — all three mean "cannot be booked", and the
   * directory's `schedulePublished` is what tells the first apart from the
   * others.
   */
  async availability(id: string, from: string, to: string): Promise<TherapistAvailabilityDay[]> {
    const { data } = await apiClient.get<CursorPage<TherapistAvailabilityDay>>(
      `/therapists/${id}/availability`,
      { params: { from, to } },
    );
    return data.data;
  },

  /**
   * `therapistId` asks for that specific therapist, who is attached to the
   * case and notified. Omitted, it stays an open request for staff to match.
   *
   * Returns the created request in full so the tracking screen can show it
   * without a second round trip.
   */
  async requestAssignment(
    reason: string,
    therapistId?: string,
    preferredTherapistGender?: TherapistGender,
  ): Promise<CareRequest> {
    const { data } = await apiClient.post<CareRequest>('/care/requests', {
      reason,
      ...(therapistId ? { therapistId } : {}),
      // Only ever sent on an unassigned request, and the server ignores it
      // otherwise: a preference stored beside a therapist the client picked on
      // purpose would invite a reassignment to "correct" their own choice.
      ...(!therapistId && preferredTherapistGender ? { preferredTherapistGender } : {}),
    });
    return data;
  },

  /**
   * The one therapist this client is currently tied to, or null when they are
   * free to choose. `meta.mayChooseAnotherTherapist` is what gates the request
   * button; it is one call for the whole directory rather than one per card.
   */
  async engagement(): Promise<{
    engagement: CareEngagement | null;
    mayChoose: boolean;
    support: SupportContact | null;
  }> {
    const { data } = await apiClient.get<{
      data: CareEngagement | null;
      meta?: { mayChooseAnotherTherapist?: boolean; support?: SupportContact | null };
    }>('/care/engagement');
    return {
      engagement: data.data,
      // Absent reads as free rather than blocked: refusing to let someone ask
      // for care because a field is missing is the worse failure.
      mayChoose: data.meta?.mayChooseAnotherTherapist ?? !data.data,
      // Sent here as well as on the 409, so a client whose case cannot be ended
      // in the app gets the contact without first being refused.
      support: data.meta?.support ?? null,
    };
  },

  /**
   * Ends a working relationship and frees the client to choose again. Distinct
   * from `cancelRequest`, which withdraws a request nobody has accepted.
   *
   * Succeeds only while there is nothing to unpick. Once the therapist has
   * diagnosed, written a note, proposed a plan, recommended a product, started
   * treatment, held a session or been paid, it answers
   * `409 discontinue_needs_support` — see `supportFromError`.
   */
  async discontinueRequest(id: string): Promise<CareRequest> {
    const { data } = await apiClient.post<CareRequest>(`/care/requests/${id}/discontinue`);
    return data;
  },

  /** The client's own requests, newest first, so they can follow progress. */
  async listRequests(cursor?: string): Promise<CursorPage<CareRequest>> {
    const { data } = await apiClient.get<CursorPage<CareRequest>>('/care/requests', {
      params: { cursor },
    });
    return data;
  },

  async getRequest(id: string): Promise<CareRequest> {
    const { data } = await apiClient.get<CareRequest>(`/care/requests/${id}`);
    return data;
  },

  /** Withdraws a request that has not been accepted yet. */
  async cancelRequest(id: string): Promise<CareRequest> {
    const { data } = await apiClient.post<CareRequest>(`/care/requests/${id}/cancel`);
    return data;
  },
};
