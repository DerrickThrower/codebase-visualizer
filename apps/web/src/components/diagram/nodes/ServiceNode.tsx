import { Handle, Position, type NodeProps } from '@xyflow/react';
import clsx from 'clsx';
import type { DiagramNode } from '@codebase-viz/shared-types';

export default function ServiceNode({ data, selected }: NodeProps) {
  const d = data as DiagramNode['data'];
  const meta = d.metadata.type === 'Service' ? d.metadata : null;
  return (
    <div
      className={clsx(
        'node-enter rounded-lg border px-3 py-2.5 min-w-[140px]',
        'bg-[#0d1520] border-[#1e3a5f]',
        selected && 'border-[#3b82f6] ring-1 ring-[#3b82f6]'
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-[#3b82f6] !border-[#1e3a5f]" />
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] shrink-0" />
        <span className="text-xs font-medium text-[#93c5fd] truncate">{d.label}</span>
      </div>
      {meta && (
        <p className="text-[10px] text-[#3b82f6] mt-1 truncate opacity-70">
          {meta.language} · {meta.framework}
        </p>
      )}
      <Handle type="source" position={Position.Right} className="!bg-[#3b82f6] !border-[#1e3a5f]" />
    </div>
  );
}
