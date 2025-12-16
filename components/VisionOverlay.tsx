
import React, { useRef, useEffect } from 'react';
import { VisionData } from '../types/vision';

interface VisionOverlayProps {
    data: VisionData;
    width: number;
    height: number;
    showVelocity: boolean;
    isMirrored?: boolean;
}

// --- Particle System ---
class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2 + 1;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.color = `hsl(${Math.random() * 60 + 20}, 100%, 70%)`; // Gold/Fire colors
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.02; // Fade out
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

const VisionOverlay: React.FC<VisionOverlayProps> = ({
    data,
    width,
    height,
    showVelocity,
    isMirrored = true
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear Canvas
        ctx.clearRect(0, 0, width, height);

        // Coordinate Transformation Helper
        // If mirrored, x' = width - x
        const transformX = (x: number) => isMirrored ? width - (x * width) : x * width;
        const transformY = (y: number) => y * height;

        // 1. Draw Skeleton (Classic Debug Style)
        if (data.pose && data.pose.landmarks && data.pose.landmarks[0]) {
            const landmarks = data.pose.landmarks[0];

            // Draw Connections (Green Lines)
            const connections = (window as any).POSE_CONNECTIONS || [
                [11, 13], [13, 15], // Left Arm
                [12, 14], [14, 16], // Right Arm
                [11, 12], [23, 24], // Shoulders, Hips
                [11, 23], [12, 24], // Torso
                [23, 25], [25, 27], // Left Leg
                [24, 26], [26, 28]  // Right Leg
            ];

            ctx.strokeStyle = '#00FF00'; // Classic Green
            ctx.lineWidth = 2;

            connections.forEach(([i, j]: [number, number]) => {
                const p1 = landmarks[i];
                const p2 = landmarks[j];
                if (p1 && p2 && p1.visibility && p1.visibility > 0.5 && p2.visibility && p2.visibility > 0.5) {
                    ctx.beginPath();
                    ctx.moveTo(transformX(p1.x), transformY(p1.y));
                    ctx.lineTo(transformX(p2.x), transformY(p2.y));
                    ctx.stroke();
                }
            });

            // Draw Landmarks (Red Dots)
            ctx.fillStyle = '#FF0000'; // Classic Red
            landmarks.forEach((p: any) => {
                if (p.visibility && p.visibility > 0.5) {
                    ctx.beginPath();
                    ctx.arc(transformX(p.x), transformY(p.y), 4, 0, 2 * Math.PI);
                    ctx.fill();
                }
            });
        }

        // 5. Draw Velocity Text (Floating HUD)
        if (showVelocity && data.velocity) {
            ctx.fillStyle = data.velocity.isExplosive ? '#ffff00' : '#00ffff';
            ctx.font = 'bold 24px Courier New';
            ctx.shadowBlur = 0;

            const velText = `${data.velocity.velocity.toFixed(2)} m/s`;
            const powerText = data.velocity.powerWatts ? `${data.velocity.powerWatts.toFixed(0)} W` : '';

            // Draw top right corner
            ctx.fillText("VELOCITY: " + velText, 20, 40);
            if (powerText) ctx.fillText("POWER:    " + powerText, 20, 70);

            if (data.velocity.isExplosive) {
                ctx.fillStyle = '#ff0000';
                ctx.font = 'bold 32px Impact';
                ctx.rotate(-0.1);
                ctx.fillText("EXPLOSIVE!", width / 2 - 100, height - 100);
                ctx.rotate(0.1);
            }
        }

        ctx.restore();

    }, [data, width, height, showVelocity, isMirrored]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="absolute inset-0 pointer-events-none z-10"
        />
    );
};

export default VisionOverlay;
