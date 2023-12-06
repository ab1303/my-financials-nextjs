export type IndividualSlimModel = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
};

export type IndividualSlimCreateModel = Omit<IndividualSlimModel, 'id'> & {
  userId: string;
};
