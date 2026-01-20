/**
 * Tool Definitions for Ollama Function Calling
 * These JSON schemas map to existing API functions in the codebase
 */

const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "get_sales_data",
      description: "Get sales data from std_orders table. Returns purchase dates, SKUs, quantities, total sales, product names, categories, cities, states, and AOV (Average Order Value). Supports filtering by SKU, product name, category, city, state, country, platform, and date ranges.",
      parameters: {
        type: "object",
        properties: {
          filterType: {
            type: "string",
            enum: ["currentmonth", "previousmonth", "currentyear", "lastyear"],
            description: "Date filter type. 'currentmonth' = current month, 'previousmonth' = previous month, 'currentyear' = year to date, 'lastyear' = last full year"
          },
          sku: {
            type: "string",
            description: "Filter by SKU (comma-separated for multiple)"
          },
          productName: {
            type: "string",
            description: "Filter by product name (partial match)"
          },
          category: {
            type: "string",
            description: "Filter by product category"
          },
          city: {
            type: "string",
            description: "Filter by city"
          },
          state: {
            type: "string",
            description: "Filter by state"
          },
          country: {
            type: "string",
            description: "Filter by country"
          },
          platform: {
            type: "string",
            description: "Filter by platform"
          },
          startDate: {
            type: "string",
            format: "date",
            description: "Custom start date (YYYY-MM-DD). Use with endDate for custom range"
          },
          endDate: {
            type: "string",
            format: "date",
            description: "Custom end date (YYYY-MM-DD). Use with startDate for custom range"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_regional_sales",
      description: "Get regional sales data aggregated by state and city. Returns total sales, quantities, and order counts grouped by location.",
      parameters: {
        type: "object",
        properties: {
          filterType: {
            type: "string",
            enum: ["currentmonth", "previousmonth", "currentyear", "lastyear"],
            description: "Date filter type"
          },
          sku: {
            type: "string",
            description: "Filter by SKU"
          },
          productCategory: {
            type: "string",
            description: "Filter by product category"
          },
          state: {
            type: "string",
            description: "Filter by state"
          },
          city: {
            type: "string",
            description: "Filter by city"
          },
          country: {
            type: "string",
            description: "Filter by country"
          },
          platform: {
            type: "string",
            description: "Filter by platform"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_inventory_data",
      description: "Get inventory data from std_inventory table. Returns SKU, quantity, product name, category, country, platform, stock status, and inventory value. Supports filtering by SKU, category, product name, country, and platform.",
      parameters: {
        type: "object",
        properties: {
          sku: {
            type: "string",
            description: "Filter by SKU (partial match)"
          },
          category: {
            type: "string",
            description: "Filter by product category (partial match)"
          },
          product: {
            type: "string",
            description: "Filter by product name (partial match)"
          },
          country: {
            type: "string",
            description: "Filter by country (partial match)"
          },
          platform: {
            type: "string",
            description: "Filter by platform (partial match)"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_pnl_data",
      description: "Get Profit & Loss (P&L) data from std_pnl table. Returns financial metrics including total sales, ad costs, fees, COGS, contribution margins (CM1, CM2, CM3), and other P&L metrics. Supports filtering by SKU, category, product name, country, platform, and date range.",
      parameters: {
        type: "object",
        properties: {
          range: {
            type: "string",
            enum: ["currentmonth", "previousmonth", "currentyear", "lastyear", "customrange"],
            description: "Date range filter. 'customrange' requires startMonth and endMonth"
          },
          sku: {
            type: "string",
            description: "Filter by SKU"
          },
          category: {
            type: "string",
            description: "Filter by product category"
          },
          productName: {
            type: "string",
            description: "Filter by product name"
          },
          country: {
            type: "string",
            description: "Filter by country"
          },
          platform: {
            type: "string",
            description: "Filter by platform"
          },
          startMonth: {
            type: "string",
            description: "Start month in MM-YYYY format (for customrange)"
          },
          endMonth: {
            type: "string",
            description: "End month in MM-YYYY format (for customrange)"
          },
          cm3Type: {
            type: "string",
            enum: ["gainer", "drainer", "all"],
            description: "Filter by CM3 type: 'gainer' (positive CM3), 'drainer' (negative CM3), 'all' (no filter)"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_pnl_executive",
      description: "Get executive-level P&L summary data. Returns aggregated totals for current and previous periods with comparison metrics including CM1, CM2, CM3 changes.",
      parameters: {
        type: "object",
        properties: {
          range: {
            type: "string",
            enum: ["currentmonth", "previousmonth", "currentyear", "lastyear", "customrange"],
            description: "Date range filter"
          },
          sku: {
            type: "string",
            description: "Filter by SKU"
          },
          category: {
            type: "string",
            description: "Filter by product category"
          },
          productName: {
            type: "string",
            description: "Filter by product name"
          },
          country: {
            type: "string",
            description: "Filter by country"
          },
          platform: {
            type: "string",
            description: "Filter by platform"
          },
          startMonth: {
            type: "string",
            description: "Start month in MM-YYYY format (for customrange)"
          },
          endMonth: {
            type: "string",
            description: "End month in MM-YYYY format (for customrange)"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_ad_sales_spend",
      description: "Get ad sales and ad spend data from std_ad_sales table. Returns ad sales, ad spend, total revenue, ACOS (Advertising Cost of Sales), TACOS (Total Advertising Cost of Sales), ROAS (Return on Ad Spend), and organic revenue. Supports filtering by platform, country, SKU, and date ranges.",
      parameters: {
        type: "object",
        properties: {
          filterType: {
            type: "string",
            enum: ["currentmonth", "previousmonth", "currentyear", "lastyear"],
            description: "Date filter type"
          },
          platform: {
            type: "string",
            description: "Filter by platform"
          },
          country: {
            type: "string",
            description: "Filter by country (partial match)"
          },
          sku: {
            type: "string",
            description: "Filter by SKU"
          },
          startMonth: {
            type: "string",
            description: "Start month in MM-YYYY format (for custom range)"
          },
          endMonth: {
            type: "string",
            description: "End month in MM-YYYY format (for custom range)"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_orders_data",
      description: "Get order data from std_orders table. Returns daily breakdown of orders with total quantity, total sales, order count, and AOV (Average Order Value). Supports filtering by SKU, platform, state, city, country, and date ranges.",
      parameters: {
        type: "object",
        properties: {
          filterType: {
            type: "string",
            enum: ["currentmonth", "previousmonth", "currentyear", "lastyear"],
            description: "Date filter type"
          },
          sku: {
            type: "string",
            description: "Filter by SKU (comma-separated for multiple)"
          },
          platform: {
            type: "string",
            description: "Filter by platform (partial match)"
          },
          state: {
            type: "string",
            description: "Filter by state"
          },
          city: {
            type: "string",
            description: "Filter by city"
          },
          country: {
            type: "string",
            description: "Filter by country (partial match)"
          },
          startMonth: {
            type: "string",
            description: "Start month in YYYY-MM format (for custom range)"
          },
          endMonth: {
            type: "string",
            description: "End month in YYYY-MM format (for custom range)"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_inventory_overstock",
      description: "Get overstock inventory items. Returns items with stock_status='Overstock', dos_2 >= 90, and afn_fulfillable_quantity >= 90.",
      parameters: {
        type: "object",
        properties: {
          country: {
            type: "string",
            description: "Filter by country (partial match)"
          },
          platform: {
            type: "string",
            description: "Filter by platform (partial match)"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_inventory_understock",
      description: "Get understock inventory items. Returns items with stock_status='Understock', dos_2 <= 30, and afn_fulfillable_quantity <= 30.",
      parameters: {
        type: "object",
        properties: {
          country: {
            type: "string",
            description: "Filter by country (partial match)"
          },
          platform: {
            type: "string",
            description: "Filter by platform (partial match)"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_inventory_out_of_stock",
      description: "Get active SKUs that are out of stock. Returns items with stock_status='Understock', dos_2 = 0, and afn_fulfillable_quantity = 0.",
      parameters: {
        type: "object",
        properties: {
          country: {
            type: "string",
            description: "Filter by country (partial match)"
          },
          platform: {
            type: "string",
            description: "Filter by platform (partial match)"
          }
        }
      }
    }
  }
];

module.exports = toolDefinitions;

