# 10 Tasks from Recent PnL Service Work

## Task 1: Refactor Ecosoul Client Detection Logic
**Priority: Medium**  
**Status: ⏳ Pending**

**Description**:  
Extract the Ecosoul client detection logic into a reusable utility function to avoid code duplication.
 
**Details**:
- Create a helper function `isEcosoulClient(req)` in a utils file
- Replace hardcoded client ID checks (`TH-1755734939046`) with the utility function
- Replace hardcoded database name checks (`thrive-client-ecosoulhome`) with the utility function
- Update both `getPnlData` and `getPnlExecutiveData` to use the utility
- Consider moving client-specific configurations to a config file

**Expected Outcomes**:
- Single source of truth for client detection
- Easier to maintain and update client-specific logic
- Reduced code duplication

---

## Task 2: Replace Console.log with Structured Logging
**Priority: Medium**  
**Status: ⏳ Pending**

**Description**:  
Replace all `console.log` statements in PnL service with proper Winston logger calls.

**Details**:
- Replace `console.log('PNL WHERE clause:', whereClause)` with logger.debug()
- Replace `console.log('PNL ORDER BY:', orderBy)` with logger.debug()
- Replace `console.log('Total PNL records found:', pnlData.length)` with logger.info()
- Replace `console.error('PNL service error:', error)` with logger.error()
- Use appropriate log levels (debug, info, warn, error)
- Include request context (user, database, endpoint) in logs

**Expected Outcomes**:
- Consistent logging across the application
- Better log management and filtering
- Production-ready logging

---

## Task 3: Fix Duplicate Custom Range Handling Logic
**Priority: High**  
**Status: ⏳ Pending**

**Description**:  
Remove duplicate custom range handling code in `getPnlExecutiveData` function.

**Details**:
- Lines 423-460 and 521-560 contain duplicate logic for custom range handling
- Consolidate into a single code path
- Extract custom range calculation into a helper function
- Ensure both code paths handle edge cases correctly
- Test with various custom range inputs

**Expected Outcomes**:
- Cleaner, more maintainable code
- Reduced risk of bugs from duplicate logic
- Easier to update custom range logic in the future

---

## Task 4: Standardize Error Response Format in getPnlData
**Priority: High**  
**Status: ⏳ Pending**

**Description**:  
Update error responses in `getPnlData` to match the standardized format used in other endpoints.

**Details**:
- Line 54-59: Update database name error to match standard format with `status`, `data.code`, `data.details`, and `timestamp`
- Line 347-348: Update catch block error response to match standard format
- Ensure all error responses follow: `{ success: false, status: number, message: string, data: { code: string, details: string }, timestamp: string }`

**Expected Outcomes**:
- Consistent error handling across all PnL endpoints
- Better frontend error handling
- Improved API documentation

---

## Task 5: Add Date Range Validation for Custom Ranges
**Priority: High**  
**Status: ⏳ Pending**

**Description**:  
Add validation to ensure custom date ranges are logical and within acceptable limits.

**Details**:
- Validate that `startMonth` is before or equal to `endMonth`
- Add maximum range limit (e.g., 24 months) to prevent performance issues
- Validate that dates are not in the future (if business rules require)
- Validate that dates are not too far in the past (if applicable)
- Return clear error messages with specific validation failures

**Expected Outcomes**:
- Prevents invalid queries and performance issues
- Better user experience with clear error messages
- Improved API reliability

---

## Task 6: Extract Query Building Logic into Helper Functions
**Priority: Medium**  
**Status: ⏳ Pending**

**Description**:  
Refactor the WHERE clause building logic into reusable helper functions to reduce code duplication.

**Details**:
- Create `buildWhereClause(req, request)` helper function
- Create `buildDateRangeFilter(normalizedRange, date, startMonth, endMonth)` helper function
- Extract filter building logic (sku, category, productName, country, platform) into separate functions
- Update both `getPnlData` and `getPnlExecutiveData` to use helpers
- Make the code more testable and maintainable

**Expected Outcomes**:
- Reduced code duplication
- Easier to test individual components
- More maintainable codebase

---

## Task 7: Add Pagination Support to getPnlData Endpoint
**Priority: High**  
**Status: ⏳ Pending**

**Description**:  
Implement pagination for the PnL data endpoint to handle large result sets efficiently.

**Details**:
- Add `page` and `limit` query parameters (default: page=1, limit=50)
- Add `MAX_LIMIT` constant (e.g., 500) to prevent performance issues
- Calculate `offset` based on page and limit
- Add `LIMIT` and `OFFSET` to SQL queries (lines 289, 331)
- Get total count with a separate COUNT query
- Return pagination metadata: `{ totalRecords, totalPages, currentPage, hasNextPage, hasPreviousPage, limit }`

**Expected Outcomes**:
- API can handle large datasets without timeout
- Frontend can implement pagination UI
- Better performance for large result sets

---

## Task 8: Optimize Dropdown Query with DISTINCT Instead of STRING_AGG
**Priority: Medium**  
**Status: ⏳ Pending**

**Description**:  
Replace STRING_AGG approach in `getPnlDropdownData` with more efficient DISTINCT queries.

**Details**:
- Replace single query with STRING_AGG (lines 761-770) with separate DISTINCT queries
- Use `SELECT DISTINCT sku FROM std_pnl WHERE ...` for each field
- Execute queries in parallel using Promise.all()
- Consider adding indexes on frequently queried columns
- Test performance improvement with large datasets

**Expected Outcomes**:
- Faster dropdown data retrieval
- Better database performance
- Reduced memory usage
- More scalable solution

---

## Task 9: Add Input Sanitization for SQL Injection Prevention
**Priority: High**  
**Status: ⏳ Pending**

**Description**:  
Add input sanitization and validation to prevent SQL injection and ensure data integrity.

**Details**:
- Validate and sanitize all query parameters before using them
- Add length limits for string inputs (sku, category, productName, country, platform)
- Validate enum values (cm3Type: gainer/drainer/all, sortOrder: ascending/descending)
- Sanitize date inputs to prevent injection
- Use parameterized queries (already done, but add validation layer)
- Add input validation middleware or helper functions

**Expected Outcomes**:
- Enhanced security against SQL injection
- Better data integrity
- Improved API reliability

---

## Task 10: Add Comprehensive Unit Tests for PnL Service
**Priority: Medium**  
**Status: ⏳ Pending**

**Description**:  
Create unit tests for all PnL service functions to ensure reliability and catch regressions.

**Details**:
- Test `normalizeRange` function with various inputs (synonyms, invalid values, null/undefined)
- Test `parseMonthInput` with different formats (MM-YYYY, YYYY-MM, invalid formats)
- Test date range calculation for all range types (currentmonth, previousmonth, currentyear, lastyear, customrange)
- Test WHERE clause building with different filter combinations
- Test Ecosoul vs standard client query building
- Mock database connections and responses
- Test error handling scenarios
- Achieve at least 80% code coverage

**Expected Outcomes**:
- Reliable code with test coverage
- Easier to catch bugs during development
- Confidence when refactoring code
- Documentation through tests

---

## Additional Notes

### Current Implementation Highlights:
- ✅ Dual date format support (MM-YYYY and YYYY-MM)
- ✅ Range synonym normalization (currentmonths → currentmonth)
- ✅ Ecosoul client-specific column handling
- ✅ Period comparison in executive endpoint
- ✅ CM3 type filtering (gainer/drainer)
- ✅ Sort order functionality

### Areas Needing Attention:
- ⚠️ Code duplication (custom range logic, query building)
- ⚠️ Inconsistent error response formats
- ⚠️ Missing pagination
- ⚠️ Console.log instead of structured logging
- ⚠️ No input validation/sanitization
- ⚠️ No unit tests

---

## Task Priority Summary
- **High Priority**: Tasks 3, 4, 5, 7, 9 (Critical for functionality, security, and consistency)
- **Medium Priority**: Tasks 1, 2, 6, 8, 10 (Important improvements and maintainability)





