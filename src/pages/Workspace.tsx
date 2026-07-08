import { ReactFlowProvider } from 'reactflow';
import MindMapCanvas from '../components/MindMapCanvas';

export default function Workspace() {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <ReactFlowProvider>
        <MindMapCanvas />
      </ReactFlowProvider>
    </div>
  );
}
