# INTAKE

Personal micronutrient tracker. 43 nutrients, barcode scanning, local-first storage.
No accounts, no server, no subscription. Static files — deploys anywhere.

---

## Deploy (same as quit-nic)

```bash
git init && git add . && git commit -m "intake v1"
git remote add origin git@github.com:da3ku/intake.git
git push -u origin main
```

Then Settings → Pages → deploy from `main` / root.

**HTTPS is required** for the camera and the service worker. GitHub Pages gives you that
for free. Opening `index.html` off the filesystem will work for logging but the scanner
and offline mode will not.

Install on iPhone: open in Safari → Share → **Add to Home Screen**. This matters for more
than the icon — iOS evicts web storage for sites you haven't visited in a while, but
home-screen-installed apps are exempt from that eviction.

---

## First run

1. **Config → USDA API key.** Free, instant, no approval: `fdc.nal.usda.gov/api-key-signup`.
   Without it you fall back to `DEMO_KEY`, which throttles at around 30 requests/hour.
2. **Config → targets.** Defaults are IOM/Health Canada DRI for males 19–30, with macros
   pre-set at 2600 kcal / 170 P / 280 C / 80 F. Change them to yours.
3. Log something. Scan a barcode or search a whole food.

---

## Which database answers what

| | Open Food Facts | USDA FoodData Central |
|---|---|---|
| Best at | Packaged goods, barcodes | Whole foods — chicken, oats, rice |
| Coverage | Strong in Canada/Quebec (French-origin project) | US-centric but authoritative |
| Micronutrients | Sparse — whatever's on the label | Deep, lab-measured |
| Barcodes | Dedicated endpoint | Branded dataset only, no real endpoint |
| Key needed | No | Yes (free) |
| Licence | ODbL (attribution + share-alike) | Public domain |

**Text search** hits both in parallel, results grouped by source.

**Barcode scan** resolves in a chain:

```
scan / manual entry
   ↓ parse (raw digits, or GTIN from a GS1 Digital Link QR)
1. local cache        normalised to GTIN-14, so a UPC-A and its
                      EAN-13 form match the same food
2. Open Food Facts    /api/v2/product/{barcode}.json
3. USDA Branded       query the code as a search term, then verify
                      gtinUpc matches exactly
   ↓
neither → prompt to add it manually
```

USDA has no barcode endpoint — branded foods carry a `gtinUpc` but you have to
search for the code as text and check the field yourself. The app does that check
strictly: a loose text match with a non-matching GTIN is discarded, because a
plausible-looking wrong product is worse than no result.

QR codes are supported only in the GS1 Digital Link form (`.../01/{gtin}/...`),
which encodes a real GTIN. Marketing QR codes on packaging are ignored — they
point at websites, not products.

### Rate limits are real

Open Food Facts enforces **15 req/min** on product lookups and **10 req/min** on search,
with IP bans for abuse. USDA allows ~1000/hr on a registered key, 30/hr on `DEMO_KEY`.
The app is built around this:

- Search debounces at **700 ms** — no search-as-you-type
- Your local library is searched instantly and always shown first
- Every food you look up is cached permanently on device

After a few weeks you'll be eating out of cache almost entirely. You eat maybe 200 distinct
foods; the network stops mattering.

---

## Reading the display

Nutrient bars are colour-coded against your target:

| Colour | Meaning |
|---|---|
| Rust | under 50% |
| Orange | 50–90% |
| Green | 90–160% — the band you want |
| Blue | 160–300% |
| Magenta | over 300% |

**Capped nutrients invert this** — sodium, saturated fat, trans fat, cholesterol, sugars,
caffeine and alcohol are green when *under* the limit.

A `3/5` next to a nutrient means only 3 of today's 5 logged items reported it. That's a
data-coverage warning, not a deficiency: your real intake is at least what's shown, probably
more. This is the honest version of what most trackers silently paper over by treating
missing values as zero. **Intake never does that** — a missing value stays `—`.

---

## Adding Supabase sync later

The storage layer is already shaped for it. Every record carries `id`, `updatedAt` and
`dirty`. `Store.driver` is a swappable adapter with four methods:

```js
const SUPA = {
  name: 'supabase',
  async all(store)      { /* select * from store */ },
  async put(store, rec) { /* upsert on id */ },
  async del(store, id)  { /* delete where id */ },
  async clear(store)    { /* delete all */ },
};
```

Implement those four, point `Store.driver` at it, and nothing in the UI changes. The
realistic pattern is dual-write: keep IndexedDB as the source of truth for instant reads,
push `dirty` records up on a timer, clear the flag on ack. Last-write-wins on `updatedAt`
is fine for a single-user app.

Tables mirror the stores: `foods`, `entries`, `meta`.

---

## Files

```
index.html            entire app — schema, storage, adapters, UI
sw.js                 service worker (shell cached, API traffic never cached)
manifest.webmanifest  PWA metadata
icon-192.png          
icon-512.png          
```

No build step, no dependencies to install. ZXing loads from CDN only when you open the
scanner and the browser lacks native `BarcodeDetector` — which is every iPhone, since
Safari doesn't implement it.

---

## Known limits

- **iOS barcode scanning** runs through ZXing over `getUserMedia`, not the native API.
  Slower than a dedicated app. Manual barcode entry is always available as a fallback.
- **OFF micronutrient data is thin** for many products, because manufacturers only print
  what's legally required. Whole foods via USDA are where the micronutrient picture
  actually fills in.
- **Recipes aren't modelled yet.** Log components individually, or create a custom food
  with the combined per-100 g values.
- Export your JSON periodically. There is no server; this device is the only copy.

---

## Attribution

Product data © Open Food Facts contributors, [ODbL](https://opendatacommons.org/licenses/odbl/).
Whole-food data from USDA FoodData Central (public domain).
Reference intakes from IOM / Health Canada DRI tables, males 19–30.
