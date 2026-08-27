const METRICS: [string, string][] = [
  ['Users', '18,204'],
  ['Products indexed', '42,910'],
  ['Outfits built', '6,733'],
  ['Try-on jobs today', '1,082'],
  ['Avg. fit confidence', '81%'],
  ['Feedback responses', '3,412'],
];

const JOBS = [
  { user: 'u_2938', item: 'Oxford Shirt', confidence: '88%', status: 'Ready', color: 'var(--accent-dark)' },
  { user: 'u_1820', item: 'Trail Trainers', confidence: '68%', status: 'Low confidence', color: 'var(--amber-text)' },
  { user: 'u_4471', item: 'Pleated Trousers', confidence: '65%', status: 'Low confidence', color: 'var(--amber-text)' },
];

export default function Admin() {
  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 28px 100px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Studio Console</h1>
      <p style={{ fontSize: 13, color: 'var(--ink-faint)', margin: '0 0 28px' }}>Internal · mock metrics for stakeholder demonstration.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }}>
        {METRICS.map(([label, value]) => (
          <div key={label} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
          </div>
        ))}
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>System status</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-dark)', marginTop: 4 }}>● Operational</div>
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Inference cost (mtd)</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>₹42,880</div>
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Recent try-on jobs</div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '10px 16px', background: 'var(--surface-alt)', fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)' }}>
          <span>User</span><span>Item</span><span>Confidence</span><span>Status</span>
        </div>
        {JOBS.map((j) => (
          <div key={j.user} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '12px 16px', borderTop: '1px solid var(--border)', fontSize: 12.5 }}>
            <span>{j.user}</span><span>{j.item}</span><span>{j.confidence}</span><span style={{ color: j.color }}>{j.status}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
