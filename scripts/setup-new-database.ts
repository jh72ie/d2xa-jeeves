/**
 * Complete setup for new database
 * - Initialize JeevesState
 * - Create default personas
 * - Display summary
 *
 * Run: npx tsx scripts/setup-new-database.ts
 */

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const DB_URL = process.env.NEW_POSTGRES_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  console.error('❌ Database URL not found in environment variables');
  process.exit(1);
}

// Personas to create - UPDATE THESE EMAILS!
const PERSONAS = [
  {
    name: 'Mark',
    email: 'mark@example.com', // TODO: Replace with actual email
    sendNotification: true,
  },
  {
    name: 'Facilities Manager',
    email: 'facilities@example.com', // TODO: Replace
    sendNotification: true,
  },
  {
    name: 'Building Operations',
    email: 'operations@example.com', // TODO: Replace
    sendNotification: true,
  },
  {
    name: 'Maintenance Team',
    email: 'maintenance@example.com', // TODO: Replace
    sendNotification: false, // Notifications disabled for this one
  },
];

async function setupDatabase() {
  console.log('🚀 Setting Up New Database');
  console.log('═══════════════════════════════════════');

  const sql = postgres(DB_URL!, { max: 1 });

  try {
    // Step 1: Initialize JeevesState
    console.log('\n📋 Step 1: Initializing JeevesState...');

    const existingState = await sql`SELECT * FROM "JeevesState" LIMIT 1`;

    if (existingState.length === 0) {
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
      console.log('   ✅ JeevesState created');
    } else {
      await sql`
        UPDATE "JeevesState"
        SET "ingestionEnabled" = false, "updatedAt" = NOW()
        WHERE id = ${existingState[0].id}
      `;
      console.log('   ✅ JeevesState updated (ingestion disabled)');
    }

    // Step 2: Create Personas
    console.log('\n👥 Step 2: Creating Personas...');

    for (const persona of PERSONAS) {
      await sql`
        INSERT INTO "Persona" (name, email, "sendNotification", "createdAt", "updatedAt")
        VALUES (
          ${persona.name},
          ${persona.email},
          ${persona.sendNotification},
          NOW(),
          NOW()
        )
        ON CONFLICT (name)
        DO UPDATE SET
          email = ${persona.email},
          "sendNotification" = ${persona.sendNotification},
          "updatedAt" = NOW()
      `;

      const icon = persona.sendNotification ? '🔔' : '🔕';
      console.log(`   ${icon} ${persona.name.padEnd(25)} → ${persona.email}`);
    }

    // Step 3: Verify and Display Summary
    console.log('\n═══════════════════════════════════════');
    console.log('📊 Database Summary:');
    console.log('═══════════════════════════════════════');

    // Count all tables
    const userCount = await sql`SELECT COUNT(*) as count FROM "User"`;
    const chatCount = await sql`SELECT COUNT(*) as count FROM "Chat"`;
    const personaCount = await sql`SELECT COUNT(*) as count FROM "Persona"`;
    const stateCount = await sql`SELECT COUNT(*) as count FROM "JeevesState"`;

    console.log(`\n✅ Users: ${userCount[0].count}`);
    console.log(`✅ Chats: ${chatCount[0].count}`);
    console.log(`✅ Personas: ${personaCount[0].count}`);
    console.log(`✅ Jeeves State: ${stateCount[0].count}`);

    // Display Personas
    const personas = await sql`
      SELECT name, email, "sendNotification"
      FROM "Persona"
      ORDER BY name
    `;

    console.log('\n👥 Active Personas:');
    personas.forEach((p) => {
      const icon = p.sendNotification ? '🔔' : '🔕';
      console.log(`   ${icon} ${p.name} (${p.email})`);
    });

    console.log('\n═══════════════════════════════════════');
    console.log('✅ Setup Complete!');
    console.log('═══════════════════════════════════════');

    console.log('\n📝 Next Steps:');
    console.log('1. ⚠️  Update email addresses in scripts/setup-new-database.ts');
    console.log('2. Re-run: npx tsx scripts/setup-new-database.ts');
    console.log('3. Set up Inngest integration in Vercel');
    console.log('4. Deploy and test /jeeves console');
    console.log('5. Enable Jeeves when ready to start monitoring');

    console.log('\n💡 Tips:');
    console.log('• Keep "FCU Data Ingestion" OFF to avoid bandwidth usage');
    console.log('• Enable specific personas in /jeeves console');
    console.log('• First discovery will take ~5 minutes after enabling');

  } catch (error: any) {
    console.error('\n❌ Setup failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

setupDatabase().catch(console.error);
