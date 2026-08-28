import { supabase } from './supabase';

/**
 * Calls the create-checkout-session Supabase Edge Function and redirects the
 * browser to the returned Stripe Checkout URL. Caller must already have
 * confirmed the user is signed in.
 */
export async function startCheckout(
  plan: 'day' | 'pro' | 'year',
  showToast: (msg: string) => void,
): Promise<void> {
  if (!supabase) {
    showToast('Checkout isn’t connected yet — backend coming soon');
    return;
  }

  const { data, error } = await supabase.functions.invoke<{ url: string }>('create-checkout-session', {
    body: { plan },
  });

  if (error || !data?.url) {
    showToast('Could not start checkout — try again');
    return;
  }

  window.location.href = data.url;
}
