import dotenv from 'dotenv';
import { getRedisClient, INBOUND_STREAM, CONSUMER_GROUP, initStreamGroup } from './redis.js';
import { MessageDispatcher } from './dispatcher.js';
import type { InboundChatMessage } from '@omniagent/core';

dotenv.config();

const WORKER_ID = `worker_${process.pid}_${Date.now()}`;

async function startAgentWorker(): Promise<void> {
  console.log(`====================================================`);
  console.log(`🚀 OMNIAGENT BACKGROUND EVENT WORKER STARTING...`);
  console.log(`   Worker ID: ${WORKER_ID}`);
  console.log(`   Inbound Stream: ${INBOUND_STREAM}`);
  console.log(`====================================================`);

  const redis = getRedisClient();
  await redis.connect().catch(() => {});

  await initStreamGroup(redis, INBOUND_STREAM, CONSUMER_GROUP);

  const dispatcher = new MessageDispatcher();

  console.log(`[Worker] Listening for incoming chat messages...`);

  while (true) {
    try {
      // Read up to 5 messages from Redis Stream with 2s block timeout
      const response = await redis.xreadgroup(
        'GROUP',
        CONSUMER_GROUP,
        WORKER_ID,
        'COUNT',
        5,
        'BLOCK',
        2000,
        'STREAMS',
        INBOUND_STREAM,
        '>'
      );

      if (!response || response.length === 0) {
        continue;
      }

      for (const [_stream, messages] of response) {
        for (const [messageId, fields] of messages) {
          try {
            // Redis Stream fields are key-value pairs: ['data', '{"text": ...}']
            const dataIndex = fields.indexOf('data');
            if (dataIndex !== -1 && fields[dataIndex + 1]) {
              const rawJson = fields[dataIndex + 1];
              const inboundMsg = JSON.parse(rawJson) as InboundChatMessage;
              await dispatcher.dispatch(inboundMsg);
            }

            // Acknowledge processed message
            await redis.xack(INBOUND_STREAM, CONSUMER_GROUP, messageId);
          } catch (itemError) {
            console.error(`[Worker] Error processing message ${messageId}:`, itemError);
            // ACK anyway to prevent poison pill loop
            await redis.xack(INBOUND_STREAM, CONSUMER_GROUP, messageId);
          }
        }
      }
    } catch (loopError) {
      console.error('[Worker] Fatal error in consumer loop, retrying in 3s:', loopError);
      await new Promise((res) => setTimeout(res, 3000));
    }
  }
}

startAgentWorker().catch((err) => {
  console.error('[Worker] Unhandled initialization exception:', err);
  process.exit(1);
});
