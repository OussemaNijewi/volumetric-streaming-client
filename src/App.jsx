import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Gallery from './pages/Gallery';
import Viewer from './pages/Viewer';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default landing page */}
        <Route path="/" element={<Gallery />} />
        
        {/* Dynamic route for the 3D viewer (e.g., /viewer/spaceRover) */}
        <Route path="/viewer/:sceneID" element={<Viewer />} />
      </Routes>
    </BrowserRouter>
  );
}