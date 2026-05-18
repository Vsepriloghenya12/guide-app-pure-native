import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { apiRouter } from './api/routes';
import { config } from './config';

export const createApp = () => {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.get('/health', (_request, response) => {
    response.json({ ok: true, message: 'Сервис работает' });
  });

  app.get('/api', (_request, response) => {
    response.json({ ok: true, message: 'API сканера фьючерсного рынка' });
  });

  app.use('/api', apiRouter);

  const frontendDistPath = path.resolve(__dirname, '../../webapp/dist');
  app.use(express.static(frontendDistPath));

  app.use((_request, response) => {
    response.sendFile(path.join(frontendDistPath, 'index.html'), (error) => {
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
