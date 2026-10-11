import { afterEach, describe, expect, it } from "vitest";
import { databaseUrl, withServerlessDefaults } from "@/lib/db-url";

const saved = { DATABASE_URL: process.env.DATABASE_URL, NETLIFY_DB_URL: process.env.NETLIFY_DB_URL };
afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("database connection address", () => {
  it("prefers DATABASE_URL, then Netlify Database", () => {
    process.env.DATABASE_URL = "postgresql://a:b@db.example:5432/shop";
    process.env.NETLIFY_DB_URL = "postgresql://c:d@netlify.example/db";
    expect(databaseUrl()).toContain("db.example");
    delete process.env.DATABASE_URL;
    expect(databaseUrl()).toContain("netlify.example");
    delete process.env.NETLIFY_DB_URL;
    expect(databaseUrl()).toBeUndefined();
  });

  it("allows time for a sleeping database to wake up", () => {
    const url = new URL(withServerlessDefaults("postgresql://u:p%40ss@host.example/db?sslmode=require"));
    expect(url.searchParams.get("connect_timeout")).toBe("15");
    expect(url.searchParams.get("sslmode")).toBe("require");
    expect(url.password).toBe("p%40ss");
  });

  it("keeps a timeout that is already set", () => {
    expect(withServerlessDefaults("postgres://u:p@h/db?connect_timeout=30")).toContain("connect_timeout=30");
  });

  it("adds pgbouncer mode only for pooled hosts", () => {
    expect(withServerlessDefaults("postgresql://u:p@ep-x-pooler.example/db")).toContain("pgbouncer=true");
    expect(withServerlessDefaults("postgresql://u:p@ep-x.example/db")).not.toContain("pgbouncer");
  });

  it("leaves unparseable values alone", () => {
    expect(withServerlessDefaults("not a url")).toBe("not a url");
  });
});
