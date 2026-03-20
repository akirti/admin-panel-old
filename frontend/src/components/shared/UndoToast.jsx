import { useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Undo2 } from 'lucide-react';

/**
 * Shows a toast with an Undo button. If user clicks Undo within the timeout,
 * the onUndo callback runs instead of onConfirm.
 *
 * Usage:
 *   const undoDelete = useUndoAction();
 *   undoDelete({
 *     message: 'User deleted',
 *     onConfirm: () => api.delete(id),
 *     onUndo: () => {},  // optional
 *     timeout: 5000,
 *   });
 */
export function useUndoAction() {
  const timerRef = useRef(null);

  return useCallback(({ message, onConfirm, onUndo, timeout = 5000 }) => {
    let undone = false;

    const toastId = toast(
      (t) => (
        <div className="flex items-center gap-3">
          <span className="text-sm">{message}</span>
          <button
            onClick={() => {
              undone = true;
              toast.dismiss(t.id);
              if (timerRef.current) clearTimeout(timerRef.current);
              if (onUndo) onUndo();
              toast.success('Action undone', { duration: 2000 });
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-primary-600 text-white rounded hover:bg-primary-700 whitespace-nowrap"
          >
            <Undo2 size={12} /> Undo
          </button>
        </div>
      ),
      { duration: timeout, id: `undo-${Date.now()}` }
    );

    timerRef.current = setTimeout(() => {
      if (!undone) {
        onConfirm();
      }
      toast.dismiss(toastId);
    }, timeout);
  }, []);
}

export default useUndoAction;
