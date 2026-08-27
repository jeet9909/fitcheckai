import { useNavigate } from 'react-router-dom';
import { useAppState } from '../state/AppState';

const FEEDBACK_OPTIONS = ['Perfect fit', 'Slightly loose', 'Slightly tight', 'Wrong fit'];

export default function Feedback() {
  const navigate = useNavigate();
  const { feedbackChoice, feedbackNote, feedbackSubmitted, setFeedbackChoice, setFeedbackNote, submitFeedback } = useAppState();

  if (feedbackSubmitted) {
    return (
      <main style={{ maxWidth: 520, margin: '0 auto', padding: '64px 28px 100px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent-dark)', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>✓</div>
          <h1 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 8px' }}>Thanks — that helps.</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 24px' }}>Feedback like yours trains FitCart to predict fit more accurately for everyone.</p>
          <button onClick={() => navigate('/discover')} style={{ background: 'var(--ink)', color: '#fff', border: 'none', fontSize: 13.5, fontWeight: 600, padding: '12px 20px', borderRadius: 9 }}>Back to Discover</button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '64px 28px 100px' }}>
      <div>
        <h1 style={{ fontSize: 21, fontWeight: 700, margin: '0 0 8px' }}>Did it fit the way FitCart predicted?</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-faint)', margin: '0 0 22px' }}>Your answer helps FitCart's AI get more accurate over time.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {FEEDBACK_OPTIONS.map((o) => {
            const active = feedbackChoice === o;
            return (
              <button
                key={o}
                onClick={() => setFeedbackChoice(o)}
                style={{ border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`, background: active ? 'var(--surface-alt)' : 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, fontWeight: 600, padding: 16, borderRadius: 10 }}
              >
                {o}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 8 }}>What would you change? (optional)</div>
        <textarea
          value={feedbackNote}
          onChange={(e) => setFeedbackNote(e.target.value)}
          placeholder="e.g. runs slightly long in the sleeve"
          style={{ width: '100%', minHeight: 80, border: '1px solid var(--border)', borderRadius: 10, padding: 12, fontSize: 13, outline: 'none', resize: 'vertical', marginBottom: 20 }}
        />
        <button onClick={submitFeedback} style={{ width: '100%', background: 'var(--ink)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, padding: 14, borderRadius: 9 }}>Submit Feedback</button>
      </div>
    </main>
  );
}
