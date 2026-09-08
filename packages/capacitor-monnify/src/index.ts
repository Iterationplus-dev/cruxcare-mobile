import { registerPlugin } from '@capacitor/core';
import type { MonnifyPlugin } from './definitions';

/**
 * The web implementation is loaded lazily so a native build never pulls
 * Monnify's browser SDK loader into its bundle.
 */
const Monnify = registerPlugin<MonnifyPlugin>('Monnify', {
  web: () => import('./web').then((module) => new module.MonnifyWeb()),
});

export * from './definitions';
export { Monnify };
