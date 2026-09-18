import { FINANCE_TOOLS, HARD_SYSTEM_GUARDRAILS, runFinanceTool } from './aiFinanceTools.js';

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export type ChatAttachment = {
  mimeType: string;
  fileName: string;
  base64: string;
};

type ProviderConfig = {
  provider: 'openai' | 'claude';
  model: string;
  apiKey: string;
  systemPrompt: string;
};

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const PDF_MIME = 'application/pdf';

const CREATE_TOOLS = new Set(['create_expense', 'create_income']);

export function isSupportedAttachmentMime(mime: string): boolean {
  return IMAGE_MIME.has(mime) || mime === PDF_MIME;
}

function userAskedToRegister(message: string): boolean {
  const text = message.toLowerCase();
  return /(cadastr|registr|lanc|lanç|confirma|pode criar|pode salvar|salve|grave)\w*/i.test(
    text
  );
}

function responseClaimsRegistration(text: string): boolean {
  return /(cadastrad[ao]|registrad[ao]|lançad[ao]|foi (criad[ao]|salvo|salva)|sucesso)/i.test(
    text
  );
}

function toolResultRegistered(toolResultJson: string): boolean {
  try {
    const parsed = JSON.parse(toolResultJson) as {
      registered?: boolean;
      id?: string;
      error?: string;
    };
    if (parsed.error) return false;
    if (parsed.registered === true) return true;
    return Boolean(parsed.id);
  } catch {
    return false;
  }
}

const FORCE_CREATE_NUDGE = `SYSTEM OVERRIDE: Você afirmou ou o usuário pediu cadastro, mas NENHUMA ferramenta create_expense/create_income retornou registered=true.
Chame create_expense (ou create_income) AGORA com os dados confirmados na conversa.
- date em YYYY-MM-DD
- amount numérico (ex.: 3721.46)
- categoryName exatamente da lista oficial
NÃO diga que cadastrou sem receber registered=true.`;

const HONEST_FAILURE =
  'Não consegui gravar o lançamento no sistema. Tente de novo informando valor, data (DD/MM/AAAA), categoria oficial e se já foi pago.';

async function runToolLoop(
  userId: string,
  toolName: string,
  argsJson: string
): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
  } catch {
    return JSON.stringify({
      registered: false,
      error: 'Argumentos inválidos da ferramenta',
    });
  }

  try {
    const result = await runFinanceTool(userId, toolName, args);
    return JSON.stringify(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao executar ferramenta';
    return JSON.stringify({
      registered: false,
      error: message,
    });
  }
}

function buildSystemPrompt(customPrompt: string): string {
  return `${HARD_SYSTEM_GUARDRAILS}\n\nInstruções adicionais do administrador:\n${customPrompt}`;
}

function attachmentPromptText(message: string, attachment?: ChatAttachment): string {
  const base =
    message.trim() ||
    'Analise o comprovante/cupom anexado e ajude a cadastrar a despesa na minha conta.';
  if (!attachment) return base;
  return `${base}

[Arquivo anexado: ${attachment.fileName} (${attachment.mimeType})]
Leia o anexo, extraia os dados da compra e siga o fluxo de confirmação antes de cadastrar.`;
}

function openAiUserContent(message: string, attachment?: ChatAttachment) {
  const text = attachmentPromptText(message, attachment);
  if (!attachment) return text;

  if (IMAGE_MIME.has(attachment.mimeType)) {
    return [
      { type: 'text', text },
      {
        type: 'image_url',
        image_url: {
          url: `data:${attachment.mimeType};base64,${attachment.base64}`,
        },
      },
    ];
  }

  return `${text}

Observação: o anexo é PDF. Neste provedor (OpenAI) prefira foto/imagem do comprovante. Peça ao usuário para reenviar como imagem se não conseguir ler o conteúdo.`;
}

function claudeUserContent(message: string, attachment?: ChatAttachment) {
  const text = attachmentPromptText(message, attachment);
  if (!attachment) return text;

  if (IMAGE_MIME.has(attachment.mimeType)) {
    return [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: attachment.mimeType,
          data: attachment.base64,
        },
      },
      { type: 'text', text },
    ];
  }

  if (attachment.mimeType === PDF_MIME) {
    return [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: PDF_MIME,
          data: attachment.base64,
        },
      },
      { type: 'text', text },
    ];
  }

  return text;
}

function finalizeAnswer(answer: string, didRegister: boolean): string {
  if (didRegister) return answer;
  if (responseClaimsRegistration(answer)) return HONEST_FAILURE;
  return answer;
}

export async function runAgentChat(
  userId: string,
  config: ProviderConfig,
  history: ChatMessage[],
  userMessage: string,
  attachment?: ChatAttachment
): Promise<string> {
  const system = buildSystemPrompt(config.systemPrompt);

  if (config.provider === 'openai') {
    return runOpenAI(userId, config, system, history, userMessage, attachment);
  }
  return runClaude(userId, config, system, history, userMessage, attachment);
}

async function runOpenAI(
  userId: string,
  config: ProviderConfig,
  system: string,
  history: ChatMessage[],
  userMessage: string,
  attachment?: ChatAttachment
): Promise<string> {
  const tools = FINANCE_TOOLS.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));

  const messages: Array<Record<string, unknown>> = [
    { role: 'system', content: system },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: openAiUserContent(userMessage, attachment) },
  ];

  let didRegister = false;
  let forcedCreateRetry = false;
  const askedToRegister = userAskedToRegister(userMessage);

  for (let step = 0; step < 10; step++) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4o-mini',
        messages,
        tools,
        tool_choice:
          forcedCreateRetry && !didRegister
            ? { type: 'function', function: { name: 'create_expense' } }
            : 'auto',
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI error: ${response.status} ${errText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          role?: string;
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>;
    };

    const message = data.choices?.[0]?.message;
    if (!message) throw new Error('Resposta vazia da OpenAI');

    if (message.tool_calls?.length) {
      messages.push(message);
      for (const call of message.tool_calls) {
        const toolResult = await runToolLoop(
          userId,
          call.function.name,
          call.function.arguments || '{}'
        );
        if (CREATE_TOOLS.has(call.function.name) && toolResultRegistered(toolResult)) {
          didRegister = true;
        }
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: toolResult,
        });
      }
      continue;
    }

    const answer =
      (message.content || '').trim() || 'Não consegui gerar uma resposta.';

    if (
      !didRegister &&
      !forcedCreateRetry &&
      (askedToRegister || responseClaimsRegistration(answer))
    ) {
      forcedCreateRetry = true;
      messages.push({ role: 'assistant', content: answer });
      messages.push({ role: 'user', content: FORCE_CREATE_NUDGE });
      continue;
    }

    return finalizeAnswer(answer, didRegister);
  }

  return didRegister
    ? 'Lançamento processado, mas a confirmação textual falhou. Atualize a lista de despesas.'
    : HONEST_FAILURE;
}

async function runClaude(
  userId: string,
  config: ProviderConfig,
  system: string,
  history: ChatMessage[],
  userMessage: string,
  attachment?: ChatAttachment
): Promise<string> {
  const tools = FINANCE_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));

  const messages: Array<Record<string, unknown>> = [
    ...history
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: claudeUserContent(userMessage, attachment) },
  ];

  let didRegister = false;
  let forcedCreateRetry = false;
  const askedToRegister = userAskedToRegister(userMessage);

  for (let step = 0; step < 10; step++) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model || 'claude-haiku-4-5',
        max_tokens: 1800,
        system,
        tools,
        tool_choice:
          forcedCreateRetry && !didRegister
            ? { type: 'tool', name: 'create_expense' }
            : { type: 'auto' },
        messages,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude error: ${response.status} ${errText}`);
    }

    const data = (await response.json()) as {
      content?: Array<{
        type: string;
        text?: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      }>;
      stop_reason?: string;
    };

    const content = data.content || [];
    const toolUses = content.filter((c) => c.type === 'tool_use');
    const texts = content.filter((c) => c.type === 'text').map((c) => c.text || '');

    if (toolUses.length > 0) {
      messages.push({ role: 'assistant', content });
      const toolResults = [];
      for (const tool of toolUses) {
        const toolName = tool.name || '';
        const toolResult = await runToolLoop(
          userId,
          toolName,
          JSON.stringify(tool.input || {})
        );
        if (CREATE_TOOLS.has(toolName) && toolResultRegistered(toolResult)) {
          didRegister = true;
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: toolResult,
        });
      }
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    const answer = texts.join('\n').trim() || 'Não consegui gerar uma resposta.';

    if (
      !didRegister &&
      !forcedCreateRetry &&
      (askedToRegister || responseClaimsRegistration(answer))
    ) {
      forcedCreateRetry = true;
      messages.push({ role: 'assistant', content });
      messages.push({
        role: 'user',
        content: FORCE_CREATE_NUDGE,
      });
      continue;
    }

    return finalizeAnswer(answer, didRegister);
  }

  return didRegister
    ? 'Lançamento processado, mas a confirmação textual falhou. Atualize a lista de despesas.'
    : HONEST_FAILURE;
}
