/**
 * tokenize.mjs
 * Wraps @anthropic-ai/tokenizer for Claude-BPE-compatible token counting.
 * Multiplier: 1.0
 *
 * CONTRACT: export { countTokens }
 *   countTokens(text: string) => number
 *
 * Chosen package: @anthropic-ai/tokenizer — native Claude tokenizer available on npm,
 * so no cl100k_base safety multiplier is needed.
 */

import { createRequire } from 'node:module';

let _encoder = null;
let _loadFailed = false;

function fallbackCount(text) {
  return Math.ceil(String(text ?? '').length / 4);
}

function loadEncoder() {
  if (_encoder || _loadFailed) {
    return _encoder;
  }

  try {
    const require = createRequire(import.meta.url);
    const mod = require('@anthropic-ai/tokenizer');
    const countTokens = mod?.countTokens;

    if (typeof countTokens !== 'function') {
      throw new Error('Invalid tokenizer export: expected countTokens function');
    }

    _encoder = countTokens;
    return _encoder;
  } catch (error) {
    _loadFailed = true;
    console.warn(
      '[harness.capsule-format] Failed to load @anthropic-ai/tokenizer; falling back to a character estimate.',
      error,
    );
    return null;
  }
}

/**
 * Count tokens in `text` using Claude-compatible BPE.
 * @param {string} text
 * @returns {number}
 */
export function countTokens(text) {
  const encoder = loadEncoder();
  if (encoder) {
    try {
      const value = encoder(String(text ?? ''));
      return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : fallbackCount(text);
    } catch (error) {
      console.warn(
        '[harness.capsule-format] Tokenizer error; falling back to a character estimate.',
        error,
      );
    }
  }

  return fallbackCount(text);
}