export async function load() {
  // Use import.meta.glob to dynamically import raw markdown files
  // .md files must be inside src/lib/data/country-guides
  const modules = import.meta.glob('../../lib/data/country-guides/*.md', { 
    query: '?raw', 
    import: 'default'
  });
  
  const guides = Object.keys(modules).map(path => {
    // Extract filename without extension (e.g. "albania" from "../../lib/data/country-guides/albania.md")
    const filename = path.split('/').pop()?.replace('.md', '') || '';
    const displayName = filename.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    
    return {
      slug: filename,
      name: displayName
    };
  });
  
  // Sort alphabetically
  guides.sort((a, b) => a.name.localeCompare(b.name));
  
  return {
    guides
  };
}