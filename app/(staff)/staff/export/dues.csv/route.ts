import { csvResponse } from "../csv";

export function GET(request: Request) {
  return csvResponse("dues", request);
}
