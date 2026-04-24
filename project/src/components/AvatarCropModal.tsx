import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, Check, RotateCcw } from 'lucide-react';

interface Props {
  imageSrc: string;
  onConfirm: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

const CANVAS_SIZE = 400;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export default function AvatarCropModal({ imageSrc, onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgLoaded, setImgLoaded] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      setImgLoaded(true);

      const scale = Math.max(CANVAS_SIZE / img.naturalWidth, CANVAS_SIZE / img.naturalHeight);
      const initialZoom = Math.max(1, scale);
      setZoom(initialZoom);
      setOffset({ x: 0, y: 0 });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const clampOffset = useCallback(
    (ox: number, oy: number, z: number) => {
      if (!imgRef.current) return { x: ox, y: oy };
      const scaledW = naturalSize.w * z;
      const scaledH = naturalSize.h * z;

      const maxX = Math.max(0, (scaledW - CANVAS_SIZE) / 2);
      const maxY = Math.max(0, (scaledH - CANVAS_SIZE) / 2);

      return {
        x: Math.min(maxX, Math.max(-maxX, ox)),
        y: Math.min(maxY, Math.max(-maxY, oy)),
      };
    },
    [naturalSize]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const scaledW = naturalSize.w * zoom;
    const scaledH = naturalSize.h * zoom;
    const drawX = (CANVAS_SIZE - scaledW) / 2 - offset.x;
    const drawY = (CANVAS_SIZE - scaledH) / 2 - offset.y;

    ctx.drawImage(img, drawX, drawY, scaledW, scaledH);
  }, [zoom, offset, imgLoaded, naturalSize]);

  useEffect(() => {
    draw();
  }, [draw]);

  function handleMouseDown(e: React.MouseEvent) {
    setDragging(true);
    setDragStart({ x: e.clientX + offset.x, y: e.clientY + offset.y });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging) return;
    const rawX = e.clientX - dragStart.x;
    const rawY = e.clientY - dragStart.y;
    const clamped = clampOffset(-rawX, -rawY, zoom);
    setOffset(clamped);
  }

  function handleMouseUp() {
    setDragging(false);
  }

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    setDragging(true);
    setDragStart({ x: t.clientX + offset.x, y: t.clientY + offset.y });
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!dragging) return;
    const t = e.touches[0];
    const rawX = t.clientX - dragStart.x;
    const rawY = t.clientY - dragStart.y;
    const clamped = clampOffset(-rawX, -rawY, zoom);
    setOffset(clamped);
  }

  function handleZoomChange(newZoom: number) {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom));
    const clamped = clampOffset(offset.x, offset.y, z);
    setZoom(z);
    setOffset(clamped);
  }

  function handleWheelZoom(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    handleZoomChange(zoom + delta);
  }

  function handleReset() {
    const scale = Math.max(CANVAS_SIZE / naturalSize.w, CANVAS_SIZE / naturalSize.h);
    setZoom(Math.max(1, scale));
    setOffset({ x: 0, y: 0 });
  }

  function handleConfirm() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = 400;
    outputCanvas.height = 400;
    const ctx = outputCanvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(canvas, 0, 0);

    outputCanvas.toBlob(
      (blob) => {
        if (blob) onConfirm(blob);
      },
      'image/jpeg',
      0.92
    );
  }

  const zoomPercent = Math.round(((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Adjust Photo</h3>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500 text-center">
            Drag to reposition · Scroll or pinch to zoom
          </p>

          <div className="flex justify-center">
            <div className="relative" style={{ width: CANVAS_SIZE / 2, height: CANVAS_SIZE / 2 }}>
              <div
                className="rounded-full overflow-hidden border-4 border-ironbound-orange-200 shadow-lg"
                style={{ width: CANVAS_SIZE / 2, height: CANVAS_SIZE / 2 }}
              >
                <canvas
                  ref={canvasRef}
                  width={CANVAS_SIZE}
                  height={CANVAS_SIZE}
                  style={{
                    width: CANVAS_SIZE / 2,
                    height: CANVAS_SIZE / 2,
                    cursor: dragging ? 'grabbing' : 'grab',
                    display: 'block',
                    touchAction: 'none',
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleMouseUp}
                  onWheel={handleWheelZoom}
                />
              </div>

              {!imgLoaded && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-gray-100">
                  <div className="w-6 h-6 border-2 border-ironbound-orange-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => handleZoomChange(zoom - 0.15)}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors flex-shrink-0"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={zoomPercent}
                onChange={(e) =>
                  handleZoomChange(
                    MIN_ZOOM + (Number(e.target.value) / 100) * (MAX_ZOOM - MIN_ZOOM)
                  )
                }
                className="flex-1 h-1.5 rounded-full appearance-none bg-gray-200 accent-ironbound-orange-500 cursor-pointer"
              />
              <button
                onClick={() => handleZoomChange(zoom + 0.15)}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors flex-shrink-0"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
            <div className="flex justify-center">
              <button
                onClick={handleReset}
                className="flex items-center space-x-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset position</span>
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 flex space-x-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!imgLoaded}
            className="flex-1 px-4 py-2.5 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 disabled:bg-gray-200 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center space-x-1.5"
          >
            <Check className="h-4 w-4" />
            <span>Apply</span>
          </button>
        </div>
      </div>
    </div>
  );
}
