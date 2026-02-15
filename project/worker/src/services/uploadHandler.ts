import { Request, Response } from 'express';
import { ImageProcessor } from './imageProcessor.js';
import { StorageService } from './storage.js';
import { DatabaseService } from './database.js';
import { logger } from '../logger.js';
import crypto from 'crypto';

export class UploadHandler {
  constructor(
    private db: DatabaseService,
    private imageProcessor: ImageProcessor,
    private storage: StorageService
  ) {}

  async handlePCUpload(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      const { lot_id, inventory_item_id } = req.body;

      if (!lot_id && !inventory_item_id) {
        res.status(400).json({ error: 'Either lot_id or inventory_item_id is required' });
        return;
      }

      logger.info('Processing PC upload', {
        filename: req.file.originalname,
        size: req.file.size,
        lot_id,
        inventory_item_id
      });

      const variants = await this.imageProcessor.processImage(req.file.buffer);

      const uploadResults = [];

      const variantEntries = [
        { name: 'thumb', data: variants.thumb },
        { name: 'display', data: variants.display }
      ];

      for (const { name, data } of variantEntries) {
        const fileKey = `processed/${name}_${crypto.randomUUID()}.webp`;

        await this.storage.uploadFile(fileKey, data.buffer, 'image/webp');

        const fileRecord = await this.db.createAuctionFile({
          lot_id: lot_id || null,
          inventory_item_id: inventory_item_id || null,
          variant: name,
          b2_key: fileKey,
          source_key: null,
          status: 'published',
          uploaded_from: 'pc',
          file_size: data.buffer.length,
          width: data.width,
          height: data.height,
          format: 'webp'
        });

        uploadResults.push({
          variant: name,
          b2_key: fileKey,
          cdn_url: this.storage.getCdnUrl(fileKey),
          id: fileRecord.id,
          width: data.width,
          height: data.height
        });
      }

      logger.info('PC upload completed successfully', {
        lot_id,
        inventory_item_id,
        variants: uploadResults.length
      });

      res.json({
        success: true,
        files: uploadResults
      });

    } catch (error) {
      logger.error('PC upload failed', error as Error);
      res.status(500).json({
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
