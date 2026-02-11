import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((open) => !open)}
        className={`flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors rounded-md ${minimal ? 'p-1.5 hover:bg-white/5' : 'px-2 py-1.5 hover:bg-white/10'}`}
      >
        {icon ? <span className={`${selected ? 'text-gray-300' : 'text-gray-400'}`}>{icon}</span> : null}
        {!minimal ? <span className="truncate max-w-[140px]">{selected ? renderItem(selected) : placeholder}</span> : null}
        <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen ? (
        <div className="absolute top-full left-0 mt-2 w-72 bg-[#252525] border border-[#3e3e3e] rounded-xl shadow-2xl z-50 overflow-hidden">
          {placeholder ? (
            <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b border-[#3e3e3e]">{placeholder}</div>
          ) : null}

          <div className="max-h-60 overflow-y-auto py-1">
            {options.length === 0 ? (
              <div className="px-3 py-3 text-xs text-gray-500">{emptyText}</div>
            ) : null}

            {options.map((item) => {
              const isSelected = selected ? keyExtractor(selected) === keyExtractor(item) : false;

              return (
                <div
                  key={keyExtractor(item)}
                  onClick={() => {
                    onSelect(item);
                    setIsOpen(false);
                  }}
                  className="flex items-center justify-between px-3 py-2.5 text-sm text-gray-300 hover:bg-[#2f2f2f] hover:text-white cursor-pointer"
                >
                  <span className="truncate">{renderItem(item)}</span>
                  {isSelected ? <Check size={14} className="text-white" /> : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};
