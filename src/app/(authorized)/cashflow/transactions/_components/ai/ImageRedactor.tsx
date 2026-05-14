'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Trash2, X } from 'lucide-react';

interface RedactionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DrawState {
  isDrawing: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface ImageRedactorProps {
  file: File;
  preview: string;
  onApply: (redactedFile: File) => void;
  onCancel: () => void;
}

export default function ImageRedactor({
  file,
  preview,
  onApply,
  onCancel,
}: ImageRedactorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [rects, setRects] = useState<RedactionRect[]>([]);
  const [draw, setDraw] = useState<DrawState | null>(null);
  const imgDimsRef = useRef<{ w: number; h: number } | null>(null);

  const render = useCallback(
    (committed: RedactionRect[], active?: DrawState) => {
      const canvas = canvasRef.current;
      const dims = imgDimsRef.current;
      if (!canvas || !dims) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new window.Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'black';
        for (const r of committed) {
          ctx.fillRect(r.x, r.y, r.width, r.height);
        }

        if (active?.isDrawing) {
          const x = Math.min(active.startX, active.currentX);
          const y = Math.min(active.startY, active.currentY);
          const w = Math.abs(active.currentX - active.startX);
          const h = Math.abs(active.currentY - active.startY);
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(x, y, w, h);
          ctx.setLineDash([]);
        }
      };
      img.src = preview;
    },
    [preview],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const img = new window.Image();
    img.onload = () => {
      imgDimsRef.current = { w: img.naturalWidth, h: img.naturalHeight };
      const containerWidth = container.clientWidth;
      const scale = containerWidth / img.naturalWidth;
      canvas.width = containerWidth;
      canvas.height = img.naturalHeight * scale;
      render([], undefined);
    };
    img.src = preview;
  }, [preview, render]);

  useEffect(() => {
    render(rects, draw ?? undefined);
  }, [rects, draw, render]);

  function getCanvasPos(e: React.MouseEvent | React.TouchEvent): {
    x: number;
    y: number;
  } {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX =
      'touches' in e ? e.touches[0]!.clientX : (e as React.MouseEvent).clientX;
    const clientY =
      'touches' in e ? e.touches[0]!.clientY : (e as React.MouseEvent).clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function handlePointerDown(e: React.MouseEvent | React.TouchEvent) {
    const pos = getCanvasPos(e);
    setDraw({
      isDrawing: true,
      startX: pos.x,
      startY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
    });
  }

  function handlePointerMove(e: React.MouseEvent | React.TouchEvent) {
    if (!draw?.isDrawing) return;
    const pos = getCanvasPos(e);
    setDraw((prev) => prev && { ...prev, currentX: pos.x, currentY: pos.y });
  }

  function handlePointerUp() {
    if (!draw?.isDrawing) return;
    const w = Math.abs(draw.currentX - draw.startX);
    const h = Math.abs(draw.currentY - draw.startY);
    if (w > 8 && h > 8) {
      const newRect: RedactionRect = {
        x: Math.min(draw.startX, draw.currentX),
        y: Math.min(draw.startY, draw.currentY),
        width: w,
        height: h,
      };
      setRects((prev) => [...prev, newRect]);
    }
    setDraw(null);
  }

  function handleClearAll() {
    setRects([]);
    setDraw(null);
    render([], undefined);
  }

  function handleApply() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new window.Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'black';
      for (const r of rects) {
        ctx.fillRect(r.x, r.y, r.width, r.height);
      }

      canvas.toBlob((blob) => {
        if (!blob) return;
        const redactedFile = new File(
          [blob],
          file.name.replace(/\.[^.]+$/, '_redacted.png'),
          { type: 'image/png', lastModified: Date.now() },
        );
        onApply(redactedFile);
      }, 'image/png');
    };
    img.src = preview;
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/70'>
      <div className='bg-card rounded-xl shadow-2xl flex flex-col max-h-[90vh] w-full max-w-2xl mx-4'>
        <div className='flex items-center justify-between px-5 py-4 border-b border-border'>
          <div>
            <h2 className='text-base font-semibold text-foreground'>
              Redact Sensitive Information
            </h2>
            <p className='text-xs text-muted-foreground mt-0.5'>
              Draw over any text you want to hide (name, account number, BSB,
              etc.) before sending to AI.
            </p>
          </div>
          <button
            onClick={onCancel}
            className='text-muted-foreground hover:text-muted-foreground p-1 rounded'
            aria-label='Cancel redaction'
          >
            <X className='h-5 w-5' />
          </button>
        </div>

        <div className='bg-amber-50 border-b border-amber-100 px-5 py-2 text-xs text-amber-800 flex items-center gap-2'>
          <span className='inline-block w-4 h-4 bg-black rounded-sm flex-shrink-0' />
          Click and drag on the image to draw a black redaction box. Draw as
          many as needed.
        </div>

        <div
          ref={containerRef}
          className='flex-1 overflow-auto p-4 bg-muted'
        >
          <canvas
            ref={canvasRef}
            className='block mx-auto cursor-crosshair rounded shadow select-none touch-none'
            style={{ maxWidth: '100%' }}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          />
        </div>

        <div className='flex items-center justify-between px-5 py-4 border-t border-border gap-3'>
          <button
            onClick={handleClearAll}
            disabled={rects.length === 0}
            className='flex items-center gap-1.5 text-sm text-muted-foreground hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
          >
            <Trash2 className='h-4 w-4' />
            Clear all ({rects.length})
          </button>

          <div className='flex gap-3'>
            <button
              onClick={onCancel}
              className='px-4 py-2 text-sm font-medium text-foreground bg-card border border-input rounded-lg hover:bg-muted/50 transition-colors'
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className='flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors'
            >
              <Check className='h-4 w-4' />
              {rects.length > 0
                ? `Apply ${rects.length} redaction${rects.length !== 1 ? 's' : ''}`
                : 'Apply (no redactions)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
