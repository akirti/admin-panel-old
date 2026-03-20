import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Loader2, AlertCircle, BarChart3, BookOpen, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useExplorer } from '../../components/explorer/v1_ExplorerContext';
import V1Breadcrumbs from '../../components/explorer/v1_Breadcrumbs';
import V1FilterSection from '../../components/explorer/v1_FilterSection';
import V1DataTable from '../../components/explorer/v1_DataTable';
import { playboardAPI } from '../../services/api';
import { prevailAPI } from '../../services/v1_explorerApi';
import { ENV } from '../../config/env';
import { getColumnsFromData as getColumnsObj } from '../../utils/v1_reportUtils';
import V1DescriptionRenderer from '../../components/explorer/v1_DescriptionRenderer';

// Date regex for detecting date strings in filter values (YYYY-MM-DD)
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converts a filter value for the API request.
 * Strips dashes from date values, splits multi-select strings into arrays.
 */
function convertFilterValue(value, filterType) {
  if (typeof value === 'string' && dateRegex.test(value)) {
    return value.replace(/-/g, '');
  }
  if (filterType === 'multi-select' && typeof value === 'string') {
    return value.split(',').map((v) => v.trim());
  }
  return value;
}

/**
 * Converts a generic param value for step 0 (not mapped to a specific filter).
 */
function convertGenericParamValue(value) {
  if (typeof value === 'string' && dateRegex.test(value)) {
    return value.replace(/-/g, '');
  }
  if (typeof value === 'string' && value.includes(',')) {
    return value.split(',').map((v) => v.trim());
  }
  return value;
}

/**
 * Ensures a step entry exists in logic_args, creating it if needed.
 */
function ensureStep(logic_args, step) {
  if (!logic_args[step]) logic_args[step] = { query_params: {} };
}

/**
 * Maps filter config entries to their corresponding logic_args steps.
 */
function mapFilterConfigToLogicArgs(logic_args, filterConfig, filterValues) {
  if (!Array.isArray(filterConfig) || filterConfig.length === 0) return;
  filterConfig.forEach((filter) => {
    const step = filter.index != null ? filter.index.toString() : '0';
    ensureStep(logic_args, step);
    if (filter.dataKey in filterValues) {
      logic_args[step].query_params[filter.dataKey] = convertFilterValue(filterValues[filter.dataKey], filter.type);
    }
  });
}

/**
 * Maps remaining filter values (not in filterConfig) to step 0.
 */
function mapUnmappedParamsToStepZero(logic_args, filterConfig, filterValues) {
  Object.keys(filterValues).forEach((key) => {
    const alreadyMapped = filterConfig?.some((f) => f.dataKey === key);
    if (alreadyMapped) return;
    ensureStep(logic_args, '0');
    logic_args['0'].query_params[key] = convertGenericParamValue(filterValues[key]);
  });
}

/**
 * Builds logic_args from filter config and user-supplied filter values.
 */
function buildLogicArgs(filterConfig, filterValues) {
  const logic_args = {};
  mapFilterConfigToLogicArgs(logic_args, filterConfig, filterValues);
  mapUnmappedParamsToStepZero(logic_args, filterConfig, filterValues);
  ensureStep(logic_args, '0');
  return logic_args;
}

/**
 * Merges user-built logic_args into the playboard's base logic_args.
 */
function mergeLogicArgs(playboardLogicArgs, userLogicArgs) {
  if (!playboardLogicArgs || typeof playboardLogicArgs !== 'object') {
    return userLogicArgs;
  }
  const merged = { ...playboardLogicArgs };
  Object.keys(userLogicArgs).forEach((step) => {
    if (!merged[step]) {
      merged[step] = userLogicArgs[step];
    } else {
      merged[step] = {
        ...merged[step],
        query_params: {
          ...(merged[step].query_params || {}),
          ...(userLogicArgs[step].query_params || {}),
        },
      };
    }
  });
  return merged;
}

/**
 * Resolves the pagination widget from playboard config (may be array or object).
 */
function resolvePaginationWidget(paginationRaw) {
  if (Array.isArray(paginationRaw)) return paginationRaw[0] || null;
  if (paginationRaw && typeof paginationRaw === 'object' && paginationRaw.attributes) {
    return paginationRaw;
  }
  return null;
}

/**
 * Builds the pagination config for the API request.
 */
function buildPaginationConfig(pagWidget, effectivePageSize, effectivePage) {
  const config = { limit: 0, size: 0, skip: 0, page: 0 };
  if (!pagWidget) return config;

  const pagAttrs = pagWidget.attributes || [];
  const defaultLimitAttr = pagAttrs.find((attr) => attr.key === 'defaultValue');
  const defaultLimit = defaultLimitAttr ? parseInt(defaultLimitAttr.value, 10) : 0;

  const actualPageSize = effectivePageSize || defaultLimit;
  const actualPage = effectivePage || 1;

  config.limit = actualPageSize;
  config.size = actualPageSize;
  config.skip = (actualPage - 1) * actualPageSize;
  config.page = actualPage - 1;
  return config;
}

/**
 * Resolves the pagination flags (countEvaluated, end) based on the current page.
 */
function resolvePaginationFlags(effectivePage, totalPages, currentCountEvaluated, _currentEnd) {
  if (effectivePage === 1) {
    return { sendCountEvaluated: false, sendEnd: false };
  }
  const isLastPage = totalPages > 1 && effectivePage === totalPages;
  return {
    sendCountEvaluated: currentCountEvaluated,
    sendEnd: isLastPage ? true : false
  };
}

/**
 * Applies pagination metadata from the API response to state setters.
 */
function extractPaginationMeta(pagination) {
  return {
    count_evaluated: pagination.count_evaluated ?? false,
    current_count: pagination.current_count ?? 0,
    total_count: pagination.total_count ?? 0,
    end: pagination.end ?? false
  };
}

/**
 * Calculates total pages from the API response.
 */
function calculateTotalPages(response, limit, currentPage) {
  if (!limit || limit === 0) return 1;
  const total = response?.pagination?.total_count || response?.total_count || 0;
  if (total > 0) return Math.ceil(total / limit);
  const dataLen = response?.data?.length || 0;
  if (dataLen < limit) return currentPage;
  return currentPage + 1;
}

/**
 * Extracts a short plain-text snippet from the scenario description (string or array).
 */
function getDescriptionSnippet(scenarioDescription, maxLen = 120) {
  if (typeof scenarioDescription === 'string') {
    return scenarioDescription.replace(/<[^>]*>/g, '').slice(0, maxLen);
  }
  if (Array.isArray(scenarioDescription)) {
    return scenarioDescription
      .filter((d) => d.text && d.status !== 'I')
      .map((d) => d.text.replace(/<[^>]*>/g, ''))
      .join(' — ')
      .slice(0, maxLen);
  }
  return '';
}

/**
 * Determines whether a description snippet should show an ellipsis.
 */
function shouldShowEllipsis(scenarioDescription, maxLen = 120) {
  if (typeof scenarioDescription === 'string') {
    return scenarioDescription.length > maxLen;
  }
  if (Array.isArray(scenarioDescription)) {
    const joined = scenarioDescription
      .filter((d) => d.text && d.status !== 'I')
      .map((d) => d.text)
      .join(' — ');
    return joined.length > maxLen;
  }
  return false;
}

/**
 * Renders the loading state for playboard filters.
 */
function FilterLoadingState() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 size={24} className="animate-spin text-primary-600 mr-2" />
      <span className="text-content-muted">Loading filters...</span>
    </div>
  );
}

/**
 * Renders an error message for playboard errors.
 */
function FilterErrorState({ message }) {
  return (
    <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
      <AlertCircle size={20} className="text-red-600" />
      <span className="text-red-700">{message}</span>
    </div>
  );
}

/**
 * Renders the loading state for data fetching.
 */
function DataLoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 size={32} className="animate-spin text-primary-600 mr-3" />
      <span className="text-content-muted text-lg">Loading data...</span>
    </div>
  );
}

/**
 * Renders the empty data state.
 */
function DataEmptyState() {
  return (
    <div className="text-center py-12 text-content-muted">
      <BarChart3 size={48} className="mx-auto mb-4 text-content-muted" />
      <p className="text-lg font-medium">No data found</p>
      <p className="text-sm mt-1">Try adjusting your filter criteria</p>
    </div>
  );
}

/**
 * Button that opens a documentation panel showing the scenario description.
 * The description can contain HTML and renders via V1DescriptionRenderer.
 */
function ScenarioDocButton({ description }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
          open
            ? 'bg-primary-50 border-primary-300 text-primary-700'
            : 'bg-surface-secondary border-edge text-content-secondary hover:bg-surface-hover'
        }`}
      >
        <BookOpen size={14} />
        Documentation
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <div
            ref={panelRef}
            className="absolute right-4 top-20 z-50 w-full max-w-lg bg-surface border border-edge rounded-xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-edge-light">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-primary-600" />
                <h3 className="text-sm font-semibold text-content">Scenario Documentation</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-content-muted hover:text-content-secondary transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 max-h-96 overflow-y-auto text-sm text-content-secondary leading-relaxed">
              <V1DescriptionRenderer description={description} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Extracts the playboard data object from the API response.
 */
function extractPlayboardData(resData) {
  if (Array.isArray(resData?.data) && resData.data.length > 0) return resData.data[0];
  if (Array.isArray(resData) && resData.length > 0) return resData[0];
  if (resData && typeof resData === 'object' && resData.widgets) return resData;
  return null;
}

/**
 * Applies a search param override to a single filter's defaultValue attribute.
 */
function applySearchParamToFilter(filter, searchParams) {
  if (!searchParams.has(filter.dataKey)) return;
  if (!Array.isArray(filter.attributes)) return;
  const defaultAttr = filter.attributes.find((attr) => attr.key === 'defaultValue');
  if (defaultAttr) {
    defaultAttr.value = searchParams.get(filter.dataKey);
  } else {
    filter.attributes.push({ key: 'defaultValue', value: searchParams.get(filter.dataKey) });
  }
}

/**
 * Extracts visible filters from a playboard, applying URL search param overrides.
 */
function extractPlayboardFilters(playboardData, searchParams) {
  const filtersArr = Array.isArray(playboardData.widgets?.filters)
    ? playboardData.widgets.filters
        .filter((f) => f.visible !== false && f.status !== 'N')
        .map((f) => ({ ...f, status: f.status === 'active' ? 'Y' : f.status }))
    : [];

  filtersArr.forEach((filter) => applySearchParamToFilter(filter, searchParams));
  return filtersArr;
}

/**
 * Parses pagination options from a string or array value.
 */
function parsePaginationOptions(opts) {
  if (typeof opts === 'string') return opts.split(',').map((v) => parseInt(v.trim(), 10)).filter(Boolean);
  if (Array.isArray(opts)) return opts.map((v) => parseInt(v, 10)).filter(Boolean);
  return [10, 20, 30, 40, 50];
}

/**
 * Reads the pagination widget from playboard config and applies page size and options.
 */
function applyPaginationConfig(playboardData, setPaginationOptions, setPageSize) {
  const pagWidget = resolvePaginationWidget(playboardData.widgets?.pagination);
  if (!pagWidget) return;

  const opts = pagWidget.attributes?.find((a) => a.key === 'options')?.value;
  if (opts) setPaginationOptions(parsePaginationOptions(opts));

  const defaultVal = pagWidget.attributes?.find((a) => a.key === 'defaultValue')?.value;
  if (defaultVal) setPageSize(parseInt(defaultVal, 10));
}

/**
 * Comparator for sorting data rows by a given key and order.
 */
function compareValues(aVal, bVal, order) {
  if (aVal === undefined || bVal === undefined) return 0;

  const aNum = parseFloat(aVal);
  const bNum = parseFloat(bVal);
  if (!isNaN(aNum) && !isNaN(bNum)) {
    return order === 'asc' ? aNum - bNum : bNum - aNum;
  }

  return order === 'asc'
    ? String(aVal).localeCompare(String(bVal))
    : String(bVal).localeCompare(String(aVal));
}

function V1ExplorerReportPage() {
  const { dataDomain, scenarioKey } = useParams();
  const location = useLocation();
  const { getDomainByKey, scenarios } = useExplorer();

  const domain = getDomainByKey(dataDomain);
  const scenario = useMemo(
    () => scenarios.find((s) => s.key === scenarioKey),
    [scenarios, scenarioKey]
  );

  // Playboard state
  const [playboard, setPlayboard] = useState(null);
  const [filterConfig, setFilterConfig] = useState([]);
  const [playboardLoading, setPlayboardLoading] = useState(true);
  const [playboardError, setPlayboardError] = useState('');

  // Filter state
  const [filters, setFilters] = useState({});

  // Data / table state
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTable, setShowTable] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pages, setPages] = useState(1);
  const [, setIsPaginated] = useState(true);
  const [paginationOptions, setPaginationOptions] = useState([10, 20, 30, 40, 50]);

  // Backend pagination tracking
  const [countEvaluated, setCountEvaluated] = useState(false);
  const [end, setEnd] = useState(false);
  const [currentCount, setCurrentCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Sorting
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');

  // Column visibility
  const [, setAllColumns] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState([]);

  // Action grid from playboard
  const actionGrid = useMemo(() => {
    const rowActions = playboard?.widgets?.grid?.actions?.rowActions;
    if (!rowActions) return [];
    if (Array.isArray(rowActions.events)) {
      return rowActions.events.map((event) => ({
        ...event,
        renderAs: rowActions.renderAs || 'button',
      }));
    }
    return [];
  }, [playboard]);

  // --- Fetch playboard config on mount ---
  useEffect(() => {
    const fetchPlayboard = async () => {
      setPlayboardLoading(true);
      setPlayboardError('');
      try {
        const response = await playboardAPI.get(scenarioKey);
        const playboardData = extractPlayboardData(response.data);

        if (!playboardData) {
          setPlayboard(null);
          setFilterConfig([]);
          setPlayboardError('No playboard configuration found for this scenario.');
          return;
        }

        setPlayboard(playboardData);

        const params = new URLSearchParams(location.search);
        const filtersArr = extractPlayboardFilters(playboardData, params);
        setFilterConfig(filtersArr);

        applyPaginationConfig(playboardData, setPaginationOptions, setPageSize);

        if (playboardData.widgets?.grid?.layout?.ispaginated !== undefined) {
          setIsPaginated(!!playboardData.widgets.grid.layout.ispaginated);
        }

        if (!filtersArr || filtersArr.length === 0) {
          setPlayboardError('No filters available for this scenario.');
        }
      } catch {
        setPlayboard(null);
        setFilterConfig([]);
        setPlayboardError('Failed to load filters. Please try again.');
      } finally {
        setPlayboardLoading(false);
      }
    };

    fetchPlayboard();
  }, [scenarioKey, location.search]);

  // --- Auto-submit from URL query params ---
  useEffect(() => {
    if (!filterConfig.length || playboardLoading) return;

    const params = new URLSearchParams(location.search);
    const autoSubmit = params.get('autosubmit') === 'true';
    if (!autoSubmit) return;

    // Build filter values from URL params
    const urlFilters = {};
    const allowedKeys = filterConfig.map((f) => f.dataKey);
    for (const [key, value] of params.entries()) {
      if (key !== 'autosubmit' && allowedKeys.includes(key)) {
        urlFilters[key] = value;
      }
    }

    setFilters(urlFilters);
    setShowTable(true);
    // Trigger fetch
    fetchReport({ ...urlFilters, page: 1, pageSize });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterConfig, playboardLoading]);

  // --- Fetch report data ---
  const fetchReport = useCallback(
    async (params = {}) => {
      if (!playboard?.program_key) return;

      setLoading(true);
      setError('');
      try {
        // eslint-disable-next-line no-unused-vars
        const { page: reqPage, pageSize: reqPageSize, autosubmit: _autosubmit, ...filterValues } = params;

        const logicArgs = buildLogicArgs(filterConfig, filterValues);
        const mergedLogicArgs = mergeLogicArgs(playboard.logic_args, logicArgs);

        const effectivePageSize = typeof reqPageSize === 'number' ? reqPageSize : pageSize;
        const effectivePage = typeof reqPage === 'number' ? reqPage : page;

        const paginatedFlag = playboard.widgets?.grid?.layout?.ispaginated !== undefined
          ? !!playboard.widgets.grid.layout.ispaginated
          : false;

        const pagWidget = resolvePaginationWidget(playboard.widgets?.pagination);
        const paginationConfig = buildPaginationConfig(pagWidget, effectivePageSize, effectivePage);

        // Pagination flags
        const { sendCountEvaluated, sendEnd } = resolvePaginationFlags(effectivePage, pages, countEvaluated, end);
        paginationConfig.count_evaluated = sendCountEvaluated;
        paginationConfig.end = sendEnd;
        paginationConfig.current_count = currentCount;
        paginationConfig.total_count = totalCount;
        paginationConfig.pages = pages;

        const prevailEnv = ENV === 'stg' ? 'stage' : ENV;

        const apiPayload = {
          program_key: playboard.program_key,
          logic_args: mergedLogicArgs,
          addon_configurations: playboard.addon_configurations,
          environment: prevailEnv,
          setting_file_name: prevailEnv,
          pagination: { ...paginationConfig },
          paginated: paginatedFlag,
        };

        const response = await prevailAPI.execute(playboard.key, apiPayload);
        const resData = response.data;

        if (resData?.data) {
          setData(resData.data);
          setPages(calculateTotalPages(resData, paginationConfig.limit, effectivePage));

          if (resData.pagination) {
            const meta = extractPaginationMeta(resData.pagination);
            setCountEvaluated(meta.count_evaluated);
            setCurrentCount(meta.current_count);
            setTotalCount(meta.total_count);
            setEnd(meta.end);
          }
        }
      } catch {
        setError('Failed to fetch data. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [playboard, page, pageSize, filterConfig, countEvaluated, end, currentCount, totalCount, pages]
  );

  // Update columns when data changes — uses getColumnsObj from v1_reportUtils
  // which returns [{key, label}] objects as V1DataTable expects.
  useEffect(() => {
    if (data.length > 0) {
      const cols = getColumnsObj(data);
      setAllColumns(cols);
      setVisibleColumns(cols);
    } else {
      setAllColumns([]);
      setVisibleColumns([]);
    }
  }, [data]);

  // --- Handlers ---
  const handleFilterSubmit = useCallback(
    (formValues) => {
      setFilters(formValues);
      setPage(1);
      setShowTable(true);
      fetchReport({ ...formValues, page: 1, pageSize });
    },
    [fetchReport, pageSize]
  );

  const handlePageChange = useCallback(
    (newPage) => {
      setPage(newPage);
      if (pages > 1 && newPage !== pages) {
        setEnd(false);
      }
      fetchReport({ ...filters, page: newPage, pageSize });
    },
    [fetchReport, filters, pageSize, pages]
  );

  const handlePageSizeChange = useCallback(
    (newPageSize) => {
      const currentSkip = (page - 1) * pageSize;
      const newPage = Math.floor(currentSkip / newPageSize) + 1;
      setPageSize(newPageSize);
      setPage(newPage);
      fetchReport({ ...filters, page: newPage, pageSize: newPageSize });
      setPages(Math.max(1, Math.ceil(totalCount / newPageSize)));
    },
    [fetchReport, filters, page, pageSize, totalCount]
  );

  const handleSort = useCallback(
    (key, order) => {
      // Support 2-arg call from DataTable (key, order) and 1-arg legacy call
      if (order === undefined) {
        order = (sortBy === key && sortOrder === 'asc') ? 'desc' : 'asc';
      }
      setSortBy(key || '');
      setSortOrder(order || '');

      // Only sort locally if a key is provided (clear means unsorted)
      if (key && order) {
        setData((prevData) =>
          [...prevData].sort((a, b) => compareValues(a[key], b[key], order))
        );
      }
    },
    [sortBy, sortOrder]
  );

  // --- Render ---
  return (
    <div>
      <V1Breadcrumbs
        items={[
          { label: domain?.name || dataDomain, path: `/explorer/${dataDomain}` },
          { label: scenario?.name || scenarioKey },
        ]}
      />

      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary-100 rounded-lg">
          <BarChart3 size={24} className="text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-content">
              {scenario?.name || scenarioKey}
            </h1>
            {playboard?.scenarioDescription && (
              <ScenarioDocButton description={playboard.scenarioDescription} />
            )}
          </div>
          {playboard?.scenarioDescription && (
            <p className="text-sm text-content-muted mt-1">
              {getDescriptionSnippet(playboard.scenarioDescription)}
              {shouldShowEllipsis(playboard.scenarioDescription) && '...'}
            </p>
          )}
        </div>
      </div>

      {/* Filter Section */}
      {playboardLoading && <FilterLoadingState />}
      {!playboardLoading && playboardError && <FilterErrorState message={playboardError} />}
      {!playboardLoading && !playboardError && (
        <V1FilterSection
          filterConfig={filterConfig}
          onSubmit={handleFilterSubmit}
          initialFilterValues={filters}
        />
      )}

      {/* Data Table */}
      {loading && <DataLoadingState />}
      {!loading && error && <FilterErrorState message={error} />}
      {!loading && !error && showTable && data.length > 0 && (
        <V1DataTable
          columns={visibleColumns}
          data={data}
          page={page}
          pageSize={pageSize}
          pages={pages}
          onSort={handleSort}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          paginationOptions={paginationOptions}
          actionGrid={actionGrid}
          totalRecords={totalCount}
        />
      )}
      {!loading && !error && showTable && data.length === 0 && <DataEmptyState />}
    </div>
  );
}

export default V1ExplorerReportPage;
