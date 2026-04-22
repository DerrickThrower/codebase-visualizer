'use client';

import { useState, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { queryStream } from '@/lib/api';

interface QueryBarProps {
  sessionId: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function QueryBar({ sessionId }: QueryBarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const question = input.trim();
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: question }]);
    setLoading(true);

    let answer = '';
    setMessages((m) => [...m, { role: 'assistant', content: '' }]);

    try {
      for await (const chunk of queryStream(sessionId, question)) {
        answer += chunk;
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = { role: 'assistant', content: answer };
          return next;
        });
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    } catch {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { role: 'assistant', content: 'Query failed. Please try again.' };
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-panel border-l border-border w-72 shrink-0">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-[11px] font-medium uppercase tracking-widest text-[#555555]">Query</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="space-y-1.5 pt-1">
            {['Which services touch user data?', 'What are the main API endpoints?', 'What external services are used?'].map((q) => (
              <button
                key={q}
                onClick={() => setInput(q)}
                className="w-full text-left text-xs text-[#555555] hover:text-[#cccccc] bg-surface hover:bg-[#1a1a1a] border border-transparent hover:border-border rounded-lg px-3 py-2 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
            <div
              className={`inline-block text-xs rounded-lg px-3 py-2 max-w-[90%] text-left ${
                msg.role === 'user'
                  ? 'bg-white text-black'
                  : 'bg-surface text-[#cccccc] border border-border'
              }`}
            >
              {msg.content || <span className="opacity-40">Thinking...</span>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-border flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the codebase..."
          className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-xs text-white placeholder:text-[#444444] focus:outline-none focus:border-[#555555] transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="p-2 bg-white hover:bg-[#f0f0f0] text-black disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors shrink-0"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </button>
      </form>
    </div>
  );
}
