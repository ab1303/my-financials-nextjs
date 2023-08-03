export type Address = {
  addressLine: string;
  street_address: string;
  suburb: string;
  postcode: string;
  state: string;
};

export type RestaurantFormData = {
  restaurantName: string;
  imageUrl: string;
  thumbnailUrl: string;
  cuisine: string;
  contact: string;
  address: Address;
  categories: string[];
};
