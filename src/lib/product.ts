/**
 * The product's name, in one place.
 *
 * §12 Q3 is answered: a recruiter gives a resume about six seconds before
 * deciding, and every layout decision in this codebase — one column, no
 * decoration, parseable by machine first — exists to survive that. The name
 * says what the product is for rather than what category it is in.
 *
 * "Resume" stays in the name deliberately. It is the only search keyword the
 * brand carries, and it rides along in every page title through the metadata
 * template in `src/app/layout.tsx`.
 *
 * Everything that shows a name to a user reads it from here, and
 * `trust-signals.test.ts` fails the build if a page or component hardcodes it
 * instead.
 */
export const PRODUCT_NAME = "Six Seconds Resume";
