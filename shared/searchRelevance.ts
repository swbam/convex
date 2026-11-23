export function searchKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
// Search indexes can return OR/fuzzy matches. Every query term must be present;
// only the final term can be incomplete while the user is typing.
export function matchesSearch(title: string, query: string): boolean {
  const words = searchKey(title).split(" "), terms = searchKey(query).split(" ").filter(Boolean);
  return terms.length > 0 && terms.every((term, index) => words.some(word => index === terms.length - 1 ? word.startsWith(term) : word === term));
}
export function searchRank(title: string, query: string): number {
  const name = searchKey(title), term = searchKey(query);
  return name === term ? 0 : name.startsWith(`${term} `) || name.startsWith(term) ? 1 : matchesSearch(title, query) ? 2 : 3;
}
