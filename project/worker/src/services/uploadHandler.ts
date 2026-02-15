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

      const { item_id } = req.body;

      if (!item_id) {
        res.status(400).json({ error: 'item_id is required' });
        return;
      }

      logger.info('Processing PC upload', {
        filename: req.file.originalname,
        size: req.file.size,
        item_id
      });

      const assetGroupId = crypto.randomUUID();
      const variants = await this.imageProcessor.processImage(req.file.buffer);

      const uploadResults = [];

      const variantEntries = [
        { name: 'thumb', data: variants.thumb },
        { name: 'display', data: variants.display }
      ];

      for (const { name, data } of variantEntries) {
        const b2Key = `assets/${assetGroupId}/${name}.webp`;
        const cdnUrl = this.storage.getCdnUrl(b2Key);

        await this.storage.uploadFile(b2Key, data.buffer, 'image/webp');

        const variantId = await this.db.upsertVariant(
          assetGroupId,
          name,
          cdnUrl,
          {
            b2Key,
            width: data.width,
            height: data.height
          }
        );

        await this.db.setVariantItemAndMetadata(variantId, item_id, req.file.originalname, data.buffer.length, 'image/webp');

        uploadResults.push({
          variant: name,
          b2_key: b2Key,
          cdn_url: cdnUrl,
          id: variantId,
          width: data.width,
          height: data.height
        });
      }

      logger.info('PC upload completed successfully', {
        item_id,
        asset_group_id: assetGroupId,
        variants: uploadResults.length
      });

      res.json({
        success: true,
        asset_group_id: assetGroupId,
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
