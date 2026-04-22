import { Handle, Position, type NodeProps } from '@xyflow/react';
import clsx from 'clsx';
import type { DiagramNode } from '@codebase-viz/shared-types';

export default function DatabaseNode({ data, selected }: NodeProps) {
  const d = data as DiagramNode['data'];
  const meta = d.metadata.type === 'DatabaseEntity' ? d.metadata : null;
  return (
    <div
      className={clsx(
        'node-enter rounded-lg border px-3 py-2.5 min-w-[140px]',
        'bg-[#130d1f] border-[#2d1b4e]',
        selected && 'border-[#a855f7] ring-1 ring-[#a855f7]'
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-[#a855f7] !border-[#2d1b4e]" />
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-sm bg-[#a855f7] shrink-0" />
        <span className="text-xs font-medium text-[#d8b4fe] truncate">{d.label}</span>
      </div>
      {meta && (
        <p className="text-[10px] text-[#a855f7] mt-1 truncate opacity-70">
          {meta.orm} · {meta.dbType}
        </p>
      )}
      <Handle type="source" position={Position.Right} className="!bg-[#a855f7] !border-[#2d1b4e]" />
    </div>
  );
}
