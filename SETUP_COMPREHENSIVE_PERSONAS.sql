-- Comprehensive Persona Setup for Jeeves Notifications
-- Run this in Neon Dashboard → SQL Editor
--
-- This creates personas with:
-- 1. Basic info (name = person's actual name, email, notification preferences)
-- 2. PersonaMemory (AI summary describing job role + personality + communication preferences)
-- 3. UserLog history (interaction patterns, preferences)

-- ============================================
-- STEP 1: Create Personas
-- ============================================
-- TODO: Update email addresses before running!

INSERT INTO "Persona" (name, email, "sendNotification", "createdAt", "updatedAt")
VALUES
  -- Mark - Executive
  ('Mark', 'mark@customer-company.com', true, NOW() - INTERVAL '90 days', NOW()),

  -- Jukka - Facilities Manager
  ('Jukka', 'facilities@customer-company.com', true, NOW() - INTERVAL '120 days', NOW()),

  -- Anna - Building Operations
  ('Anna', 'operations@customer-company.com', true, NOW() - INTERVAL '60 days', NOW()),

  -- Mikko - Maintenance Technician
  ('Mikko', 'maintenance@customer-company.com', false, NOW() - INTERVAL '45 days', NOW())
ON CONFLICT (name)
DO UPDATE SET
  email = EXCLUDED.email,
  "sendNotification" = EXCLUDED."sendNotification",
  "updatedAt" = NOW();

-- ============================================
-- STEP 2: Create PersonaMemory (AI summaries)
-- ============================================
-- Each summary describes: who they are (job) + how they communicate (preferences) + personality traits

-- Mark's memory
INSERT INTO "PersonaMemory" (
  "personaName",
  summary,
  traits,
  "updatedAt"
)
VALUES (
  'Mark',
  'Mark is an executive who oversees building operations and energy efficiency initiatives. Makes strategic decisions based on data. COMMUNICATION STYLE: Values time efficiency and prefers executive summaries over detailed technical reports. Focuses on high-level impact - cost savings, energy optimization, and occupant comfort. Has limited technical background but strong business acumen. PERSONALITY: Strategic thinker, time-conscious, results-driven, big-picture oriented. Wants to understand bottom-line implications quickly without getting lost in technical details.',
  jsonb_build_object(
    'interests', jsonb_build_array('cost-savings', 'energy-efficiency', 'occupant-satisfaction', 'sustainability', 'roi-analysis'),
    'communicationStyle', 'executive',
    'technicalLevel', 'low',
    'preferredFormat', 'brief',
    'decisionAuthority', 'high',
    'personalityTraits', jsonb_build_array('strategic', 'time-conscious', 'results-driven', 'big-picture-thinker'),
    'timezone', 'Europe/Helsinki',
    'workingHours', jsonb_build_object('start', 8, 'end', 17)
  ),
  NOW()
)
ON CONFLICT ("personaName")
DO UPDATE SET
  summary = EXCLUDED.summary,
  traits = EXCLUDED.traits,
  "updatedAt" = NOW();

-- Jukka's memory (Facilities Manager)
INSERT INTO "PersonaMemory" (
  "personaName",
  summary,
  traits,
  "updatedAt"
)
VALUES (
  'Jukka',
  'Jukka is the facilities manager responsible for HVAC systems, building automation, and equipment performance. Has deep technical knowledge of building systems and 12+ years experience. COMMUNICATION STYLE: Loves analyzing data visualizations and enjoys exploring technical details. Prefers detailed dashboards with charts and metrics over text summaries. Makes data-driven decisions about maintenance schedules and system optimization. PERSONALITY: Analytical, detail-oriented, curious, methodical. Visual learner who wants to see raw data correlations and statistical confidence levels. Actively monitors FCU performance and responds quickly to anomalies when presented with clear visual evidence.',
  jsonb_build_object(
    'interests', jsonb_build_array('hvac-performance', 'predictive-maintenance', 'system-optimization', 'data-visualization', 'building-automation', 'statistical-analysis'),
    'communicationStyle', 'technical',
    'technicalLevel', 'high',
    'preferredFormat', 'detailed-dashboard',
    'visualPreference', 'charts-and-graphs',
    'responseSpeed', 'fast',
    'personalityTraits', jsonb_build_array('analytical', 'detail-oriented', 'curious', 'methodical', 'visual-learner'),
    'timezone', 'Europe/Helsinki'
  ),
  NOW()
)
ON CONFLICT ("personaName")
DO UPDATE SET
  summary = EXCLUDED.summary,
  traits = EXCLUDED.traits,
  "updatedAt" = NOW();

-- Anna's memory (Building Operations)
INSERT INTO "PersonaMemory" (
  "personaName",
  summary,
  traits,
  "updatedAt"
)
VALUES (
  'Anna',
  'Anna is the building operations coordinator who monitors building systems and responds to issues. Moderately technical with practical hands-on experience. Works closely with facilities management and maintenance team to implement fixes. COMMUNICATION STYLE: Prefers comprehensive reports that explain both the problem AND recommended actions. Wants clear explanations with actionable next steps. Values understanding severity levels and impact for prioritization. PERSONALITY: Pragmatic, solution-focused, organized, proactive. Implementation-oriented mindset - appreciates when information is presented in a way that directly supports decision-making and execution.',
  jsonb_build_object(
    'interests', jsonb_build_array('operational-efficiency', 'problem-solving', 'coordination', 'preventive-maintenance', 'practical-solutions', 'impact-assessment'),
    'communicationStyle', 'practical',
    'technicalLevel', 'medium',
    'preferredFormat', 'summary-with-recommendations',
    'actionOriented', true,
    'personalityTraits', jsonb_build_array('pragmatic', 'solution-focused', 'organized', 'proactive', 'implementer'),
    'timezone', 'Europe/Helsinki'
  ),
  NOW()
)
ON CONFLICT ("personaName")
DO UPDATE SET
  summary = EXCLUDED.summary,
  traits = EXCLUDED.traits,
  "updatedAt" = NOW();

-- Mikko's memory (Maintenance Technician)
INSERT INTO "PersonaMemory" (
  "personaName",
  summary,
  traits,
  "updatedAt"
)
VALUES (
  'Mikko',
  'Mikko is a maintenance technician who performs hands-on repairs and maintenance on building systems. Part of a 3-person maintenance team. Very technical with practical troubleshooting skills. COMMUNICATION STYLE: Prefers work orders through ticketing system over email notifications. When he does check notifications, wants concise issue descriptions with specific equipment identifiers. Values brevity and precision - wants just essential technical facts without lengthy explanations. PERSONALITY: Efficient, precise, no-nonsense, technically-skilled, time-sensitive. Practical hands-on mindset focused on rapid diagnosis and repair.',
  jsonb_build_object(
    'interests', jsonb_build_array('equipment-repair', 'troubleshooting', 'preventive-maintenance', 'equipment-diagnostics', 'technical-precision'),
    'communicationStyle', 'concise',
    'technicalLevel', 'high',
    'preferredFormat', 'brief-technical',
    'workOrderSystem', 'preferred',
    'personalityTraits', jsonb_build_array('precise', 'efficient', 'no-nonsense', 'technically-skilled', 'time-sensitive'),
    'timezone', 'Europe/Helsinki'
  ),
  NOW()
)
ON CONFLICT ("personaName")
DO UPDATE SET
  summary = EXCLUDED.summary,
  traits = EXCLUDED.traits,
  "updatedAt" = NOW();

-- ============================================
-- STEP 3: Create UserLog History
-- ============================================
-- Realistic interaction history for each persona

-- Mark's interaction history (prefers brief updates)
INSERT INTO "UserLog" (id, "personaName", kind, content, meta, "createdAt")
VALUES
  (gen_random_uuid(), 'Mark', 'preference', 'Requested brief executive summaries for all building alerts', '{"source": "email-reply"}'::jsonb, NOW() - INTERVAL '80 days'),
  (gen_random_uuid(), 'Mark', 'interaction', 'Viewed FCU temperature anomaly dashboard', '{"duration": "45s", "action": "quick-scan"}'::jsonb, NOW() - INTERVAL '65 days'),
  (gen_random_uuid(), 'Mark', 'preference', 'Asked to receive only high and critical severity notifications', '{"severity-filter": "high-critical"}'::jsonb, NOW() - INTERVAL '50 days'),
  (gen_random_uuid(), 'Mark', 'fact', 'Approved budget for HVAC system upgrades based on Jeeves energy savings report', '{"budget": 15000, "roi-months": 18}'::jsonb, NOW() - INTERVAL '30 days'),
  (gen_random_uuid(), 'Mark', 'interaction', 'Forwarded Jeeves cost analysis to board meeting', '{"action": "forward", "recipient": "board"}'::jsonb, NOW() - INTERVAL '20 days'),
  (gen_random_uuid(), 'Mark', 'preference', 'Prefers concise summaries with cost implications highlighted', '{"emphasis": "cost-impact"}'::jsonb, NOW() - INTERVAL '10 days'),
  (gen_random_uuid(), 'Mark', 'note', 'Very positive feedback on energy cost savings discovery - called it "exactly what I needed"', '{"sentiment": "positive"}'::jsonb, NOW() - INTERVAL '5 days');

-- Jukka's history (loves dashboards and technical details)
INSERT INTO "UserLog" (id, "personaName", kind, content, meta, "createdAt")
VALUES
  (gen_random_uuid(), 'Jukka', 'preference', 'Requested detailed dashboards with historical charts for all FCU alerts', '{"format": "dashboard", "charts": "required"}'::jsonb, NOW() - INTERVAL '110 days'),
  (gen_random_uuid(), 'Jukka', 'interaction', 'Spent 15 minutes analyzing temperature oscillation dashboard', '{"duration": "15m", "action": "deep-analysis"}'::jsonb, NOW() - INTERVAL '95 days'),
  (gen_random_uuid(), 'Jukka', 'fact', 'Expert in HVAC systems with 12 years experience in building automation', '{"expertise": "hvac", "years": 12}'::jsonb, NOW() - INTERVAL '90 days'),
  (gen_random_uuid(), 'Jukka', 'preference', 'Wants to see raw data correlations and statistical confidence levels', '{"data-detail": "high", "stats": "required"}'::jsonb, NOW() - INTERVAL '75 days'),
  (gen_random_uuid(), 'Jukka', 'interaction', 'Downloaded CSV export from FCU performance dashboard', '{"action": "export", "format": "csv"}'::jsonb, NOW() - INTERVAL '60 days'),
  (gen_random_uuid(), 'Jukka', 'preference', 'Loves interactive visualizations and prefers dashboards over text reports', '{"format": "dashboard", "interactive": true}'::jsonb, NOW() - INTERVAL '40 days'),
  (gen_random_uuid(), 'Jukka', 'interaction', 'Set up custom alerting thresholds for FCU-201 temperature', '{"fcu": "201", "param": "temp", "threshold": 22.5}'::jsonb, NOW() - INTERVAL '25 days'),
  (gen_random_uuid(), 'Jukka', 'fact', 'Responds to Jeeves alerts within 30 minutes on average', '{"response-time": "30m", "reliability": "high"}'::jsonb, NOW() - INTERVAL '15 days'),
  (gen_random_uuid(), 'Jukka', 'note', 'Praised Jeeves dashboard for helping identify valve control issue before complete failure', '{"sentiment": "positive", "value": "predictive"}'::jsonb, NOW() - INTERVAL '7 days');

-- Anna's history (wants actionable reports)
INSERT INTO "UserLog" (id, "personaName", kind, content, meta, "createdAt")
VALUES
  (gen_random_uuid(), 'Anna', 'preference', 'Prefers reports that include both problem description and recommended actions', '{"format": "problem-solution"}'::jsonb, NOW() - INTERVAL '55 days'),
  (gen_random_uuid(), 'Anna', 'interaction', 'Created maintenance ticket based on Jeeves cooling valve anomaly alert', '{"action": "ticket-created", "ticket-id": "MAINT-4521"}'::jsonb, NOW() - INTERVAL '45 days'),
  (gen_random_uuid(), 'Anna', 'fact', 'Coordinates between facilities management and maintenance team', '{"role": "coordinator"}'::jsonb, NOW() - INTERVAL '40 days'),
  (gen_random_uuid(), 'Anna', 'preference', 'Likes summary format with embedded charts showing the issue', '{"format": "summary-with-chart"}'::jsonb, NOW() - INTERVAL '30 days'),
  (gen_random_uuid(), 'Anna', 'interaction', 'Acknowledged and resolved FCU fan speed issue within 2 hours', '{"resolution-time": "2h", "status": "resolved"}'::jsonb, NOW() - INTERVAL '20 days'),
  (gen_random_uuid(), 'Anna', 'preference', 'Wants clear severity levels and estimated impact on occupant comfort', '{"emphasis": "severity-impact"}'::jsonb, NOW() - INTERVAL '12 days'),
  (gen_random_uuid(), 'Anna', 'note', 'Appreciates that Jeeves recommendations are practical and implementable', '{"sentiment": "positive", "value": "actionable"}'::jsonb, NOW() - INTERVAL '5 days');

-- Mikko's history (notifications disabled but has history)
INSERT INTO "UserLog" (id, "personaName", kind, content, meta, "createdAt")
VALUES
  (gen_random_uuid(), 'Mikko', 'preference', 'Prefers work orders in ticketing system over email notifications', '{"channel": "work-order-system"}'::jsonb, NOW() - INTERVAL '40 days'),
  (gen_random_uuid(), 'Mikko', 'fact', 'Part of 3-person maintenance team covering building systems', '{"team-size": 3, "coverage": "full-building"}'::jsonb, NOW() - INTERVAL '35 days'),
  (gen_random_uuid(), 'Mikko', 'interaction', 'Fixed FCU-201 temperature sensor calibration issue', '{"action": "repair", "fcu": "201", "issue": "sensor-calibration"}'::jsonb, NOW() - INTERVAL '25 days'),
  (gen_random_uuid(), 'Mikko', 'preference', 'When checking notifications, wants brief technical descriptions with equipment IDs', '{"format": "brief-technical", "include": "equipment-id"}'::jsonb, NOW() - INTERVAL '15 days'),
  (gen_random_uuid(), 'Mikko', 'interaction', 'Replaced cooling valve actuator on FCU-201', '{"action": "replacement", "component": "valve-actuator", "fcu": "201"}'::jsonb, NOW() - INTERVAL '8 days');

-- ============================================
-- STEP 4: Initialize JeevesState
-- ============================================

INSERT INTO "JeevesState" (
  enabled,
  "ingestionEnabled",
  "analysisInterval",
  "monitoredStreams",
  "totalDiscoveries",
  "createdAt",
  "updatedAt"
)
VALUES (
  false,
  false,
  '1hour',
  '[]'::jsonb,
  '0',
  NOW(),
  NOW()
)
ON CONFLICT (id)
DO UPDATE SET
  "ingestionEnabled" = false,
  "updatedAt" = NOW();

-- ============================================
-- Verification Queries
-- ============================================

-- Show all personas
SELECT
  name,
  email,
  CASE WHEN "sendNotification" = true THEN '🔔 ON' ELSE '🔕 OFF' END as notifications,
  "createdAt"::date as "Created"
FROM "Persona"
ORDER BY name;

-- Show persona memories
SELECT
  "personaName",
  LEFT(summary, 100) || '...' as "Summary (preview)",
  traits->'preferredFormat' as "Preferred Format",
  traits->'technicalLevel' as "Technical Level"
FROM "PersonaMemory"
ORDER BY "personaName";

-- Show interaction counts
SELECT
  "personaName",
  kind,
  COUNT(*) as count
FROM "UserLog"
GROUP BY "personaName", kind
ORDER BY "personaName", kind;

-- Summary
SELECT 'Setup Complete! ✅' as "Status";
SELECT '4 Personas created with comprehensive history' as "Result";
SELECT 'Each persona has: name (person) + job description + communication preferences + personality traits' as "Detail";
SELECT 'Jeeves will generate custom notifications based on each person''s profile' as "Next";
