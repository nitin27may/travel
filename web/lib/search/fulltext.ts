// The full-text pass (backlog 3.60, the SQ2s recommendation). When the parser leaves words over, the list used to look for them as a
// substring of the place's name, area and tags and show nothing when none matched. This ranks the places by BM25 over the text a place
// card already shows (name, kind, area chain, the one-line summary, tag labels) and offers those instead of an empty list.
//
// P8: the index is scoped files, one per list row file (a country, or 300 rows of a large one), never one catalogue file; it holds
// stemmed terms with counts, not the sentences. P9: `searchTexts` is the shape of a server call, and a server step replaces the files.
// The terms rule, the index and the BM25 scorer live in core/src/search/bm25.ts (store.ts A28, review API3-R-8): one copy for the server,
// the stub and these static files.
export {
  buildTextIndex, cardText, queryTerms, searchTexts, stem, terms,
  type TextHit, type TextIndex,
} from '@travel/core/search/bm25.ts';
