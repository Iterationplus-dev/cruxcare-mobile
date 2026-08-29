import { apiClient } from './client';

/** A place the platform knows about, for the registration selects. */
export interface LocationOption {
  id: number;
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
    const { data } = await apiClient.get<CountryOption[]>('/countries');
    return data;
  },

  async states(countryId: number): Promise<LocationOption[]> {
    const { data } = await apiClient.get<LocationOption[]>(`/countries/${countryId}/states`);
    return data;
  },

  async cities(stateId: number): Promise<LocationOption[]> {
    const { data } = await apiClient.get<LocationOption[]>(`/states/${stateId}/cities`);
    return data;
  },
};
