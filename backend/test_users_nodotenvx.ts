import sequelize from './config/database';
import { User, School } from './models';

async function main() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully!');

    const users = await User.findAll({ paranoid: false });
    console.log(`Total users in DB (including deleted): ${users.length}`);
    users.forEach((u: any) => {
      console.log(`- ID: ${u.user_id} | Name: ${u.full_name} | Role: ${u.user_role} | Regency: ${u.regency_id} | District: ${u.district_id} | School: ${u.school_id} | Deleted: ${u.deleted_at}`);
    });

  } catch (error: any) {
    console.error('Test failed:', error);
  } finally {
    await sequelize.close();
  }
}

main();
