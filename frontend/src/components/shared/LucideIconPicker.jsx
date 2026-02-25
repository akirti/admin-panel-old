import { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

// Build icon names list - filter to only actual icon components
const getIconNames = () => {
  const excluded = new Set([
    'createLucideIcon',
    'default',
    'icons',
    'createElement',
    'createReactComponent',
    'Icon',
    'LucideIcon',
  ]);

  return Object.keys(LucideIcons).filter((key) => {
    if (excluded.has(key)) return false;
    if (!/^[A-Z]/.test(key)) return false;
    const component = LucideIcons[key];
    return typeof component === 'function' || typeof component === 'object';
  });
};

const ALL_ICON_NAMES = getIconNames();

// Popular icons to show by default
const POPULAR_ICONS = [
  'Home', 'User', 'Users', 'Settings', 'Search', 'Mail', 'Phone', 'Calendar',
  'Clock', 'Star', 'Heart', 'Bell', 'Camera', 'Image', 'File', 'Folder',
  'FileText', 'Database', 'Server', 'Cloud', 'Globe', 'Map', 'MapPin', 'Layers',
  'Grid', 'List', 'Table', 'BarChart2', 'PieChart', 'Activity', 'TrendingUp',
  'Zap', 'Shield', 'Lock', 'Unlock', 'Key', 'Eye', 'EyeOff', 'Edit', 'Edit2',
  'Trash', 'Trash2', 'Plus', 'Minus', 'Check', 'X', 'AlertCircle', 'AlertTriangle',
  'Info', 'HelpCircle', 'MessageCircle', 'MessageSquare', 'Send', 'Download',
  'Upload', 'Share', 'Share2', 'Link', 'ExternalLink', 'Bookmark', 'Tag',
  'Hash', 'AtSign', 'DollarSign', 'CreditCard', 'ShoppingCart', 'ShoppingBag',
  'Package', 'Truck', 'Building', 'Building2', 'Briefcase', 'Award', 'Gift',
  'Coffee', 'Cpu', 'Monitor', 'Smartphone', 'Tablet', 'Laptop', 'Printer',
  'Wifi', 'Bluetooth', 'Battery', 'Power', 'Sun', 'Moon', 'CloudRain',
  'Thermometer', 'Droplet', 'Wind', 'Umbrella', 'Music', 'Video', 'Film',
  'Play', 'Pause', 'Square', 'Circle', 'Triangle', 'Hexagon', 'Octagon',
];

function LucideIconPicker({ onChange, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');
  const [iconCount, setIconCount] = useState(0);

  useEffect(() => {
    setIconCount(ALL_ICON_NAMES.length);
  }, []);

  const filteredIcons = useMemo(() => {
    if (!searchTerm.trim()) {
      return POPULAR_ICONS.filter(name => ALL_ICON_NAMES.includes(name));
    }

    const term = searchTerm.toLowerCase().trim();
    return ALL_ICON_NAMES.filter((name) =>
      name.toLowerCase().includes(term)
    ).slice(0, 120);
  }, [searchTerm]);

  const handleSelectIcon = useCallback((iconName) => {
    try {
      // Get the SVG element from the rendered icon in the grid
      const iconButton = document.querySelector(`[data-icon-name="${iconName}"] svg`);

      if (!iconButton) {
        console.error('Could not find rendered icon:', iconName);
        return;
      }

      // Clone the SVG element
      const svgClone = iconButton.cloneNode(true);

      // Set the stroke color on the cloned SVG
      svgClone.setAttribute('stroke', selectedColor);
      svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      // Serialize to string
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgClone);

      // Convert to base64 data URI
      const base64 = btoa(svgString);
      const dataUri = `data:image/svg+xml;base64,${base64}`;

      onChange(dataUri);
      onClose();
    } catch (error) {
      console.error('Error converting icon:', error);
      alert('Failed to select icon. Please try again.');
    }
  }, [selectedColor, onChange, onClose]);

  const colorPresets = [
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Gray', value: '#6b7280' },
    { name: 'Black', value: '#000000' },
  ];

  const renderIcon = (iconName) => {
    const IconComponent = LucideIcons[iconName];
    if (!IconComponent) return null;

    try {
      return <IconComponent size={24} />;
    } catch {
      return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Select Icon ({iconCount} available)</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-neutral-100 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search and Color */}
        <div className="p-4 border-b space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search icons... (e.g., home, user, settings)"
              className="input-field pl-10 w-full"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-600">Color:</span>
            <div className="flex gap-1">
              {colorPresets.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setSelectedColor(color.value)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    selectedColor === color.value
                      ? 'border-neutral-800 ring-2 ring-offset-1 ring-neutral-400'
                      : 'border-neutral-200 hover:border-neutral-400'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="w-6 h-6 cursor-pointer border rounded"
              title="Custom color"
            />
          </div>
        </div>

        {/* Icons Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredIcons.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              <p>No icons found for "{searchTerm}"</p>
              <p className="text-sm mt-2">Try searching for: home, user, settings, mail, star, etc.</p>
            </div>
          ) : (
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
              {filteredIcons.map((iconName) => {
                const icon = renderIcon(iconName);
                if (!icon) return null;

                return (
                  <button
                    key={iconName}
                    type="button"
                    data-icon-name={iconName}
                    onClick={() => handleSelectIcon(iconName)}
                    className="flex flex-col items-center p-2 rounded-lg hover:bg-neutral-100 transition-colors group border border-transparent hover:border-neutral-200"
                    title={`Select ${iconName}`}
                  >
                    <div
                      className="w-8 h-8 flex items-center justify-center"
                      style={{ color: selectedColor }}
                    >
                      {icon}
                    </div>
                    <span className="text-[10px] text-neutral-500 mt-1 truncate w-full text-center group-hover:text-neutral-700">
                      {iconName.length > 10 ? iconName.slice(0, 9) + '…' : iconName}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-neutral-50 text-sm text-neutral-500 flex justify-between items-center">
          <span>
            {searchTerm
              ? `${filteredIcons.length} icons matching "${searchTerm}"`
              : `Showing ${filteredIcons.length} popular icons`
            }
          </span>
          <span className="text-xs">Click an icon to select</span>
        </div>
      </div>
    </div>
  );
}

export default LucideIconPicker;
