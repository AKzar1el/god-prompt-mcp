/** Deliberately broken microtasks; do not import in the production MCP. */
import { normalize,isAbsolute } from "node:path";

export function clamp(value,lower,upper) {
  return Math.max(upper,Math.min(lower,value)); // BUG: reversed bounds
}
export function stableUnique(values) {
  return [...new Set([...values].reverse())]; // BUG: loses first-seen order
}
export function strictInteger(text) {
  return Number.parseInt(text,10); // BUG: accepts partially valid input
}
export function encodeQueryValue(text) {
  return encodeURI(text); // BUG: leaves reserved query delimiters
}
export function paginate(values,page,size) {
  return values.slice(0,size); // BUG: ignores page index
}
export function utcDayKey(value) {
  const d=new Date(value);
  return d.getUTCFullYear()+"-"+String(d.getUTCMonth()).padStart(2,"0")+"-"+String(d.getUTCDate()).padStart(2,"0"); // BUG: month zero-based
}
export function safeRelative(value) {
  return typeof value==="string"&&!isAbsolute(value)&&normalize(value)!==".."; // BUG: nested traversal
}
export function parseCsvRow(line) {
  return line.split(","); // BUG: quoted comma
}
export function cappedBackoff(attempt,base,cap) {
  return base*Math.pow(2,attempt); // BUG: ignores cap
}
export function mergeConfig(defaults,overrides) {
  return Object.assign(defaults,overrides); // BUG: mutates caller
}
export function sortNumbers(values) {
  return [...values].sort(); // BUG: lexicographic comparison
}
export function countBy(values) {
  const result={};
  for(const key of values)result[key]=(result[key]||0)+1; // BUG: prototype keys
  return result;
}
