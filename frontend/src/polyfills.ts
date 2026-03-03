// Polyfill for Node.js modules in browser environment
import { Buffer } from 'buffer';

// Set Buffer on globalThis
(globalThis as any).Buffer = Buffer;

// Set up process object
if (!(globalThis as any).process) {
  (globalThis as any).process = {
    env: {
      NODE_ENV: 'development',
    },
    browser: true,
    version: '',
    versions: {
      node: '0.0.0'
    },
    nextTick: (cb: any) => Promise.resolve().then(cb),
    cwd: () => '/',
  };
}

// Ensure crypto is available
if (!(globalThis as any).crypto && typeof window !== 'undefined') {
  (globalThis as any).crypto = window.crypto || {
    getRandomValues: (arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }
  };
}

