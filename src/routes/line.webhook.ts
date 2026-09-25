import type { FastifyInstance } from 'fastify';
import { messagingApi, webhook } from '@line/bot-sdk';
import { processRAGQuery } from '../services/GEMINI/rag.service.js';

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
};

export default async function lineWebhookRouter(fastify: FastifyInstance) {
  fastify.post('/webhook', async (request, reply) => {
    // ใช้ webhook.Event หรือ webhook.CallbackRequest
    const events: webhook.Event[] = (request.body as any)?.events || [];

    await Promise.all(
      events.map(async (event) => {
        // ตรวจสอบชนิด Event เป็น MessageEvent และประเภทข้อความ TextMessageContent
        if (event.type !== 'message' || event.message?.type !== 'text') {
          return null;
        }

        const userMessage = event.message.text;
        const replyToken = event.replyToken;

        // เรียกใช้งาน RAG System
        const answer = await processRAGQuery(userMessage);

        // ตอบกลับหาผู้ใช้ LINE ผ่าน MessagingApiClient
        const client = new messagingApi.MessagingApiClient({
          channelAccessToken: config.channelAccessToken,
        });

        if (replyToken) {
          return client.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: answer }],
          });
        }

        return null;
      })
    );

    return reply.status(200).send({ status: 'success' });
  });
}