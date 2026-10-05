import type { ScrambleTask } from '../../domain/entities/writing-task.entity';

type ScrambleRound = ScrambleTask['rounds'][number];

/** Lowercased, without final punctuation and extra spaces: two sentences are the same if this matches. */
export const normalizeOrder = (text: string): string =>
  text.toLowerCase().replace(/[.!?]+$/, '').replace(/\s+/g, ' ').trim();

/**
 * Splits a word order sentence into tiles. The first word is lowercased (unless it is "I")
 * so its capital letter does not give the answer away. Returns null for unusable sentences.
 */
export function toScrambleRound(sentence: string, hint: string): Omit<ScrambleRound, 'id'> | null {
  const end = sentence.match(/[.!?]+$/)?.[0] ?? '.';
  const words = sentence.replace(/[.!?]+$/, '').split(/\s+/).filter(Boolean);
  if (words.length < 3 || words.length > 15 || !hint) return null;
  if (/[,;:"“”()]/.test(sentence)) return null;
  if (!/^I($|')/.test(words[0])) words[0] = words[0].toLowerCase();
  return { sentence, hint, words, end };
}
