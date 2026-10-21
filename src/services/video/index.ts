import { DailyVideoProvider } from './DailyVideoProvider';
import { MockVideoProvider, type VideoProvider } from './VideoProvider';

export * from './VideoProvider';

const daily = new DailyVideoProvider();
const mock = new MockVideoProvider();

/**
 * The provider for one session, by the name the API returned with its token.
 * Against the mock API there is no real room, so the stand-in is used whatever
 * the session says.
 */
export function videoProviderFor(name: string): VideoProvider {
  if (import.meta.env.VITE_USE_API_MOCKS === 'true') return mock;
  if (name === 'daily') return daily;
  throw new VideoProviderUnsupportedError();
}

/** The server named a video service this build cannot drive — an app older
 *  than the backend, most likely. Updating is the honest instruction. */
export class VideoProviderUnsupportedError extends Error {
  constructor() {
    super('This version of the app cannot join this call. Please update the app and try again.');
    this.name = 'VideoProviderUnsupportedError';
  }
}
