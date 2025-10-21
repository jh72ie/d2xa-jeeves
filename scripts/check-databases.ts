/**
 * Check both OLD and NEW databases to see what data exists
 * Run: npx tsx scripts/check-databases.ts
 */

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

async function checkDatabase(url: string, name: string) {
  console.log(`\n========== ${name} ==========`);

  if (!url) {
    console.log(`❌ ${name} URL not found in environment variables`);
    return;
  }

  try {
    const sql = postgres(url, { max: 1 });

    const tables = [
      'User',
      'Chat',
      'Message_v2',
      'Persona',
      'UserLog',
      'PersonaMemory',
      'JeevesState',
      'JeevesDiscovery',
      'JeevesNotification',
      'JeevesLearning',
      'PublishedDashboard',
      'Document',
      'Stream',
      'Vote_v2',
      'Suggestion',
      'TelemetryTick',
      'TelemetryAnomaly',
    ];

    console.log('\nTable Row Counts:');
    console.log('─────────────────────────────────');

    for (const table of tables) {
      try {
        const result = await sql`
          SELECT COUNT(*) as count FROM ${sql(table)}
        `;
        const count = Number(result[0].count);
        const icon = count > 0 ? '✅' : '⚪';
        console.log(`${icon} ${table.padEnd(25)} ${count.toLocaleString()} rows`);
      } catch (error: any) {
        if (error.message.includes('does not exist')) {
          console.log(`❌ ${table.padEnd(25)} Table doesn't exist`);
        } else {
          console.log(`⚠️  ${table.padEnd(25)} Error: ${error.message}`);
        }
      }
    }

    await sql.end();
  } catch (error: any) {
    console.error(`❌ Failed to connect to ${name}:`, error.message);
  }
}

async function main() {
  console.log('🔍 Checking Databases...\n');

  const oldDbUrl = process.env.POSTGRES_URL;
  const newDbUrl = process.env.NEW_POSTGRES_URL;

  await checkDatabase(oldDbUrl!, 'OLD DATABASE (POSTGRES_URL)');
  await checkDatabase(newDbUrl!, 'NEW DATABASE (NEW_POSTGRES_URL)');

  console.log('\n─────────────────────────────────');
  console.log('\n📊 Summary:');
  console.log('✅ = Has data');
  console.log('⚪ = Empty (0 rows)');
  console.log('❌ = Table missing or error');
  console.log('\nIf OLD has data and NEW is empty, run: npx tsx scripts/migrate-data.ts');
}

main().catch(console.error);
