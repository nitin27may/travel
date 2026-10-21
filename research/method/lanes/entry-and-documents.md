# Lane: entry and documents

Status: draft (17 Oct 2026).

## 1. Purpose

What each traveller needs to cross borders and do the trip: passport validity, visas or electronic
authorisations (eTA, ESTA, ETIAS when live, UK ETA), minors travelling with one parent (consent
letters), driving permits (IDP), vehicle papers for border crossings, health requirements, travel
insurance requirements, park passes needed for entry. Output becomes **document rules** that generate
Documents tasks per traveller (01-domain-model.md 3.5).

## 2. Produces

`document_rule(citizenship, destination, rule, source, observed_on)` rows; `rule` jsonb:

```json
{ "kind": "passport_validity", "months_after_departure": 3, "blank_pages": 1 }
{ "kind": "authorisation", "name": "ETIAS", "apply_url": "...", "lead_days": 4, "cost": {"amount": 20, "currency": "EUR"}, "valid_years": 3, "age_exempt_under": 18 }
{ "kind": "minor_consent", "when": "travelling without both parents", "note": "..." }
{ "kind": "driving_permit", "name": "IDP", "required": true }
{ "kind": "vehicle_border", "note": "rental agreement must allow cross-border" }
```

## 3. Required fields

`citizenship` (ISO country), `destination` (ISO country or area), `rule.kind`, the rule's numbers,
`source` (official government page), `observed_on`, `applies_from` when a new scheme starts.

## 4. Optional fields

`transit` rules (airside transit visas), `age_exemptions`, `processing_time_days`, `fees`, `photo_specs`,
`health` (vaccinations required, not recommended ones), `insurance_required`.

## 5. Sources, in order

The destination government's official page; the traveller's own government's travel advice (Canada's
travel.gc.ca for Canadian citizens); IATA Timatic-derived public tools as cross-checks only.

## 6. Evidence rules

`official` only. Never community. Changes take effect on dates; store `applies_from`.

## 7. Leave empty

Anything from a blog; schemes announced but not dated (record as a gap with the announcement).

## 8. Freshness

90 days; 30 days within 60 days of a trip using it.

## 9. Traps

Passport validity counted from departure versus entry; schemes with shifting start dates (ETIAS);
children's own authorisations; IDP needed for some countries only; rental contracts forbidding border
crossings or certain roads.

## 10. Example changeset (abridged)

```json
{ "changes": [ { "op": "create", "target_kind": "document_rule", "temp_ref": "d1",
  "patch": { "citizenship": "CA", "destination": "IS", "rule": { "kind": "passport_validity", "months_after_departure": 3 } },
  "evidence": [ { "field": "rule", "value": "...", "source": { "url": "https://travel.gc.ca/destinations/iceland", "publisher": "Government of Canada", "kind": "official" }, "observed_on": "2026-10-17", "quote": "Passport must be valid at least 3 months beyond the date you expect to leave the Schengen area", "confidence": "official" } ] } ] }
```
