# Thrive App APIs - Postman Collection Guide

## 📋 Overview

This Postman collection contains all APIs for the Thrive App Backend. All APIs use **JWT token-based authentication** with **automatic database switching** based on the `databaseName` field in the token.

## 🔑 Authentication Setup

### Step 1: Get Your JWT Token

1. **Login** using the `/api/user/login` endpoint:
   ```json
   {
     "email": "your-email@example.com",
     "password": "your-password"
   }
   ```

2. **Copy the token** from the response:
   ```json
   {
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "user": {
       "databaseName": "thrive-client-ecosoulhome"
     }
   }
   ```

### Step 2: Set Token in Postman

1. Open the Postman collection
2. Go to **Collection Variables** (click on collection name → Variables tab)
3. Set `auth_token` variable with your JWT token
4. OR set it at the environment level

**Important**: The JWT token **MUST** contain a `databaseName` field. This is automatically included when you login.

## 🚀 Quick Start

1. **Import Collection**: Import `Thrive_App_APIs.postman_collection.json` into Postman
2. **Set Base URL**: Update `base_url` variable (default: `http://localhost:3111`)
3. **Set Auth Token**: Set `auth_token` variable with your JWT token
4. **Start Testing**: All APIs are ready to use!

## 📚 API Categories

### 1. **Authentication APIs**
- `POST /api/user/login` - Login (no auth required)
- `POST /api/user/signup` - Signup (no auth required)
- `GET /api/user/details` - Get user details (auth required)

### 2. **Inventory APIs**
- `GET /api/inventory` - Get inventory data with filters
- `GET /api/inventory/dropdown-data` - Get dropdown options
- `GET /api/inventory/overstock-data` - Get overstock items
- `GET /api/inventory/understock-data` - Get understock items
- `GET /api/inventory/activeSKUoutofstock-data` - Get out of stock items
- `GET /api/inventory/executive-data` - Get executive summary

### 3. **Order APIs**
- `GET /api/orders/orderlist` - Get order list (requires filterType or date range)
- `GET /api/orders/dropdown-data` - Get dropdown options

### 4. **Ad Sales & Ad Spend APIs**
- `GET /api/adsalesadspend` - Get ad sales and spend data (requires filterType)

### 5. **PNL APIs**
- `GET /api/pnl/pnl-data` - Get PNL data (requires range/date)
- `GET /api/pnl/pnlexecutive` - Get PNL executive data
- `GET /api/pnl/pnldropdown` - Get dropdown options

### 6. **Sales Analysis APIs**
- `GET /api/salesanalysis/data` - Comprehensive sales data (supports multiple dataTypes)
- `GET /api/salesanalysis/sales` - Get sales data
- `GET /api/salesanalysis/sales/region` - Get regional sales
- `GET /api/salesanalysis/sku-list` - Get SKU list
- `GET /api/salesanalysis/categories-list` - Get categories
- `GET /api/salesanalysis/product-names` - Get product names
- `GET /api/salesanalysis/states-list` - Get states
- `GET /api/salesanalysis/cities-list` - Get cities
- `GET /api/salesanalysis/adData/filterData` - Get ad data

## 🔧 Features

### ✅ Token-Based Database Switching
- All APIs automatically use the database from your JWT token
- No need to pass database name in URL or query parameters
- Each client has their own isolated database

### ✅ Optimized Connection Pooling
- Connection pools are cached and reused
- First request: ~500ms (creates connection)
- Subsequent requests: ~50-100ms (uses cached pool)
- No connection overhead on every request

### ✅ No client_id Filters
- Removed all `client_id` filters from queries
- Each database is client-specific, so no filtering needed
- Faster queries and simpler code

## 📝 Common Query Parameters

### Date Range Options

**filterType** (for Order/Ad Sales APIs):
- `currentmonth` - Current month
- `previousmonth` - Previous month
- `currentyear` - Current year
- `lastyear` - Last year

**range** (for PNL APIs):
- `currentmonths` - Current months
- `lastmonth` - Last month
- `yeartodate` - Year to date
- `lastyear` - Last year

**Custom Date Ranges**:
- `startMonth` / `endMonth` - Format: `YYYY-MM` or `MM-YYYY`
- `fromDate` / `toDate` - Format: `YYYY-MM-DD`

### Filter Parameters

- `country` - Filter by country (e.g., "USA", "UK")
- `platform` - Filter by platform (e.g., "amazon", "shopify")
- `sku` - Filter by SKU (comma-separated for multiple)
- `category` - Filter by product category
- `product` / `productName` - Filter by product name

## ⚠️ Important Notes

1. **Token Required**: All APIs (except login/signup) require a valid JWT token
2. **Database Name in Token**: Token must contain `databaseName` field
3. **Connection Caching**: First request may be slower, subsequent requests are fast
4. **No URL Database Name**: Don't pass database name in URL - it's from token
5. **Filter Combinations**: Most filters are optional and can be combined

## 🐛 Troubleshooting

### "Database name not found in token"
- Make sure you're using a valid token from login
- Check that token contains `databaseName` field
- Try logging in again to get a fresh token

### "Connection timeout" or slow requests
- First request creates connection pool (normal, ~500ms)
- Subsequent requests should be fast (~50-100ms)
- If consistently slow, check database connection settings

### "No data found"
- Verify your token's database has data
- Check filter parameters match your data
- Try without filters first to see all data

## 📞 Support

For issues or questions, check:
- Server logs for detailed error messages
- Database connection status
- Token validity and expiration

---

**Last Updated**: 2024-11-15
**Version**: 2.0 (Token-based database switching)

