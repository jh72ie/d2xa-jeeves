# Discovery Chat - Full Data Scientist Capabilities 🧪

## Overview

The Discovery Chat is powered by **Claude Sonnet 3.5** with **ALL 19 Jeeves analysis tools** connected. It's not just a chatbot - it's a **full data scientist assistant** that can investigate, analyze, and explain discoveries.

---

## Model Configuration

### LLM: Claude Sonnet 4.5 (Latest - October 2025)
- **Model ID**: `claude-sonnet-4-5-20250929`
- **Temperature**: 0.7 (creative but focused)
- **Max Tokens**: 2,500 (detailed analysis)
- **Max Steps**: 10 (can chain multiple tool calls)
- **Timeout**: 120 seconds (2 minutes for complex analysis)

### Why Claude Sonnet 4.5?
- **Best at tool use**: Most accurate tool selection and parameter usage
- **Strongest reasoning**: Superior data analysis and interpretation over 3.5
- **Best coding model**: Anthropic's most advanced model for complex agents
- **Context window**: 200k tokens standard, 1M tokens for Tier 4 (handles massive datasets)
- **Speed**: Fast enough for interactive chat
- **Cost-effective**: $3 per 1M input tokens, $15 per 1M output (same as Sonnet 4)

---

## Connected Tools: All 19 Analysis Tools ✅

### Category 1: Data Retrieval (5 tools)

#### 1. `getStreamRecentDataTool`
**What it does**: Loads recent data points with quality assessment
**Example use**: "Show me the last 100 values for fcu-201-spacetemp"

#### 2. `getStreamTimeWindowTool`
**What it does**: Gets data for specific time range
**Example use**: "What was the temperature between 2 PM and 4 PM yesterday?"

#### 3. `getStreamInfoTool`
**What it does**: Shows stream metadata (first seen, sampling rate, etc.)
**Example use**: "When did this sensor start reporting?"

#### 4. `getMultipleStreamsTool`
**What it does**: Loads multiple streams simultaneously for comparison
**Example use**: "Load temperature and heat output together"

#### 5. `listAvailableStreamsTool`
**What it does**: Discovers all available streams in system
**Example use**: "What other FCU-201 streams exist?"

---

### Category 2: Single Stream Analysis (6 tools)

#### 6. `analyzeStreamStatisticsTool`
**What it does**: Comprehensive statistics
- Mean, median, mode
- Standard deviation, variance
- Min, max, percentiles (25th, 50th, 75th)
- Distribution shape (skewness, kurtosis)

**Example use**: "What are the stats for fcu-201-heatoutput?"

**Sample output**:
```json
{
  "mean": 45.2,
  "std": 12.8,
  "min": 0,
  "max": 100,
  "percentiles": { "25": 35, "50": 47, "75": 58 },
  "skewness": 0.34,
  "kurtosis": -0.12
}
```

#### 7. `analyzeStreamTrendTool`
**What it does**: Trend analysis with linear regression
- Slope (rate of change)
- Direction (increasing/decreasing/stable)
- Strength (R² value)
- Prediction for next data points

**Example use**: "Is temperature trending up or down?"

**Sample output**:
```json
{
  "slope": 0.05,
  "direction": "increasing",
  "strength": 0.87,
  "rSquared": 0.87,
  "interpretation": "Strong upward trend at 0.05°C per minute"
}
```

#### 8. `analyzeStreamAnomaliesTool`
**What it does**: Anomaly detection using 5 methods
- **Z-score**: Standard deviation based
- **Modified Z-score**: Robust to outliers
- **IQR**: Interquartile range method
- **LOF**: Local Outlier Factor (machine learning)
- **Ensemble**: Combines all methods

**Example use**: "Are there any anomalies in the last hour?"

**Sample output**:
```json
{
  "anomalyCount": 3,
  "anomalies": [
    {
      "timestamp": "2025-10-13T10:23:45Z",
      "value": 95.2,
      "zScore": 3.8,
      "methods": ["z-score", "modified-z-score", "ensemble"],
      "severity": "high"
    }
  ]
}
```

#### 9. `analyzeStreamPatternsTool`
**What it does**: Detects patterns and cycles
- **Peaks**: Local maxima/minima
- **Cycles**: Repeating patterns
- **Seasonal**: Daily, weekly patterns
- **Repeating**: Regular oscillations

**Example use**: "Does this show daily patterns?"

#### 10. `analyzeStreamAutocorrelationTool`
**What it does**: Measures self-similarity over time
- Finds periodic patterns
- Detects lag correlations
- Identifies cycle lengths

**Example use**: "Is there a repeating cycle in this data?"

#### 11. `analyzeStreamMovingAverageTool`
**What it does**: Smooths data to reveal trends
- **Simple moving average**: Equal weighting
- **Exponential moving average**: Recent data weighted more

**Example use**: "Show me the smoothed trend over 10 minutes"

---

### Category 3: Multi-Stream Analysis (5 tools)

#### 12. `correlateTwoStreamsTool`
**What it does**: Measures relationship between two streams
- Correlation coefficient (-1 to +1)
- Lag analysis (which leads which)
- Strength and direction

**Example use**: "How does fan speed correlate with heat output?"

**Sample output**:
```json
{
  "correlation": 0.94,
  "pValue": 0.0001,
  "interpretation": "Very strong positive correlation",
  "bestLag": 2,
  "lagCorrelation": 0.96,
  "lagInterpretation": "Fan speed leads heat output by 2 data points (~2 minutes)"
}
```

#### 13. `correlateMultipleStreamsTool`
**What it does**: Creates correlation matrix for many streams
- Shows all pairwise correlations
- Highlights significant relationships
- Finds hidden patterns

**Example use**: "Show correlations between all FCU-201 streams"

#### 14. `testStreamCausalityTool`
**What it does**: Tests Granger causality
- Does stream A predict stream B?
- Statistical significance testing
- Lag order determination

**Example use**: "Does setpoint change cause temperature change?"

**Sample output**:
```json
{
  "causalDirection": "streamId1 -> streamId2",
  "pValue": 0.003,
  "significant": true,
  "interpretation": "Setpoint changes predict temperature changes with 99.7% confidence",
  "optimalLag": 3
}
```

#### 15. `detectSynchronizedStreamEventsTool`
**What it does**: Finds events happening across multiple streams simultaneously
- System-wide incidents
- Coordinated changes
- Cascading effects

**Example use**: "Did all FCUs have issues at the same time?"

#### 16. `analyzeCascadingStreamFailuresTool`
**What it does**: Tracks how failures propagate
- Identifies failure origin
- Maps propagation path
- Measures delay between stages

**Example use**: "How did this failure spread to other units?"

---

### Category 4: Quality Assessment (3 tools)

#### 17. `assessStreamDataQualityTool`
**What it does**: Comprehensive data quality grading (A-F)
- Missing values
- Outliers
- Data gaps
- Sampling consistency
- Actionable recommendations

**Example use**: "How reliable is this data?"

**Sample output**:
```json
{
  "overallGrade": "B+",
  "qualityScore": 0.87,
  "issues": [
    "2 missing values (0.4%)",
    "1 data gap of 3 minutes"
  ],
  "recommendations": [
    "Check sensor connectivity around 10:23 AM",
    "Monitor for future gaps"
  ]
}
```

#### 18. `monitorStreamHealthTool`
**What it does**: Tracks data health trends over time
- Health score changes
- Degradation detection
- Early warning signals

**Example use**: "Is data quality getting worse over time?"

#### 19. `compareStreamQualityPeriodsTool`
**What it does**: Compares quality between time periods
- Before/after comparison
- Identifies quality changes
- Diagnoses degradation causes

**Example use**: "How does data quality today compare to yesterday?"

---

## Example Chat Conversations

### Example 1: Deep Investigation
```
User: Show me the latest data and tell me what's happening

Jeeves: Let me investigate...

[Uses getStreamRecentDataTool for fcu-201-spacetemp]
[Uses analyzeStreamStatisticsTool]
[Uses analyzeStreamTrendTool]

Based on my analysis:

📊 **Current Statistics** (last 100 data points):
- Mean: 22.9°C
- Std Dev: 0.3°C (very stable)
- Range: 22.4°C - 23.5°C

📈 **Trend Analysis**:
- Direction: Increasing
- Rate: +0.12°C per hour
- Strength: R² = 0.78 (strong trend)
- Prediction: Will reach 23.5°C in ~30 minutes

🔍 **Interpretation**:
Temperature is steadily rising despite stable setpoint (22.5°C). This suggests:
1. Heating system is overcompensating
2. External heat source (sunlight, equipment)
3. Faulty temperature sensor (less likely due to stable readings)

**Recommendation**: Check heating valve position - it might be stuck partially open.
```

### Example 2: Correlation Analysis
```
User: Is fan speed related to cooling output?

Jeeves: Let me check the correlation...

[Uses correlateTwoStreamsTool for fcu-201-fanspeed and fcu-201-cooloutput]

Yes! There's a **very strong relationship**:

🔗 **Correlation Results**:
- Correlation: **r = 0.94** (very strong positive)
- P-value: 0.0001 (highly significant)
- Best lag: Fan speed leads by 1 minute

📊 **What this means**:
- When fan speed increases, cooling output increases ~1 minute later
- 94% of cooling output variation is explained by fan speed
- This is **expected behavior** - the control system is working correctly

**Validation**: This matches the FCU-201 control logic where:
1. System detects cooling need
2. Ramps up fan speed
3. Opens cooling valve (~60 seconds later)

No issues detected - this is normal operation! ✅
```

### Example 3: Anomaly Investigation
```
User: Were there any unusual spikes yesterday?

Jeeves: Let me analyze for anomalies...

[Uses getStreamTimeWindowTool for yesterday]
[Uses analyzeStreamAnomaliesTool with ensemble method]

Yes, I found **3 significant anomalies**:

⚠️ **Anomaly #1** (High Severity):
- Time: Yesterday 2:23 PM
- Value: 95.2% cooling output
- Normal range: 0-60%
- Z-score: 3.8σ above mean
- Duration: 4 minutes

**Context**: Room temperature spiked to 26.5°C (setpoint: 23.0°C)

⚠️ **Anomaly #2** (Medium Severity):
- Time: Yesterday 2:27 PM
- Value: 0% (sudden drop)
- Likely cause: System reset after anomaly #1

✅ **Anomaly #3** (Low Severity):
- Time: Yesterday 6:45 PM
- Value: 12.5°C temperature
- Cause: End-of-day setback mode (expected)

**Root Cause Analysis**:
The 2:23 PM spike was likely triggered by:
- Large occupancy increase (meeting started?)
- Afternoon sun load
- Control system responded correctly but hit cooling capacity limit

**Recommendation**: This is normal behavior under high load, but consider:
1. Increasing cooling capacity for conference room usage
2. Implementing occupancy-based pre-cooling
```

### Example 4: Multi-Stream Comparison
```
User: Compare FCU-201 performance to other units

Jeeves: Let me compare across units...

[Uses listAvailableStreamsTool to find other FCU streams]
[Uses correlateMultipleStreamsTool for temperature streams]
[Uses analyzeStreamStatisticsTool for each unit]

📊 **Comparison Results** (last 2 hours):

| Unit    | Avg Temp | Stability (σ) | Trend   | Performance |
|---------|----------|---------------|---------|-------------|
| FCU-201 | 22.9°C   | 0.3°C        | Stable  | ✅ Normal   |
| FCU-202 | 22.8°C   | 0.2°C        | Stable  | ✅ Normal   |
| FCU-206 | 15.2°C   | 8.4°C        | Erratic | ❌ Faulty   |
| FCU-218 | 23.6°C   | 1.2°C        | Rising  | ⚠️ Watch   |

**Key Findings**:
1. **FCU-201**: Performing normally ✅
2. **FCU-206**: Critical failure - temperature sensor or control board issue
3. **FCU-218**: Slightly unstable - may need calibration
4. **System-wide correlation**: 0.78 (units respond to same building conditions)

**Recommendation**: Prioritize FCU-206 repair immediately.
```

---

## What Makes This a "Data Scientist" Chat?

### 1. **Proactive Investigation**
- Doesn't just answer questions
- Uses tools to gather evidence
- Analyzes data before responding

### 2. **Multi-Tool Chaining**
- Can use multiple tools in sequence
- Example: Load data → Calculate stats → Detect anomalies → Compare to normal

### 3. **Statistical Rigor**
- P-values for significance
- Confidence intervals
- Correlation coefficients
- Distribution analysis

### 4. **Contextual Interpretation**
- Doesn't just show numbers
- Explains **what they mean**
- Provides **actionable insights**

### 5. **Root Cause Analysis**
- Investigates **why** something happened
- Uses causality testing
- Traces failure propagation

---

## Advanced Capabilities

### Time-Series Analysis
- Trend detection with regression
- Moving averages for smoothing
- Autocorrelation for cycles
- Pattern recognition

### Statistical Testing
- Hypothesis testing
- Significance levels (p-values)
- Confidence intervals
- Granger causality

### Multi-Variate Analysis
- Correlation matrices
- Cross-stream relationships
- Synchronized event detection
- Cascading failure analysis

### Quality Assurance
- A-F data grading
- Missing value detection
- Outlier identification
- Gap analysis

---

## Limitations & Boundaries

### What it CAN do:
✅ Analyze any stream data in the database
✅ Run complex statistical analysis
✅ Compare multiple streams
✅ Detect patterns and anomalies
✅ Test causal relationships
✅ Explain discoveries in plain language
✅ Provide actionable recommendations

### What it CANNOT do:
❌ Control FCU units directly
❌ Access external systems (JIRA, email, etc.)
❌ Modify database records
❌ Make physical repairs
❌ Access data older than retention period (48 hours)
❌ Predict future beyond statistical trends

---

## Performance Characteristics

### Response Time:
- **Simple questions**: 2-5 seconds
- **With 1 tool call**: 5-10 seconds
- **With multiple tools**: 15-30 seconds
- **Complex investigations**: 30-60 seconds

### Token Usage (per conversation):
- **Input**: ~1,500 tokens (discovery context + messages)
- **Output**: ~500-1,500 tokens (analysis + explanation)
- **Tools**: ~200-500 tokens per tool call

### Cost (approximate):
- **Simple chat**: $0.005 per message
- **With analysis**: $0.01-0.03 per message
- **Complex investigation**: $0.05-0.10 per conversation

---

## Best Practices

### For Users:
1. **Be specific**: "Analyze temperature for last hour" vs "show me data"
2. **Ask for analysis**: "What's happening?" triggers tool use
3. **Request comparisons**: "How does X compare to Y?"
4. **Seek explanations**: "Why did you flag this?"

### For Developers:
1. **Trust tool selection**: AI chooses appropriate tools
2. **Monitor maxSteps**: 10 steps allows complex investigations
3. **Watch timeout**: 120s handles most queries
4. **Stream responses**: Better UX than waiting for full analysis

---

## Future Enhancements

### Planned:
- **V0 Dashboard Generation**: "Create a dashboard for this"
- **Export Analysis**: Download PDF reports
- **Save Investigations**: Bookmark useful analyses
- **Share Findings**: Send to team members

### Possible:
- **Multi-Discovery Chat**: Compare multiple discoveries
- **Custom Tool Creation**: User-defined analysis functions
- **Real-Time Monitoring**: "Alert me if X changes"
- **Predictive Alerts**: "Warn me before failures"

---

🎯 **Bottom Line**: This is not a simple chatbot. It's a **fully-equipped data scientist** with access to professional-grade analysis tools, ready to investigate any discovery with statistical rigor and clear explanations.
