import { useState } from 'react';

interface CurrencyOption {
  code: string;
  symbol: string;
  label: string;
}

// Label-only for this phase — no live FX rates or price conversion math.
// Prices throughout the app remain INR (see lib/format.ts's fmt()); this
// selector exists so the header has a place for it once real conversion
// ships, without blocking on that work now.
const CURRENCIES: CurrencyOption[] = [
  { code: 'INR', symbol: '₹', label: '₹ INR' },
  { code: 'USD', symbol: '$', label: '$ USD' },
  { code: 'EUR', symbol: '€', label: '€ EUR' },
  { code: 'GBP', symbol: '£', label: '£ GBP' },
];

export default function CurrencySelector() {
  const [currency, setCurrency] = useState('INR');

  return (
    <select
      value={currency}
      onChange={(e) => setCurrency(e.target.value)}
      aria-label="Currency"
      style={{
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--ink-soft)',
        fontSize: 12.5,
        fontWeight: 600,
        borderRadius: 8,
        padding: '7px 8px',
        outline: 'none',
        cursor: 'pointer',
      }}
    >
      {CURRENCIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.label}
        </option>
      ))}
    </select>
  );
}
