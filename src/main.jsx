import React, { useRef, useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, OrbitControls, PerspectiveCamera, Plane } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useControls, Leva } from 'leva'

// 粒子总数 (建议 1500-3000，性能取决于设备)
const COUNT = 2000;
const dummy = new THREE.Object3D();
const mousePos = new THREE.Vector3(0, 0, 0);

// 生成圣诞树形状的目标位置数据 (秩序态)
function generateTreePositions(count) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    const t = i / count; // 0 到 1
    const angle = t * Math.PI * 40; // 螺旋圈数
    const radius = (1 - t) * 2.5; // 底部宽，顶部窄
    const y = t * 6 - 3; // 高度范围 -3 到 3
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    positions.push(x, y, z);
  }
  return positions;
}

const ParticleTree = () => {
  const meshRef = useRef();
  const { viewport, mouse } = useThree();
  const [hovered, setHover] = useState(false);

  // UI 控制面板参数
  const { explosionForce, returnSpeed, particleSize, coreColor, outerColor } = useControls('Arix Core Settings', {
    explosionForce: { value: 1.5, min: 0.1, max: 5, step: 0.1, label: '炸开力度' },
    returnSpeed: { value: 0.08, min: 0.01, max: 0.2, step: 0.01, label: '聚合速度' },
    particleSize: { value: 0.12, min: 0.05, max: 0.3, step: 0.01, label: '粒子大小' },
    coreColor: { value: '#ffea00', label: '核心光色' }, // 金色
    outerColor: { value: '#00ff9d', label: '边缘光色' } // 祖母绿光
  });
  
  // 初始化数据
  const { targetPositions, particles } = useMemo(() => {
    const targetPositions = generateTreePositions(COUNT);
    const particles = new Array(COUNT).fill(0).map(() => ({
      x: (Math.random() - 0.5) * 10, // 初始随机位置
      y: (Math.random() - 0.5) * 10,
      z: (Math.random() - 0.5) * 10,
      vx: 0, vy: 0, vz: 0, // 速度
      scale: Math.random() * 0.5 + 0.5, // 个体大小差异
    }));
    return { targetPositions, particles };
  }, []);
  
  const color1 = new THREE.Color(coreColor);
  const color2 = new THREE.Color(outerColor);

  useFrame((state) => {
    if (!meshRef.current) return;

    // 获取鼠标在 3D 空间中的投影位置（仅在 Z=0 平面附近）
    mousePos.set((mouse.x * viewport.width) / 2, (mouse.y * viewport.height) / 2, 0);
    // 计算鼠标到树中心的距离，决定炸开程度
    const mouseDistToCenter = mousePos.distanceTo(new THREE.Vector3(0,0,0));
    const isExploding = hovered || mouseDistToCenter < 2.5;

    particles.forEach((particle, i) => {
      // 1. 获取目标位置 (秩序态)
      const tx = targetPositions[i * 3];
      const ty = targetPositions[i * 3 + 1];
      const tz = targetPositions[i * 3 + 2];

      // 2. 计算斥力 (炸开态)
      let dx = particle.x - mousePos.x;
      let dy = particle.y - mousePos.y;
      let dz = particle.z - mousePos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      let forceX = 0, forceY = 0, forcez = 0;
      
      if (isExploding && dist < 5) {
          // 如果鼠标靠近，产生强斥力
          const force = (5 - dist) / 5 * explosionForce;
          forceX = dx / dist * force;
          forceY = dy / dist * force;
          forcez = dz / dist * force;
      } else {
          // 否则产生拉力回到目标位置 (弹簧物理)
          forceX = (tx - particle.x) * returnSpeed;
          forceY = (ty - particle.y) * returnSpeed;
          forcez = (tz - particle.z) * returnSpeed;
      }

      // 3. 应用物理
      particle.vx = particle.vx * 0.9 + forceX; // 0.9 是阻尼，防止无限震荡
      particle.vy = particle.vy * 0.9 + forceY;
      particle.vz = particle.vz * 0.9 + forcez;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.z += particle.vz;

      // 4. 更新 InstancedMesh 矩阵
      dummy.position.set(particle.x, particle.y, particle.z);
      // 炸开时粒子变大，聚合时变小
      const scaleIntensity = Math.min(1, Math.abs(particle.vx) + Math.abs(particle.vy))* 0.5;
      dummy.scale.setScalar(particle.scale * particleSize * (1 + scaleIntensity));
      dummy.rotation.set(particle.vx, particle.vy, particle.z); // 让粒子随速度旋转
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // 5. 动态颜色：速度越快越趋向核心色(金)，静止趋向边缘色(绿)
      const speed = Math.sqrt(particle.vx*particle.vx + particle.vy*particle.vy);
      const color = color2.clone().lerp(color1, Math.min(1, speed * 3));
      meshRef.current.setColorAt(i, color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    // 缓慢旋转整个群体
    meshRef.current.rotation.y += 0.002;
  });

  return (
    <>
      {/* 一个隐形的平面用于捕捉鼠标悬停事件，辅助触发炸开 */}
      <Plane args={[10, 10]} position={[0,0,0]} visible={false} 
          onPointerOver={() => setHover(true)} 
          onPointerOut={() => setHover(false)} 
      />
      <instancedMesh ref={meshRef} args={[null, null, COUNT]} castShadow receiveShadow>
        {/* 使用八面体作为粒子形状，比球体更有钻石感 */}
        <octahedronGeometry args={[1, 0]} /> 
        <meshStandardMaterial 
            toneMapped={false} // 关闭色调映射，让辉光更强烈
            metalness={0.8} 
            roughness={0.1}
            envMapIntensity={1}
        />
      </instancedMesh>
    </>
  );
};

const App = () => (
  <div style={{ width: '100vw', height: '100vh', background: '#000a05' }}>
    {/* Leva UI 面板配置 */}
    <Leva collapsed={false} theme={{
        colors: { highlight1: '#FFD700', highlight2: '#00ff9d' },
        fontSizes: { root: '12px' }
    }} flat fill />
    
    <Canvas dpr={[1, 2]} gl={{ antialias: false, alpha: false }}>
      <PerspectiveCamera makeDefault position={[0, 0, 12]} fov={50} />
      <color attach="background" args={['#000a05']} />
      
      {/* 灯光系统 */}
      <Environment preset="night" /> {/* 使用夜景环境光，对比度更高 */}
      <ambientLight intensity={0.2} color="#004d33" />
      {/* 核心强光，照亮炸开的瞬间 */}
      <pointLight position={[0, 0, 0]} intensity={15} color="#FFD700" distance={10} decay={2} />
      
      <ParticleTree />
      
      <OrbitControls 
        enableZoom={true} 
        enablePan={false} 
        minDistance={8} 
        maxDistance={20}
        autoRotate={true}
        autoRotateSpeed={0.5}
      />
      
      {/* 后期处理：制造绚丽效果的关键 */}
      <EffectComposer disableNormalPass>
          {/* 强烈的辉光 */}
          <Bloom luminanceThreshold={0.2} mipmapBlur luminanceSmoothing={0.4} intensity={2.5} />
          {/* 色散效果，增加科幻感 */}
          <ChromaticAberration offset={[0.002, 0.002]} />
          <Vignette eskil={false} offset={0.1} darkness={1.2} />
      </EffectComposer>
    </Canvas>
  </div>
)

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
