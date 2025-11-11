import { useEffect, useRef, useState } from "react";

// Performance constants
const MAX_PARTICLES = 30;
const MAX_TRAILS = 8;
const PARTICLE_SPAWN_THRESHOLD = 5;
const TRAIL_SPAWN_CHANCE = 0.08;

export const AnimatedBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const mouseVelocity = useRef({ x: 0, y: 0 });
  const prevMousePos = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    let throttleTimeout: NodeJS.Timeout;
    const handleMouseMove = (e: MouseEvent) => {
      if (throttleTimeout) return;
      
      throttleTimeout = setTimeout(() => {
        const newX = e.clientX;
        const newY = e.clientY;
        
        mouseVelocity.current = {
          x: (newX - prevMousePos.current.x) * 0.5,
          y: (newY - prevMousePos.current.y) * 0.5
        };
        
        prevMousePos.current = { x: newX, y: newY };
        setMousePos({ x: newX, y: newY });
        throttleTimeout = null as any;
      }, 16); // ~60fps throttle
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
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
    let frameCount = 0;

    const animate = () => {
      frameCount++;
      
      // Clear with trail effect
      ctx.fillStyle = "rgba(8, 12, 16, 0.2)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw precision grid (every 3rd frame)
      if (frameCount % 3 === 0) {
        ctx.strokeStyle = "rgba(52, 211, 235, 0.08)";
        ctx.lineWidth = 0.5;
        
        const gridSize = 80;
        gridOffset = (gridOffset + 0.3) % gridSize;

        // Reduce grid line density
        for (let x = 0; x < canvas.width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x + gridOffset, 0);
          ctx.lineTo(x + gridOffset, canvas.height);
          ctx.stroke();
        }

        for (let y = 0; y < canvas.height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y + gridOffset);
          ctx.lineTo(canvas.width, y + gridOffset);
          ctx.stroke();
        }
      }

      // Draw energy flow lines (simplified)
      ctx.strokeStyle = "rgba(52, 211, 235, 0.3)";
      ctx.lineWidth = 1.5;
      const flowY = [canvas.height * 0.35, canvas.height * 0.65];
      
      flowY.forEach((y, idx) => {
        const offset = (Date.now() * (0.15 + idx * 0.1)) % (canvas.width + 200);
        ctx.beginPath();
        ctx.moveTo(-100 + offset, y);
        ctx.lineTo(100 + offset, y);
        ctx.stroke();
      });

      // Spawn particles (with limits)
      const velocity = Math.abs(mouseVelocity.current.x) + Math.abs(mouseVelocity.current.y);
      if (velocity > PARTICLE_SPAWN_THRESHOLD && particles.length < MAX_PARTICLES) {
        particles.push({
          x: mousePos.x + (Math.random() - 0.5) * 15,
          y: mousePos.y + (Math.random() - 0.5) * 15,
          vx: mouseVelocity.current.x * 0.3 + (Math.random() - 0.5),
          vy: mouseVelocity.current.y * 0.3 + (Math.random() - 0.5),
          life: 0,
          maxLife: 40 + Math.random() * 30,
          size: 1.5 + Math.random()
        });
      }

      // Spawn light trails (with limits)
      if (Math.random() < TRAIL_SPAWN_CHANCE && trails.length < MAX_TRAILS) {
        trails.push({
          x: Math.random() * canvas.width,
          y: 0,
          vx: (Math.random() - 0.5),
          vy: 4 + Math.random() * 3,
          life: 0,
          maxLife: 80 + Math.random() * 60
        });
      }

      // Update and draw light trails (batch removal)
      for (let i = trails.length - 1; i >= 0; i--) {
        const trail = trails[i];
        trail.x += trail.vx;
        trail.y += trail.vy;
        trail.life++;
        
        if (trail.life >= trail.maxLife || trail.y > canvas.height) {
          trails.splice(i, 1);
          continue;
        }
        
        const alpha = 1 - trail.life / trail.maxLife;
        ctx.fillStyle = `rgba(52, 211, 235, ${alpha * 0.5})`;
        ctx.fillRect(trail.x, trail.y, 1.5, 12);
      }

      // Update and draw particles (batch removal, no glow)
      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.97;
        particle.vy *= 0.97;
        particle.life++;

        if (particle.life >= particle.maxLife) {
          particles.splice(i, 1);
          continue;
        }

        const alpha = 1 - particle.life / particle.maxLife;
        ctx.fillStyle = `rgba(52, 211, 235, ${alpha * 0.8})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Simplified cursor proximity (every other frame)
      if (frameCount % 2 === 0) {
        const proximityRadius = 120;
        const gradient = ctx.createRadialGradient(
          mousePos.x, mousePos.y, 0,
          mousePos.x, mousePos.y, proximityRadius
        );
        gradient.addColorStop(0, "rgba(52, 211, 235, 0.06)");
        gradient.addColorStop(1, "rgba(52, 211, 235, 0)");
        
        ctx.fillStyle = gradient;
        ctx.fillRect(
          mousePos.x - proximityRadius,
          mousePos.y - proximityRadius,
          proximityRadius * 2,
          proximityRadius * 2
        );
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
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
