// The public hubs day-trip and weekend fit may use (relevance.md 5 rule 7). A hub must be on this list AND marked
// public in the matrix file. Add the others (Calgary, Las Vegas, Salt Lake City, ...) when Q19 is answered.
export const PUBLIC_HUBS: { id: string; name: string }[] = [{ id: "toronto", name: "Toronto City Hall" }];

export const isAllowedHub = (id: string): boolean => PUBLIC_HUBS.some((h) => h.id === id);
