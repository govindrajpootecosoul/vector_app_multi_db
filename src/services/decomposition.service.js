const sql = require('mssql');
const moment = require('moment');
const { getConnection } = require('../utils/database');

const TABLE_NAME = 'std_decomposition_chart';

const FIELD_MAP = {
  off_taken: ['total_sales', 'Total_Sales'],
  gvs: ['total_glance_views', 'Total Glance Views'],
  cvr: ['total_conversion_rate', 'Total_Conversion_rate'],
  asp: ['asp', 'ASP'],
  osa: ['osa_inventory_availabilty_percent', 'OSA_Inventory_Availabilty%'],
  organic_gvs: ['organic_views', 'Organic Views'],
  ad_gvs: ['ads_glance_views', 'Ads Glance Views'],
  add_to_cart: ['add_to_cart', 'Add_to_cart'],
  buy_box: ['buy_box_percentage', 'buy_box_percentage'],
  discounting: ['discounting', 'Discounting'],
  discounting_percentage: ['discounting_percent', 'Discounting%'],
  impression: ['impressions', 'Impressions'],
  ad_organic_ratio: ['ads_organic_ratio', 'Ads_Organic_Ratio'],
  clicks: ['clicks', 'Clicks'],
  CTR: ['ctr_percent', 'CTR%'],
  seller_listing: ['seller_listing', 'Seller_Listing']
};

const AVERAGE_FIELDS = new Set([
  'buy_box',
  'cvr',
  'asp',
  'osa',
  'discounting_percentage',
  'seller_listing',
  'CTR'
]);

const PERCENTAGE_SKIP_KEYS = new Set(['sku', 'months', 'currency_type']);

const toFloat = (value) => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const cleaned = value.toString().replace(/[%\s,]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const resolveValue = (row, columnNames) => {
  const columns = Array.isArray(columnNames) ? columnNames : [columnNames];
  for (const col of columns) {
    if (row[col] !== undefined && row[col] !== null) {
      return row[col];
    }
  }
  return null;
};

const convertRowToJson = (row) => {
  const result = {};
  for (const [jsonKey, columnOptions] of Object.entries(FIELD_MAP)) {
    result[jsonKey] = toFloat(resolveValue(row, columnOptions));
  }
  result.currency_type =
    row.currency_type ||
    row.currencyType ||
    row.currency ||
    row.Currency_Type ||
    null;
  result.sku = row.sku || row.SKU || null;
  result.yearMonth = row.year_month || row['Year-Month'] || null;
  return result;
};

const createEmptySummary = (sku = null) => {
  const summary = { sku, months: 0, currency_type: null };
  Object.keys(FIELD_MAP).forEach((key) => {
    summary[key] = 0;
  });
  return summary;
};

const aggregateData = (rows) => {
  if (!rows.length) {
    return createEmptySummary();
  }

  const totals = createEmptySummary(rows[0].sku || rows[0].SKU || null);
  const averages = {};
  AVERAGE_FIELDS.forEach((key) => {
    averages[key] = 0;
  });
  let count = 0;

  for (const row of rows) {
    const data = convertRowToJson(row);
    totals.currency_type = totals.currency_type || data.currency_type || null;
    for (const key of Object.keys(FIELD_MAP)) {
      if (key === 'CTR') {
        continue;
      }
      const val = data[key] || 0;
      if (AVERAGE_FIELDS.has(key)) {
        averages[key] += val;
      } else {
        totals[key] = (totals[key] || 0) + val;
      }
    }

    const clicks = data.clicks || 0;
    const impressions = data.impression || 0;
    if (impressions > 0) {
      averages.CTR += (clicks / impressions) * 100;
    }

    count += 1;
  }

  for (const [key, sum] of Object.entries(averages)) {
    totals[key] = count ? +(sum / count).toFixed(2) : 0;
  }

  totals.sku = totals.sku || rows[0].sku || rows[0].SKU || null;
  totals.months = count;

  return totals;
};

const addPercentageKeys = (prevData, currData) => {
  const previous = prevData || createEmptySummary();
  const current = currData || createEmptySummary();

  for (const key of Object.keys(current)) {
    if (PERCENTAGE_SKIP_KEYS.has(key)) {
      continue;
    }

    const prevVal = toFloat(previous[key]);
    const currVal = toFloat(current[key]);

    if (prevVal === 0 && currVal > 0) {
      current[`${key}_percentage`] = Infinity;
    } else if (prevVal === 0 && currVal === 0) {
      current[`${key}_percentage`] = 0;
    } else {
      current[`${key}_percentage`] = +(((currVal - prevVal) / prevVal)).toFixed(4);
    }
  }
};

const buildDecompositionResponse = (summary) => {
  const safeSummary = summary || createEmptySummary();
  return {
    id: 1,
    value: safeSummary.off_taken || 0,
    valueUnit: 'K',
    cardLabel: 'Off Take',
    percentage: safeSummary.off_taken_percentage || 0,
    currencyCode: safeSummary.currency_type || '',
    nodeLabel: '',
    subNodeLabel: '',
    subNodeValue: 0,
    subNodeValueUnit: '',
    children: [
      {
        id: 2,
        value: safeSummary.gvs || 0,
        valueUnit: '',
        cardLabel: 'GVs',
        percentage: safeSummary.gvs_percentage || 0,
        children: [
          {
            id: 5,
            value: Math.round(safeSummary.osa || 0),
            valueUnit: '%',
            cardLabel: 'OSA',
            percentage: 0,
            nodeLabel: 'Availability',
            children: []
          },
          {
            id: 6,
            value: safeSummary.organic_gvs || 0,
            valueUnit: '',
            cardLabel: 'Organic GVs',
            percentage: safeSummary.organic_gvs_percentage || 0,
            nodeLabel: 'Organic GVs',
            children: []
          },
          {
            id: 7,
            value: safeSummary.ad_gvs || 0,
            valueUnit: '',
            cardLabel: 'Ad GVs',
            percentage: safeSummary.ad_gvs_percentage || 0,
            nodeLabel: 'Avg. Sponsored Rank',
            children: [
              {
                id: 12,
                value: safeSummary.impression || 0,
                valueUnit: 'K',
                cardLabel: 'Impression',
                percentage: safeSummary.impression_percentage || 0,
                children: []
              },
              {
                id: 13,
                value: safeSummary.CTR || 0,
                valueUnit: '%',
                cardLabel: 'CTR%',
                percentage: safeSummary.CTR_percentage || 0,
                children: []
              }
            ]
          },
          {
            id: 8,
            value: safeSummary.add_to_cart || 0,
            valueUnit: '',
            cardLabel: 'Add To Cart',
            percentage: safeSummary.add_to_cart_percentage || 0,
            children: []
          }
        ]
      },
      {
        id: 3,
        value: safeSummary.cvr || 0,
        valueUnit: '%',
        cardLabel: 'CVR',
        percentage: safeSummary.cvr_percentage || 0,
        nodeLabel: 'CVR',
        children: [
          {
            id: 9,
            value: safeSummary.buy_box || 0,
            valueUnit: '%',
            cardLabel: 'BuyBox%',
            percentage: safeSummary.buy_box_percentage || 0,
            nodeLabel: 'BuyBox%',
            children: []
          },
          {
            id: 10,
            value: safeSummary.discounting || 0,
            valueUnit: '%',
            cardLabel: 'Discounting',
            percentage: safeSummary.discounting_percentage || 0,
            nodeLabel: 'Discounting',
            children: []
          },
          {
            id: 11,
            value: safeSummary.ad_organic_ratio || 0,
            valueUnit: '%',
            cardLabel: 'OSA',
            percentage: safeSummary.ad_organic_ratio_percentage || 0,
            nodeLabel: 'Ad. To Organic Ratio',
            children: []
          }
        ]
      },
      {
        id: 4,
        value: safeSummary.asp || 0,
        valueUnit: '',
        cardLabel: 'ASP',
        percentage: safeSummary.asp_percentage || 0,
        currencyCode: safeSummary.currency_type || '',
        nodeLabel: 'ASP',
        children: []
      }
    ]
  };
};

const parseYearMonthString = (value) => {
  if (!value) {
    return null;
  }
  const formats = ['YYYY-MM', 'YYYY/MM'];
  for (const format of formats) {
    const parsed = moment(value, format, true);
    if (parsed.isValid()) {
      return parsed.startOf('month');
    }
  }
  return null;
};

const buildYearMonthFromParts = (yearValue, monthValue) => {
  if (yearValue === undefined || yearValue === null || monthValue === undefined || monthValue === null) {
    return null;
  }
  const yearInt = parseInt(yearValue, 10);
  const monthInt = parseInt(monthValue, 10);
  if (Number.isNaN(yearInt) || Number.isNaN(monthInt) || monthInt < 1 || monthInt > 12) {
    return null;
  }
  return `${yearInt}-${String(monthInt).padStart(2, '0')}`;
};

const buildRangeWithPrevious = (startMoment, endMoment) => {
  const start = startMoment.clone().startOf('month');
  const end = endMoment.clone().startOf('month');
  if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
    throw new Error('Invalid date range provided');
  }

  const rangeMonths = [];
  const cursor = start.clone();
  while (cursor.isSameOrBefore(end)) {
    rangeMonths.push(cursor.format('YYYY-MM'));
    cursor.add(1, 'month');
  }

  const monthsCount = rangeMonths.length;
  const previousMonths = [];
  const prevCursor = start.clone().subtract(monthsCount, 'months');
  for (let i = 0; i < monthsCount; i += 1) {
    previousMonths.push(prevCursor.format('YYYY-MM'));
    prevCursor.add(1, 'month');
  }

  return { previousMonths, rangeMonths };
};

const resolveCustomRange = ({ year, fromMonth, toMonth, startMonth, endMonth }) => {
  const explicitStart = startMonth || buildYearMonthFromParts(year, fromMonth);
  const explicitEnd = endMonth || buildYearMonthFromParts(year, toMonth);

  if (!explicitStart || !explicitEnd) {
    throw new Error('startMonth and endMonth (YYYY-MM) or year/fromMonth/toMonth are required for custom filterType');
  }

  const startMoment = parseYearMonthString(explicitStart);
  const endMoment = parseYearMonthString(explicitEnd);

  if (!startMoment?.isValid() || !endMoment?.isValid() || endMoment.isBefore(startMoment)) {
    throw new Error('Invalid custom range parameters');
  }

  return { customStart: startMoment, customEnd: endMoment };
};

const getMonthRangesByFilterType = (filterType, options = {}) => {
  const today = moment().startOf('month');
  const normalizedFilter = (filterType || '').toString().toLowerCase();

  switch (normalizedFilter) {
    case 'current':
    case 'currentmonth':
    case 'current_month':
      return buildRangeWithPrevious(today, today);
    case 'previous':
    case 'previousmonth':
    case 'last':
    case 'lastmonth': {
      const lastMonth = today.clone().subtract(1, 'month');
      return buildRangeWithPrevious(lastMonth, lastMonth);
    }
    case 'currentyear': {
      const startOfYear = today.clone().startOf('year');
      return buildRangeWithPrevious(startOfYear, today);
    }
    case 'previousyear':
    case 'lastyear': {
      const prevYearStart = today.clone().subtract(1, 'year').startOf('year');
      const prevYearEnd = prevYearStart.clone().add(11, 'months');
      return buildRangeWithPrevious(prevYearStart, prevYearEnd);
    }
    case 'custom':
    case 'customrange':
    case 'range': {
      const { customStart, customEnd } = resolveCustomRange(options);
      return buildRangeWithPrevious(customStart, customEnd);
    }
    default:
      throw new Error(`Unsupported filterType: ${filterType}`);
  }
};

const fetchRowsForMonths = async (pool, sku, months) => {
  if (!months.length) {
    return [];
  }
  const placeholders = months.map((_, idx) => `@month${idx}`).join(', ');
  const request = pool.request();
  request.input('sku', sql.VarChar, sku);
  months.forEach((month, idx) => {
    request.input(`month${idx}`, sql.VarChar, month);
  });

  const query = `
    SELECT *
    FROM ${TABLE_NAME}
    WHERE sku = @sku AND year_month IN (${placeholders})
    ORDER BY year_month ASC
  `;

  const result = await request.query(query);
  return result.recordset || [];
};

exports.getSummary = async (req) => {
  const {
    sku,
    filterType,
    year,
    fromMonth,
    toMonth,
    startMonth,
    endMonth
  } = req.query;

  if (!sku || !filterType) {
    throw new Error('sku and filterType are required');
  }

  const { previousMonths, rangeMonths } = getMonthRangesByFilterType(filterType, {
    year,
    fromMonth,
    toMonth,
    startMonth,
    endMonth
  });

  if (!rangeMonths.length) {
    throw new Error('No months found for the requested filter');
  }

  const pool = await getConnection(req);

  const [previousRows, rangeRows] = await Promise.all([
    fetchRowsForMonths(pool, sku, previousMonths),
    fetchRowsForMonths(pool, sku, rangeMonths)
  ]);

  if (!rangeRows.length) {
    return {
      previousSummary: aggregateData(previousRows),
      cSummary: createEmptySummary(sku),
      data: buildDecompositionResponse(createEmptySummary(sku))
    };
  }

  const prevSummary = aggregateData(previousRows);
  const rangeSummary = aggregateData(rangeRows);

  addPercentageKeys(prevSummary, rangeSummary);

  return {
    previousSummary: prevSummary,
    cSummary: rangeSummary,
    data: buildDecompositionResponse(rangeSummary)
  };
};