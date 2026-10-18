/** "This Photo was taken by Wolfgang Moroder" -> "Wolfgang Moroder". */
export const cleanAuthor = (a) => String(a ?? '').replace(/<[^>]*>/g, '').replace(/^\s*(?:this\s+)?(?:photo|picture|image)?\s*(?:was\s+)?(?:taken|made|shot|created)?\s*by\s+/i, '').replace(/^\s*(?:photo|picture|image)\s*[:\-]\s*/i, '').replace(/^\s*(?:©|\(c\))\s*/i, '').replace(/\s+/g, ' ').trim();
