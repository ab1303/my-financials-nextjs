import clsx from 'clsx';

/**
 * Migration utilities for replacing string manipulation with proper class composition
 */

export const stylingUtils = {
  /**
   * Replace string-based class manipulation with proper clsx usage
   * @deprecated Use clsx with conditional classes instead
   */
  replaceClass: (baseClasses: string, oldClass: string, newClass: string) => {
    console.warn(
      'replaceClass is deprecated. Use clsx with conditional classes instead.',
    );
    return baseClasses.replace(oldClass, newClass);
  },

  /**
   * Properly override classes using clsx
   * @param baseClasses - Base class string
   * @param overrides - Object of class prefixes to override
   * @param additionalClasses - Additional classes to add
   */
  overrideClasses: (
    baseClasses: string,
    overrides: Record<string, string>,
    additionalClasses?: string,
  ) => {
    let filteredClasses = baseClasses.split(' ');

    // Remove classes that match override prefixes
    Object.keys(overrides).forEach((prefix) => {
      filteredClasses = filteredClasses.filter(
        (cls) => !cls.startsWith(`${prefix}-`),
      );
    });

    return clsx(filteredClasses, Object.values(overrides), additionalClasses);
  },

  /**
   * Create responsive width utilities
   */
  responsiveWidth: {
    input: {
      full: 'w-full',
      threeQuarter: 'w-3/4',
      twoThird: 'w-2/3',
      half: 'w-1/2',
      third: 'w-1/3',
      quarter: 'w-1/4',
    },
    container: {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-xl',
      '2xl': 'max-w-2xl',
      '3xl': 'max-w-3xl',
      '4xl': 'max-w-4xl',
      '5xl': 'max-w-5xl',
    },
  },
};

export default stylingUtils;
