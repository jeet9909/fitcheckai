import { useAppState } from '../state/AppState';

export default function Toast() {
  const { toast } = useAppState();
  if (!toast) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--ink)',
        color: '#fff',
        fontSize: 13,
        fontWeight: 500,
        padding: '12px 20px',
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        animation: 'fc-toast-in 0.25s ease',
        zIndex: 200,
        whiteSpace: 'nowrap',
      }}
    >
      {toast}
    </div>
  );
}
