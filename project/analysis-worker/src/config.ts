import dotenv from 'dotenv';

dotenv.config();

export const config = {
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  irondrive: {
    apiUrl: process.env.IRONDRIVE_API_URL || '',
  },
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    pollInterval: parseInt(process.env.POLL_INTERVAL || '5000', 10),
    maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '3', 10),
    batchSize: parseInt(process.env.BATCH_SIZE || '10', 10),
  },
};

export function validateConfig(): void {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'IRONDRIVE_API_URL',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
