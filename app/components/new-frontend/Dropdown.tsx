import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { motionVariants } from '~/lib/motion/config';

interface DropdownProps<T> {
  options: T[];
  selected?: T;
  onSelect: (item: T) => void;
  renderItem: (item: T) => ReactNode;
  placeholder?: string;
  icon?: ReactNode;
  className?: string;
  keyExtractor: (item: T) => string;
  minimal?: boolean;
  emptyText?: string;
}

export const Dropdown = <T,>({
  options,
  selected,
  onSelect,
  renderItem,
  placeholder,
  icon,
  className = '',
  keyExtractor,
  minimal = false,
  emptyText = 'Нет доступных значений',
}: DropdownProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const panelVariants = reduceMotion ? motionVariants.modalReduced : motionVariants.modalPanel;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={`ui-focus-ring ui-interactive flex items-center gap-1.5 rounded-[var(--radius-md)] border border-transparent text-sm text-gray-400 ${
          minimal ? 'p-1.5 hover:bg-[rgba(255,255,255,0.08)]' : 'px-2 py-1.5 hover:bg-white/10'
        }`}
      >
        {icon ? <span className={`${selected ? 'text-gray-300' : 'text-gray-400'}`}>{icon}</span> : null}
        {!minimal ? <span className="max-w-[140px] truncate">{selected ? renderItem(selected) : placeholder}</span> : null}
        <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen ? (
          <m.div
            variants={panelVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="surface-card elevation-4 absolute left-0 top-full z-50 mt-2 w-72"
          >
            {placeholder ? <div className="border-b border-white/10 px-3 py-2 text-xs font-medium text-gray-500">{placeholder}</div> : null}

            <div className="max-h-60 overflow-y-auto py-1">
              {options.length === 0 ? <div className="px-3 py-3 text-xs text-gray-500">{emptyText}</div> : null}

              {options.map((item) => {
                const isSelected = selected ? keyExtractor(selected) === keyExtractor(item) : false;

                return (
                  <button
                    key={keyExtractor(item)}
                    type="button"
                    onClick={() => {
                      onSelect(item);
                      setIsOpen(false);
                    }}
                    className="ui-focus-ring ui-interactive flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-gray-300 hover:bg-white/10 hover:text-white"
                  >
                    <span className="truncate">{renderItem(item)}</span>
                    {isSelected ? <Check size={14} className="text-white" /> : null}
                  </button>
                );
              })}
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
