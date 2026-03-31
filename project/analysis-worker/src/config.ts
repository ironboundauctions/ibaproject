import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '8080', 10),
  },
};

export function validateConfig(): void {
  // No required environment variables for barcode scanning
  // IronDrive is just a file picker (like Dropbox or PC) - not an API service
}
