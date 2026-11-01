// Frozen source records keep their original logical paths and exact bytes.
// Resolve those paths to the maintained originals used by the current release.
const aliases=[['output/releases/v0.6.1/ai-backgrounds/','design/portrait-sources/ai-backgrounds/'],['output/releases/v0.6.3/outcome-originals/','design/outcome-sources/composition-a/originals/'],['output/releases/v0.6.4/outcome-originals/','design/outcome-sources/composition-b/originals/']];
export function artSourcePath(file){const row=aliases.find(([from])=>file.startsWith(from));return row?row[1]+file.slice(row[0].length):file;}
export const portraitSourcePath=artSourcePath;
