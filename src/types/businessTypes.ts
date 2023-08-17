export type Address = {
  addressLine: string;
  street_address: string;
  suburb: string;
  postcode: string;
  state: string;
};

export type BankType = {
  bankName: string;
  address: Address;
};

export type ProfileType = {
  firstName: string;
  lastName: string;
  profileImageUrl: string;
  contact: string;
};

