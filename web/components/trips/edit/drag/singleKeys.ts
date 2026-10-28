// The one setting of the keyboard layer (patterns 1.3; WCAG 2.1.4): single-letter shortcuts on or off, kept on this device. On by default;
// the switch is in the `?` list. It turns off E, M, S, A and Delete together (L and Shift+M belong to the packages that build those actions).
import { readLocal, removeLocal, writeLocal } from '@/lib/storage/safe';

export const SINGLE_KEYS_KEY = 'travel.trip-edit.single-keys';
export const readSingleKeys = (): boolean => readLocal(SINGLE_KEYS_KEY) !== 'off';
export const writeSingleKeys = (on: boolean): void => void (on ? removeLocal(SINGLE_KEYS_KEY) : writeLocal(SINGLE_KEYS_KEY, 'off'));
