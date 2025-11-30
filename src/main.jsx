import React, { useRef, useMemo } from 'react'
import ReactDOM from 'react-dom/client'
import { Canvas, useFrame, extend } from '@react-three/fiber'
import { Environment, OrbitControls, Float, Sparkles, ContactShadows } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import * as THREE from 'three'
import { shaderMaterial } from '@react-three/drei'

// --- 材质定义 ---
const ArixLuxuryMaterial = shaderMaterial(
  {
    uTime: 0,
    uColorBase: new THREE.Color('#001a12'), 
    uColorSecondary: new THREE.Color('#004d33'), 
    uColorGold: new THREE.Color('#FFD700'), 
  },
  `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  `
    uniform float uTime;
    uniform vec3 uColorBase;
    uniform vec3 uColorSecondary;
    uniform vec3 uColorGold;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m ;
      m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    void main() {
      float noiseVal = snoise(vUv * 4.0 + uTime * 0.1); 
      vec3 base = mix(uColorBase, uColorSecondary, noiseVal * 0.5 + 0.5);
      float goldPattern = snoise(vUv * 10.0 - uTime * 0.05);
      float goldMask = smoothstep(0.7, 0.75, goldPattern); 
      vec3 viewDir = normalize(vViewPosition);
      float fresnel = pow(1.0 - dot(vViewPosition, vNormal), 3.0);
      vec3 finalColor = mix(base, uColorGold, goldMask); 
      if (goldMask > 0.1) { finalColor *= 2.0; }
      finalColor += uColorSecondary * fresnel * 0.5;
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
);
extend({ ArixLuxuryMaterial });

// --- 组件部分 ---
const RotatingTree = () => {
  const materialRef = useRef();
  useFrame((state, delta) => {
    if (materialRef.current) materialRef.current.uTime += delta;
  });
  return (
    <mesh position={[0, 0.5, 0]} castShadow>
      <coneGeometry args={[1.5, 5, 128, 32]} /> 
      {/* @ts-ignore */}
      <arixLuxuryMaterial ref={materialRef} />
    </mesh>
  );
};

const FloatingOrnaments = () => {
  const count = 30;
  const items = useMemo(() => new Array(count).fill(0).map((_, i) => {
    const angle = (i / count) * Math.PI * 8;
    const y = (i / count) * 4 - 1.5;
    const radius = 1.8 - (y + 1.5) * 0.35;
    return { position: [Math.sin(angle) * radius, y, Math.cos(angle) * radius], scale: Math.random() * 0.15 + 0.1 };
  }), []);
  return (
    <group>
      {items.map((item, i) => (
        <Float key={i} speed={2} rotationIntensity={1} floatIntensity={1}>
          <mesh position={item.position} scale={item.scale} castShadow>
            <sphereGeometry args={[1, 32, 32]} />
            <meshStandardMaterial color="#FFD700" metalness={1} roughness={0.1} emissive="#FFD700" emissiveIntensity={0.5} />
          </mesh>
        </Float>
      ))}
    </group>
  );
};

const ArixLogo = () => (
  <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.2}>
    <group position={[0, 3.2, 0]}>
      <mesh>
        <octahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFD700" emissiveIntensity={4} toneMapped={false} />
      </mesh>
      <mesh rotation={[Math.PI/2, 0, 0]}>
        <torusGeometry args={[0.6, 0.02, 16, 100]} />
        <meshBasicMaterial color="#FFD700" />
      </mesh>
    </group>
  </Float>
);

const App = () => (
  <div style={{ width: '100vw', height: '100vh', background: '#000805' }}>
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0, 7], fov: 40 }} gl={{ antialias: false, toneMapping: THREE.ReinhardToneMapping, toneMappingExposure: 1.5 }}>
      <Environment preset="city" />
      <spotLight position={[5, 10, 5]} angle={0.25} penumbra={1} intensity={20} color="#ffeebf" castShadow />
      <pointLight position={[-5, 0, -5]} intensity={2} color="#004d33" />
      <group position={[0, -1, 0]}>
          <RotatingTree />
          <FloatingOrnaments />
          <ArixLogo />
      </group>
      <Sparkles count={200} scale={[8, 8, 8]} size={3} speed={0.3} opacity={0.5} color="#FFD700" />
      <ContactShadows resolution={1024} scale={10} blur={2.5} opacity={0.5} far={10} color="#000000" />
      <OrbitControls enablePan={false} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 1.8} autoRotate autoRotateSpeed={0.8} />
      <EffectComposer disableNormalPass>
          <Bloom luminanceThreshold={1.1} mipmapBlur intensity={1.2} radius={0.7} />
          <Noise opacity={0.02} /> 
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
      </EffectComposer>
    </Canvas>
  </div>
)

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
