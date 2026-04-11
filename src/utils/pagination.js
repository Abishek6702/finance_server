const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const DEFAULT_PAGE = parsePositiveInt(process.env.PAGE_SIZE, 1);
const DEFAULT_LIMIT = parsePositiveInt(process.env.LIMIT, 10);
const MAX_LIMIT = 500;

const getPagination = (page, limit) => {
  const pageNum = parsePositiveInt(page, DEFAULT_PAGE);
  const limitNum = Math.min(parsePositiveInt(limit, DEFAULT_LIMIT), MAX_LIMIT);
  const skip = (pageNum - 1) * limitNum;
  return { pageNum, limitNum, skip };
};

const paginateArray = (items, page, limit) => {
  const { pageNum, limitNum, skip } = getPagination(page, limit);
  const total = Array.isArray(items) ? items.length : 0;
  const rows = (items || []).slice(skip, skip + limitNum);

  return {
    rows,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: total === 0 ? 0 : Math.ceil(total / limitNum),
    },
  };
};

module.exports = {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  getPagination,
  paginateArray,
};