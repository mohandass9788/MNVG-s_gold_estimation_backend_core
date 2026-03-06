const mysql = require('mysql2/promise');

const userSchema = `
CREATE TABLE IF NOT EXISTS User (
  id VARCHAR(64) PRIMARY KEY,
  phone VARCHAR(64) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(128),
  shop_name VARCHAR(128),
  role VARCHAR(64) DEFAULT 'customer',
  max_allowed_devices INT DEFAULT 4,
  subscription_valid_upto DATETIME(3),
  is_trial BOOLEAN DEFAULT true,
  created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

const sessionSchema = `
CREATE TABLE IF NOT EXISTS Session (
  id VARCHAR(64) PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  device_id VARCHAR(128),
  device_name VARCHAR(128),
  login_time DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  last_active DATETIME(3) NOT NULL,
  userId VARCHAR(64) NOT NULL,
  INDEX Session_userId_idx (userId),
  CONSTRAINT Session_userId_fkey FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

const estimationSchema = `
CREATE TABLE IF NOT EXISTS Estimation (
  id VARCHAR(64) PRIMARY KEY,
  local_id VARCHAR(128) NOT NULL,
  bill_no INT,
  customer_name VARCHAR(128),
  customer_phone VARCHAR(64),
  total_amount DOUBLE NOT NULL DEFAULT 0,
  items JSON,
  date DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  status VARCHAR(64) DEFAULT 'active',
  userId VARCHAR(64) NOT NULL,
  UNIQUE INDEX Estimation_userId_local_id_key (userId, local_id),
  INDEX Estimation_userId_idx (userId),
  CONSTRAINT Estimation_userId_fkey FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

const purchaseSchema = `
CREATE TABLE IF NOT EXISTS Purchase (
  id VARCHAR(64) PRIMARY KEY,
  local_id VARCHAR(128) NOT NULL,
  bill_no INT,
  customer_name VARCHAR(128),
  customer_phone VARCHAR(64),
  total_amount DOUBLE NOT NULL DEFAULT 0,
  items JSON,
  date DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  userId VARCHAR(64) NOT NULL,
  UNIQUE INDEX Purchase_userId_local_id_key (userId, local_id),
  INDEX Purchase_userId_idx (userId),
  CONSTRAINT Purchase_userId_fkey FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

const repairSchema = `
CREATE TABLE IF NOT EXISTS Repair (
  id VARCHAR(64) PRIMARY KEY,
  local_id VARCHAR(128) NOT NULL,
  receipt_no INT,
  customer_name VARCHAR(128),
  customer_phone VARCHAR(64),
  item_desc VARCHAR(255),
  estimated_cost DOUBLE NOT NULL DEFAULT 0,
  advance_paid DOUBLE NOT NULL DEFAULT 0,
  status VARCHAR(64) DEFAULT 'pending',
  date DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  userId VARCHAR(64) NOT NULL,
  UNIQUE INDEX Repair_userId_local_id_key (userId, local_id),
  INDEX Repair_userId_idx (userId),
  CONSTRAINT Repair_userId_fkey FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

const employeeSchema = `
CREATE TABLE IF NOT EXISTS Employee (
  id VARCHAR(64) PRIMARY KEY,
  local_id VARCHAR(128) NOT NULL,
  name VARCHAR(128) NOT NULL,
  phone VARCHAR(64),
  role VARCHAR(64),
  salary DOUBLE,
  join_date DATETIME(3),
  userId VARCHAR(64) NOT NULL,
  UNIQUE INDEX Employee_userId_local_id_key (userId, local_id),
  INDEX Employee_userId_idx (userId),
  CONSTRAINT Employee_userId_fkey FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

const customerSchema = `
CREATE TABLE IF NOT EXISTS Customer (
  id VARCHAR(64) PRIMARY KEY,
  local_id VARCHAR(128) NOT NULL,
  name VARCHAR(128) NOT NULL,
  phone VARCHAR(64) NOT NULL,
  address VARCHAR(255),
  total_visits INT NOT NULL DEFAULT 0,
  userId VARCHAR(64) NOT NULL,
  UNIQUE INDEX Customer_userId_local_id_key (userId, local_id),
  UNIQUE INDEX Customer_userId_phone_key (userId, phone),
  INDEX Customer_userId_idx (userId),
  CONSTRAINT Customer_userId_fkey FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

async function main() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'mnv_groups_gold_estimation'
    });

    try {
        console.log('Connected. Dropping tables forcefully first...');
        await connection.query('SET FOREIGN_KEY_CHECKS = 0;');

        const tables = ['User', 'Session', 'Estimation', 'Purchase', 'Repair', 'Employee', 'Customer'];
        for (const t of tables) {
            await connection.query(`DROP TABLE IF EXISTS ${t}`);
        }
        await connection.query('SET FOREIGN_KEY_CHECKS = 1;');

        console.log('Tables dropped. Creating tables sequentially...');

        await connection.query(userSchema);
        console.log('Created User table.');

        await connection.query(sessionSchema);
        console.log('Created Session table.');

        await connection.query(estimationSchema);
        console.log('Created Estimation table.');

        await connection.query(purchaseSchema);
        console.log('Created Purchase table.');

        await connection.query(repairSchema);
        console.log('Created Repair table.');

        await connection.query(employeeSchema);
        console.log('Created Employee table.');

        await connection.query(customerSchema);
        console.log('Created Customer table.');

        console.log('All missing tables created successfully!');
    } catch (error) {
        console.error('Error creating tables:', error);
    } finally {
        await connection.end();
    }
}

main();
