import type { HaiTextbookCatalogEntry } from "@/db/hai-api";
import { UNIT_SCOPES, type UnitBookSelection, type UnitScope } from "@/lib/hai-unit-design";
import { formatHaiTextbookName, getHaiTextbookHierarchy } from "@/lib/hai-textbook-hierarchy";
import { Plus, Trash2 } from "lucide-react";

export default function UnitTextbookSelector({ catalog, scope, books, onChange, onScopeChange }: {
  catalog: HaiTextbookCatalogEntry[];
  scope: UnitScope | "";
  books: UnitBookSelection[];
  onChange: (books: UnitBookSelection[]) => void;
  onScopeChange: (scope: UnitScope) => void;
}) {
  const collections = [...new Map(catalog.map((row) => [row.collection_slug, row])).values()];
  const labels = getHaiTextbookHierarchy(catalog[0]?.subject ?? "", catalog);
  const visibleBooks = books.length ? books : [{ collection_slug: "", units: [] }];
  function changeBook(index: number, book: UnitBookSelection) {
    onChange(visibleBooks.map((item, i) => i === index ? book : item));
  }
  return <div className="col-span-full">
    <fieldset>
      <legend className="text-xs font-bold text-txs">重构范围</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {UNIT_SCOPES.map((item) => <label key={item.value} title={item.description} className={`cursor-pointer rounded-lg border px-3 py-2 transition ${scope === item.value ? "border-[var(--proof)] bg-[var(--proof-soft)] ring-2 ring-[var(--proof)]/10" : "border-bd bg-[var(--paper)] hover:border-ac/50"}`}>
          <span className="flex items-center gap-2 text-sm font-black text-tx"><input aria-label={item.name} type="radio" name="unit-scope" value={item.value} checked={scope === item.value} onChange={() => { onScopeChange(item.value); }} />{item.name}</span>
        </label>)}
      </div>
    </fieldset>
    {scope && <div className="mt-5 space-y-4">
      {visibleBooks.map((book, index) => {
        const rows = catalog.filter((row) => row.collection_slug === book.collection_slug);
        const units = [...new Map(rows.map((row) => [row.unit_route_number, row])).values()];
        return <section key={index} className="rounded-ds-lg border border-bd bg-[var(--paper-deep)] p-4">
          <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-semibold text-tx">教材 {String(index + 1).padStart(2, "0")}</h3>{scope === "across-books" && visibleBooks.length > 1 && <button type="button" aria-label={`移除教材 ${index + 1}`} onClick={() => onChange(visibleBooks.filter((_, i) => i !== index))} className="rounded p-2 text-txs hover:text-red-700"><Trash2 className="h-4 w-4" /></button>}</div>
          <label className="block text-xs font-bold text-txs">{`教材 ${index + 1} · 年级 / 册次`}
            <select aria-label={`教材 ${index + 1} · 年级 / 册次`} className="mt-2 h-11 w-full rounded-ds-md border border-bd bg-[var(--paper)] px-3 text-sm text-tx" value={book.collection_slug} onChange={(event) => changeBook(index, { collection_slug: event.target.value, units: [] })}>
              <option value="">请选择教材</option>
              {collections.map((row) => <option key={row.collection_slug} value={row.collection_slug} disabled={visibleBooks.some((other, i) => i !== index && other.collection_slug === row.collection_slug)}>{formatHaiTextbookName(row)}</option>)}
            </select>
          </label>
          {catalog.length === 0 && <p className="mt-3 text-xs leading-5 text-txs">当前学段、学科尚无可选教材。请等待目录加载，或选择已有教材的学科。</p>}
          <div className="mt-4 space-y-3">
            {units.map((row) => {
              const selected = book.units.find((unit) => unit.unit_number === row.unit_route_number);
              const unitRows = rows.filter((item) => item.unit_route_number === row.unit_route_number);
              const lessons = [...new Map(unitRows.map((item) => [item.lesson_route_number, item])).values()];
              function updateUnit(lessons: UnitBookSelection["units"][number]["lessons"]) {
                changeBook(index, { ...book, units: book.units.map((unit) => unit.unit_number === row.unit_route_number ? { ...unit, lessons } : unit) });
              }
              return <div key={row.unit_route_number} className={`rounded-ds-md border p-3 ${selected ? "border-ac/50 bg-[var(--paper)]" : "border-bd"}`}>
                <label className="flex cursor-pointer items-start gap-2 text-sm font-bold text-tx"><input className="mt-1" type={scope === "within-unit" ? "radio" : "checkbox"} name={`unit-${index}`} checked={Boolean(selected)} onChange={() => {
                  const next = { unit_number: row.unit_route_number };
                  changeBook(index, { ...book, units: scope === "within-unit" ? [next] : selected ? book.units.filter((unit) => unit !== selected) : [...book.units, next].sort((a, b) => a.unit_number - b.unit_number) });
                }} />{row.unit_label} {row.unit_title}</label>
                {selected && scope !== "within-unit" && <div className="mt-3 border-t border-bd pt-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-ac"><input type="checkbox" checked={selected.lessons === undefined} onChange={(event) => updateUnit(event.target.checked ? undefined : [])} />完整{labels.top}（包含全部{labels.middle}）</label>
                  <div className="mt-3 space-y-2 pl-1">
                    {lessons.map((lesson) => {
                      const chosen = selected.lessons?.find((item) => item.lesson_number === lesson.lesson_route_number);
                      const frames = unitRows.filter((item) => item.lesson_route_number === lesson.lesson_route_number && item.frame_route_number);
                      return <div key={lesson.lesson_route_number}>
                        <label className="flex items-start gap-2 text-xs leading-5 text-txs"><input className="mt-1" type="checkbox" checked={selected.lessons === undefined || Boolean(chosen)} onChange={() => {
                          const current = selected.lessons ?? lessons.map((item) => ({ lesson_number: item.lesson_route_number }));
                          updateUnit(current.some((item) => item.lesson_number === lesson.lesson_route_number) ? current.filter((item) => item.lesson_number !== lesson.lesson_route_number) : [...current, { lesson_number: lesson.lesson_route_number }].sort((a, b) => a.lesson_number - b.lesson_number));
                        }} />{lesson.lesson_label} {lesson.lesson_title}</label>
                        {chosen && frames.length > 0 && <div className="ml-5 mt-2 flex flex-wrap gap-2">
                          {frames.map((frame) => <label key={frame.frame_route_number} className="flex items-center gap-1.5 rounded border border-bd px-2 py-1 text-xs text-txs"><input type="checkbox" checked={!chosen.frame_numbers || chosen.frame_numbers.includes(frame.frame_route_number!)} onChange={() => {
                            const current = chosen.frame_numbers ?? frames.map((item) => item.frame_route_number!);
                            const next = current.includes(frame.frame_route_number!) ? current.filter((n) => n !== frame.frame_route_number) : [...current, frame.frame_route_number!];
                            updateUnit(selected.lessons!.map((item) => item === chosen ? { ...item, frame_numbers: next } : item));
                          }} />{frame.frame_label} {frame.frame_title}</label>)}
                        </div>}
                      </div>;
                    })}
                  </div>
                </div>}
              </div>;
            })}
          </div>
        </section>;
      })}
      {scope === "across-books" && <button type="button" onClick={() => onChange([...visibleBooks, { collection_slug: "", units: [] }])} className="flex w-full items-center justify-center gap-2 rounded-ds-lg border border-dashed border-ac/50 p-3 text-sm font-bold text-ac"><Plus className="h-4 w-4" />添加另一本教材</button>}
      <p role="status" className="text-xs leading-5 text-txs">已选 {books.filter((book) => book.collection_slug).length} 本教材 · {books.reduce((sum, book) => sum + book.units.length, 0)} 个{labels.top}。仅按勾选范围读取教材；课标自动匹配，缺失时留空并注明待核验。</p>
    </div>}
  </div>;
}
