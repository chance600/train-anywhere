
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

        // 1. Draw Skeleton (Cyber Style)
        if (data.pose && data.pose.landmarks && data.pose.landmarks[0]) {
            const landmarks = data.pose.landmarks[0];

            // Draw Connections (Green Cyber Lines)
            const connections = (window as any).POSE_CONNECTIONS || [
                [11, 13], [13, 15], // Left Arm
                [12, 14], [14, 16], // Right Arm
                [11, 12], [23, 24], // Shoulders, Hips
                [11, 23], [12, 24], // Torso
                [23, 25], [25, 27], // Left Leg
                [24, 26], [26, 28]  // Right Leg
            ];

            ctx.strokeStyle = '#00ffcc';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00ffcc';

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

            // 2. Heuristic "Chin-up Bar" (Virtual Bar)
            // Connect Left Wrist (15) to Right Wrist (16)
            const lw = landmarks[15];
            const rw = landmarks[16];
            if (lw && rw) {
                ctx.strokeStyle = '#39ff14'; // Neon Green
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(transformX(lw.x), transformY(lw.y));
                ctx.lineTo(transformX(rw.x), transformY(rw.y));
                ctx.stroke();

                // Label
                ctx.fillStyle = '#39ff14';
                ctx.font = '12px Courier';
                ctx.fillText("VIRTUAL BAR", (transformX(lw.x) + transformX(rw.x)) / 2 - 40, (transformY(lw.y) + transformY(rw.y)) / 2 - 10);
            }
        }

        // 3. Draw Object Detection (Iron Man HUD)
        if (showVelocity && data.objects.length > 0) {
            data.objects.forEach(obj => {
                const [x, y, w, h] = obj.bbox;
                // Transform BBox
                // BBox from TFJS is in pixels [x, y, w, h]. Need to mirror X if needed.
                let dx = x;
                if (isMirrored) {
                    dx = width - (x + w);
                }

                // Draw Bracket (Iron Man Corner Style)
                ctx.strokeStyle = '#ff3333';
                ctx.lineWidth = 2;
                ctx.shadowBlur = 5;
                ctx.shadowColor = '#ff3333';

                const lineLen = 15;
                // Top Left
                ctx.beginPath(); ctx.moveTo(dx, y + lineLen); ctx.lineTo(dx, y); ctx.lineTo(dx + lineLen, y); ctx.stroke();
                // Top Right
                ctx.beginPath(); ctx.moveTo(dx + w - lineLen, y); ctx.lineTo(dx + w, y); ctx.lineTo(dx + w, y + lineLen); ctx.stroke();
                // Bottom Left
                ctx.beginPath(); ctx.moveTo(dx, y + h - lineLen); ctx.lineTo(dx, y + h); ctx.lineTo(dx + lineLen, y + h); ctx.stroke();
                // Bottom Right
                ctx.beginPath(); ctx.moveTo(dx + w - lineLen, y + h); ctx.lineTo(dx + w, y + h); ctx.lineTo(dx + w, y + h - lineLen); ctx.stroke();

                // Label
                ctx.fillStyle = '#ff3333';
                ctx.font = 'bold 14px Arial';
                ctx.fillText(obj.class.toUpperCase(), dx + 5, y - 5);
            });
        }

        // 4. Draw Particles (Explosion Effect)
        if (showVelocity && data.velocity && data.velocity.isExplosive) {
            // Spawn new particles at object or center
            // Use nose as source if no object, or first object center
            let spawnX = width / 2;
            let spawnY = height / 2;

            if (data.objects.length > 0) {
                const obj = data.objects[0];
                let dx = obj.bbox[0];
                if (isMirrored) dx = width - (obj.bbox[0] + obj.bbox[2]);
                spawnX = dx + obj.bbox[2] / 2;
                spawnY = obj.bbox[1] + obj.bbox[3] / 2;
            } else if (data.pose && data.pose.landmarks && data.pose.landmarks[0]) {
                // Use nose
                spawnX = transformX(data.pose.landmarks[0][0].x);
                spawnY = transformY(data.pose.landmarks[0][0].y);
            }

            // Spawn burst
            for (let i = 0; i < 5; i++) {
                particlesRef.current.push(new Particle(spawnX, spawnY));
            }
        }

        // Update and Draw Particles
        particlesRef.current.forEach((p, index) => {
            p.update();
            p.draw(ctx);
            if (p.life <= 0) {
                particlesRef.current.splice(index, 1);
            }
        });

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
