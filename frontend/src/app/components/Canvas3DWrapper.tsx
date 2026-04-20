import { FurnitureItem, RoomSpec } from '../../types/design';
import Canvas3DThree from './Canvas3DThree';

interface Canvas3DProps {
  roomSpec: RoomSpec;
  furniture: FurnitureItem[];
  selectedId?: string | null;
  onExportReady?: (exportFn: (() => string) | null) => void;
}

export default function Canvas3DWrapper({ roomSpec, furniture, selectedId, onExportReady }: Canvas3DProps) {
  return <Canvas3DThree roomSpec={roomSpec} furniture={furniture} selectedId={selectedId} onExportReady={onExportReady} />;
}
