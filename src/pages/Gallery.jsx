import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// The FastAPI backend URL. This ensures image src paths resolve to port 8000 instead of the React dev server port.
const API_BASE_URL = 'http://127.0.0.1:8000';

export default function Gallery() {
  const [scenes, setScenes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchScenes() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/scenes`);
        if (!response.ok) {
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        setScenes(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchScenes();
  }, []);

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>My take on a Static Volumetric Viewer</h1>
        <p style={{ color: '#aaa' }}>Select a scene to launch the 3D viewer</p>
      </header>
      
      <main>
        {isLoading && <p style={{ textAlign: 'center' }}>Loading available scenes...</p>}
        
        {error && (
          <div style={{ color: '#ff6b6b', textAlign: 'center', padding: '2rem', backgroundColor: '#331a1a', borderRadius: '8px' }}>
            <h2>Failed to load scenes</h2>
            <p>{error}</p>
            <p style={{ fontSize: '0.9rem', marginTop: '1rem' }}>Ensure your FastAPI server is running on http://127.0.0.1:8000</p>
          </div>
        )}

        {!isLoading && !error && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
            gap: '2rem' 
          }}>
            {scenes.map((scene) => (
              <Link 
                key={scene.scene_id} 
                to={`/viewer/${scene.scene_id}`}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  backgroundColor: '#2a2a2a',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  border: '1px solid #333',
                  transition: 'transform 0.2s ease, border-color 0.2s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = '#666';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = '#333';
                }}
              >
                <div style={{ width: '100%', aspectRatio: '16/9', overflow: 'hidden', backgroundColor: '#111' }}>
                  <img 
                    src={`${API_BASE_URL}${scene.thumbnail_url}`} 
                    alt={scene.scene_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                
                <div style={{ padding: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', margin: '0' }}>{scene.scene_name}</h2>
                  <p style={{ color: '#888', margin: '0', fontSize: '0.9rem' }}>
                    {scene.hotspot_count} interactive {scene.hotspot_count === 1 ? 'hotspot' : 'hotspots'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}