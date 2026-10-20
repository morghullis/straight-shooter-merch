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

export interface Product {
  id: string;
  handle: string;
  title: string;
  description: string;
  availableForSale: boolean;
  /** The garment on its own, first angle. This is what cards show by default. */
  featuredImage: CatalogImage;
  /** The garment on a model, shown when a card is hovered (metafield `custom.on_model_image`). */
  hoverImage?: CatalogImage | null;
  /** Every product image in order; cards turn them into a carousel of angles. */
  images: CatalogImage[];
  options: ProductOption[];
  variants: ProductVariant[];
  price: Money;
  /** URL of a GLB for the 3D viewer (Shopify Model3d media), when the product has one. */
  model?: string | null;
  /** Handles of the collections this product belongs to. */
  collections: string[];
  tags: string[];
}

export interface Collection {
  handle: string;
  title: string;
  description: string;
}
