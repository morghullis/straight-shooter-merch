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
};
