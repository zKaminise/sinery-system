import { NextResponse } from "next/server"

import { logoutPlatform } from "@/lib/platform/platform-auth"

export async function POST() {
  await logoutPlatform()
  return NextResponse.json({ success: true })
}
