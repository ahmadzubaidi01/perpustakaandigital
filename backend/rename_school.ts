import sequelize from './config/database';

async function run() {
  try {
    await sequelize.authenticate();
    console.log('[Database] Connected successfully.');
    
    // Search for schools matching 'Pancasila'
    const [schools]: any = await sequelize.query("SELECT * FROM schools WHERE school_name LIKE '%Pancasila%';");
    if (schools.length > 0) {
      console.log(`[Database] Found ${schools.length} school(s) matching 'Pancasila' in database:`);
      schools.forEach((s: any) => {
        console.log(`  - ID: ${s.school_id}, Current Name: ${s.school_name}`);
      });
      
      // Update school names
      await sequelize.query("UPDATE schools SET school_name = 'SMP E-Pustaka' WHERE school_name LIKE '%Pancasila%';");
      console.log("[Database] Successfully renamed all matching schools to 'SMP E-Pustaka'!");
    } else {
      console.log("[Database] No schools matching 'Pancasila' were found in the database tables.");
    }
  } catch (err: any) {
    console.error('[Database] Error during operation:', err.message);
  } finally {
    await sequelize.close();
  }
}

run();
