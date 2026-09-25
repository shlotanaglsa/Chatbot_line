import Fastify from 'fastify';
import dotenv from 'dotenv';
import lineWebhookRouter from './routes/line.webhook.js';

dotenv.config();

const fastify = Fastify({ logger: true });

fastify.get('/', async (request, reply) => {
  return { status: 'ok', message: 'Clinic AI Bot Server is Running!' };
});

fastify.register(lineWebhookRouter, { prefix: '/line' });

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on port ${port}`); 
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();