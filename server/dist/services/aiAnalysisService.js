"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiAnalysisService = exports.AIAnalysisService = void 0;
const openai_1 = __importDefault(require("openai"));
const config_1 = require("../config");
const jsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        verdict: {
            type: 'string',
            enum: ['BUY', 'SELL', 'HOLD']
        },
        confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1
        },
        alignmentWithRules: {
            type: 'string',
            enum: ['ALIGNED', 'MIXED', 'CONTRARIAN']
        },
        summary: {
            type: 'string'
        },
        marketNarrative: {
            type: 'string'
        },
        strengths: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 5
        },
        risks: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 5
        },
        checklist: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 5
        },
        entryStyle: {
            type: 'string'
        },
        exitStyle: {
            type: 'string'
        },
        invalidation: {
            type: 'string'
        },
        positionSizingNote: {
            type: 'string'
        },
        nextAction: {
            type: 'string'
        }
    },
    required: [
        'verdict',
        'confidence',
        'alignmentWithRules',
        'summary',
        'marketNarrative',
        'strengths',
        'risks',
        'checklist',
        'entryStyle',
        'exitStyle',
        'invalidation',
        'positionSizingNote',
        'nextAction'
    ]
};
const buildSkippedAnalysis = (reason) => ({
    status: 'SKIPPED',
    provider: 'openai',
    model: config_1.config.openAiApiKey ? config_1.config.openAiModel : null,
    generatedAt: new Date().toISOString(),
    verdict: 'HOLD',
    confidence: null,
    alignmentWithRules: 'MIXED',
    summary: reason,
    marketNarrative: 'Слой ИИ не запускался, поэтому решение остаётся только за стратегическим движком.',
    strengths: ['Используется базовый анализ по правилам без дополнительной интерпретации.'],
    risks: ['Нет пояснения от ИИ по текущему сетапу.'],
    checklist: ['Проверьте правила стратегии вручную.', 'При необходимости подключите OPENAI_API_KEY.'],
    entryStyle: 'Не сформирован слоем ИИ.',
    exitStyle: 'Ориентируйтесь на встроенный торговый план стратегического движка.',
    invalidation: 'Разбор ИИ не выполнялся.',
    positionSizingNote: 'Размер позиции считайте по стандартным правилам управления риском в приложении.',
    nextAction: 'Либо используйте встроенный сигнал как есть, либо подключите разбор от ИИ.',
    error: null
});
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
class AIAnalysisService {
    client = config_1.config.openAiApiKey ? new openai_1.default({ apiKey: config_1.config.openAiApiKey }) : null;
    getStatus() {
        return {
            enabled: config_1.config.aiAnalysisEnabled,
            configured: Boolean(config_1.config.openAiApiKey),
            ready: config_1.config.aiAnalysisEnabled && Boolean(config_1.config.openAiApiKey),
            model: config_1.config.openAiModel,
            analyzeHoldSignals: config_1.config.aiAnalyzeHoldSignals
        };
    }
    shouldAnalyze(signal) {
        if (!config_1.config.aiAnalysisEnabled) {
            return { run: false, reason: 'Разбор ИИ отключён в конфигурации.' };
        }
        if (!this.client) {
            return { run: false, reason: 'Нет OPENAI_API_KEY, поэтому разбор от ИИ недоступен.' };
        }
        if (!config_1.config.aiAnalyzeHoldSignals && signal.signal === 'HOLD') {
            return { run: false, reason: 'Для сигнала ожидания разбор ИИ пропущен, чтобы не тратить токены на шум рынка.' };
        }
        return { run: true };
    }
    async analyzeSignal(signal) {
        const decision = this.shouldAnalyze(signal);
        if (!decision.run) {
            return buildSkippedAnalysis(decision.reason ?? 'Разбор ИИ пропущен.');
        }
        if (!this.client) {
            return buildSkippedAnalysis('Клиент OpenAI не инициализирован.');
        }
        const payload = {
            symbol: signal.symbol,
            timeframe: signal.timeframe,
            signal: signal.signal,
            confidence: signal.confidence,
            actionable: signal.actionable,
            price: signal.price,
            regime: signal.regime,
            setup: signal.setup,
            tradePlan: signal.tradePlan,
            indicators: signal.indicators,
            reasons: signal.reason
        };
        try {
            const response = await this.client.responses.create({
                model: config_1.config.openAiModel,
                store: false,
                input: [
                    {
                        role: 'system',
                        content: 'Ты рыночный аналитик по крипто-фьючерсам. Анализируй только предоставленный снимок рынка. Не обещай прибыль, не выдумывай данные, не делай вид, что знаешь новости или стакан, если этого нет во входе. Отвечай по-русски, очень понятно для новичка. Смотри только на long-сценарий: либо купить сейчас, либо ждать, либо не покупать/закрывать уже открытый long. Будь консервативен: если сетап спорный, выбирай ожидание. Если твой вывод отличается от сигнала стратегического движка, объясни это в разделе рисков и в поле alignmentWithRules.'
                    },
                    {
                        role: 'user',
                        content: `Сделай краткий разбор сетапа от ИИ и верни только JSON по схеме.\n\n${JSON.stringify(payload, null, 2)}`
                    }
                ],
                max_output_tokens: 1200,
                text: {
                    format: {
                        type: 'json_schema',
                        name: 'market_ai_analysis',
                        strict: true,
                        schema: jsonSchema
                    }
                }
            });
            const raw = response.output_text;
            if (!raw) {
                throw new Error('OpenAI вернул пустой ответ.');
            }
            const parsed = JSON.parse(raw);
            return {
                status: 'READY',
                provider: 'openai',
                model: config_1.config.openAiModel,
                generatedAt: new Date().toISOString(),
                verdict: parsed.verdict,
                confidence: clamp(parsed.confidence, 0, 1),
                alignmentWithRules: parsed.alignmentWithRules,
                summary: parsed.summary,
                marketNarrative: parsed.marketNarrative,
                strengths: parsed.strengths,
                risks: parsed.risks,
                checklist: parsed.checklist,
                entryStyle: parsed.entryStyle,
                exitStyle: parsed.exitStyle,
                invalidation: parsed.invalidation,
                positionSizingNote: parsed.positionSizingNote,
                nextAction: parsed.nextAction,
                error: null
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Неизвестная ошибка OpenAI';
            return {
                status: 'ERROR',
                provider: 'openai',
                model: config_1.config.openAiModel,
                generatedAt: new Date().toISOString(),
                verdict: 'HOLD',
                confidence: null,
                alignmentWithRules: 'MIXED',
                summary: 'Разбор от ИИ не был получен из-за ошибки провайдера.',
                marketNarrative: 'Стратегический движок продолжает работать, но слой ИИ сейчас недоступен.',
                strengths: ['Основной движок сигналов продолжает работу без OpenAI.'],
                risks: ['Проверка сетапа со стороны ИИ не выполнена.', message],
                checklist: ['Проверьте OPENAI_API_KEY.', 'Проверьте сетевой доступ сервера.', 'Посмотрите логи Railway.'],
                entryStyle: 'Ориентируйтесь на встроенный торговый план.',
                exitStyle: 'Используйте стоп и цели из стратегической части приложения.',
                invalidation: 'Слой ИИ не дал подтверждение из-за технической ошибки.',
                positionSizingNote: 'Не увеличивайте риск только потому, что слой ИИ временно не отвечает.',
                nextAction: 'Используйте сигнал осторожно и проверьте настройки OpenAI.',
                error: message
            };
        }
    }
}
exports.AIAnalysisService = AIAnalysisService;
exports.aiAnalysisService = new AIAnalysisService();
