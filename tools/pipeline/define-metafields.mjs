// Creates (or updates) the storefront's custom field definitions in Shopify. Safe to run again.
//
//   node define-metafields.mjs
import { loadEnvFile } from "./lib/env.mjs";
import { check, gql } from "./lib/shopify.mjs";
import { COLLECTION_FIELDS, NAMESPACE, PRODUCT_FIELDS } from "./lib/schema.mjs";

loadEnvFile();

async function existing(ownerType) {
  const data = await gql(
    `query($o: MetafieldOwnerType!, $ns: String!) {
      metafieldDefinitions(first: 100, ownerType: $o, namespace: $ns) { nodes { id key access { storefront } } }
    }`,
    { o: ownerType, ns: NAMESPACE },
  );
  return new Map(data.metafieldDefinitions.nodes.map((d) => [d.key, d]));
}

async function define(ownerType, fields) {
  const have = await existing(ownerType);
  for (const f of Object.values(fields)) {
    const storefront = f.storefront ? "PUBLIC_READ" : "NONE";
    const current = have.get(f.key);
    if (!current) {
      const data = await gql(
        `mutation($d: MetafieldDefinitionInput!) { metafieldDefinitionCreate(definition: $d) { createdDefinition { id } userErrors { field message } } }`,
        { d: { name: f.name, namespace: NAMESPACE, key: f.key, type: f.type, ownerType, description: f.description, validations: f.validations ?? [], access: { storefront } } },
      );
      check(data.metafieldDefinitionCreate, `define ${ownerType} ${f.key}`);
      console.log(`created  ${ownerType.toLowerCase()} ${NAMESPACE}.${f.key}`);
    } else if (current.access.storefront !== storefront) {
      const data = await gql(
        `mutation($d: MetafieldDefinitionUpdateInput!) { metafieldDefinitionUpdate(definition: $d) { updatedDefinition { id } userErrors { field message } } }`,
        { d: { namespace: NAMESPACE, key: f.key, ownerType, access: { storefront } } },
      );
      check(data.metafieldDefinitionUpdate, `update ${ownerType} ${f.key}`);
      console.log(`updated  ${ownerType.toLowerCase()} ${NAMESPACE}.${f.key}`);
    } else {
      console.log(`ok       ${ownerType.toLowerCase()} ${NAMESPACE}.${f.key}`);
    }
  }
}

await define("PRODUCT", PRODUCT_FIELDS);
await define("COLLECTION", COLLECTION_FIELDS);
