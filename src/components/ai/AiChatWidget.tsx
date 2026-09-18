import React, { useEffect, useRef, useState } from 'react';
import { Bot, MessageCircle, Paperclip, Send, Trash2, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useFinance } from '../../context/FinanceContext';
import ChatMessageContent from './ChatMessageContent';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | string;
  content: string;
  attachmentName?: string | null;
  attachmentMime?: string | null;
  previewUrl?: string;
  createdAt?: string;
};

type PendingAttachment = {
  fileName: string;
  mimeType: string;
  base64: string;
  previewUrl: string;
};

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const idx = result.indexOf('base64,');
      resolve(idx >= 0 ? result.slice(idx + 7) : result);
    };
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
    reader.readAsDataURL(file);
  });
}

const AiChatWidget: React.FC = () => {
  const { fetchExpenses } = useFinance();
  const [enabled, setEnabled] = useState(false);
  const [agentName, setAgentName] = useState('Assistente');
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const status = await api<{ enabled: boolean; name: string | null }>('/api/ai/status');
        setEnabled(status.enabled);
        setAgentName(status.name || 'Assistente');
      } catch {
        setEnabled(false);
      }
    };
    void loadStatus();
  }, []);

  useEffect(() => {
    if (!open || !enabled) return;
    const loadMessages = async () => {
      try {
        const rows = await api<ChatMessage[]>('/api/ai/messages');
        setMessages(rows);
      } catch {
        // ignore
      }
    };
    void loadMessages();
  }, [open, enabled]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open, attachment]);

  if (!enabled) return null;

  const clearAttachment = (revoke = true) => {
    if (revoke && attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Envie imagem (JPG, PNG, WEBP) ou PDF do comprovante.');
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError('Arquivo muito grande (máx. 4 MB).');
      return;
    }

    try {
      setError('');
      const base64 = await fileToBase64(file);
      if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      setAttachment({
        fileName: file.name,
        mimeType: file.type,
        base64,
        previewUrl: URL.createObjectURL(file),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao anexar arquivo');
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if ((!text && !attachment) || sending) return;

    const pending = attachment;
    setInput('');
    clearAttachment(false);
    setError('');
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const tempContent =
      text ||
      (pending ? 'Analise o comprovante anexado e ajude a cadastrar a despesa.' : '');

    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: 'user',
        content: tempContent,
        attachmentName: pending?.fileName || null,
        attachmentMime: pending?.mimeType || null,
        previewUrl: pending?.previewUrl,
      },
    ]);

    try {
      const reply = await api<ChatMessage>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: text,
          ...(pending
            ? {
                attachment: {
                  fileName: pending.fileName,
                  mimeType: pending.mimeType,
                  base64: pending.base64,
                },
              }
            : {}),
        }),
      });
      setMessages((prev) => [...prev, reply]);
      await fetchExpenses();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar mensagem');
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(text);
      if (pending) {
        setAttachment(pending);
      }
    } finally {
      setSending(false);
    }
  };

  const clearChat = async () => {
    try {
      await api<void>('/api/ai/messages', { method: 'DELETE' });
      setMessages([]);
      clearAttachment();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao limpar conversa');
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white shadow-lift transition hover:bg-ink-soft"
        >
          <MessageCircle size={18} />
          Chat IA
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[min(620px,80vh)] w-[min(420px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-mist-line bg-white shadow-lift">
          <div className="flex items-center justify-between gap-2 border-b border-mist-line bg-ink px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Bot size={18} />
              <div>
                <p className="text-sm font-semibold">{agentName}</p>
                <p className="text-[11px] text-white/60">Contas · comprovantes</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="fc-icon-btn bg-white/10 text-white hover:bg-white/20"
                onClick={() => void clearChat()}
                title="Limpar conversa"
              >
                <Trash2 size={16} />
              </button>
              <button
                className="fc-icon-btn bg-white/10 text-white hover:bg-white/20"
                onClick={() => setOpen(false)}
                title="Fechar"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-mist/40 p-3">
            {messages.length === 0 && (
              <div className="rounded-xl border border-dashed border-mist-line bg-white px-3 py-4 text-sm text-ink/55">
                Pergunte sobre totais ou anexe um cupom/comprovante para o assistente cadastrar a
                despesa (com confirmação).
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'ml-auto bg-mint text-white'
                    : 'mr-auto w-full max-w-[92%] bg-white text-ink shadow-sm ring-1 ring-mist-line'
                }`}
              >
                {(msg.previewUrl || msg.attachmentName) && (
                  <div className="mb-2">
                    {msg.previewUrl && msg.attachmentMime?.startsWith('image/') ? (
                      <img
                        src={msg.previewUrl}
                        alt={msg.attachmentName || 'Comprovante'}
                        className="max-h-40 w-full rounded-xl object-cover"
                      />
                    ) : (
                      <div
                        className={`rounded-xl px-2.5 py-2 text-xs ${
                          msg.role === 'user'
                            ? 'bg-white/15 text-white'
                            : 'bg-mist text-ink/70'
                        }`}
                      >
                        Anexo: {msg.attachmentName || 'comprovante'}
                      </div>
                    )}
                  </div>
                )}
                <ChatMessageContent
                  content={msg.content}
                  tone={msg.role === 'user' ? 'user' : 'assistant'}
                />
              </div>
            ))}
            {sending && (
              <div className="mr-auto rounded-2xl bg-white px-3 py-2 text-sm text-ink/50 ring-1 ring-mist-line">
                Analisando…
              </div>
            )}
          </div>

          {error && (
            <div className="border-t border-expense/20 bg-expense-soft px-3 py-2 text-xs text-expense">
              {error}
            </div>
          )}

          {attachment && (
            <div className="flex items-center gap-2 border-t border-mist-line bg-mist/50 px-3 py-2">
              {attachment.mimeType.startsWith('image/') ? (
                <img
                  src={attachment.previewUrl}
                  alt={attachment.fileName}
                  className="h-12 w-12 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-[10px] font-semibold text-ink/60 ring-1 ring-mist-line">
                  PDF
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ink">{attachment.fileName}</p>
                <p className="text-[11px] text-ink/50">Pronto para enviar</p>
              </div>
              <button
                type="button"
                className="fc-icon-btn"
                onClick={clearAttachment}
                title="Remover anexo"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <form
            className="flex items-end gap-2 border-t border-mist-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage();
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              className="hidden"
              onChange={(e) => void onPickFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              className="fc-icon-btn shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              title="Anexar comprovante"
            >
              <Paperclip size={16} />
            </button>
            <textarea
              className="fc-input min-h-[44px] max-h-28 resize-none"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ex.: Cadastre este cupom"
              disabled={sending}
            />
            <button
              type="submit"
              className="fc-btn-primary !px-3"
              disabled={sending || (!input.trim() && !attachment)}
              title="Enviar"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default AiChatWidget;
