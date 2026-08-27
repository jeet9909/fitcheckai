import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Discover from './pages/Discover';
import ProductDetail from './pages/ProductDetail';
import OutfitStudio from './pages/OutfitStudio';
import Setup from './pages/Setup';
import Processing from './pages/Processing';
import TryOnStudio from './pages/TryOnStudio';
import FitIntelligence from './pages/FitIntelligence';
import OutfitIntelligence from './pages/OutfitIntelligence';
import Compare from './pages/Compare';
import Cart from './pages/Cart';
import Handoff from './pages/Handoff';
import Saved from './pages/Saved';
import Profile from './pages/Profile';
import Tiers from './pages/Tiers';
import Feedback from './pages/Feedback';
import Privacy from './pages/Privacy';
import Admin from './pages/Admin';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/outfit" element={<OutfitStudio />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/processing" element={<Processing />} />
        <Route path="/tryon" element={<TryOnStudio />} />
        <Route path="/fit" element={<FitIntelligence />} />
        <Route path="/outfit-score" element={<OutfitIntelligence />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/handoff" element={<Handoff />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/tiers" element={<Tiers />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/admin" element={<Admin />} />
      </Route>
    </Routes>
  );
}

export default App;
