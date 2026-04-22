import { Handle, Position, type NodeProps } from '@xyflow/react';
import clsx from 'clsx';
import type { DiagramNode } from '@codebase-viz/shared-types';

export default function FeatureNode({ data, selected }: NodeProps) {
  const d = data as DiagramNode['data'];
  const meta = d.metadata.type === 'Feature' ? d.metadata : null;
  return (
    <div
      className={clsx(
        'node-enter rounded-lg border px-3 py-2.5 min-w-[150px]',
        'bg-[#110d1f] border-[#3b1f6e]',
        selected && 'border-[#a855f7] ring-1 ring-[#a855f7]'
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-[#a855f7] !border-[#3b1f6e]" />
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-sm rotate-45 bg-[#a855f7] shrink-0" />
        <span className="text-xs font-medium text-[#d8b4fe] truncate">{d.label}</span>
      </div>
      {meta?.route && (
        <p className="text-[10px] text-[#a855f7] mt-1 truncate opacity-70">{meta.route}</p>
      )}
      {meta?.usesAuth && (
        <p className="text-[10px] text-[#facc15] mt-0.5 opacity-80">Auth required</p>
      )}
      <Handle type="source" position={Position.Right} className="!bg-[#a855f7] !border-[#3b1f6e]" />
    </div>
  );
}
