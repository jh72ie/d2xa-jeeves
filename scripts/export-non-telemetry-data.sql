-- Export Non-Telemetry Data from Old Database
-- Run this with: psql $OLD_POSTGRES_URL -f export-non-telemetry-data.sql

-- Set output format
\o export_data.sql

-- Start transaction output
SELECT 'BEGIN;';

-- ============================================================================
-- Users and Authentication
-- ============================================================================

SELECT 'TRUNCATE TABLE "User" CASCADE;';
\copy (SELECT * FROM "User") TO '/tmp/User.csv' CSV HEADER
SELECT '\copy "User" FROM ''/tmp/User.csv'' CSV HEADER;';

-- ============================================================================
-- Chats and Messages
-- ============================================================================

SELECT 'TRUNCATE TABLE "Chat" CASCADE;';
\copy (SELECT * FROM "Chat") TO '/tmp/Chat.csv' CSV HEADER
SELECT '\copy "Chat" FROM ''/tmp/Chat.csv'' CSV HEADER;';

\copy (SELECT * FROM "Message_v2") TO '/tmp/Message_v2.csv' CSV HEADER
SELECT '\copy "Message_v2" FROM ''/tmp/Message_v2.csv'' CSV HEADER;';

\copy (SELECT * FROM "Vote_v2") TO '/tmp/Vote_v2.csv' CSV HEADER
SELECT '\copy "Vote_v2" FROM ''/tmp/Vote_v2.csv'' CSV HEADER;';

\copy (SELECT * FROM "Document") TO '/tmp/Document.csv' CSV HEADER
SELECT '\copy "Document" FROM ''/tmp/Document.csv'' CSV HEADER;';

\copy (SELECT * FROM "Suggestion") TO '/tmp/Suggestion.csv' CSV HEADER
SELECT '\copy "Suggestion" FROM ''/tmp/Suggestion.csv'' CSV HEADER;';

\copy (SELECT * FROM "Stream") TO '/tmp/Stream.csv' CSV HEADER
SELECT '\copy "Stream" FROM ''/tmp/Stream.csv'' CSV HEADER;';

-- ============================================================================
-- Published Dashboards
-- ============================================================================

\copy (SELECT * FROM "PublishedDashboard") TO '/tmp/PublishedDashboard.csv' CSV HEADER
SELECT '\copy "PublishedDashboard" FROM ''/tmp/PublishedDashboard.csv'' CSV HEADER;';

\copy (SELECT * FROM "PublishedDashboardAccess") TO '/tmp/PublishedDashboardAccess.csv' CSV HEADER
SELECT '\copy "PublishedDashboardAccess" FROM ''/tmp/PublishedDashboardAccess.csv'' CSV HEADER;';

-- ============================================================================
-- Jeeves System (ALL TABLES)
-- ============================================================================

\copy (SELECT * FROM "JeevesState") TO '/tmp/JeevesState.csv' CSV HEADER
SELECT '\copy "JeevesState" FROM ''/tmp/JeevesState.csv'' CSV HEADER;';

\copy (SELECT * FROM "JeevesDiscovery") TO '/tmp/JeevesDiscovery.csv' CSV HEADER
SELECT '\copy "JeevesDiscovery" FROM ''/tmp/JeevesDiscovery.csv'' CSV HEADER;';

\copy (SELECT * FROM "JeevesNotification") TO '/tmp/JeevesNotification.csv' CSV HEADER
SELECT '\copy "JeevesNotification" FROM ''/tmp/JeevesNotification.csv'' CSV HEADER;';

\copy (SELECT * FROM "JeevesLearning") TO '/tmp/JeevesLearning.csv' CSV HEADER
SELECT '\copy "JeevesLearning" FROM ''/tmp/JeevesLearning.csv'' CSV HEADER;';

\copy (SELECT * FROM "JeevesActivityLog") TO '/tmp/JeevesActivityLog.csv' CSV HEADER
SELECT '\copy "JeevesActivityLog" FROM ''/tmp/JeevesActivityLog.csv'' CSV HEADER;';

-- ============================================================================
-- Personas and User Logs
-- ============================================================================

\copy (SELECT * FROM "Persona") TO '/tmp/Persona.csv' CSV HEADER
SELECT '\copy "Persona" FROM ''/tmp/Persona.csv'' CSV HEADER;';

\copy (SELECT * FROM "UserLog") TO '/tmp/UserLog.csv' CSV HEADER
SELECT '\copy "UserLog" FROM ''/tmp/UserLog.csv'' CSV HEADER;';

\copy (SELECT * FROM "PersonaMemory") TO '/tmp/PersonaMemory.csv' CSV HEADER
SELECT '\copy "PersonaMemory" FROM ''/tmp/PersonaMemory.csv'' CSV HEADER;';

-- ============================================================================
-- NOTE: TelemetryTick and TelemetryAnomaly are intentionally SKIPPED
-- ============================================================================

SELECT 'COMMIT;';

\o
\echo 'Export complete! Check export_data.sql for import commands'
