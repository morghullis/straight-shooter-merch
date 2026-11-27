// Creates (or updates) the storefront's custom field definitions in Shopify. Safe to run again.
//
//   node define-metafields.mjs
import { loadEnvFile } from "./lib/env.mjs";
import { check, gql } from "./lib/shopify.mjs";
import { COLLECTION_FIELDS, METAOBJECTS, NAMESPACE, PRODUCT_FIELDS, SHOP_FIELDS } from "./lib/schema.mjs";

loadEnvFile();

async function existing(ownerType) {
  const data = await gql(
    `query($o: MetafieldOwnerType!, $ns: String!) {
      metafieldDefinitions(first: 100, ownerType: $o, namespace: $ns) { nodes { id key pinnedPosition access { storefront } } }
    }`,
    { o: ownerType, ns: NAMESPACE },
  );
  return new Map(data.metafieldDefinitions.nodes.map((d) => [d.key, d]));
}

async function define(ownerType, fields) {
  const have = await existing(ownerType);
  for (const f of Object.values(fields)) {
    // A metaobject field points at its definition, made above.
    const validations = f.metaobject
      ? [{ name: "metaobject_definition_id", value: (await metaobjectDefinition(f.metaobject)).id }]
      : (f.validations ?? []);
    const storefront = f.storefront ? "PUBLIC_READ" : "NONE";
    const current = have.get(f.key);
    if (!current) {
      const data = await gql(
        `mutation($d: MetafieldDefinitionInput!) { metafieldDefinitionCreate(definition: $d) { createdDefinition { id } userErrors { field message } } }`,
        { d: { name: f.name, namespace: NAMESPACE, key: f.key, type: f.type, ownerType, description: f.description, validations, access: { storefront } } },
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

  // Pinned fields show on every owner's admin page (each product), in this order.
  const after = await existing(ownerType);
  for (const f of Object.values(fields)) {
    const d = after.get(f.key);
    if (!f.pin || !d || d.pinnedPosition != null) continue;
    const data = await gql(
      `mutation($id: ID!) { metafieldDefinitionPin(definitionId: $id) { pinnedDefinition { id } userErrors { field message } } }`,
      { id: d.id },
    );
    check(data.metafieldDefinitionPin, `pin ${ownerType} ${f.key}`);
    console.log(`pinned   ${ownerType.toLowerCase()} ${NAMESPACE}.${f.key}`);
  }
}

async function metaobjectDefinition(type) {
  const data = await gql(`query($t: String!) { metaobjectDefinitionByType(type: $t) { id access { storefront } } }`, { t: type });
  return data.metaobjectDefinitionByType;
}

// Metaobjects first: product fields can point at them.
for (const m of Object.values(METAOBJECTS)) {
  const current = await metaobjectDefinition(m.type);
  if (current) {
    const storefront = m.storefront ? "PUBLIC_READ" : "NONE";
    if (current.access.storefront !== storefront) {
      const data = await gql(`mutation($id: ID!, $d: MetaobjectDefinitionUpdateInput!) { metaobjectDefinitionUpdate(id: $id, definition: $d) { userErrors { field message } } }`, { id: current.id, d: { access: { storefront } } });
      check(data.metaobjectDefinitionUpdate, `update metaobject ${m.type}`);
      console.log(`updated  metaobject ${m.type}: storefront ${storefront}`);
    } else console.log(`ok       metaobject ${m.type}`);
    continue;
  }
  const data = await gql(
    `mutation($d: MetaobjectDefinitionCreateInput!) { metaobjectDefinitionCreate(definition: $d) { metaobjectDefinition { id } userErrors { field message } } }`,
    {
      d: {
        type: m.type, name: m.name, description: m.description, displayNameKey: m.displayNameKey,
        access: { storefront: m.storefront ? "PUBLIC_READ" : "NONE" }, capabilities: { publishable: { enabled: true } },
        fieldDefinitions: m.fields.map((f) => ({ required: false, ...f })),
      },
    },
  );
  check(data.metaobjectDefinitionCreate, `define metaobject ${m.type}`);
  console.log(`created  metaobject ${m.type}`);
}

await define("PRODUCT", PRODUCT_FIELDS);
await define("COLLECTION", COLLECTION_FIELDS);
await define("SHOP", SHOP_FIELDS);
