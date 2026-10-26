import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync("index.html", "utf8");
const seedSource = readFileSync("seed-data.js", "utf8");
const readme = readFileSync("README.md", "utf8");

assert.match(html, /<!doctype html>/i, "Нет HTML5 doctype");
assert.match(html, /<html[^>]+lang=["']ru["']/i, "Нет русской локали");
assert.match(html, /<script\s+src=["']\.\/seed-data\.js["']/i, "Не подключён каталог");
assert.match(html, /Демонстрация[^<]{0,100}без связи с настоящим сайтом/i, "Нет предупреждения о демо");
assert.match(readme, /localStorage/, "Не описано локальное хранение данных");

const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1]).filter((script) => script.trim());
assert.ok(inlineScripts.length > 0, "В index.html не найден исполняемый JavaScript");
inlineScripts.forEach((source, index) => new vm.Script(source, { filename: "inline-" + index + ".js" }));
new vm.Script(seedSource, { filename: "seed-data.js" });

const sandbox = { window: {} };
vm.runInNewContext(seedSource, sandbox, { timeout: 1000 });
const seed = sandbox.window.FABRICA_DEMO_SEED;
assert.ok(Array.isArray(seed), "Нет массива FABRICA_DEMO_SEED");
const counts = { mhk: 0, khas: 0 };
const seen = new Set();
const duplicates = [];
for (const [index, row] of seed.entries()) {
  assert.ok(Array.isArray(row) && row.length === 4, "Неверная структура позиции " + index);
  const [branch, category, name, price] = row;
  assert.ok(Object.hasOwn(counts, branch), "Неизвестный филиал: " + branch);
  assert.ok(typeof category === "string" && category.trim(), "Нет категории у позиции " + index);
  assert.ok(typeof name === "string" && name.trim(), "Нет названия у позиции " + index);
  assert.ok(Number.isSafeInteger(price) && price > 0, "Неверная цена у позиции " + index);
  counts[branch]++;
  const key = branch + "|" + name.trim().toLocaleLowerCase("ru");
  if (seen.has(key)) duplicates.push(key);
  seen.add(key);
}
assert.equal(seed.length, 106, "Количество позиций изменилось — проверьте каталог");
assert.equal(counts.mhk, 71, "Количество позиций Махачкалы изменилось");
assert.equal(counts.khas, 35, "Количество позиций Хасавюрта изменилось");
if (duplicates.length) {
  console.warn("Предупреждение: возможные дубли (не блокируют CI): " + duplicates.join(", "));
}
console.log("Проверки демо пройдены: HTML, JavaScript, данные " + seed.length + " позиций.");
