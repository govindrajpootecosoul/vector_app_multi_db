# PnL API Tasks - 10 Tasks for Recent Work

## Overview
This document contains 10 tasks related to the PnL (Profit and Loss) API implementation, testing, and improvements.

---

## Task 1: Add Input Validation for PnL Query Parameters
**Priority: High**  
**Status: ⏳ Pending**

**Description**:  
Add comprehensive input validation for all PnL API endpoints to ensure data integrity and prevent invalid queries.

**Details**:
- Validate `sku` format (alphanumeric, max length)
- Validate `date` format (YYYY-MM)
- Validate `startMonth` and `endMonth` formats (MM-YYYY or YYYY-MM)
- Validate `cm3Type` enum values (gainer, drainer, all)
- Validate `sortOrder` enum values (ascending, descending)
- Validate `category`, `productName`, `country`, `platform` (max length, special characters)
- Return consistent error messages for validation failures

**Expected Outcomes**:
- All invalid inputs are caught before database queries
- Consistent error response format
- Improved API security and reliability

---

## Task 2: Add Pagination Support to PnL Data Endpoint
**Priority: High**  
**Status: ⏳ Pending**

**Description**:  
Implement pagination for the `/api/pnl/pnl-data` endpoint to handle large datasets efficiently.

**Details**:
- Add `page` and `limit` query parameters
- Calculate `offset` based on page and limit
- Add `LIMIT` and `OFFSET` to SQL query
- Return pagination metadata in response (totalRecords, totalPages, currentPage, hasNextPage, hasPreviousPage)
- Set default limit (e.g., 50 records per page)
- Set maximum limit to prevent performance issues

**Expected Outcomes**:
- API can handle large datasets without timeout
- Frontend can implement pagination UI
- Better performance for large result sets

---

## Task 3: Add Multi-SKU Filter Support
**Priority: Medium**  
**Status: ⏳ Pending**

**Description**:  
Extend the `sku` filter to support multiple SKUs (comma-separated list) similar to other APIs in the codebase.

**Details**:
- Parse comma-separated SKU values
- Update WHERE clause to use `IN` operator instead of `=`
- Handle both single SKU and multiple SKUs
- Validate each SKU in the list
- Return appropriate error if any SKU is invalid

**Expected Outcomes**:
- Users can filter by multiple SKUs in a single request
- Consistent with other API endpoints
- Improved query flexibility

---

## Task 4: Standardize Error Response Format Across PnL Endpoints
**Priority: Medium**  
**Status: ⏳ Pending**

**Description**:  
Ensure all three PnL endpoints return consistent error response formats.

**Details**:
- Review error responses in `getPnlData`, `getPnlExecutiveData`, and `getPnlDropdownData`
- Standardize error structure: `{ success: false, status: number, message: string, data: { code: string, details: string }, timestamp: string }`
- Update all error responses to match the standard format
- Ensure HTTP status codes are appropriate (400 for bad requests, 500 for server errors)

**Expected Outcomes**:
- Consistent error handling across all PnL endpoints
- Better developer experience
- Easier frontend error handling

---

## Task 5: Add LIKE Search Support for Product Name Filter
**Priority: Medium**  
**Status: ⏳ Pending**

**Description**:  
Change the `productName` filter from exact match to LIKE search (partial matching) for better usability.

**Details**:
- Update WHERE clause from `product_name = @productName` to `product_name LIKE @productName`
- Add wildcard characters (`%`) to the search pattern
- Support case-insensitive search
- Update similar filters if needed (country, platform)

**Expected Outcomes**:
- Users can search products by partial name
- More flexible filtering
- Better user experience

---

## Task 6: Add Date Range Validation and Error Handling
**Priority: Medium**  
**Status: ⏳ Pending**

**Description**:  
Add validation to ensure date ranges are logical and handle edge cases.

**Details**:
- Validate that `startMonth` is before or equal to `endMonth`
- Validate date ranges are not too large (e.g., max 2 years)
- Handle invalid date formats gracefully
- Add validation for future dates (if not allowed)
- Provide clear error messages for invalid date ranges

**Expected Outcomes**:
- Prevents invalid queries
- Better error messages for users
- Improved API reliability

---

## Task 7: Optimize PnL Dropdown Query Performance
**Priority: Low**  
**Status: ⏳ Pending**

**Description**:  
Optimize the dropdown data query to use `DISTINCT` instead of `STRING_AGG` for better performance.

**Details**:
- Replace `STRING_AGG` with separate `SELECT DISTINCT` queries for each field
- Or use `GROUP BY` with proper aggregation
- Consider adding indexes on frequently queried columns (country, platform, product_category)
- Test query performance with large datasets

**Expected Outcomes**:
- Faster dropdown data retrieval
- Better database performance
- Reduced memory usage

---

## Task 8: Add Unit Tests for PnL Service Functions
**Priority: Low**  
**Status: ⏳ Pending**

**Description**:  
Create comprehensive unit tests for PnL service functions.

**Details**:
- Test `normalizeRange` function with various inputs
- Test `parseMonthInput` function with different date formats
- Test date range calculation logic for all range types
- Test WHERE clause building with different filter combinations
- Mock database connections for testing
- Achieve at least 80% code coverage

**Expected Outcomes**:
- Reliable code with test coverage
- Easier to catch bugs during development
- Confidence in code changes

---

## Task 9: Add API Documentation for PnL Endpoints
**Priority: Low**  
**Status: ⏳ Pending**

**Description**:  
Create comprehensive API documentation for all three PnL endpoints.

**Details**:
- Document endpoint URLs and HTTP methods
- Document all query parameters with types, formats, and examples
- Document response formats with example JSON
- Document error responses and status codes
- Include example curl commands
- Document authentication requirements
- Add to Swagger/OpenAPI if available

**Expected Outcomes**:
- Clear documentation for developers
- Easier API integration
- Reduced support requests

---

## Task 10: Add Response Time Logging and Performance Monitoring
**Priority: Low**  
**Status: ⏳ Pending**

**Description**:  
Add logging for query execution times and monitor PnL API performance.

**Details**:
- Log query execution time for each PnL endpoint
- Log number of records returned
- Add performance warnings for slow queries (> 5 seconds)
- Track query patterns (most used filters, date ranges)
- Consider adding database query execution time logging
- Use Winston logger for structured logging

**Expected Outcomes**:
- Better visibility into API performance
- Identify slow queries for optimization
- Monitor API usage patterns

---

## Additional Notes

### Current PnL Endpoints:
1. `GET /api/pnl/pnl-data` - Get aggregated PnL data by SKU
2. `GET /api/pnl/pnlexecutive` - Get executive summary with period comparison
3. `GET /api/pnl/pnldropdown` - Get dropdown filter options

### Supported Range Values:
- `currentmonth` / `currentmonths` - Current month
- `lastmonth` / `previousmonth` - Previous month
- `yeartodate` / `currentyear` - Current year to date
- `lastyear` - Previous calendar year
- `customrange` - Custom date range (requires startMonth and endMonth)

### Authentication:
All endpoints require JWT token with `databaseName` field in the token payload.

---

## Task Priority Summary
- **High Priority**: Tasks 1, 2 (Critical for functionality and performance)
- **Medium Priority**: Tasks 3, 4, 5, 6 (Important improvements)
- **Low Priority**: Tasks 7, 8, 9, 10 (Nice to have, optimization and documentation)









