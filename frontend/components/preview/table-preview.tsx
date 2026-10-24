import { useMemo } from "react";
import { parseDelimited } from "@/lib/preview";
export default function TablePreview({
  content,
  delimiter,
}: {
  content: string;
  delimiter: string;
}) {
  const data = useMemo(
    () => parseDelimited(content, delimiter),
    [content, delimiter],
  );
  if (data.error)
    return (
      <p role="alert" className="p-6 text-destructive">
        {data.error}
      </p>
    );
  if (!data.rows.length)
    return <p className="p-6 text-muted-foreground">This table is empty.</p>;
  const width = Math.max(...data.rows.map((row) => row.length));
  return (
    <div className="h-full overflow-auto">
      <div className="sticky left-0 px-4 py-2 text-xs text-muted-foreground">
        {data.rows.length - 1} data rows shown · {width} columns
        {data.truncated
          ? " · Preview limited to 200 rows and 50 columns. Open Source for the full file."
          : ""}
      </div>
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-muted">
          <tr>
            <th className="border px-3 py-2 text-muted-foreground">#</th>
            {Array.from({ length: width }, (_, i) => (
              <th className="min-w-32 border px-3 py-2 font-medium" key={i}>
                {data.rows[0][i] || `Column ${i + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.slice(1).map((row, i) => (
            <tr key={i} className="even:bg-muted/30">
              <td className="border px-3 py-2 text-xs text-muted-foreground">
                {i + 1}
              </td>
              {Array.from({ length: width }, (_, col) => (
                <td
                  key={col}
                  className="max-w-sm whitespace-pre-wrap break-words border px-3 py-2"
                >
                  {row[col] || ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
