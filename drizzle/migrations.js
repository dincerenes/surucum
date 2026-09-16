// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_spooky_blade.sql';
import m0001 from './0001_thin_iceman.sql';
import m0002 from './0002_cynical_infant_terrible.sql';
import m0003 from './0003_fix_consumption_column_name.sql';
import m0004 from './0004_slim_rage.sql';
import m0005 from './0005_huge_morg.sql';
import m0006 from './0006_calm_colleen_wing.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005,
m0006
    }
  }
  