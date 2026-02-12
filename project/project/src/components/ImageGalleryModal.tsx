import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Play } from 'lucide-react';

interface MediaItem {
  url: string;
  isVideo?: boolean;
}

interface ImageGalleryModalProps {
  images: string[] | MediaItem[];
  initialIndex?: number;
  onClose: () => void;
}

export default function ImageGalleryModal({ images, initialIndex = 0, onClose }: ImageGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Normalize images to MediaItem format
  const mediaItems: MediaItem[] = images.map(item =>
    typeof item === 'string' ? { url: item, isVideo: false } : item
  );
  const currentItem = mediaItems[currentIndex];
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, currentIndex]);

  // Scroll thumbnail into view when currentIndex changes
  useEffect(() => {
    if (thumbnailRefs.current[currentIndex]) {
      thumbnailRefs.current[currentIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [currentIndex]);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : mediaItems.length - 1));
    resetZoom();
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < mediaItems.length - 1 ? prev + 1 : 0));
    resetZoom();
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.5, 1));
  };

  const resetZoom = () => {
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPanPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (isFullscreen) {
      e.preventDefault();
      if (e.deltaY < 0) {
        handleZoomIn();
      } else {
        handleZoomOut();
      }
    }
  };

  const handleImageClick = () => {
    setIsFullscreen(true);
  };

  if (!images || images.length === 0) return null;
  const isVideo = currentItem.isVideo;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center">
      <div className={`${isFullscreen ? 'fixed inset-0' : 'max-w-6xl w-full mx-4'} flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 text-white">
          <div className="text-lg font-medium">
            {currentIndex + 1} of {mediaItems.length} {isVideo ? '(Video)' : ''}
          </div>
          <button
            onClick={isFullscreen ? () => setIsFullscreen(false) : onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Main Image Display */}
        <div
          className={`flex-1 relative flex items-center justify-center ${isFullscreen ? 'bg-black' : 'bg-gray-900 rounded-lg'} overflow-hidden`}
          onWheel={handleWheel}
        >
          {/* Navigation Arrows */}
          {mediaItems.length > 1 && (
            <>
              <button
                onClick={handlePrevious}
                className="absolute left-4 z-10 p-3 bg-black bg-opacity-50 hover:bg-opacity-75 text-white rounded-full transition-all"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-4 z-10 p-3 bg-black bg-opacity-50 hover:bg-opacity-75 text-white rounded-full transition-all"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Media Display */}
          <div
            className={`relative ${isFullscreen ? 'w-full h-full' : 'w-full h-[60vh]'} flex items-center justify-center`}
            onMouseDown={!isVideo ? handleMouseDown : undefined}
            onMouseMove={!isVideo ? handleMouseMove : undefined}
            onMouseUp={!isVideo ? handleMouseUp : undefined}
            onMouseLeave={!isVideo ? handleMouseUp : undefined}
          >
            {isVideo ? (
              <video
                src={currentItem.url}
                controls
                className="max-w-full max-h-full object-contain"
                style={{
                  width: isFullscreen ? '100%' : 'auto',
                  height: isFullscreen ? '100%' : 'auto'
                }}
                onError={(e) => {
                  console.error('Video failed to load:', currentItem.url);
                }}
              />
            ) : (
              <img
                src={currentItem.url}
                alt={`Image ${currentIndex + 1}`}
                className={`max-w-full max-h-full object-contain transition-transform ${isDragging ? 'cursor-grabbing' : zoomLevel > 1 ? 'cursor-grab' : 'cursor-zoom-in'}`}
                style={{
                  transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`
                }}
                onClick={() => !isFullscreen && handleImageClick()}
                onError={(e) => {
                  e.currentTarget.src = 'https://images.pexels.com/photos/1078884/pexels-photo-1078884.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2';
                }}
              />
            )}
          </div>

          {/* Zoom Controls - only for images */}
          {isFullscreen && !isVideo && (
            <div className="absolute bottom-4 right-4 flex items-center space-x-2 bg-black bg-opacity-50 rounded-lg p-2">
              <button
                onClick={handleZoomOut}
                disabled={zoomLevel <= 1}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              <span className="text-white text-sm font-medium min-w-[4rem] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                disabled={zoomLevel >= 4}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <button
                onClick={resetZoom}
                disabled={zoomLevel === 1}
                className="ml-2 px-3 py-2 hover:bg-white hover:bg-opacity-20 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Thumbnail Strip */}
        {!isFullscreen && mediaItems.length > 1 && (
          <div className="mt-4 p-4">
            <div className="flex items-center justify-start space-x-2 overflow-x-auto pb-2">
              {mediaItems.map((item, index) => (
                <button
                  key={index}
                  ref={(el) => (thumbnailRefs.current[index] = el)}
                  onClick={() => {
                    setCurrentIndex(index);
                    resetZoom();
                  }}
                  className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                    index === currentIndex
                      ? 'border-ironbound-orange-500 ring-2 ring-ironbound-orange-500 ring-opacity-50'
                      : 'border-gray-600 hover:border-gray-400'
                  }`}
                >
                  {item.isVideo ? (
                    <>
                      <video
                        src={item.url}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-black bg-opacity-60 rounded-full p-1">
                          <Play className="h-4 w-4 text-white fill-current" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <img
                      src={item.url}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.pexels.com/photos/1078884/pexels-photo-1078884.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2';
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        {!isFullscreen && (
          <div className="text-center text-white text-sm p-4 opacity-75">
            Use arrow keys to navigate {!isVideo && '• Click image for fullscreen'} • ESC to close
          </div>
        )}
      </div>
    </div>
  );
}
