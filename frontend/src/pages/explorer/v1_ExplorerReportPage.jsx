import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useLocation } from 'react-router';
import { Loader2, AlertCircle, BarChart3, BookOpen, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useExplorer } from '../../components/explorer/v1_ExplorerContext';
import V1Breadcrumbs from '../../components/explorer/v1_Breadcrumbs';
import V1FilterSection from '../../components/explorer/v1_FilterSection';
import V1DataTable from '../../components/explorer/v1_DataTable';
import { playboardAPI } from '../../services/api';
import { prevailAPI } from '../../services/v1_explorerApi';
import { getColumnsFromData as getColumnsObj } from '../../utils/v1_reportUtils';
import V1DescriptionRenderer from '../../components/explorer/v1_DescriptionRenderer';

// Date regex for detecting date strings in filter values (YYYY-MM-DD)
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

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
            ? 'bg-red-50 border-red-300 text-red-700'
            : 'bg-neutral-50 border-neutral-300 text-neutral-600 hover:bg-neutral-100'
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
            className="absolute right-4 top-20 z-50 w-full max-w-lg bg-white border border-neutral-200 rounded-xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-red-600" />
                <h3 className="text-sm font-semibold text-neutral-800">Scenario Documentation</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 max-h-96 overflow-y-auto text-sm text-neutral-700 leading-relaxed">
              <V1DescriptionRenderer description={description} />
            </div>
          </div>
        </div>
      )}
    </>
  );
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
  const [isPaginated, setIsPaginated] = useState(true);
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
  const [allColumns, setAllColumns] = useState([]);
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
        let playboardData = null;

        // Handle response shapes: { data: [item] } or { data: { widgets } } or direct object
        const resData = response.data;
        if (Array.isArray(resData?.data) && resData.data.length > 0) {
          playboardData = resData.data[0];
        } else if (Array.isArray(resData) && resData.length > 0) {
          playboardData = resData[0];
        } else if (resData && typeof resData === 'object' && resData.widgets) {
          playboardData = resData;
        }

        if (playboardData) {
          setPlayboard(playboardData);

          // Extract filter config - only visible filters with active status
          // Normalize status: backend may default undefined to "active",
          // but FilterSection expects 'Y' or undefined for rendering
          const filtersArr = Array.isArray(playboardData.widgets?.filters)
            ? playboardData.widgets.filters
                .filter((f) => f.visible !== false && f.status !== 'N')
                .map((f) => ({
                  ...f,
                  status: f.status === 'active' ? 'Y' : f.status,
                }))
            : [];

          // Set default values from URL query params if present
          const params = new URLSearchParams(location.search);
          filtersArr.forEach((filter) => {
            if (params.has(filter.dataKey)) {
              if (Array.isArray(filter.attributes)) {
                const defaultAttr = filter.attributes.find(
                  (attr) => attr.key === 'defaultValue'
                );
                if (defaultAttr) {
                  defaultAttr.value = params.get(filter.dataKey);
                } else {
                  filter.attributes.push({
                    key: 'defaultValue',
                    value: params.get(filter.dataKey),
                  });
                }
              }
            }
          });

          setFilterConfig(filtersArr);

          // Extract pagination config — pagination can be an array or a single object
          const paginationRaw = playboardData.widgets?.pagination;
          const pagWidget = Array.isArray(paginationRaw)
            ? paginationRaw[0]
            : paginationRaw && typeof paginationRaw === 'object' && paginationRaw.attributes
              ? paginationRaw
              : null;
          if (pagWidget) {
            const opts = pagWidget.attributes?.find(
              (a) => a.key === 'options'
            )?.value;
            if (opts) {
              const parsedOpts =
                typeof opts === 'string'
                  ? opts.split(',').map((v) => parseInt(v.trim(), 10)).filter(Boolean)
                  : Array.isArray(opts)
                  ? opts.map((v) => parseInt(v, 10)).filter(Boolean)
                  : [10, 20, 30, 40, 50];
              setPaginationOptions(parsedOpts);
            }
            const defaultVal = pagWidget.attributes?.find(
              (a) => a.key === 'defaultValue'
            )?.value;
            if (defaultVal) setPageSize(parseInt(defaultVal, 10));
          }

          // Check if grid is paginated
          if (playboardData.widgets?.grid?.layout?.ispaginated !== undefined) {
            setIsPaginated(!!playboardData.widgets.grid.layout.ispaginated);
          }

          if (!filtersArr || filtersArr.length === 0) {
            setPlayboardError('No filters available for this scenario.');
          }
        } else {
          setPlayboard(null);
          setFilterConfig([]);
          setPlayboardError('No playboard configuration found for this scenario.');
        }
      } catch (err) {
        console.error('Failed to load playboard:', err);
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
        const { page: reqPage, pageSize: reqPageSize, autosubmit, ...filterValues } = params;

        // Build logic_args from filter values, keyed by filter.index
        const logic_args = {};
        if (Array.isArray(filterConfig) && filterConfig.length > 0) {
          filterConfig.forEach((filter) => {
            const step = filter.index != null ? filter.index.toString() : '0';
            if (!logic_args[step]) logic_args[step] = { query_params: {} };
            if (filter.dataKey in filterValues) {
              let value = filterValues[filter.dataKey];
              // Strip dashes from date values
              if (typeof value === 'string' && dateRegex.test(value)) {
                logic_args[step].query_params[filter.dataKey] = value.replace(/-/g, '');
              } else if (filter.type === 'multi-select' && typeof value === 'string') {
                logic_args[step].query_params[filter.dataKey] = value
                  .split(',')
                  .map((v) => v.trim());
              } else {
                logic_args[step].query_params[filter.dataKey] = value;
              }
            }
          });
        }

        // Map any remaining params not in filterConfig to step 0
        Object.keys(filterValues).forEach((key) => {
          const alreadyMapped = filterConfig?.some((f) => f.dataKey === key);
          if (!alreadyMapped) {
            if (!logic_args['0']) logic_args['0'] = { query_params: {} };
            let value = filterValues[key];
            if (typeof value === 'string' && dateRegex.test(value)) {
              logic_args['0'].query_params[key] = value.replace(/-/g, '');
            } else if (typeof value === 'string' && value.includes(',')) {
              logic_args['0'].query_params[key] = value.split(',').map((v) => v.trim());
            } else {
              logic_args['0'].query_params[key] = value;
            }
          }
        });

        if (!logic_args['0']) logic_args['0'] = { query_params: {} };

        // Merge user filter values into playboard's logic_args structure
        // FIX: Original code used `playboard.logic_args || logic_args` which ignores user filters
        // when playboard.logic_args exists. Instead, merge user values into playboard's base.
        let mergedLogicArgs = logic_args;
        if (playboard.logic_args && typeof playboard.logic_args === 'object') {
          mergedLogicArgs = { ...playboard.logic_args };
          Object.keys(logic_args).forEach((step) => {
            if (!mergedLogicArgs[step]) {
              mergedLogicArgs[step] = logic_args[step];
            } else {
              mergedLogicArgs[step] = {
                ...mergedLogicArgs[step],
                query_params: {
                  ...(mergedLogicArgs[step].query_params || {}),
                  ...(logic_args[step].query_params || {}),
                },
              };
            }
          });
        }

        // Build pagination config
        const effectivePageSize = typeof reqPageSize === 'number' ? reqPageSize : pageSize;
        const effectivePage = typeof reqPage === 'number' ? reqPage : page;

        let paginatedFlag = false;
        if (playboard.widgets?.grid?.layout?.ispaginated !== undefined) {
          paginatedFlag = !!playboard.widgets.grid.layout.ispaginated;
        }

        let paginationConfig = {
          limit: 0,
          size: 0,
          skip: 0,
          page: 0,
        };

        const fetchPagRaw = playboard.widgets?.pagination;
        const fetchPagWidget = Array.isArray(fetchPagRaw)
          ? fetchPagRaw[0]
          : fetchPagRaw && typeof fetchPagRaw === 'object' && fetchPagRaw.attributes
            ? fetchPagRaw
            : null;
        if (fetchPagWidget) {
          const pagAttrs = fetchPagWidget.attributes || [];
          const defaultLimitAttr = pagAttrs.find((attr) => attr.key === 'defaultValue');
          const defaultLimit = defaultLimitAttr
            ? parseInt(defaultLimitAttr.value, 10)
            : 0;

          const actualPageSize = effectivePageSize || defaultLimit;
          const actualPage = effectivePage || 1;

          paginationConfig.limit = actualPageSize;
          paginationConfig.size = actualPageSize;
          paginationConfig.skip = (actualPage - 1) * actualPageSize;
          paginationConfig.page = actualPage - 1;
        }

        // Pagination flags
        let sendCountEvaluated = countEvaluated;
        let sendEnd = end;
        if (effectivePage === 1) {
          sendCountEvaluated = false;
          sendEnd = false;
        } else if (pages > 1 && effectivePage === pages) {
          sendEnd = true;
        } else {
          sendEnd = false;
        }

        paginationConfig.count_evaluated = sendCountEvaluated;
        paginationConfig.end = sendEnd;
        paginationConfig.current_count = currentCount;
        paginationConfig.total_count = totalCount;
        paginationConfig.pages = pages;

        // Determine environment
        const appEnv = window.__env?.ENV || 'dev';
        const prevailEnv = appEnv === 'stg' ? 'stage' : appEnv;

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

          // Update pagination tracking from response
          const totalPages = getTotalPages(resData, paginationConfig.limit);
          setPages(totalPages);

          if (resData.pagination) {
            setCountEvaluated(resData.pagination.count_evaluated ?? false);
            setCurrentCount(resData.pagination.current_count ?? 0);
            setTotalCount(resData.pagination.total_count ?? 0);
            setEnd(resData.pagination.end ?? false);
          }
        }
      } catch (err) {
        console.error('Failed to fetch report data:', err);
        setError('Failed to fetch data. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [playboard, page, pageSize, filterConfig, countEvaluated, end, currentCount, totalCount, pages]
  );

  // --- Helpers ---
  function getTotalPages(response, limit) {
    if (!limit || limit === 0) return 1;
    const total = response?.pagination?.total_count || response?.total_count || 0;
    if (total > 0) return Math.ceil(total / limit);
    const dataLen = response?.data?.length || 0;
    if (dataLen < limit) return page; // current page is the last
    return page + 1; // at least one more page
  }

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
    (key) => {
      let order = 'asc';
      if (sortBy === key && sortOrder === 'asc') order = 'desc';
      setSortBy(key);
      setSortOrder(order);

      setData((prevData) => {
        const sorted = [...prevData].sort((a, b) => {
          const aVal = a[key];
          const bVal = b[key];
          if (aVal === undefined || bVal === undefined) return 0;

          const aNum = parseFloat(aVal);
          const bNum = parseFloat(bVal);
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return order === 'asc' ? aNum - bNum : bNum - aNum;
          }

          return order === 'asc'
            ? String(aVal).localeCompare(String(bVal))
            : String(bVal).localeCompare(String(aVal));
        });
        return sorted;
      });
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
        <div className="p-2 bg-red-100 rounded-lg">
          <BarChart3 size={24} className="text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-neutral-800">
              {scenario?.name || scenarioKey}
            </h1>
            {playboard?.scenarioDescription && (
              <ScenarioDocButton description={playboard.scenarioDescription} />
            )}
          </div>
          {playboard?.scenarioDescription && (
            <p className="text-sm text-neutral-500 mt-1">
              {typeof playboard.scenarioDescription === 'string'
                ? playboard.scenarioDescription.replace(/<[^>]*>/g, '').slice(0, 120)
                : Array.isArray(playboard.scenarioDescription)
                  ? playboard.scenarioDescription
                      .filter((d) => d.text && d.status !== 'I')
                      .map((d) => d.text.replace(/<[^>]*>/g, ''))
                      .join(' — ')
                      .slice(0, 120)
                  : ''}
              {((typeof playboard.scenarioDescription === 'string' && playboard.scenarioDescription.length > 120) ||
                (Array.isArray(playboard.scenarioDescription) && playboard.scenarioDescription.filter((d) => d.text && d.status !== 'I').map((d) => d.text).join(' — ').length > 120)) && '...'}
            </p>
          )}
        </div>
      </div>

      {/* Filter Section */}
      {playboardLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-red-600 mr-2" />
          <span className="text-neutral-500">Loading filters...</span>
        </div>
      ) : playboardError ? (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
          <AlertCircle size={20} className="text-red-600" />
          <span className="text-red-700">{playboardError}</span>
        </div>
      ) : (
        <V1FilterSection
          filterConfig={filterConfig}
          onSubmit={handleFilterSubmit}
          initialFilterValues={filters}
        />
      )}

      {/* Data Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-red-600 mr-3" />
          <span className="text-neutral-500 text-lg">Loading data...</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle size={20} className="text-red-600" />
          <span className="text-red-700">{error}</span>
        </div>
      ) : showTable && data.length > 0 ? (
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
      ) : showTable && data.length === 0 ? (
        <div className="text-center py-12 text-neutral-500">
          <BarChart3 size={48} className="mx-auto mb-4 text-neutral-300" />
          <p className="text-lg font-medium">No data found</p>
          <p className="text-sm mt-1">Try adjusting your filter criteria</p>
        </div>
      ) : null}
    </div>
  );
}

export default V1ExplorerReportPage;
