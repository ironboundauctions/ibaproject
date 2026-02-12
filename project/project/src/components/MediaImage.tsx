import React, { useState } from 'react';

interface MediaImageProps {
  thumbUrl?: string | null;
  displayUrl?: string | null;
  raidUrl: string;
  alt: string;
  className?: string;
  variant?: 'thumb' | 'display';
  publishStatus?: string;
}

export function MediaImage({
  thumbUrl,
  displayUrl,
  raidUrl,
  alt,
  className = '',
  variant = 'thumb',
  publishStatus,
}: MediaImageProps) {
  const [imageError, setImageError] = useState(false);
  const [useRaidFallback, setUseRaidFallback] = useState(false);

  const cdnUrl = variant === 'thumb' ? thumbUrl : displayUrl;
  const shouldUseCdn = cdnUrl && publishStatus === 'published' && !imageError && !useRaidFallback;
  const imageUrl = shouldUseCdn ? cdnUrl : raidUrl;

  const handleError = () => {
    if (shouldUseCdn) {
      setImageError(true);
      setUseRaidFallback(true);
    }
  };

  const handleLoad = () => {
    setImageError(false);
  };

  return (
    <div className="relative">
      <img
        src={imageUrl}
        alt={alt}
        className={className}
        onError={handleError}
        onLoad={handleLoad}
        loading="lazy"
      />
      {publishStatus === 'processing' && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="text-white text-sm">Processing...</div>
        </div>
      )}
      {publishStatus === 'failed' && (
        <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
          Processing Failed
        </div>
      )}
    </div>
  );
}
