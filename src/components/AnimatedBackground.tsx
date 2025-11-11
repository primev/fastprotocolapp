import { useEffect, useRef, useState } from "react";

export const AnimatedBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const mouseVelocity = useRef({ x: 0, y: 0 });
  const prevMousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX;
      const newY = e.clientY;
      
      mouseVelocity.current = {
        x: (newX - prevMousePos.current.x) * 0.5,
        y: (newY - prevMousePos.current.y) * 0.5
      };
      
      prevMousePos.current = { x: newX, y: newY };
      setMousePos({ x: newX, y: newY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Grid animation
    let gridOffset = 0;
    const gridSize = 50;

    const animate = () => {
      ctx.fillStyle = "rgba(8, 12, 16, 0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Calculate which grid cell the mouse is over
      const mouseGridX = Math.floor((mousePos.x - gridOffset) / gridSize);
      const mouseGridY = Math.floor((mousePos.y - gridOffset) / gridSize);

      gridOffset = (gridOffset + 0.5) % gridSize;

      // Draw precision grid with hover highlights
      for (let x = -gridSize; x < canvas.width + gridSize; x += gridSize) {
        for (let y = -gridSize; y < canvas.height + gridSize; y += gridSize) {
          const gridX = Math.floor((x + gridOffset - gridOffset) / gridSize);
          const gridY = Math.floor((y + gridOffset - gridOffset) / gridSize);
          
          // Check if this cell is near the mouse (within 2 cell radius)
          const cellX = Math.floor((x + gridOffset) / gridSize);
          const cellY = Math.floor((y + gridOffset) / gridSize);
          const distance = Math.sqrt(
            Math.pow(cellX - mouseGridX, 2) + Math.pow(cellY - mouseGridY, 2)
          );
          
          // Highlight cells near mouse with fade based on distance
          if (distance < 3) {
            const alpha = Math.max(0, 0.15 - distance * 0.05);
            ctx.fillStyle = `rgba(52, 211, 235, ${alpha})`;
            ctx.fillRect(x + gridOffset, y + gridOffset, gridSize, gridSize);
          }
        }
      }

      // Draw grid lines
      ctx.strokeStyle = "rgba(52, 211, 235, 0.08)";
      ctx.lineWidth = 0.5;

      for (let x = -gridSize; x < canvas.width + gridSize; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x + gridOffset, 0);
        ctx.lineTo(x + gridOffset, canvas.height);
        ctx.stroke();
      }

      for (let y = -gridSize; y < canvas.height + gridSize; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y + gridOffset);
        ctx.lineTo(canvas.width, y + gridOffset);
        ctx.stroke();
      }

      // Draw energy flow lines (horizontal)
      ctx.strokeStyle = "rgba(52, 211, 235, 0.4)";
      ctx.lineWidth = 1.5;
      const flowY = [canvas.height * 0.3, canvas.height * 0.5, canvas.height * 0.7];
      
      flowY.forEach((y, idx) => {
        const offset = (Date.now() * (0.2 + idx * 0.1)) % canvas.width;
        ctx.beginPath();
        ctx.moveTo(-100 + offset, y);
        ctx.lineTo(200 + offset, y);
        ctx.stroke();
        
        // Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = "rgba(52, 211, 235, 0.8)";
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [mousePos]);

  return (
    <>
      {/* Base gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-card" />
      
      {/* Canvas for particles and animations */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0"
      />
      
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
