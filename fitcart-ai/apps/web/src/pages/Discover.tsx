import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Product } from '../data/products';
import { BUCKETS, STORES } from '../data/products';
import { useAppState } from '../state/AppState';
import { parseQueryIntent, type QueryIntent } from '../lib/queryIntent';
import { ratingFromFitScore } from '../lib/ratingDisplay';
import { fmt } from '../lib/format';
import ProductCard from '../components/ProductCard';
import StoreSearch from '../components/StoreSearch';

type SortKey = 'price' | 'rating' | 'newest';

interface PriceBucket {
  id: string;
  label: string;
  test: (price: number) => boolean;
}

// Reasonable, fixed price bands for a catalog with no existing price-range
// filter UI to match — not derived from real percentile data, just sane
// breakpoints for INR fashion pricing.
const PRICE_BUCKETS: PriceBucket[] = [
  { id: 'u500', label: 'Under ₹500', test: (p) => p < 500 },
  { id: '500-1000', label: '₹500 – ₹1,000', test: (p) => p >= 500 && p < 1000 },
  { id: '1000-2000', label: '₹1,000 – ₹2,000', test: (p) => p >= 1000 && p < 2000 },
  { id: '2000-5000', label: '₹2,000 – ₹5,000', test: (p) => p >= 2000 && p < 5000 },
  { id: 'over5000', label: 'Above ₹5,000', test: (p) => p >= 5000 },
];

// Cosmetic-only — there is no per-size stock/availability field anywhere in
// the Product model (see data/products.ts), so this can never claim a size
// is actually in stock. It only records what the shopper says they'd want,
// same as a wishlist note, and never hides or shows a product because of it.
const SIZE_CHIPS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const FIT_OPTIONS = ['Oversized', 'Relaxed', 'Regular', 'Slim'] as const;
type FitOption = (typeof FIT_OPTIONS)[number];

/**
 * Heuristic keyword match against a product's own name/category text — NOT a
 * real structured "fit type" field (none exists in the Product model). Used
 * for both the FIT filter chips and to line up with a parsed query's `fit`
 * clause. Deliberately best-effort: a product with none of these keywords in
 * its name/category simply won't match anything but "Regular".
 */
function matchesFitHeuristic(product: Product, fit: string): boolean {
  const hay = `${product.name} ${product.category}`.toLowerCase();
  const lower = fit.toLowerCase();
  if (lower === 'oversized') return hay.includes('oversized') || hay.includes('loose');
  if (lower === 'relaxed') return hay.includes('relaxed');
  if (lower === 'slim' || lower === 'skinny' || lower === 'tailored') {
    return hay.includes('slim') || hay.includes('skinny') || hay.includes('tailored');
  }
  if (lower === 'regular') {
    return hay.includes('regular')
      || !(hay.includes('oversized') || hay.includes('loose') || hay.includes('relaxed')
        || hay.includes('slim') || hay.includes('skinny') || hay.includes('tailored'));
  }
  return true;
}

function normalizeColor(color: string): string {
  const lower = color.trim().toLowerCase();
  return lower === 'gray' ? 'grey' : lower;
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Best-effort match of a parsed free-text category against a product's real category/name text. */
function matchesCategoryIntent(product: Product, category: string): boolean {
  const hay = `${product.category} ${product.name}`.toLowerCase();
  if (hay.includes(category)) return true;
  if (category === 't-shirt') return hay.includes('tshirt') || hay.includes('tee') || hay.includes('t shirt');
  return false;
}

interface FaqEntry { q: string; a: string; }

// Small, static lookup — not a real FAQ CMS. Grouped by rough category so a
// "t-shirt" and a "hoodie" search see broadly relevant questions without
// needing an entry for every single category string queryIntent recognizes.
const FAQ_GROUPS: Record<string, FaqEntry[]> = {
  top: [
    { q: 'What counts as an oversized fit?', a: 'Oversized pieces are cut with extra room through the chest and shoulders and are meant to sit loose, not tight — most shoppers size down or stay true to size rather than sizing up.' },
    { q: 'Will the fabric feel like the catalog photo?', a: 'Catalog photos are supplied by the store, not by FitCart — check the material listed on the product page for a better sense of drape and weight.' },
    { q: 'Can I see how this looks on me before buying?', a: 'Yes — use "See it on me" on any product to preview it against your own photo before you head to the store to check out.' },
  ],
  bottom: [
    { q: 'How do I pick between two waist sizes?', a: 'If you are between sizes, most shoppers size up for a relaxed fit and size down for a slim fit — the store\'s own size chart on the product page is the most reliable reference.' },
    { q: 'Does FitCart know my inseam length?', a: 'Not yet — try-on previews focus on overall fit and drape, not exact inseam measurements.' },
  ],
  footwear: [
    { q: 'Do shoe sizes match across these stores?', a: 'Sizing can vary slightly by brand — check the store\'s own size chart on the product page rather than assuming your usual size carries over.' },
    { q: 'Can I try shoes on virtually?', a: 'Try-on previews are currently built for clothing on a full-body photo — footwear previews are not supported yet.' },
  ],
  dress: [
    { q: 'What is the difference between relaxed and regular fit?', a: 'Relaxed fits have some extra room through the body while regular fits follow your measurements more closely — both are still meant to sit comfortably, not tight.' },
    { q: 'Can I preview this on my own body shape?', a: 'Yes — "See it on me" generates a preview from a single full-body photo of you.' },
  ],
  accessory: [
    { q: 'Is there a size guide for this?', a: 'Check the product page — a size chart is shown there when the store has provided one.' },
  ],
  default: [
    { q: 'How does try-on work?', a: 'Upload one full-body photo on the Setup page, and FitCart generates a preview of how a specific product would look on you.' },
    { q: 'How does price comparison work?', a: 'When a product is listed by more than one store, FitCart shows the other listings so you can compare price before you buy.' },
    { q: 'Where do I actually complete my purchase?', a: 'Always on the retailer\'s own site — FitCart never handles payment or checkout.' },
  ],
};

const CATEGORY_TO_FAQ_GROUP: Record<string, keyof typeof FAQ_GROUPS> = {
  't-shirt': 'top', shirt: 'top', hoodie: 'top', sweater: 'top', jacket: 'top', blazer: 'top', coat: 'top', top: 'top',
  jeans: 'bottom', trousers: 'bottom', pants: 'bottom', shorts: 'bottom', skirt: 'bottom',
  shoes: 'footwear', sneakers: 'footwear', sandals: 'footwear',
  dress: 'dress', kurta: 'dress', saree: 'dress',
  watch: 'accessory', sunglasses: 'accessory',
};

function faqFor(intent: QueryIntent): FaqEntry[] {
  if (intent.category) {
    const group = CATEGORY_TO_FAQ_GROUP[intent.category];
    if (group) return FAQ_GROUPS[group];
  }
  return FAQ_GROUPS.default;
}

function interpretationSummary(intent: QueryIntent, matchCount: number): string | null {
  const clauses: string[] = [];
  if (intent.color) clauses.push(`colour ${intent.color}`);
  if (intent.fit) clauses.push(`fit ${intent.fit}`);
  if (intent.category) clauses.push(`category ${intent.category}`);
  if (intent.maxPrice !== undefined) clauses.push(`price under ${fmt(intent.maxPrice)}`);
  if (clauses.length === 0) return null;
  const noun = matchCount === 1 ? 'match' : 'matches';
  return `FitCart read that as: ${clauses.join(', ')}. ${matchCount} ${noun}.`;
}

function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

interface NonPriceFilterState {
  searchQuery: string;
  intent: QueryIntent;
  categoryFilter: string;
  selectedStores: string[];
  selectedColours: string[];
  selectedFits: FitOption[];
  tryOnOnly: boolean;
}

function filterByNonPriceCriteria(list: Product[], state: NonPriceFilterState): Product[] {
  const { searchQuery, intent, categoryFilter, selectedStores, selectedColours, selectedFits, tryOnOnly } = state;
  const q = searchQuery.trim().toLowerCase();
  // Once queryIntent has parsed structured clauses (color/fit/category) out
  // of the query, those are applied as their own real per-field filters
  // below — matching the raw phrase as one contiguous substring on top of
  // that would wrongly reject a real match just because words like "under"
  // or "₹1,000" don't literally appear in the product's name/category. The
  // plain substring fallback is only useful for genuinely unstructured text
  // queryIntent found nothing in (e.g. a brand or model name).
  const hasParsedIntent = intent.color !== undefined || intent.fit !== undefined
    || intent.category !== undefined || intent.maxPrice !== undefined;

  return list.filter((p) => {
    if (categoryFilter !== 'All' && p.bucket !== categoryFilter) return false;
    if (selectedStores.length > 0 && !selectedStores.includes(p.store)) return false;
    if (selectedColours.length > 0 && !selectedColours.includes(normalizeColor(p.color))) return false;
    if (selectedFits.length > 0 && !selectedFits.some((f) => matchesFitHeuristic(p, f))) return false;
    if (tryOnOnly && p.breakdown.length === 0) return false;
    if (!hasParsedIntent && q && !(p.name + ' ' + p.brand + ' ' + p.category).toLowerCase().includes(q)) return false;
    if (intent.color && normalizeColor(p.color) !== intent.color) return false;
    if (intent.fit && !matchesFitHeuristic(p, intent.fit)) return false;
    if (intent.category && !matchesCategoryIntent(p, intent.category)) return false;
    return true;
  });
}

function filterByPriceCriteria(list: Product[], maxPrice: number | undefined, selectedPriceBuckets: string[]): Product[] {
  return list.filter((p) => {
    if (maxPrice !== undefined && p.price > maxPrice) return false;
    if (selectedPriceBuckets.length > 0) {
      const buckets = PRICE_BUCKETS.filter((b) => selectedPriceBuckets.includes(b.id));
      if (!buckets.some((b) => b.test(p.price))) return false;
    }
    return true;
  });
}

const checkboxRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-soft)', cursor: 'pointer' };
const filterGroupStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 18, marginBottom: 18, borderBottom: '1px solid var(--border)' };
const filterHeadingStyle: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink-faint)', textTransform: 'uppercase' };

export default function Discover() {
  const { products, searchQuery, showToast } = useAppState();
  const navigate = useNavigate();

  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedPriceBuckets, setSelectedPriceBuckets] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]); // cosmetic only
  const [selectedFits, setSelectedFits] = useState<FitOption[]>([]);
  const [selectedColours, setSelectedColours] = useState<string[]>([]);
  const [tryOnOnly, setTryOnOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('price');
  const [compareIds, setCompareIds] = useState<number[]>([]);

  const intent = useMemo(() => parseQueryIntent(searchQuery), [searchQuery]);

  const availableColours = useMemo(() => {
    const set = new Set(products.map((p) => p.color).filter(Boolean).map(normalizeColor));
    return Array.from(set).sort();
  }, [products]);

  // Every real (non-price) constraint, applied once. Reused twice below: once
  // for the actual displayed result set, and again (with price ignored) to
  // work out how many more products a shopper would see if they widened the
  // price filter — so that number is always real, never invented.
  const nonPriceFiltered = useMemo(
    () => filterByNonPriceCriteria(products, {
      searchQuery, intent, categoryFilter, selectedStores, selectedColours, selectedFits, tryOnOnly,
    }),
    [products, searchQuery, intent, categoryFilter, selectedStores, selectedColours, selectedFits, tryOnOnly],
  );

  const filteredProducts = useMemo(
    () => filterByPriceCriteria(nonPriceFiltered, intent.maxPrice, selectedPriceBuckets),
    [nonPriceFiltered, intent.maxPrice, selectedPriceBuckets],
  );

  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    if (sortBy === 'price') list.sort((a, b) => a.price - b.price);
    else if (sortBy === 'rating') list.sort((a, b) => ratingFromFitScore(b.fitScore) - ratingFromFitScore(a.fitScore));
    // 'newest': no createdAt/date field exists on Product (data/products.ts)
    // — falling back to id order (higher id = added more recently) rather
    // than fabricating a date.
    else list.sort((a, b) => b.id - a.id);
    return list;
  }, [filteredProducts, sortBy]);

  const hasActivePriceFilter = intent.maxPrice !== undefined || selectedPriceBuckets.length > 0;
  const activePriceLabel = intent.maxPrice !== undefined
    ? `under ${fmt(intent.maxPrice)}`
    : selectedPriceBuckets.length === 1
      ? PRICE_BUCKETS.find((b) => b.id === selectedPriceBuckets[0])?.label.toLowerCase()
      : 'in your selected price ranges';

  const hasAnyActiveFilter = categoryFilter !== 'All' || selectedStores.length > 0 || selectedColours.length > 0
    || selectedFits.length > 0 || tryOnOnly || hasActivePriceFilter || Boolean(searchQuery.trim());

  const widenedCount = hasActivePriceFilter ? nonPriceFiltered.length : filteredProducts.length;
  const moreIfWidened = widenedCount - filteredProducts.length;

  const showEndOfResults = hasAnyActiveFilter && filteredProducts.length > 0 && filteredProducts.length <= 4;

  const clearFilters = () => {
    setCategoryFilter('All');
    setSelectedStores([]);
    setSelectedPriceBuckets([]);
    setSelectedSizes([]);
    setSelectedFits([]);
    setSelectedColours([]);
    setTryOnOnly(false);
  };

  const toggleCompare = (product: Product) => {
    setCompareIds((prev) => {
      const already = prev.includes(product.id);
      // Local UI stub only — there is no compare page/flow in this app yet.
      showToast(already ? `Removed ${product.name} from compare` : `Added ${product.name} to compare`);
      return toggleInArray(prev, product.id);
    });
  };

  const summary = interpretationSummary(intent, filteredProducts.length);
  const faqs = faqFor(intent);

  return (
    <main style={{ maxWidth: 1360, margin: '0 auto', padding: '32px 28px 80px' }}>
      <nav aria-label="Breadcrumb" style={{ marginBottom: 14 }}>
        <ol style={{ display: 'flex', gap: 6, alignItems: 'center', listStyle: 'none', margin: 0, padding: 0, fontSize: 12.5, color: 'var(--ink-faint)' }}>
          <li>
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--ink-faint)', cursor: 'pointer', fontSize: 12.5 }}>
              Home
            </button>
          </li>
          <li aria-hidden="true">/</li>
          <li style={{ color: 'var(--ink-soft)', fontWeight: 600 }} aria-current="page">
            {searchQuery.trim() ? 'Search results' : categoryFilter !== 'All' ? categoryFilter : 'Discover'}
          </li>
        </ol>
      </nav>

      {searchQuery.trim() && (
        <div style={{ marginBottom: 8 }}>
          <div className="mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink-faint)', textTransform: 'uppercase', marginBottom: 4 }}>
            You asked for
          </div>
          <p style={{ fontSize: 17, fontWeight: 600, margin: '0 0 6px' }}>&ldquo;{searchQuery}&rdquo;</p>
          {summary && <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>{summary}</p>}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '20px 0', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Discover</h1>
        <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>{filteredProducts.length} item(s) in your catalog</span>
      </div>

      <StoreSearch />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
        {BUCKETS.map((b) => {
          const active = categoryFilter === b;
          return (
            <button
              key={b}
              onClick={() => setCategoryFilter(b)}
              aria-pressed={active}
              style={{ border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`, background: active ? 'var(--ink)' : 'var(--surface)', color: active ? '#fff' : 'var(--ink-soft)', fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 100, cursor: 'pointer' }}
            >
              {b}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <aside style={{ flex: '1 1 220px', maxWidth: 280, minWidth: 220 }}>
          <div style={filterGroupStyle}>
            <div style={filterHeadingStyle}>Retailer</div>
            {STORES.map((store) => (
              <label key={store} style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={selectedStores.includes(store)}
                  onChange={() => setSelectedStores((prev) => toggleInArray(prev, store))}
                />
                {store}
              </label>
            ))}
          </div>

          <div style={filterGroupStyle}>
            <div style={filterHeadingStyle}>Price</div>
            {PRICE_BUCKETS.map((bucket) => (
              <label key={bucket.id} style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={selectedPriceBuckets.includes(bucket.id)}
                  onChange={() => setSelectedPriceBuckets((prev) => toggleInArray(prev, bucket.id))}
                />
                {bucket.label}
              </label>
            ))}
          </div>

          <div style={filterGroupStyle}>
            <div style={filterHeadingStyle}>Size</div>
            <p style={{ fontSize: 11, color: 'var(--ink-faint)', margin: '0 0 2px', lineHeight: 1.4 }}>
              No per-size stock data yet — this only remembers your preference, it does not hide anything.
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SIZE_CHIPS.map((size) => {
                const active = selectedSizes.includes(size);
                return (
                  <button
                    key={size}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedSizes((prev) => toggleInArray(prev, size))}
                    style={{ border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`, background: active ? 'var(--ink)' : 'var(--surface)', color: active ? '#fff' : 'var(--ink-soft)', fontSize: 12, fontWeight: 500, padding: '5px 10px', borderRadius: 8, cursor: 'pointer' }}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={filterGroupStyle}>
            <div style={filterHeadingStyle}>Fit</div>
            <p style={{ fontSize: 11, color: 'var(--ink-faint)', margin: '0 0 2px', lineHeight: 1.4 }}>
              Based on keywords in the product name — not a verified fit measurement.
            </p>
            {FIT_OPTIONS.map((fit) => (
              <label key={fit} style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={selectedFits.includes(fit)}
                  onChange={() => setSelectedFits((prev) => toggleInArray(prev, fit))}
                />
                {fit}
              </label>
            ))}
          </div>

          {availableColours.length > 0 && (
            <div style={filterGroupStyle}>
              <div style={filterHeadingStyle}>Colour</div>
              {availableColours.map((colour) => (
                <label key={colour} style={checkboxRowStyle}>
                  <input
                    type="checkbox"
                    checked={selectedColours.includes(colour)}
                    onChange={() => setSelectedColours((prev) => toggleInArray(prev, colour))}
                  />
                  {capitalize(colour)}
                </label>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ ...checkboxRowStyle, fontWeight: 600, color: 'var(--ink)' }}>
              <input type="checkbox" checked={tryOnOnly} onChange={() => setTryOnOnly((v) => !v)} />
              Try-on available only
            </label>
          </div>
        </aside>

        <section style={{ flex: '3 1 480px', minWidth: 280 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <span style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>
              {filteredProducts.length} result{filteredProducts.length === 1 ? '' : 's'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label htmlFor="discover-sort" style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>Sort</label>
              <select
                id="discover-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 13, background: 'var(--surface)' }}
              >
                <option value="price">Best price first</option>
                <option value="rating">Best rated</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </div>

          {sortedProducts.length === 0 ? (
            <div style={{ border: '1px dashed var(--border)', borderRadius: 14, padding: 32, textAlign: 'center' }}>
              <p style={{ fontSize: 13.5, color: 'var(--ink-faint)', margin: '0 0 12px' }}>
                Nothing matches yet. Paste a product link from Home to add a real listing, or try a broader search.
              </p>
              {hasAnyActiveFilter && (
                <button onClick={clearFilters} className="fc-btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>
                  Try a broader search
                </button>
              )}
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 20 }}>
                {sortedProducts.map((p) => {
                  const isComparing = compareIds.includes(p.id);
                  return (
                    <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <ProductCard product={p} />
                      <button
                        type="button"
                        aria-pressed={isComparing}
                        onClick={() => toggleCompare(p)}
                        style={{
                          border: `1px solid ${isComparing ? 'var(--accent-dark)' : 'var(--border)'}`,
                          background: isComparing ? 'var(--accent-soft)' : 'var(--surface)',
                          color: isComparing ? 'var(--accent-dark)' : 'var(--ink-soft)',
                          fontSize: 12, fontWeight: 700, padding: '7px 10px', borderRadius: 100, cursor: 'pointer',
                        }}
                      >
                        {isComparing ? 'Added to compare' : 'Add to compare'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {showEndOfResults && (
                <div style={{ border: '1px dashed var(--border)', borderRadius: 14, padding: '24px 28px', textAlign: 'center', marginTop: 28 }}>
                  {hasActivePriceFilter ? (
                    <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '0 0 12px' }}>
                      That is everything {activePriceLabel}.
                      {moreIfWidened > 0 && ` Widen the price a little and ${moreIfWidened} more appear.`}
                    </p>
                  ) : (
                    <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '0 0 12px' }}>
                      That is everything matching your filters.
                    </p>
                  )}
                  <button onClick={clearFilters} className="fc-btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>
                    Try a broader search
                  </button>
                </div>
              )}
            </>
          )}

          <div style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>Common questions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {faqs.map((faq) => (
                <div key={faq.q} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>{faq.q}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{faq.a}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
