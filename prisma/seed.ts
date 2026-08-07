import "dotenv/config";
import { auth } from "@/lib/auth";

async function main(): Promise<void> {
  const email = process.env.SEED_USER_EMAIL;
  const password = process.env.SEED_USER_PASSWORD;
  const name = process.env.SEED_USER_NAME ?? "Ben";

  if (!email || !password) {
    throw new Error(
      "Set SEED_USER_EMAIL and SEED_USER_PASSWORD env vars before running the seed script."
    );
  }

  await auth.api.signUpEmail({
    body: { email, password, name },
  });

  console.log(`Seeded user: ${email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => process.exit(0));
