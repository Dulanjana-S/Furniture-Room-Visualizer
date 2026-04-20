import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls, PerspectiveCamera, SoftShadows } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useEffect, useMemo, useRef } from 'react';
import { FurnitureItem, RoomSpec } from '../../types/design';

type Props = {
  roomSpec: RoomSpec;
  furniture: FurnitureItem[];
  selectedId?: string | null;
  onExportReady?: (exportFn: (() => string) | null) => void;
};

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }

function buildFloor(room: RoomSpec) {
  const w = room.width;
  const h = room.height;
  if (room.shape !== 'l-shaped') {
    const g = new THREE.PlaneGeometry(w, h);
    g.rotateX(-Math.PI / 2);
    g.translate(w / 2, 0, h / 2);
    g.computeVertexNormals();
    return g;
  }

  const nw = clamp(room.notchWidth ?? 2, 0.5, w - 0.5);
  const nh = clamp(room.notchHeight ?? 2, 0.5, h - 0.5);

  // L-shape: notch removed from TOP-RIGHT corner (same as 2D).
  // Because we rotate with -PI/2 and then translate by +h on Z, we define
  // the shape with Y inverted so final Z coordinates line up with room/furniture.
  const shape = new THREE.Shape();
  shape.moveTo(0, h);
  shape.lineTo(w - nw, h);
  shape.lineTo(w - nw, h - nh);
  shape.lineTo(w, h - nh);
  shape.lineTo(w, 0);
  shape.lineTo(0, 0);
  shape.closePath();

  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  // ShapeGeometry starts in XY (y: 0..h); after rotateX it lands in z: 0..-h.
  // Shift it forward so floor coordinates match room/wall/furniture space (z: 0..h).
  g.translate(0, 0, h);
  g.computeVertexNormals();
  return g;
}

function wallSegments(room: RoomSpec) {
  const t = 0.08;
  const wallH = 2.4;
  const w = room.width;
  const h = room.height;

  if (room.shape !== 'l-shaped') {
    return [
      { pos: [w / 2, wallH / 2, -t / 2] as const, size: [w, wallH, t] as const },
      { pos: [w / 2, wallH / 2, h + t / 2] as const, size: [w, wallH, t] as const },
      { pos: [-t / 2, wallH / 2, h / 2] as const, size: [t, wallH, h] as const },
      { pos: [w + t / 2, wallH / 2, h / 2] as const, size: [t, wallH, h] as const },
    ];
  }

  const nw = clamp(room.notchWidth ?? 2, 0.5, w - 0.5);
  const nh = clamp(room.notchHeight ?? 2, 0.5, h - 0.5);

  // Trace the L boundary with wall pieces
  return [
    // Bottom wall (0..w-nw)
    { pos: [(w - nw) / 2, wallH / 2, -t / 2] as const, size: [w - nw, wallH, t] as const },
    // Notch vertical wall
    { pos: [w - nw + t / 2, wallH / 2, nh / 2] as const, size: [t, wallH, nh] as const },
    // Notch horizontal wall
    { pos: [w - nw / 2, wallH / 2, nh + t / 2] as const, size: [nw, wallH, t] as const },
    // Right wall (from nh..h)
    { pos: [w + t / 2, wallH / 2, (h + nh) / 2] as const, size: [t, wallH, h - nh] as const },
    // Top wall (full width)
    { pos: [w / 2, wallH / 2, h + t / 2] as const, size: [w, wallH, t] as const },
    // Left wall
    { pos: [-t / 2, wallH / 2, h / 2] as const, size: [t, wallH, h] as const },
  ];
}

function guessHeight(type: FurnitureItem['type']) {
  switch (type) {
    case 'chair': return 0.9;
    case 'dining-table': return 0.75;
    case 'side-table': return 0.55;
    case 'coffee-table': return 0.45;
    case 'desk': return 0.75;
    case 'sofa': return 0.9;
    case 'bed': return 0.6;
    case 'cabinet': return 1.8;
    case 'wardrobe': return 2.0;
    case 'bookshelf': return 2.1;
    case 'tv-stand': return 0.55;
    default: return 0.8;
  }
}

function FurnitureMesh({ item, selected, roomShadow }: { item: FurnitureItem; selected: boolean; roomShadow: boolean }) {
  const w = item.width * item.scale;
  const d = item.height * item.scale;
  const h = (item.zHeight && item.zHeight > 0) ? item.zHeight : guessHeight(item.type);
  const cx = item.x + w / 2;
  const cz = item.y + d / 2;
  const rotY = (item.rotation * Math.PI) / 180;

  const shading = (item.shadow ?? false) || roomShadow;
  const mat = useMemo(() => {
    if (!shading) return new THREE.MeshBasicMaterial({ color: new THREE.Color(item.color) });
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(item.color),
      roughness: 0.6,
      metalness: 0.05,
      envMapIntensity: 0.55,
    });
  }, [item.color, shading]);

  const legMat = useMemo(() => {
    if (!shading) return new THREE.MeshBasicMaterial({ color: new THREE.Color('#3b3b3b') });
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3b3b3b'),
      roughness: 0.65,
      metalness: 0.25,
      envMapIntensity: 0.4,
    });
  }, [shading]);

  return (
    <group position={[cx, 0, cz]} rotation={[0, rotY, 0]}>
      {/* Simple parametric furniture (more realistic than a single cube) */}
      {(() => {
        const legs = (legH: number, thickness: number, inset: number) => (
          <group>
            {([
              [ w / 2 - inset, legH / 2,  d / 2 - inset],
              [-w / 2 + inset, legH / 2,  d / 2 - inset],
              [ w / 2 - inset, legH / 2, -d / 2 + inset],
              [-w / 2 + inset, legH / 2, -d / 2 + inset],
            ] as [number, number, number][])?.map((p, i) => (
              <mesh key={i} position={p} castShadow receiveShadow>
                <boxGeometry args={[thickness, legH, thickness]} />
                <primitive object={legMat} attach="material" />
              </mesh>
            ))}
          </group>
        );

        switch (item.type) {
          case 'dining-table':
          case 'coffee-table':
          case 'side-table': {
            const topT = item.type === 'coffee-table' ? 0.05 : 0.06;
            const legH = Math.max(0.12, h - topT);
            const inset = item.type === 'side-table' ? 0.12 : 0.18;
            const legTh = item.type === 'side-table' ? 0.05 : 0.06;
            return (
              <group>
                <mesh position={[0, legH + topT / 2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[w, topT, d]} />
                  <primitive object={mat} attach="material" />
                </mesh>
                {legs(legH, legTh, inset)}
              </group>
            );
          }

          case 'desk': {
            const topT = 0.055;
            const legH = Math.max(0.15, h - topT);
            const pedestalW = Math.max(0.2, w * 0.22);
            const pedestalD = Math.max(0.22, d * 0.78);
            const legInset = Math.max(0.1, w * 0.12);
            return (
              <group>
                <mesh position={[0, legH + topT / 2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[w, topT, d]} />
                  <primitive object={mat} attach="material" />
                </mesh>
                <mesh position={[-w / 2 + pedestalW / 2, legH / 2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[pedestalW, legH, pedestalD]} />
                  <primitive object={mat} attach="material" />
                </mesh>
                <mesh position={[w / 2 - legInset, legH / 2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[0.07, legH, 0.07]} />
                  <primitive object={legMat} attach="material" />
                </mesh>
                <mesh position={[w / 2 - legInset - 0.22, legH / 2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[0.07, legH, 0.07]} />
                  <primitive object={legMat} attach="material" />
                </mesh>
                <mesh position={[0, legH * 0.5, -d / 2 + 0.03]} castShadow receiveShadow>
                  <boxGeometry args={[w * 0.72, legH * 0.3, 0.04]} />
                  <primitive object={legMat} attach="material" />
                </mesh>
              </group>
            );
          }

          case 'chair': {
            const seatT = 0.06;
            const seatTop = Math.max(0.35, h * 0.5);
            const legH = Math.max(0.18, seatTop - seatT);
            const backH = Math.max(0.25, h - seatTop);
            return (
              <group>
                {/* seat */}
                <mesh position={[0, legH + seatT / 2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[w, seatT, d]} />
                  <primitive object={mat} attach="material" />
                </mesh>
                {/* back */}
                <mesh position={[0, seatTop + backH / 2, -d / 2 + 0.04]} castShadow receiveShadow>
                  <boxGeometry args={[w, backH, 0.08]} />
                  <primitive object={mat} attach="material" />
                </mesh>
                {legs(legH, 0.045, 0.16)}
              </group>
            );
          }

          case 'sofa': {
            const baseH = 0.28;
            const seatH = 0.18;
            const backH = Math.max(0.28, h - baseH - seatH);
            const armW = Math.min(0.18, w * 0.18);
            return (
              <group>
                <mesh position={[0, baseH / 2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[w, baseH, d]} />
                  <primitive object={mat} attach="material" />
                </mesh>
                <mesh position={[0, baseH + seatH / 2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[w - armW * 2, seatH, d - 0.12]} />
                  <primitive object={mat} attach="material" />
                </mesh>
                <mesh position={[w / 2 - armW / 2, (baseH + seatH) / 2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[armW, baseH + seatH, d - 0.06]} />
                  <primitive object={mat} attach="material" />
                </mesh>
                <mesh position={[-w / 2 + armW / 2, (baseH + seatH) / 2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[armW, baseH + seatH, d - 0.06]} />
                  <primitive object={mat} attach="material" />
                </mesh>
                <mesh position={[0, baseH + seatH + backH / 2, -d / 2 + 0.06]} castShadow receiveShadow>
                  <boxGeometry args={[w, backH, 0.12]} />
                  <primitive object={mat} attach="material" />
                </mesh>
              </group>
            );
          }

          case 'bed': {
            const baseH = 0.20;
            const mattressH = Math.max(0.16, Math.min(0.26, h - baseH));
            const headH = 0.75;
            return (
              <group>
                <mesh position={[0, baseH / 2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[w, baseH, d]} />
                  <primitive object={mat} attach="material" />
                </mesh>
                <mesh position={[0, baseH + mattressH / 2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[w * 0.98, mattressH, d * 0.96]} />
                  <primitive object={mat} attach="material" />
                </mesh>
                <mesh position={[0, headH / 2, -d / 2 + 0.05]} castShadow receiveShadow>
                  <boxGeometry args={[w, headH, 0.10]} />
                  <primitive object={mat} attach="material" />
                </mesh>
              </group>
            );
          }

          case 'wardrobe':
          case 'cabinet': {
            const bodyH = Math.max(0.6, h);
            return (
              <group>
                <mesh position={[0, bodyH / 2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[w, bodyH, d]} />
                  <primitive object={mat} attach="material" />
                </mesh>
                {/* subtle door split */}
                <mesh position={[0, bodyH / 2, d / 2 + 0.002]}>
                  <boxGeometry args={[0.01, bodyH * 0.9, 0.002]} />
                  <meshBasicMaterial color={'#ffffff'} transparent opacity={0.14} />
                </mesh>
              </group>
            );
          }

          case 'bookshelf': {
            const bodyH = Math.max(1.6, h);
            const sideT = 0.05;
            const shelfT = 0.04;
            const shelfCount = 4;
            return (
              <group>
                <mesh position={[0, bodyH / 2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[w, bodyH, d]} />
                  <primitive object={mat} attach="material" />
                </mesh>
                <mesh position={[0, bodyH / 2, d / 2 + 0.001]}>
                  <boxGeometry args={[w * 0.02, bodyH * 0.9, 0.002]} />
                  <meshBasicMaterial color={'#ffffff'} transparent opacity={0.12} />
                </mesh>
                {Array.from({ length: shelfCount }).map((_, i) => {
                  const y = (bodyH / (shelfCount + 1)) * (i + 1);
                  return (
                    <mesh key={i} position={[0, y, 0]} castShadow receiveShadow>
                      <boxGeometry args={[w - sideT * 2, shelfT, d - 0.03]} />
                      <primitive object={legMat} attach="material" />
                    </mesh>
                  );
                })}
              </group>
            );
          }

          case 'tv-stand': {
            const bodyH = Math.max(0.45, h);
            const footH = 0.06;
            const topT = 0.05;
            return (
              <group>
                <mesh position={[0, bodyH / 2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[w, bodyH, d]} />
                  <primitive object={mat} attach="material" />
                </mesh>
                <mesh position={[0, bodyH + topT / 2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[w + 0.02, topT, d + 0.02]} />
                  <primitive object={legMat} attach="material" />
                </mesh>
                <mesh position={[-w * 0.3, footH / 2, d / 2 - 0.03]} castShadow receiveShadow>
                  <boxGeometry args={[0.12, footH, 0.08]} />
                  <primitive object={legMat} attach="material" />
                </mesh>
                <mesh position={[w * 0.3, footH / 2, d / 2 - 0.03]} castShadow receiveShadow>
                  <boxGeometry args={[0.12, footH, 0.08]} />
                  <primitive object={legMat} attach="material" />
                </mesh>
              </group>
            );
          }

          default:
            return (
              <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[w, h, d]} />
                <primitive object={mat} attach="material" />
              </mesh>
            );
        }
      })()}
      {selected && (
        <mesh position={[0, h + 0.02, 0]}>
          <boxGeometry args={[w * 1.04, 0.02, d * 1.04]} />
          <meshBasicMaterial color={'#3b82f6'} transparent opacity={0.65} />
        </mesh>
      )}
    </group>
  );
}

export default function Canvas3DThree({ roomSpec, furniture, selectedId, onExportReady }: Props) {
  const controlsRef = useRef<any>(null);
  const exportRef = useRef<(() => string) | null>(null);
  const floorGeom = useMemo(() => buildFloor(roomSpec), [roomSpec]);
  const segments = useMemo(() => wallSegments(roomSpec), [roomSpec]);

  const roomW = roomSpec.width;
  const roomH = roomSpec.height;
  const roomShadow = !!roomSpec.globalShadow;

  // Expose export function to parent (for toolbar "Export" button)
  // Note: real export function is set in onCreated.
  useEffect(() => {
    onExportReady?.(exportRef.current);
    return () => onExportReady?.(null);
  }, [onExportReady]);

  return (
    <div className="w-full h-full rounded-lg overflow-hidden border border-slate-800 bg-[#0F172A] relative" style={{ width: '100%', height: '100%' }}>
      <Canvas
        style={{ width: '100%', height: '100%' }}
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' as any, preserveDrawingBuffer: true }}
        onCreated={({ gl, scene }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          scene.fog = new THREE.Fog('#e9eef7', 10, 30);

          // Procedural studio-like environment for more realistic materials (no external HDR needed)
          try {
            const pmrem = new THREE.PMREMGenerator(gl);
            const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
            scene.environment = envTex;
            pmrem.dispose();
          } catch {
            // If environment setup fails, keep default lighting.
          }

          // Provide export function (3D snapshot) without UI overlays.
          exportRef.current = () => gl.domElement.toDataURL('image/png');
          onExportReady?.(exportRef.current);
        }}
      >
        <SoftShadows size={18} samples={12} focus={0.45} />
        <color attach="background" args={['#eef2ff']} />

        <PerspectiveCamera makeDefault position={[Math.max(6, roomW + 2), 5.0, Math.max(6, roomH + 2)]} fov={55} />
        <OrbitControls
          ref={controlsRef}
          target={[roomW / 2, 0.9, roomH / 2]}
          enableDamping
          dampingFactor={0.08}
        />

        <hemisphereLight intensity={0.75} args={['#ffffff', '#6b7280', 1]} />
        <directionalLight
          position={[roomW + 4, 8, roomH + 3]}
          intensity={1.15}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={0.5}
          shadow-camera-far={60}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <directionalLight position={[-6, 4, -5]} intensity={0.25} />
        <pointLight position={[roomW * 0.2, 2.4, roomH * 0.22]} intensity={0.2} color={'#dbeafe'} />
        <pointLight position={[roomW * 0.8, 2.2, roomH * 0.78]} intensity={0.16} color={'#f8fafc'} />

        {/* Floor */}
        <mesh geometry={floorGeom} receiveShadow>
          <meshStandardMaterial color={roomSpec.floorColor} roughness={0.92} metalness={0.0} envMapIntensity={0.25} />
        </mesh>

        {/* Walls */}
        {segments.map((s, idx) => (
          <mesh key={idx} position={s.pos} castShadow receiveShadow>
            <boxGeometry args={s.size} />
            <meshStandardMaterial color={roomSpec.wallColor} roughness={0.95} metalness={0.0} envMapIntensity={0.18} />
          </mesh>
        ))}

        {/* Furniture */}
        {furniture.map((it) => (
          <FurnitureMesh
            key={it.id}
            item={it}
            selected={it.id === selectedId}
            roomShadow={roomShadow}
          />
        ))}

        {/* Contact shadow for grounded realism */}
        <ContactShadows
          position={[roomW / 2, 0.001, roomH / 2]}
          opacity={roomShadow ? 0.38 : 0.18}
          scale={Math.max(roomW, roomH) + 2}
          blur={2.7}
          far={10}
          resolution={1024}
        />
      </Canvas>

      {/* Reset button overlay */}
      <div className="absolute top-4 right-4">
        <button
          onClick={() => controlsRef.current?.reset?.()}
          className="bg-slate-900/85 backdrop-blur-sm hover:bg-slate-900 rounded-lg border border-slate-700 shadow-xl px-3 py-2 text-xs font-medium text-slate-200 transition-colors"
        >
          Reset Camera
        </button>
      </div>
    </div>
  );
}
