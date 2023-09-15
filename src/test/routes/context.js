const { randomBytes } = require("crypto");
const { default: migrate } = require("node-pg-migrate");
const format = require("pg-format");
const pool = require("../../pool");

const DEFAULT_OPS = {
  host: "localhost",
  port: 5432,
  database: "socialnetwork-test",
  user: "postgres",
  password: "password",
};

class Context {
  static async build() {
    // Randomly generating a role name to connect to PG as

    const roleName = "a" + randomBytes(4).toString("hex");

    // Connect to PG as usual

    pool.connect(DEFAULT_OPS);

    // create a new role
    await pool.query(
      format("CREATE ROLE %I WITH LOGIN PASSWORD %L;", roleName, roleName)
    );

    // Create a schema with the same name

    await pool.query(
      format("CREATE SCHEMA %I AUTHORIZATION %I;", roleName, roleName)
    );

    // Giving the new role permissions

    await pool.query(
      format("GRANT ALL ON SCHEMA %I TO %I;", roleName, roleName)
    );

    // Disconnect from PG as usual

    await pool.close();

    // Connect to PG as the new role

    await pool.connect({
      host: "localhost",
      port: 5432,
      database: "socialnetwork-test",
      user: roleName,
      password: roleName,
    });

    // Disconnect entirely from postgres

    await pool.close();

    // Run our migrations in the new schema

    await migrate({
      schema: roleName,
      direction: "up",
      log: () => {},
      noLock: true,
      dir: "migrations",
      databaseUrl: `postgres://${roleName}:${roleName}@localhost:5432/socialnetwork-test`,
    });

    // Connect to pg as the newly created role

    await pool.connect({
      host: "localhost",
      port: 5432,
      database: "socialnetwork-test",
      user: roleName,
      password: roleName,
    });

    return new Context(roleName);
  }

  constructor(roleName) {
    this.roleName = roleName;
  }

  async reset() {
    return pool.query(`DELETE FROM users;`);
  }

  async close() {
    // Disconnect from PG

    await pool.close();

    // Reconnect as our root user
    await pool.connect(DEFAULT_OPS);

    // Delete the role and schema we created

    await pool.query(format("DROP SCHEMA %I CASCADE;", this.roleName));

    await pool.query(format("DROP ROLE %I;", this.roleName));

    // Disconnect
    await pool.close();
  }
}

module.exports = Context;
