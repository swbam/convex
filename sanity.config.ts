import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { visionTool } from '@sanity/vision';
import { codeInput } from '@sanity/code-input';
import { schema } from './src/sanity/schemaTypes';

// Sanity Studio configuration
// Project ID: i4wz0fvl
// Dataset: production
export default defineConfig({
  name: 'setlists-live-blog',
  title: 'Setlists.live Blog',

  projectId: 'i4wz0fvl',
  dataset: 'production',

  plugins: [
    structureTool(),
    visionTool(),
    codeInput(),
  ],

  schema,

  // Studio appearance
  studio: {
    components: {
      // You can add custom studio components here
    },
  },
});

