import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Worker } from 'worker_threads';
import path from 'path';
import { VanityRequest, GenerationProgress, VanityResult, WorkerMessage } from './types';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// TON Connect Deep Link Generator
import { generateTonConnectLink } from './tonConnect';

// Active generation jobs
const activeJobs = new Map<string, {
  workers: Worker[];
  startTime: number;
  totalAttempts: number;
  found: boolean;
  request: VanityRequest;
}>();

const NUM_WORKERS = 4; // Number of parallel workers

function createWorker(workerData: any): Worker {
  const workerPath = path.resolve(__dirname, './workers/vanityWorker.js');
  return new Worker(workerPath, { workerData });
}

// Endpoint for TON Connect
app.post('/api/tonconnect', (req, res) => {
  const { appName, walletAddress } = req.body;
  if (!appName || !walletAddress) {
    return res.status(400).json({ error: 'Missing appName or walletAddress.' });
  }

  const deepLink = generateTonConnectLink(appName, walletAddress);
  res.status(200).json({ deepLink });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('start-generation', (request: VanityRequest) => {
    const jobId = socket.id;
    
    // Stop any existing job for this socket
    if (activeJobs.has(jobId)) {
      stopGeneration(jobId);
    }
    
    console.log(`Starting generation for pattern: ${request.pattern} (${request.type})`);
    socket.emit('log', `Server: Pattern '${request.pattern}' received, worker generation starting.`);
    
    const workers: Worker[] = [];
    const startTime = Date.now();
    let totalAttempts = 0;
    let found = false;
    
    // Start workers
    for (let i = 0; i < NUM_WORKERS; i++) {
      const worker = createWorker({
        ...request,
        workerId: i,
        startNonce: i * 10000000 // Each worker starts at different offset
      });
      
      worker.on('message', (message: WorkerMessage) => {
        if (message.type === 'progress') {
          totalAttempts += message.data.attempts;
          
          // Calculate attempts per second
          const elapsedSeconds = (Date.now() - startTime) / 1000;
          const attemptsPerSecond = Math.floor(totalAttempts / elapsedSeconds);
          
          // Estimate time (rough: 16^n attempts needed for n hex chars)
          const patternLength = request.pattern.length;
          const totalPossibilities = Math.pow(16, patternLength);
          const remainingAttempts = Math.max(0, totalPossibilities - totalAttempts);
          const estimatedTimeSeconds = attemptsPerSecond > 0 
            ? Math.floor(remainingAttempts / attemptsPerSecond)
            : null;
          
          socket.emit('progress', {
            attempts: totalAttempts,
            attemptsPerSecond,
            estimatedTimeSeconds,
            status: 'running'
          } as GenerationProgress);
        } else if (message.type === 'found' && !found) {
          found = true;
          const timeTaken = (Date.now() - startTime) / 1000;
          
          const result: VanityResult = {
            ...message.data,
            walletType: request.walletType,
            pattern: request.pattern,
            timeTaken
          };
          
          socket.emit('found', result);
          
          // Stop all workers
          stopGeneration(jobId);
        }
      });
      
      worker.on('error', (error: any) => {
        console.error(`Worker ${i} error:`, error);
        socket.emit('error', { message: error?.message || 'Worker error' });
      });
      
      workers.push(worker);
    }
    
    activeJobs.set(jobId, { workers, startTime, totalAttempts, found, request });
  });
  
  socket.on('stop-generation', () => {
    const jobId = socket.id;
    stopGeneration(jobId);
    socket.emit('stopped');
  });
  
  socket.on('disconnect', () => {
    stopGeneration(socket.id);
    console.log('Client disconnected:', socket.id);
  });
});

function stopGeneration(jobId: string) {
  const job = activeJobs.get(jobId);
  if (job) {
    job.workers.forEach(worker => {
      worker.terminate();
    });
    activeJobs.delete(jobId);
    console.log(`Stopped generation for job: ${jobId}`);
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', activeJobs: activeJobs.size });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`TON Vanity Generator Backend running on port ${PORT}`);
});