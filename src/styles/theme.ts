// Theme configuration for custom components
// This replaces the previous flowbite theme configuration
//
// USAGE EXAMPLES:
//
// Tables:
//   import { tableStyles } from '@/styles/theme';
//   <Table className={tableStyles.container.compact}>
//
// Buttons:
//   import { buttonStyles } from '@/styles/theme';
//   <button className={buttonStyles.primary}>Primary Button</button>
//   <button className={clsx(buttonStyles.icon, 'bg-teal-100 text-teal-600')}>Icon Button</button>
//
// Inputs:
//   import { inputStyles } from '@/styles/theme';
//   <input className={inputStyles.base} />
//
// Layouts:
//   import { layoutStyles } from '@/styles/theme';
//   <div className={layoutStyles.container['4xl']}>Content</div>
//   <form className={layoutStyles.spacing.section}>Form content</form>
//
// Cards:
//   import { cardStyles } from '@/styles/theme';
//   <div className={cardStyles.interactive}>Card content</div>
//
// Navigation:
//   import { navigationStyles } from '@/styles/theme';
//   <nav className={clsx(navigationStyles.sidebar.base, isOpen ? navigationStyles.sidebar.open : navigationStyles.sidebar.closed)}>
//   <button className={navigationStyles.navItem.base}>Nav Item</button>
//
// Modals:
//   import { enhancedModalStyles } from '@/styles/theme';
//   <Modal.Body className={enhancedModalStyles.body.flowbite}>
//
// Colors:
//   import { colorStyles } from '@/styles/theme';
//   <div className={clsx('p-4', colorStyles.primary.bg, colorStyles.primary.text)}>

export const theme = {
  // Basic theme object to maintain compatibility
  // Components now use Tailwind classes directly
};

// Common input styling classes for consistent styling across the app
export const inputStyles = {
  base: 'block w-full px-3 py-2 text-sm border border-gray-300 bg-gray-50 text-gray-900 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500',
  withIcon:
    'block w-full pl-10 px-3 py-2 text-sm border border-gray-300 bg-gray-50 text-gray-900 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500',
  error:
    'block w-full px-3 py-2 text-sm border border-red-300 bg-red-50 text-red-900 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500',
  disabled:
    'block w-full px-3 py-2 text-sm border border-gray-200 bg-gray-100 text-gray-500 rounded-lg cursor-not-allowed',
};

// Button styling for consistency
export const buttonStyles = {
  primary:
    'inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-teal-600 border border-transparent rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  secondary:
    'inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  icon: 'inline-flex items-center justify-center w-10 h-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  iconSmall:
    'inline-flex items-center justify-center w-8 h-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  iconLarge:
    'inline-flex items-center justify-center w-12 h-12 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  iconCompact:
    'p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed',
};

// Container and layout utility classes
export const layoutStyles = {
  // Container widths
  container: {
    sm: 'max-w-sm mx-auto',
    md: 'max-w-md mx-auto',
    lg: 'max-w-lg mx-auto',
    xl: 'max-w-xl mx-auto',
    '2xl': 'max-w-2xl mx-auto',
    '3xl': 'max-w-3xl mx-auto',
    '4xl': 'max-w-4xl mx-auto',
    '5xl': 'max-w-5xl mx-auto',
    '6xl': 'max-w-6xl mx-auto',
    '7xl': 'max-w-7xl mx-auto',
    full: 'w-full',
    screen: 'min-h-screen',
  },
  // Spacing utilities
  spacing: {
    section: 'space-y-6',
    sectionSm: 'space-y-3',
    sectionLg: 'space-y-8',
    grid: 'gap-4',
    gridSm: 'gap-2',
    gridLg: 'gap-6',
  },
  // Padding utilities
  padding: {
    section: 'p-6',
    sectionSm: 'p-4',
    sectionLg: 'p-8',
    card: 'p-4',
    cardSm: 'p-3',
    cardLg: 'p-6',
  },
};

// Table styling utilities
export const tableStyles = {
  // Table container sizing
  container: {
    compact: 'max-w-4xl',
    medium: 'max-w-5xl',
    large: 'max-w-6xl',
    full: 'w-full',
  },
  // Table wrapper (the div that contains the table)
  wrapper: {
    base: 'overflow-x-auto shadow-sm border border-gray-200 rounded-lg',
    withBorder: 'overflow-x-auto shadow-sm border border-gray-200 rounded-lg',
    simple: 'overflow-x-auto rounded-lg',
  },
  // Table element itself
  table: {
    base: 'min-w-full divide-y divide-gray-200',
    striped: 'min-w-full divide-y divide-gray-200',
    bordered: 'min-w-full divide-y divide-gray-200 border-collapse',
  },
};

// Card and panel styling
export const cardStyles = {
  base: 'bg-white border border-gray-200 rounded-lg shadow-sm',
  interactive:
    'bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow',
  elevated: 'bg-white border border-gray-200 rounded-lg shadow-md',
  flat: 'bg-white border border-gray-200 rounded-lg',
};

// Modal and overlay styling
export const modalStyles = {
  overlay: 'fixed inset-0 bg-black bg-opacity-50 z-50',
  container: 'fixed inset-0 z-50 overflow-y-auto',
  wrapper: 'flex min-h-full items-center justify-center p-4',
  content: 'bg-white rounded-lg shadow-xl max-w-lg w-full p-6',
  contentLarge: 'bg-white rounded-lg shadow-xl max-w-4xl w-full p-6',
};

// Form styling utilities
export const formStyles = {
  fieldset: 'space-y-6',
  fieldsetSm: 'space-y-3',
  fieldsetLg: 'space-y-8',
  field: 'space-y-1',
  label: 'block text-sm font-medium text-gray-700',
  helpText: 'text-sm text-gray-500',
  errorText: 'text-sm text-red-600',
};

// Navigation and sidebar styling (based on SideNav components)
export const navigationStyles = {
  // Sidebar container
  sidebar: {
    base: 'absolute inset-y-0 left-0 z-20 w-64 transform bg-white shadow-sm transition duration-200 ease-in-out',
    open: 'translate-x-0',
    closed: '-translate-x-full',
  },
  // Navigation header
  header: {
    base: 'relative flex h-14 items-center justify-between',
    closeButton: 'p-2 focus-visible:outline-none',
  },
  // Navigation list
  navList: {
    base: 'flex flex-col text-sm',
    nested: 'pl-3 text-gray-500',
  },
  // Navigation items
  navItem: {
    base: 'flex h-14 w-full items-center justify-start space-x-3 border-b-2 hover:border-cyan-300 hover:bg-gray-100',
    link: 'flex h-14 items-center justify-between rounded-sm hover:border-cyan-300 hover:bg-gray-100',
    active: 'text-cyan-600',
    inactive: 'text-gray-600',
    icon: 'w-5 h-5 mx-5',
    text: 'text-lg font-bold text-gray-600',
  },
  // Disclosure/collapsible sections
  disclosure: {
    button:
      'flex h-14 w-full items-center justify-start space-x-3 border-b-2 hover:border-cyan-300 hover:bg-gray-100',
    panel: 'pl-3 text-gray-500',
  },
};

// Footer styling utilities (for future use)
export const footerStyles = {
  root: {
    base: 'flex flex-col',
  },
  brand: {
    base: 'm-6 flex items-center',
  },
  groupLink: {
    base: 'flex flex-col flex-wrap text-gray-500',
    link: 'mb-4 last:mr-0 md:mr-6',
  },
  icon: {
    base: 'text-gray-400 hover:text-gray-900',
  },
};

// Enhanced modal styling (extending the existing modalStyles)
export const enhancedModalStyles = {
  ...modalStyles,
  // Modal body styling based on flowbite theme
  body: {
    base: 'px-6 py-6 space-y-6',
    compact: 'px-4 py-4 space-y-3',
    spacious: 'px-8 py-8 space-y-8',
    // Flowbite-style body spacing
    flowbite: 'space-y-6 px-6 pb-4 sm:pb-6 lg:px-8 xl:pb-8',
  },
  header: {
    base: 'px-6 pt-6 pb-4 border-b border-gray-200',
    simple: 'px-6 pt-6 pb-4',
  },
  footer: {
    base: 'px-6 pt-4 pb-6 border-t border-gray-200 flex justify-end gap-3',
    simple: 'px-6 pt-4 pb-6 flex justify-end gap-3',
  },
};

// List and itemGroup styling utilities
export const listStyles = {
  base: 'space-y-2 py-2 list-none',
  itemGroup:
    'list-none border-t border-gray-200 pt-3 first:mt-0 first:border-t-0 first:pt-0',
  item: {
    base: 'no-underline flex items-center rounded-lg p-2 text-lg font-normal text-gray-900 hover:bg-gray-100',
    active: 'bg-gray-100 text-gray-900',
    inactive: 'text-gray-700',
  },
};

// Color scheme utilities (to maintain consistency across the app)
export const colorStyles = {
  primary: {
    text: 'text-teal-600',
    bg: 'bg-teal-600',
    border: 'border-teal-600',
    hover: {
      text: 'hover:text-teal-700',
      bg: 'hover:bg-teal-700',
      border: 'hover:border-teal-700',
    },
    focus: 'focus:ring-teal-500',
  },
  secondary: {
    text: 'text-cyan-600',
    bg: 'bg-cyan-600',
    border: 'border-cyan-600',
    hover: {
      text: 'hover:text-cyan-700',
      bg: 'hover:bg-cyan-700',
      border: 'hover:border-cyan-700',
    },
    focus: 'focus:ring-cyan-500',
  },
  neutral: {
    text: 'text-gray-600',
    bg: 'bg-gray-100',
    border: 'border-gray-300',
    hover: {
      text: 'hover:text-gray-700',
      bg: 'hover:bg-gray-200',
      border: 'hover:border-gray-400',
    },
    focus: 'focus:ring-gray-500',
  },
  danger: {
    text: 'text-red-600',
    bg: 'bg-red-600',
    border: 'border-red-600',
    hover: {
      text: 'hover:text-red-700',
      bg: 'hover:bg-red-700',
      border: 'hover:border-red-700',
    },
    focus: 'focus:ring-red-500',
  },
};

// Transition and animation utilities
export const transitionStyles = {
  // Common transitions
  default: 'transition duration-200 ease-in-out',
  fast: 'transition duration-150 ease-in-out',
  slow: 'transition duration-300 ease-in-out',

  // Specific transition types
  colors: 'transition-colors duration-200',
  transform: 'transform transition duration-200 ease-in-out',
  shadow: 'transition-shadow duration-200',
  all: 'transition-all duration-200',

  // Animation states
  slideIn: {
    enter: 'ease-out duration-200',
    enterFrom: 'opacity-0 translate-x-full',
    enterTo: 'opacity-100 translate-x-0',
    leave: 'ease-in duration-150',
    leaveFrom: 'opacity-100 translate-x-0',
    leaveTo: 'opacity-0 translate-x-full',
  },
  fadeIn: {
    enter: 'ease-out duration-200',
    enterFrom: 'opacity-0',
    enterTo: 'opacity-100',
    leave: 'ease-in duration-150',
    leaveFrom: 'opacity-100',
    leaveTo: 'opacity-0',
  },
  scale: {
    enter: 'ease-out duration-200',
    enterFrom: 'opacity-0 scale-95',
    enterTo: 'opacity-100 scale-100',
    leave: 'ease-in duration-150',
    leaveFrom: 'opacity-100 scale-100',
    leaveTo: 'opacity-0 scale-95',
  },
};

// Responsive utilities
export const responsiveStyles = {
  // Responsive text sizes
  text: {
    responsive: 'text-sm sm:text-base md:text-lg',
    heading: 'text-lg sm:text-xl md:text-2xl lg:text-3xl',
    subheading: 'text-base sm:text-lg md:text-xl',
  },
  // Responsive spacing
  spacing: {
    responsive: 'p-4 sm:p-6 md:p-8',
    section: 'py-8 sm:py-12 md:py-16 lg:py-20',
    container: 'px-4 sm:px-6 lg:px-8',
  },
  // Responsive grids
  grid: {
    responsive: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    cards: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  },
};
