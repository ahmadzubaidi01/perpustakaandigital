import dotenvx from '@dotenvx/dotenvx';
dotenvx.config();

import sequelize from './config/database';
import { User, School, District, Regency } from './models';

async function main() {
  try {
    await sequelize.authenticate();
    console.log('DB connected OK');

    // Count users with default scope (paranoid + defaultScope)
    const defaultCount = await User.count();
    console.log(`User count (default scope): ${defaultCount}`);

    // Count users without any scope
    const unscopedCount = await (User as any).unscoped().count();
    console.log(`User count (unscoped): ${unscopedCount}`);

    // Raw query to verify
    const [rawResult]: any = await sequelize.query('SELECT COUNT(*) as cnt FROM users');
    console.log(`User count (raw SQL all): ${JSON.stringify(rawResult)}`);

    const [rawNonDeleted]: any = await sequelize.query('SELECT COUNT(*) as cnt FROM users WHERE deleted_at IS NULL');
    console.log(`User count (raw SQL non-deleted): ${JSON.stringify(rawNonDeleted)}`);

    // Get first 5 users with default scope
    const first5 = await User.findAll({ limit: 5, order: [['created_at', 'DESC']] });
    console.log(`\nFirst 5 users (default scope):`);
    first5.forEach((u: any) => {
      console.log(`  - [${u.user_id}] ${u.full_name} | role: ${u.user_role} | regency: ${u.regency_id} | district: ${u.district_id} | school: ${u.school_id} | status: ${u.account_status}`);
    });

    // Get all unique roles
    const [roles]: any = await sequelize.query('SELECT user_role, COUNT(*) as cnt FROM users WHERE deleted_at IS NULL GROUP BY user_role');
    console.log(`\nUser roles distribution:`, JSON.stringify(roles));

    // Test the simulated listUsers query for super_admin (no regional filter)
    const { count, rows } = await User.findAndCountAll({
      include: [
        { association: 'school', attributes: ['school_id', 'school_name'], required: false },
        { association: 'district', attributes: ['district_id', 'district_name'], required: false },
        { association: 'regency', attributes: ['regency_id', 'regency_name'], required: false },
      ],
      order: [['created_at', 'DESC']],
      limit: 15,
      offset: 0,
    });
    console.log(`\nlistUsers simulation (super_admin): count=${count}, rows=${rows.length}`);
    rows.forEach((u: any) => {
      console.log(`  - [${u.user_id}] ${u.full_name} | role: ${u.user_role} | school: ${u.school?.school_name || '-'} | regency: ${u.regency?.regency_name || '-'}`);
    });

    // Test regency admin query
    const regencyAdmins = await User.findAll({ where: { user_role: 'regency_admin' }, limit: 5 });
    console.log(`\nRegency admins:`);
    regencyAdmins.forEach((u: any) => {
      console.log(`  - [${u.user_id}] ${u.full_name} | regency: ${u.regency_id}`);
    });

    // Simulate regency admin filtering
    if (regencyAdmins.length > 0) {
      const testRegencyId = regencyAdmins[0].regency_id;
      if (testRegencyId) {
        console.log(`\nSimulating listUsers for regency_admin with regency_id=${testRegencyId}:`);
        const schoolIds = (await School.findAll({ where: { regency_id: testRegencyId }, attributes: ['school_id'], raw: true })).map((s: any) => s.school_id);
        console.log(`  Found ${schoolIds.length} schools in regency ${testRegencyId}`);
        
        const { Op } = require('sequelize');
        const where: any = {};
        where[Op.or] = [
          { regency_id: testRegencyId },
          ...(schoolIds.length > 0 ? [{ school_id: { [Op.in]: schoolIds } }] : []),
        ];
        
        const regencyResult = await User.findAndCountAll({
          where,
          include: [
            { association: 'school', attributes: ['school_id', 'school_name'], required: false },
            { association: 'district', attributes: ['district_id', 'district_name'], required: false },
            { association: 'regency', attributes: ['regency_id', 'regency_name'], required: false },
          ],
          order: [['created_at', 'DESC']],
          limit: 15,
          offset: 0,
        });
        console.log(`  Users visible to regency admin: count=${regencyResult.count}, rows=${regencyResult.rows.length}`);
        regencyResult.rows.forEach((u: any) => {
          console.log(`    - [${u.user_id}] ${u.full_name} | role: ${u.user_role} | regency: ${u.regency_id} | school: ${u.school_id}`);
        });
      }
    }

    // Check regencies
    const regencies = await Regency.findAll();
    console.log(`\nRegencies: ${regencies.length}`);
    regencies.forEach((r: any) => {
      console.log(`  - [${r.regency_id}] ${r.regency_name}`);
    });

    // Check districts
    const districts = await District.findAll({ limit: 10 });
    console.log(`Districts (first 10): ${districts.length}`);
    districts.forEach((d: any) => {
      console.log(`  - [${d.district_id}] ${d.district_name} | regency_id: ${d.regency_id}`);
    });

  } catch (err: any) {
    console.error('ERROR:', err.message);
    console.error(err.stack);
  } finally {
    await sequelize.close();
  }
}

main();
