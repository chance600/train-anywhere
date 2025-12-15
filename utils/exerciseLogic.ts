// import { Results } from '@mediapipe/pose'; // Removed to avoid dependency

export interface Results {
  poseLandmarks: Point[];
  poseWorldLandmarks?: Point[];
  image: any;
  segmentationMask?: any;
}

export interface Point {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface ExerciseConfig {
  name: string;
  calculateProgress: (landmarks: Point[]) => number;
  checkForm?: (landmarks: Point[]) => string | null;
  calculateScore?: (landmarks: Point[]) => number;
  thresholds: {
    start: number;
    middle: number; // The "rep complete" point (e.g., bottom of squat)
    end: number;    // Return to start
  };
  instruction: string;
}

// Helper to calculate angle between three points (A, B, C) where B is the vertex
export const calculateAngle = (a: Point, b: Point, c: Point): number => {
  if (!a || !b || !c) return 0;

  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);

  if (angle > 180.0) {
    angle = 360 - angle;
  }

  return angle;
};

export const EXERCISE_CATALOG: Record<string, ExerciseConfig> = {
  'Squats': {
    name: 'Squats',
    instruction: "Stand with feet shoulder-width apart. Lower your hips back and down.",
    calculateProgress: (landmarks: Point[]) => {
      const hip = landmarks[23];
      const knee = landmarks[25];
      const ankle = landmarks[27];
      return calculateAngle(hip, knee, ankle);
    },
    checkForm: (landmarks: Point[]) => {
      // Check for knees caving in (valgus)
      const leftHip = landmarks[23];
      const rightHip = landmarks[24];
      const leftKnee = landmarks[25];
      const rightKnee = landmarks[26];

      if (leftHip && rightHip && leftKnee && rightKnee) {
        const hipWidth = Math.abs(leftHip.x - rightHip.x);
        const kneeWidth = Math.abs(leftKnee.x - rightKnee.x);
        if (kneeWidth < hipWidth * 0.8) {
          return "Keep your knees out!";
        }
      }
      return null;
    },
    calculateScore: (landmarks: Point[]) => {
      let score = 100;

      // 1. Depth Score
      const hip = landmarks[23];
      const knee = landmarks[25];
      const ankle = landmarks[27];
      const angle = calculateAngle(hip, knee, ankle);

      // Ideal depth is ~90 degrees. 
      // If > 100 (shallow), deduct points.
      if (angle > 100) {
        score -= (angle - 100) * 2; // e.g. 120 deg -> -40 pts -> 60 score
      }

      // 2. Stability (Knee Valgus)
      const leftHip = landmarks[23];
      const rightHip = landmarks[24];
      const leftKnee = landmarks[25];
      const rightKnee = landmarks[26];

      if (leftHip && rightHip && leftKnee && rightKnee) {
        const hipWidth = Math.abs(leftHip.x - rightHip.x);
        const kneeWidth = Math.abs(leftKnee.x - rightKnee.x);
        if (kneeWidth < hipWidth) {
          score -= (1 - (kneeWidth / hipWidth)) * 50; // Deduct for caving
        }
      }

      return Math.max(0, Math.min(100, Math.round(score)));
    },
    thresholds: {
      start: 160, // Standing straight
      middle: 90, // Squat depth (knees at 90 degrees)
      end: 150    // Return to standing
    }
  },
  'Pushups': {
    name: 'Pushups',
    instruction: "Start in a plank position. Lower your chest to the floor.",
    calculateProgress: (landmarks: Point[]) => {
      const shoulder = landmarks[11];
      const elbow = landmarks[13];
      const wrist = landmarks[15];
      return calculateAngle(shoulder, elbow, wrist);
    },
    checkForm: (landmarks: Point[]) => {
      const shoulder = landmarks[11];
      const hip = landmarks[23];
      const ankle = landmarks[27];
      const bodyAngle = calculateAngle(shoulder, hip, ankle);
      if (bodyAngle < 160) {
        return "Keep your back straight!";
      }
      return null;
    },
    thresholds: {
      start: 160,
      middle: 80,
      end: 150
    }
  },
  'Lunges': {
    name: 'Lunges',
    instruction: "Step forward with one leg and lower your hips until both knees are bent at a 90-degree angle.",
    calculateProgress: (landmarks: Point[]) => {
      const hip = landmarks[23];
      const knee = landmarks[25];
      const ankle = landmarks[27];
      return calculateAngle(hip, knee, ankle);
    },
    checkForm: (landmarks: Point[]) => {
      return null;
    },
    thresholds: {
      start: 170,
      middle: 90,
      end: 160
    }
  },
  'Plank': {
    name: 'Plank',
    instruction: "Hold a pushup position on your elbows. Keep your body in a straight line.",
    calculateProgress: (landmarks: Point[]) => {
      const shoulder = landmarks[11];
      const hip = landmarks[23];
      const ankle = landmarks[27];
      return calculateAngle(shoulder, hip, ankle);
    },
    checkForm: (landmarks: Point[]) => {
      const shoulder = landmarks[11];
      const hip = landmarks[23];
      const ankle = landmarks[27];
      const angle = calculateAngle(shoulder, hip, ankle);
      if (angle < 160) return "Hips are too high (Piquing)!";
      if (angle > 200) return "Hips are sagging!";
      return null;
    },
    thresholds: {
      start: 0,
      middle: 0,
      end: 0
    }
  },
  'Jumping Jacks': {
    name: 'Jumping Jacks',
    instruction: "Jump feet apart and raise arms overhead. Jump feet together and lower arms.",
    calculateProgress: (landmarks: Point[]) => {
      const hip = landmarks[23];
      const shoulder = landmarks[11];
      const elbow = landmarks[13];
      return calculateAngle(hip, shoulder, elbow);
    },
    thresholds: {
      start: 20,
      middle: 150,
      end: 30
    }
  },
  'Burpees': {
    name: 'Burpees',
    instruction: "Stand -> Squat -> Plank -> Squat -> Jump.",
    calculateProgress: (landmarks: Point[]) => {
      const shoulder = landmarks[11];
      const hip = landmarks[23];
      if (!shoulder || !hip) return 0;
      const dist = Math.abs(shoulder.y - hip.y);
      return dist * 100;
    },
    thresholds: {
      start: 20,
      middle: 5,
      end: 15
    }
  },
  'Bicep Curls': {
    name: 'Bicep Curls',
    instruction: "Hold weights with palms facing forward. Curl towards shoulders.",
    calculateProgress: (landmarks: Point[]) => {
      const shoulder = landmarks[11];
      const elbow = landmarks[13];
      const wrist = landmarks[15];
      return calculateAngle(shoulder, elbow, wrist);
    },
    thresholds: {
      start: 160,
      middle: 45,
      end: 150
    }
  },
  'Situps': {
    name: 'Situps',
    instruction: "Lie on your back. engage core to lift torso towards knees.",
    calculateProgress: (landmarks: Point[]) => {
      // Angle: Shoulder - Hip - Knee
      const shoulder = landmarks[11];
      const hip = landmarks[23];
      const knee = landmarks[25];
      return calculateAngle(shoulder, hip, knee);
    },
    thresholds: {
      start: 130, // Lying down
      middle: 80, // Up
      end: 120    // Going back down
    }
  },
  'Mountain Climbers': {
    name: 'Mountain Climbers',
    instruction: "Plank position. Rapidly drive knees to chest alternating.",
    calculateProgress: (landmarks: Point[]) => {
      // Monitor BOTH legs. Use the "most active" leg (smallest angle).
      // Left Leg
      const l_shoulder = landmarks[11];
      const l_hip = landmarks[23];
      const l_knee = landmarks[25];
      const l_angle = calculateAngle(l_shoulder, l_hip, l_knee);

      // Right Leg
      const r_shoulder = landmarks[12];
      const r_hip = landmarks[24];
      const r_knee = landmarks[26];
      const r_angle = calculateAngle(r_shoulder, r_hip, r_knee);

      // Return the minimum angle (the leg that is tucked in)
      return Math.min(l_angle, r_angle);
    },
    thresholds: {
      start: 150, // Plankish
      middle: 100, // Knee Tucked
      end: 140    // Back to Plank
    }
  }
};

/**
 * AUTO-DETECT EXERCISE
 * Analyzes current pose and determines the most likely exercise.
 * Uses body orientation and key joint angles.
 */
export const detectExercise = (landmarks: Point[]): string | null => {
  if (!landmarks || landmarks.length < 33) return null;

  // Key landmarks
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const leftElbow = landmarks[13];
  const rightElbow = landmarks[14];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];

  // Safety checks
  if (!leftShoulder || !leftHip || !leftKnee || !leftAnkle) return null;

  // Calculate key angles and metrics
  const kneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
  const elbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
  const torsoAngle = calculateAngle(leftShoulder, leftHip, leftAnkle);
  const shoulderHipAngle = calculateAngle(leftElbow, leftShoulder, leftHip);

  // Body orientation: Is person horizontal (plank) or vertical (standing)?
  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipY = (leftHip.y + rightHip.y) / 2;
  const ankleY = (leftAnkle.y + rightAnkle.y) / 2;

  const isHorizontal = Math.abs(shoulderY - ankleY) < 0.3; // Normalized coords
  const isVertical = !isHorizontal && hipY > shoulderY; // Standing

  // Arm position: Are arms raised?
  const armsRaised = shoulderHipAngle > 120;

  // CLASSIFICATION LOGIC (Heuristic-based)

  // 1. PUSHUPS: Horizontal body, elbow bending
  if (isHorizontal && elbowAngle < 130 && torsoAngle > 150) {
    return 'Pushups';
  }

  // 2. PLANK: Horizontal body, straight arms, stable
  if (isHorizontal && elbowAngle > 150 && torsoAngle > 160) {
    return 'Plank';
  }

  // 3. MOUNTAIN CLIMBERS: Horizontal, one knee tucked
  if (isHorizontal && (kneeAngle < 120 || calculateAngle(rightHip, rightKnee, rightAnkle) < 120)) {
    return 'Mountain Climbers';
  }

  // 4. SQUATS: Vertical, deep knee bend
  if (isVertical && kneeAngle < 130 && torsoAngle > 100) {
    return 'Squats';
  }

  // 5. LUNGES: Vertical, one knee forward (asymmetric)
  if (isVertical && kneeAngle < 130) {
    const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
    if (Math.abs(kneeAngle - rightKneeAngle) > 30) {
      return 'Lunges';
    }
  }

  // 6. JUMPING JACKS: Vertical, arms raised
  if (isVertical && armsRaised && kneeAngle > 150) {
    return 'Jumping Jacks';
  }

  // 7. BICEP CURLS: Vertical, elbow bending, upper arm stationary
  if (isVertical && elbowAngle < 90 && shoulderHipAngle < 30) {
    return 'Bicep Curls';
  }

  // 8. SITUPS: Lying down, torso curling
  if (!isVertical && torsoAngle < 100) {
    return 'Situps';
  }

  // 9. BURPEES: Complex - detect by rapid vertical changes (needs history)
  // Simplified: If we see a squat-like position after a plank-like position
  // For now, we don't auto-detect Burpees (too complex without history)

  return null; // Unknown
};
