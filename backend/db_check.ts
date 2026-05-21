import sequelize from './config/database';
import { User, School, District, Regency } from './models';

async function checkDb() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    // Get list of tables
    const [tables] = await sequelize.query("SHOW TABLES;");
    console.log('Tables in database:', tables);

    // Count records in each table
    const userCount = await User.count({ paranoid: false });
    console.log('Total users in database (including soft-deleted):', userCount);

    const activeUserCount = await User.count();
    console.log('Active users in database:', activeUserCount);

    const schoolCount = await School.count();
    console.log('Schools count:', schoolCount);

    const districtCount = await District.count();
    console.log('Districts count:', districtCount);

    const regencyCount = await Regency.count();
    console.log('Regencies count:', regencyCount);

    // List users
    const users = await User.findAll({
      paranoid: false,
      include: [
        { association: 'school', required: false },
        { association: 'district', required: false },
        { association: 'regency', required: false }
      ]
    });
    console.log('All Users details:');
    users.forEach((u: any) => {
      console.log(`- ID: ${u.user_id}, Name: ${u.full_name}, Email: ${u.email_address}, Role: ${u.user_role}, Status: ${u.account_status}, School: ${u.school?.school_name || null}, Regency: ${u.regency?.regency_name || null}, District: ${u.district?.district_name || null}`);
    });
  } catch (err: any) {
    console.error('Error during database check:', err);
  } finally {
    await sequelize.close();
  }
}

checkDb();
