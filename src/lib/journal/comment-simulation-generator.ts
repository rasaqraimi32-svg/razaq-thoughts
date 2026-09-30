import "server-only";
import { createHash, randomInt } from "node:crypto";
import dataset from "./comment-simulation-dataset.json";

export type SimulationArticle = { id: string; title: string; slug: string; excerpt: string; content: string; updated_at: string; published_at?: string | null; categories: { name: string } | null };
export type SimulatedComment = { name: string; content: string };
// Given names, not invented identities. Groups guide distribution, not ethnicity claims.
const names = [
 "Amaka Chinedu Tunde Kelechi Aisha Ibrahim Adaeze Emeka Ngozi Oluwaseun Yetunde Nneka Chiamaka Olumide Temitope Ifeoma Obinna Folake Ayodele Damilola Bisi Chisom Ikenna Zainab Fatima Musa Halima Seyi Tolulope Uche",
 "Thandi Kwame Zanele Nia Amina Abena Akosua Kofi Ama Sipho Themba Lerato Naledi Nomsa Lindiwe Ayanda Tendai Tatenda Chipo Farai Nyasha Wanjiku Akinyi Njeri Makena Zola Imani Jabari Adwoa Esi",
 "David Sarah Michael Emily James Olivia Daniel Sophia Lucas Emma Charlotte Oliver Amelia Henry Grace Ethan Chloe Noah Abigail Benjamin Hannah Samuel Lily William Audrey Isaac Claire Owen Julia Eleanor",
 "Arjun Priya Kenji Mei Haruto Yuki Sakura Akira Hana Ren Aiko Sora Rohan Kavya Ananya Devika Nikhil Anika Isha Kiran Aditya Neha Rahul Saanvi Leela Minjun Jisoo Yuna Hyejin Jiho",
 "Sofia Mateo Lucia Diego Elena Rafael Camila Valentina Santiago Isabel Ines Tiago Beatriz Tomas Yasmin Omar Leila Samira Karim Nour Dalia Rania Elias Amira Nadia Selma Esra Deniz Farah Soraya",
].map(group => group.split(" "));
export function shuffle<T>(items: T[], int: (max: number) => number) {
 const result = [...items];
 for (let i = result.length - 1; i > 0; i--) { const j = int(i + 1); [result[i], result[j]] = [result[j], result[i]]; }
 return result;
}
export function articleFingerprint(article: SimulationArticle) {
 return createHash("sha256").update(JSON.stringify([article.title, article.excerpt, article.categories?.name ?? "", article.content])).digest("hex");
}
/** Each authored set was prepared from the complete published article, never shared
 * across articles. Fail closed on new/edited material rather than invent relevance. */
export type PreparedDataset = { fingerprint: string; comments: string[]; engagementAnchors: Record<string, number> };
export function assignSimulationNames(contents: string[], int: (max: number) => number = max => randomInt(max)): SimulatedComment[] {
 const pools = names.map(group => shuffle(group, int));
 return contents.map((content,i) => ({name:pools[[0,1,2,3,4,0,1,2][i%8]].pop()!,content}));
}
export function generateSimulatedComments(article: SimulationArticle, int: (max: number) => number = max => randomInt(max)): SimulatedComment[] {
 const entry = (dataset as Record<string, { fingerprint: string; comments: string[]; engagementAnchors: Record<string,number> }>)[article.id];
 if (!entry || entry.fingerprint !== articleFingerprint(article)) throw new Error("This new or edited article needs a freshly prepared article-specific simulation dataset.");
 const count = 15 + int(11);
 const anchors = new Set(Object.values(entry.engagementAnchors));
 const required = entry.comments.filter((_,i)=>anchors.has(i));
 const optional = shuffle(entry.comments.filter((_,i)=>!anchors.has(i)),int);
 const contents = shuffle([...required,...optional.slice(0,count-required.length)],int);
 return assignSimulationNames(contents,int);
}
