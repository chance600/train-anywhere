
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
        // Standard mapping (CSS handles the mirror flip)
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
                // FILTER: Skip Face Landmarks (0-10)
                if (i < 11 || j < 11) return;

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

            // Note: Canvas is mirrored, so text will be backwards if we just draw it!
            // We need to un-mirror text drawing context.
            ctx.save();
            if (isMirrored) {
                ctx.scale(-1, 1);
                ctx.translate(-width, 0);
            }

            const velText = `${data.velocity.velocity.toFixed(2)} m/s`;
            const powerText = data.velocity.powerWatts ? `${data.velocity.powerWatts.toFixed(0)} W` : '';

            // Draw top right corner (Now visually correct because context is flipped back)
            // Wait, if canvas is flipped by CSS, the text drawn normally is flipped.
            // If we flip the Context inside, we are double flipping?
            // No, CSS flips the whole element. 
            // So if I draw "ABC", user sees "CBA".
            // To fix this, I have to draw "CBA" so user sees "ABC".
            // OR I can just make the text a DOM overlay instead of canvas?
            // Actually, for simplicity, I should just draw text normally and accept it's flipped for now,
            // OR flip the context.
            // Let's try flipping the context for text.

            // Actually, keep it simple. Let's stick with the DOM mirroring strategy and just flip the context for text.
            ctx.scale(-1, 1);
            ctx.translate(-width, 0);

            ctx.fillText("VELOCITY: " + velText, 20, 40);
            if (powerText) ctx.fillText("POWER:    " + powerText, 20, 70);

            if (data.velocity.isExplosive) {
                ctx.fillStyle = '#ff0000';
                ctx.font = 'bold 32px Impact';
                ctx.rotate(-0.1);
                ctx.fillText("EXPLOSIVE!", width / 2 - 100, height - 100);
            }
            ctx.restore();
        }

        ctx.restore();

    }, [data, width, height, showVelocity, isMirrored]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="absolute inset-0 pointer-events-none z-10"
            style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}
        />
    );
};

export default VisionOverlay;
