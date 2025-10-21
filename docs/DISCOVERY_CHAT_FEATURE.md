# Discovery Chat Feature 💬

## Overview

Users can now click any discovery to open a detailed modal with a built-in chat interface to ask Jeeves questions about that specific discovery.

---

## What Was Implemented

### 1. ✅ Discovery Detail Modal
**File:** `components/jeeves/discovery-detail-modal.tsx`

Features:
- **Full Discovery Details**: Shows reasoning, hypothesis, recommendations, analysis trail
- **Chat Interface**: Ask Jeeves questions about the discovery
- **Streaming Responses**: Real-time AI responses
- **Context-Aware**: Jeeves knows exactly which discovery you're asking about

### 2. ✅ Updated Discovery Card
**File:** `components/jeeves/discovery-card.tsx`

Changes:
- Click discovery → Opens modal (instead of expanding inline)
- Shows "Click to view details and chat with Jeeves"
- Cleaner, more compact card design

### 3. ✅ Chat API Endpoint
**File:** `app/api/jeeves/chat/route.ts`

Features:
- Loads discovery context from database
- Provides full context to AI (reasoning, evidence, recommendations)
- Streams responses for better UX
- Uses Claude Sonnet 3.5

### 4. ✅ Auto-Scheduler (Bonus Fix!)
**File:** `lib/inngest/functions/jeeves-auto-scheduler.ts`

- Runs every 5 minutes
- Checks if Jeeves analysis is due based on configured interval
- Automatically triggers analysis when scheduled
- **Fixed:** Jeeves now runs automatically (not just on manual trigger)

### 5. ✅ Updated Analysis Intervals
**File:** `components/jeeves/settings-panel.tsx`

New options:
- Every 1 hour
- Every 3 hours
- Every 6 hours
- Once a day (24 hours)

---

## How to Use

### For Users:

1. Go to `/jeeves` page
2. **Click any discovery card**
3. Modal opens showing:
   - Full discovery details
   - Recommendations
   - Analysis trail
   - Chat interface at the bottom

4. **Ask Jeeves questions** like:
   - "Why is this flagged as high severity?"
   - "What should I do first?"
   - "Is this a real issue or false positive?"
   - "Can you explain this in simple terms?"
   - "What data led you to this conclusion?"
   - "Should I be worried about this?"

5. Jeeves responds with:
   - Explanations of the discovery
   - Clarifications of technical terms
   - Specific action recommendations
   - Context about the data

---

## Example Chat Conversations

### Example 1: Understanding Severity
```
User: Why is this flagged as high severity?

Jeeves: This discovery has high severity for three key reasons:

1. **Impact Scope**: The issue affects FCU-201's heating output, which directly impacts occupant comfort for 15+ people in the east wing.

2. **Persistence**: The pattern has been consistent for 3+ hours, suggesting it's not a transient glitch but a systemic issue.

3. **Deviation Magnitude**: The heating valve is stuck at 100% despite room temperature being 2.5°C above setpoint - this is 3.2 standard deviations from normal operation.

Would you like me to explain the specific data points that led to this conclusion?
```

### Example 2: Next Steps
```
User: What should I do first?

Jeeves: I recommend this action sequence:

1. **Immediate (Next 5 minutes)**:
   - Check FCU-201's physical control panel for error codes
   - Verify the room temperature reading matches the sensor (could be sensor drift)

2. **Short-term (Next hour)**:
   - Manually override the heating valve to 0% to prevent energy waste
   - Monitor if the valve actually responds (confirms it's not mechanically stuck)

3. **Follow-up (Next 24 hours)**:
   - If manual override works → likely a control logic issue (software)
   - If manual override fails → likely a mechanical valve failure (hardware)

Would you like me to elaborate on any of these steps?
```

### Example 3: False Positive Check
```
User: Is this a real issue or false positive?

Jeeves: Based on my analysis, this is **very likely a real issue** (95% confidence). Here's why:

**Evidence for real issue:**
- Multiple corroborating signals (valve position, temperature, setpoint all inconsistent)
- Pattern persists across 8 consecutive data points (4 minutes)
- Matches known failure mode for FCU_206 from last month

**What makes me confident it's not a false positive:**
- Data quality score: 0.98 (no missing values, no suspicious outliers)
- Cross-validation with adjacent FCUs: They're behaving normally, so it's localized to FCU-201
- Occupancy sensor confirms room is occupied (so unusual pattern isn't due to empty room)

I'd recommend treating this as a real issue and investigating further. The cost of checking is low, but the cost of ignoring could be high (occupant complaints + energy waste).
```

---

## Technical Details

### Chat Context Provided to AI

For each discovery, the AI receives:
- Discovery title, category, severity, confidence
- Original reasoning and hypothesis
- Recommendations list
- Analysis trail (which tools were used)
- Related stream IDs
- Timestamp

### API Response Format

Streaming response using AI SDK's `streamText`:
```
data: {"content": "This"}
data: {"content": " discovery"}
data: {"content": " shows"}
...
data: [DONE]
```

---

## Future Enhancements

### Potential Additions:

1. **Quick Action Buttons**
   - "Show raw data"
   - "Re-analyze with latest data"
   - "Mark as false positive"
   - "Create JIRA ticket"

2. **Chat History**
   - Save chat conversations per discovery
   - Show previous Q&A when reopening

3. **Multi-Discovery Chat**
   - "Compare this to discovery #42"
   - "Are these related?"

4. **Voice Input**
   - Voice-to-text for asking questions

5. **Smart Suggestions**
   - Show suggested questions based on discovery type
   - "People often ask: ..."

---

## Testing Checklist

- [ ] Click discovery card → Modal opens
- [ ] Modal shows full discovery details
- [ ] Chat input accepts text
- [ ] Send message → Streaming response appears
- [ ] Markdown formatted correctly in responses
- [ ] Enter key sends message (Shift+Enter for new line)
- [ ] Close modal → Chat resets on reopen
- [ ] Multiple discoveries → Each has independent chat
- [ ] Error handling: API failure shows error message

---

## Files Changed

### New Files:
- `components/jeeves/discovery-detail-modal.tsx`
- `app/api/jeeves/chat/route.ts`
- `lib/inngest/functions/jeeves-auto-scheduler.ts`
- `docs/DISCOVERY_CHAT_FEATURE.md` (this file)

### Modified Files:
- `components/jeeves/discovery-card.tsx` (click → modal instead of expand)
- `components/jeeves/settings-panel.tsx` (new interval options)
- `app/api/inngest/route.ts` (registered auto-scheduler)

---

🎉 **Feature Complete!** Users can now have intelligent conversations with Jeeves about any discovery.
