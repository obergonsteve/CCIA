/**
 * next-themes 0.4.6 injects <script> for no-flash theme; React 19 warns on client.
 * Match upstream fix: only emit ThemeScript during SSR (see pacocoursey/next-themes#386).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "node_modules", "next-themes", "dist");
const patches = [
  {
    file: join(root, "index.mjs"),
    from: 'scriptProps:w})=>{let p=JSON.stringify([s,i,a,e,h,l,u,m]).slice(1,-1);return t.createElement("script",{...w,suppressHydrationWarning:!0,nonce:typeof window=="undefined"?d:"",dangerouslySetInnerHTML',
    to: 'scriptProps:w})=>{if(typeof window!=="undefined")return null;let p=JSON.stringify([s,i,a,e,h,l,u,m]).slice(1,-1);return t.createElement("script",{...w,suppressHydrationWarning:!0,nonce:d,dangerouslySetInnerHTML',
  },
  {
    file: join(root, "index.js"),
    from: 'scriptProps:w})=>{let p=JSON.stringify([n,s,d,e,h,u,l,o]).slice(1,-1);return t.createElement("script",{...w,suppressHydrationWarning:!0,nonce:typeof window=="undefined"?m:"",dangerouslySetInnerHTML',
    to: 'scriptProps:w})=>{if(typeof window!=="undefined")return null;let p=JSON.stringify([n,s,d,e,h,u,l,o]).slice(1,-1);return t.createElement("script",{...w,suppressHydrationWarning:!0,nonce:m,dangerouslySetInnerHTML',
  },
];

for (const { file, from, to } of patches) {
  if (!existsSync(file)) continue;
  let text = readFileSync(file, "utf8");
  if (text.includes("if(typeof window!==\"undefined\")return null;let p=JSON.stringify")) {
    continue;
  }
  if (!text.includes(from)) {
    console.warn("fix-next-themes-react19: pattern not found, skip:", file);
    continue;
  }
  text = text.replace(from, to);
  writeFileSync(file, text);
  console.log("fix-next-themes-react19: patched", file);
}
