export interface PricingItem {
    label: string;
    total: number;
    formula?: string;
}

export interface PricingQuote {
    unitPrice: number;
    grandTotal: number;
    breakdown: PricingItem[];
    printTotal?: number;
    routerFee?: number;
    isMinApplied?: boolean;
}

// Dummy export to prevent the bundler from throwing a 404 on pure-type files
export const _PRICING_TYPES_LOADED = true;