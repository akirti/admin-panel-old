import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * SSE hook for tracking EasyWeaver query progress.
 * @param {Object|null} asyncRun - { run_id, sse_url, results_url } or null
 * @param {Function} onComplete - Called with (results_url, statusData) when done
 * @param {Function} onError - Called with error data on failure
 * @returns {{ progress, elapsed, cancel }}
 */
export function useQueryProgress(asyncRun, onComplete, onError) {
  const [progress, setProgress] = useState({
    status: 'queued',
    message: '',
    percent: 0,
    stage: '',
  });
  const [elapsed, setElapsed] = useState(0);
  const eventSourceRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!asyncRun?.sse_url) {
      cleanup();
      return;
    }

    setProgress({ status: 'queued', message: 'Waiting in queue...', percent: 0, stage: '' });
    setElapsed(0);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    const sseUrl = asyncRun.sse_url.startsWith('/')
      ? asyncRun.sse_url
      : `/api/v1${asyncRun.sse_url}`;

    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('progress', (event) => {
      try {
        const data = JSON.parse(event.data);
        setProgress({
          status: data.status || 'running',
          message: data.message || '',
          percent: data.progress || 0,
          stage: data.stage || '',
          totalRows: data.total_rows,
        });

        if (data.status === 'complete') {
          cleanup();
          onComplete?.(asyncRun.results_url, data);
        } else if (data.status === 'error') {
          cleanup();
          onError?.(data);
        }
      } catch (e) {
        console.error('SSE parse error:', e);
      }
    });

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        cleanup();
        onError?.({
          status: 'error',
          code: 'EW-SYS-002',
          message: 'Connection to server lost',
          suggestions: ['Check your network connection', 'Try submitting again'],
        });
      }
    };

    return cleanup;
  }, [asyncRun, onComplete, onError, cleanup]);

  const cancel = useCallback(async () => {
    if (!asyncRun?.run_id) return;
    cleanup();
    try {
      const { default: api } = await import('../services/api');
      await api.post(`/prevail/cancel/${asyncRun.run_id}`);
    } catch (e) {
      console.error('Cancel failed:', e);
    }
  }, [asyncRun, cleanup]);

  return { progress, elapsed, cancel };
}
