# Beta Offboarding Strategy (Monetization Launch)

**Target Date**: [Insert Date ~1 Month from Launch]

This document outlines the exact steps to "unwind" the Free Beta configuration and enable real monetization.

## 1. Backend Reversion (Supabase)

### Edge Function (`analyze-workout/index.ts`)
Locate the `BETA_MODE` constant and switch it to `false`.

```typescript
// supabase/functions/analyze-workout/index.ts

// CHANGE THIS:
const BETA_MODE = true; 
// TO THIS:
const BETA_MODE = false;
```

**Deploy**:
```bash
npx supabase functions deploy analyze-workout --no-verify-jwt
```

## 2. Frontend Reversion (React)

### App Logic (`App.tsx`)
Remove the forced override that grants Pro status to everyone.

```typescript
// App.tsx

// DELETE or COMMENT OUT these lines in useEffect:
// setIsPro(true); 

// DELETE or COMMENT OUT this line in fetchProfile:
// setIsPro(true);
```

### Settings UI (`components/profile/SettingsTab.tsx`)
Revert the "Free Beta Access" card to the original Stripe Payment buttons.

**Action**: Restore the logic that checks `!isPro` and renders the Upgrade button.

```tsx
// components/profile/SettingsTab.tsx

// SWAP `Free Beta Access` div back to:
{!isPro ? (
    <button onClick={...} className="bg-emerald-500 ...">Upgrade to Pro</button>
) : (
    <button onClick={...} className="bg-gray-700 ...">Manage Subscription</button>
)}
```

## 3. Database Cleanup (Optional)
If you want to reset the rate limits for the paid launch:

```sql
truncate table ai_usage;
```
