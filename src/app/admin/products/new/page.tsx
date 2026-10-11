import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/guards";
import { productEditorChoices } from "@/lib/catalog/admin-choices";
import { absoluteUrl } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { ProductEditor, type EditorProduct } from "@/components/admin/product-editor";
import { parsePreview3d } from "@/lib/candle3d/config";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireStaffPage("products:manage", "/admin/products/new");
  const [choices, commerce] = await Promise.all([productEditorChoices(), getSettings("commerce")]);
  const initial: EditorProduct = {
    name: "",
    slug: "",
    shortDescription: "",
    description: "",
    status: "DRAFT",
    pricingType: "FIXED",
    isFeatured: false,
    isBestseller: false,
    isLimitedEdition: false,
    trackInventory: true,
    allowBackorder: false,
    madeToOrder: false,
    allowInquiry: true,
    lowStockThreshold: null,
    prepTimeMinDays: null,
    prepTimeMaxDays: null,
    maxPerOrder: null,
    saleStartsAt: null,
    saleEndsAt: null,
    seoTitle: "",
    seoDescription: "",
    options: [],
    variants: [{ option1: null, option2: null, option3: null, sku: "", price: "", salePrice: "", costPrice: "", stock: 0, isActive: true }],
    personalizationFields: [],
    images: [],
    categoryIds: [],
    collectionIds: [],
    tagIds: [],
    preview3d: parsePreview3d(null),
  };
  return (
    <div>
      <AdminPageHeader back={{ href: "/admin/products", label: "Products" }} title="New product" description="Saved as a draft until you set it to Active." />
      <ProductEditor initial={initial} choices={{ ...choices, currencyCode: commerce.currencyCode, storeUrl: absoluteUrl("/") }} />
    </div>
  );
}
