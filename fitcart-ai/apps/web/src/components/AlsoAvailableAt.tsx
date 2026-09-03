import type { Product } from '../data/products';
import { fmt } from '../lib/format';

/**
 * Renders manually-curated "same product, different store" matches
 * (`product_match_groups` / `product_match_members` — see
 * lib/api.ts's fetchMatchGroup). Deliberately carries no confidence score
 * or similarity badge: matches here are human-confirmed, not
 * algorithmically scored, and implying automated certainty would
 * misrepresent that. Renders nothing at all when there's no group for this
 * product (curation is sparse today) — never a "no matches found" message,
 * which would wrongly imply a search was attempted.
 */
export default function AlsoAvailableAt({ members }: { members: Product[] }) {
  if (members.length === 0) return null;

  return (
    <section style={{ marginTop: 32, border: '1px solid var(--border)', borderRadius: 14, padding: 20, background: 'var(--surface-alt)' }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px' }}>Also available at</h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {members.map((p) => (
          <li key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 13.5 }}>
            <span>
              Available at <strong>{p.store}</strong> for {fmt(p.price)}
            </span>
            {p.productUrl && (
              <a
                href={p.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-dark)', textDecoration: 'none', flex: 'none' }}
              >
                View at {p.store} ↗
              </a>
            )}
          </li>
        ))}
      </ul>
      <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '14px 0 0', lineHeight: 1.5 }}>
        Manually confirmed to be the same product.
      </p>
    </section>
  );
}
