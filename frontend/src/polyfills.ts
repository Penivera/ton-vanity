import { Buffer } from 'buffer';

declare global {
  interface Window {
    global?: typeof globalThis;
  }
}

if (typeof window !== 'undefined') {
  const windowWithPolyfills = window as Window & {
    process?: {
      env: Record<string, string | undefined>;
    };
  };

  window.Buffer = window.Buffer || Buffer;
  window.global = window;
  windowWithPolyfills.process = windowWithPolyfills.process || { env: {} };
}