// Read-only export of published source material; never logs credentials.
import { writeFile } from 'node:fs/promises';
const rows=[];
let cursor='';
for (;;) {
 const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/articles');
 url.search=new URLSearchParams({select:'id,title,slug,excerpt,content,updated_at,categories(name)',status:'eq.published',order:'id.asc',limit:'100',...(cursor?{id:'gt.'+cursor}:{})});
 const response=await fetch(url,{headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}});
 if(!response.ok)throw Error('Published article read failed: HTTP '+response.status);
 const page=await response.json(); if(!page.length)break;
 rows.push(...page);cursor=page.at(-1).id;
}
await writeFile('tests/fixtures/simulation-articles.json',JSON.stringify(rows,null,2)+'\n');
console.log('Published articles retrieved: '+rows.length);
