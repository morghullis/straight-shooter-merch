// The storefront's custom fields in Shopify: the single source for define-metafields.mjs, the
// generator and the importer. The storefront reads the same keys (src/lib/catalog/shopify.ts).

export const NAMESPACE = "custom";

const images = [{ name: "file_type_options", value: JSON.stringify(["Image"]) }];

export const PRODUCT_FIELDS = {
  turntable: { key: "turntable", name: "Turntable renders", type: "list.file_reference", validations: images, storefront: true,
    description: "The product's 3D model shot from every angle on sand, in carousel order. Cards and the product gallery show these." },
  onModel: { key: "on_model_image", name: "On-model photo", type: "file_reference", validations: images, storefront: true,
    description: "The product worn or held by a model. Shown when a card is hovered, and last in the gallery." },
  model: { key: "model_3d", name: "3D model (web)", type: "file_reference", storefront: true,
    description: "Light GLB for phones and the 3D viewer." },
  modelHd: { key: "model_3d_hd", name: "3D model (detail)", type: "file_reference", storefront: true,
    description: "Detailed GLB for the product page on a big screen." },
  modelShowroom: { key: "model_3d_showroom", name: "3D model (showroom)", type: "file_reference", storefront: true,
    description: "Optional GLB for the home showroom (defaults to the web model)." },
  view: { key: "model_3d_view", name: "3D framing", type: "json", storefront: true,
    description: 'How the model sits on the stage: {"fit": 2.35, "yaw": 0} (yaw in degrees, 0 = front faces the camera).' },
  pipeline: { key: "asset_pipeline", name: "Asset pipeline", type: "json", storefront: false,
    description: "Written by the asset pipeline: state, attempts, last error. Delete it to make the pipeline run again." },

  // The product page's information (src/components/product/ProductInfo.tsx). Pinned, so every
  // product's admin page shows them; each block appears on the site only once its field is filled in.
  tagline: { key: "tagline", name: "Tagline", type: "single_line_text_field", storefront: true, pin: true,
    description: "Short line under the product name on the site, e.g. That's just BLASPHEMOUS!" },
  highlights: { key: "highlights", name: "Highlights", type: "list.single_line_text_field", storefront: true, pin: true,
    description: "Key points shown under the Add to cart button, one per entry." },
  material: { key: "material", name: "Material", type: "single_line_text_field", storefront: true, pin: true,
    description: "e.g. 100% ring-spun cotton, 180 gsm. Shown in Details." },
  fit: { key: "fit", name: "Fit", type: "single_line_text_field", storefront: true, pin: true,
    description: "How it fits, e.g. Unisex, true to size; size up for a relaxed fit. Shown in Details." },
  care: { key: "care", name: "Care", type: "multi_line_text_field", storefront: true, pin: true,
    description: "Care instructions, one per line. Shown in Care." },
  sizeChart: { key: "size_chart", name: "Size chart", type: "file_reference", validations: images, storefront: true, pin: true,
    description: "Picture of the size table. Shown in Size guide." },
  shippingNote: { key: "shipping_note", name: "Shipping note", type: "single_line_text_field", storefront: true, pin: true,
    description: "This product's own shipping line, e.g. Made to order, ships in 3 to 5 business days. Shown first in Shipping & returns." },
};

/** Store-wide (owner: the shop). */
export const SHOP_FIELDS = {
  discountStickers: { key: "discount_stickers", name: "Discount stickers", type: "json", storefront: true,
    description: "Written by the asset pipeline: the sticker of each discount, by name. Remove an entry to have it made again." },
};

export const COLLECTION_FIELDS = {
  shortTitle: { key: "short_title", name: "Short title", type: "single_line_text_field", storefront: true,
    description: "Name in the navigation and on the home tile label (defaults to the title)." },
  tileTitle: { key: "tile_title", name: "Home tile title", type: "multi_line_text_field", storefront: true,
    description: "Title on the collection's home tile, one line per row (defaults to the title, split in two)." },
  tileImage: { key: "tile_image", name: "Home tile photo", type: "file_reference", validations: images, storefront: true,
    description: "Photo on the collection's home tile (defaults to the collection image)." },
  tileImageSecondary: { key: "tile_image_secondary", name: "Home tile second photo", type: "file_reference", validations: images, storefront: true,
    description: "Optional second photo; the tile becomes a two-photo composition." },
  tileTheme: { key: "tile_theme", name: "Home tile colour", type: "single_line_text_field", storefront: true,
    validations: [{ name: "choices", value: JSON.stringify(["cream", "dark", "sand"]) }],
    description: "cream, dark or sand." },
  position: { key: "position", name: "Position", type: "number_integer", storefront: true,
    description: "Order in the navigation and on the home page (lowest first)." },

  // The bar above the navigation and the home hero. Pinned: they show on every collection's admin page.
  announcement: { key: "announcement", name: "Top bar messages", type: "list.single_line_text_field", storefront: true, pin: true,
    description: "Messages for the bar above the navigation, linking to this collection. {discount} becomes its current discount (10% off); without one that message hides." },
  heroImage: { key: "hero_image", name: "Hero slide photo", type: "file_reference", validations: images, storefront: true, pin: true,
    description: "Wide photo without text (2:1 or wider). The collection gets its own slide in the home hero when this is filled in." },
  heroImageMobile: { key: "hero_image_mobile", name: "Hero slide photo (phones)", type: "file_reference", validations: images, storefront: true, pin: true,
    description: "Optional square or tall photo for phones. Without it the wide photo is cropped to its centre." },
  heroTitle: { key: "hero_title", name: "Hero slide title", type: "multi_line_text_field", storefront: true, pin: true,
    description: "Title of the slide, one line per row (up to 3); the last one is gold. Defaults to the collection's title." },
  heroKicker: { key: "hero_kicker", name: "Hero slide label", type: "single_line_text_field", storefront: true, pin: true,
    description: "Small line above the title. Defaults to the short title." },
  heroCta: { key: "hero_cta", name: "Hero slide button", type: "single_line_text_field", storefront: true, pin: true,
    description: "Text of the slide's button. Defaults to Shop the collection." },
};
