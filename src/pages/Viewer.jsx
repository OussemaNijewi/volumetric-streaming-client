import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

const API_BASE_URL = 'http://127.0.0.1:8000'

export default function Viewer() { 
    const { sceneID } = useParams();
    const navigate = useNavigate();

    const [metadata, setMetadata] = useState(null);
    const [statusMessage, setStatusMessage] = useState('Initializing...');
    const [errorMessage, setErrorMessage] = useState(null);

    useEffect(() => { 
        if (!sceneID) return;

        async function fetchMetadata() {
            try {
                setStatusMessage(`Fetching metadata for: ${sceneID}...`);
                const response = await fetch(`${API_BASE_URL}/assets/${sceneID}/metadata.json`);

                if (!response.ok) { 
                    throw new Error(`HTTP Error ${response.status}: Could not load metadata.json`);
                }

                const data = await response.json();

                setMetadata(data);
                setStatusMessage('Metadata loaded successfully');
                console.log('Metadata fetched successfully: ', data);
            } catch (err) { 
                console.error('Error fetching metadata:', err);
                setErrorMessage(err.message);
                setStatusMessage(null);    
            }
        }

        fetchMetadata();
    }, [sceneID]);

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
                <h2>Initializing 3D Viewer for: {metadata ? metadata.scene_id : sceneID}</h2>
            </div>
        </div>
    );
}