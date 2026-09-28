import { useParams, useNavigate } from 'react-router-dom';

export default function Viewer() { 
    const { sceneID } = useParams();
    const navigate = useNavigate();

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
            {/* UI overlay on top of the future 3D canvas */}
            <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10 }}>
                <button
                    onClick={() => navigate('/')}
                    style={{ padding: '8px 16px', cursor: 'pointer' }}
                >
                    ← Back to Gallery
                </button>
            </div>

            {/* The Three.js canvas will mount here later */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <h2>Initializing 3D Viewer for: {sceneID}</h2>
            </div>
        </div>
    );
}