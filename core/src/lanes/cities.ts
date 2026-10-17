// Cities over 500,000 people, by the name a base carries. A stopgap for the city-culture rule of plan 7.2 until places
// carry a population: the owner's own bases and the large cities on the trips so far. Names are compared folded and lower case.
const NAMES = [
  "toronto", "montreal", "calgary", "ottawa", "edmonton", "vancouver", "winnipeg", "mississauga",
  "new york", "los angeles", "chicago", "houston", "phoenix", "philadelphia", "san antonio", "san diego", "dallas", "san jose", "austin", "seattle", "denver", "boston", "washington", "las vegas", "portland", "salt lake city",
  "mexico city", "buenos aires", "santiago", "lima", "bogota", "sao paulo", "rio de janeiro",
  "london", "paris", "berlin", "madrid", "rome", "vienna", "hamburg", "budapest", "warsaw", "barcelona", "munich", "milan", "prague", "oslo", "stockholm", "copenhagen", "helsinki", "amsterdam", "lisbon", "dublin",
  "istanbul", "cairo", "nairobi", "cape town", "johannesburg",
  "tokyo", "osaka", "kyoto", "seoul", "beijing", "shanghai", "hong kong", "bangkok", "singapore", "kuala lumpur", "hanoi", "delhi", "mumbai", "sydney", "melbourne", "auckland",
];

const fold = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// near misses that must not trip the rule: under 500,000 people
const SMALL = new Set(["zurich", "geneva", "marrakech", "cusco", "edinburgh", "salt lake city", "quebec city"]);

export function isCityOver500k(name: string): boolean {
  const n = fold(name);
  if (SMALL.has(n)) return false;
  return NAMES.some((c) => !SMALL.has(c) && (n === c || n.startsWith(`${c},`) || n.startsWith(`${c} `)));
}
