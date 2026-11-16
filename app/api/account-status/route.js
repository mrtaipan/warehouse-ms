import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ active: true }, { headers: { 'Cache-Control': 'no-store' } })
}
