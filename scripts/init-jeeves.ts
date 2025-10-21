/**
 * Initialize JeevesState with proper settings
 * Run: npx tsx scripts/init-jeeves.ts
 */

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const DB_URL = process.env.NEW_POSTGRES_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  console.error('❌ Database URL not found in environment variables');
  process.exit(1);
}

async function initJeeves() {
  console.log('🚀 Initializing Jeeves State');
  console.log('─────────────────────────────────');

  const sql = postgres(DB_URL!, { max: 1 });

  try {
    // Check if JeevesState exists
    const existing = await sql`
      SELECT * FROM "JeevesState" LIMIT 1
    `;

    if (existing.length > 0) {
      console.log('✅ JeevesState already exists:');
      console.log(`   • Enabled: ${existing[0].enabled}`);
      console.log(`   • Ingestion: ${existing[0].ingestionEnabled}`);
      console.log(`   • Analysis Interval: ${existing[0].analysisInterval}`);
      console.log(`   • Last Analysis: ${existing[0].lastAnalysisAt || 'Never'}`);
      console.log(`   • Total Discoveries: ${existing[0].totalDiscoveries}`);

      // Update to ensure ingestion is disabled by default
      await sql`
        UPDATE "JeevesState"
        SET
          "ingestionEnabled" = false,
          "updatedAt" = NOW()
        WHERE id = ${existing[0].id}
      `;
      console.log('\n✅ Updated: Ingestion disabled by default');
    } else {
      // Create new JeevesState
      await sql`
        INSERT INTO "JeevesState" (
          enabled,
          "ingestionEnabled",
          "analysisInterval",
          "monitoredStreams",
          "totalDiscoveries",
          "createdAt",
          "updatedAt"
        ) VALUES (
          false,
          false,
          '5min',
          '[]'::jsonb,
          '0',
          NOW(),
          NOW()
        )
      `;
      console.log('✅ JeevesState created with default settings:');
      console.log('   • Enabled: false (turn on in /jeeves console)');
      console.log('   • Ingestion: false (prevents bandwidth usage)');
      console.log('   • Analysis Interval: 5min');
    }

    console.log('\n─────────────────────────────────');
    console.log('✅ Jeeves initialization complete!');
    console.log('\n📝 Next Steps:');
    console.log('1. Go to /jeeves console');
    console.log('2. Toggle "Enable Jeeves" ON when ready');
    console.log('3. Keep "FCU Data Ingestion" OFF to save bandwidth');
    console.log('4. Set up Inngest for background workers');

  } catch (error: any) {
    console.error('\n❌ Initialization failed:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

initJeeves().catch(console.error);
