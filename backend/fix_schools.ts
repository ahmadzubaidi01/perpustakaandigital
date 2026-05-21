import sequelize from './config/database';
import { QueryTypes } from 'sequelize';

async function fixSchools() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Database connected.');

    console.log('Disabling foreign key checks...');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');

    console.log('Dropping corrupted schools table...');
    await sequelize.query('DROP TABLE IF EXISTS schools;');
    console.log('Dropped successfully or table did not exist.');

    console.log('Re-creating schools table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS \`schools\` (
        \`school_id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
        \`district_id\` int(10) unsigned NOT NULL,
        \`regency_id\` int(10) unsigned NOT NULL,
        \`school_name\` varchar(255) NOT NULL,
        \`school_address\` text NOT NULL,
        \`school_status\` enum('active','inactive','suspended') NOT NULL DEFAULT 'active',
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`deleted_at\` datetime DEFAULT NULL,
        PRIMARY KEY (\`school_id\`),
        KEY \`schools_district_id\` (\`district_id\`),
        KEY \`schools_regency_id\` (\`regency_id\`),
        CONSTRAINT \`schools_ibfk_1\` FOREIGN KEY (\`district_id\`) REFERENCES \`districts\` (\`district_id\`) ON UPDATE CASCADE,
        CONSTRAINT \`schools_ibfk_2\` FOREIGN KEY (\`regency_id\`) REFERENCES \`regencies\` (\`regency_id\`) ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('Table created successfully.');

    console.log('Checking if default school is present...');
    const [schools]: any = await sequelize.query("SELECT * FROM schools WHERE school_id = 1;");
    if (schools.length === 0) {
      console.log('Inserting default school...');
      await sequelize.query(`
        INSERT INTO schools (school_id, district_id, regency_id, school_name, school_address, school_status, created_at, updated_at)
        VALUES (1, 1, 1, 'SMA Negeri 1 Sidoarjo', 'Jl. Jenggolo No.1, Sidoarjo', 'active', NOW(), NOW());
      `);
      console.log('Default school inserted.');
    }

    console.log('Enabling foreign key checks...');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('Done fixing schools table.');

  } catch (err) {
    console.error('Error fixing schools table:', err);
  } finally {
    await sequelize.close();
  }
}

fixSchools();
