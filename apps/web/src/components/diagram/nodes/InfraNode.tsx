import { Handle, Position, type NodeProps } from '@xyflow/react';
import clsx from 'clsx';
import type { DiagramNode } from '@codebase-viz/shared-types';

export default function InfraNode({ data, selected }: NodeProps) {
  const d = data as DiagramNode['data'];
  const meta = d.metadata.type === 'ExternalDependency' ? d.metadata : null;
  return (
    <div
      className={clsx(
        'node-enter rounded-lg border px-3 py-2.5 min-w-[130px]',
        'bg-[#1a1000] border-[#3d2800]',
        selected && 'border-[#f97316] ring-1 ring-[#f97316]'
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-[#f97316] !border-[#3d2800]" />
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded bg-[#f97316] shrink-0" />
        <span className="text-xs font-medium text-[#fed7aa] truncate">{d.label}</span>
      </div>
      {meta && (
        <p className="text-[10px] text-[#f97316] mt-1 truncate opacity-70">{meta.category}</p>
      )}
      <Handle type="source" position={Position.Right} className="!bg-[#f97316] !border-[#3d2800]" />
    </div>
  );
}
