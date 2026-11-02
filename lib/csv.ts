export function csv(rows: (string | number)[][]) {
  return rows.map((row) => row.map((value) => {
    const text = String(value);
    return '"' + (/^[\s]*[=+@-]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"';
  }).join(",")).join("\r\n") + "\r\n";
}
