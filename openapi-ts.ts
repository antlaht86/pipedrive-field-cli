import { createClient } from "@hey-api/openapi-ts";

// Get document, or throw exception on error
//file touch openapi-ts.ts
// command     "openapi-ts": "npx tsx openapi-ts.ts"

createClient({
  input: "https://developers.pipedrive.com/docs/api/v1/openapi-v2.yaml",
  output: "lib/pipedrive_v2/generated",
  parser: {
    transforms: {
      propertiesRequiredByDefault: true,
    },
    filters: {
      operations: {
        include: [
          "GET /organizationFields",
          "POST /organizationFields",
          "GET /organizationFields/{field_code}",
          "GET /personFields",
          "POST /personFields",
          "GET /personFields/{field_code}",
          "GET /dealFields",
          "POST /dealFields",
          "GET /dealFields/{field_code}",
          "GET /productFields",
          "POST /productFields",
          "GET /productFields/{field_code}",
        ],
      },
    },
  },

  plugins: [
    {
      asClass: true, // default
      name: "@hey-api/sdk",
    },
  ],
})
  .then(() => console.log("✅ Pipedrive v2 SDK generated successfully"))
  .catch((e) => {
    console.error("❌ Failed to generate Pipedrive v2 SDK:", e);
  });

/*
const myHeaders = new Headers();
myHeaders.append("Accept", "application/json");

const requestOptions = {
  method: "GET",
  headers: myHeaders,
  redirect: "follow"
};

fetch("https://api.pipedrive.com/v1/users/me?api_token=YOUR_API_TOKEN_HERE", requestOptions)
  .then((response) => response.text())
  .then((result) => console.log(result))
  .catch((error) => console.error(error));
  */
