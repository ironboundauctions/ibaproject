# Analysis Worker

Background worker service for processing bulk image analysis jobs using IronDrive.

## Features

- Polls for pending batch analysis jobs
- Processes images in configurable batch sizes
- Supports concurrent job processing
- Real-time progress updates
- Graceful shutdown handling

## Environment Variables

Required environment variables:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
IRONDRIVE_API_URL=your_irondrive_api_url
PORT=3001
POLL_INTERVAL=5000
MAX_CONCURRENT_JOBS=3
BATCH_SIZE=10
```

## Railway Deployment

1. Create a new Railway project
2. Add the following environment variables in Railway:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `IRONDRIVE_API_URL`
   - `PORT` (optional, defaults to 3001)
   - `POLL_INTERVAL` (optional, defaults to 5000ms)
   - `MAX_CONCURRENT_JOBS` (optional, defaults to 3)
   - `BATCH_SIZE` (optional, defaults to 10)

3. Deploy from the `analysis-worker` directory

## Local Development

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials

# Run in development mode
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## Health Check

The worker exposes a health endpoint:

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-03-27T...",
  "activeJobs": 2,
  "maxConcurrentJobs": 3
}
```

## How It Works

1. Worker polls database every `POLL_INTERVAL` ms for pending jobs
2. Claims up to `MAX_CONCURRENT_JOBS` at a time
3. For each job:
   - Updates status to "analyzing"
   - Processes files in batches of `BATCH_SIZE`
   - Calls IronDrive API for each batch
   - Updates progress after each batch
   - Sets status to "completed" or "failed" when done
4. Releases job slot and repeats

## Monitoring

Check worker status:

```bash
curl http://localhost:3001/status
```

Response:
```json
{
  "activeJobs": 2,
  "maxConcurrentJobs": 3,
  "pollInterval": 5000,
  "batchSize": 10
}
```
