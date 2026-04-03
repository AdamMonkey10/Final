import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  r: number;
  opacity: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

export function StarField({ className = '', count = 120 }: { className?: string; count?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      // Regenerate stars on resize
      starsRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: 0.5 + Math.random() * 1.5,
        opacity: 0.3 + Math.random() * 0.7,
        twinkleSpeed: 0.5 + Math.random() * 2,
        twinklePhase: Math.random() * Math.PI * 2,
      }));
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const ctx = canvas.getContext('2d')!;
    let frame = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;

      for (const star of starsRef.current) {
        const twinkle = 0.5 + 0.5 * Math.sin(star.twinklePhase + frame * 0.01 * star.twinkleSpeed);
        const alpha = star.opacity * (0.5 + 0.5 * twinkle);
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [count]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
    />
  );
}

export function TravelStarField({ speed = 1 }: { speed?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth || 400;
    canvas.height = canvas.offsetHeight || 600;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    const stars = Array.from({ length: 150 }, () => ({
      x: (Math.random() - 0.5) * W,
      y: (Math.random() - 0.5) * H,
      z: Math.random() * W,
    }));

    const draw = () => {
      ctx.fillStyle = 'rgba(5,5,20,0.2)';
      ctx.fillRect(0, 0, W, H);

      for (const star of stars) {
        star.z -= speed * 6;
        if (star.z <= 0) {
          star.x = (Math.random() - 0.5) * W;
          star.y = (Math.random() - 0.5) * H;
          star.z = W;
        }

        const sx = (star.x / star.z) * W + cx;
        const sy = (star.y / star.z) * H + cy;
        const r = Math.max(0.3, (1 - star.z / W) * 3);
        const alpha = 1 - star.z / W;

        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,220,255,${alpha})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [speed]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
    />
  );
}
