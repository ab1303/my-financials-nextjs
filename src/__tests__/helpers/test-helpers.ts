export function makeCategory(name: string) {
  return {
    name,
    id: name.toLowerCase().replace(/\s+/g, '-'),
    createdAt: new Date(),
    iconName: null,
    isActive: true,
  };
}

export function makeCategories(names: string[]) {
  return names.map(makeCategory);
}
