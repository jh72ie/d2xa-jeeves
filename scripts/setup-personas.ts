/**
 * Set up default personas for Jeeves notifications
 * Run: npx tsx scripts/setup-personas.ts
 */

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

// Use NEW_POSTGRES_URL for the new database
const DB_URL = process.env.NEW_POSTGRES_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  console.error('❌ Database URL not found in environment variables');
  process.exit(1);
}

// Default personas to create
const DEFAULT_PERSONAS = [
  {
    name: 'Mark',
    email: 'mark@customer-company.com', // TODO: Replace with actual email
    sendNotification: true,
  },
  {
    name: 'Facilities Manager',
    email: 'facilities@customer-company.com', // TODO: Replace with actual email
    sendNotification: true,
  },
  {
    name: 'Building Operations',
    email: 'operations@customer-company.com', // TODO: Replace with actual email
    sendNotification: true,
  },
  {
    name: 'Maintenance Team',
    email: 'maintenance@customer-company.com', // TODO: Replace with actual email
    sendNotification: true,
  },
];

async function setupPersonas() {
  console.log('🚀 Setting Up Personas for Notifications');
  console.log('─────────────────────────────────────────');

  const sql = postgres(DB_URL!, { max: 1 });

  try {
    console.log('\n📝 Creating personas...\n');

    for (const persona of DEFAULT_PERSONAS) {
      try {
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
        console.log(`${icon} ${persona.name.padEnd(25)} → ${persona.email}`);
      } catch (error: any) {
        console.error(`❌ Failed to create ${persona.name}:`, error.message);
      }
    }

    // Verify personas were created
    console.log('\n─────────────────────────────────────────');
    console.log('✅ Personas Created Successfully!\n');

    const personas = await sql`
      SELECT name, email, "sendNotification", "createdAt"
      FROM "Persona"
      ORDER BY "createdAt" DESC
    `;

    console.log('📊 Current Personas:');
    personas.forEach((p) => {
      const icon = p.sendNotification ? '🔔 Notifications ON' : '🔕 Notifications OFF';
      console.log(`   • ${p.name} (${p.email}) - ${icon}`);
    });

    console.log('\n─────────────────────────────────────────');
    console.log('📝 Next Steps:');
    console.log('1. Update email addresses in this script with actual emails');
    console.log('2. Re-run script: npx tsx scripts/setup-personas.ts');
    console.log('3. Go to /jeeves console to verify personas appear');
    console.log('4. Enable Jeeves to start receiving notifications');

  } catch (error: any) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

setupPersonas().catch(console.error);
