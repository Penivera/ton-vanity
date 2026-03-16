import { Queue } from 'bullmq';
import { VANITY_GENERATION_QUEUE } from './queue.constants';

let queueInstance: Queue<{ generationId: string }> | null = null;

function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl && redisUrl.trim().length > 0) {
    return { url: redisUrl };
  }

  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  };
}

export function getVanityQueue(): Queue<{ generationId: string }> {
  if (!queueInstance) {
    queueInstance = new Queue<{ generationId: string }>(VANITY_GENERATION_QUEUE, {
      connection: getRedisConnection(),
    });
  }

  return queueInstance;
}

export async function getVanityQueueHealth() {
  const queue = getVanityQueue();
  const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');

  return {
    queueName: VANITY_GENERATION_QUEUE,
    counts,
    defaultAttempts: Number(process.env.WORKER_JOB_ATTEMPTS || 3),
    defaultBackoffMs: Number(process.env.WORKER_JOB_BACKOFF_MS || 5000),
  };
}

export async function closeVanityQueue(): Promise<void> {
  if (!queueInstance) {
    return;
  }

  await queueInstance.close();
  queueInstance = null;
}
