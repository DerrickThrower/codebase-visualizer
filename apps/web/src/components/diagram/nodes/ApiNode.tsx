import { Handle, Position, type NodeProps } from '@xyflow/react';
import clsx from 'clsx';
import type { DiagramNode } from '@codebase-viz/shared-types';

const METHOD_COLORS: Record<string, string> = {
  GET:    'text-[#4ade80]',
  POST:   'text-[#60a5fa]',
  PUT:    'text-[#facc15]',
  PATCH:  'text-[#fb923c]',
  DELETE: 'text-[#f87171]',
};

export default function ApiNode({ data, selected }: NodeProps) {
  const d = data as DiagramNode['data'];
  const meta = d.metadata.type === 'ApiEndpoint' ? d.metadata : null;
  const method = meta?.method ?? '';
  return (
    <div
      className={clsx(
        'node-enter rounded-lg border px-3 py-2.5 min-w-[160px]',
        'bg-[#0d1a0f] border-[#1a3d22]',
        selected && 'border-[#22c55e] ring-1 ring-[#22c55e]'
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-[#22c55e] !border-[#1a3d22]" />
      <div className="flex items-center gap-2">
        <span className={clsx('text-[10px] font-bold shrink-0 tabular-nums', METHOD_COLORS[method] ?? 'text-[#888888]')}>
          {method}
        </span>
        <span className="text-xs font-medium text-[#86efac] truncate">{meta?.path ?? d.label}</span>
      </div>
      {meta?.authRequired && (
        <p className="text-[10px] text-[#facc15] mt-1 opacity-80">Auth required</p>
      )}
      <Handle type="source" position={Position.Right} className="!bg-[#22c55e] !border-[#1a3d22]" />
    </div>
  );
}
