import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';

import * as THREE from 'three/webgpu';
import { SPZLoader } from 'three/addons/loaders/SPZLoader.js';
import { GaussianSplat } from 'three/addons/objects/GaussianSplat.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';


const API_BASE_URL = 'http://127.0.0.1:8000';

export default function Viewer() { 
    const { sceneID } = useParams();
    const navigate = useNavigate();

    // create a persistent reference to a DOM element to interact with it
    const canvasContainerRef = useRef(null);

    const [metadata, setMetadata] = useState(null);
    const [statusMessage, setStatusMessage] = useState('Initializing...');
    const [errorMessage, setErrorMessage] = useState(null);

    // Debugging state for live camera positions
    const [camDebug, setCamDebug] = useState({
        position: { x: 0, y: 0, z: 0 },
        target: { x: 0, y: 0, z: 0 }
    });

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

    useEffect(() => { 
        if (!sceneID || !canvasContainerRef.current || !metadata) return;

        let renderer;
        let controls;
        let isMounted = true;

        async function initThree() { 

            renderer = new THREE.WebGPURenderer();
            await renderer.init();
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(window.devicePixelRatio);

            if (canvasContainerRef.current) {
                canvasContainerRef.current.appendChild(renderer.domElement);
            }

            const scene = new THREE.Scene();
            
            // Read dynamic FOV from metadata (fallback to 50 if missing)
            const fov = metadata.initial_camera?.fov || 50;
            const camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.01, 100);

            //getting initial camera position from metadata.json
            const camStartPos = metadata.initial_camera.position;
            console.log('cam position:', camStartPos);
            camera.position.set(camStartPos.x, camStartPos.y, camStartPos.z);

            //rotate camera to look at target point
            const camTargetPos = metadata.initial_camera.target;
            console.log('cam target position:', camTargetPos);
            camera.lookAt(camTargetPos.x, camTargetPos.y, camTargetPos.z);

            // Set initial state matching starting coordinates
            if (isMounted) {
                setCamDebug({
                    position: { x: camStartPos.x, y: camStartPos.y, z: camStartPos.z },
                    target: { x: camTargetPos.x, y: camTargetPos.y, z: camTargetPos.z }
                });
            }

            // Add OrbitControls for mouse interaction (rotation, pan, zoom)
            controls = new OrbitControls(camera, renderer.domElement);
            controls.target.set(camTargetPos.x, camTargetPos.y, camTargetPos.z);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.update();

            // Listen to any changes in camera view or perspective transformations
            controls.addEventListener('change', () => {
                if (isMounted) {
                    setCamDebug({
                        position: {
                            x: camera.position.x,
                            y: camera.position.y,
                            z: camera.position.z
                        },
                        target: {
                            x: controls.target.x,
                            y: controls.target.y,
                            z: controls.target.z
                        }
                    });
                }
            });

            //get the spz file from server
            const spzUrl = `${API_BASE_URL}/assets/${sceneID}/scene.spz`;
            const splatGeometry = await new SPZLoader().loadAsync(spzUrl);

            if (!isMounted) return;

            //wrap the splatgeometry in a special splat mesh
            const splats = new GaussianSplat(splatGeometry);
            //in supersplat rotation is degrees but three js uses radian
            if (metadata.model_transform?.rotation) {
                const rot = metadata.model_transform.rotation;
                splats.rotation.set(
                    THREE.MathUtils.degToRad(rot.x || 0),
                    THREE.MathUtils.degToRad(rot.y || 0),
                    THREE.MathUtils.degToRad(rot.z || 0)
                );
            }
            scene.add(splats);

            //render it - the mesh sorts itself every frame by default
            renderer.setAnimationLoop(() => {
                controls.update(); // Update orbit controls damping every frame
                renderer.render(scene, camera);
            });
        }

        initThree();

        //clean up
        return () => {
            isMounted = false;
            if (controls) {
                controls.dispose();
            }
            if (renderer) {
                renderer.setAnimationLoop(null);
                renderer.dispose();
                if (canvasContainerRef.current && renderer.domElement) {
                    canvasContainerRef.current.removeChild(renderer.domElement);
                }
            }
        };
    }, [sceneID, metadata]);

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

            {/* Live Camera Debugging HUD Overlay on Bottom Left */}
            <div style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                zIndex: 10,
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                color: '#00ff00',
                fontFamily: 'monospace',
                padding: '12px',
                borderRadius: '5px',
                fontSize: '12px',
                pointerEvents: 'none',
                lineHeight: '1.5'
            }}>
                <div style={{ fontWeight: 'bold', borderBottom: '1px solid #00ff00', marginBottom: '4px', paddingBottom: '2px' }}>CAMERA DEBUG HUD</div>
                <div>POS X: {camDebug.position.x.toFixed(3)}</div>
                <div>POS Y: {camDebug.position.y.toFixed(3)}</div>
                <div>POS Z: {camDebug.position.z.toFixed(3)}</div>
                <div style={{ marginTop: '6px', borderBottom: '1px solid #00ff00', paddingBottom: '2px' }}>TARGET (LOOK AT)</div>
                <div>TAR X: {camDebug.target.x.toFixed(3)}</div>
                <div>TAR Y: {camDebug.target.y.toFixed(3)}</div>
                <div>TAR Z: {camDebug.target.z.toFixed(3)}</div>
            </div>

            {/* The Three.js canvas will mount here later */}
            <div 
                ref={canvasContainerRef} 
                style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} 
            />
        </div>
    );
}
