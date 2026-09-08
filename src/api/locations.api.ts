import { apiClient } from './client';
import type { CursorPage } from '@/types/api';

/**
 * A place the platform knows about, for the registration selects.
 *
 * `id` is a string: the API sends `"126"`, not `126`, and coercing it would
 * only invite a mismatch when it is sent back.
 */
export interface LocationOption {
  id: string;
  name: string;
}

export interface CountryOption extends LocationOption {
  currencyCode: string;
}

/**
 * The country → state → city cascade.
 *
 * All three are readable without a token, which they have to be: registration
 * happens before there is a session, and a list behind auth renders as an empty
 * control. `/countries` reads the same switched-on list `/currencies` does, so
 * there is one definition rather than two that drift.
 *
 * Coverage is partial by design — an empty state or city list is a normal
 * answer, and the form falls back to a text field rather than treating it as a
 * failure.
 */
export const locationsApi = {
  async countries(): Promise<CountryOption[]> {
    // All three come back in the standard { data, meta } envelope, like every
    // other list on this API — not as a bare array.
    const { data } = await apiClient.get<CursorPage<CountryOption>>('/countries');
    return data.data;
  },

  async states(countryId: string): Promise<LocationOption[]> {
    const { data } = await apiClient.get<CursorPage<LocationOption>>(
      `/countries/${countryId}/states`,
    );
    return data.data;
  },

  async cities(stateId: string): Promise<LocationOption[]> {
    const { data } = await apiClient.get<CursorPage<LocationOption>>(`/states/${stateId}/cities`);
    return data.data;
  },
};
