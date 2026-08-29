import { apiClient } from './client';

/** A place the platform knows about, for the registration selects. */
export interface LocationOption {
  id: number;
  name: string;
}

/**
 * States and cities, for the country → state → city cascade.
 *
 * Active countries already come from `GET /currencies` — that list is the only
 * source of truth for which countries are switched on, so this deliberately
 * does not offer a second one.
 *
 * These two routes do not exist yet. The screens fall back to a plain text
 * field when a list comes back empty, so registration keeps working either way.
 */
export const locationsApi = {
  async states(countryId: number): Promise<LocationOption[]> {
    const { data } = await apiClient.get<LocationOption[]>(`/countries/${countryId}/states`);
    return data;
  },

  async cities(stateId: number): Promise<LocationOption[]> {
    const { data } = await apiClient.get<LocationOption[]>(`/states/${stateId}/cities`);
    return data;
  },
};
