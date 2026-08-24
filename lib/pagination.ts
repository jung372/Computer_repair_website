export function getPagination(
  requestedPage: string | number | undefined,
  totalItems: number,
  pageSize: number,
) {
  const safeTotal = Number.isFinite(totalItems) ? Math.max(0, Math.floor(totalItems)) : 0;
  const safePageSize = Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : 1;
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const parsedPage = typeof requestedPage === "number"
    ? requestedPage
    : Number(requestedPage ?? "1");
  const page = Number.isSafeInteger(parsedPage)
    ? Math.min(totalPages, Math.max(1, parsedPage))
    : 1;
  return {
    page,
    pageSize: safePageSize,
    totalItems: safeTotal,
    totalPages,
    offset: (page - 1) * safePageSize,
  };
}
