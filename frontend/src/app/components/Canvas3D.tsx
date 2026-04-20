import { FurnitureItem, RoomSpec } from '../../types/design';
import { useState } from 'react';

interface Canvas3DProps {
  roomSpec: RoomSpec;
  furniture: FurnitureItem[];
}

// Enhanced pseudo-3D view using CSS transforms with interactive controls
export default function Canvas3D({ roomSpec, furniture }: Canvas3DProps) {
  const scale = 40; // pixels per meter
  const perspective = 1000;
  
  const [rotateX, setRotateX] = useState(60);
  const [rotateZ, setRotateZ] = useState(-30);
  const [zoom, setZoom] = useState(1);

  // Interactive mouse controls
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startPos.x;
    const deltaY = e.clientY - startPos.y;
    
    setRotateX(prev => Math.max(0, Math.min(90, prev - deltaY * 0.2)));
    setRotateZ(prev => prev - deltaX * 0.2);
    
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.max(0.5, Math.min(2, prev - e.deltaY * 0.001)));
  };

  return (
    <div 
      className="w-full h-[600px] rounded-lg overflow-hidden border border-gray-300 bg-gradient-to-b from-sky-100 to-gray-100 relative cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <div 
        className="absolute inset-0 flex items-center justify-center"
        style={{ perspective: `${perspective}px` }}
      >
        <div 
          className="relative transition-transform duration-100"
          style={{ 
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rotateX}deg) rotateZ(${rotateZ}deg) scale(${zoom})`,
          }}
        >
          {/* Floor */}
          <div
            className="absolute border-2 border-gray-400 shadow-2xl"
            style={{
              width: `${roomSpec.width * scale}px`,
              height: `${roomSpec.height * scale}px`,
              backgroundColor: roomSpec.floorColor,
              transform: `translate(-50%, -50%)`,
              left: '50%',
              top: '50%',
            }}
          >
            {/* Grid lines on floor */}
            <svg 
              className="absolute inset-0 w-full h-full opacity-20"
              style={{ pointerEvents: 'none' }}
            >
              {Array.from({ length: Math.ceil(roomSpec.width) + 1 }).map((_, i) => (
                <line
                  key={`v-${i}`}
                  x1={`${(i / roomSpec.width) * 100}%`}
                  y1="0%"
                  x2={`${(i / roomSpec.width) * 100}%`}
                  y2="100%"
                  stroke="black"
                  strokeWidth="1"
                />
              ))}
              {Array.from({ length: Math.ceil(roomSpec.height) + 1 }).map((_, i) => (
                <line
                  key={`h-${i}`}
                  x1="0%"
                  y1={`${(i / roomSpec.height) * 100}%`}
                  x2="100%"
                  y2={`${(i / roomSpec.height) * 100}%`}
                  stroke="black"
                  strokeWidth="1"
                />
              ))}
            </svg>

            {/* Furniture items */}
            {furniture.map((item) => {
              const width = item.width * item.scale * scale;
              const height = item.height * item.scale * scale;
              const x = item.x * scale;
              const y = item.y * scale;
              const furnitureHeight = 30; // 3D height
              
              // Apply shadows (individual or global)
              const itemShadow = item.shadow ?? false;
              const shadowEnabled = itemShadow || roomSpec.globalShadow;
              const shadowIntensity = itemShadow 
                ? (item.shadowIntensity ?? 0.5) 
                : (roomSpec.globalShadowIntensity ?? 0.5);
              
              return (
                <div
                  key={item.id}
                  className="absolute transition-all"
                  style={{
                    width: `${width}px`,
                    height: `${height}px`,
                    left: `${x}px`,
                    top: `${y}px`,
                    transformStyle: 'preserve-3d',
                    transform: `rotateZ(${item.rotation}deg)`,
                  }}
                  title={item.name}
                >
                  {/* Shadow on floor */}
                  {shadowEnabled && (
                    <div
                      className="absolute"
                      style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: `rgba(0, 0, 0, ${shadowIntensity * 0.3})`,
                        filter: `blur(${10 * shadowIntensity}px)`,
                        transform: `translateZ(1px) translateX(${3 * shadowIntensity}px) translateY(${3 * shadowIntensity}px)`,
                        borderRadius: '4px',
                      }}
                    />
                  )}
                  
                  {/* Bottom face */}
                  <div
                    className="absolute border border-gray-800/30"
                    style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: item.color,
                      filter: 'brightness(0.6) saturate(1.2)',
                    }}
                  />
                  
                  {/* Top face */}
                  <div
                    className="absolute border border-gray-900/40"
                    style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: item.color,
                      filter: 'brightness(1.3) saturate(1.3)',
                      transform: `translateZ(${furnitureHeight}px)`,
                      boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
                    }}
                  />
                  
                  {/* Front face */}
                  <div
                    className="absolute border-l border-r border-gray-800/30"
                    style={{
                      width: '100%',
                      height: `${furnitureHeight}px`,
                      backgroundColor: item.color,
                      filter: 'brightness(1.0) saturate(1.2)',
                      transformOrigin: 'bottom',
                      transform: `translateY(100%) rotateX(-90deg)`,
                    }}
                  />
                  
                  {/* Back face */}
                  <div
                    className="absolute border-l border-r border-gray-800/30"
                    style={{
                      width: '100%',
                      height: `${furnitureHeight}px`,
                      backgroundColor: item.color,
                      filter: 'brightness(0.7) saturate(1.1)',
                      transformOrigin: 'top',
                      transform: `rotateX(-90deg)`,
                    }}
                  />
                  
                  {/* Left face */}
                  <div
                    className="absolute border-t border-b border-gray-800/30"
                    style={{
                      width: `${furnitureHeight}px`,
                      height: '100%',
                      backgroundColor: item.color,
                      filter: 'brightness(0.85) saturate(1.15)',
                      transformOrigin: 'left',
                      transform: `rotateY(90deg)`,
                    }}
                  />
                  
                  {/* Right face */}
                  <div
                    className="absolute border-t border-b border-gray-800/30"
                    style={{
                      width: `${furnitureHeight}px`,
                      height: '100%',
                      backgroundColor: item.color,
                      filter: 'brightness(0.75) saturate(1.1)',
                      transformOrigin: 'right',
                      transform: `translateX(100%) rotateY(90deg)`,
                    }}
                  />
                  
                  {/* Label on top */}
                  <div 
                    className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white text-center px-1 pointer-events-none"
                    style={{ 
                      textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                      transform: `translateZ(${furnitureHeight + 1}px)`,
                      filter: 'none',
                    }}
                  >
                    {item.name}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Back wall */}
          <div
            className="absolute border-2 border-gray-500"
            style={{
              width: `${roomSpec.width * scale}px`,
              height: `${120}px`,
              backgroundColor: roomSpec.wallColor,
              transform: `translate(-50%, -50%) translateZ(-${(roomSpec.height * scale) / 2}px) rotateX(90deg)`,
              left: '50%',
              top: '50%',
              transformOrigin: 'center bottom',
              filter: 'brightness(0.9)',
            }}
          />

          {/* Left wall */}
          <div
            className="absolute border-2 border-gray-500"
            style={{
              width: `${roomSpec.height * scale}px`,
              height: `${120}px`,
              backgroundColor: roomSpec.wallColor,
              transform: `translate(-50%, -50%) translateX(-${(roomSpec.width * scale) / 2}px) rotateY(90deg) rotateX(90deg)`,
              left: '50%',
              top: '50%',
              transformOrigin: 'left bottom',
              filter: 'brightness(0.8)',
            }}
          />
        </div>
      </div>

      {/* Reset view button */}
      <div className="absolute top-4 right-4">
        <button
          onClick={() => {
            setRotateX(60);
            setRotateZ(-30);
            setZoom(1);
          }}
          className="bg-white/95 backdrop-blur-sm hover:bg-white rounded-lg shadow-lg px-3 py-2 text-xs font-medium text-gray-700 transition-colors"
        >
          Reset View
        </button>
      </div>
    </div>
  );
}