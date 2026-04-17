import { error } from '@sveltejs/kit';

export async function load({ params }) {
  const { country } = params;
  
  // Use import.meta.glob to dynamically import raw markdown files
  // .md files must be inside src/lib/data/country-guides
  const modules = import.meta.glob('../../../lib/data/country-guides/*.md', { 
    query: '?raw', 
    import: 'default'
  });
  
  const expectedPath = `../../../lib/data/country-guides/${country}.md`;
  
  if (!modules[expectedPath]) {
    throw error(404, `Guide for country "${country}" not found.`);
  }
  
  const markdownContent = await modules[expectedPath]() as string;
  
  return {
    country,
    markdownContent
  };
}
