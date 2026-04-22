import { Handle, Position, type NodeProps } from '@xyflow/react';
import clsx from 'clsx';
import type { DiagramNode } from '@codebase-viz/shared-types';

export default function ExternalNode({ data, selected }: NodeProps) {
  const d = data as DiagramNode['data'];
  const meta = d.metadata.type === 'ExternalDependency' ? d.metadata : null;
  return (
    <div
      className={clsx(
        'node-enter rounded-lg border border-dashed px-3 py-2.5 min-w-[130px]',
        'bg-[#0a0a0a] border-[#333333]',
        selected && 'border-[#888888] ring-1 ring-[#888888]'
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-[#555555] !border-[#333333]" />
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full border border-[#555555] shrink-0" />
        <span className="text-xs font-medium text-[#888888] truncate">{d.label}</span>
      </div>
      {meta && (
        <p className="text-[10px] text-[#555555] mt-1 truncate">{meta.category}</p>
      )}
      <Handle type="source" position={Position.Right} className="!bg-[#555555] !border-[#333333]" />
    </div>
  );
}
