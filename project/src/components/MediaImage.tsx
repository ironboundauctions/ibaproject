import React, { useState } from 'react';

interface MediaImageProps {
  thumbUrl?: string | null;
  displayUrl?: string | null;
  alt: string;
  className?: string;
  variant?: 'thumb' | 'display';
  publishStatus?: string;
}

export function MediaImage({
  thumbUrl,
  displayUrl,
  alt,
  className = '',
  variant = 'thumb',
  publishStatus,
}: MediaImageProps) {
  const [imageError, setImageError] = useState(false);

  const cdnUrl = variant === 'thumb' ? thumbUrl : displayUrl;
  const isPublished = publishStatus === 'published' && cdnUrl && !imageError;

  const handleError = () => {
    setImageError(true);
  };

  const handleLoad = () => {
    setImageError(false);
  };

  // Show placeholder if not published or no CDN URL
  if (!isPublished) {
    return (
      <div className={`relative ${className} bg-gray-200 flex items-center justify-center`}>
        <div className="text-gray-500 text-sm text-center p-2">
          {publishStatus === 'processing' ? 'Processing...' :
           publishStatus === 'failed' ? 'Processing Failed' :
           'Image Unavailable'}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <img
        src={cdnUrl}
        alt={alt}
        className={className}
        onError={handleError}
        onLoad={handleLoad}
        loading="lazy"
      />
    </div>
  );
}
