import { CACHE_TTL } from '@config/app-constants';

/**
 * Cache key generation strategies
 */
export class CacheKeyGenerator {
  /**
   * Generate cache key for products list
   */
  static productsList(filters?: Record<string, unknown>): string {
    if (!filters || Object.keys(filters).length === 0) {
      return 'products:all';
    }

    const sortedFilters = Object.keys(filters)
      .sort()
      .map((key) => `${key}:${filters[key]}`)
      .join(':');

    return `products:list:${sortedFilters}`;
  }

  /**
   * Generate cache key for single product
   */
  static product(id: string): string {
    return `product:${id}`;
  }

  /**
   * Generate cache key for product by slug
   */
  static productBySlug(slug: string): string {
    return `product:slug:${slug}`;
  }

  /**
   * Generate cache key for categories
   */
  static categoriesList(filters?: Record<string, unknown>): string {
    if (!filters || Object.keys(filters).length === 0) {
      return 'categories:all';
    }

    const sortedFilters = Object.keys(filters)
      .sort()
      .map((key) => `${key}:${filters[key]}`)
      .join(':');

    return `categories:list:${sortedFilters}`;
  }

  /**
   * Generate cache key for single category
   */
  static category(id: string): string {
    return `category:${id}`;
  }

  /**
   * Generate cache key for category tree
   */
  static categoryTree(): string {
    return 'categories:tree';
  }

  /**
   * Generate cache key for brands
   */
  static brandsList(): string {
    return 'brands:all';
  }

  /**
   * Generate cache key for single brand
   */
  static brand(id: string): string {
    return `brand:${id}`;
  }

  /**
   * Generate cache key for settings
   */
  static settings(): string {
    return 'settings:all';
  }

  /**
   * Generate cache key for user
   */
  static user(id: string): string {
    return `user:${id}`;
  }

  /**
   * Generate cache key for vendor
   */
  static vendor(id: string): string {
    return `vendor:${id}`;
  }

  // Phase 1: High Priority Services

  /**
   * Generate cache key for attributes list
   */
  static attributesList(): string {
    return 'attributes:all';
  }

  /**
   * Generate cache key for single attribute
   */
  static attribute(id: string): string {
    return `attribute:${id}`;
  }

  /**
   * Generate cache key for sub-categories list
   */
  static subCategoriesList(filters?: Record<string, unknown>): string {
    if (!filters || Object.keys(filters).length === 0) {
      return 'sub-categories:all';
    }
    const sortedFilters = Object.keys(filters)
      .sort()
      .map((key) => `${key}:${filters[key]}`)
      .join(':');
    return `sub-categories:list:${sortedFilters}`;
  }

  /**
   * Generate cache key for single sub-category
   */
  static subCategory(id: string): string {
    return `sub-category:${id}`;
  }

  /**
   * Generate cache key for child-categories list
   */
  static childCategoriesList(filters?: Record<string, unknown>): string {
    if (!filters || Object.keys(filters).length === 0) {
      return 'child-categories:all';
    }
    const sortedFilters = Object.keys(filters)
      .sort()
      .map((key) => `${key}:${filters[key]}`)
      .join(':');
    return `child-categories:list:${sortedFilters}`;
  }

  /**
   * Generate cache key for single child-category
   */
  static childCategory(id: string): string {
    return `child-category:${id}`;
  }

  /**
   * Generate cache key for pages list
   */
  static pagesList(filters?: Record<string, unknown>): string {
    if (!filters || Object.keys(filters).length === 0) {
      return 'pages:all';
    }
    const sortedFilters = Object.keys(filters)
      .sort()
      .map((key) => `${key}:${filters[key]}`)
      .join(':');
    return `pages:list:${sortedFilters}`;
  }

  /**
   * Generate cache key for single page
   */
  static page(id: string): string {
    return `page:${id}`;
  }

  /**
   * Generate cache key for page by slug
   */
  static pageBySlug(slug: string): string {
    return `page:slug:${slug}`;
  }

  /**
   * Generate cache key for banners list
   */
  static bannersList(): string {
    return 'banners:all';
  }

  /**
   * Generate cache key for single banner
   */
  static banner(id: string): string {
    return `banner:${id}`;
  }

  /**
   * Generate cache key for campaigns list
   */
  static campaignsList(filters?: Record<string, unknown>): string {
    if (!filters || Object.keys(filters).length === 0) {
      return 'campaigns:all';
    }
    const sortedFilters = Object.keys(filters)
      .sort()
      .map((key) => `${key}:${filters[key]}`)
      .join(':');
    return `campaigns:list:${sortedFilters}`;
  }

  /**
   * Generate cache key for single campaign
   */
  static campaign(id: string): string {
    return `campaign:${id}`;
  }

  // Phase 2: Medium Priority Services

  /**
   * Generate cache key for payment methods list
   */
  static paymentMethodsList(): string {
    return 'payment-methods:all';
  }

  /**
   * Generate cache key for enabled payment methods (public)
   */
  static paymentMethodsEnabled(): string {
    return 'payment-methods:enabled';
  }

  /**
   * Generate cache key for reviews list
   */
  static reviewsList(filters?: Record<string, unknown>): string {
    if (!filters || Object.keys(filters).length === 0) {
      return 'reviews:all';
    }
    const sortedFilters = Object.keys(filters)
      .sort()
      .map((key) => `${key}:${filters[key]}`)
      .join(':');
    return `reviews:list:${sortedFilters}`;
  }

  /**
   * Generate cache key for questions list
   */
  static questionsList(filters?: Record<string, unknown>): string {
    if (!filters || Object.keys(filters).length === 0) {
      return 'questions:all';
    }
    const sortedFilters = Object.keys(filters)
      .sort()
      .map((key) => `${key}:${filters[key]}`)
      .join(':');
    return `questions:list:${sortedFilters}`;
  }

  /**
   * Generate cache key for discounts/coupons list
   */
  static discountsList(filters?: Record<string, unknown>): string {
    if (!filters || Object.keys(filters).length === 0) {
      return 'discounts:all';
    }
    const sortedFilters = Object.keys(filters)
      .sort()
      .map((key) => `${key}:${filters[key]}`)
      .join(':');
    return `discounts:list:${sortedFilters}`;
  }

  /**
   * Generate cache key for valid coupons
   */
  static discountsValid(): string {
    return 'discounts:valid';
  }

  /**
   * Generate cache key for public coupons
   */
  static discountsPublic(): string {
    return 'discounts:public';
  }

  /**
   * Generate cache key for reports
   */
  static reports(type: string, filters?: Record<string, unknown>): string {
    if (!filters || Object.keys(filters).length === 0) {
      return `reports:${type}:all`;
    }
    const sortedFilters = Object.keys(filters)
      .sort()
      .map((key) => `${key}:${filters[key]}`)
      .join(':');
    return `reports:${type}:${sortedFilters}`;
  }

  /**
   * Generate cache key for shipping zones
   */
  static shippingZones(): string {
    return 'shipping:zones:all';
  }

  /**
   * Generate cache key for shipping methods
   */
  static shippingMethods(): string {
    return 'shipping:methods:all';
  }

  /**
   * Generate cache key for available shipping methods
   */
  static availableMethods(addressId: string, subtotal: number): string {
    return `shipping:available:${addressId}:${subtotal}`;
  }

  /**
   * Generate cache key for exchange rates
   */
  static exchangeRates(): string {
    return 'exchange-rates:all';
  }
}

/**
 * Cache invalidation patterns
 */
export class CacheInvalidation {
  /**
   * Get patterns to invalidate when product is created/updated
   */
  static product(productId?: string): string[] {
    const patterns = [
      'products:*',
      'categories:*', // Category counts may change
    ];

    if (productId) {
      patterns.push(`product:${productId}`);
      patterns.push(`product:slug:*`); // Invalidate slug-based cache
    }

    return patterns;
  }

  /**
   * Get patterns to invalidate when category is created/updated
   */
  static category(categoryId?: string): string[] {
    const patterns = [
      'categories:*',
      'products:*', // Products list may include category info
    ];

    if (categoryId) {
      patterns.push(`category:${categoryId}`);
    }

    return patterns;
  }

  /**
   * Get patterns to invalidate when brand is created/updated
   */
  static brand(brandId?: string): string[] {
    const patterns = [
      'brands:*',
      'products:*', // Products list may include brand info
    ];

    if (brandId) {
      patterns.push(`brand:${brandId}`);
    }

    return patterns;
  }

  /**
   * Get patterns to invalidate when settings are updated
   */
  static settings(): string[] {
    return ['settings:*'];
  }

  /**
   * Get patterns to invalidate when user is updated
   */
  static user(userId: string): string[] {
    return [`user:${userId}`];
  }

  /**
   * Invalidate all cache
   */
  static all(): string[] {
    return ['*'];
  }

  // Phase 1: High Priority Services

  /**
   * Get patterns to invalidate when attribute is created/updated
   */
  static attribute(attributeId?: string): string[] {
    const patterns = [
      'attributes:*',
      'products:*', // Products may include attribute info
    ];
    if (attributeId) {
      patterns.push(`attribute:${attributeId}`);
    }
    return patterns;
  }

  /**
   * Get patterns to invalidate when sub-category is created/updated
   */
  static subCategory(subCategoryId?: string): string[] {
    const patterns = [
      'sub-categories:*',
      'categories:*', // Parent categories may include sub-category info
      'products:*',
    ];
    if (subCategoryId) {
      patterns.push(`sub-category:${subCategoryId}`);
    }
    return patterns;
  }

  /**
   * Get patterns to invalidate when child-category is created/updated
   */
  static childCategory(childCategoryId?: string): string[] {
    const patterns = ['child-categories:*', 'sub-categories:*', 'categories:*', 'products:*'];
    if (childCategoryId) {
      patterns.push(`child-category:${childCategoryId}`);
    }
    return patterns;
  }

  /**
   * Get patterns to invalidate when page is created/updated
   */
  static page(pageId?: string): string[] {
    const patterns = ['pages:*'];
    if (pageId) {
      patterns.push(`page:${pageId}`);
      patterns.push(`page:slug:*`);
    }
    return patterns;
  }

  /**
   * Get patterns to invalidate when banner is created/updated
   */
  static banner(bannerId?: string): string[] {
    const patterns = ['banners:*'];
    if (bannerId) {
      patterns.push(`banner:${bannerId}`);
    }
    return patterns;
  }

  /**
   * Get patterns to invalidate when campaign is created/updated
   */
  static campaign(campaignId?: string): string[] {
    const patterns = [
      'campaigns:*',
      'products:*', // Campaigns may affect product display
    ];
    if (campaignId) {
      patterns.push(`campaign:${campaignId}`);
    }
    return patterns;
  }

  // Phase 2: Medium Priority Services

  /**
   * Get patterns to invalidate when payment method is created/updated
   */
  static paymentMethod(): string[] {
    return ['payment-methods:*'];
  }

  /**
   * Get patterns to invalidate when review is created/updated
   */
  static review(productId?: string): string[] {
    const patterns = ['reviews:*'];
    if (productId) {
      patterns.push(`product:${productId}`);
    }
    return patterns;
  }

  /**
   * Get patterns to invalidate when question is created/updated
   */
  static question(productId?: string): string[] {
    const patterns = ['questions:*'];
    if (productId) {
      patterns.push(`product:${productId}`);
    }
    return patterns;
  }

  /**
   * Get patterns to invalidate when discount/coupon is created/updated
   */
  static discount(): string[] {
    return ['discounts:*'];
  }

  /**
   * Get patterns to invalidate when vendor is updated
   */
  static vendor(vendorId: string): string[] {
    return [`vendor:${vendorId}`, 'vendors:*'];
  }

  /**
   * Get patterns to invalidate when shipping data is updated
   */
  static shipping(): string[] {
    return ['shipping:*'];
  }

  /**
   * Get patterns to invalidate when reports should be refreshed
   */
  static reports(): string[] {
    return ['reports:*'];
  }
}

/**
 * Cache TTL strategies
 */
export class CacheTTL {
  /**
   * Get TTL for products
   */
  static products(): number {
    return CACHE_TTL.PRODUCTS; // 5 minutes
  }

  /**
   * Get TTL for categories
   */
  static categories(): number {
    return CACHE_TTL.CATEGORIES; // 10 minutes
  }

  /**
   * Get TTL for settings
   */
  static settings(): number {
    return CACHE_TTL.SETTINGS; // 1 hour
  }

  /**
   * Get TTL for user session
   */
  static userSession(): number {
    return CACHE_TTL.USER_SESSION; // 24 hours
  }

  /**
   * Get short TTL for frequently changing data
   */
  static short(): number {
    return 60; // 1 minute
  }

  /**
   * Get medium TTL
   */
  static medium(): number {
    return 300; // 5 minutes
  }

  /**
   * Get long TTL for rarely changing data
   */
  static long(): number {
    return 3600; // 1 hour
  }

  /**
   * Get TTL for reports
   */
  static reports(): number {
    return CACHE_TTL.REPORTS;
  }

  /**
   * Get TTL for vendors
   */
  static vendors(): number {
    return CACHE_TTL.VENDORS;
  }

  /**
   * Get TTL for shipping
   */
  static shipping(): number {
    return CACHE_TTL.SHIPPING;
  }

  /**
   * Get TTL for exchange rates
   */
  static exchangeRates(): number {
    return CACHE_TTL.EXCHANGE_RATES;
  }
}
