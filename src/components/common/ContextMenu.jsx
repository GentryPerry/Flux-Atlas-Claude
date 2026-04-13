import { useEffect, useRef } from 'react';

export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} className="context-menu" style={{ left: x, top: y }}>
      {items.map((item, i) => {
        if (item.divider) return <div key={i} className="context-menu-divider" />;
        return (
          <button
            key={i}
            className={`context-menu-item ${item.danger ? 'danger' : ''}`}
            onClick={() => { item.action(); onClose(); }}
          >
            {item.icon && item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
