export interface Money {
  amount: string;
  currencyCode: string;
}

export interface CatalogImage {
  url: string;
  altText: string;
  width: number;
  height: number;
}

export interface SelectedOption {
  name: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  title: string;
  availableForSale: boolean;
  price: Money;
  selectedOptions: SelectedOption[];
}

export interface ProductOption {
  id: string;
  name: string;
  values: string[];
}

/** A product's 3D model (Shopify custom fields `model_3d`, `model_3d_hd`, `model_3d_showroom`, `model_3d_view`). */
export interface Model3D {
  /** Light GLB: phones, the showroom and the 3D viewer. */
  src: string;
  /** Detailed GLB for the product page on a big screen with a mouse. */
  hd?: string | null;
  /** GLB for the home showroom, when it differs from `src`. */
  showroom?: string | null;
  /** Size of the model's longest side, in scene units. */
  fit?: number;
  /** Resting turn in degrees (0 = the front faces the camera). */
  yaw?: number;
}

export interface Product {
  id: string;
  handle: string;
  title: string;
  description: string;
  /** The product's category ("Hoodie", "Tee"...): Shopify's product type. */
  productType: string;
  availableForSale: boolean;
  /** The garment on its own, first angle. This is what cards show by default. */
  featuredImage: CatalogImage;
  /** The garment on a model, shown when a card is hovered (custom field `on_model_image`). */
  hoverImage?: CatalogImage | null;
  /** The product's images in their Shopify order (then the on-model shot, if it is not one of them); cards turn them into a carousel. */
  images: CatalogImage[];
  options: ProductOption[];
  variants: ProductVariant[];
  price: Money;
  model3d?: Model3D | null;
  /** Handles of the collections this product belongs to. */
  collections: string[];
  tags: string[];
}

export type TileTheme = "cream" | "dark" | "sand";

/** How a collection looks on its home page tile (custom fields `tile_*`). */
export interface CollectionTile {
  /** One entry per row of the big title. */
  title: string[];
  /** The tile's own photo (custom field `tile_image`); without one the tile shows a product. */
  image: CatalogImage | null;
  /** Optional second photo: the tile becomes a two-photo composition. */
  secondaryImage?: CatalogImage | null;
  theme?: TileTheme | null;
}

export interface Collection {
  handle: string;
  title: string;
  description: string;
  /** Name in the navigation and on the tile label (custom field `short_title`). */
  shortTitle?: string | null;
  /** Order in the navigation and on the home page, lowest first (custom field `position`). */
  position?: number | null;
  /** The collection's own image in Shopify. */
  image?: CatalogImage | null;
  tile?: CollectionTile | null;
}
