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

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      size: number;
    }> = [];

    const trails: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
    }> = [];

    // Grid animation
    let gridOffset = 0;

    const animate = () => {
      ctx.fillStyle = "rgba(8, 12, 16, 0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw precision grid
      ctx.strokeStyle = "rgba(52, 211, 235, 0.08)";
      ctx.lineWidth = 0.5;
      
      const gridSize = 50;
      gridOffset = (gridOffset + 0.5) % gridSize;

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

      // Spawn particles near cursor with velocity
      if (Math.abs(mouseVelocity.current.x) > 2 || Math.abs(mouseVelocity.current.y) > 2) {
        for (let i = 0; i < 2; i++) {
          particles.push({
            x: mousePos.x + (Math.random() - 0.5) * 20,
            y: mousePos.y + (Math.random() - 0.5) * 20,
            vx: mouseVelocity.current.x * 0.5 + (Math.random() - 0.5) * 2,
            vy: mouseVelocity.current.y * 0.5 + (Math.random() - 0.5) * 2,
            life: 1,
            maxLife: 60 + Math.random() * 40,
            size: 1 + Math.random() * 2
          });
        }
      }

      // Spawn light trails
      if (Math.random() < 0.15) {
        trails.push({
          x: Math.random() * canvas.width,
          y: 0,
          vx: (Math.random() - 0.5) * 2,
          vy: 3 + Math.random() * 4,
          life: 1,
          maxLife: 100 + Math.random() * 100
        });
      }

      // Update and draw light trails
      trails.forEach((trail, idx) => {
        trail.x += trail.vx;
        trail.y += trail.vy;
        trail.life++;
        
        const alpha = Math.max(0, 1 - trail.life / trail.maxLife);
        
        ctx.fillStyle = `rgba(52, 211, 235, ${alpha * 0.6})`;
        ctx.fillRect(trail.x, trail.y, 2, 15);
        
        // Add glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = "rgba(52, 211, 235, 0.8)";
        ctx.fillRect(trail.x, trail.y, 2, 15);
        ctx.shadowBlur = 0;

        if (trail.life >= trail.maxLife || trail.y > canvas.height) {
          trails.splice(idx, 1);
        }
      });

      // Update and draw particles
      particles.forEach((particle, idx) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.98;
        particle.vy *= 0.98;
        particle.life++;

        const alpha = Math.max(0, 1 - particle.life / particle.maxLife);
        
        ctx.fillStyle = `rgba(52, 211, 235, ${alpha})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Subtle glow
        ctx.shadowBlur = 5;
        ctx.shadowColor = "rgba(52, 211, 235, 0.6)";
        ctx.fill();
        ctx.shadowBlur = 0;

        if (particle.life >= particle.maxLife) {
          particles.splice(idx, 1);
        }
      });

      // Draw cursor proximity effect
      const proximityRadius = 150;
      const gradient = ctx.createRadialGradient(
        mousePos.x, mousePos.y, 0,
        mousePos.x, mousePos.y, proximityRadius
      );
      gradient.addColorStop(0, "rgba(52, 211, 235, 0.08)");
      gradient.addColorStop(1, "rgba(52, 211, 235, 0)");
      
      ctx.fillStyle = gradient;
      ctx.fillRect(
        mousePos.x - proximityRadius,
        mousePos.y - proximityRadius,
        proximityRadius * 2,
        proximityRadius * 2
      );

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
