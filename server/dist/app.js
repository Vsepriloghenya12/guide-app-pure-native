"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const node_path_1 = __importDefault(require("node:path"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = require("./api/routes");
const config_1 = require("./config");
const createApp = () => {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)({ origin: config_1.config.corsOrigin }));
    app.use(express_1.default.json());
    app.get('/health', (_request, response) => {
        response.json({ ok: true, message: 'Сервис работает' });
    });
    app.get('/api', (_request, response) => {
        response.json({ ok: true, message: 'API сканера фьючерсного рынка' });
    });
    app.use('/api', routes_1.apiRouter);
    const frontendDistPath = node_path_1.default.resolve(__dirname, '../../webapp/dist');
    app.use(express_1.default.static(frontendDistPath));
    app.use((_request, response) => {
        response.sendFile(node_path_1.default.join(frontendDistPath, 'index.html'), (error) => {
            if (error) {
                response.status(404).json({
                    ok: false,
                    message: 'Собранный фронтенд не найден. Сначала выполните `npm run build --workspace webapp`.'
                });
            }
        });
    });
    return app;
};
exports.createApp = createApp;
