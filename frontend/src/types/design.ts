export interface FurnitureItem {
  id: string;
  type: 'chair' | 'dining-table' | 'side-table' | 'coffee-table' | 'sofa' | 'bed' | 'cabinet' | 'wardrobe' | 'desk' | 'bookshelf' | 'tv-stand';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  scale: number;
  shadow?: boolean; // Enable shadow for this item
  shadowIntensity?: number; // Shadow intensity (0-1)
  zHeight?: number; // Optional 3D height override (meters)
}

export interface RoomSpec {
  width: number;
  height: number;
  shape: 'rectangular' | 'square' | 'l-shaped';
  notchWidth?: number; // Only for L-shape
  notchHeight?: number; // Only for L-shape
  wallColor: string;
  floorColor: string;
  globalShadow?: boolean; // Enable shadows for entire design
  globalShadowIntensity?: number; // Global shadow intensity (0-1)
}

export interface Design {
  id: string;
  userId: string;
  name: string;
  notes?: string;
  roomSpec: RoomSpec;
  furniture: FurnitureItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DesignData {
  name: string;
  notes?: string;
  roomSpec: RoomSpec;
  furniture: FurnitureItem[];
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}