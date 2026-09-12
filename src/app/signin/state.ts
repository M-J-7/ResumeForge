/**
 * The shape a sign-in action hands back to the form.
 *
 * Separate from `./actions.ts` because a `"use server"` module may only
 * export async functions — a plain object export there fails the build with
 * an error that names the file but not the export. Types are erased and
 * would have been fine; `EMPTY_SIGN_IN_STATE` is a real value and is not.
 */

export interface SignInState {
  error?: string;
}

/** `useActionState`'s initial value. */
export const EMPTY_SIGN_IN_STATE: SignInState = {};
