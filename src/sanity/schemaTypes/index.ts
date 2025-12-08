import type { SchemaTypeDefinition } from 'sanity';
import { postType } from './post';
import { authorType } from './author';
import { categoryType } from './category';
import { blockContentType } from './blockContent';

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [postType, authorType, categoryType, blockContentType],
};


