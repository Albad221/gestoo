import { Request, Response } from 'express';

export function healthHandler(_req: Request, res: Response) {
  res.json({
    status: 'ok',
    service: 'chatbot-service',
    timestamp: new Date().toISOString(),
  });
}
