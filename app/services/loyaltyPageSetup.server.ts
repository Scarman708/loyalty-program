// app/services/loyaltyPageSetup.server.ts
// Runs on afterAuth — creates the Loyalty Rewards page + template + writes app_url metafield

const BLOCK_TYPE = `shopify://apps/loyalty-program/blocks/loyalty-widget/d352f77e-1a84-6673-24f2-305e8d76a5518030e602`;
const TEMPLATE_SUFFIX = "loyalty";
const PAGE_TITLE = "Loyalty Rewards";
const APP_URL = process.env.SHOPIFY_APP_URL || "";

function buildTemplateJson(): string {
  const blockId = "loyalty-widget-main";
  return JSON.stringify(
    {
      sections: {
        [blockId]: {
          type: BLOCK_TYPE,
          settings: {},
        },
      },
      order: [blockId],
    },
    null,
    2
  );
}

export async function setupLoyaltyPage(admin: any): Promise<void> {
  try {
    await writeAppUrlMetafield(admin);

    const themeId = await getActiveThemeId(admin);
    if (!themeId) {
      console.error("[loyaltyPageSetup] Could not find active theme");
      return;
    }

    await createPageTemplate(admin, themeId);
    await createLoyaltyPage(admin);

    console.log("[loyaltyPageSetup] ✅ Setup complete");
  } catch (err) {
    console.error("[loyaltyPageSetup] Error during setup:", err);
  }
}

async function writeAppUrlMetafield(admin: any): Promise<void> {
  const shopGid = await getShopGid(admin);

  const response = await admin.graphql(`
    mutation SetAppUrlMetafield($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id key namespace value }
        userErrors { field message }
      }
    }
  `, {
    variables: {
      metafields: [{
        namespace: "loyalty",
        key: "app_url",
        type: "single_line_text_field",
        value: APP_URL,
        ownerId: shopGid,
      }],
    },
  });

  const data = await response.json();
  const errors = data.data?.metafieldsSet?.userErrors ?? [];
  if (errors.length) {
    console.error("[loyaltyPageSetup] Metafield errors:", errors);
  } else {
    console.log(`[loyaltyPageSetup] Wrote loyalty.app_url = ${APP_URL}`);
  }
}

async function getShopGid(admin: any): Promise<string> {
  const response = await admin.graphql(`query { shop { id } }`);
  const data = await response.json();
  return data.data.shop.id;
}

async function getActiveThemeId(admin: any): Promise<string | null> {
  const response = await admin.rest.get({ path: "themes" });
  const themes: any[] = response.data?.themes ?? [];
  const active = themes.find((t: any) => t.role === "main");
  return active ? String(active.id) : null;
}

async function createPageTemplate(admin: any, themeId: string): Promise<void> {
  const assetKey = `templates/page.${TEMPLATE_SUFFIX}.json`;

  try {
    await admin.rest.get({
      path: `themes/${themeId}/assets`,
      query: { "asset[key]": assetKey },
    });
    console.log("[loyaltyPageSetup] Template asset already exists, skipping");
    return;
  } catch {
    // doesn't exist — create it
  }

  await admin.rest.put({
    path: `themes/${themeId}/assets`,
    data: {
      asset: {
        key: assetKey,
        value: buildTemplateJson(),
      },
    },
  });

  console.log(`[loyaltyPageSetup] Created theme asset: ${assetKey}`);
}

async function createLoyaltyPage(admin: any): Promise<void> {
  const listResponse = await admin.rest.get({
    path: "pages",
    query: { title: PAGE_TITLE },
  });

  const pages: any[] = listResponse.data?.pages ?? [];
  const existing = pages.find((p: any) => p.title === PAGE_TITLE);

  if (existing) {
    if (existing.template_suffix !== TEMPLATE_SUFFIX) {
      await admin.rest.put({
        path: `pages/${existing.id}`,
        data: { page: { id: existing.id, template_suffix: TEMPLATE_SUFFIX } },
      });
      console.log("[loyaltyPageSetup] Updated existing page template_suffix");
    } else {
      console.log("[loyaltyPageSetup] Page already correct, skipping");
    }
    return;
  }

  await admin.rest.post({
    path: "pages",
    data: {
      page: {
        title: PAGE_TITLE,
        body_html: "",
        template_suffix: TEMPLATE_SUFFIX,
        published: true,
      },
    },
  });

  console.log(`[loyaltyPageSetup] Created page: "${PAGE_TITLE}"`);
}