import { useEffect, useState } from "react";
import type { DataQuery, QueryResult } from "../shared/messages";
import type { RecordsPageSize } from "../shared/types";
import { sendMessage } from "./utils";

export function useRuntimeQuery<T>(
  type: "QUERY_FOOTPRINTS" | "QUERY_HIGHLIGHTS" | "QUERY_VOCABULARY",
  query: DataQuery,
  refreshRevision: number,
): QueryResult<T> {
  const [result, setResult] = useState<QueryResult<T>>({ items: [], total: 0 });
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    let isCurrent = true;
    void sendMessage<QueryResult<T>>({ type, query }).then((next) => {
      if (isCurrent) setResult(next);
    });
    return () => {
      isCurrent = false;
    };
  }, [queryKey, refreshRevision, type]);

  return result;
}

export function useValidServerPage(
  page: number,
  total: number,
  recordsPageSize: RecordsPageSize,
  setPage: (page: number) => void,
): void {
  const lastPage = Math.max(0, Math.ceil(total / recordsPageSize) - 1);
  useEffect(() => {
    if (page > lastPage) setPage(lastPage);
  }, [lastPage, page, setPage]);
}
