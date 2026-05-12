import {
  MdShoppingBag,
  MdShoppingCart,
  MdRestaurant,
  MdTheaterComedy,
  MdHome,
  MdElectricBolt,
  MdWallet,
  MdCardGiftcard,
  MdDirectionsCar,
  MdFavoriteBorder,
  MdLibraryBooks,
  MdFlightTakeoff,
  MdChildCare,
  MdReceipt,
  MdFitnessCenter,
  MdStars,
  MdSecurity,
  MdPercent,
  MdWork,
  MdHouse,
  MdPets,
  MdHandshake,
} from 'react-icons/md';

export type IconName =
  | 'shopping-bag'
  | 'shopping-cart'
  | 'utensils'
  | 'theater-masks'
  | 'home'
  | 'lightbulb'
  | 'wallet'
  | 'gift'
  | 'car'
  | 'heart-pulse'
  | 'book'
  | 'plane'
  | 'baby'
  | 'receipt'
  | 'dumbbell'
  | 'sparkles'
  | 'shield'
  | 'percent'
  | 'briefcase'
  | 'house'
  | 'paw'
  | 'handshake';

/**
 * Mapping of category icon names to react-icons components.
 * Uses Material Design (MD) icons from react-icons for consistency.
 *
 * Each entry corresponds to an ExpenseCategory.iconName value in the database.
 * Icons are rendered on the client side using this mapping.
 */
export const CATEGORY_ICON_MAP: Record<IconName, React.ComponentType<any>> = {
  'shopping-bag': MdShoppingBag,
  'shopping-cart': MdShoppingCart,
  'utensils': MdRestaurant,
  'theater-masks': MdTheaterComedy,
  'home': MdHome,
  'lightbulb': MdElectricBolt,
  'wallet': MdWallet,
  'gift': MdCardGiftcard,
  'car': MdDirectionsCar,
  'heart-pulse': MdFavoriteBorder,
  'book': MdLibraryBooks,
  'plane': MdFlightTakeoff,
  'baby': MdChildCare,
  'receipt': MdReceipt,
  'dumbbell': MdFitnessCenter,
  'sparkles': MdStars,
  'shield': MdSecurity,
  'percent': MdPercent,
  'briefcase': MdWork,
  'house': MdHouse,
  'paw': MdPets,
  'handshake': MdHandshake,
};

/**
 * Get the icon component for a category icon name.
 * @param iconName - The icon name from ExpenseCategory.iconName
 * @returns The React icon component, or a fallback if not found
 */
export function getCategoryIcon(
  iconName: string | null | undefined,
): React.ComponentType<any> {
  if (!iconName || !(iconName in CATEGORY_ICON_MAP)) {
    return MdShoppingCart; // Default fallback icon
  }
  return CATEGORY_ICON_MAP[iconName as IconName];
}
