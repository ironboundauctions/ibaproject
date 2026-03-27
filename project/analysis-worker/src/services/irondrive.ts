import { config } from '../config.js';
import { logger } from '../logger.js';
import type { IronDriveAnalysisRequest, IronDriveAnalysisResponse } from '../types.js';

export class IronDriveService {
  private apiUrl: string;

  constructor() {
    this.apiUrl = config.irondrive.apiUrl;
  }

  async analyzeImage(request: IronDriveAnalysisRequest): Promise<IronDriveAnalysisResponse> {
    try {
      logger.debug('Analyzing image via IronDrive', { fileName: request.fileName });

      const response = await fetch(`${this.apiUrl}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`IronDrive API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json() as IronDriveAnalysisResponse;
      logger.debug('Image analysis completed', { fileName: request.fileName });

      return result;
    } catch (error) {
      logger.error('IronDrive analysis failed', {
        fileName: request.fileName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async analyzeBatch(requests: IronDriveAnalysisRequest[]): Promise<IronDriveAnalysisResponse[]> {
    logger.info('Analyzing batch via IronDrive', { count: requests.length });

    const results = await Promise.allSettled(
      requests.map(request => this.analyzeImage(request))
    );

    const successfulResults: IronDriveAnalysisResponse[] = [];
    const failedCount = results.filter(r => r.status === 'rejected').length;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfulResults.push(result.value);
      } else {
        logger.warn('Batch item analysis failed', {
          fileName: requests[index].fileName,
          error: result.reason,
        });
      }
    });

    logger.info('Batch analysis completed', {
      total: requests.length,
      successful: successfulResults.length,
      failed: failedCount,
    });

    return successfulResults;
  }
}
