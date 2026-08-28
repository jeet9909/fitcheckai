import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Discover from './pages/Discover';
import ProductDetail from './pages/ProductDetail';
import Setup from './pages/Setup';
import Processing from './pages/Processing';
import Result from './pages/Result';
import Handoff from './pages/Handoff';
import Saved from './pages/Saved';
import Profile from './pages/Profile';
import Privacy from './pages/Privacy';

// Routes removed per the UX redesign kill list (see /ux/redesign board C):
// /cart      — a cart that could never check out; buy now goes straight to /handoff
// /compare   — nobody compares before they trust; deferred to v2
// /tiers     — replaced by <PaywallSheet>, an in-context sheet, not a page
// /admin     — internal tool, must not be a public route; use a separate
//              authenticated deployment when the admin console is needed again
// /outfit, /outfit-score, /fit, /tryon (multi-slot Outfit Studio) — deferred
//              to v2, see board C. The single-garment flow lives at /result.
// The page files still exist under pages/ (nothing was deleted) so any of
// this can be restored — they are simply unrouted for the v1 launch surface.

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
        <Route path="/handoff" element={<Handoff />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/privacy" element={<Privacy />} />
      </Route>
    </Routes>
  );
}

export default App;
