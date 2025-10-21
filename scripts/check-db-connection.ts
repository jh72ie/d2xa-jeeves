/**
 * Check which database URL is being used
 * Run: npx tsx scripts/check-db-connection.ts
 */

import { config } from "dotenv";

config({ path: ".env.local" });

console.log('🔍 Database Connection Check');
console.log('════════════════════════════════════');

const postgresUrl = process.env.POSTGRES_URL;
const newPostgresUrl = process.env.NEW_POSTGRES_URL;

console.log('\n📋 Environment Variables:');
console.log('─────────────────────────────────────');

if (newPostgresUrl) {
  console.log('✅ NEW_POSTGRES_URL:', newPostgresUrl.substring(0, 50) + '...');
} else {
  console.log('❌ NEW_POSTGRES_URL: NOT SET');
}

if (postgresUrl) {
  console.log('✅ POSTGRES_URL:', postgresUrl.substring(0, 50) + '...');
} else {
  console.log('❌ POSTGRES_URL: NOT SET');
}

console.log('\n🎯 Code Will Use:');
console.log('─────────────────────────────────────');

const selectedUrl = newPostgresUrl || postgresUrl;

if (selectedUrl === newPostgresUrl && newPostgresUrl) {
  console.log('✅ NEW_POSTGRES_URL (NEW database - CORRECT)');
} else if (selectedUrl === postgresUrl && postgresUrl) {
  console.log('⚠️  POSTGRES_URL (might be OLD database)');
} else {
  console.log('❌ NO DATABASE URL FOUND');
}

console.log('\n💡 Recommendation:');
console.log('─────────────────────────────────────');

if (!newPostgresUrl) {
  console.log('⚠️  NEW_POSTGRES_URL not set in environment variables');
  console.log('   Either:');
  console.log('   1. Set NEW_POSTGRES_URL in Vercel env vars, OR');
  console.log('   2. Update POSTGRES_URL to point to NEW database');
} else if (postgresUrl && postgresUrl !== newPostgresUrl) {
  console.log('⚠️  POSTGRES_URL and NEW_POSTGRES_URL are different');
  console.log('   Update POSTGRES_URL to match NEW_POSTGRES_URL:');
  console.log(`   ${newPostgresUrl.substring(0, 60)}...`);
} else {
  console.log('✅ All good! Using NEW database');
}

console.log('\n════════════════════════════════════');
