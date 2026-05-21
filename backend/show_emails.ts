import sequelize from './config/database';
import { User } from './models';

async function main() {
  try {
    await sequelize.authenticate();
    const users = await User.scope('withPassword').findAll();
    users.forEach((u: any) => {
      console.log(`Email: ${u.email_address} | Role: ${u.user_role} | Hash: ${u.password_hash}`);
    });
  } catch (error: any) {
    console.error('Failed:', error);
  } finally {
    await sequelize.close();
  }
}

main();
