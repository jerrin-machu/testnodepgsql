const request = require("supertest");
const buildApp = require("../../app");
const userRepo = require("../../repos/user-repo");
const pool = require("../../pool");
const Context = require("./context");
let context;

beforeAll(async () => {
  context = await Context.build();
});

afterAll(async () => {
  return await context.close();
});

it("create a user", async () => {
  const startingCount = await userRepo.count();

  await request(buildApp())
    .post("/users")
    .send({ username: "testuser", bio: "test bio" })
    .expect(200);

  const finishCount = await userRepo.count();
  expect(finishCount - startingCount).toEqual(1);
});
