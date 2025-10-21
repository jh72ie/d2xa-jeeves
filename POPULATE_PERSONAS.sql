-- ============================================================================
-- POPULATE PERSONAS FOR JEEVES TESTING
-- ============================================================================
-- Run this SQL in your Neon database to create diverse personas
-- that Jeeves can intelligently select for different discoveries
-- ============================================================================

-- Clean up existing test data (optional - comment out if you want to keep existing data)
DELETE FROM "PersonaMemory";
DELETE FROM "UserLog";
DELETE FROM "Persona";

-- ============================================================================
-- 0. CREATE SYSTEM USER FOR JEEVES (needed for dashboard publishing)
-- ============================================================================

INSERT INTO "User" (id, email, password)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'jeeves@system.local',
  NULL  -- No password, this is a system account
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 1. CREATE PERSONAS (Different roles and personalities)
-- ============================================================================

INSERT INTO "Persona" (name, "createdAt", "updatedAt") VALUES
-- Engineering team
('Alice-DevOps', NOW(), NOW()),
('Bob-Backend', NOW(), NOW()),
('Charlie-Data', NOW(), NOW()),

-- Operations team
('Diana-SysAdmin', NOW(), NOW()),
('Eve-Monitoring', NOW(), NOW()),

-- Management
('Frank-CTO', NOW(), NOW()),
('Grace-PM', NOW(), NOW()),

-- Data science team
('Henry-ML', NOW(), NOW()),
('Iris-Analytics', NOW(), NOW()),

-- Quality assurance
('Jack-QA', NOW(), NOW())

ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 2. ADD PERSONA MEMORIES (Interests, preferences, communication styles)
-- ============================================================================

-- Alice-DevOps: Infrastructure expert, loves anomaly detection
INSERT INTO "PersonaMemory" (
  "personaName",
  summary,
  traits,
  "updatedAt"
) VALUES (
  'Alice-DevOps',
  'Senior DevOps Engineer responsible for infrastructure monitoring and automation. Highly technical, prefers detailed analysis. Expert in system reliability and performance optimization.',
  jsonb_build_object(
    'interests', jsonb_build_array('anomaly detection', 'system performance', 'infrastructure reliability', 'automated monitoring', 'capacity planning'),
    'behaviorPatterns', jsonb_build_object(
      'preferredFormat', 'technical',
      'detailLevel', 'high',
      'notificationFrequency', 'all',
      'expertise', jsonb_build_array('DevOps', 'monitoring', 'cloud infrastructure'),
      'timezone', 'UTC-8'
    ),
    'communicationStyle', 'technical-detailed',
    'occupation', 'DevOps Engineer'
  ),
  NOW()
) ON CONFLICT ("personaName") DO UPDATE SET
  summary = EXCLUDED.summary,
  traits = EXCLUDED.traits,
  "updatedAt" = NOW();

-- Bob-Backend: Backend developer, cares about data patterns
INSERT INTO "PersonaMemory" (
  "personaName",
  summary,
  traits,
  "updatedAt"
) VALUES (
  'Bob-Backend',
  'Backend Software Engineer focused on API performance and data integrity. Likes to understand root causes. Appreciates concise summaries with links to details.',
  jsonb_build_object(
    'interests', jsonb_build_array('data patterns', 'API performance', 'correlation analysis', 'trend detection'),
    'behaviorPatterns', jsonb_build_object(
      'preferredFormat', 'summary',
      'detailLevel', 'medium',
      'notificationFrequency', 'important-only',
      'expertise', jsonb_build_array('backend development', 'databases', 'APIs'),
      'timezone', 'UTC-5'
    ),
    'communicationStyle', 'concise-actionable',
    'occupation', 'Backend Engineer'
  ),
  NOW()
) ON CONFLICT ("personaName") DO UPDATE SET
  summary = EXCLUDED.summary,
  traits = EXCLUDED.traits,
  "updatedAt" = NOW();

-- Charlie-Data: Data Engineer, loves statistical anomalies
INSERT INTO "PersonaMemory" (
  "personaName",
  summary,
  traits,
  "updatedAt"
) VALUES (
  'Charlie-Data',
  'Data Engineer specializing in time-series analysis and quality monitoring. PhD in Statistics. Loves discovering hidden patterns and correlations.',
  jsonb_build_object(
    'interests', jsonb_build_array('statistical analysis', 'time-series patterns', 'correlation studies', 'data quality', 'harmonic analysis', 'leading indicators'),
    'behaviorPatterns', jsonb_build_object(
      'preferredFormat', 'statistical',
      'detailLevel', 'very-high',
      'notificationFrequency', 'all',
      'expertise', jsonb_build_array('statistics', 'data science', 'time-series analysis'),
      'timezone', 'UTC+0'
    ),
    'communicationStyle', 'academic-detailed',
    'occupation', 'Data Engineer'
  ),
  NOW()
) ON CONFLICT ("personaName") DO UPDATE SET
  summary = EXCLUDED.summary,
  traits = EXCLUDED.traits,
  "updatedAt" = NOW();

-- Diana-SysAdmin: System administrator, focuses on equipment health
INSERT INTO "PersonaMemory" (
  "personaName",
  summary,
  traits,
  "updatedAt"
) VALUES (
  'Diana-SysAdmin',
  'System Administrator maintaining building HVAC and environmental sensors. Needs to know about equipment failures and maintenance issues. Prefers actionable alerts.',
  jsonb_build_object(
    'interests', jsonb_build_array('equipment failures', 'sensor health', 'maintenance alerts', 'hardware issues', 'system drift'),
    'behaviorPatterns', jsonb_build_object(
      'preferredFormat', 'alert',
      'detailLevel', 'medium',
      'notificationFrequency', 'critical-only',
      'expertise', jsonb_build_array('systems administration', 'HVAC', 'facility management'),
      'timezone', 'UTC-8'
    ),
    'communicationStyle', 'actionable-brief',
    'occupation', 'System Administrator'
  ),
  NOW()
) ON CONFLICT ("personaName") DO UPDATE SET
  summary = EXCLUDED.summary,
  traits = EXCLUDED.traits,
  "updatedAt" = NOW();

-- Eve-Monitoring: Monitoring specialist, wants all insights
INSERT INTO "PersonaMemory" (
  "personaName",
  summary,
  traits,
  "updatedAt"
) VALUES (
  'Eve-Monitoring',
  'Monitoring & Observability Specialist. Tracks all system metrics and builds dashboards. Wants to see everything interesting, even low-priority patterns.',
  jsonb_build_object(
    'interests', jsonb_build_array('all patterns', 'dashboard metrics', 'trend analysis', 'system behavior', 'observability'),
    'behaviorPatterns', jsonb_build_object(
      'preferredFormat', 'dashboard',
      'detailLevel', 'high',
      'notificationFrequency', 'all',
      'expertise', jsonb_build_array('monitoring', 'observability', 'metrics'),
      'timezone', 'UTC-5'
    ),
    'communicationStyle', 'visual-rich',
    'occupation', 'Monitoring Specialist'
  ),
  NOW()
) ON CONFLICT ("personaName") DO UPDATE SET
  summary = EXCLUDED.summary,
  traits = EXCLUDED.traits,
  "updatedAt" = NOW();

-- Frank-CTO: Executive, wants high-level summaries
INSERT INTO "PersonaMemory" (
  "personaName",
  summary,
  traits,
  "updatedAt"
) VALUES (
  'Frank-CTO',
  'Chief Technology Officer. Needs executive summaries of significant issues. Only wants critical or high-impact discoveries. Prefers business context over technical details.',
  jsonb_build_object(
    'interests', jsonb_build_array('critical issues', 'business impact', 'system reliability', 'major trends'),
    'behaviorPatterns', jsonb_build_object(
      'preferredFormat', 'executive-summary',
      'detailLevel', 'low',
      'notificationFrequency', 'critical-only',
      'expertise', jsonb_build_array('technology leadership', 'strategy'),
      'timezone', 'UTC-8'
    ),
    'communicationStyle', 'executive-brief',
    'occupation', 'CTO'
  ),
  NOW()
) ON CONFLICT ("personaName") DO UPDATE SET
  summary = EXCLUDED.summary,
  traits = EXCLUDED.traits,
  "updatedAt" = NOW();

-- Grace-PM: Product Manager, interested in user impact
INSERT INTO "PersonaMemory" (
  "personaName",
  summary,
  traits,
  "updatedAt"
) VALUES (
  'Grace-PM',
  'Product Manager for infrastructure products. Cares about patterns that affect user experience or require product decisions. Likes business-friendly explanations.',
  jsonb_build_object(
    'interests', jsonb_build_array('user impact', 'operational patterns', 'scheduling issues', 'cost optimization'),
    'behaviorPatterns', jsonb_build_object(
      'preferredFormat', 'business-friendly',
      'detailLevel', 'medium',
      'notificationFrequency', 'important-only',
      'expertise', jsonb_build_array('product management', 'user experience'),
      'timezone', 'UTC-5'
    ),
    'communicationStyle', 'business-context',
    'occupation', 'Product Manager'
  ),
  NOW()
) ON CONFLICT ("personaName") DO UPDATE SET
  summary = EXCLUDED.summary,
  traits = EXCLUDED.traits,
  "updatedAt" = NOW();

-- Henry-ML: Machine Learning Engineer, loves predictive patterns
INSERT INTO "PersonaMemory" (
  "personaName",
  summary,
  traits,
  "updatedAt"
) VALUES (
  'Henry-ML',
  'Machine Learning Engineer building predictive models. Extremely interested in leading indicators, correlations, and patterns that could improve forecasting accuracy.',
  jsonb_build_object(
    'interests', jsonb_build_array('predictive patterns', 'correlations', 'leading indicators', 'feature engineering', 'model training data'),
    'behaviorPatterns', jsonb_build_object(
      'preferredFormat', 'technical',
      'detailLevel', 'very-high',
      'notificationFrequency', 'all',
      'expertise', jsonb_build_array('machine learning', 'predictive modeling', 'data science'),
      'timezone', 'UTC+0'
    ),
    'communicationStyle', 'research-oriented',
    'occupation', 'ML Engineer'
  ),
  NOW()
) ON CONFLICT ("personaName") DO UPDATE SET
  summary = EXCLUDED.summary,
  traits = EXCLUDED.traits,
  "updatedAt" = NOW();

-- Iris-Analytics: Data Analyst, weekly/monthly reporting
INSERT INTO "PersonaMemory" (
  "personaName",
  summary,
  traits,
  "updatedAt"
) VALUES (
  'Iris-Analytics',
  'Data Analyst responsible for weekly and monthly infrastructure reports. Interested in trends, seasonal patterns, and insights for stakeholder presentations.',
  jsonb_build_object(
    'interests', jsonb_build_array('trend analysis', 'seasonal patterns', 'weekly patterns', 'monthly reporting', 'visualizations'),
    'behaviorPatterns', jsonb_build_object(
      'preferredFormat', 'analytical',
      'detailLevel', 'high',
      'notificationFrequency', 'important-only',
      'expertise', jsonb_build_array('data analysis', 'reporting', 'visualization'),
      'timezone', 'UTC+0'
    ),
    'communicationStyle', 'analytical-visual',
    'occupation', 'Data Analyst'
  ),
  NOW()
) ON CONFLICT ("personaName") DO UPDATE SET
  summary = EXCLUDED.summary,
  traits = EXCLUDED.traits,
  "updatedAt" = NOW();

-- Jack-QA: Quality Assurance, data quality issues
INSERT INTO "PersonaMemory" (
  "personaName",
  summary,
  traits,
  "updatedAt"
) VALUES (
  'Jack-QA',
  'Quality Assurance Engineer focused on data quality and reliability. Needs to know about sensor malfunctions, data gaps, and quality degradation.',
  jsonb_build_object(
    'interests', jsonb_build_array('data quality', 'sensor reliability', 'missing data', 'quality degradation', 'testing'),
    'behaviorPatterns', jsonb_build_object(
      'preferredFormat', 'quality-report',
      'detailLevel', 'medium',
      'notificationFrequency', 'all',
      'expertise', jsonb_build_array('quality assurance', 'testing', 'validation'),
      'timezone', 'UTC-5'
    ),
    'communicationStyle', 'quality-focused',
    'occupation', 'QA Engineer'
  ),
  NOW()
) ON CONFLICT ("personaName") DO UPDATE SET
  summary = EXCLUDED.summary,
  traits = EXCLUDED.traits,
  "updatedAt" = NOW();

-- ============================================================================
-- 3. ADD USER LOGS (Recent activity to inform Jeeves)
-- ============================================================================

-- Alice-DevOps recent activity
INSERT INTO "UserLog" (id, "personaName", kind, content, meta, "createdAt") VALUES
(gen_random_uuid(), 'Alice-DevOps', 'interaction', 'Asked about temperature anomalies in production', '{"topic": "anomaly detection", "stream": "temp-001"}'::jsonb, NOW() - INTERVAL '2 hours'),
(gen_random_uuid(), 'Alice-DevOps', 'preference', 'Prefers notifications with statistical confidence scores', '{"setting": "confidence-scores"}'::jsonb, NOW() - INTERVAL '1 day'),
(gen_random_uuid(), 'Alice-DevOps', 'interaction', 'Reviewed dashboard for system performance metrics', '{"action": "dashboard-view"}'::jsonb, NOW() - INTERVAL '3 hours');

-- Bob-Backend recent activity
INSERT INTO "UserLog" (id, "personaName", kind, content, meta, "createdAt") VALUES
(gen_random_uuid(), 'Bob-Backend', 'interaction', 'Investigated correlation between humidity and API latency', '{"topic": "correlation", "streams": ["humid-001", "api-latency"]}'::jsonb, NOW() - INTERVAL '5 hours'),
(gen_random_uuid(), 'Bob-Backend', 'preference', 'Only wants high and critical severity notifications', '{"setting": "severity-filter", "value": "high+"}'::jsonb, NOW() - INTERVAL '2 days');

-- Charlie-Data recent activity
INSERT INTO "UserLog" (id, "personaName", kind, content, meta, "createdAt") VALUES
(gen_random_uuid(), 'Charlie-Data', 'interaction', 'Analyzed harmonic patterns in telemetry data', '{"topic": "harmonic analysis", "method": "FFT"}'::jsonb, NOW() - INTERVAL '1 hour'),
(gen_random_uuid(), 'Charlie-Data', 'fact', 'Published research paper on time-series pattern detection', '{"achievement": "research"}'::jsonb, NOW() - INTERVAL '7 days'),
(gen_random_uuid(), 'Charlie-Data', 'interaction', 'Built custom dashboard for cross-correlation analysis', '{"action": "dashboard-create", "type": "correlation"}'::jsonb, NOW() - INTERVAL '4 hours');

-- Diana-SysAdmin recent activity
INSERT INTO "UserLog" (id, "personaName", kind, content, meta, "createdAt") VALUES
(gen_random_uuid(), 'Diana-SysAdmin', 'interaction', 'Fixed HVAC sensor that was reporting incorrect values', '{"action": "sensor-repair", "sensor": "temp-002"}'::jsonb, NOW() - INTERVAL '6 hours'),
(gen_random_uuid(), 'Diana-SysAdmin', 'preference', 'Only notify for actionable equipment issues', '{"setting": "actionable-only"}'::jsonb, NOW() - INTERVAL '3 days'),
(gen_random_uuid(), 'Diana-SysAdmin', 'note', 'HVAC schedule changes on weekends for energy savings', '{"note": "weekend-schedule"}'::jsonb, NOW() - INTERVAL '10 days');

-- Eve-Monitoring recent activity
INSERT INTO "UserLog" (id, "personaName", kind, content, meta, "createdAt") VALUES
(gen_random_uuid(), 'Eve-Monitoring', 'interaction', 'Created 15 new monitoring dashboards this week', '{"action": "dashboard-creation", "count": 15}'::jsonb, NOW() - INTERVAL '2 hours'),
(gen_random_uuid(), 'Eve-Monitoring', 'preference', 'Wants all discoveries regardless of severity', '{"setting": "notify-all"}'::jsonb, NOW() - INTERVAL '1 day'),
(gen_random_uuid(), 'Eve-Monitoring', 'interaction', 'Set up alerts for lunch-time data quality issues', '{"action": "alert-config", "time": "12:00-13:00"}'::jsonb, NOW() - INTERVAL '8 hours');

-- Frank-CTO recent activity
INSERT INTO "UserLog" (id, "personaName", kind, content, meta, "createdAt") VALUES
(gen_random_uuid(), 'Frank-CTO', 'interaction', 'Asked for executive summary of infrastructure incidents', '{"format": "executive-summary"}'::jsonb, NOW() - INTERVAL '12 hours'),
(gen_random_uuid(), 'Frank-CTO', 'preference', 'Only critical issues that affect business operations', '{"setting": "critical-only"}'::jsonb, NOW() - INTERVAL '5 days');

-- Grace-PM recent activity
INSERT INTO "UserLog" (id, "personaName", kind, content, meta, "createdAt") VALUES
(gen_random_uuid(), 'Grace-PM', 'interaction', 'Inquired about patterns affecting user experience', '{"topic": "user-impact"}'::jsonb, NOW() - INTERVAL '4 hours'),
(gen_random_uuid(), 'Grace-PM', 'note', 'Working on product roadmap for monitoring improvements', '{"project": "monitoring-roadmap"}'::jsonb, NOW() - INTERVAL '6 days');

-- Henry-ML recent activity
INSERT INTO "UserLog" (id, "personaName", kind, content, meta, "createdAt") VALUES
(gen_random_uuid(), 'Henry-ML', 'interaction', 'Requested data on leading indicators for prediction model', '{"topic": "leading-indicators", "goal": "forecasting"}'::jsonb, NOW() - INTERVAL '3 hours'),
(gen_random_uuid(), 'Henry-ML', 'fact', 'Building temperature prediction model using humidity as feature', '{"project": "temp-prediction", "features": ["humidity", "time"]}'::jsonb, NOW() - INTERVAL '2 days'),
(gen_random_uuid(), 'Henry-ML', 'interaction', 'Analyzed correlation between streams for feature engineering', '{"action": "correlation-study"}'::jsonb, NOW() - INTERVAL '1 hour');

-- Iris-Analytics recent activity
INSERT INTO "UserLog" (id, "personaName", kind, content, meta, "createdAt") VALUES
(gen_random_uuid(), 'Iris-Analytics', 'interaction', 'Preparing monthly infrastructure report for stakeholders', '{"task": "monthly-report", "due": "end-of-month"}'::jsonb, NOW() - INTERVAL '5 hours'),
(gen_random_uuid(), 'Iris-Analytics', 'preference', 'Interested in weekly and monthly patterns for reports', '{"setting": "pattern-focus", "timeframes": ["weekly", "monthly"]}'::jsonb, NOW() - INTERVAL '4 days');

-- Jack-QA recent activity
INSERT INTO "UserLog" (id, "personaName", kind, content, meta, "createdAt") VALUES
(gen_random_uuid(), 'Jack-QA', 'interaction', 'Reported data quality issues during lunch hours', '{"issue": "lunch-quality", "time": "12:00-13:00"}'::jsonb, NOW() - INTERVAL '7 hours'),
(gen_random_uuid(), 'Jack-QA', 'fact', 'Responsible for sensor validation and data integrity checks', '{"role": "data-validation"}'::jsonb, NOW() - INTERVAL '10 days'),
(gen_random_uuid(), 'Jack-QA', 'interaction', 'Running automated tests on telemetry data pipelines', '{"action": "qa-testing", "target": "telemetry"}'::jsonb, NOW() - INTERVAL '2 hours');

-- ============================================================================
-- DONE! ✅
-- ============================================================================
-- You now have 10 diverse personas with:
-- - Different interests and expertise
-- - Communication preferences
-- - Recent activity logs
-- - Behavior patterns
--
-- Jeeves will use this to intelligently decide:
-- - WHO to notify about each discovery
-- - WHAT format to use for each person
-- - HOW much detail to include
-- ============================================================================
