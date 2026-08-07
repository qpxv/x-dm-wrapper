import "dotenv/config";

async function main(): Promise<void> {
  const bearerToken = process.env.X_BEARER_TOKEN;
  const webhookUrl = process.env.X_WEBHOOK_URL;

  if (!bearerToken || !webhookUrl) {
    throw new Error("Set X_BEARER_TOKEN and X_WEBHOOK_URL in .env before running this script.");
  }

  const response = await fetch("https://api.x.com/2/webhooks", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: webhookUrl }),
  });

  const body: unknown = await response.json();

  if (!response.ok) {
    throw new Error(`Webhook registration failed: ${response.status} ${JSON.stringify(body)}`);
  }

  console.log("Webhook registered:", JSON.stringify(body, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
