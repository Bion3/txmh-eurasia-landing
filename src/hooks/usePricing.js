import { useMutation } from "@tanstack/react-query";
import { pricingApi } from "../api";

export function useRecalculatePricing() {
  return useMutation({
    mutationFn: (payload) => pricingApi.recalculate(payload).then((res) => res.data),
  });
}
