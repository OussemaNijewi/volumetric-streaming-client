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
    const [activeHotspotId, setActiveHotspotId] = useState(null);

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
        if (!sceneID) return;

        async function fetchMetadata() {
            try {
                const response = await fetch(`${API_BASE_URL}/assets/${sceneID}/metadata.json`);
                if (!response.ok) { 
                    throw new Error(`HTTP Error ${response.status}: Could not load metadata.json`);
                }
                const data = await response.json();
                setMetadata(data);
            } catch (err) { 
                console.error('Error fetching metadata:', err);
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
            
            const camera = new THREE.PerspectiveCamera(
                metadata.initial_camera?.fov || 50, 
                window.innerWidth / window.innerHeight, 
                0.01, 
                100
            );
            cameraRef.current = camera;

            const camStartPos = metadata.initial_camera.position;
            camera.position.set(camStartPos.x, camStartPos.y, camStartPos.z);

            const camTargetPos = metadata.initial_camera.target;
            camera.lookAt(camTargetPos.x, camTargetPos.y, camTargetPos.z);

            controls = new OrbitControls(camera, renderer.domElement);
            controlsRef.current = controls;
            
            controls.target.set(camTargetPos.x, camTargetPos.y, camTargetPos.z);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.update();

            const spzUrl = `${API_BASE_URL}/assets/${sceneID}/scene.spz`;
            const splatGeometry = await new SPZLoader().loadAsync(spzUrl);

            if (!isMounted) return;

            const splats = new GaussianSplat(splatGeometry);
            
            if (metadata.model_transform?.rotation) {
                const rot = metadata.model_transform.rotation;
                splats.rotation.set(
                    THREE.MathUtils.degToRad(rot.x || 0),
                    THREE.MathUtils.degToRad(rot.y || 0),
                    THREE.MathUtils.degToRad(rot.z || 0)
                );
            }
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
                <button 
                    onClick={() => navigate('/')} 
                    style={{ 
                        padding: '8px 16px', 
                        cursor: 'pointer', 
                        backgroundColor: 'rgba(20, 20, 20, 0.8)', 
                        color: '#ffffff', 
                        border: '1px solid rgba(255,255,255,0.2)', 
                        borderRadius: '6px', 
                        fontFamily: 'sans-serif', 
                        fontWeight: '500' 
                    }}
                >
                    ← Back to Gallery
                </button>
            </div>

            <div ref={canvasContainerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
        </div>
    );
}