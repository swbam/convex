export function articleHeadingText(block: any): string {
  return (block?.children || []).map((child: any) => child.text || '').join('');
}
export function articleHeadingId(block: any): string {
  return `section-${String(block?._key || articleHeadingText(block).toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/[^a-zA-Z0-9_-]/g, '')}`;
}
