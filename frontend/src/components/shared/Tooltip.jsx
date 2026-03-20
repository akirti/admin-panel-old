import { memo, useState, useRef } from 'react';
import { HelpCircle } from 'lucide-react';

const Tooltip = memo(function Tooltip({ text, children, position = 'top' }) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef(null);

  const show = () => {
    timeoutRef.current = setTimeout(() => setVisible(true), 300);
  };

  const hide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children || (
        <HelpCircle size={14} className="text-content-muted cursor-help" tabIndex={0} aria-label={text} />
      )}
      {visible && (
        <span
          className={`absolute ${positionClasses[position]} z-50 px-2 py-1 text-xs text-white bg-neutral-800 rounded shadow-lg whitespace-nowrap pointer-events-none`}
          role="tooltip"
        >
          {text}
        </span>
      )}
    </span>
  );
});

export default Tooltip;
