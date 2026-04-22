'use client';

import { X } from 'lucide-react';
import { useDiagramStore } from '@/stores/diagramStore';
import type { DiagramNode, NodeMetadata } from '@codebase-viz/shared-types';

export default function NodeDetailPanel() {
  const { nodes, selectedNodeId, setSelectedNodeId } = useDiagramStore();
  const node = nodes.find((n) => n.id === selectedNodeId);

  if (!node) return null;

  return (
    <div className="absolute top-4 right-4 z-10 w-72 bg-panel border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-medium text-white truncate">{node.data.label}</span>
        <button
          onClick={() => setSelectedNodeId(null)}
          className="text-[#555555] hover:text-white transition-colors shrink-0 ml-2"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-4 py-3 space-y-2 max-h-96 overflow-y-auto">
        <MetaRow label="Type" value={node.type} />
        <MetaRow label="Source" value={node.data.agentSource} />
        <MetaRow label="Confidence" value={`${Math.round(node.data.confidence * 100)}%`} />
        <MetaFields meta={node.data.metadata} />
      </div>
    </div>
  );
}

function MetaFields({ meta }: { meta: NodeMetadata }) {
  if (meta.type === 'ApiEndpoint') {
    return (
      <>
        <MetaRow label="Method" value={meta.method} />
        <MetaRow label="Path" value={meta.path} />
        <MetaRow label="Handler" value={meta.handlerName} />
        <MetaRow label="Auth" value={meta.authRequired ? 'Required' : 'None'} />
        {meta.middlewares.length > 0 && <MetaRow label="Middleware" value={meta.middlewares.join(', ')} />}
        <MetaRow label="File" value={shortenPath(meta.filePath)} />
      </>
    );
  }
  if (meta.type === 'DatabaseEntity') {
    return (
      <>
        <MetaRow label="ORM" value={meta.orm} />
        <MetaRow label="DB" value={meta.dbType} />
        <MetaRow label="File" value={shortenPath(meta.filePath)} />
        {meta.fields.length > 0 && (
          <div>
            <p className="text-[11px] text-[#555555] mb-1.5 uppercase tracking-wide">Fields</p>
            <div className="space-y-0.5">
              {meta.fields.slice(0, 8).map((f) => (
                <div key={f.name} className="flex justify-between text-xs">
                  <span className="text-[#cccccc]">{f.name}</span>
                  <span className="text-[#555555]">{f.type}</span>
                </div>
              ))}
              {meta.fields.length > 8 && (
                <p className="text-[11px] text-[#444444]">+{meta.fields.length - 8} more</p>
              )}
            </div>
          </div>
        )}
      </>
    );
  }
  if (meta.type === 'Service') {
    return (
      <>
        <MetaRow label="Language" value={meta.language} />
        <MetaRow label="Framework" value={meta.framework} />
        <MetaRow label="File" value={shortenPath(meta.filePath)} />
      </>
    );
  }
  if (meta.type === 'ExternalDependency') {
    return (
      <>
        <MetaRow label="Category" value={meta.category} />
        <MetaRow label="Package" value={meta.sdkPackage} />
        {meta.envKeys.length > 0 && <MetaRow label="Env vars" value={meta.envKeys.join(', ')} />}
      </>
    );
  }
  return null;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[11px] text-[#555555] shrink-0">{label}</span>
      <span className="text-[11px] text-[#cccccc] text-right truncate">{value}</span>
    </div>
  );
}

function shortenPath(p: string) {
  const parts = p.replace(/\\/g, '/').split('/');
  return parts.slice(-3).join('/');
}
