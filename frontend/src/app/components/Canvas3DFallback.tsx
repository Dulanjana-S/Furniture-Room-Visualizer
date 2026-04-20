import { FurnitureItem, RoomSpec } from '../../types/design';

interface Canvas3DFallbackProps {
  roomSpec: RoomSpec;
  furniture: FurnitureItem[];
}

export default function Canvas3DFallback({ roomSpec, furniture }: Canvas3DFallbackProps) {
  return (
    <div className="w-full h-[600px] rounded-lg overflow-hidden border border-gray-300 bg-gradient-to-b from-gray-100 to-gray-200 flex items-center justify-center">
      <div className="text-center px-8 py-12 bg-white rounded-lg shadow-lg max-w-md">
        <div className="mb-6">
          <svg
            className="mx-auto h-16 w-16 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
        </div>
        
        <h3 className="text-xl font-bold text-gray-900 mb-3">
          3D View Not Available
        </h3>
        
        <p className="text-sm text-gray-600 mb-6">
          The 3D visualization library could not be loaded. This may be due to browser compatibility or network issues.
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Good news:</strong> You can continue designing using the 2D view, which has all the same features and functionality.
          </p>
        </div>
        
        <div className="space-y-2 text-left text-xs text-gray-500">
          <p><strong>Room Details:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Dimensions: {roomSpec.width}m × {roomSpec.height}m</li>
            <li>Furniture items: {furniture.length}</li>
            <li>Wall color: <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: roomSpec.wallColor }}></span> {roomSpec.wallColor}</li>
            <li>Floor color: <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: roomSpec.floorColor }}></span> {roomSpec.floorColor}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
