/**
 * Migrate data from OLD database to NEW database
 * Excludes telemetry data (TelemetryTick, TelemetryAnomaly)
 * Run: npx tsx scripts/migrate-data.ts
 */

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const OLD_DB_URL = process.env.POSTGRES_URL!;
const NEW_DB_URL = process.env.NEW_POSTGRES_URL!;

// Tables to migrate (in dependency order)
const TABLES_TO_MIGRATE = [
  'User',
  'Chat',
  'Message_v2',
  'Vote_v2',
  'Document',
  'Suggestion',
  'Stream',
  'Persona',
  'UserLog',
  'PersonaMemory',
  'JeevesState',
  'JeevesDiscovery',
  'JeevesNotification',
  'JeevesLearning',
  'JeevesActivityLog',
  'PublishedDashboard',
  'PublishedDashboardAccess',
];

async function migrateTable(
  oldSql: postgres.Sql,
  newSql: postgres.Sql,
  tableName: string
) {
  try {
    console.log(`\n📦 Migrating ${tableName}...`);

    // Get data from old database
    const data = await oldSql`SELECT * FROM ${oldSql(tableName)}`;

    if (data.length === 0) {
      console.log(`   ⚪ No data to migrate`);
      return { success: true, rows: 0 };
    }

    console.log(`   📊 Found ${data.length} rows`);

    // Insert into new database
    // Use unnest to handle arrays properly
    const columns = Object.keys(data[0]);

    for (const row of data) {
      await newSql`
        INSERT INTO ${newSql(tableName)} ${newSql(row)}
        ON CONFLICT DO NOTHING
      `;
    }

    console.log(`   ✅ Migrated ${data.length} rows`);
    return { success: true, rows: data.length };

  } catch (error: any) {
    if (error.message.includes('does not exist')) {
      console.log(`   ⚠️  Table doesn't exist in old database - skipping`);
      return { success: true, rows: 0, skipped: true };
    }
    console.error(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Starting Data Migration');
  console.log('─────────────────────────────────');
  console.log(`📤 Source: POSTGRES_URL`);
  console.log(`📥 Target: NEW_POSTGRES_URL`);
  console.log(`🚫 Excluding: TelemetryTick, TelemetryAnomaly`);
  console.log('─────────────────────────────────');

  if (!OLD_DB_URL || !NEW_DB_URL) {
    console.error('❌ Missing database URLs in environment variables');
    process.exit(1);
  }

  const oldSql = postgres(OLD_DB_URL, { max: 1 });
  const newSql = postgres(NEW_DB_URL, { max: 1 });

  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
    totalRows: 0,
  };

  try {
    for (const tableName of TABLES_TO_MIGRATE) {
      const result = await migrateTable(oldSql, newSql, tableName);

      if (result.success) {
        if (result.skipped) {
          results.skipped++;
        } else {
          results.success++;
          results.totalRows += result.rows || 0;
        }
      } else {
        results.failed++;
      }
    }

    console.log('\n─────────────────────────────────');
    console.log('📊 Migration Summary:');
    console.log(`✅ Successfully migrated: ${results.success} tables`);
    console.log(`⚪ Skipped (no data): ${results.skipped} tables`);
    console.log(`❌ Failed: ${results.failed} tables`);
    console.log(`📝 Total rows migrated: ${results.totalRows.toLocaleString()}`);
    console.log('─────────────────────────────────');

    if (results.failed > 0) {
      console.log('\n⚠️  Some tables failed to migrate. Check errors above.');
    } else {
      console.log('\n🎉 Migration completed successfully!');
      console.log('\n📝 Next steps:');
      console.log('1. Run: npx tsx scripts/check-databases.ts');
      console.log('2. Verify NEW database has all your data');
      console.log('3. Update environment variables to use NEW_POSTGRES_URL');
    }

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await oldSql.end();
    await newSql.end();
  }
}

main().catch(console.error);
