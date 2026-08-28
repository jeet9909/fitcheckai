import { useNavigate } from 'react-router-dom';
import { useAppState } from '../state/AppState';

export function useStartTryOn() {
  const navigate = useNavigate();
  const { profileSetupDone } = useAppState();

  return (sourceLink?: string | null) => {
    if (!profileSetupDone) {
      navigate('/setup', { state: { sourceLink: sourceLink ?? null } });
      return;
    }
    navigate('/processing', { state: { afterRoute: '/result', sourceLink: sourceLink ?? null } });
  };
}
