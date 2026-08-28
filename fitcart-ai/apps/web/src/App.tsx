import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Discover from './pages/Discover';
import ProductDetail from './pages/ProductDetail';
import Setup from './pages/Setup';
import Processing from './pages/Processing';
import Result from './pages/Result';
import Saved from './pages/Saved';
import Profile from './pages/Profile';
import Privacy from './pages/Privacy';
import Auth from './pages/Auth';
import { CheckoutSuccess, CheckoutCancel } from './pages/CheckoutResult';

// Deferred/legacy surfaces removed entirely per the UX redesign kill list
// (see /ux/redesign board C): /cart, /compare, /tiers, /admin, and the
// multi-slot Outfit Studio (/outfit, /outfit-score, /fit, /tryon). The
// paywall is <PaywallSheet>, an in-context sheet, not a route. Buy now
// hands off directly to the retailer from /result, not through a cart.

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/processing" element={<Processing />} />
        <Route path="/result" element={<Result />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/checkout/cancel" element={<CheckoutCancel />} />
      </Route>
    </Routes>
  );
}

export default App;
