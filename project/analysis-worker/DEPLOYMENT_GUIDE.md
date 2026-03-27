# Analysis Worker Deployment Guide

This guide walks you through deploying the Analysis Worker to Railway.

## Prerequisites

1. Railway account (sign up at https://railway.app)
2. Supabase project URL and Service Role Key
3. IronDrive API URL

## Step 1: Create Railway Project

1. Go to https://railway.app and log in
2. Click "New Project"
3. Select "Deploy from GitHub repo" or "Empty Project"

## Step 2: Configure the Service

1. In your Railway project, click "New Service"
2. Select "GitHub Repo" and connect your repository
3. Set the **Root Directory** to `analysis-worker`
4. Railway will auto-detect the configuration from `nixpacks.toml`

## Step 3: Set Environment Variables

In the Railway service settings, add these environment variables:

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
IRONDRIVE_API_URL=your_irondrive_api_url
PORT=3001
POLL_INTERVAL=5000
MAX_CONCURRENT_JOBS=3
BATCH_SIZE=10
```

### Required Variables:
- `SUPABASE_URL`: Your Supabase project URL (from project settings)
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (from project settings > API)
- `IRONDRIVE_API_URL`: Your IronDrive API endpoint

### Optional Variables (with defaults):
- `PORT`: Server port (default: 3001)
- `POLL_INTERVAL`: How often to check for jobs in ms (default: 5000)
- `MAX_CONCURRENT_JOBS`: Maximum jobs to process simultaneously (default: 3)
- `BATCH_SIZE`: Images to analyze per batch (default: 10)

## Step 4: Deploy

1. Click "Deploy" in Railway
2. Wait for the build and deployment to complete
3. Railway will provide a public URL for your worker

## Step 5: Verify Deployment

Check the health endpoint:

```bash
curl https://your-worker-url.railway.app/health
```

You should see a response like:

```json
{
  "status": "healthy",
  "timestamp": "2026-03-27T...",
  "activeJobs": 0,
  "maxConcurrentJobs": 3
}
```

## Step 6: Update Frontend Configuration

In your main application's `.env` file, add the worker URL:

```
VITE_WORKER_URL=https://your-analysis-worker.railway.app
```

## Monitoring

### Check Worker Status

```bash
curl https://your-worker-url.railway.app/status
```

### View Logs

1. Go to your Railway project
2. Click on the Analysis Worker service
3. Click "View Logs" to see real-time logs

## Troubleshooting

### Worker Not Starting

Check the logs in Railway. Common issues:
- Missing environment variables
- Invalid Supabase credentials
- Network connectivity to Supabase

### Jobs Not Processing

1. Check worker logs for errors
2. Verify `IRONDRIVE_API_URL` is accessible
3. Check Supabase database for pending jobs:

```sql
SELECT * FROM batch_analysis_jobs WHERE status = 'pending';
```

### Slow Processing

Adjust these settings:
- Increase `MAX_CONCURRENT_JOBS` for more parallelism
- Adjust `BATCH_SIZE` based on IronDrive API limits
- Scale your Railway service to a larger instance

## Scaling

Railway allows you to scale your service:

1. Go to service settings
2. Increase RAM/CPU allocation
3. Adjust `MAX_CONCURRENT_JOBS` accordingly

Recommended configurations:
- Small: 512MB RAM, MAX_CONCURRENT_JOBS=2
- Medium: 1GB RAM, MAX_CONCURRENT_JOBS=3-5
- Large: 2GB+ RAM, MAX_CONCURRENT_JOBS=5-10

## Cost Optimization

- Set `POLL_INTERVAL` higher during low-usage periods
- Use Railway's sleep feature for non-production environments
- Monitor actual job processing needs and scale accordingly
