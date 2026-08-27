import { useNavigate } from 'react-router-dom';
import { useAppState } from '../state/AppState';

export function useStartTryOn() {
  const navigate = useNavigate();
  const { profileSetupDone } = useAppState();

  return () => {
    if (!profileSetupDone) {
      navigate('/setup');
      return;
    }
    navigate('/processing', { state: { afterRoute: '/tryon' } });
  };
}
