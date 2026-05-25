// app/services/loyaltyPageSetup.server.ts

const BLOCK_TYPE = `shopify://apps/loyalty-program/blocks/loyalty-widget/d352f77e-1a84-6673-24f2-305e8d76a5518030e602`;
const TEMPLATE_SUFFIX = "loyalty";
const PAGE_TITLE = "Loyalty Rewards";
const APP_URL = process.env.SHOPIFY_APP_URL || "";

function buildTemplateJson(): string {
  const blockId = "loyalty-widget-main";
  return JSON.stringify({
    sections: {
      [blockId]: {
        type: BLOCK_TYPE,
        settings: {},
      },
    },
    order: [blockId],
  }, null, 2);
}

export async function setupLoyaltyPage(admin: any): Promise<void> {
  try {
    const shopGid = await getShopGid(admin);

    await writeAppUrlMetafield(admin, shopGid);
    await createPageAndTemplate(admin, shopGid);

    console.log("[loyaltyPageSetup] ✅ Setup complete");
  } catch (err) {
    console.error("[loyaltyPageSetup] Error during setup:", err);
  }
}

// ── Write loyalty.app_url on Shop ────────────────────────────────────────────
async function writeAppUrlMetafield(admin: any, shopGid: string): Promise<void> {
  const res = await admin.graphql(`
    mutation SetAppUrl($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
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

  const data = await res.json();
  const errors = data.data?.metafieldsSet?.userErrors ?? [];
  if (errors.length) {
    console.error("[loyaltyPageSetup] app_url metafield errors:", errors);
  } else {
    console.log(`[loyaltyPageSetup] Wrote loyalty.app_url = ${APP_URL}`);
  }
}

// ── Get Shop GID ─────────────────────────────────────────────────────────────
async function getShopGid(admin: any): Promise<string> {
  const res = await admin.graphql(`query { shop { id } }`);
  const data = await res.json();
  return data.data.shop.id;
}

// ── Create page + theme template via GraphQL ─────────────────────────────────
async function createPageAndTemplate(admin: any, shopGid: string): Promise<void> {
  // 1. Get active theme ID
  const themeRes = await admin.graphql(`
    query {
      themes(first: 10) {
        nodes { id role }
      }
    }
  `);
  const themeData = await themeRes.json();
  const themes = themeData.data?.themes?.nodes ?? [];
  const activeTheme = themes.find((t: any) => t.role === "MAIN");

  if (!activeTheme) {
    console.error("[loyaltyPageSetup] No active theme found");
    return;
  }

  const themeId = activeTheme.id; // GID format: gid://shopify/OnlineStoreTheme/123

  // 2. Check if template asset already exists
  const assetKey = `templates/page.${TEMPLATE_SUFFIX}.json`;

  const assetCheckRes = await admin.graphql(`
  query GetThemeFile($themeId: ID!, $filename: String!) {
    theme(id: $themeId) {
      files(filenames: [$filename], first: 1) {
        nodes {
          filename
        }
      }
    }
  }
`, {
  variables: {
    themeId,
    filename: assetKey,
  },
});

  const assetCheckData = await assetCheckRes.json();
  const existingAsset =
  assetCheckData.data?.theme?.files?.nodes?.[0];

  if (!existingAsset) {
    // 3. Create the template asset
    const createAssetRes = await admin.graphql(`
      mutation CreateThemeAsset($themeId: ID!, $key: String!, $value: String!) {
        themeFilesUpsert(themeId: $themeId, files: [{ filename: $key, body: { type: TEXT, value: $value } }]) {
          upsertedThemeFiles { filename }
          userErrors { filename message }
        }
      }
    `, {
      variables: {
        themeId,
        key: assetKey,
        value: buildTemplateJson(),
      },
    });

    const assetData = await createAssetRes.json();
    const assetErrors = assetData.data?.themeFilesUpsert?.userErrors ?? [];
    if (assetErrors.length) {
      console.error("[loyaltyPageSetup] Theme asset errors:", assetErrors);
    } else {
      console.log(`[loyaltyPageSetup] Created theme asset: ${assetKey}`);
    }
  } else {
    console.log("[loyaltyPageSetup] Template asset already exists, skipping");
  }

  // 4. Check if the Loyalty Rewards page already exists
  const pageCheckRes = await admin.graphql(`
    query FindLoyaltyPage {
      pages(first: 5, query: "title:'Loyalty Rewards'") {
        nodes { id title templateSuffix }
      }
    }
  `);

  const pageCheckData = await pageCheckRes.json();
  const pages = pageCheckData.data?.pages?.nodes ?? [];
  const existingPage = pages.find((p: any) => p.title === PAGE_TITLE);

  if (existingPage) {
    if (existingPage.templateSuffix !== TEMPLATE_SUFFIX) {
      await admin.graphql(`
        mutation UpdatePage($id: ID!, $suffix: String!) {
          pageUpdate(id: $id, page: { templateSuffix: $suffix }) {
            userErrors { field message }
          }
        }
      `, { variables: { id: existingPage.id, suffix: TEMPLATE_SUFFIX } });
      console.log("[loyaltyPageSetup] Updated page templateSuffix");
    } else {
      console.log("[loyaltyPageSetup] Page already correct, skipping");
    }
    return;
  }

  // 5. Create the page
  const createPageRes = await admin.graphql(`
    mutation CreatePage($title: String!, $suffix: String!) {
      pageCreate(page: { title: $title, templateSuffix: $suffix, isPublished: true }) {
        page { id title handle }
        userErrors { field message }
      }
    }
  `, {
    variables: {
      title: PAGE_TITLE,
      suffix: TEMPLATE_SUFFIX,
    },
  });

  const pageData = await createPageRes.json();
  const pageErrors = pageData.data?.pageCreate?.userErrors ?? [];
  if (pageErrors.length) {
    console.error("[loyaltyPageSetup] Page create errors:", pageErrors);
  } else {
    const handle = pageData.data?.pageCreate?.page?.handle;
    console.log(`[loyaltyPageSetup] Created page: "${PAGE_TITLE}" → /pages/${handle}`);
  }
}
