# The "Super App" Evolution Prompt

**Copy and paste the following prompt into your next message to kickstart the evolution:**

***

**Role**: You are an elite AI Systems Architect and Product Visionary (ex-Google/Apple Health lead).

**Objective**: transform the current "FitAI Coach" (a React/Supabase/Gemini vision app) into a **Holistic Health Operating System**.

**Context**:
We have successfully deployed a beta app that uses computer vision to track reps. We now want to integrate deep data sources and structured training to create a "Super App".

**Reference Architectures (Your Inspiration)**:
1.  **Data Ingestion**: [Open-Wearables](https://github.com/the-momentum/open-wearables) - We need a unified API to ingest sleep, HRV, and heart rate data (Apple Health/Oura) to contextually adjust workout intensity.
2.  **Knowledge Graph**: [ExerciseDB](https://github.com/ExerciseDB/exercisedb-api) & [WorkoutDB](https://github.com/ExerciseDB/WorkoutDB) - We need to ingest 10,000+ standardized exercises and validated training programs (JSON) to ground our AI's advice in proven sports science.
3.  **Social/Gamification**: [Spring-Boot-Fitness](https://github.com/SubProblem/Spring-Boot-Fitness-Tracking-Application) - We need role-based access and social challenges.

**Task**: 
Please generate a **comprehensive "Phase 3 & 4" Technical Roadmap** that integrates these domains into a unified "Health OS".

### 1. The "Brain" (Knowledge Graph & RAG)
Instead of simple logs, we want intelligent query capabilities.
-   **Reference**: [ExerciseDB](https://github.com/ExerciseDB/exercisedb-api)
-   **Task**: Design a Postgres schema that mirrors the ExerciseDB JSON structure:
    ```json
    {
      "id": "0001",
      "name": "3/4 Sit-Up",
      "bodyPart": "waist",
      "equipment": "body weight",
      "target": "abs",
      "gifUrl": "http://d205bpvrqc9yn1.cloudfront.net/0001.gif"
    }
    ```
-   **Vector Search**: How do we use `pgvector` to enable queries like *"Find a substitute for Bench Press that is easier on rotator cuffs"*?

### 2. The "Senses" (Unified Health Data)
-   **Reference**: [Open-Wearables](https://github.com/the-momentum/open-wearables)
-   **Task**: Create a `daily_biometrics` table that normalizes data from disparate sources (Apple Health/Garmin) into this standard:
    ```json
    {
      "user_id": "uuid",
      "date": "2025-12-14",
      "sleep_score": 85, // 0-100
      "hrv_ms": 42,
      "resting_hr": 55,
      "active_energy_kcal": 450,
      "source": "apple_health_kit"
    }
    ```
-   **Readiness Algorithm**: Define a PL/pgSQL function or Edge Function that calculates a `readiness_score` (1-100) using: `(SleepScore * 0.4) + (HRV_ZScore * 0.4) + (RecoveryIndex * 0.2)`.

### 3. The "Coach" (Structured Planning)
-   **Reference**: [WorkoutDB](https://github.com/ExerciseDB/WorkoutDB)
-   **Task**: Implement a `workout_plans` JSONB schema for multi-week programs:
    ```json
    {
      "name": "Summer Shred",
      "weeks": [
        {
          "week_order": 1,
          "days": [
             { "day": "Monday", "focus": "Push", "exercises": [...] }
          ]
        }
      ]
    }
    ```

### 4. The "Tribe" (Community)
-   **Reference**: [Spring-Boot-Fitness](https://github.com/SubProblem/Spring-Boot-Fitness-Tracking-Application)
-   **Task**: Adaptation of the Role-Based Access Control (RBAC) user model for Supabase (Admin vs Coach vs User).
-   **Privacy**: Design the "Circle of Trust" RLS policies.

### 5. The "Shield" (Legal & Compliance)
-   **Requirement**: Fitness apps have high liability risk. We need a robust "Digital Signature" system.
-   **Task**: Create a `user_agreements` table:
    ```json
    {
      "user_id": "uuid",
      "document_version": "v1.0",
      "document_type": "liability_waiver",
      "signed_at": "timestamp",
      "ip_address": "127.0.0.1"
    }
    ```
-   **UX**: Design a mandatory "Onboarding Flow" that blocks app access until the latest Waiver is accepted.

**Output**: A step-by-step implementation plan (Markdown) starting with "Phase 3: The Knowledge Graph".

***
