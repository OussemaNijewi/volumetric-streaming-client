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

    const canvasContainerRef = useRef(null);
    const hotspotRefs = useRef([]);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);

    const flightState = useRef({
        isFlying: false,
        targetPosition: new THREE.Vector3(),
        targetLookAt: new THREE.Vector3()
    });

    const [metadata, setMetadata] = useState(null);
    const [statusMessage, setStatusMessage] = useState('Initializing...');
    const [errorMessage, setErrorMessage] = useState(null);

    const [activeHotspotId, setActiveHotspotId] = useState(null);

    const [camDebug, setCamDebug] = useState({
        position: { x: 0, y: 0, z: 0 },
        target: { x: 0, y: 0, z: 0 }
    });

    const [assetRotation, setAssetRotation] = useState({ x: 0, y: 0, z: 0 });
    const splatsRef = useRef(null);

    const handleHotspotClick = (hotspot) => {
        if (activeHotspotId === hotspot.id) {
            setActiveHotspotId(null);
        } else {
            setActiveHotspotId(hotspot.id);
            if (hotspot.camera_flight) {
                const { position, target } = hotspot.camera_flight;
                flightState.current.targetPosition.set(position.x, position.y, position.z);
                flightState.current.targetLookAt.set(target.x, target.y, target.z);
                flightState.current.isFlying = true;
            }
        }
    };

    useEffect(() => {
        if (splatsRef.current) {
            splatsRef.current.rotation.set(
                THREE.MathUtils.degToRad(assetRotation.x),
                THREE.MathUtils.degToRad(assetRotation.y),
                THREE.MathUtils.degToRad(assetRotation.z)
            );
        }
    }, [assetRotation]);

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
            
            const fov = metadata.initial_camera?.fov || 50;
            const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 100);
            cameraRef.current = camera;

            const camStartPos = metadata.initial_camera.position;
            camera.position.set(camStartPos.x, camStartPos.y, camStartPos.z);

            const camTargetPos = metadata.initial_camera.target;
            camera.lookAt(camTargetPos.x, camTargetPos.y, camTargetPos.z);

            if (isMounted) {
                setCamDebug({
                    position: { x: camStartPos.x, y: camStartPos.y, z: camStartPos.z },
                    target: { x: camTargetPos.x, y: camTargetPos.y, z: camTargetPos.z }
                });
            }

            controls = new OrbitControls(camera, renderer.domElement);
            controlsRef.current = controls;
            
            controls.target.set(camTargetPos.x, camTargetPos.y, camTargetPos.z);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.update();

            controls.addEventListener('change', () => {
                if (isMounted) {
                    setCamDebug({
                        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
                        target: { x: controls.target.x, y: controls.target.y, z: controls.target.z }
                    });
                }
            });

            const spzUrl = `${API_BASE_URL}/assets/${sceneID}/scene.spz`;
            const splatGeometry = await new SPZLoader().loadAsync(spzUrl);

            if (!isMounted) return;

            const splats = new GaussianSplat(splatGeometry);
            splatsRef.current = splats;

            let initialRot = { x: 0, y: 0, z: 0 };
            if (metadata.model_transform?.rotation) {
                const rot = metadata.model_transform.rotation;
                initialRot = { x: rot.x || 0, y: rot.y || 0, z: rot.z || 0 };
            }

            if (isMounted) {
                setAssetRotation(initialRot);
            }

            splats.rotation.set(
                THREE.MathUtils.degToRad(initialRot.x),
                THREE.MathUtils.degToRad(initialRot.y),
                THREE.MathUtils.degToRad(initialRot.z)
            );
            scene.add(splats);

            const tempV = new THREE.Vector3();

            renderer.setAnimationLoop(() => {
                if (flightState.current.isFlying) {
                    controls.enabled = false;

                    camera.position.lerp(flightState.current.targetPosition, 0.05);
                    controls.target.lerp(flightState.current.targetLookAt, 0.05);

                    if (
                        camera.position.distanceTo(flightState.current.targetPosition) < 0.01 &&
                        controls.target.distanceTo(flightState.current.targetLookAt) < 0.01
                    ) {
                        camera.position.copy(flightState.current.targetPosition);
                        controls.target.copy(flightState.current.targetLookAt);
                        
                        flightState.current.isFlying = false;
                        controls.enabled = true;
                    }
                }

                controls.update(); 
                renderer.render(scene, camera);

                if (metadata && metadata.hotspots && hotspotRefs.current) {
                    metadata.hotspots.forEach((hs, index) => {
                        const el = hotspotRefs.current[index];
                        if (el) {
                            tempV.set(hs.hotspot_position.x, hs.hotspot_position.y, hs.hotspot_position.z);
                            tempV.project(camera);

                            if (tempV.z > 1.0) {
                                el.style.display = 'none';
                            } else {
                                const x = (tempV.x * 0.5 + 0.5) * window.innerWidth;
                                const y = (-(tempV.y * 0.5) + 0.5) * window.innerHeight;
                                
                                el.style.display = 'block';
                                el.style.transform = `translate(${x}px, ${y}px)`;
                            }
                        }
                    });
                }
            });
        }

        initThree();

        return () => {
            isMounted = false;
            if (controls) controls.dispose();
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
            <style>
                {`
                    .hotspot-marker {
                        transition: border-color 0.2s ease-in-out, transform 0.2s ease-in-out;
                    }
                    .hotspot-marker:hover {
                        border-color: #ffa500 !important;
                        transform: translate(-50%, -50%) scale(1.1) !important;
                    }
                `}
            </style>

            {metadata?.hotspots?.map((hotspot, index) => (
                <div
                    key={hotspot.id}
                    ref={(el) => (hotspotRefs.current[index] = el)}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        display: 'none',
                        zIndex: activeHotspotId === hotspot.id ? 25 : 15,
                        userSelect: 'none',
                        pointerEvents: 'none'
                    }}
                >
                    {/* Hotspot Circular Badge - Black background with white border */}
                    <div
                        className="hotspot-marker"
                        onClick={() => handleHotspotClick(hotspot)}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            transform: 'translate(-50%, -50%)',
                            width: '32px',
                            height: '32px',
                            backgroundColor: '#000000',
                            color: '#ffffff',
                            border: '2px solid #ffffff',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontFamily: 'sans-serif',
                            fontSize: '14px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                            pointerEvents: 'auto'
                        }}
                        title={hotspot.label}
                    >
                        {hotspot.id}
                    </div>

                    {/* Popup Card */}
                    {activeHotspotId === hotspot.id && (
                        <div style={{
                            position: 'absolute',
                            left: '22px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            backgroundColor: 'rgba(20, 20, 20, 0.92)',
                            color: '#ffffff',
                            padding: '12px 16px',
                            borderRadius: '8px',
                            width: '260px',
                            boxShadow: '0 6px 20px rgba(0,0,0,0.6)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            fontFamily: 'sans-serif',
                            pointerEvents: 'auto'
                        }}>
                            <div style={{
                                fontWeight: 'bold',
                                fontSize: '14px',
                                marginBottom: '4px',
                                color: '#ffffff'
                            }}>
                                {hotspot.title}
                            </div>
                            <div style={{
                                fontSize: '12px',
                                lineHeight: '1.4',
                                color: '#cccccc'
                            }}>
                                {hotspot.description}
                            </div>
                        </div>
                    )}
                </div>
            ))}

            <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10 }}>
                <button onClick={() => navigate('/')} style={{ padding: '8px 16px', cursor: 'pointer' }}>
                    ← Back to Gallery
                </button>
            </div>

            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 5, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', width: '20px', height: '20px', border: '2px solid #00bfff', borderRadius: '50%', boxShadow: '0 0 8px rgba(0, 191, 255, 0.7)' }} />
                <div style={{ width: '5px', height: '5px', backgroundColor: '#00bfff', borderRadius: '50%', boxShadow: '0 0 6px #00bfff' }} />
            </div>

            <div style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 10, backgroundColor: 'rgba(0, 0, 0, 0.75)', color: '#00ff00', fontFamily: 'monospace', padding: '12px', borderRadius: '5px', fontSize: '12px', pointerEvents: 'none', lineHeight: '1.5' }}>
                <div style={{ fontWeight: 'bold', borderBottom: '1px solid #00ff00', marginBottom: '4px', paddingBottom: '2px' }}>CAMERA DEBUG HUD</div>
                <div>POS X: {camDebug.position.x.toFixed(3)}</div>
                <div>POS Y: {camDebug.position.y.toFixed(3)}</div>
                <div>POS Z: {camDebug.position.z.toFixed(3)}</div>
                <div style={{ marginTop: '6px', borderBottom: '1px solid #00ff00', paddingBottom: '2px' }}>TARGET (LOOK AT)</div>
                <div>TAR X: {camDebug.target.x.toFixed(3)}</div>
                <div>TAR Y: {camDebug.target.y.toFixed(3)}</div>
                <div>TAR Z: {camDebug.target.z.toFixed(3)}</div>
            </div>

            <div style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 10, backgroundColor: 'rgba(0, 0, 0, 0.85)', color: '#00ffff', fontFamily: 'monospace', padding: '14px', borderRadius: '6px', fontSize: '12px', lineHeight: '1.5', width: '270px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                <div style={{ fontWeight: 'bold', borderBottom: '1px solid #00ffff', marginBottom: '8px', paddingBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>ASSET ROTATION DEBUG</span>
                    <button onClick={() => setAssetRotation({ x: 0, y: 0, z: 0 })} style={{ background: 'transparent', border: '1px solid #00ffff', color: '#00ffff', cursor: 'pointer', fontSize: '10px', padding: '1px 6px', borderRadius: '3px' }}>RESET</button>
                </div>
                <div style={{ marginBottom: '8px', display: 'flex', gap: '6px' }}>
                    <button onClick={() => setAssetRotation(r => ({ ...r, x: r.x + 180 }))} style={{ flex: 1, background: '#003333', border: '1px solid #00ffff', color: '#00ffff', cursor: 'pointer', padding: '4px', fontSize: '10px', borderRadius: '3px', fontWeight: 'bold' }} title="Quick fix for upside-down assets">+180° X (Flip Upside-Down)</button>
                </div>
                {['x', 'y', 'z'].map((axis) => (
                    <div key={axis} style={{ marginBottom: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <span style={{ textTransform: 'uppercase' }}>ROT {axis}: {assetRotation[axis].toFixed(1)}°</span>
                            <span style={{ color: '#888888' }}>({THREE.MathUtils.degToRad(assetRotation[axis]).toFixed(3)} rad)</span>
                        </div>
                        <input type="range" min="-180" max="180" step="1" value={assetRotation[axis]} onChange={(e) => setAssetRotation({ ...assetRotation, [axis]: parseFloat(e.target.value) })} style={{ width: '100%', cursor: 'pointer' }} />
                    </div>
                ))}
            </div>

            <div ref={canvasContainerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
        </div>
    );
}