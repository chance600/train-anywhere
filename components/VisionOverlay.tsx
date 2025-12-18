
import React, { useRef, useEffect } from 'react';
import { VisionData } from '../types/vision';

interface VisionOverlayProps {
    dataRef: React.MutableRefObject<VisionData | null>; // [CHANGED] Use Ref for high-freq updates
    width: number;
    height: number;
    showVelocity: boolean;
    isMirrored?: boolean;
}

const VisionOverlay: React.FC<VisionOverlayProps> = ({
    dataRef,
    width,
    height,
    showVelocity,
    isMirrored = true
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameId = useRef<number | null>(null);
    const pathRef = useRef<{ x: number, y: number, age: number }[]>([]); // [NEW] Path Tracer History

    useEffect(() => {
        const renderLoop = () => {
            const canvas = canvasRef.current;
            if (!canvas) return; // Component unmounted
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const data = dataRef.current;

            // Clear Canvas
            ctx.clearRect(0, 0, width, height);

            if (data && data.pose && data.pose.landmarks && data.pose.landmarks[0]) {
                const landmarks = data.pose.landmarks[0];

                // Coordinate Transformation Helper
                const transformX = (x: number) => x * width;
                const transformY = (y: number) => y * height;

                // 1. Draw Weight Tracer (Velocity Path)
                if (showVelocity && data.objects.length > 0) {
                    const obj = data.objects[0];
                    const cx = obj.bbox[0] + obj.bbox[2] / 2;
                    const cy = obj.bbox[1] + obj.bbox[3] / 2;

                    // Add to path
                    pathRef.current.push({ x: cx, y: cy, age: 0 });
                }

                // Update & Draw Path
                if (pathRef.current.length > 0) {
                    ctx.save();
                    // Flip for drawing if needed (Standard flip)
                    // But points are relative (0-1). We transform them.

                    ctx.beginPath();
                    ctx.strokeStyle = 'cyan';
                    ctx.lineWidth = 4;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';

                    // Filter old points
                    pathRef.current = pathRef.current.filter(p => p.age < 30).map(p => ({ ...p, age: p.age + 1 }));

                    if (pathRef.current.length > 1) {
                        const start = pathRef.current[0];
                        ctx.moveTo(transformX(start.x), transformY(start.y));

                        for (let i = 1; i < pathRef.current.length; i++) {
                            const p = pathRef.current[i];
                            ctx.lineTo(transformX(p.x), transformY(p.y));
                        }
                        ctx.stroke();

                        // Draw Glow
                        ctx.shadowColor = 'cyan';
                        ctx.shadowBlur = 15;
                        ctx.stroke();
                        ctx.shadowBlur = 0;
                    }
                    ctx.restore();
                }


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

                // Draw Velocity Text (Floating HUD)
                if (showVelocity && data.velocity) {
                    ctx.save(); // Save BEFORE transformations

                    // 1. Text Context: Needs to be UN-MIRRORED to be readable
                    if (isMirrored) {
                        ctx.scale(-1, 1);
                        ctx.translate(-width, 0);
                    }

                    ctx.fillStyle = data.velocity.isExplosive ? '#ffff00' : '#00ffff';
                    ctx.font = 'bold 24px Courier New';
                    ctx.shadowBlur = 0;

                    const velText = `${data.velocity.velocity.toFixed(2)} m/s`;
                    const powerText = data.velocity.powerWatts ? `${data.velocity.powerWatts.toFixed(0)} W` : '';

                    ctx.fillText("VELOCITY: " + velText, 20, 40);
                    if (powerText) ctx.fillText("POWER:    " + powerText, 20, 70);

                    if (data.velocity.isExplosive) {
                        ctx.fillStyle = '#ff0000';
                        ctx.font = 'bold 32px Impact';
                        ctx.rotate(-0.1);
                        ctx.fillText("EXPLOSIVE!", width / 2 - 100, height - 100);
                    }
                    ctx.restore(); // Restore after text
                }
            }

            // Schedule Next Frame
            animationFrameId.current = requestAnimationFrame(renderLoop);
        };

        // Start Loop
        renderLoop();

        // Cleanup
        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [width, height, showVelocity, isMirrored]); // Dependencies for visual config only

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
