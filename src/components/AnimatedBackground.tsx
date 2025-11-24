import { useEffect, useRef } from 'react';

export const AnimatedBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const reduceMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      // Set the internal pixel buffer size for HiDPI displays
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      // Reset transform before scaling to avoid compounding
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    resize();

    const gridSize = 50;
    let gridOffset = 0;

    let animationFrameId: number;
    const animate = (time: number) => {
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      // Semi-transparent overlay to create motion trails
      ctx.fillStyle = 'rgba(8, 12, 16, 0.15)';
      ctx.fillRect(0, 0, width, height);

      // Advance grid offset; respect reduced-motion preference
      const gridSpeed = reduceMotion ? 0 : 0.5;
      gridOffset = (gridOffset + gridSpeed) % gridSize;

      // Calculate the single grid cell under the mouse
      const mouseX = mousePosRef.current.x;
      const mouseY = mousePosRef.current.y;
      const mouseGridX = Math.floor(mouseX / gridSize) * gridSize;
      const mouseGridY = Math.floor(mouseY / gridSize) * gridSize;

      // Draw the highlighted square first (under the grid)
      ctx.fillStyle = 'rgba(58, 147, 238, 0.2)';
      ctx.fillRect(mouseGridX, mouseGridY, gridSize, gridSize);

      // Add glow to highlighted square
      ctx.strokeStyle = 'rgba(58, 147, 238, 0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(mouseGridX, mouseGridY, gridSize, gridSize);

      // Draw grid lines
      ctx.strokeStyle = 'rgba(58, 147, 238, 0.08)';
      ctx.lineWidth = 0.5;

      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x + gridOffset, 0);
        ctx.lineTo(x + gridOffset, height);
        ctx.stroke();
      }

      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y + gridOffset);
        ctx.lineTo(width, y + gridOffset);
        ctx.stroke();
      }

      // Draw energy flow lines (horizontal)
      if (!reduceMotion) {
        const flowY = [height * 0.3, height * 0.5, height * 0.7];
        flowY.forEach((y, idx) => {
          const offset = (time * (0.2 + idx * 0.1)) % width;
          ctx.save();
          ctx.strokeStyle = 'rgba(58, 147, 238, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.shadowBlur = 15;
          ctx.shadowColor = 'rgba(58, 147, 238, 0.8)';
          ctx.beginPath();
          ctx.moveTo(-100 + offset, y);
          ctx.lineTo(200 + offset, y);
          ctx.stroke();
          ctx.restore();
        });
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      {/* Base gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-card" />

      {/* Canvas for particles and animations */}
      <canvas ref={canvasRef} className="absolute inset-0 z-0" />

      {/* Subtle vignette */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-background/60" />

      {/* Horizontal speed lines */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute top-1/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent animate-speed-line" />
        <div className="absolute top-2/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent animate-speed-line-delayed" />
        <div className="absolute top-3/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent animate-speed-line-delayed-2" />
      </div>
    </>
  );
};
