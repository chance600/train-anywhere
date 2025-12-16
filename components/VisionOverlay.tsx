
import React, { useRef, useEffect } from 'react';
import { VisionData } from '../types/vision';

interface VisionOverlayProps {
    data: VisionData;
    width: number;
    height: number;
    showVelocity: boolean;
    isMirrored?: boolean;
}

const VisionOverlay: React.FC<VisionOverlayProps> = ({
    data,
    width,
    height,
    showVelocity,
    isMirrored = true
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear Canvas
        ctx.clearRect(0, 0, width, height);

        // Coordinate Transformation Helper
        // logic is simpler now: CSS handles the flip
        const transformX = (x: number) => x * width;
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

            // Draw Landmarks (Red Dots) - SKIP FACE (0-10)
            ctx.fillStyle = '#FF0000'; // Classic Red
            landmarks.forEach((p: any, index: number) => {
                if (index > 10 && p.visibility && p.visibility > 0.5) { // Skip face
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
