import { http } from "./http";
import { buildQuery } from "./query";
import { applyPagination, canUseSupabase, currentUserId, nextDocNo, requireData, success } from "./supabaseAdapter";
import { supabase } from "../lib/supabaseClient";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asUuid(value) {
  return uuidPattern.test(String(value || "")) ? value : null;
}

function sanitizeSupabaseSearch(value) {
  return String(value || "").trim().replace(/[%,()]/g, " ");
}

const initialTaskTemplates = [
  ["前段", "待入集货仓", 10],
  ["前段", "装箱完成", 20],
  ["报关", "报关资料确认", 30],
  ["报关", "海关放行", 40],
  ["在途", "待发车/开船/起飞", 50],
  ["在途", "目的站到达", 60],
  ["财务", "应收应付确认", 70],
];

function hasCargoPayload(payload) {
  return Boolean(payload.cargo_desc || payload.volume_cbm || payload.weight_kg || payload.pieces || payload.package_type);
}

async function safeInsertRows(table, rows) {
  if (!rows?.length) return [];

  try {
    const { data } = await requireData(supabase.from(table).insert(rows).select("*"));
    return data || [];
  } catch (error) {
    console.warn(`[ordersApi] Skipped optional ${table} sync:`, error?.message || error);
    return [];
  }
}

async function safeOrderRows(table, orderId, orderBy = "created_at") {
  try {
    const { data } = await requireData(
      supabase.from(table).select("*").eq("order_id", orderId).order(orderBy, { ascending: true })
    );
    return data || [];
  } catch (error) {
    console.warn(`[ordersApi] Optional ${table} unavailable:`, error?.message || error);
    return [];
  }
}

async function createInitialOrderDetails({ order, payload, customerName, userId, revenue, cost }) {
  const currency = payload.currency || "USD";

  await Promise.all([
    safeInsertRows(
      "order_task_items",
      initialTaskTemplates.map(([groupName, taskName, sortOrder]) => ({
        order_id: order.id,
        group_name: groupName,
        task_name: taskName,
        sort_order: sortOrder,
        owner_id: userId,
      }))
    ),
    safeInsertRows(
      "order_cargo_items",
      hasCargoPayload(payload)
        ? [{
            order_id: order.id,
            goods_name_cn: payload.cargo_desc || "待补充货物名称",
            package_type: payload.package_type || null,
            pieces: Number(payload.pieces || 0),
            gross_weight_kg: Number(payload.weight_kg || 0),
            volume_cbm: Number(payload.volume_cbm || 0),
            chargeable_volume_cbm: Number(payload.volume_cbm || 0),
            currency,
          }]
        : []
    ),
    safeInsertRows(
      "order_service_segments",
      [{
        order_id: order.id,
        segment_type: order.transport_mode === "sea" ? "main_sea" : order.transport_mode === "air" ? "main_air" : "main_rail",
        service_mode: order.shipment_type,
        origin: order.origin,
        destination: order.destination,
        status: "pending",
        remarks: "Created from initial order entry.",
      }]
    ),
    safeInsertRows(
      "order_finance_lines",
      [
        revenue > 0
          ? {
              order_id: order.id,
              line_type: "receivable",
              party_id: order.customer_id,
              party_name: customerName,
              fee_code: "MAIN_FREIGHT",
              fee_name: "主运费收入",
              unit_price: revenue,
              quantity: 1,
              calc_method: "fixed",
              total_amount: revenue,
              currency,
              created_by: userId,
            }
          : null,
        cost > 0
          ? {
              order_id: order.id,
              line_type: "payable",
              party_name: "待匹配供应商",
              fee_code: "MAIN_COST",
              fee_name: "主运费成本",
              unit_price: cost,
              quantity: 1,
              calc_method: "fixed",
              total_amount: cost,
              currency,
              created_by: userId,
            }
          : null,
      ].filter(Boolean)
    ),
    safeInsertRows(
      "order_operation_logs",
      [{
        order_id: order.id,
        log_type: "order_created",
        actor_id: userId,
        actor_name: payload.operator_name || "system",
        action: "订单创建并初始化任务、货物、服务段和费用明细",
        after_value: {
          order_no: order.order_no,
          transport_mode: order.transport_mode,
          shipment_type: order.shipment_type,
          revenue,
          cost,
        },
      }]
    ),
  ]);
}

export const ordersApi = {
  async create(payload) {
    if (canUseSupabase()) {
      const userId = await currentUserId();
      let customerId = asUuid(payload.customer_id);
      let contactId = asUuid(payload.contact_id);
      let customerName = payload.company_name || payload.customer || "Manual Order Customer";

      if (!customerId) {
        const customerNo = await nextDocNo("CU");
        const { data: customer } = await requireData(
          supabase
            .from("customers")
            .insert([{
              customer_no: customerNo,
              company_name: customerName,
              source_primary: "manual_order",
              owner_id: userId,
              status: "active",
            }])
            .select("*")
            .single()
        );
        customerId = customer.id;
        customerName = customer.company_name || customerName;

        if (payload.contact_name) {
          const { data: contact } = await requireData(
            supabase
              .from("contacts")
              .insert([{
                customer_id: customer.id,
                name: payload.contact_name,
                is_primary: true,
                status: "active",
              }])
              .select("*")
              .single()
          );
          contactId = contact.id;
        }
      }

      const orderNo = await nextDocNo("OD");
      const revenue = Number(payload.quoted_revenue_total || payload.estimated_revenue_total || 0);
      const cost = Number(payload.quoted_cost_total || payload.estimated_cost_total || 0);
      const { data } = await requireData(
        supabase
          .from("orders")
          .insert([{
            order_no: orderNo,
            quote_id: asUuid(payload.quote_id),
            customer_id: customerId,
            contact_id: contactId,
            transport_mode: payload.transport_mode || "rail",
            shipment_type: payload.shipment_type || "LCL",
            booking_no: payload.booking_no || null,
            origin: payload.origin || null,
            destination: payload.destination || null,
            cargo_desc: payload.cargo_desc || null,
            container_type: payload.container_type || null,
            volume_cbm: Number(payload.volume_cbm || 0),
            weight_kg: Number(payload.weight_kg || 0),
            incoterm: payload.incoterm || null,
            quoted_revenue_total: revenue,
            quoted_cost_total: cost,
            quoted_profit_total: revenue - cost,
            status: payload.status || "booked",
            settlement_status: "unsettled",
            sales_owner_id: asUuid(payload.sales_owner_id) || userId,
            ops_owner_id: asUuid(payload.ops_owner_id),
          }])
          .select("*")
          .single()
      );

      await createInitialOrderDetails({ order: data, payload, customerName, userId, revenue, cost });

      return success(data);
    }

    return http.post("/orders", payload);
  },
  async list(query, signal) {
    if (canUseSupabase()) {
      let request = supabase
        .from("order_list_view")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (query?.customer_id) request = request.eq("customer_id", query.customer_id);
      if (query?.status) request = request.eq("status", query.status);
      if (query?.transport_mode) request = request.eq("transport_mode", query.transport_mode);
      if (query?.shipment_type) request = request.eq("shipment_type", query.shipment_type);
      if (query?.date_from) request = request.gte("created_at", query.date_from);
      if (query?.date_to) request = request.lte("created_at", query.date_to);
      if (query?.search) {
        const keyword = sanitizeSupabaseSearch(query.search);
        if (keyword) {
          request = request.or(`order_no.ilike.%${keyword}%,booking_no.ilike.%${keyword}%,origin.ilike.%${keyword}%,destination.ilike.%${keyword}%,customer_name.ilike.%${keyword}%,quote_no.ilike.%${keyword}%`);
        }
      }

      const { data, count } = await requireData(applyPagination(request, query));
      return success({ items: data || [] }, {
        page: Number(query?.page || 1),
        page_size: Number(query?.page_size || 20),
        total: count || 0,
      });
    }

    return http.get(`/orders${buildQuery(query)}`, signal);
  },
  async detail(orderId, signal) {
    if (canUseSupabase()) {
      const { data: order } = await requireData(
        supabase.from("orders").select("*").eq("id", orderId).single()
      );
      const [
        { data: shipments },
        { data: costs },
        { data: revenues },
        { data: receivables },
        { data: payables },
      ] = await Promise.all([
        requireData(supabase.from("shipments").select("*").eq("order_id", orderId).order("created_at", { ascending: true })),
        requireData(supabase.from("order_costs").select("*").eq("order_id", orderId).order("created_at", { ascending: true })),
        requireData(supabase.from("order_revenues").select("*").eq("order_id", orderId).order("created_at", { ascending: true })),
        requireData(supabase.from("receivables").select("*").eq("order_id", orderId).order("created_at", { ascending: true })),
        requireData(supabase.from("payables").select("*").eq("order_id", orderId).order("created_at", { ascending: true })),
      ]);
      const [
        parties,
        cargo_items,
        service_segments,
        task_items,
        documents,
        finance_lines,
        exceptions,
        operation_logs,
      ] = await Promise.all([
        safeOrderRows("order_parties", orderId),
        safeOrderRows("order_cargo_items", orderId),
        safeOrderRows("order_service_segments", orderId),
        safeOrderRows("order_task_items", orderId, "sort_order"),
        safeOrderRows("order_documents", orderId, "uploaded_at"),
        safeOrderRows("order_finance_lines", orderId),
        safeOrderRows("order_exceptions", orderId),
        safeOrderRows("order_operation_logs", orderId),
      ]);

      return success({
        ...order,
        shipments,
        costs,
        revenues,
        receivables,
        payables,
        parties,
        cargo_items,
        service_segments,
        task_items,
        documents,
        finance_lines,
        exceptions,
        operation_logs,
      });
    }

    return http.get(`/orders/${orderId}`, signal);
  },
  async update(orderId, payload) {
    if (canUseSupabase()) {
      if (payload?.status && Object.keys(payload).every((key) => ["status", "action", "actor_name"].includes(key))) {
        const { data } = await requireData(
          supabase.rpc("app_update_order_status", {
            p_order_id: orderId,
            p_status: payload.status,
            p_action: payload.action || null,
            p_actor_name: payload.actor_name || null,
          })
        );
        return success(data?.order || data);
      }

      const { data } = await requireData(
        supabase.from("orders").update(payload).eq("id", orderId).select("*").single()
      );
      return success(data);
    }

    return http.patch(`/orders/${orderId}`, payload);
  },
  async updateTask(taskId, payload) {
    if (canUseSupabase()) {
      const { data } = await requireData(
        supabase.rpc("app_update_order_task_status", {
          p_task_id: taskId,
          p_status: payload.status,
          p_actor_name: payload.actor_name || null,
        })
      );
      return success(data?.task || data);
    }

    return http.patch(`/order-task-items/${taskId}`, payload);
  },
  async addOperationLog(orderId, payload) {
    if (canUseSupabase()) {
      const userId = await currentUserId();
      const { data } = await requireData(
        supabase
          .from("order_operation_logs")
          .insert([{
            order_id: orderId,
            actor_id: userId,
            actor_name: payload.actor_name || "system",
            log_type: payload.log_type || "operation",
            action: payload.action,
            before_value: payload.before_value || null,
            after_value: payload.after_value || null,
          }])
          .select("*")
          .single()
      );
      return success(data);
    }

    return http.post(`/orders/${orderId}/operation-logs`, payload);
  },
};
