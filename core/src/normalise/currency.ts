// Currency to ISO 4217 (S1). The price schema already requires three capitals; this rule upper-cases a code written otherwise
// ("cad", " CAD "), maps the symbols that mean one currency only, and reports a code that is not an active ISO 4217 code.
// "$", "kr" and "¥" name several currencies and are reported, never guessed.

/** Active ISO 4217 alphabetic codes (list one of the standard, 2025). */
export const ISO_4217: ReadonlySet<string> = new Set(
  ("AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XOF XPF YER ZAR ZMW ZWG").split(" "),
);

const SYMBOLS: Readonly<Record<string, string>> = { "€": "EUR", "£": "GBP", "C$": "CAD", "CA$": "CAD", "US$": "USD", "A$": "AUD", "NZ$": "NZD", "CHF": "CHF" };

export interface CurrencyResult {
  /** the ISO code, or null when the text names no single active currency */
  code: string | null;
}

export function normaliseCurrency(text: string): CurrencyResult {
  const s = text.trim();
  if (SYMBOLS[s]) return { code: SYMBOLS[s]! };
  const up = s.toUpperCase();
  return { code: /^[A-Z]{3}$/.test(up) && ISO_4217.has(up) ? up : null };
}
