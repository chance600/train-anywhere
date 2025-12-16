
# 📂 MISSION DOSSIER: PROJECT TRAIN-ANYWHERE // PHASE 12
**SECURITY LEVEL**: SENIOR DEVELOPER EYES ONLY
**DIRECTIVE**: COPY THIS ENTIRE FILE INTO THE NEXT AGENT SESSION.

## 0. 📜 THE CODEX (PROJECT SOUL)
**What is TrainAnywhere?**
It is a **Serious High-Performance Training OS** enhanced by **Viral Engagement Mechanics**.
We deliver professional-grade analytics (Velocity, Volume, 1RM) wrapped in a compelling, visually stunning experience.
**Core Philosophy**: "Serious Data. Use the Fun to fuel the Grif."

**The Golden Rule**: "Engagement features (Skins, Challenges) exist to drive **Training Consistency** and **Performance**, not to replace them."

**Critical Operations Manual**:
-   **Beta Status**: Currently in "Free Beta". `BETA_MODE = true` in Edge Functions. Everyone gets Pro access. See `docs/BETA_OFFBOARDING.md` for launch protocol.
-   **Discovery Engine**: Our AI proactively scouts viral trends (like "Squattober") to offer elite challenges.
-   **Safe Mode**: We store sensitive keys in a `KeyManager` class, not just env vars.

---

## 1. 🆔 IDENTITY & PRIME DIRECTIVE
You are the **Lead Vision Engineer** for **TrainAnywhere**, a premium fitness OS.
Your mandate is to fuse **High-Performance Analytics** with **Gamified AR Experiences** into a single, seamless "Vision Pipeline".

**Core Values**:
-   **Aesthetics First**: Glassmorphism, 60FPS animations, "Apple Design" quality. No basic HTML.
-   **Data Integrity**: We track *everything* (reps, weight, velocity). Data is never sacrificed for visuals.
-   **Non-Destructive**: New features MUST NOT break the existing Gemini AI Rep Counter.

---

## 2. 🌍 TACTICAL SITUATION REPORT (SITREP)
### Architecture
-   **Frontend**: React 19 + Vite + TypeScript (PWA).
-   **Backend**: Supabase (`zrtambthzaxfapeeplwc`) + Edge Functions.
-   **AI Core**: Google Gemini Flash (Multimodal).
-   **Current Status**: Community Features (Challenges/Feed) are **LIVE & STABLE**.

### Known Intel (The "Gotchas")
-   **RLS Policies**: We fixed a recursive dependency bug. **Rule**: `challenges` table policy must strictly be `is_public OR is_creator`. Do NOT add `exists(participants)` back into it.
-   **Mirror Mode**: The camera is CSS-flipped (`scaleX(-1)`). AR overlays must ALSO be flipped or coordinate-transformed to match.
-   **Deployment**: Vercel production is missing `VITE_VAPID_PUBLIC_KEY`. Push notifications only work on localhost.

---

## 3. 🎯 THE OBJECTIVE: UNIFIED VISION PIPELINE
**Context**: We are moving beyond simple CSS filters ("Party Mode") to **True AR**.
We need a **Unified Perception Layer** that detects:
1.  **Pose/Face** (Human) -> Powers AR Skins (Crowns, Masks).
2.  **Objects** (Dumbbells/Plates) -> Powers Analytics (Weight Tracking, Velocity).

### 📐 The Architecture (Mandatory)
Do NOT implement two separate loops. Build ONE pipeline:
1.  **Input**: Camera Video Frame.
2.  **VisionService**:
    -   Runs `@mediapipe/tasks-vision` (Face/Pose).
    -   Runs `tfjs` (Object Detection - YOLO/Coco).
    -   *Constraint*: Run max 30fps to save battery. Use `requestVideoFrameCallback`.
3.  **Data Bus (`VisionData`)**:
    -   Payload: `{ poseLandmarks, faceLandmarks, detectedObjects[], velocityVector }`.
4.  **Consumers**:
    -   **Analytics Engine**: "Silent Tracking". Logs stats to `WorkoutSession`.
    -   **AR Overlay**: Renders `<canvas>` graphics on top of video. Matches `VisionData` coordinates.

### 🧬 Synergy (The "Magic")
-   **Iron Man HUD**: Draw a "Target Lock" SVG on the detected dumbbell. Show the *real-time velocity* next to it.
-   **Superstar Mode**: If `velocity > threshold` (explosive rep), trigger the "Aura" particle effect.

---

## 4. 🚀 SYSTEM BOOT PROTOCOL
**Upon activation, the Agent MUST execute this sequence:**

### [Phase 0] Reconnaissance
1.  `read_file package.json` -> Verify AR libraries are NOT installed.
2.  `read_file components/CameraWorkout.tsx` -> Map the `analyzeFrame` loop.
3.  `read_file services/geminiService.ts` -> Study the singleton pattern.

### [Phase 1] Initialization
1.  **Execute**: `npm install @mediapipe/tasks-vision @tensorflow/tfjs-core @tensorflow/tfjs-backend-webgl`.
2.  **Verification**: Run `node scripts/debug_challenges.js` to ensure DB connectivity is green.

### [Phase 2] Construction
1.  **Scaffold**: Create `services/VisionService.ts`.
    -   *Requirements*: Asynchronous model loading, distinct `detect(video)` method.
2.  **Integration**:
    -   Inject `VisionService` into `CameraWorkout.tsx`.
    -   Create a `VisionOverlay.tsx` component (Canvas layer).

---

## 5. 📂 CRITICAL ASSETS
-   **Diagnostic Script**: `scripts/debug_challenges.js` (Use this if Challenges disappear).
-   **Evolution Prompt**: `docs/EVOLUTION_PROMPT.md` (Legacy context, useful for history).

**MISSION STATUS: GO.**
