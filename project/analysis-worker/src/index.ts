import express, { Request, Response } from 'express';
import multer from 'multer';
import cors from 'cors';
import { config, validateConfig } from './config.js';
import { logger } from './logger.js';
import { BarcodeScanner } from './services/barcodeScanner.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 100, // Max 100 files per request
  },
});

interface AnalysisFile {
  fileName: string;
  assetGroupId: string;
}

interface GroupedItem {
  inv_number: string;
  files: AnalysisFile[];
}

interface AnalysisResponse {
  grouped: GroupedItem[];
  ungrouped: AnalysisFile[];
  errors: { fileName: string; error: string }[];
}

async function main() {
  try {
    validateConfig();
    logger.info('Configuration validated successfully');

    const app = express();
    const scanner = new BarcodeScanner();

    // Enable CORS
    app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    app.use(express.json());

    // Health check endpoint
    app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'barcode-analysis-worker',
      });
    });

    // Barcode analysis endpoint
    app.post('/api/analyze-batch', upload.array('files'), async (req: Request, res: Response) => {
      try {
        const files = req.files as Express.Multer.File[];

        if (!files || files.length === 0) {
          return res.status(400).json({ error: 'No files provided' });
        }

        // Get asset group IDs from request body
        const fileMetadata = JSON.parse(req.body.metadata || '[]') as Array<{
          fileName: string;
          assetGroupId: string;
        }>;

        logger.info('Starting batch analysis', {
          fileCount: files.length,
          metadataCount: fileMetadata.length,
        });

        // Scan all files for barcodes
        const scanPromises = files.map((file, index) => {
          const metadata = fileMetadata.find(m => m.fileName === file.originalname) || {
            fileName: file.originalname,
            assetGroupId: `asset_${Date.now()}_${index}`,
          };

          return scanner.scanImage(file.buffer, metadata.fileName, metadata.assetGroupId);
        });

        const scanResults = await Promise.all(scanPromises);

        // Group results by barcode value
        const grouped: Map<string, AnalysisFile[]> = new Map();
        const ungrouped: AnalysisFile[] = [];
        const errors: { fileName: string; error: string }[] = [];

        for (const result of scanResults) {
          if (result.error) {
            errors.push({ fileName: result.fileName, error: result.error });
          } else if (result.barcodeValue) {
            const existing = grouped.get(result.barcodeValue) || [];
            existing.push({
              fileName: result.fileName,
              assetGroupId: result.assetGroupId,
            });
            grouped.set(result.barcodeValue, existing);
          } else {
            ungrouped.push({
              fileName: result.fileName,
              assetGroupId: result.assetGroupId,
            });
          }
        }

        // Convert grouped map to array format
        const groupedArray: GroupedItem[] = Array.from(grouped.entries()).map(([inv_number, files]) => ({
          inv_number,
          files,
        }));

        const response: AnalysisResponse = {
          grouped: groupedArray,
          ungrouped,
          errors,
        };

        logger.info('Batch analysis complete', {
          totalFiles: files.length,
          groupedCount: groupedArray.length,
          ungroupedCount: ungrouped.length,
          errorCount: errors.length,
        });

        res.json(response);
      } catch (error) {
        logger.error('Error in analyze-batch endpoint', {
          error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
          error: 'Failed to analyze batch',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    const server = app.listen(config.server.port, () => {
      logger.info('Analysis Worker started', {
        port: config.server.port,
        service: 'barcode-analysis-worker',
      });
    });

    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start Analysis Worker', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

main();
