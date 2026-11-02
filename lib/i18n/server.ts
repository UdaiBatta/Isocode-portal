import { cookies } from "next/headers";
import { languageFrom } from "./index";

export async function getLanguage() {
  return languageFrom((await cookies()).get("lang")?.value);
}
