import { useMemo, useState } from "react";
import { loadProcurementEstimateData, saveProcurementEstimate } from "../../api/procurementEstimate";
import { estimateFcl, estimateLcl } from "../../lib/procurement/cost-unified-model";

const fieldClass = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100";

function businessDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const initialForm = {
  transport: "lcl",
  scope: "door",
  origin: "上海",
  station: "西安",
  destination: "汉堡",
  date: businessDate(),
  pieces: "1",
  weight: "2000",
  volume: "10",
  box: "40HQ",
  quantity: "1",
  equipment: "SOC",
  pickupPlace: "",
  truck: false,
  rent: true,
  preview: false,
  fx: "7",
  eurFx: "",
  profitMode: "markup",
  profit: "0",
  pickupMode: "auto",
  pickupAmount: "",
  pickupCurrency: "USD",
  pickupReason: "",
  pickupQuoteId: "",
  termsReviewed: false,
};

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function normalized(form) {
  const number = (key) => (form[key] === "" ? null : Number(form[key]));
  const input = {
    ...form,
    pieces: number("pieces"),
    weight: number("weight"),
    volume: number("volume"),
    quantity: number("quantity"),
    fx: number("fx"),
    eurFx: number("eurFx"),
    profit: number("profit"),
  };
  if (form.pickupMode === "manual") {
    input.pickupOverride = {
      amount: number("pickupAmount"),
      currency: form.pickupCurrency,
      reason: form.pickupReason.trim(),
    };
  }
  return input;
}

function money(value) {
  return Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value)
    : "—";
}

export default function CostEstimateWorkspace({ onNotify }) {
  const [form, setForm] = useState(initialForm);
  const [sourceData, setSourceData] = useState(null);
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [segmentChoices, setSegmentChoices] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("填写货物和线路后，从当前采购价格库自动组合成本。");

  const suppliers = sourceData?.suppliers || {};
  const pickupChoices = useMemo(() => {
    const rows = selected?.inputs?.pickupChoices || [];
    return [...new Map(rows.map((item) => [item.id, item])).values()];
  }, [selected]);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage("输入已改变，请重新核算。");
  };

  const calculateWith = (input, data, choices = segmentChoices) => {
    if (input.transport === "fcl") {
      const result = estimateFcl(input, data, choices);
      setOptions([]);
      setSelected(result);
      return result;
    }
    const results = estimateLcl(input, data);
    setOptions(results);
    setSelected(results[0] || null);
    return results[0] || null;
  };

  const calculate = async () => {
    setBusy(true);
    setMessage("正在读取当前采购价格…");
    try {
      const input = normalized(form);
      const data = await loadProcurementEstimateData(input.transport);
      setSourceData(data);
      const result = calculateWith(input, data, {});
      setSegmentChoices({});
      setMessage(result ? "已使用当前有效采购价完成测算。" : "没有匹配到适用线路，请检查起运站、目的站或有效期。");
    } catch (error) {
      setSelected(null);
      setOptions([]);
      setMessage(error.message || "测算失败");
    } finally {
      setBusy(false);
    }
  };

  const selectPlan = (id) => {
    setSelected(options.find((item) => item.id === id) || null);
  };

  const selectPickup = (id) => {
    if (!sourceData) return;
    const nextForm = { ...form, pickupMode: "auto", pickupQuoteId: id };
    setForm(nextForm);
    const previousPlan = selected?.id;
    const results = estimateLcl(normalized(nextForm), sourceData);
    setOptions(results);
    setSelected(results.find((item) => item.id === previousPlan) || results[0] || null);
  };

  const selectSegment = (key, id) => {
    if (!sourceData) return;
    const choices = { ...segmentChoices, [key]: id };
    setSegmentChoices(choices);
    setSelected(estimateFcl(normalized(form), sourceData, choices));
  };

  const save = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await saveProcurementEstimate(selected);
      setMessage("测算快照已保存，后续价格库更新不会改变本次结果。");
      onNotify?.({ type: "success", title: "成本快照已保存", message: selected.label });
    } catch (error) {
      setMessage(error.message || "保存失败");
    } finally {
      setBusy(false);
    }
  };

  const available = selected?.available || {};

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-950">铁路成本测算</h3>
            <p className="mt-1 text-sm text-slate-500">只录路线与货物；拼箱、整箱采购价从价格库获取。</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">实时价格库</span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="运输方式">
            <select className={fieldClass} value={form.transport} onChange={(event) => update("transport", event.target.value)}>
              <option value="lcl">铁路拼箱</option>
              <option value="fcl">铁路整箱</option>
            </select>
          </Field>
          {form.transport === "lcl" ? (
            <Field label="核算范围">
              <select className={fieldClass} value={form.scope} onChange={(event) => update("scope", event.target.value)}>
                <option value="door">始发地至境外站</option>
                <option value="station">国内站至境外站</option>
              </select>
            </Field>
          ) : null}
          <Field label={form.transport === "fcl" ? "装箱地" : "货物始发地"}>
            <input className={fieldClass} value={form.origin} onChange={(event) => update("origin", event.target.value)} placeholder="如上海、宁波" />
          </Field>
          <Field label="国内起运站">
            <input className={fieldClass} value={form.station} onChange={(event) => update("station", event.target.value)} placeholder="如西安" />
          </Field>
          <Field label="境外目的站">
            <input className={fieldClass} value={form.destination} onChange={(event) => update("destination", event.target.value)} placeholder="如汉堡" />
          </Field>
          <Field label="价格适用日期">
            <input className={fieldClass} type="date" value={form.date} onChange={(event) => update("date", event.target.value)} />
          </Field>

          {form.transport === "lcl" ? (
            <>
              <Field label="件数"><input className={fieldClass} type="number" min="1" value={form.pieces} onChange={(event) => update("pieces", event.target.value)} /></Field>
              <Field label="毛重 kg"><input className={fieldClass} type="number" min="0" step="any" value={form.weight} onChange={(event) => update("weight", event.target.value)} /></Field>
              <Field label="体积 CBM"><input className={fieldClass} type="number" min="0" step="any" value={form.volume} onChange={(event) => update("volume", event.target.value)} /></Field>
            </>
          ) : (
            <>
              <Field label="箱型">
                <select className={fieldClass} value={form.box} onChange={(event) => update("box", event.target.value)}>
                  <option>40HQ</option><option>40GP</option><option>20GP</option><option>45HQ</option>
                </select>
              </Field>
              <Field label="柜量"><input className={fieldClass} type="number" min="1" value={form.quantity} onChange={(event) => update("quantity", event.target.value)} /></Field>
              <Field label="用箱">
                <select className={fieldClass} value={form.equipment} onChange={(event) => update("equipment", event.target.value)}><option>SOC</option><option>COC</option></select>
              </Field>
              {form.truck ? <Field label="提空箱地"><input className={fieldClass} value={form.pickupPlace} onChange={(event) => update("pickupPlace", event.target.value)} placeholder="如宁波" /></Field> : null}
            </>
          )}
        </div>

        {form.transport === "fcl" ? (
          <div className="mt-3 flex flex-wrap gap-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
            <label><input className="mr-2" type="checkbox" checked={form.truck} onChange={(event) => update("truck", event.target.checked)} />含国内拖车</label>
            <label><input className="mr-2" type="checkbox" checked={form.rent} disabled={form.equipment === "COC"} onChange={(event) => update("rent", event.target.checked)} />含 SOC 租箱</label>
            <label><input className="mr-2" type="checkbox" checked={form.preview} onChange={(event) => update("preview", event.target.checked)} />允许待确认参考价</label>
          </div>
        ) : (
          <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm font-bold text-slate-700">提货费例外处理</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="取价方式">
                <select className={fieldClass} value={form.pickupMode} onChange={(event) => update("pickupMode", event.target.value)}>
                  <option value="auto">自动按体积、重量上限取档</option>
                  <option value="manual">本票临时补价</option>
                </select>
              </Field>
              {form.pickupMode === "manual" ? (
                <>
                  <Field label="本票提货费"><input className={fieldClass} type="number" min="0" value={form.pickupAmount} onChange={(event) => update("pickupAmount", event.target.value)} /></Field>
                  <Field label="币种"><select className={fieldClass} value={form.pickupCurrency} onChange={(event) => update("pickupCurrency", event.target.value)}><option>USD</option><option>CNY</option></select></Field>
                  <Field label="补价原因"><input className={fieldClass} value={form.pickupReason} onChange={(event) => update("pickupReason", event.target.value)} placeholder="必填，如车队本票确认价" /></Field>
                </>
              ) : null}
            </div>
          </details>
        )}

        <details className="mt-3 rounded-2xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-bold text-slate-700">汇率与利润</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="1 USD = CNY"><input className={fieldClass} type="number" min="0" step="any" value={form.fx} onChange={(event) => update("fx", event.target.value)} /></Field>
            <Field label="1 EUR = USD"><input className={fieldClass} type="number" min="0" step="any" value={form.eurFx} onChange={(event) => update("eurFx", event.target.value)} /></Field>
            <Field label="利润方式"><select className={fieldClass} value={form.profitMode} onChange={(event) => update("profitMode", event.target.value)}><option value="markup">成本加成 %</option><option value="margin">销售毛利率 %</option><option value="fixed">固定利润 USD</option></select></Field>
            <Field label="利润数值"><input className={fieldClass} type="number" min="0" step="any" value={form.profit} onChange={(event) => update("profit", event.target.value)} /></Field>
          </div>
        </details>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs leading-5 text-slate-500">{message}</p>
          <button type="button" disabled={busy} onClick={calculate} className="shrink-0 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
            {busy ? "处理中…" : "匹配价格并核算"}
          </button>
        </div>
      </section>

      <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-bold text-slate-950">测算结果</h3>
        {!selected ? <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">尚未生成测算结果。</p> : (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-slate-950 p-3 text-white"><div className="text-xs text-slate-400">采购成本</div><div className="mt-1 text-lg font-bold">{money(selected.result.cost)}</div></div>
              <div className="rounded-2xl bg-sky-50 p-3 text-sky-950"><div className="text-xs text-sky-600">建议售价</div><div className="mt-1 text-lg font-bold">{money(selected.result.price)}</div></div>
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-950"><div className="text-xs text-emerald-600">利润</div><div className="mt-1 text-lg font-bold">{money(selected.result.profit)}</div></div>
            </div>

            {options.length > 1 ? <Field label="拼箱铁路方案"><select className={fieldClass} value={selected.id} onChange={(event) => selectPlan(event.target.value)}>{options.map((item) => <option key={item.id} value={item.id}>{item.label} · {money(item.result.cost)}</option>)}</select></Field> : null}
            {form.transport === "lcl" && pickupChoices.length ? <Field label="本地提货价模板"><select className={fieldClass} value={selected.inputs.pickupQuote?.quoteId || ""} onChange={(event) => selectPickup(event.target.value)}>{pickupChoices.map((item) => <option key={item.id} value={item.id}>{item.quote.templateName || suppliers[item.quote.supplier_id] || "提货价模板"}{item.complete ? "" : " · 待核对"}</option>)}</select></Field> : null}

            {form.transport === "fcl" ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {["truck", "rail", "rent"].map((key) => available[key]?.length ? (
                  <Field key={key} label={{ truck: "国内拖车报价", rail: "整箱铁路报价", rent: "SOC 租箱报价" }[key]}>
                    <select className={fieldClass} value={selected.inputs.sources?.[key]?.id || ""} onChange={(event) => selectSegment(key, event.target.value)}>
                      {available[key].map((item) => <option key={item.id} value={item.id}>{suppliers[item.supplier_id] || "供应商待确认"} · {item.quote.currency} {item.quote.price ?? "待定"}</option>)}
                    </select>
                  </Field>
                ) : null)}
              </div>
            ) : null}

            <div className="mt-4 space-y-2">
              {selected.result.lines.map((line, index) => (
                <div key={`${line.name}-${index}`} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3"><span className="text-sm font-bold text-slate-800">{line.name}</span><span className="text-sm font-bold text-slate-950">{money(line.value)}</span></div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">{line.basis}{line.supplier_id ? ` · ${suppliers[line.supplier_id] || "供应商"}` : ""}</div>
                </div>
              ))}
            </div>

            {selected.result.pending.length ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                <div className="font-bold">仍需确认</div>
                {selected.result.pending.map((item) => <div key={item}>• {item}</div>)}
              </div>
            ) : <div className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">费用完整，可保存快照。</div>}

            <button type="button" disabled={busy} onClick={save} className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 disabled:opacity-50">保存本次成本快照</button>
          </>
        )}
      </section>
    </div>
  );
}
